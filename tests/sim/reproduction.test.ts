import { expect, test } from 'vitest';
import { InnovationTracker, createMinimalGenome } from '../../src/neat/genome';
import { CONFIG } from '../../src/sim/config';
import { createFish, type Fish } from '../../src/sim/fish';
import { canMate, mate } from '../../src/sim/reproduction';
import { Rng } from '../../src/sim/rng';
import { INPUT_COUNT, OUTPUT_COUNT } from '../../src/sim/senses';
import { randomTraits, type Sex } from '../../src/sim/traits';

const rng = new Rng(11);
const tracker = new InnovationTracker(INPUT_COUNT + 1 + OUTPUT_COUNT);

function mk(id: number, sex: Sex, over: (f: Fish) => void = () => {}): Fish {
  const traits = randomTraits(new Rng(id));
  traits.size = 10;
  traits.mateThreshold = 60;
  traits.investFraction = 0.4;
  traits.choosiness = 0;
  const genome = createMinimalGenome(INPUT_COUNT, OUTPUT_COUNT, rng, tracker);
  const f = createFish(id, 500, 400, sex, traits, genome, 100, null);
  f.age = CONFIG.MATURITY_TICKS;
  f.lastOutputs[2] = 1;
  over(f);
  return f;
}

const pair = (over: (f: Fish) => void = () => {}): [Fish, Fish] => [mk(1, 'M', over), mk(2, 'F', over)];
const counter = () => { let n = 100; return () => n++; };
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

test('same-sex pair cannot mate', () => {
  const [a, b] = pair();
  expect(canMate(a, b)).toBe(true);
  expect(canMate(mk(1, 'M'), mk(2, 'M'))).toBe(false);
  expect(canMate(mk(1, 'F'), mk(2, 'F'))).toBe(false);
});

test('immature or low-energy fish cannot mate', () => {
  const [a, b] = pair();
  a.age = CONFIG.MATURITY_TICKS - 1;
  expect(canMate(a, b)).toBe(false);
  const [c, d] = pair();
  d.energy = d.traits.mateThreshold - 1;
  expect(canMate(c, d)).toBe(false);
});

test('choosy fish rejects unattractive partner', () => {
  const [a, b] = pair();
  expect(canMate(a, b)).toBe(true);
  a.traits.choosiness = 1;
  a.traits.prefHue = 0;
  a.traits.prefPattern = 'stripes';
  b.traits.colorF = { ...b.traits.colorF, hue: 0.5, brightness: 0, pattern: 'solid' };
  expect(canMate(a, b)).toBe(false);
  expect(canMate(b, a)).toBe(false);
});

test('mating conserves energy', () => {
  const [a, b] = pair();
  a.energy = 120;
  const before = a.energy + b.energy;
  const eggs = mate(a, b, new Rng(1), tracker, 0, counter());
  expect(a.energy + b.energy + sum(eggs.map(e => e.energy))).toBeCloseTo(before, 9);
  expect(a.energy).toBeLessThan(120);
});

test('clutch size between 1 and 4', () => {
  const [a, b] = pair();
  expect(mate(a, b, new Rng(1), tracker, 0, counter()).length).toBe(CONFIG.MAX_CLUTCH);
  const [c, d] = pair(f => { f.energy = 20; f.traits.investFraction = 0.1; });
  expect(mate(c, d, new Rng(1), tracker, 0, counter()).length).toBe(1);
});

test('eggs sit at the midpoint with parents and hatch time; parents get cooldown and children', () => {
  const [a, b] = pair(); // equal energy: a is the fitter
  b.x = a.x + 8;
  const eggs = mate(a, b, new Rng(2), tracker, 50, counter());
  expect(eggs.map(e => e.id)).toEqual([100, 101, 102, 103]);
  for (const e of eggs) {
    expect(e.parents).toEqual([a.id, b.id]);
    expect(e.hatchAt).toBe(50 + CONFIG.HATCH_TICKS);
    expect(e.x).toBeCloseTo(a.x + 4);
    expect(e.y).toBe(a.y);
    expect(e.genome.nodes.length).toBeGreaterThanOrEqual(a.genome.nodes.length);
  }
  expect(a.mateCooldown).toBe(CONFIG.MATE_COOLDOWN);
  expect(b.mateCooldown).toBe(CONFIG.MATE_COOLDOWN);
  expect(a.children).toBe(eggs.length);
  expect(b.children).toBe(eggs.length);
});
