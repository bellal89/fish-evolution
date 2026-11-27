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

/** 0 is the left arena side, 1 the right. */
export type Side = 0 | 1;

/** Where the brain of an arena side comes from. `index` is in the leader history, oldest first. */
export type BrainChoice = { kind: 'random' } | { kind: 'leader' } | { kind: 'selected' } | { kind: 'history'; index: number };

export type ArenaSpeed = 0 | 1 | 10;

export interface ArenaSideView {
  /** `scene.selected` is the fish whose brain the UI draws. */
  scene: Snapshot;
  /** Food eaten by the side since the start. */
  foodEaten: number;
  /** The brain of the side, also when all its fish are dead. */
  genome: Genome;
}

/** One leader history entry as the brain picker shows it. */
export interface LeaderRow {
  tick: number;
  living: number;
  hidden: number;
  conns: number;
  colorM: ColorGenes;
  colorF: ColorGenes;
}

export interface ArenaSnapshot {
  speed: ArenaSpeed;
  choices: [BrainChoice, BrainChoice];
  sides: [ArenaSideView, ArenaSideView];
  /** Oldest first. */
  history: LeaderRow[];
  hasLeader: boolean;
  /** The selected fish of the main world is alive. */
  hasSelected: boolean;
}

export type ToWorker =
  | { type: 'speed'; speed: Speed }
  | { type: 'select'; id: number | null }
  | { type: 'reset'; seed: number }
  /** Save the world now, for example before the tab closes. */
  | { type: 'save' }
  /** Open the arena; the main world pauses. */
  | { type: 'arenaOpen'; seed: number }
  | { type: 'arenaClose' }
  | { type: 'arenaBrain'; side: Side; choice: BrainChoice }
  /** With a seed, a new start; without, the same start again. */
  | { type: 'arenaRestart'; seed?: number }
  | { type: 'arenaSpeed'; speed: ArenaSpeed }
  | { type: 'arenaSelect'; side: Side; id: number | null }
  /** Send the main world as a file. */
  | { type: 'export' }
  /** Replace the main world with the world in a file. */
  | { type: 'import'; data: ArrayBuffer };

/** While the arena is open, only arena messages go out. */
export type FromWorker =
  | { type: 'snapshot'; snap: Snapshot }
  | { type: 'arena'; arena: ArenaSnapshot }
  /** A gzipped save file; `tick` is the main world tick. */
  | { type: 'exported'; data: ArrayBuffer; tick: number }
  | { type: 'importResult'; error: string | null };
