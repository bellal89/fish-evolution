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
}

export interface SceneView {
  tankW: number;
  tankH: number;
  rocks: Rock[];
  fish: FishView[];
  predators: PredatorSnap[];
  food: FoodView;
}

export interface SelectedView {
  fish: {
    id: number;
    sex: Sex;
    age: number;
    energy: number;
    children: number;
    traits: Traits;
    genome: Genome;
    inputs: number[];
    outputs: number[];
    /** [node id, value] from the last brain activation. */
    activations: [number, number][];
  };
}

export interface Snapshot extends SceneView {
  tick: number;
  extinct: boolean;
  selected: SelectedView | null;
  leader: { genome: Genome; living: number } | null;
  /** Only when changed. */
  stats?: StatPoint[];
}

export type ToWorker =
  | { type: 'speed'; speed: 0 | 1 | 10 | 50 | 'max' }
  | { type: 'select'; id: number | null }
  | { type: 'selectAt'; x: number; y: number }
  | { type: 'reset'; seed?: number };

export type FromWorker = { type: 'snapshot'; snap: Snapshot };
