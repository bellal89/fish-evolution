import { expect, test } from 'vitest';
import { Rng } from '../../src/sim/rng';

test('same seed same sequence', () => {
  const a = new Rng(42), b = new Rng(42);
  for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
});

test('next in [0,1)', () => {
  const r = new Rng(1);
  for (let i = 0; i < 10000; i++) {
    const v = r.next();
    expect(v >= 0 && v < 1).toBe(true);
  }
});

test('int in range', () => {
  const r = new Rng(3);
  for (let i = 0; i < 1000; i++) {
    const v = r.int(5);
    expect(Number.isInteger(v) && v >= 0 && v < 5).toBe(true);
  }
});
