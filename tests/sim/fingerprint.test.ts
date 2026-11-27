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
  expect(w.fish.length).toBe(155);
  expect(w.events.matings).toBe(8);
  expect(w.events.foodEaten).toBe(4284.608542088886);
  expect(sx).toBe(117497.51880003976);
  expect(sy).toBe(68625.73838990329);
  expect(se).toBe(9666.165041258644);
  expect(so).toBe(-15.54723458562512);
}, 30_000);
