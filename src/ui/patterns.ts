import type { ColorGenes } from '../sim/traits';

export interface Mark {
  kind: 'stripe' | 'spot' | 'band';
  /** Center in body coordinates (x along the body, head at +x). */
  x: number;
  y: number;
  /** Half-width and half-height. A spot uses w as its radius. */
  w: number;
  h: number;
}

/** Cheap deterministic hash → [0,1) so a fish's spots don't jump between frames. */
function hash01(id: number, k: number): number {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Geometry of a fish's pattern inside a body of half-length hl and half-height hh. */
export function patternMarks(c: ColorGenes, id: number, hl: number, hh: number): Mark[] {
  const n = c.patternCount;
  const marks: Mark[] = [];
  if (c.pattern === 'stripes') {
    const from = -0.6 * hl, to = 0.45 * hl;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (from + to) / 2 : from + ((to - from) * i) / (n - 1);
      marks.push({ kind: 'stripe', x, y: 0, w: hl * 0.09, h: hh });
    }
  } else if (c.pattern === 'spots') {
    for (let i = 0; i < n * 2; i++) {
      const a = hash01(id, i * 2) * Math.PI * 2;
      const r = Math.sqrt(hash01(id, i * 2 + 1)) * 0.7;
      marks.push({ kind: 'spot', x: Math.cos(a) * r * hl, y: Math.sin(a) * r * hh, w: hh * 0.22, h: hh * 0.22 });
    }
  } else if (c.pattern === 'bands') {
    const k = Math.min(n, 3);
    for (let i = 0; i < k; i++) {
      const y = k === 1 ? 0 : -0.45 * hh + (0.9 * hh * i) / (k - 1);
      marks.push({ kind: 'band', x: 0, y, w: hl, h: hh * 0.12 });
    }
  }
  return marks;
}
