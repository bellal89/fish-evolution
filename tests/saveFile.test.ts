import { expect, test } from 'vitest';
import { decodeSave, encodeSave, packSave, unpackSave } from '../src/saveFile';
import { World } from '../src/sim/world';

const state = (w: World) =>
  JSON.stringify(w.save(), (_, v) => (ArrayBuffer.isView(v) ? Array.from(v as Float64Array) : v instanceof Map ? [...v] : v));

test('a world restored from the file encoding continues identically', () => {
  const a = new World(3);
  for (let i = 0; i < 3000; i++) a.step();
  const [f] = a.fish;
  a.leaderHistory.push({ tick: a.tick, living: 2, genome: f.genome, traits: f.traits });
  const b = new World(decodeSave(encodeSave({ world: a.save(), history: [] })).world);
  for (let i = 0; i < 1000; i++) { a.step(); b.step(); }
  expect(state(b)).toBe(state(a));
}, 60_000);

test('Maps and typed arrays keep their class', () => {
  const w = new World(1);
  w.step();
  const decoded = decodeSave(encodeSave({ world: w.save(), history: [] }));
  expect(decoded.world.field.cells).toBeInstanceOf(Float64Array);
  expect(decoded.world.fish[0].lastInputs).toBeInstanceOf(Float32Array);
  expect((decoded.world.lineage as unknown as { records: unknown }).records).toBeInstanceOf(Map);
});

test('pack and unpack round trip through gzip', async () => {
  const w = new World(2);
  for (let i = 0; i < 50; i++) w.step();
  const save = { world: w.save(), history: [] };
  const bytes = await packSave(save);
  expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
  expect(encodeSave(await unpackSave(bytes))).toBe(encodeSave(save));
});

test('decode rejects another version and garbage', async () => {
  expect(() => decodeSave(JSON.stringify({ version: 2, data: {} }))).toThrow('Wrong save version');
  expect(() => decodeSave('nope')).toThrow();
  await expect(unpackSave(new Uint8Array([1, 2, 3]))).rejects.toThrow();
});
