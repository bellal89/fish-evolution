import { expect, test } from 'vitest';
import { FertilizerField } from '../../src/sim/nutrients';

test('diffusion conserves total', () => {
  const f = new FertilizerField(8, 4, 80, 40);
  f.add(5, 5, 100);
  for (let i = 0; i < 500; i++) f.diffuse(0.2);
  expect(f.total()).toBeCloseTo(100, 6);
});

test('diffusion spreads a point source', () => {
  const f = new FertilizerField(8, 4, 80, 40);
  f.add(5, 5, 100);
  f.diffuse(0.2);
  expect(f.at(5, 5)).toBeLessThan(100);
  expect(f.at(15, 5)).toBeGreaterThan(0);
});

test('take never exceeds available', () => {
  const f = new FertilizerField(8, 4, 80, 40);
  f.add(5, 5, 1);
  expect(f.take(5, 5, 5)).toBe(1);
  expect(f.at(5, 5)).toBe(0);
});

test('out-of-bounds coordinates clamp to edge cells', () => {
  const f = new FertilizerField(8, 4, 80, 40);
  f.add(-10, 999, 2);
  expect(f.at(0, 40)).toBe(2);
});
