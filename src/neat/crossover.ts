import { CONFIG } from '../sim/config';
import type { Rng } from '../sim/rng';
import type { ConnGene, Genome } from './genome';

/**
 * NEAT crossover. Takes each matching gene (same innovation) from a random
 * parent, and disjoint and excess genes from `fitter` only. Thus the child has
 * the structure of `fitter`.
 */
export function crossover(fitter: Genome, other: Genome, rng: Rng): Genome {
  const otherConns = new Map(other.conns.map(c => [c.innov, c]));
  const conns: ConnGene[] = fitter.conns.map(a => {
    const b = otherConns.get(a.innov);
    if (!b) return { ...a };
    const gene = { ...(rng.chance(0.5) ? a : b) };
    gene.enabled = (a.enabled && b.enabled) || !rng.chance(CONFIG.P_INHERIT_DISABLED);
    return gene;
  });
  return { nodes: fitter.nodes.map(n => ({ ...n })), conns };
}
