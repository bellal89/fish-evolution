import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { pickFish } from '../../src/ui/pick';

const fish = [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10, y: 0 }];

test('nearest fish within the radius wins', () => {
  expect(pickFish(fish, 8, 0)).toBe(2);
  expect(pickFish(fish, 2, 0)).toBe(1);
});

test('outside the radius gives null', () => {
  expect(pickFish(fish, 10 + CONFIG.PICK_RADIUS + 1, 0)).toBeNull();
});
