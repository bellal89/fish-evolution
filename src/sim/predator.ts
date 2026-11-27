import { CONFIG } from './config';
import type { Egg } from './reproduction';
import type { Fish } from './fish';
import { clamp, keepInTank, wrapAngle } from './geom';
import type { Rng } from './rng';
import type { SpatialGrid } from './spatial';
import { expressedColor, visibility } from './traits';

export interface Predator {
  x: number;
  y: number;
  heading: number;
  speed: number;
  size: number;
  maxSpeed: number;
  stamina: number;
  /** Ticks left of not hunting after a meal. */
  satiety: number;
  gut: number;
  state: 'patrol' | 'chase' | 'rest';
  targetId: number | null;
}

export interface PredatorAction {
  /** -1..1 */
  turn: number;
  /** 0..1 */
  thrust: number;
}

export interface PredatorView {
  fish: SpatialGrid<Fish>;
  eggs: Egg[];
  bg(x: number, y: number): { hue: number; brightness: number };
}

/** Seam where a learned predator brain can replace the script. */
export interface PredatorController {
  decide(p: Predator, view: PredatorView, rng: Rng): PredatorAction;
}

export function createPredator(x: number, y: number, heading: number): Predator {
  return {
    x, y, heading, speed: 0,
    size: CONFIG.PRED_SIZE,
    maxSpeed: CONFIG.PRED_DASH_SPEED,
    stamina: CONFIG.PRED_STAMINA_MAX,
    satiety: 0, gut: 0, state: 'patrol', targetId: null,
  };
}

function steerTo(p: Predator, x: number, y: number): number {
  const diff = wrapAngle(Math.atan2(y - p.y, x - p.x) - p.heading);
  return clamp(diff / CONFIG.PRED_TURN_RATE, -1, 1);
}

export class ScriptedPredator implements PredatorController {
  decide(p: Predator, view: PredatorView, rng: Rng): PredatorAction {
    if (p.state === 'rest') {
      return { turn: 0, thrust: 0 };
    }

    if (p.state === 'chase') {
      const target = this.findTarget(p, view);
      if (target) return { turn: steerTo(p, target.x, target.y), thrust: 1 };
      p.state = 'patrol';
      p.targetId = null;
    }

    const prey = this.spot(p, view);
    if (prey) {
      p.state = 'chase';
      p.targetId = prey.id;
      return { turn: steerTo(p, prey.x, prey.y), thrust: 1 };
    }

    const reach = p.size + CONFIG.PRED_EGG_REACH;
    for (const egg of view.eggs) {
      if (Math.hypot(egg.x - p.x, egg.y - p.y) <= reach) {
        return { turn: steerTo(p, egg.x, egg.y), thrust: 1 };
      }
    }

    return { turn: rng.range(-1, 1) * CONFIG.PRED_WANDER_TURN, thrust: 1 };
  }

  private findTarget(p: Predator, view: PredatorView): Fish | null {
    for (const f of view.fish.query(p.x, p.y, CONFIG.PRED_VIEW_RANGE)) {
      if (f.id === p.targetId) return f;
    }
    return null;
  }

  /** Nearest fish inside the view cone and within its color-scaled range; none while sated. */
  private spot(p: Predator, view: PredatorView): Fish | null {
    if (p.satiety > 0) return null;
    let best: Fish | null = null;
    let bestD = Infinity;
    for (const f of view.fish.query(p.x, p.y, CONFIG.PRED_VIEW_RANGE)) {
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d >= bestD) continue;
      const bg = view.bg(f.x, f.y);
      const vis = visibility(expressedColor(f.traits, f.sex), bg.hue, bg.brightness);
      if (d > CONFIG.PRED_VIEW_RANGE * vis) continue;
      const off = Math.abs(wrapAngle(Math.atan2(f.y - p.y, f.x - p.x) - p.heading));
      if (off > CONFIG.PRED_VIEW_ANGLE / 2) continue;
      best = f;
      bestD = d;
    }
    return best;
  }
}

/** Applies the action: turn, move, bounce off walls, update stamina and state. */
export function stepPredator(p: Predator, a: PredatorAction, tankW: number, tankH: number): void {
  p.heading = wrapAngle(p.heading + a.turn * CONFIG.PRED_TURN_RATE);
  p.speed =
    p.state === 'chase' ? CONFIG.PRED_DASH_SPEED * a.thrust
    : p.state === 'patrol' ? CONFIG.PRED_PATROL_SPEED * a.thrust
    : 0;
  p.x += Math.cos(p.heading) * p.speed;
  p.y += Math.sin(p.heading) * p.speed;
  keepInTank(p, p.size, tankW, tankH - CONFIG.SAND_H);

  if (p.state === 'chase') {
    p.stamina = Math.max(0, p.stamina - CONFIG.PRED_STAMINA_DRAIN);
    if (p.stamina === 0) { p.state = 'rest'; p.targetId = null; }
  } else {
    p.stamina = Math.min(CONFIG.PRED_STAMINA_MAX, p.stamina + CONFIG.PRED_STAMINA_REFILL);
    if (p.state === 'rest' && p.stamina >= CONFIG.PRED_STAMINA_MAX) p.state = 'patrol';
  }
  p.satiety = Math.max(0, p.satiety - 1);
}
