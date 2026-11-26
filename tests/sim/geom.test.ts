import { expect, test } from 'vitest';
import { rayCircle, wrapAngle } from '../../src/sim/geom';

test('wrapAngle', () => {
  expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
});

test('rayCircle hit and miss', () => {
  expect(rayCircle(0, 0, 1, 0, 10, 0, 2)).toBeCloseTo(8);
  expect(rayCircle(0, 0, 1, 0, -10, 0, 2)).toBeNull();
  expect(rayCircle(0, 0, 1, 0, 10, 5, 2)).toBeNull();
  expect(rayCircle(0, 0, 1, 0, 1, 0, 2)).toBe(0);
});
