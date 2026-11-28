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
  expect(w.fish.length).toBe(153);
  expect(w.events.matings).toBe(7);
  expect(w.events.foodEaten).toBe(4022.7016961327176);
  expect(sx).toBe(114688.844641114);
  expect(sy).toBe(66382.6113834349);
  expect(se).toBe(9220.309034060965);
  expect(so).toBe(-35.357534896815196);
}, 30_000);
