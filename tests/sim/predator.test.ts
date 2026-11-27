import { expect, test } from 'vitest';
import { InnovationTracker, createMinimalGenome } from '../../src/neat/genome';
import { CONFIG } from '../../src/sim/config';
import { createFish, type Fish } from '../../src/sim/fish';
import {
  ScriptedPredator, createPredator, stepPredator, type PredatorView,
} from '../../src/sim/predator';
import type { Egg } from '../../src/sim/reproduction';
import { Rng } from '../../src/sim/rng';
import { INPUT_COUNT, OUTPUT_COUNT, type SensingPredator } from '../../src/sim/senses';
import { SpatialGrid } from '../../src/sim/spatial';
import { randomTraits } from '../../src/sim/traits';

const W = CONFIG.TANK_W, H = CONFIG.TANK_H;
const rng = new Rng(4);
const tracker = new InnovationTracker(INPUT_COUNT + 1 + OUTPUT_COUNT);
const genome = createMinimalGenome(INPUT_COUNT, OUTPUT_COUNT, rng, tracker);
const bg = () => ({ hue: CONFIG.BG_WATER_HUE, brightness: 0.5 });

function conspicuousFish(id: number, x: number, y: number): Fish {
  const traits = randomTraits(new Rng(id));
  const color = { hue: 0.05, brightness: 1, pattern: 'stripes' as const, patternCount: 3, hue2: 0.9 };
  traits.colorM = color;
  traits.colorF = color;
  return createFish(id, x, y, 'M', traits, genome, 50, null);
}

function view(fish: Fish[], eggs: Egg[] = []): PredatorView {
  const grid = new SpatialGrid<Fish>(100, W, H);
  for (const f of fish) grid.insert(f);
  return { fish: grid, eggs, bg, tankW: W, tankH: H };
}

test('predator is assignable to SensingPredator', () => {
  const s: SensingPredator = createPredator(100, 100, 0);
  expect(s.size).toBe(CONFIG.PRED_SIZE);
});

test('predator chases visible fish and rests after stamina runs out', () => {
  const p = createPredator(400, 300, 0);
  const fish = conspicuousFish(1, 600, 300);
  const v = view([fish]);
  const ctl = new ScriptedPredator();
  const r = new Rng(1);
  const states = new Set<string>();
  let sawDrain = false;
  for (let i = 0; i < 2000 && p.state !== 'rest'; i++) {
    const before = p.stamina;
    stepPredator(p, ctl.decide(p, v, r), W, H);
    states.add(p.state);
    if (p.state === 'chase' && p.stamina < before) sawDrain = true;
  }
  expect(states.has('chase')).toBe(true);
  expect(sawDrain).toBe(true);
  expect(p.state).toBe('rest');
  expect(p.stamina).toBe(0);
  expect(p.targetId).toBeNull();
  // Rest: no movement, no chase even with prey in view, until refilled.
  const rx = p.x, ry = p.y;
  stepPredator(p, ctl.decide(p, v, r), W, H);
  expect([p.x, p.y]).toEqual([rx, ry]);
  expect(p.state).toBe('rest');
  for (let i = 0; i < CONFIG.PRED_STAMINA_MAX / CONFIG.PRED_STAMINA_REFILL + 2 && p.state === 'rest'; i++) {
    stepPredator(p, ctl.decide(p, v, r), W, H);
  }
  expect(p.state).toBe('patrol');
});

test('predator ignores fish outside its view cone', () => {
  const p = createPredator(400, 300, 0);
  const behind = conspicuousFish(1, 300, 300);
  const ctl = new ScriptedPredator();
  ctl.decide(p, view([behind]), new Rng(1));
  expect(p.state).toBe('patrol');
});

test('well camouflaged fish is spotted only at close range', () => {
  const p = createPredator(400, 300, 0);
  const f = conspicuousFish(1, 400 + CONFIG.PRED_VIEW_RANGE * 0.5, 300);
  const camo = { hue: CONFIG.BG_WATER_HUE, brightness: 0.5, pattern: 'solid' as const, patternCount: 1, hue2: 0.5 };
  f.traits.colorM = camo;
  f.traits.colorF = camo;
  new ScriptedPredator().decide(p, view([f]), new Rng(1));
  expect(p.state).toBe('patrol');
  f.x = 400 + CONFIG.PRED_VIEW_RANGE * CONFIG.MIN_VISIBILITY * 0.5;
  const g2 = view([f]);
  new ScriptedPredator().decide(p, g2, new Rng(1));
  expect(p.state).toBe('chase');
});

test('sated predator ignores fish until it is hungry again', () => {
  const ctl = new ScriptedPredator();
  const front = conspicuousFish(1, 400 + CONFIG.PRED_VIEW_RANGE / 4, 300);
  const p = createPredator(400, 300, 0);
  p.satiety = 100;
  ctl.decide(p, view([front]), new Rng(1));
  expect(p.state).toBe('patrol');
  expect(p.targetId).toBeNull();
  p.satiety = 0;
  ctl.decide(p, view([front]), new Rng(1));
  expect(p.state).toBe('chase');
  expect(p.targetId).toBe(1);
});

test('chooses the nearest fish and drops a vanished target', () => {
  const p = createPredator(400, 300, 0);
  const ctl = new ScriptedPredator();
  const v = view([conspicuousFish(1, 700, 300), conspicuousFish(2, 550, 310)]);
  ctl.decide(p, v, new Rng(1));
  expect(p.targetId).toBe(2);
  ctl.decide(p, view([]), new Rng(1));
  expect(p.state).toBe('patrol');
  expect(p.targetId).toBeNull();
});

test('predator steers toward a touching egg when no fish is in sight', () => {
  const p = createPredator(400, 300, 0);
  const egg = { id: 9, x: 400, y: 300 + p.size, energy: 5 } as Egg;
  const action = new ScriptedPredator().decide(p, view([], [egg]), new Rng(1));
  expect(action.turn).toBeGreaterThan(0);
  expect(p.state).toBe('patrol');
});

test('stepPredator speeds by state, stays in the water and counts satiety down', () => {
  const p = createPredator(10, 10, Math.PI);
  p.satiety = 2;
  stepPredator(p, { turn: 0, thrust: 1 }, W, H);
  expect(p.x).toBe(p.size);
  expect(Math.cos(p.heading)).toBeGreaterThan(0);
  expect(p.satiety).toBe(1);
  p.state = 'chase';
  p.heading = 0;
  const x = p.x;
  stepPredator(p, { turn: 0, thrust: 1 }, W, H);
  expect(p.x - x).toBeCloseTo(CONFIG.PRED_DASH_SPEED);
  p.x = W; p.y = H;
  stepPredator(p, { turn: 0, thrust: 1 }, W, H);
  expect(p.x).toBeLessThanOrEqual(W - p.size);
  expect(p.y).toBeLessThanOrEqual(H - CONFIG.SAND_H - p.size);
  expect(p.satiety).toBe(0);
});
