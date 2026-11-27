import { Network } from '../neat/network';
import { genomeSize, type Genome } from '../neat/genome';
import { CONFIG } from './config';
import { keepInTank, wrapAngle } from './geom';
import { INPUT_COUNT, OUTPUT_COUNT } from './senses';
import type { Sex, Traits } from './traits';

export interface Fish {
  id: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  energy: number;
  /** Spent energy waiting to be excreted. */
  gut: number;
  age: number;
  sex: Sex;
  traits: Traits;
  genome: Genome;
  brain: Network;
  parents: [number, number] | null;
  children: number;
  mateCooldown: number;
  /** Ticks left before the fish can bite algae again. */
  biteCooldown: number;
  lastOutputs: Float32Array;
  lastInputs: Float32Array;
  /** Mature, enough energy and off cooldown. */
  ready: boolean;
}

export function isMature(f: Fish): boolean {
  return f.age >= CONFIG.MATURITY_TICKS;
}

export function updateReady(f: Fish): void {
  f.ready = isMature(f) && f.energy >= f.traits.mateThreshold && f.mateCooldown === 0;
}

export function createFish(
  id: number, x: number, y: number, sex: Sex, traits: Traits, genome: Genome,
  energy: number, parents: [number, number] | null,
): Fish {
  const f: Fish = {
    id, x, y, heading: 0, speed: 0, energy, gut: 0, age: 0, sex, traits, genome,
    brain: new Network(genome), parents, children: 0, mateCooldown: 0, biteCooldown: 0,
    lastOutputs: new Float32Array(OUTPUT_COUNT), lastInputs: new Float32Array(INPUT_COUNT),
    ready: false,
  };
  updateReady(f);
  return f;
}

/** Energy spent this tick: upkeep, movement and brain. */
export function tickCost(f: Fish): number {
  const { size } = f.traits;
  const { hidden, enabledConns } = genomeSize(f.genome);
  return (
    CONFIG.BASE_COST * size +
    CONFIG.MOVE_COST * size * f.speed * f.speed +
    CONFIG.BRAIN_NODE_COST * hidden +
    CONFIG.BRAIN_CONN_COST * enabledConns
  );
}

/** Turns, sets speed and moves; keeps the fish in the water and bounces its heading off walls. */
export function applyOutputs(f: Fish, out: Float32Array, tankW: number, tankH: number): void {
  const [turn, thrust] = out;
  const { size, maxSpeed } = f.traits;
  f.heading = wrapAngle(f.heading + turn * CONFIG.TURN_RATE);
  f.speed = ((thrust + 1) / 2) * maxSpeed;
  f.x += Math.cos(f.heading) * f.speed;
  f.y += Math.sin(f.heading) * f.speed;
  keepInTank(f, size, tankW, tankH - CONFIG.SAND_H);
}

/** Moves the tick cost from energy into the gut; the total is unchanged. */
export function payCost(f: Fish): void {
  const paid = Math.min(tickCost(f), f.energy);
  f.energy -= paid;
  f.gut += paid;
}

/** Returns the gut contents (to become waste) once there is enough, else 0. */
export function excrete(b: { gut: number }): number {
  if (b.gut < CONFIG.EXCRETE_AMOUNT) return 0;
  const out = b.gut;
  b.gut = 0;
  return out;
}

export function advanceAge(f: Fish): void {
  f.age += 1;
  f.mateCooldown = Math.max(0, f.mateCooldown - 1);
  f.biteCooldown = Math.max(0, f.biteCooldown - 1);
}

export function isDead(f: Fish): boolean {
  return f.energy <= 0 || f.age >= f.traits.lifespanTicks;
}
