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
  expect(w.fish.length).toBe(162);
  expect(w.events.matings).toBe(11);
  expect(w.events.foodEaten).toBe(4115.068391211987);
  expect(sx).toBe(126345.80609401553);
  expect(sy).toBe(64312.450353586806);
  expect(se).toBe(9334.101416852527);
  expect(so).toBe(-19.42170103220269);
}, 30_000);
