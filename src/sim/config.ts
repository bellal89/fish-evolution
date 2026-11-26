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

  // Senses
  /** Vision rays per fish, spread evenly across the view angle. */
  RAY_COUNT: 5,
  /** Radius of the lateral line. */
  LATERAL_RADIUS: 120,
  /** Movers slower than this are not felt by the lateral line. */
  LATERAL_MIN_SPEED: 1.5,
  /** Half-width of the front and back lateral quadrants, radians. */
  LATERAL_FRONT_HALF_ANGLE: Math.PI / 4,
  SMELL_RADIUS: 250,
  /** Smell sample points sit this far to the left and right of the fish. */
  SMELL_SIDE_OFFSET: 8,
  /** Distances below this are clamped when computing smell (avoids 1/0). */
  SMELL_MIN_DIST: 5,
  /** Keeps the smell gradient finite when there is no smell. */
  SMELL_EPS: 1e-6,
  ALARM_RADIUS: 200,
  ALARM_TICKS: 180,
  /** Radius at which a ray hits a food particle. */
  SENSE_FOOD_RADIUS: 6,

  // Fish
  /** Energy per tick per unit of size, just for being alive. */
  BASE_COST: 0.0008,
  /** Energy per tick per unit of size and squared speed. */
  MOVE_COST: 0.0002,
  /** Energy per tick per hidden node. */
  BRAIN_NODE_COST: 0.0005,
  /** Energy per tick per enabled connection. */
  BRAIN_CONN_COST: 0.00004,
  /** Max heading change per tick at full turn output, radians. */
  TURN_RATE: 0.15,
  /** Spent energy a fish holds until it is excreted as waste. */
  EXCRETE_AMOUNT: 2,
  /** Age in ticks at which a fish can mate. */
  MATURITY_TICKS: 600,
} as const;
