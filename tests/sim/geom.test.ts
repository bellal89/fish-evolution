import { expect, test } from 'vitest';
import { keepInTank, wrapAngle } from '../../src/sim/geom';

test('wrapAngle', () => {
  expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
});

// Radius 10 in a 100 x 50 tank of water.
const PI = Math.PI;
test.each([
  ['left wall', -5, 20, PI, 10, 20, 0],
  ['right wall', 105, 20, 0, 90, 20, PI],
  ['surface', 50, -5, -PI / 2, 50, 10, PI / 2],
  ['floor', 50, 55, PI / 2, 50, 40, -PI / 2],
  ['corner', 105, 55, PI / 4, 90, 40, -3 * PI / 4],
  ['at a wall but heading away', 5, 20, 0, 10, 20, 0],
])('keepInTank: %s', (_, x, y, heading, ex, ey, eh) => {
  const b = { x, y, heading };
  keepInTank(b, 10, 100, 50);
  expect(b.x).toBe(ex);
  expect(b.y).toBe(ey);
  expect(b.heading).toBeCloseTo(eh);
});
