import { expect, test } from 'vitest';
import type { Genome } from '../../src/neat/genome';
import { CONFIG } from '../../src/sim/config';
import { Lineage } from '../../src/sim/lineage';
import { Rng } from '../../src/sim/rng';
import { randomTraits, type Traits } from '../../src/sim/traits';

const g = (): Genome => ({ nodes: [], conns: [] });
const t = (n = 0): Traits => randomTraits(new Rng(n));
/** Distinct traits for the ids in family(). */
const tr = [0, 1, 2, 3, 4, 5, 6].map(n => t(n));

function family(): Lineage {
  const l = new Lineage();
  l.born(1, null, g(), tr[1]); // A
  l.born(2, null, g(), tr[2]); // B
  l.born(3, [1, 2], g(), tr[3]); // C
  l.born(4, [1, 2], g(), tr[4]); // D
  l.born(5, null, g(), tr[5]); // E
  l.born(6, [3, 5], g(), tr[6]); // F
  return l;
}

test('lineage leader is ancestor with most living descendants', () => {
  const l = family();
  l.died(1);
  l.died(2);
  expect(l.living(1)).toBe(3);
  expect(l.living(2)).toBe(3);
  expect(l.living(3)).toBe(1);
  expect(l.living(5)).toBe(1);
  const lead = l.leader();
  expect(lead?.id).toBe(1);
  expect(lead?.living).toBe(3);
});

test('an ancestor reachable by two paths is counted once', () => {
  const l = new Lineage();
  l.born(1, null, g(), t());
  l.born(2, [1, 1], g(), t());
  l.born(3, [1, 2], g(), t());
  expect(l.living(1)).toBe(2);
  l.died(3);
  expect(l.living(1)).toBe(1);
});

test('deaths decrement ancestors', () => {
  const l = family();
  l.died(6);
  expect(l.living(1)).toBe(2);
  expect(l.living(3)).toBe(0);
});

test('lineage prunes dead branches', () => {
  const l = family();
  l.died(1);
  l.died(2);
  l.died(6);
  l.died(3);
  l.died(4);
  // 1, 2, 3, 4, 6 are dead with nothing alive below; only E remains.
  expect(l.leader()).toBeNull();
  l.born(7, [5, 5], g(), t());
  expect(l.leader()?.id).toBe(5);
  expect(l.living(1)).toBe(0);
  expect(l.living(999)).toBe(0);
});

test('ties go to the lowest id', () => {
  const l = new Lineage();
  l.born(9, null, g(), t());
  l.born(4, null, g(), t());
  l.born(10, [9, 4], g(), t());
  expect(l.leader()?.id).toBe(4);
});

test('counts reach only LINEAGE_DEPTH generations', () => {
  const l = new Lineage();
  l.born(0, null, g(), t());
  for (let i = 1; i <= CONFIG.LINEAGE_DEPTH + 2; i++) l.born(i, [i - 1, i - 1], g(), t());
  // Ancestor 0 sees descendants 1..DEPTH only.
  expect(l.living(0)).toBe(CONFIG.LINEAGE_DEPTH);
  l.died(CONFIG.LINEAGE_DEPTH + 2);
  expect(l.living(0)).toBe(CONFIG.LINEAGE_DEPTH);
  l.died(CONFIG.LINEAGE_DEPTH);
  expect(l.living(0)).toBe(CONFIG.LINEAGE_DEPTH - 1);
});

test('leader returns the traits given at birth', () => {
  const l = family();
  l.died(1);
  l.died(2);
  expect(l.leader()!.traits).toBe(tr[1]);
});

test('top orders by living, then id', () => {
  const l = family();
  l.died(1);
  l.died(2);
  // Living: 1 and 2 have 3 each; 3 and 5 have 1 each; 4 and 6 have 0.
  expect(l.top(10).map(r => [r.id, r.living])).toEqual([[1, 3], [2, 3], [3, 1], [5, 1]]);
  expect(l.top(2).map(r => r.id)).toEqual([1, 2]);
});
