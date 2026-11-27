import { expect, test } from 'vitest';
import { World } from '../../src/sim/world';

// Optimisations must keep results bit-identical; re-pin whenever CONFIG changes.
test('world fingerprint after 2000 ticks of seed 7', () => {
  const w = new World(7);
  for (let i = 0; i < 2000; i++) w.step();
  let sx = 0, sy = 0, se = 0, so = 0;
  for (const f of w.fish) {
    sx += f.x;
    sy += f.y;
    se += f.energy;
    for (const o of f.lastOutputs) so += o;
  }
  expect(w.fish.length).toBe(160);
  expect(w.events.matings).toBe(13);
  expect(w.events.foodEaten).toBe(3860.053229698681);
  expect(sx).toBe(125311.66221501562);
  expect(sy).toBe(67462.20003167237);
  expect(se).toBe(8885.279279431597);
  expect(so).toBe(-32.52350652893074);
}, 30_000);
