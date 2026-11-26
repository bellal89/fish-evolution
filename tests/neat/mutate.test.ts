import { expect, test } from 'vitest';
import { Rng } from '../../src/sim/rng';
import { CONFIG } from '../../src/sim/config';
import { InnovationTracker, createMinimalGenome, type Genome } from '../../src/neat/genome';
import { addConnection, addNode, mutateGenome } from '../../src/neat/mutate';
import { Network } from '../../src/neat/network';
import { hasCycle } from './helpers';

const clone = (g: Genome): Genome => structuredClone(g);

test('addNode keeps old conn disabled and adds two', () => {
  const t = new InnovationTracker(20);
  const g: Genome = {
    nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }],
    conns: [{ innov: t.connInnov(0, 2), from: 0, to: 2, weight: 0.7, enabled: true }],
  };
  addNode(g, new Rng(1), t);
  const id = t.splitNode(g.conns[0].innov);
  expect(g.nodes).toContainEqual({ id, kind: 'hidden' });
  expect(g.conns[0].enabled).toBe(false);
  expect(g.conns).toContainEqual({ innov: t.connInnov(0, id), from: 0, to: id, weight: 1, enabled: true });
  expect(g.conns).toContainEqual({ innov: t.connInnov(id, 2), from: id, to: 2, weight: 0.7, enabled: true });
});

test('addNode on an already split conn does nothing', () => {
  const t = new InnovationTracker(20);
  const g: Genome = {
    nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }],
    conns: [{ innov: t.connInnov(0, 2), from: 0, to: 2, weight: 0.7, enabled: true }],
  };
  addNode(g, new Rng(1), t);
  g.conns[0].enabled = true;
  g.conns[1].enabled = false;
  g.conns[2].enabled = false;
  const before = clone(g);
  addNode(g, new Rng(1), t);
  expect(g).toEqual(before);
});

test('addConnection respects direction, duplicates and cycles', () => {
  const t = new InnovationTracker(20);
  // 0 in, 1 bias, 2 out, 3 hidden. Existing: 0→3, 3→2, 1→2. Only legal new pairs: 0→2, 1→3.
  const g: Genome = {
    nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }, { id: 3, kind: 'hidden' }],
    conns: [
      { innov: t.connInnov(0, 3), from: 0, to: 3, weight: 1, enabled: true },
      { innov: t.connInnov(3, 2), from: 3, to: 2, weight: 1, enabled: true },
      { innov: t.connInnov(1, 2), from: 1, to: 2, weight: 1, enabled: false },
    ],
  };
  addConnection(g, new Rng(1), t);
  addConnection(g, new Rng(2), t);
  addConnection(g, new Rng(3), t);
  const pairs = g.conns.map(c => `${c.from}-${c.to}`).sort();
  expect(pairs).toEqual(['0-2', '0-3', '1-2', '1-3', '3-2']);
  const added = g.conns.slice(3);
  for (const c of added) {
    expect(c.innov).toBe(t.connInnov(c.from, c.to));
    expect(c.enabled).toBe(true);
    expect(Math.abs(c.weight)).toBeLessThanOrEqual(1);
  }
});

test('addConnection never connects back into a node feeding it', () => {
  const t = new InnovationTracker(20);
  // two hidden nodes in a chain 3→4; 4→3 would be a cycle, so only 3→4 direction is legal.
  const g: Genome = {
    nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }, { id: 3, kind: 'hidden' }, { id: 4, kind: 'hidden' }],
    conns: [
      { innov: 0, from: 0, to: 3, weight: 1, enabled: true },
      { innov: 1, from: 3, to: 4, weight: 1, enabled: false },
      { innov: 2, from: 4, to: 2, weight: 1, enabled: true },
    ],
  };
  for (let s = 0; s < 20; s++) addConnection(g, new Rng(s), t);
  expect(hasCycle(g)).toBe(false);
  expect(g.conns.some(c => c.from === 4 && c.to === 3)).toBe(false);
});

test('mutations never create cycles or invalid conns', () => {
  const t = new InnovationTracker(20);
  const rng = new Rng(5);
  let g = createMinimalGenome(4, 2, rng, t);
  for (let i = 0; i < 2000; i++) g = mutateGenome(g, rng, t);
  expect(g.nodes.some(n => n.kind === 'hidden')).toBe(true);
  expect(() => new Network(g).activate(new Float32Array(4))).not.toThrow();
  expect(hasCycle(g)).toBe(false);
  const kinds = new Map(g.nodes.map(n => [n.id, n.kind]));
  const pairs = new Set<string>();
  for (const c of g.conns) {
    expect(kinds.get(c.to)).toMatch(/hidden|output/);
    expect(kinds.has(c.from)).toBe(true);
    expect(pairs.has(`${c.from}-${c.to}`)).toBe(false);
    pairs.add(`${c.from}-${c.to}`);
    expect(Math.abs(c.weight)).toBeLessThanOrEqual(CONFIG.WEIGHT_MAX);
  }
  expect(new Set(g.nodes.map(n => n.id)).size).toBe(g.nodes.length);
});

test('mutate does not modify parent', () => {
  const t = new InnovationTracker(20);
  const rng = new Rng(9);
  const parent = createMinimalGenome(4, 2, rng, t);
  const before = clone(parent);
  for (let i = 0; i < 200; i++) {
    const child = mutateGenome(parent, rng, t);
    for (const c of child.conns) expect(parent.conns).not.toContain(c);
  }
  expect(parent).toEqual(before);
});

test('weights change with expected frequency', () => {
  const t = new InnovationTracker(20);
  const rng = new Rng(11);
  const g = createMinimalGenome(4, 2, rng, t);
  let changed = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const child = mutateGenome(g, rng, t);
    if (child.conns[0].weight !== g.conns[0].weight) changed++;
  }
  expect(changed / N).toBeCloseTo(CONFIG.P_WEIGHT_PERTURB, 1);
});
