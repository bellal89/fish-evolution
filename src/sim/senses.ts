import { CONFIG } from './config';
import { clamp, rayCircle, wrapAngle } from './geom';
import type { SpatialGrid } from './spatial';
import { attraction, expressedColor, visibility, type Sex, type Traits } from './traits';

export const INPUT_COUNT = 26;
export const OUTPUT_COUNT = 3;

export interface SensingFish {
  x: number;
  y: number;
  heading: number;
  speed: number;
  energy: number;
  age: number;
  sex: Sex;
  traits: Traits;
  /** Mature, enough energy and off cooldown. */
  ready: boolean;
}

export interface SensingPredator {
  x: number;
  y: number;
  speed: number;
  maxSpeed: number;
  size: number;
}

export interface SenseContext {
  food: SpatialGrid<{ x: number; y: number; amount: number }>;
  fish: SpatialGrid<SensingFish>;
  predators: SensingPredator[];
  alarms: { x: number; y: number; tick: number }[];
  tick: number;
  bg(x: number, y: number): { hue: number; brightness: number };
  tankW: number;
  tankH: number;
}

const RAYS = CONFIG.RAY_COUNT;
const CH_FOOD = 0;
const CH_FISH = 1;
const CH_PRED = 2;
const IN_MATE = RAYS * 3;
const IN_LATERAL = IN_MATE + 1;
const IN_SMELL = IN_LATERAL + 4;
const IN_ALARM = IN_SMELL + 1;
const IN_WALL = IN_ALARM + 1;
const IN_ENERGY = IN_WALL + 1;
const IN_AGE = IN_ENERGY + 1;
const IN_READY = IN_AGE + 1;

export const INPUT_LABELS: string[] = [
  ...Array.from({ length: RAYS }, (_, i) => [`r${i} food`, `r${i} fish`, `r${i} predator`]).flat(),
  'mate appeal',
  'felt front',
  'felt back',
  'felt left',
  'felt right',
  'smell',
  'alarm',
  'wall',
  'energy',
  'age',
  'ready',
];

// Nearest hit distance per ray and channel; reused to avoid per-call allocation.
const nearest = new Float64Array(RAYS * 3);
const rayDx = new Float64Array(RAYS);
const rayDy = new Float64Array(RAYS);
const lateral = new Float64Array(4);

function hit(ray: number, ch: number, dist: number): void {
  const i = ray * 3 + ch;
  if (dist < nearest[i]!) nearest[i] = dist;
}

/** Casts all rays at a circle; records hits within `range`. Returns nearest hit distance or Infinity. */
function castAt(
  f: SensingFish, ch: number, cx: number, cy: number, r: number, range: number,
): number {
  let best = Infinity;
  for (let i = 0; i < RAYS; i++) {
    const d = rayCircle(f.x, f.y, rayDx[i]!, rayDy[i]!, cx, cy, r);
    if (d === null || d > range) continue;
    hit(i, ch, d);
    if (d < best) best = d;
  }
  return best;
}

function smellAt(ctx: SenseContext, px: number, py: number): number {
  const min2 = CONFIG.SMELL_MIN_DIST * CONFIG.SMELL_MIN_DIST;
  let s = 0;
  for (const p of ctx.food.query(px, py, CONFIG.SMELL_RADIUS)) {
    const dx = p.x - px, dy = p.y - py;
    s += p.amount / Math.max(dx * dx + dy * dy, min2);
  }
  return s;
}

function feel(f: SensingFish, mx: number, my: number, speed: number, maxSpeed: number): void {
  const dx = mx - f.x, dy = my - f.y;
  const d = Math.hypot(dx, dy);
  if (speed <= CONFIG.LATERAL_MIN_SPEED || d >= CONFIG.LATERAL_RADIUS) return;
  const bearing = wrapAngle(Math.atan2(dy, dx) - f.heading);
  const abs = Math.abs(bearing);
  const quadrant =
    abs <= CONFIG.LATERAL_FRONT_HALF_ANGLE ? 0
    : abs >= Math.PI - CONFIG.LATERAL_FRONT_HALF_ANGLE ? 1
    : bearing < 0 ? 2 : 3;
  lateral[quadrant]! += Math.min(1, speed / maxSpeed) * (1 - d / CONFIG.LATERAL_RADIUS);
}

/** Fills `out` (length INPUT_COUNT) with the fish's brain inputs. */
export function sense(f: SensingFish, ctx: SenseContext, out: Float32Array): void {
  const { viewRange, viewAngle } = f.traits;
  nearest.fill(Infinity);
  lateral.fill(0);
  for (let i = 0; i < RAYS; i++) {
    const a = f.heading + viewAngle * (i / (RAYS - 1) - 0.5);
    rayDx[i] = Math.cos(a);
    rayDy[i] = Math.sin(a);
  }

  for (const p of ctx.food.query(f.x, f.y, viewRange + CONFIG.SENSE_FOOD_RADIUS)) {
    castAt(f, CH_FOOD, p.x, p.y, CONFIG.SENSE_FOOD_RADIUS, viewRange);
  }

  let mateDist = Infinity;
  let mateAppeal = 0;
  const maxSize = CONFIG.TRAIT_RANGES.size[1];
  for (const o of ctx.fish.query(f.x, f.y, viewRange + maxSize)) {
    if (o === f) continue;
    const color = expressedColor(o.traits, o.sex);
    const bg = ctx.bg(o.x, o.y);
    const range = viewRange * visibility(color, bg.hue, bg.brightness);
    const d = castAt(f, CH_FISH, o.x, o.y, o.traits.size, range);
    if (d < mateDist && o.sex !== f.sex) {
      mateDist = d;
      mateAppeal = attraction(f.traits, color);
    }
  }
  for (const p of ctx.predators) {
    castAt(f, CH_PRED, p.x, p.y, p.size, viewRange);
  }

  for (let i = 0; i < RAYS * 3; i++) {
    const d = nearest[i]!;
    out[i] = d === Infinity ? 0 : 1 - d / viewRange;
  }
  out[IN_MATE] = mateAppeal;

  for (const o of ctx.fish.query(f.x, f.y, CONFIG.LATERAL_RADIUS)) {
    if (o !== f) feel(f, o.x, o.y, o.speed, o.traits.maxSpeed);
  }
  for (const p of ctx.predators) feel(f, p.x, p.y, p.speed, p.maxSpeed);
  for (let q = 0; q < 4; q++) out[IN_LATERAL + q] = Math.min(1, lateral[q]!);

  const sx = Math.sin(f.heading) * CONFIG.SMELL_SIDE_OFFSET;
  const sy = -Math.cos(f.heading) * CONFIG.SMELL_SIDE_OFFSET;
  const left = smellAt(ctx, f.x + sx, f.y + sy);
  const right = smellAt(ctx, f.x - sx, f.y - sy);
  out[IN_SMELL] = (left - right) / (left + right + CONFIG.SMELL_EPS);

  let alarm = 0;
  const r2 = CONFIG.ALARM_RADIUS * CONFIG.ALARM_RADIUS;
  for (const a of ctx.alarms) {
    const dx = a.x - f.x, dy = a.y - f.y;
    if (dx * dx + dy * dy > r2) continue;
    alarm = Math.max(alarm, 1 - (ctx.tick - a.tick) / CONFIG.ALARM_TICKS);
  }
  out[IN_ALARM] = clamp(alarm, 0, 1);

  const cos = Math.cos(f.heading), sin = Math.sin(f.heading);
  const wallDist = Math.min(
    cos > 0 ? (ctx.tankW - f.x) / cos : cos < 0 ? -f.x / cos : Infinity,
    sin > 0 ? (ctx.tankH - CONFIG.SAND_H - f.y) / sin : sin < 0 ? -f.y / sin : Infinity,
  );
  out[IN_WALL] = clamp(1 - Math.max(0, wallDist) / viewRange, 0, 1);

  out[IN_ENERGY] = clamp(f.energy / f.traits.mateThreshold, 0, 1);
  out[IN_AGE] = clamp(f.age / f.traits.lifespanTicks, 0, 1);
  out[IN_READY] = f.ready ? 1 : 0;
}
