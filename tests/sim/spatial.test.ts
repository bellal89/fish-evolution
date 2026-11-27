import { expect, test } from 'vitest';
import { SpatialGrid } from '../../src/sim/spatial';

test('query returns only nearby', () => {
  const g = new SpatialGrid<{ x: number; y: number }>(50, 1000, 1000);
  const a = { x: 10, y: 10 };
  const b = { x: 500, y: 500 };
  g.insert(a);
  g.insert(b);
  expect(g.query(12, 12, 20)).toEqual([a]);
});

test('query is exact by distance, not by cell', () => {
  const g = new SpatialGrid<{ x: number; y: number }>(50, 1000, 1000);
  g.insert({ x: 49, y: 49 });
  expect(g.query(1, 1, 20)).toEqual([]);
});

test('clear empties the grid, edge items are found', () => {
  const g = new SpatialGrid<{ x: number; y: number }>(50, 100, 100);
  g.insert({ x: 100, y: 100 });
  expect(g.query(99, 99, 5).length).toBe(1);
  g.clear();
  expect(g.query(99, 99, 5)).toEqual([]);
});
