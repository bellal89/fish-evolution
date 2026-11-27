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
  expect(w.fish.length).toBe(161);
  expect(w.events.matings).toBe(15);
  expect(w.events.foodEaten).toBe(5019.940221496154);
  expect(sx).toBe(117527.26403115553);
  expect(sy).toBe(72208.7382326571);
  expect(se).toBe(9742.283900036255);
  expect(so).toBe(-22.54198286216706);
}, 30_000);
