import { expect, test } from 'vitest';
import { Rng } from '../../src/sim/rng';
import { InnovationTracker, createMinimalGenome, genomeSize, type Genome } from '../../src/neat/genome';

test('minimal genome is fully connected', () => {
  const t = new InnovationTracker(10);
  const g = createMinimalGenome(3, 2, new Rng(1), t);
  expect(g.nodes.filter(n => n.kind === 'input').map(n => n.id)).toEqual([0, 1, 2]);
  expect(g.nodes.filter(n => n.kind === 'bias').map(n => n.id)).toEqual([3]);
  expect(g.nodes.filter(n => n.kind === 'output').map(n => n.id)).toEqual([4, 5]);
  expect(g.conns).toHaveLength((3 + 1) * 2);
  const pairs = new Set(g.conns.map(c => `${c.from}-${c.to}`));
  expect(pairs.size).toBe(8);
  for (const c of g.conns) {
    expect(c.enabled).toBe(true);
    expect(c.weight).toBeGreaterThanOrEqual(-1);
    expect(c.weight).toBeLessThan(1);
    expect(c.innov).toBe(t.connInnov(c.from, c.to));
  }
});

test('minimal genomes share innovation numbers through the tracker', () => {
  const t = new InnovationTracker(10);
  const a = createMinimalGenome(3, 2, new Rng(1), t);
  const b = createMinimalGenome(3, 2, new Rng(2), t);
  expect(a.conns.map(c => c.innov)).toEqual(b.conns.map(c => c.innov));
});

test('same structural mutation gets same innovation', () => {
  const t = new InnovationTracker(10);
  expect(t.connInnov(1, 5)).toBe(t.connInnov(1, 5));
  expect(t.connInnov(1, 5)).not.toBe(t.connInnov(2, 5));
  expect(t.connInnov(1, 5)).not.toBe(t.connInnov(5, 1));
  expect(t.splitNode(7)).toBe(t.splitNode(7));
});

test('split nodes get fresh ids starting at firstNodeId', () => {
  const t = new InnovationTracker(10);
  expect(t.splitNode(7)).toBe(10);
  expect(t.splitNode(8)).toBe(11);
  expect(t.splitNode(7)).toBe(10);
});

test('genomeSize counts hidden nodes and enabled conns', () => {
  const g: Genome = {
    nodes: [{ id: 0, kind: 'input' }, { id: 1, kind: 'bias' }, { id: 2, kind: 'output' }, { id: 3, kind: 'hidden' }],
    conns: [
      { innov: 0, from: 0, to: 2, weight: 1, enabled: false },
      { innov: 1, from: 0, to: 3, weight: 1, enabled: true },
      { innov: 2, from: 3, to: 2, weight: 1, enabled: true },
    ],
  };
  expect(genomeSize(g)).toEqual({ hidden: 1, enabledConns: 2 });
});
