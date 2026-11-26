import { CONFIG } from '../sim/config';
import type { Rng } from '../sim/rng';
import type { ConnGene, Genome, NodeGene } from './genome';

/**
 * NEAT crossover. Matching genes (same innovation) are taken from either
 * parent at random; disjoint and excess genes come from `fitter` only, so the
 * child has exactly the fitter parent's structure.
 */
export function crossover(fitter: Genome, other: Genome, rng: Rng): Genome {
  const otherConns = new Map(other.conns.map(c => [c.innov, c]));
  const conns: ConnGene[] = fitter.conns.map(a => {
    const b = otherConns.get(a.innov);
    if (!b) return { ...a };
    const gene = { ...(rng.chance(0.5) ? a : b) };
    gene.enabled = a.enabled && b.enabled ? true : !rng.chance(CONFIG.P_INHERIT_DISABLED);
    return gene;
  });

  const kinds = new Map<number, NodeGene['kind']>();
  for (const n of [...other.nodes, ...fitter.nodes]) kinds.set(n.id, n.kind);
  const used = new Set<number>();
  for (const n of fitter.nodes) if (n.kind !== 'hidden') used.add(n.id);
  for (const c of conns) used.add(c.from).add(c.to);
  const nodes = [...used].sort((x, y) => x - y).map(id => ({ id, kind: kinds.get(id)! }));
  return { nodes, conns };
}
