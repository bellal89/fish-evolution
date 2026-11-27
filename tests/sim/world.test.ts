import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { INPUT_LABELS } from '../../src/sim/senses';
import { World } from '../../src/sim/world';

const drift = (w: World, t0: number) => Math.abs(w.totalNutrients() - t0) / t0;

// Per-tick check over a long run: some transfers (a predator eating an egg) are rare.
test('long run stays finite and conserves nutrients every tick', () => {
  const w = new World(3);
  const t0 = w.totalNutrients();
  let fishChecks = 0;
  for (let i = 0; i < 50_000 && !w.extinct; i++) {
    w.step();
    expect(drift(w, t0)).toBeLessThan(1e-6);
    if (w.tick % 500 !== 0) continue;
    for (const f of w.fish) {
      expect(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.energy)).toBe(true);
      expect([...f.lastOutputs].every(Number.isFinite)).toBe(true);
      fishChecks++;
    }
  }
  expect(fishChecks).toBeGreaterThan(0);
}, 300_000);

test('extinct world stops', () => {
  const w = new World(1);
  const [f] = w.fish;
  w.fish = [];
  w.eggs = [{ id: -1, x: 100, y: 100, energy: 1, hatchAt: 1e9, genome: f.genome, traits: f.traits, sex: 'M', parents: [0, 0] }];
  w.step();
  expect(w.extinct).toBe(false);
  w.eggs = [];
  w.step();
  expect(w.extinct).toBe(true);
  const t = w.tick;
  w.step();
  expect(w.tick).toBe(t);
});

test('births happen in a normal run', () => {
  const w = new World(5);
  for (let i = 0; i < 30_000 && !w.fish.some(f => f.parents) && !w.extinct; i++) w.step();
  expect(w.fish.some(f => f.parents)).toBe(true);
}, 60_000);

/** One loud fish on top of the only predator and one bystander behind it; no other fish. */
function encounter(satiety: number) {
  const w = new World(1);
  const [f, g] = w.fish;
  const [p] = w.predators;
  w.fish = [f, g];
  f.traits.colorM = { hue: 0, brightness: 1, pattern: 'stripes', patternCount: 3, hue2: 0.5 };
  f.sex = 'M';
  f.x = p.x + 10; // Far enough ahead that the fish stays in view after it moves.
  f.y = g.y = p.y;
  g.x = p.x - 150;
  p.heading = 0;
  p.satiety = satiety;
  w.step();
  return { w, f, g, p };
}

test('a hungry predator attacks and eats a touching fish, stops the chase and alarms others', () => {
  const { w, g, p } = encounter(0);
  expect(w.fish).toEqual([g]);
  expect(w.events.attacks).toBe(1);
  expect(w.events.lifespansOfDead).toEqual([1]);
  expect(p.satiety).toBe(CONFIG.PRED_SATIETY_TICKS);
  expect([p.state, p.targetId]).toEqual(['patrol', null]);
  w.step();
  expect(g.lastInputs[INPUT_LABELS.indexOf('alarm')]).toBeGreaterThan(0); // the kill raised an alarm
});

test('a fish eaten by the predator leaves no body', () => {
  const { w } = encounter(0);
  expect(w.food.bodies).toEqual([]);
});

test('a sated predator spares a touching fish', () => {
  const { w, f, g } = encounter(10);
  expect(w.fish).toEqual([f, g]);
});

test('a chase whose target is gone counts as an escape', () => {
  const w = new World(1);
  const [p] = w.predators;
  p.state = 'chase';
  p.targetId = -1;
  w.step();
  expect(w.events.escapes).toBe(1);
});

test('a fish on an algae cell takes one bite, then waits', () => {
  const w = new World(1);
  const [f] = w.fish;
  w.fish = [f];
  w.predators.length = 0;
  const cell = w.food.algae[0];
  cell.biomass = CONFIG.ALGAE_MAX;
  f.x = cell.x;
  f.y = cell.y - f.traits.size;
  w.step();
  w.step();
  expect(cell.biomass).toBeCloseTo(CONFIG.ALGAE_MAX - CONFIG.BITE, 1);
  expect(f.biteCooldown).toBe(CONFIG.BITE_COOLDOWN - 1);
});

test('a world restored from a structured clone of its save continues identically', () => {
  const a = new World(3);
  for (let i = 0; i < 3000; i++) a.step();
  const b = new World(structuredClone(a.save()));
  for (let i = 0; i < 1000; i++) { a.step(); b.step(); }
  const state = (w: World) => JSON.stringify(w.save(), (_, v) => (ArrayBuffer.isView(v) ? Array.from(v as Float64Array) : v instanceof Map ? [...v] : v));
  expect(state(b)).toBe(state(a));
}, 60_000);

test('a starved fish becomes a body with all its energy and gut', () => {
  const w = new World(1);
  const [f] = w.fish;
  w.fish = [f];
  w.predators.length = 0;
  w.food.algae.length = 0;
  w.food.plankton.length = 0;
  f.energy = 0;
  f.gut = 1.5; // Below EXCRETE_AMOUNT, so no waste.
  const waste = w.food.waste.length;
  w.step();
  expect(w.fish).toEqual([]);
  expect(w.food.waste.length).toBe(waste);
  expect(w.food.bodies).toHaveLength(1);
  const [b] = w.food.bodies;
  expect(b.amount).toBe(1.5);
  expect([b.full, b.size, b.heading]).toEqual([1.5, f.traits.size, f.heading]);
});

test('restore keeps bodies', () => {
  const a = new World(3);
  for (let i = 0; i < 3000; i++) a.step();
  a.food.addBody(400, 100, 20, 10, 1);
  const b = new World(structuredClone(a.save()));
  expect(b.food.bodies.length).toBeGreaterThan(0);
  for (let i = 0; i < 1000; i++) { a.step(); b.step(); }
  const state = (w: World) => JSON.stringify(w.save(), (_, v) => (ArrayBuffer.isView(v) ? Array.from(v as Float64Array) : v instanceof Map ? [...v] : v));
  expect(state(b)).toBe(state(a));
}, 60_000);

test('fish smell bodies in the world', () => {
  const w = new World(1);
  const [f] = w.fish;
  w.fish = [f];
  w.predators.length = 0;
  w.food.algae.length = 0;
  w.food.plankton.length = 0;
  w.food.waste.length = 0;
  f.x = 500;
  f.y = 400;
  f.heading = 0;
  w.food.addBody(500, 350, 20, 10, 0);
  w.step();
  expect(f.lastInputs[INPUT_LABELS.indexOf('waste smell')]).toBeGreaterThan(0);
});

/** One fish in a clean world: no predators, food, waste or other fish. */
function lonelyFish() {
  const w = new World(1);
  const [f] = w.fish;
  w.fish = [f];
  w.predators.length = 0;
  w.food.algae.length = 0;
  w.food.plankton.length = 0;
  w.food.waste.length = 0;
  return { w, f };
}

test('a fish at the bottom touches a small body on the sand', () => {
  const { w, f } = lonelyFish();
  const floorY = CONFIG.TANK_H - CONFIG.SAND_H;
  f.traits.size = 6;
  f.x = 500;
  f.y = floorY - 6;
  w.food.addBody(500, floorY + CONFIG.BODY_REST_DEPTH * 6, 10, 6, 0);
  w.step();
  expect(f.wasteAge).toBe(CONFIG.WASTE_AGE_TICKS * CONFIG.BODY_AGE_MULT);
});

test('waste aging can kill, and the fish leaves a body', () => {
  const { w, f } = lonelyFish();
  // Without harm, the fish lives through this tick.
  f.age = f.traits.lifespanTicks - 1 - CONFIG.WASTE_AGE_TICKS / 2;
  w.food.addWaste(f.x, f.y, 1);
  w.step();
  expect(w.fish).toEqual([]);
  expect(w.food.bodies).toHaveLength(1);
});

test('a fish that dies with nothing left leaves no body', () => {
  const { w, f } = lonelyFish();
  // It excreted its gut on the tick its energy ran out.
  f.energy = 0;
  f.gut = 0;
  w.step();
  expect(w.fish).toEqual([]);
  expect(w.food.bodies).toEqual([]);
});
