import { CONFIG } from './config';
import { clamp, wrapAngle } from './geom';
import type { SpatialGrid } from './spatial';
import type { Fish } from './fish';
import type { Predator } from './predator';
import { MAX_FISH_SIZE, attraction, expressedColor, visibility } from './traits';

export type SensingFish = Pick<Fish, 'x' | 'y' | 'heading' | 'speed' | 'energy' | 'age' | 'wasteAge' | 'sex' | 'traits' | 'ready'>;
export type SensingPredator = Pick<Predator, 'x' | 'y' | 'speed' | 'maxSpeed' | 'size'>;

export interface SenseContext {
  food: SpatialGrid<{ x: number; y: number; amount: number }>;
  /** Waste and dead bodies. */
  dirt: SpatialGrid<{ x: number; y: number; amount: number }>;
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
const IN_WASTE = IN_SMELL + 1;
const IN_ALARM = IN_WASTE + 1;
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
  'waste smell',
  'alarm',
  'wall',
  'energy',
  'age',
  'ready',
];

export const INPUT_COUNT = INPUT_LABELS.length;
export const OUTPUT_COUNT = 3;

// Nearest hit distance per ray and channel; reused to avoid per-call allocation.
const nearest = new Float64Array(RAYS * 3);
const rayDx = new Float64Array(RAYS);
const rayDy = new Float64Array(RAYS);
const lateral = new Float64Array(4);

function hit(ray: number, ch: number, dist: number): void {
  const i = ray * 3 + ch;
  if (dist < nearest[i]) nearest[i] = dist;
}

/** Casts all rays at a circle; records hits within `range`. Returns nearest hit distance or Infinity. */
function castAt(
  f: SensingFish, ch: number, cx: number, cy: number, r: number, range: number,
): number {
  // Ray vs circle: a miss if the ray passes the circle or the circle is behind.
  const lx = cx - f.x, ly = cy - f.y;
  const l2 = lx * lx + ly * ly;
  const r2 = r * r;
  let best = Infinity;
  for (let i = 0; i < RAYS; i++) {
    const proj = lx * rayDx[i] + ly * rayDy[i];
    const d2 = l2 - proj * proj;
    if (d2 > r2) continue;
    const half = Math.sqrt(r2 - d2);
    if (proj + half < 0) continue;
    const d = Math.max(proj - half, 0);
    if (d > range) continue;
    hit(i, ch, d);
    if (d < best) best = d;
  }
  return best;
}

const SMELL_R2 = CONFIG.SMELL_RADIUS * CONFIG.SMELL_RADIUS;
const SMELL_MIN2 = CONFIG.SMELL_MIN_DIST * CONFIG.SMELL_MIN_DIST;

/** Smell of one food item at (px, py), or 0 if out of smell range. */
function smellOf(p: { x: number; y: number; amount: number }, px: number, py: number): number {
  const dx = p.x - px, dy = p.y - py;
  const d2 = dx * dx + dy * dy;
  return d2 <= SMELL_R2 ? p.amount / Math.max(d2, SMELL_MIN2) : 0;
}

/** Within distance r of (x, y), with the same test as SpatialGrid.query. */
function within(p: { x: number; y: number }, x: number, y: number, r: number): boolean {
  const dx = p.x - x, dy = p.y - y;
  return dx * dx + dy * dy <= r * r;
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
  lateral[quadrant] += Math.min(1, speed / maxSpeed) * (1 - d / CONFIG.LATERAL_RADIUS);
}

/** Direction of vision ray i, spread evenly across the view angle. */
export function rayAngle(heading: number, viewAngle: number, i: number): number {
  return heading + viewAngle * (i / (RAYS - 1) - 0.5);
}

/** Fills `out` (length INPUT_COUNT) with the fish's brain inputs. */
export function sense(f: SensingFish, ctx: SenseContext, out: Float32Array): void {
  const { viewRange, viewAngle } = f.traits;
  nearest.fill(Infinity);
  lateral.fill(0);
  for (let i = 0; i < RAYS; i++) {
    const a = rayAngle(f.heading, viewAngle, i);
    rayDx[i] = Math.cos(a);
    rayDy[i] = Math.sin(a);
  }

  // One food query serves the rays and both nostrils (food does not move during
  // the fish step). The +1 absorbs rounding of the nostril offset.
  const foodR = viewRange + CONFIG.SENSE_FOOD_RADIUS;
  const sx = Math.sin(f.heading) * CONFIG.SMELL_SIDE_OFFSET;
  const sy = -Math.cos(f.heading) * CONFIG.SMELL_SIDE_OFFSET;
  const lx = f.x + sx, ly = f.y + sy, rx = f.x - sx, ry = f.y - sy;
  const smellR = CONFIG.SMELL_RADIUS + CONFIG.SMELL_SIDE_OFFSET + 1;
  let left = 0, right = 0;
  for (const p of ctx.food.query(f.x, f.y, Math.max(foodR, smellR))) {
    if (within(p, f.x, f.y, foodR)) castAt(f, CH_FOOD, p.x, p.y, CONFIG.SENSE_FOOD_RADIUS, viewRange);
    left += smellOf(p, lx, ly);
    right += smellOf(p, rx, ry);
  }

  let mateDist = Infinity;
  let mateAppeal = 0;
  for (const o of ctx.fish.query(f.x, f.y, viewRange + MAX_FISH_SIZE)) {
    if (o === f) continue;
    const color = expressedColor(o.traits, o.sex);
    const bg = ctx.bg(o.x, o.y);
    const range = viewRange * visibility(color, bg.hue, bg.brightness);
    const d = castAt(f, CH_FISH, o.x, o.y, o.traits.size, range);
    if (d < mateDist && o.sex !== f.sex) {
      mateDist = d;
      mateAppeal = attraction(f.traits, o.traits, o.sex);
    }
  }
  for (const p of ctx.predators) {
    castAt(f, CH_PRED, p.x, p.y, p.size, viewRange);
  }

  for (let i = 0; i < RAYS * 3; i++) {
    const d = nearest[i];
    out[i] = d === Infinity ? 0 : 1 - d / viewRange;
  }
  out[IN_MATE] = mateAppeal;

  for (const o of ctx.fish.query(f.x, f.y, CONFIG.LATERAL_RADIUS)) {
    if (o !== f) feel(f, o.x, o.y, o.speed, o.traits.maxSpeed);
  }
  for (const p of ctx.predators) feel(f, p.x, p.y, p.speed, p.maxSpeed);
  for (let q = 0; q < 4; q++) out[IN_LATERAL + q] = Math.min(1, lateral[q]);

  out[IN_SMELL] = (left - right) / (left + right + CONFIG.SMELL_EPS);

  let wasteLeft = 0, wasteRight = 0;
  for (const p of ctx.dirt.query(f.x, f.y, smellR)) {
    wasteLeft += smellOf(p, lx, ly);
    wasteRight += smellOf(p, rx, ry);
  }
  out[IN_WASTE] = (wasteLeft - wasteRight) / (wasteLeft + wasteRight + CONFIG.SMELL_EPS);

  let alarm = 0;
  const r2 = CONFIG.ALARM_RADIUS * CONFIG.ALARM_RADIUS;
  for (const a of ctx.alarms) {
    const dx = a.x - f.x, dy = a.y - f.y;
    if (dx * dx + dy * dy > r2) continue;
    alarm = Math.max(alarm, 1 - (ctx.tick - a.tick) / CONFIG.ALARM_TICKS);
  }
  out[IN_ALARM] = alarm;

  const cos = Math.cos(f.heading), sin = Math.sin(f.heading);
  const wallDist = Math.min(
    cos > 0 ? (ctx.tankW - f.x) / cos : cos < 0 ? -f.x / cos : Infinity,
    sin > 0 ? (ctx.tankH - CONFIG.SAND_H - f.y) / sin : sin < 0 ? -f.y / sin : Infinity,
  );
  out[IN_WALL] = clamp(1 - wallDist / viewRange, 0, 1);

  out[IN_ENERGY] = clamp(f.energy / f.traits.mateThreshold, 0, 1);
  out[IN_AGE] = clamp((f.age + f.wasteAge) / f.traits.lifespanTicks, 0, 1);
  out[IN_READY] = f.ready ? 1 : 0;
}
