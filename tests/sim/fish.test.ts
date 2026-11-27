import { expect, test } from 'vitest';
import { InnovationTracker, createMinimalGenome, type Genome } from '../../src/neat/genome';
import { addNode, mutateGenome } from '../../src/neat/mutate';
import { CONFIG } from '../../src/sim/config';
import {
  advanceAge, applyOutputs, createFish, excrete, isDead, isMature, payCost, tickCost, updateReady,
  type Fish,
} from '../../src/sim/fish';
import { Rng } from '../../src/sim/rng';
import { INPUT_COUNT, OUTPUT_COUNT } from '../../src/sim/senses';
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

test('outputs turn the fish and set its speed along the heading', () => {
  const f = mk();
  applyOutputs(f, out(1, 1), W, H);
  expect(f.heading).toBeCloseTo(CONFIG.TURN_RATE);
  expect(f.speed).toBeCloseTo(3);
  expect(f.x).toBeCloseTo(800 + 3 * Math.cos(CONFIG.TURN_RATE));
  const g = mk();
  applyOutputs(g, out(0, -1), W, H);
  expect(g.speed).toBe(0);
});

test('fish bounces off the sand, not the tank bottom', () => {
  const f = mk(x => { x.y = H - CONFIG.SAND_H; x.heading = Math.PI / 2; });
  applyOutputs(f, out(0, 1), W, H);
  expect(f.y).toBe(H - CONFIG.SAND_H - f.traits.size);
  expect(Math.sin(f.heading)).toBeLessThan(0);
});

test('starves at zero energy, dies of old age', () => {
  expect(isDead(mk())).toBe(false);
  expect(isDead(mk(f => { f.energy = 0; }))).toBe(true);
  expect(isDead(mk(f => { f.age = f.traits.lifespanTicks; }))).toBe(true);
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
