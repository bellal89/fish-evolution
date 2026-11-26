import { expect, test } from 'vitest';
import type { Genome } from '../../src/neat/genome';
import { Network } from '../../src/neat/network';
import { io } from './helpers';

const base = (enabled0: boolean): Genome => ({
  nodes: io(),
  conns: [
    { innov: 0, from: 0, to: 2, weight: 0.5, enabled: enabled0 },
    { innov: 1, from: 1, to: 2, weight: 0.25, enabled: true },
  ],
});

test.each([
  [true, Math.tanh(1.25)],
  [false, Math.tanh(0.25)],
])('output is tanh of enabled weighted inputs (conn 0 enabled: %s)', (enabled, expected) => {
  expect(new Network(base(enabled)).activate(new Float32Array([2]))[0]).toBeCloseTo(expected);
});

test('hidden nodes are evaluated in topological order, not genome order', () => {
  const g: Genome = {
    nodes: [...io(), { id: 5, kind: 'hidden' }, { id: 6, kind: 'hidden' }],
    conns: [
      { innov: 2, from: 6, to: 2, weight: 1, enabled: true },
      { innov: 1, from: 5, to: 6, weight: 2, enabled: true },
      { innov: 0, from: 0, to: 5, weight: 1, enabled: true },
    ],
  };
  expect(new Network(g).activate(new Float32Array([0.3]))[0]).toBeCloseTo(Math.tanh(Math.tanh(2 * Math.tanh(0.3))));
});

test('activations expose node values', () => {
  const net = new Network(base(true));
  net.activate(new Float32Array([2]));
  expect(net.activations.get(0)).toBe(2);
  expect(net.activations.get(1)).toBe(1);
  expect(net.activations.get(2)).toBeCloseTo(Math.tanh(1.25));
});
