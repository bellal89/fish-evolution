import { expect, test } from 'vitest';
import type { Genome } from '../../src/neat/genome';
import { layoutBrain } from '../../src/ui/brainView';

test('layout puts inputs left, outputs right, hidden between by depth', () => {
  // in0 -> h(5) -> out(3); in0 -> out(3); bias(2) is an input-column node
  const g: Genome = {
    nodes: [
      { id: 0, kind: 'input' },
      { id: 1, kind: 'input' },
      { id: 2, kind: 'bias' },
      { id: 3, kind: 'output' },
      { id: 5, kind: 'hidden' },
    ],
    conns: [
      { innov: 0, from: 0, to: 5, weight: 1, enabled: true },
      { innov: 1, from: 5, to: 3, weight: 1, enabled: true },
      { innov: 2, from: 0, to: 3, weight: 1, enabled: true },
    ],
  };
  const pos = layoutBrain(g);
  expect(pos.get(0)!.x).toBe(0);
  expect(pos.get(2)!.x).toBe(0);
  expect(pos.get(3)!.x).toBe(1);
  expect(pos.get(5)!.x).toBeGreaterThan(0);
  expect(pos.get(5)!.x).toBeLessThan(1);
  for (const p of pos.values()) {
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(1);
  }
});
