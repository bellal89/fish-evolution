import { expect, test } from 'vitest';
import { Rng } from '../../src/sim/rng';
import { CONFIG } from '../../src/sim/config';
import { InnovationTracker, createMinimalGenome, type Genome } from '../../src/neat/genome';
import { mutateGenome } from '../../src/neat/mutate';
import { crossover } from '../../src/neat/crossover';
import { Network } from '../../src/neat/network';
import { hasCycle } from './helpers';

const io = [{ id: 0, kind: 'input' as const }, { id: 1, kind: 'bias' as const }, { id: 2, kind: 'output' as const }];

test('crossover child only has fitter disjoint genes', () => {
  const fitter: Genome = {
    nodes: [...io, { id: 10, kind: 'hidden' }],
    conns: [
      { innov: 0, from: 0, to: 2, weight: 1, enabled: true },
      { innov: 99, from: 0, to: 10, weight: 1, enabled: true },
    ],
  };
  const other: Genome = {
    nodes: [...io, { id: 11, kind: 'hidden' }],
    conns: [
      { innov: 0, from: 0, to: 2, weight: -1, enabled: true },
      { innov: 77, from: 0, to: 11, weight: 1, enabled: true },
    ],
  };
  const child = crossover(fitter, other, new Rng(1));
  expect(child.conns.map(c => c.innov).sort((a, b) => a - b)).toEqual([0, 99]);
  expect(child.nodes.map(n => n.id).sort((a, b) => a - b)).toEqual([0, 1, 2, 10]);
});

test('matching genes come from both parents', () => {
  const a: Genome = { nodes: io, conns: [{ innov: 0, from: 0, to: 2, weight: 1, enabled: true }] };
  const b: Genome = { nodes: io, conns: [{ innov: 0, from: 0, to: 2, weight: -1, enabled: true }] };
  const rng = new Rng(3);
  let fromA = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) if (crossover(a, b, rng).conns[0].weight === 1) fromA++;
  expect(fromA / N).toBeCloseTo(0.5, 1);
});

test('gene disabled in a parent stays disabled with configured probability', () => {
  const a: Genome = { nodes: io, conns: [{ innov: 0, from: 0, to: 2, weight: 1, enabled: true }] };
  const b: Genome = { nodes: io, conns: [{ innov: 0, from: 0, to: 2, weight: 1, enabled: false }] };
  const rng = new Rng(4);
  let disabled = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) if (!crossover(a, b, rng).conns[0].enabled) disabled++;
  expect(disabled / N).toBeCloseTo(CONFIG.P_INHERIT_DISABLED, 1);
});

test('crossover does not share conn objects with parents', () => {
  const a: Genome = { nodes: io, conns: [{ innov: 0, from: 0, to: 2, weight: 1, enabled: true }] };
  const child = crossover(a, a, new Rng(1));
  child.conns[0].weight = 5;
  child.nodes[0].kind = 'hidden';
  expect(a.conns[0].weight).toBe(1);
  expect(a.nodes[0].kind).toBe('input');
});

test('crossover child network runs', () => {
  const t = new InnovationTracker(20);
  const rng = new Rng(7);
  let a = createMinimalGenome(4, 2, rng, t);
  let b = createMinimalGenome(4, 2, rng, t);
  for (let i = 0; i < 300; i++) {
    a = mutateGenome(a, rng, t);
    b = mutateGenome(b, rng, t);
  }
  const child = crossover(a, b, rng);
  expect(hasCycle(child)).toBe(false);
  const ids = new Set(child.nodes.map(n => n.id));
  for (const c of child.conns) expect(ids.has(c.from) && ids.has(c.to)).toBe(true);
  const out = new Network(child).activate(new Float32Array([0.1, 0.2, 0.3, 0.4]));
  expect(out).toHaveLength(2);
  for (const v of out) expect(Number.isFinite(v)).toBe(true);
});
