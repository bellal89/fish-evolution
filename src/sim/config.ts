/** All simulation tuning lives here. */
export const CONFIG = {
  TANK_W: 1600,
  TANK_H: 900,
  TICKS_PER_SEC: 60,

  /** Sand layer height. */
  SAND_H: 70,
  /** Background hues. The renderer uses them now, camouflage uses them later. */
  BG_WATER_HUE: 0.55,
  BG_SAND_HUE: 0.11,

  // NEAT
  /** Chance to perturb the weights of a mutated genome. */
  P_WEIGHT_PERTURB: 0.8,
  /** Std dev of the per-connection weight perturbation. */
  WEIGHT_PERTURB_SD: 0.3,
  /** Among perturbed connections, chance of a full reset to range(-1, 1). */
  P_WEIGHT_RESET: 0.1,
  WEIGHT_MAX: 4,
  P_ADD_CONN: 0.08,
  P_ADD_NODE: 0.03,
  P_TOGGLE: 0.02,
  /** Crossover: a gene disabled in either parent stays disabled with this chance. */
  P_INHERIT_DISABLED: 0.75,

  // Nutrients and food
  /** Fertilizer field resolution. */
  FIELD_COLS: 64,
  FIELD_ROWS: 36,
  /** Fraction of the neighbour difference exchanged per tick by diffusion. */
  FERT_DIFFUSION: 0.1,
  ALGAE_CELLS: 80,
  ROCK_COUNT: 4,
  /** Algae cells that sit on each rock top (the rest lie along the bottom). */
  ALGAE_PER_ROCK: 5,
  /** Rock height range (ry). */
  ROCK_MIN_H: 60,
  ROCK_MAX_H: 160,
  /** Rock half-width range (rx). */
  ROCK_MIN_RX: 40,
  ROCK_MAX_RX: 90,
  /** Rocks stay this fraction of the tank width away from each side wall. */
  ROCK_MARGIN_FRAC: 0.1,
  /** Algae on a rock spread within this fraction of the rock half-width. */
  ALGAE_ROCK_SPREAD: 0.6,
  ALGAE_INIT: 1,
  ALGAE_MAX: 10,
  /** Fraction of local fertilizer converted to algae biomass per tick. */
  ALGAE_GROWTH: 0.002,
  PLANKTON_TRIES: 3,
  /** Local fertilizer needed before plankton can spawn. */
  PLANKTON_FERT_MIN: 0.5,
  PLANKTON_AMOUNT: 1,
  PLANKTON_MAX: 150,
  /** Std dev of the random velocity kick per tick. */
  PLANKTON_DRIFT: 0.02,
  PLANKTON_DAMPING: 0.98,
  WASTE_SINK_SPEED: 0.5,
  /** Fraction of a waste particle that dissolves into the field per tick. */
  WASTE_DISSOLVE_RATE: 0.002,
  /** Ticks a waste particle lies on the bottom before dissolving fully. */
  WASTE_BOTTOM_TICKS: 120,
} as const;
