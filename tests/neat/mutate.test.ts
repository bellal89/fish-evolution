import { expect, test } from 'vitest';
import { Rng } from '../../src/sim/rng';
import { CONFIG } from '../../src/sim/config';
import { InnovationTracker, createMinimalGenome, type Genome } from '../../src/neat/genome';
import { addNode, mutateGenome } from '../../src/neat/mutate';
import { io } from './helpers';

/** True if the connection graph (enabled or not) has a directed cycle. */
function hasCycle(g: Genome): boolean {
  const out = new Map<number, number[]>();
  for (const c of g.conns) out.set(c.from, [...(out.get(c.from) ?? []), c.to]);
  const state = new Map<number, 'open' | 'done'>();
  const visit = (id: number): boolean => {
    if (state.get(id) === 'open') return true;
    if (state.get(id) === 'done') return false;
    state.set(id, 'open');
    for (const to of out.get(id) ?? []) if (visit(to)) return true;
    state.set(id, 'done');
    return false;
  };
  return g.nodes.some(n => visit(n.id));
}

test('addNode keeps old conn disabled and adds two', () => {
  const t = new InnovationTracker(20);
  const g: Genome = { nodes: io(), conns: [{ innov: t.connInnov(0, 2), from: 0, to: 2, weight: 0.7, enabled: true }] };
  addNode(g, new Rng(1), t);
  const id = t.splitNode(g.conns[0].innov);
  expect(g.nodes).toContainEqual({ id, kind: 'hidden' });
  expect(g.conns[0].enabled).toBe(false);
  expect(g.conns).toContainEqual({ innov: t.connInnov(0, id), from: 0, to: id, weight: 1, enabled: true });
  expect(g.conns).toContainEqual({ innov: t.connInnov(id, 2), from: id, to: 2, weight: 0.7, enabled: true });
});

test('mutations never create cycles or invalid conns', () => {
  const t = new InnovationTracker(20);
  const rng = new Rng(5);
  let g = createMinimalGenome(4, 2, rng, t);
  for (let i = 0; i < 2000; i++) g = mutateGenome(g, rng, t);
  expect(g.nodes.some(n => n.kind === 'hidden')).toBe(true);
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
  const before = structuredClone(parent);
  for (let i = 0; i < 200; i++) mutateGenome(parent, rng, t);
  expect(parent).toEqual(before);
});

test('weights are perturbed and reset at configured rates', () => {
  const t = new InnovationTracker(20);
  const rng = new Rng(11);
  const g: Genome = { nodes: io(), conns: [{ innov: 0, from: 0, to: 2, weight: 2, enabled: true }] };
  let changed = 0;
  let reset = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const w = mutateGenome(g, rng, t).conns[0].weight;
    if (w !== 2) changed++;
    if (Math.abs(w) <= 1) reset++;
  }
  expect(changed / N).toBeCloseTo(CONFIG.P_WEIGHT_PERTURB, 1);
  expect(reset / N).toBeCloseTo(CONFIG.P_WEIGHT_PERTURB * CONFIG.P_WEIGHT_RESET, 1);
});

test('toggle re-enables a disabled conn', () => {
  // All pairs exist and are disabled, so only toggle can change anything.
  const t = new InnovationTracker(20);
  const rng = new Rng(12);
  const g: Genome = {
    nodes: io(),
    conns: [
      { innov: 0, from: 0, to: 2, weight: 1, enabled: false },
      { innov: 1, from: 1, to: 2, weight: 1, enabled: false },
    ],
  };
  let toggled = 0;
  for (let i = 0; i < 1000; i++) if (mutateGenome(g, rng, t).conns.some(c => c.enabled)) toggled++;
  expect(toggled).toBeGreaterThan(0);
});
