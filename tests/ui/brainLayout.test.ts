import { expect, test } from 'vitest';
import type { Genome } from '../../src/neat/genome';
import { layoutBrain } from '../../src/ui/brainView';

test('layout puts inputs left, outputs right, hidden between by depth', () => {
  // in0 -> h5 -> h6 -> out3; in0 -> h7 -> out3; in0 -> out3; h6 -> h7 disabled; bias(2) is an input-column node
  const g: Genome = {
    nodes: [
      { id: 0, kind: 'input' },
      { id: 1, kind: 'input' },
      { id: 2, kind: 'bias' },
      { id: 3, kind: 'output' },
      { id: 5, kind: 'hidden' },
      { id: 6, kind: 'hidden' },
      { id: 7, kind: 'hidden' },
    ],
    conns: [
      { innov: 0, from: 0, to: 5, weight: 1, enabled: true },
      { innov: 1, from: 5, to: 6, weight: 1, enabled: true },
      { innov: 2, from: 6, to: 3, weight: 1, enabled: true },
      { innov: 3, from: 0, to: 3, weight: 1, enabled: true },
      { innov: 4, from: 0, to: 7, weight: 1, enabled: true },
      { innov: 5, from: 7, to: 3, weight: 1, enabled: true },
      { innov: 6, from: 6, to: 7, weight: 1, enabled: false },
    ],
  };
  const pos = layoutBrain(g);
  expect(pos.get(0)!.x).toBe(0);
  expect(pos.get(2)!.x).toBe(0);
  expect(pos.get(3)!.x).toBe(1);
  expect(pos.get(5)!.x).toBeCloseTo(1 / 3);
  expect(pos.get(6)!.x).toBeCloseTo(2 / 3);
  expect(pos.get(7)!.x).toBeCloseTo(1 / 3);
  for (const p of pos.values()) {
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(1);
  }
});
