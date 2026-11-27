// Plain data passed from the simulation (worker) to the UI.
import type { Genome } from './neat/genome';
import type { Rock } from './sim/food';
import type { StatPoint } from './sim/stats';
import type { ColorGenes, Sex, Traits } from './sim/traits';

export interface FishView {
  id: number;
  x: number;
  y: number;
  heading: number;
  size: number;
  sex: Sex;
  color: ColorGenes;
}

export interface PredatorSnap {
  x: number;
  y: number;
  heading: number;
  size: number;
  state: 'patrol' | 'chase' | 'rest';
}

export type { Rock };

export interface FoodView {
  /** biomass is normalized 0..1 */
  algae: { x: number; y: number; biomass: number }[];
  plankton: { x: number; y: number }[];
  waste: { x: number; y: number; amount: number }[];
  eggs: { x: number; y: number }[];
  /** Dead fish; fade is the share of nutrients left, 0..1. */
  bodies: { x: number; y: number; size: number; heading: number; fade: number }[];
}

export interface Snapshot {
  tankW: number;
  tankH: number;
  rocks: Rock[];
  fish: FishView[];
  predators: PredatorSnap[];
  food: FoodView;
  tick: number;
  extinct: boolean;
  selected: SelectedFish | null;
  leader: { genome: Genome; living: number } | null;
  /** Only when changed. */
  stats?: StatPoint[];
}

export interface SelectedFish {
  id: number;
  sex: Sex;
  age: number;
  /** Extra age from waste and bodies, ticks. */
  wasteAge: number;
  energy: number;
  children: number;
  traits: Traits;
  genome: Genome;
  inputs: number[];
  /** Node id to value from the last brain activation. */
  activations: Map<number, number>;
}

export type Speed = 0 | 1 | 10 | 50 | 'max';

export type ToWorker =
  | { type: 'speed'; speed: Speed }
  | { type: 'select'; id: number | null }
  | { type: 'reset'; seed: number }
  /** Save the world now, for example before the tab closes. */
  | { type: 'save' };

export type FromWorker = { type: 'snapshot'; snap: Snapshot };
