// A save as one file: JSON with tagged Maps and typed arrays, gzip-compressed.
// The worker, scripts/inspect.ts and the tests share this module.
import type { LoopSave } from './worker/loop';

/** Bump when the saved state changes shape, so that an old save is ignored. */
export const SAVE_VERSION = 3;

export interface SaveFile {
  version: number;
  data: LoopSave;
}

/** The typed-array classes a save holds. */
const TYPED = { Float32Array, Float64Array };
type TypedName = keyof typeof TYPED;

function replacer(_key: string, v: unknown): unknown {
  if (v instanceof Map) return { $map: [...v] };
  if (v instanceof Float32Array || v instanceof Float64Array) {
    return { $typed: v.constructor.name, data: Array.from(v) };
  }
  return v;
}

function reviver(_key: string, v: unknown): unknown {
  if (typeof v !== 'object' || v === null) return v;
  if ('$map' in v) return new Map(v.$map as [unknown, unknown][]);
  if ('$typed' in v) {
    const { $typed, data } = v as { $typed: TypedName; data: number[] };
    return new TYPED[$typed](data);
  }
  return v;
}

export function encodeSave(data: LoopSave): string {
  const file: SaveFile = { version: SAVE_VERSION, data };
  return JSON.stringify(file, replacer);
}

/** Throws on a file of another version or on text that is not JSON. */
export function decodeSave(text: string): LoopSave {
  const file = JSON.parse(text, reviver) as SaveFile;
  if (file.version !== SAVE_VERSION) throw new Error('Wrong save version');
  return file.data;
}

async function pipe(bytes: Uint8Array, stream: TransformStream<BufferSource, Uint8Array>): Promise<Uint8Array> {
  const out = new Blob([bytes as BufferSource]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function packSave(data: LoopSave): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(encodeSave(data)), new CompressionStream('gzip'));
}

export async function unpackSave(bytes: Uint8Array): Promise<LoopSave> {
  const text = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('gzip')));
  return decodeSave(text);
}
