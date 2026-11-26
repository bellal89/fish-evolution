import { expect, test } from 'vitest';
import { InnovationTracker, createMinimalGenome, type Genome } from '../../src/neat/genome';
import { addNode, mutateGenome } from '../../src/neat/mutate';
import { CONFIG } from '../../src/sim/config';
import {
  advanceAge, applyOutputs, createFish, excrete, isDead, isMature, payCost, tickCost, updateReady,
  type Fish,
} from '../../src/sim/fish';
import { Rng } from '../../src/sim/rng';
import { INPUT_COUNT, OUTPUT_COUNT, type SensingFish } from '../../src/sim/senses';
import { randomTraits } from '../../src/sim/traits';

const W = CONFIG.TANK_W, H = CONFIG.TANK_H;

function mkGenome(): { g: Genome; rng: Rng; t: InnovationTracker } {
  const rng = new Rng(3);
  const t = new InnovationTracker(INPUT_COUNT + 1 + OUTPUT_COUNT);
  return { g: createMinimalGenome(INPUT_COUNT, OUTPUT_COUNT, rng, t), rng, t };
}

function mk(over: (f: Fish) => void = () => {}, genome?: Genome): Fish {
  const traits = randomTraits(new Rng(5));
  traits.size = 10;
  traits.maxSpeed = 3;
  traits.lifespanTicks = 5000;
  traits.mateThreshold = 60;
  const f = createFish(1, 800, 400, 'F', traits, genome ?? mkGenome().g, 80, null);
  over(f);
  return f;
}

const out = (turn: number, thrust: number) => Float32Array.from([turn, thrust, 0]);

test('createFish sets sane defaults and is assignable to SensingFish', () => {
  const f = mk();
  const s: SensingFish = f;
  expect(s.ready).toBe(false);
  expect(f.lastInputs.length).toBe(INPUT_COUNT);
  expect(f.lastOutputs.length).toBe(OUTPUT_COUNT);
  expect([f.speed, f.age, f.gut, f.children, f.mateCooldown, f.eaten]).toEqual([0, 0, 0, 0, 0, 0]);
});

test('brain cost grows with size', () => {
  const small = mkGenome();
  const big = mkGenome();
  for (let i = 0; i < 3; i++) addNode(big.g, big.rng, big.t);
  for (let i = 0; i < 20; i++) mutateGenome(big.g, big.rng, big.t);
  const a = mk(() => {}, small.g);
  const b = mk(() => {}, big.g);
  expect(tickCost(b)).toBeGreaterThan(tickCost(a));
});

test('faster fish pays more', () => {
  const slow = mk(f => { f.speed = 1; });
  const fast = mk(f => { f.speed = 3; });
  expect(tickCost(fast)).toBeGreaterThan(tickCost(slow));
});

test('payCost moves energy into gut, total unchanged', () => {
  const f = mk(x => { x.speed = 2; });
  const t = f.energy + f.gut;
  payCost(f);
  expect(f.energy).toBeLessThan(80);
  expect(f.gut).toBeGreaterThan(0);
  expect(f.energy + f.gut).toBeCloseTo(t, 10);
});

test('payCost never takes more than the fish has', () => {
  const f = mk(x => { x.energy = 0.001; x.speed = 3; });
  payCost(f);
  expect(f.energy).toBe(0);
  expect(f.gut).toBeCloseTo(0.001, 10);
});

test('a minimal mid-size fish at mid speed lasts tens of seconds', () => {
  const f = mk(x => { x.speed = 1.5; });
  const secs = f.energy / tickCost(f) / CONFIG.TICKS_PER_SEC;
  expect(secs).toBeGreaterThan(20);
  expect(secs).toBeLessThan(120);
});

test('excrete releases the gut only past the threshold', () => {
  const f = mk(x => { x.gut = CONFIG.EXCRETE_AMOUNT - 0.1; });
  expect(excrete(f)).toBe(0);
  expect(f.gut).toBeCloseTo(CONFIG.EXCRETE_AMOUNT - 0.1);
  f.gut += 0.5;
  const total = f.gut;
  expect(excrete(f)).toBe(total);
  expect(f.gut).toBe(0);
});

test('thrust maps to speed and moves along the heading', () => {
  const f = mk();
  applyOutputs(f, out(0, 1), W, H);
  expect(f.speed).toBeCloseTo(3);
  expect(f.x).toBeCloseTo(803);
  const g = mk();
  applyOutputs(g, out(0, -1), W, H);
  expect(g.speed).toBe(0);
});

test('out-of-range or NaN-free outputs are clamped', () => {
  const f = mk();
  applyOutputs(f, out(50, 50), W, H);
  expect(f.speed).toBeCloseTo(3);
  expect(f.heading).toBeCloseTo(CONFIG.TURN_RATE);
  expect(Number.isFinite(f.x + f.y)).toBe(true);
});

test('fish is clamped inside tank and can turn away', () => {
  const f = mk(x => { x.x = 1599; x.y = 450; });
  for (let i = 0; i < 100; i++) applyOutputs(f, out(0, 1), W, H);
  expect(f.x).toBeLessThanOrEqual(W - f.traits.size);
  expect(Math.cos(f.heading)).toBeLessThan(0);
  for (let i = 0; i < 100; i++) applyOutputs(f, out(0, 1), W, H);
  expect(f.x).toBeLessThan(W - f.traits.size);
});

test('corner and water floor: stays inside and heads away', () => {
  const floor = H - CONFIG.SAND_H - 10;
  const f = mk(x => { x.x = W - 10; x.y = floor; x.heading = Math.PI / 4; });
  for (let i = 0; i < 20; i++) applyOutputs(f, out(0, 1), W, H);
  expect(f.x).toBeLessThanOrEqual(W - 10);
  expect(f.y).toBeLessThanOrEqual(floor);
  expect(Math.cos(f.heading)).toBeLessThan(0);
  expect(Math.sin(f.heading)).toBeLessThan(0);
  const top = mk(x => { x.y = 10; x.heading = -Math.PI / 2; });
  applyOutputs(top, out(0, 1), W, H);
  expect(top.y).toBe(10);
  expect(Math.sin(top.heading)).toBeGreaterThan(0);
});

test('starves at zero energy, dies of old age', () => {
  expect(isDead(mk())).toBeNull();
  expect(isDead(mk(f => { f.energy = 0; }))).toBe('starved');
  expect(isDead(mk(f => { f.age = f.traits.lifespanTicks; }))).toBe('old');
  expect(isDead(mk(f => { f.energy = 0; f.age = f.traits.lifespanTicks; }))).toBe('starved');
});

test('maturity, cooldown and ready', () => {
  const f = mk();
  expect(isMature(f)).toBe(false);
  f.age = CONFIG.MATURITY_TICKS - 1;
  advanceAge(f);
  expect(isMature(f)).toBe(true);
  updateReady(f);
  expect(f.ready).toBe(true);
  f.mateCooldown = 2;
  updateReady(f);
  expect(f.ready).toBe(false);
  advanceAge(f);
  advanceAge(f);
  advanceAge(f);
  expect(f.mateCooldown).toBe(0);
  updateReady(f);
  expect(f.ready).toBe(true);
  f.energy = f.traits.mateThreshold - 1;
  updateReady(f);
  expect(f.ready).toBe(false);
});
