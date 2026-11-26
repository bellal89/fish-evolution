import { expect, test } from 'vitest';
import { wrapAngle } from '../../src/sim/geom';

test('wrapAngle', () => {
  expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
});
