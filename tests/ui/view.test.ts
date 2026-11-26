import { expect, test } from 'vitest';
import { fitView } from '../../src/ui/view';

test('fitView letterboxes the tank into the canvas', () => {
  const v = fitView(800, 900, 1600, 900);
  expect(v.scale).toBeCloseTo(0.5);
  expect(v.offsetX).toBeCloseTo(0);
  expect(v.offsetY).toBeCloseTo((900 - 450) / 2);
});
