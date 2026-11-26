// Plain data passed from the simulation (worker) to the UI.
import type { ColorGenes, Sex } from './sim/traits';

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

export interface Rock {
  x: number;
  /** Ground level the rock sits on. */
  y: number;
  rx: number;
  ry: number;
}

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
