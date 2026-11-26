/** All simulation tuning lives here. */
export const CONFIG = {
  TANK_W: 1600,
  TANK_H: 900,
  TICKS_PER_SEC: 60,

  /** Height of the sand layer at the bottom of the tank. */
  SAND_H: 70,
  /** Background colors — used by the renderer and (later) by camouflage. */
  BG_WATER_HUE: 0.55,
  BG_WATER_BRIGHTNESS: 0.35,
  BG_SAND_HUE: 0.11,
  BG_SAND_BRIGHTNESS: 0.45,
} as const;
