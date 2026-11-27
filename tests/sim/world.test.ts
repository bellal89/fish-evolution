import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
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
  f.x = p.x + 1;
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
  expect(g.lastInputs[21]).toBeGreaterThan(0); // the kill raised an alarm
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
