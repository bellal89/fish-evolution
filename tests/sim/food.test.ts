import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { FoodSystem } from '../../src/sim/food';
import { FertilizerField } from '../../src/sim/nutrients';
import { Rng } from '../../src/sim/rng';

const W = CONFIG.TANK_W, H = CONFIG.TANK_H;

function makeField(level: number): FertilizerField {
  const f = new FertilizerField(64, 36, W, H);
  f.cells.fill(level);
  return f;
}

test('creates algae along the bottom and on rock tops', () => {
  const food = new FoodSystem(new Rng(1), W, H);
  expect(food.algae.length).toBe(CONFIG.ALGAE_CELLS);
  expect(food.algae.some((a) => a.y < H - CONFIG.SAND_H)).toBe(true);
});

test('exposes the generated rocks, inside the tank', () => {
  const food = new FoodSystem(new Rng(1), W, H);
  expect(food.rocks.length).toBe(CONFIG.ROCK_COUNT);
  for (const r of food.rocks) {
    expect(r.x).toBeGreaterThan(0);
    expect(r.x).toBeLessThan(W);
    expect(r.y).toBe(H - CONFIG.SAND_H);
  }
  for (const a of food.algae) {
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThanOrEqual(CONFIG.TANK_W);
  }
});

test('food step conserves field+food total', () => {
  const f = makeField(1);
  const rng = new Rng(1);
  const food = new FoodSystem(rng, W, H);
  food.addWaste(100, 100, 50);
  const before = f.total() + food.total();
  for (let i = 0; i < 3000; i++) {
    food.step(f, rng);
    f.diffuse(0.1);
  }
  expect(f.total() + food.total()).toBeCloseTo(before, 4);
  expect(food.plankton.length).toBeGreaterThan(0);
});

test('algae grows faster with more fertilizer', () => {
  const run = (level: number) => {
    const f = makeField(level);
    const rng = new Rng(2);
    const food = new FoodSystem(rng, W, H);
    for (let i = 0; i < 600; i++) food.step(f, rng);
    return food.algae.reduce((s, a) => s + a.biomass, 0);
  };
  expect(run(2)).toBeGreaterThan(run(0.2));
});

test('algae biomass never exceeds the cap', () => {
  const f = makeField(50);
  const rng = new Rng(3);
  const food = new FoodSystem(rng, W, H);
  for (let i = 0; i < 2000; i++) food.step(f, rng);
  for (const a of food.algae) expect(a.biomass).toBeLessThanOrEqual(CONFIG.ALGAE_MAX + 1e-9);
});

test('eatAlgae and removePlankton return what was actually taken', () => {
  const f = makeField(5);
  const rng = new Rng(4);
  const food = new FoodSystem(rng, W, H);
  for (let i = 0; i < 300; i++) food.step(f, rng);
  const cell = food.algae[0]!;
  const have = cell.biomass;
  expect(food.eatAlgae(cell, have + 100)).toBe(have);
  expect(cell.biomass).toBe(0);
  const p = food.plankton[0]!;
  expect(food.removePlankton(p)).toBe(p.amount);
  expect(food.plankton).not.toContain(p);
});

test('waste sinks, then dissolves into the field once on the bottom', () => {
  const f = makeField(0);
  const rng = new Rng(5);
  const food = new FoodSystem(rng, W, H);
  food.algae.length = 0;
  food.addWaste(800, 100, 10);
  const w = food.waste[0]!;
  food.step(f, rng);
  expect(w.y).toBeGreaterThan(100);
  expect(f.total()).toBeGreaterThan(0);
  for (let i = 0; i < 5000; i++) food.step(f, rng);
  expect(food.waste.length).toBe(0);
  expect(f.total() + food.total()).toBeCloseTo(10, 6);
});
