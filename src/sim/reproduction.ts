import { crossover } from '../neat/crossover';
import type { Genome, InnovationTracker } from '../neat/genome';
import { mutateGenome } from '../neat/mutate';
import { CONFIG } from './config';
import { isMature, type Fish } from './fish';
import { clamp } from './geom';
import type { Rng } from './rng';
import { accepts, crossTraits, mutateTraits, type Sex, type Traits } from './traits';

export interface Egg {
  id: number;
  x: number;
  y: number;
  energy: number;
  /** Tick at which the egg hatches. */
  hatchAt: number;
  genome: Genome;
  traits: Traits;
  sex: Sex;
  parents: [number, number];
}

function wants(chooser: Fish, other: Fish): boolean {
  return (
    isMature(chooser) &&
    chooser.mateCooldown === 0 &&
    chooser.energy >= chooser.traits.mateThreshold &&
    chooser.lastOutputs[2] > 0 &&
    accepts(chooser.traits, other.traits, other.sex)
  );
}

export function canMate(a: Fish, b: Fish): boolean {
  if (a.sex === b.sex) return false;
  if (!wants(a, b) || !wants(b, a)) return false;
  return Math.hypot(a.x - b.x, a.y - b.y) < a.traits.size + b.traits.size;
}

/**
 * Both parents pay `investFraction` of their energy; the sum is split equally
 * among the eggs, so total energy is conserved.
 */
export function mate(
  a: Fish, b: Fish, rng: Rng, tracker: InnovationTracker, tick: number, newId: () => number,
): Egg[] {
  const [fitter, other] = b.energy > a.energy ? [b, a] : [a, b];
  const investA = a.energy * a.traits.investFraction;
  const investB = b.energy * b.traits.investFraction;
  a.energy -= investA;
  b.energy -= investB;
  const total = investA + investB;
  const n = clamp(Math.floor(total / CONFIG.EGG_MIN_ENERGY), 1, CONFIG.MAX_CLUTCH);
  const eggs: Egg[] = [];
  for (let i = 0; i < n; i++) {
    eggs.push({
      id: newId(),
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      energy: total / n,
      hatchAt: tick + CONFIG.HATCH_TICKS,
      genome: mutateGenome(crossover(fitter.genome, other.genome, rng), rng, tracker),
      traits: mutateTraits(crossTraits(a.traits, b.traits, rng), rng),
      sex: rng.chance(0.5) ? 'M' : 'F',
      parents: [a.id, b.id],
    });
  }
  a.mateCooldown = b.mateCooldown = CONFIG.MATE_COOLDOWN;
  a.children += n;
  b.children += n;
  return eggs;
}
