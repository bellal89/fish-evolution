import { CONFIG } from '../sim/config';
import type { Rng } from '../sim/rng';
import type { ConnGene, Genome } from './genome';

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
    gene.enabled = (a.enabled && b.enabled) || !rng.chance(CONFIG.P_INHERIT_DISABLED);
    return gene;
  });
  return { nodes: fitter.nodes.map(n => ({ ...n })), conns };
}
