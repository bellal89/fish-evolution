import { expect, test } from 'vitest';
import { arenaTraits, randomBrain, type ArenaSetup, type Brain } from '../../src/sim/arena';
import { CONFIG } from '../../src/sim/config';
import { Rng } from '../../src/sim/rng';
import { INPUT_COUNT } from '../../src/sim/senses';
import { SCALAR_KEYS, randomTraits } from '../../src/sim/traits';
import { World } from '../../src/sim/world';

const setup = (b: Brain): ArenaSetup => ({ genome: b.genome, traits: arenaTraits(b.traits) });
const state = (w: World) =>
  JSON.stringify(w.save(), (_, v) => (ArrayBuffer.isView(v) ? Array.from(v as Float64Array) : v instanceof Map ? [...v] : v));

test('arena traits: body midpoints, owner colors', () => {
  const owner = randomTraits(new Rng(1));
  const t = arenaTraits(owner);
  expect(t.size).toBe((6 + 20) / 2);
  for (const k of SCALAR_KEYS) {
    const [lo, hi] = CONFIG.TRAIT_RANGES[k];
    expect(t[k]).toBe((lo + hi) / 2);
  }
  expect(t.colorM).toBe(owner.colorM);
  expect(t.colorF).toBe(owner.colorF);
  expect(t.prefHue).toBe(owner.prefHue);
});

test('randomBrain depends only on seed and side', () => {
  expect(randomBrain(5, 0)).toEqual(randomBrain(5, 0));
  expect(randomBrain(5, 0)).not.toEqual(randomBrain(5, 1));
  expect(randomBrain(5, 0)).not.toEqual(randomBrain(6, 0));
});

test('both sides start the same for a seed, whatever the brains', () => {
  const a = new World(9, setup(randomBrain(9, 0)));
  const b = new World(9, setup(randomBrain(9, 1)));
  const fishAt = (w: World) => w.fish.map(f => [f.x, f.y, f.heading, f.sex]);
  expect(fishAt(b)).toEqual(fishAt(a));
  expect(b.food.algae.map(c => [c.x, c.y])).toEqual(a.food.algae.map(c => [c.x, c.y]));
  expect(b.food.plankton).toEqual(a.food.plankton);
  expect(b.food.rocks).toEqual(a.food.rocks);
  expect(b.predators).toEqual(a.predators);
  expect(b.field.cells).toEqual(a.field.cells);
  expect(a.fish[0].genome).not.toBe(b.fish[0].genome);
  expect(a.fish[0].genome).not.toEqual(b.fish[0].genome);
});

test('an arena world has ARENA_FISH fish with the given brain, sexes alternate', () => {
  const s = setup(randomBrain(2, 0));
  const w = new World(2, s);
  expect(w.fish).toHaveLength(CONFIG.ARENA_FISH);
  expect(w.fish.map(f => f.sex)).toEqual(['M', 'F', 'M', 'F', 'M']);
  for (const f of w.fish) {
    expect(f.genome).toBe(s.genome);
    expect(f.traits).toBe(s.traits);
  }
  expect(w.eggs).toEqual([]);
});

test('there is no mating in the arena', () => {
  const { genome, traits } = randomBrain(4, 0);
  const bias = INPUT_COUNT;
  const mateOut = INPUT_COUNT + 1 + 2;
  for (const c of genome.conns) c.weight = c.from === bias && c.to === mateOut ? 10 : 0;
  const w = new World(4, setup({ genome, traits }));
  for (const f of w.fish) {
    f.traits = { ...f.traits, choosiness: 0 };
    f.age = CONFIG.MATURITY_TICKS;
    f.energy = 1000;
    f.x = 500;
    f.y = 400;
  }
  w.predators.length = 0;
  w.step();
  expect(w.fish.every(f => f.lastOutputs[2] > 0)).toBe(true);
  expect(w.events.matings).toBe(0);
  expect(w.eggs).toEqual([]);
});

test('an arena run is deterministic for a seed and brains', () => {
  const s = setup(randomBrain(8, 1));
  const a = new World(8, s);
  const b = new World(8, s);
  for (let i = 0; i < 500; i++) { a.step(); b.step(); }
  expect(state(b)).toBe(state(a));
});
