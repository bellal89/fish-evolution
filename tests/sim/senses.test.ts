import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Rng } from '../../src/sim/rng';
import {
  INPUT_COUNT,
  INPUT_LABELS,
  sense,
  type SenseContext,
  type SensingFish,
  type SensingPredator,
} from '../../src/sim/senses';
import { SpatialGrid } from '../../src/sim/spatial';
import { randomTraits, type ColorGenes } from '../../src/sim/traits';

const W = CONFIG.TANK_W;
const H = CONFIG.TANK_H;
type Food = { x: number; y: number; amount: number };

function makeFish(x: number, y: number, over: Partial<SensingFish> = {}): SensingFish {
  const traits = randomTraits(new Rng(7));
  traits.viewAngle = Math.PI / 2;
  traits.viewRange = 200;
  traits.size = 6;
  traits.maxSpeed = 3;
  return { x, y, heading: 0, speed: 0, energy: 50, age: 0, sex: 'M', traits, ready: false, ...over };
}

function makeCtx(
  fish: SensingFish[],
  food: Food[] = [],
  predators: SensingPredator[] = [],
  bg = { hue: 0.5, brightness: 0.5 },
): SenseContext {
  const fg = new SpatialGrid<SensingFish>(100, W, H);
  fish.forEach((f) => fg.insert(f));
  const foodGrid = new SpatialGrid<Food>(100, W, H);
  food.forEach((f) => foodGrid.insert(f));
  return { food: foodGrid, fish: fg, predators, alarms: [], tick: 0, bg: () => bg, tankW: W, tankH: H };
}

function run(f: SensingFish, ctx: SenseContext): Float32Array {
  const out = new Float32Array(INPUT_COUNT);
  sense(f, ctx, out);
  return out;
}

test('labels match input count', () => {
  expect(INPUT_LABELS).toHaveLength(INPUT_COUNT);
});

test.each([
  ['food', 0],
  ['predator', 2],
])('%s straight ahead lights only the middle ray', (kind, ch) => {
  const me = makeFish(100, 450);
  const ctx = kind === 'food'
    ? makeCtx([me], [{ x: 200, y: 450, amount: 1 }])
    : makeCtx([me], [], [{ x: 200, y: 450, speed: 0, maxSpeed: 4, size: 6 }]);
  const out = run(me, ctx);
  expect(out[2 * 3 + ch]).toBeGreaterThan(0.5);
  for (const ray of [0, 1, 3, 4]) expect(out[ray * 3 + ch]).toBe(0);
});

test('food the fish is inside reads full strength on every ray', () => {
  const me = makeFish(100, 450);
  const out = run(me, makeCtx([me], [{ x: 101, y: 450, amount: 1 }]));
  for (let r = 0; r < CONFIG.RAY_COUNT; r++) expect(out[r * 3]).toBe(1);
});

test('a slow predator behind is neither seen nor felt', () => {
  const me = makeFish(100, 450);
  const out = run(me, makeCtx([me], [], [{ x: 60, y: 450, speed: CONFIG.LATERAL_MIN_SPEED, maxSpeed: 4, size: 20 }]));
  for (let r = 0; r < CONFIG.RAY_COUNT; r++) expect(out[r * 3 + 2]).toBe(0);
  for (let i = 16; i < 20; i++) expect(out[i]).toBe(0);
});

test('ray 0 looks to the left', () => {
  const me = makeFish(100, 450);
  const a = -me.traits.viewAngle / 2;
  const out = run(me, makeCtx([me], [{ x: 100 + 100 * Math.cos(a), y: 450 + 100 * Math.sin(a), amount: 1 }]));
  expect(out[0]).toBeGreaterThan(0);
  expect(out[4 * 3]).toBe(0);
});

// Heading 0 (+x); screen y points down, so the fish's left is -y.
test.each([
  ['predator', 'front', 140, 450, 16],
  ['predator', 'back', 60, 450, 17],
  ['predator', 'left', 100, 410, 18],
  ['predator', 'right', 100, 490, 19],
  ['fish', 'left', 100, 410, 18],
])('lateral line feels a moving %s %s', (kind, _, x, y, input) => {
  const me = makeFish(100, 450);
  const ctx = kind === 'fish'
    ? makeCtx([me, makeFish(x, y, { speed: 3 })])
    : makeCtx([me], [], [{ x, y, speed: 3, maxSpeed: 4, size: 6 }]);
  const out = run(me, ctx);
  for (let i = 16; i < 20; i++) {
    if (i === input) expect(out[i]).toBeGreaterThan(0);
    else expect(out[i]).toBe(0);
  }
});

test('camouflaged fish seen at shorter range than loud fish', () => {
  const bg = { hue: 0.5, brightness: 0.5 };
  const color = (hue: number, brightness: number): ColorGenes =>
    ({ hue, brightness, pattern: 'solid', patternCount: 1, hue2: 0 });
  const me = makeFish(100, 450);
  const loud = makeFish(100 + 150, 450);
  const camo = makeFish(100 + 150, 450);
  loud.traits.colorM = color(0, 1);
  camo.traits.colorM = color(bg.hue, bg.brightness);
  const seen = (other: SensingFish) => run(me, makeCtx([me, other], [], [], bg))[2 * 3 + 1];
  expect(seen(loud)).toBeGreaterThan(0);
  expect(seen(camo)).toBe(0);
});

test('smell gradient points to food side', () => {
  const me = makeFish(500, 450);
  const out = run(me, makeCtx([me], [{ x: 550, y: 400, amount: 1 }]));
  expect(out[20]).toBeGreaterThan(0);
  const mirror = run(me, makeCtx([me], [{ x: 550, y: 500, amount: 1 }]));
  expect(mirror[20]).toBeLessThan(0);
});

test('food just beyond smell range is not smelled', () => {
  const me = makeFish(500, 450);
  expect(run(me, makeCtx([me], [{ x: 500 + CONFIG.SMELL_RADIUS, y: 430, amount: 1 }]))[20]).toBe(0);
});

test('alarm decays with age and distance cutoff', () => {
  const me = makeFish(500, 450);
  const ctx = makeCtx([me]);
  ctx.tick = 100;
  ctx.alarms = [{ x: 500, y: 400, tick: 100 - CONFIG.ALARM_TICKS / 2 }];
  expect(run(me, ctx)[21]).toBeCloseTo(0.5, 5);
  ctx.alarms = [{ x: 500 + CONFIG.ALARM_RADIUS + 10, y: 450, tick: 100 }];
  expect(run(me, ctx)[21]).toBe(0);
});

// 50 px from the wall ahead with viewRange 200.
test.each([
  ['right', W - 50, 450, 0],
  ['left', 50, 450, Math.PI],
  ['sand', 500, H - CONFIG.SAND_H - 50, Math.PI / 2],
  ['surface', 500, 50, -Math.PI / 2],
])('wall input facing the %s wall', (_, x, y, heading) => {
  const me = makeFish(x, y, { heading });
  expect(run(me, makeCtx([me]))[22]).toBeCloseTo(0.75, 5);
});

test('energy, age and ready inputs', () => {
  const me = makeFish(500, 450, { ready: true });
  me.energy = me.traits.mateThreshold / 2;
  me.age = me.traits.lifespanTicks / 4;
  const out = run(me, makeCtx([me]));
  expect([out[23], out[24], out[25]]).toEqual([0.5, 0.25, 1].map(v => expect.closeTo(v, 5)));
  me.ready = false;
  expect(run(me, makeCtx([me]))[25]).toBe(0);
});

test('mate appeal comes only from the opposite sex', () => {
  const me = makeFish(500, 450);
  me.traits.prefHue = 0.3;
  me.traits.prefPattern = 'solid';
  const other = (sex: 'M' | 'F') => {
    const o = makeFish(550, 450, { sex });
    o.traits.colorF = o.traits.colorM = { hue: 0.3, brightness: 1, pattern: 'solid', patternCount: 1, hue2: 0 };
    return o;
  };
  const appeal = (o: SensingFish) => run(me, makeCtx([me, o], [], [], { hue: 0.5, brightness: 0 }))[15];
  expect(appeal(other('F'))).toBeGreaterThan(0);
  expect(appeal(other('M'))).toBe(0);
});

test('all inputs finite and within [-1,1]', () => {
  const rng = new Rng(42);
  const fish: SensingFish[] = [];
  for (let i = 0; i < 200; i++) {
    const t = randomTraits(rng);
    fish.push({
      x: rng.range(0, W), y: rng.range(0, H), heading: rng.range(-Math.PI, Math.PI),
      speed: rng.range(0, t.maxSpeed), energy: rng.range(0, 200), age: rng.range(0, t.lifespanTicks * 1.2),
      sex: rng.chance(0.5) ? 'M' : 'F', traits: t, ready: rng.chance(0.5),
    });
  }
  const food: Food[] = Array.from({ length: 300 }, () => ({ x: rng.range(0, W), y: rng.range(0, H), amount: rng.range(0, 3) }));
  const preds: SensingPredator[] = [{ x: 800, y: 400, speed: 5, maxSpeed: 4, size: 40 }];
  const ctx = makeCtx(fish, food, preds);
  ctx.alarms = [{ x: 800, y: 400, tick: 0 }];
  ctx.tick = 10;
  for (const f of fish) {
    const out = run(f, ctx);
    for (const v of out) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  }
});
