/** All simulation tuning lives here. */
export const CONFIG = {
  TANK_W: 1600,
  TANK_H: 900,
  TICKS_PER_SEC: 60,

  /** Sand layer height. */
  SAND_H: 70,
  /** Background colors for camouflage. The renderer uses the hues. */
  BG_WATER_HUE: 0.55,
  BG_SAND_HUE: 0.11,
  BG_WATER_BRIGHTNESS: 0.5,
  BG_SAND_BRIGHTNESS: 0.7,

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
  /** [min, max] per numeric trait. Speeds are px/tick. */
  TRAIT_RANGES: {
    size: [6, 20],
    maxSpeed: [1, 4],
    viewAngle: [0.8, 3],
    viewRange: [80, 400],
    mateThreshold: [30, 100],
    investFraction: [0.1, 0.6],
    lifespanTicks: [9000, 24000],
    choosiness: [0, 1],
    brightness: [0, 1],
    patternCount: [1, 6],
  },
  /** Mutation noise std dev, as a fraction of the trait range. */
  TRAIT_MUT_SD: 0.05,
  /** Chance that a pattern gene switches to a random pattern. */
  P_PATTERN_MUT: 0.03,
  /** A chooser with choosiness 1 demands this attraction. */
  CHOOSY_MAX: 0.5,
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
  PLANKTON_TRIES: 30,
  /** One full sweep of the light spot, left to right and back (2 sim minutes). */
  LIGHT_PERIOD_TICKS: 7200,
  /** Distance from the spot center at which light falls to 1/e. */
  LIGHT_SPOT_WIDTH: 300,
  /** Fraction of the light lost from the surface to the sand. */
  LIGHT_DEPTH_FADE: 0.7,
  /** Local fertilizer needed before plankton can spawn. */
  PLANKTON_FERT_MIN: 0.5,
  PLANKTON_AMOUNT: 2,
  PLANKTON_MAX: 400,
  /** Chance per tick that plankton in full darkness dies and dissolves. */
  PLANKTON_DARK_DEATH: 0.0008,
  /** Std dev of the random velocity kick per tick. */
  PLANKTON_DRIFT: 0.02,
  PLANKTON_DAMPING: 0.98,
  WASTE_SINK_SPEED: 0.5,
  /** Fraction of a waste particle that dissolves into the field per tick. */
  WASTE_DISSOLVE_RATE: 0.002,
  /** Ticks a waste particle lies on the bottom before dissolving fully. */
  WASTE_BOTTOM_TICKS: 120,
  /** A dead fish's body sinks this fast, px/tick (3 times the waste). */
  BODY_SINK_SPEED: 1.5,
  /** A body rests this far below the floor line, as a fraction of its size. */
  BODY_REST_DEPTH: 0.5,
  /** Ticks a body lies on the bottom while it dissolves into the field (10 s). */
  BODY_DISSOLVE_TICKS: 600,

  // Senses
  /** Vision rays per fish, spread evenly across the view angle. */
  RAY_COUNT: 5,
  /** Radius of the lateral line. */
  LATERAL_RADIUS: 120,
  /** The lateral line does not feel movers at or below this speed. */
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
  /** Gut contents at which a fish or predator excretes them as waste. */
  EXCRETE_AMOUNT: 2,
  /** Age in ticks at which a fish can mate. */
  MATURITY_TICKS: 600,
  /** Extra age per tick while a fish touches waste (N). */
  WASTE_AGE_TICKS: 0.5,
  /** A dead body ages a fish this many times faster than waste (K). */
  BODY_AGE_MULT: 3,

  // Predator, reproduction, lineage
  /** Body radius. */
  PRED_SIZE: 20,
  /** Cruise speed while patrolling, per tick. */
  PRED_PATROL_SPEED: 1.2,
  /** Chase speed, per tick; above the fastest fish. */
  PRED_DASH_SPEED: 4.2,
  /** Max heading change per tick at full turn, radians. */
  PRED_TURN_RATE: 0.05,
  /** Field of view, radians. */
  PRED_VIEW_ANGLE: 1.6,
  /** Spotting range for a fully visible fish. */
  PRED_VIEW_RANGE: 350,
  PRED_STAMINA_MAX: 25,
  /** Stamina lost per chasing tick. */
  PRED_STAMINA_DRAIN: 1,
  /** Stamina gained per resting or patrolling tick. */
  PRED_STAMINA_REFILL: 0.5,
  /** Max random turn per tick while patrolling, as a share of full turn. */
  PRED_WANDER_TURN: 0.3,
  /** The predator steers toward an egg this close to its edge. */
  PRED_EGG_REACH: 15,
  /** Least energy an egg should hold; a clutch is sized by this. */
  EGG_MIN_ENERGY: 10,
  MAX_CLUTCH: 4,
  /** Ticks after mating before a fish can mate again. */
  MATE_COOLDOWN: 300,
  /** Ticks from laying to hatching. */
  HATCH_TICKS: 100,
  /** Generations of descendants an ancestor's living count covers. */
  LINEAGE_DEPTH: 10,
  /** Ticks between two snapshots of the leader (5 sim minutes). */
  LEADER_SNAPSHOT_TICKS: 18_000,

  // World
  INITIAL_FISH: 150,
  /** Fish per arena side. */
  ARENA_FISH: 5,
  /** Energy each initial fish starts with. */
  INITIAL_FISH_ENERGY: 80,
  /** All nutrients in the tank. */
  TOTAL_NUTRIENTS: 18000,
  /** Most algae biomass one bite takes: a full cell lasts ALGAE_MAX / BITE bites. */
  BITE: 2,
  /** Ticks between two algae bites of one fish. */
  BITE_COOLDOWN: 5,
  /** A fish touches food within its size plus this. */
  EAT_REACH: 4,
  /** Ticks a predator stays sated after eating a fish. */
  PRED_SATIETY_TICKS: 600,
  /** Cell size of the per-tick spatial grids. */
  GRID_CELL: 200,

  // Stats
  /** Ticks between stats samples. */
  STATS_EVERY: 300,
  /** History length at which adjacent points are merged. */
  STATS_MAX: 600,
  /** Sectors of the hue circle for the most common hue (24 sectors of 15°). */
  HUE_BINS: 24,

  // UI
  /** Radius in px for picking a fish with a click. */
  PICK_RADIUS: 20,

  // Worker loop
  /** Wall-time budget per frame, ms. */
  WORKER_BUDGET_MS: 25,
  /** Minimum wall time between posted snapshots, ms. */
  SNAPSHOT_INTERVAL_MS: 33,
  /** Delay between worker frames, ms. */
  WORKER_TIMER_MS: 16,
  /** How often the worker saves the world to IndexedDB. */
  SAVE_INTERVAL_MS: 30_000,
} as const;
