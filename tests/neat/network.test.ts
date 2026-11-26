import { expect, test } from 'vitest';
import type { Genome } from '../../src/neat/genome';
import { Network } from '../../src/neat/network';

const base = (enabled0: boolean): Genome => ({
  nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }],
  conns: [
    { innov: 0, from: 0, to: 2, weight: 0.5, enabled: enabled0 },
    { innov: 1, from: 1, to: 2, weight: 0.25, enabled: true },
  ],
});

test('network computes tanh of weighted sum', () => {
  expect(new Network(base(true)).activate(new Float32Array([2]))[0]).toBeCloseTo(Math.tanh(1.25));
});

test('disabled connection ignored', () => {
  expect(new Network(base(false)).activate(new Float32Array([2]))[0]).toBeCloseTo(Math.tanh(0.25));
});

test('hidden node chain', () => {
  const g: Genome = {
    nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }, { id: 5, kind: 'hidden' }],
    conns: [
      { innov: 0, from: 0, to: 5, weight: 1, enabled: true },
      { innov: 1, from: 5, to: 2, weight: 1, enabled: true },
    ],
  };
  expect(new Network(g).activate(new Float32Array([0.5]))[0]).toBeCloseTo(Math.tanh(Math.tanh(0.5)));
});

test('order of connections in genome does not matter', () => {
  const g: Genome = {
    nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }, { id: 5, kind: 'hidden' }, { id: 6, kind: 'hidden' }],
    conns: [
      { innov: 2, from: 6, to: 2, weight: 1, enabled: true },
      { innov: 1, from: 5, to: 6, weight: 2, enabled: true },
      { innov: 0, from: 0, to: 5, weight: 1, enabled: true },
    ],
  };
  expect(new Network(g).activate(new Float32Array([0.3]))[0]).toBeCloseTo(Math.tanh(Math.tanh(2 * Math.tanh(0.3))));
});

test('unreachable output yields 0 and outputs keep id order', () => {
  const g: Genome = {
    nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 3, kind: 'output' }, { id: 2, kind: 'output' }],
    conns: [{ innov: 0, from: 1, to: 3, weight: 1, enabled: true }],
  };
  const out = new Network(g).activate(new Float32Array([1]));
  expect(out).toHaveLength(2);
  expect(out[0]).toBe(0);
  expect(out[1]).toBeCloseTo(Math.tanh(1));
});

test('activations expose node values and reset between calls', () => {
  const net = new Network(base(true));
  net.activate(new Float32Array([2]));
  expect(net.activations.get(0)).toBe(2);
  expect(net.activations.get(1)).toBe(1);
  expect(net.activations.get(2)).toBeCloseTo(Math.tanh(1.25));
  net.activate(new Float32Array([0]));
  expect(net.activations.get(2)).toBeCloseTo(Math.tanh(0.25));
});
