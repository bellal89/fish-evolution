import { expect, test } from 'vitest';
import { Rng } from '../../src/sim/rng';
import { CONFIG } from '../../src/sim/config';
import type { Genome } from '../../src/neat/genome';
import { crossover } from '../../src/neat/crossover';
import { io } from './helpers';

const oneConn = (weight: number, enabled: boolean): Genome => ({
  nodes: io(),
  conns: [{ innov: 0, from: 0, to: 2, weight, enabled }],
});

test('crossover child only has fitter disjoint genes', () => {
  const fitter: Genome = {
    nodes: [...io(), { id: 10, kind: 'hidden' }],
    conns: [
      { innov: 0, from: 0, to: 2, weight: 1, enabled: true },
      { innov: 99, from: 0, to: 10, weight: 1, enabled: true },
    ],
  };
  const other: Genome = {
    nodes: [...io(), { id: 11, kind: 'hidden' }],
    conns: [
      { innov: 0, from: 0, to: 2, weight: -1, enabled: true },
      { innov: 77, from: 0, to: 11, weight: 1, enabled: true },
    ],
  };
  const child = crossover(fitter, other, new Rng(1));
  expect(child.conns.map(c => c.innov)).toEqual([0, 99]);
  expect(child.nodes.map(n => n.id)).toEqual([0, 1, 2, 10]);
});

test('matching genes come from both parents', () => {
  const rng = new Rng(3);
  let fromA = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) if (crossover(oneConn(1, true), oneConn(-1, true), rng).conns[0].weight === 1) fromA++;
  expect(fromA / N).toBeCloseTo(0.5, 1);
});

test('gene disabled in a parent stays disabled with configured probability', () => {
  const rng = new Rng(4);
  let disabled = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) if (!crossover(oneConn(1, true), oneConn(1, false), rng).conns[0].enabled) disabled++;
  expect(disabled / N).toBeCloseTo(CONFIG.P_INHERIT_DISABLED, 1);
});

test.each([
  ['matching', oneConn(1, true)],
  ['disjoint', { nodes: io(), conns: [] }],
])('crossover does not share objects with parents (%s gene)', (_, other) => {
  const a = oneConn(1, true);
  const child = crossover(a, other, new Rng(1));
  child.conns[0].weight = 5;
  child.nodes[0].kind = 'hidden';
  expect(a).toEqual(oneConn(1, true));
});
