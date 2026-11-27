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
  expect(w.fish.length).toBe(173);
  expect(w.events.matings).toBe(10);
  expect(w.events.foodEaten).toBe(4708.975395952856);
  expect(sx).toBe(128961.47591834624);
  expect(sy).toBe(76826.66777644787);
  expect(se).toBe(9839.412539518084);
  expect(so).toBe(-32.7357376809814);
}, 30_000);
