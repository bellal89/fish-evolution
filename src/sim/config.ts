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

  // Traits
  /** [min, max] per numeric trait. Speeds are px/tick, lifespan is in ticks. */
  TRAIT_RANGES: {
    size: [6, 20],
    maxSpeed: [1, 4],
    /** Radians. */
    viewAngle: [0.8, 3],
    viewRange: [80, 400],
    /** Energy needed to mate. */
    mateThreshold: [40, 150],
    investFraction: [0.1, 0.6],
    lifespanTicks: [3600, 18000],
    choosiness: [0, 1],
    brightness: [0, 1],
    patternCount: [1, 6],
  },
  /** Mutation noise std dev, as a fraction of the trait range. */
  TRAIT_MUT_SD: 0.05,
  /** Chance that a pattern gene switches to a random pattern. */
  P_PATTERN_MUT: 0.03,
  /** A chooser with choosiness 1 demands this attraction. */
  CHOOSY_MAX: 0.8,
  /** Visibility floor: even perfect camouflage is not invisible. */
  MIN_VISIBILITY: 0.25,
  /** Visibility weights: hue contrast and brightness contrast with the background. */
  VIS_HUE_W: 0.5,
  VIS_BRIGHT_W: 0.5,
  /** Visibility bonus for any non-solid pattern. */
  VIS_PATTERN_BONUS: 0.15,
} as const;
