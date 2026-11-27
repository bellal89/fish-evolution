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
  expect(w.fish.length).toBe(170);
  expect(w.events.matings).toBe(13);
  expect(w.events.foodEaten).toBe(5184.218376187609);
  expect(sx).toBe(134419.20972918198);
  expect(sy).toBe(70400.95740299353);
  expect(se).toBe(10098.634340616294);
  expect(so).toBe(-9.5349345857976);
}, 30_000);
