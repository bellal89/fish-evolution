import { expect, test } from 'vitest';
import type { Genome } from '../../src/neat/genome';
import { CONFIG } from '../../src/sim/config';
import { Lineage } from '../../src/sim/lineage';

const g = (): Genome => ({ nodes: [], conns: [] });

function family(): Lineage {
  const l = new Lineage();
  l.born(1, null, g()); // A
  l.born(2, null, g()); // B
  l.born(3, [1, 2], g()); // C
  l.born(4, [1, 2], g()); // D
  l.born(5, null, g()); // E
  l.born(6, [3, 5], g()); // F
  return l;
}

test('lineage leader is ancestor with most living descendants', () => {
  const l = family();
  l.died(1);
  l.died(2);
  expect(l.alive(1)).toBe(3);
  expect(l.alive(2)).toBe(3);
  expect(l.alive(3)).toBe(1);
  expect(l.alive(5)).toBe(1);
  const lead = l.leader();
  expect(lead?.id).toBe(1);
  expect(lead?.living).toBe(3);
});

test('an ancestor reachable by two paths is counted once', () => {
  const l = new Lineage();
  l.born(1, null, g());
  l.born(2, [1, 1], g());
  l.born(3, [1, 2], g());
  expect(l.alive(1)).toBe(2);
  l.died(3);
  expect(l.alive(1)).toBe(1);
});

test('deaths decrement ancestors', () => {
  const l = family();
  l.died(6);
  expect(l.alive(1)).toBe(2);
  expect(l.alive(3)).toBe(0);
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
  l.born(7, [5, 5], g());
  expect(l.leader()?.id).toBe(5);
  expect(l.alive(1)).toBe(0);
  expect(l.alive(999)).toBe(0);
});

test('dead record with living descendants is kept', () => {
  const l = family();
  l.died(1);
  l.died(2);
  l.died(3);
  expect(l.alive(1)).toBe(2);
  expect(l.leader()?.id).toBe(1);
});

test('ties go to the lowest id', () => {
  const l = new Lineage();
  l.born(9, null, g());
  l.born(4, null, g());
  l.born(10, [9, 4], g());
  expect(l.leader()?.id).toBe(4);
});

test('counts reach only LINEAGE_DEPTH generations', () => {
  const l = new Lineage();
  l.born(0, null, g());
  for (let i = 1; i <= CONFIG.LINEAGE_DEPTH + 2; i++) l.born(i, [i - 1, i - 1], g());
  // Ancestor 0 sees descendants 1..DEPTH only.
  expect(l.alive(0)).toBe(CONFIG.LINEAGE_DEPTH);
  l.died(CONFIG.LINEAGE_DEPTH + 2);
  expect(l.alive(0)).toBe(CONFIG.LINEAGE_DEPTH);
  l.died(CONFIG.LINEAGE_DEPTH);
  expect(l.alive(0)).toBe(CONFIG.LINEAGE_DEPTH - 1);
});
