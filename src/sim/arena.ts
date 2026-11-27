import { InnovationTracker, createMinimalGenome, type Genome } from '../neat/genome';
import { CONFIG } from './config';
import { Rng } from './rng';
import { INPUT_COUNT, OUTPUT_COUNT } from './senses';
import { SCALAR_KEYS, randomTraits, type Traits } from './traits';

/** A brain and the genes of its owner. */
export interface Brain {
  genome: Genome;
  traits: Traits;
}

/** The standard arena body: each scalar trait at the midpoint of its range. Colors and preferences stay the owner's. */
export function arenaTraits(owner: Traits): Traits {
  const t = { ...owner };
  for (const k of SCALAR_KEYS) {
    const [lo, hi] = CONFIG.TRAIT_RANGES[k];
    t[k] = (lo + hi) / 2;
  }
  return t;
}

/**
 * A new minimal brain with random color genes, as in the first generation.
 * It is a pure function of seed and side, so a brain never moves the arena layout.
 */
export function randomBrain(seed: number, side: 0 | 1): Brain {
  const rng = new Rng((seed + 0x9e3779b9 * (side + 1)) >>> 0);
  const traits = randomTraits(rng);
  const genome = createMinimalGenome(INPUT_COUNT, OUTPUT_COUNT, rng, new InnovationTracker(INPUT_COUNT + 1 + OUTPUT_COUNT));
  return { genome, traits };
}
