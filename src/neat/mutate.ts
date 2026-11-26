import { CONFIG } from '../sim/config';
import type { Rng } from '../sim/rng';
import type { Genome, InnovationTracker } from './genome';

const clamp = (w: number) => Math.max(-CONFIG.WEIGHT_MAX, Math.min(CONFIG.WEIGHT_MAX, w));

/** Returns a mutated copy of `g`; the parent is left untouched. */
export function mutateGenome(g: Genome, rng: Rng, t: InnovationTracker): Genome {
  const child: Genome = {
    nodes: g.nodes.map(n => ({ ...n })),
    conns: g.conns.map(c => ({ ...c })),
  };
  if (rng.chance(CONFIG.P_WEIGHT_PERTURB)) {
    for (const c of child.conns) {
      c.weight = rng.chance(CONFIG.P_WEIGHT_RESET)
        ? rng.range(-1, 1)
        : clamp(c.weight + rng.normal() * CONFIG.WEIGHT_PERTURB_SD);
    }
  }
  if (rng.chance(CONFIG.P_ADD_CONN)) addConnection(child, rng, t);
  if (rng.chance(CONFIG.P_ADD_NODE)) addNode(child, rng, t);
  if (rng.chance(CONFIG.P_TOGGLE)) {
    const c = rng.pick(child.conns);
    c.enabled = !c.enabled;
  }
  return child;
}

/**
 * Adds one random new connection, in place. Skips pairs that already exist
 * (enabled or not) and pairs that would close a cycle. Disabled connections
 * count for the cycle check too, so re-enabling one later stays acyclic.
 */
export function addConnection(g: Genome, rng: Rng, t: InnovationTracker): void {
  const out = new Map<number, number[]>();
  const existing = new Set<string>();
  for (const c of g.conns) {
    out.set(c.from, [...(out.get(c.from) ?? []), c.to]);
    existing.add(`${c.from}-${c.to}`);
  }
  const reaches = (start: number, target: number): boolean => {
    const stack = [start];
    const seen = new Set<number>();
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === target) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(out.get(id) ?? []));
    }
    return false;
  };

  const candidates: [number, number][] = [];
  for (const from of g.nodes) {
    if (from.kind === 'output') continue;
    for (const to of g.nodes) {
      if (to.kind !== 'hidden' && to.kind !== 'output') continue;
      if (existing.has(`${from.id}-${to.id}`)) continue;
      if (reaches(to.id, from.id)) continue; // also rules out from === to
      candidates.push([from.id, to.id]);
    }
  }
  if (candidates.length === 0) return;
  const [from, to] = rng.pick(candidates);
  g.conns.push({ innov: t.connInnov(from, to), from, to, weight: rng.range(-1, 1), enabled: true });
}

/**
 * Splits one random enabled connection, in place: the connection is disabled,
 * `from→new` gets weight 1 and `new→to` keeps the old weight. Does nothing if
 * there is no enabled connection or this connection was already split here.
 */
export function addNode(g: Genome, rng: Rng, t: InnovationTracker): void {
  const enabled = g.conns.filter(c => c.enabled);
  if (enabled.length === 0) return;
  const c = rng.pick(enabled);
  const id = t.splitNode(c.innov);
  if (g.nodes.some(n => n.id === id)) return;
  c.enabled = false;
  g.nodes.push({ id, kind: 'hidden' });
  g.conns.push(
    { innov: t.connInnov(c.from, id), from: c.from, to: id, weight: 1, enabled: true },
    { innov: t.connInnov(id, c.to), from: id, to: c.to, weight: c.weight, enabled: true },
  );
}
