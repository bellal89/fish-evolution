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
  expect(w.events.foodEaten).toBe(3888.0831777213334);
  expect(sx).toBe(123931.17812263683);
  expect(sy).toBe(66914.08234351077);
  expect(se).toBe(9049.416284954541);
  expect(so).toBe(-15.1703968369402);
}, 30_000);
