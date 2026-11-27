import { expect, test } from 'vitest';
import { InnovationTracker, createMinimalGenome } from '../../src/neat/genome';
import { CONFIG } from '../../src/sim/config';
import { createFish, type Fish } from '../../src/sim/fish';
import { addNode } from '../../src/neat/mutate';
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

test('a mature, willing pair in contact can mate', () => {
  expect(canMate(...pair())).toBe(true);
});

test.each<[string, (a: Fish, b: Fish) => void]>([
  ['same sex', (_, b) => { b.sex = 'M'; }],
  ['immature', a => { a.age = CONFIG.MATURITY_TICKS - 1; }],
  ['low energy', (_, b) => { b.energy = b.traits.mateThreshold - 1; }],
  ['on cooldown', a => { a.mateCooldown = 1; }],
  ['no mating intent', (_, b) => { b.lastOutputs[2] = 0; }],
  ['not touching', (a, b) => { b.x = a.x + a.traits.size + b.traits.size; }],
  ['unattractive partner', (a, b) => {
    a.traits.choosiness = 1;
    a.traits.prefHue = 0;
    a.traits.prefPattern = 'stripes';
    b.traits.colorF = { ...b.traits.colorF, hue: 0.5, brightness: 0, pattern: 'solid' };
  }],
])('cannot mate: %s', (_, spoil) => {
  const [a, b] = pair();
  spoil(a, b);
  expect(canMate(a, b)).toBe(false);
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
  }
  expect(a.mateCooldown).toBe(CONFIG.MATE_COOLDOWN);
  expect(b.mateCooldown).toBe(CONFIG.MATE_COOLDOWN);
  expect(a.children).toBe(eggs.length);
  expect(b.children).toBe(eggs.length);
});

test('eggs carry mutated traits and genomes', () => {
  const [a, b] = pair();
  const eggs = mate(a, b, new Rng(3), tracker, 0, counter());
  const parentWeights = new Set([...a.genome.conns, ...b.genome.conns].map(c => c.weight));
  for (const e of eggs) expect([a.traits.size, b.traits.size]).not.toContain(e.traits.size);
  expect(eggs.some(e => e.genome.conns.some(c => !parentWeights.has(c.weight)))).toBe(true);
});

test('children inherit the structure of the higher-energy parent', () => {
  // A separate tracker keeps mutation-made node ids apart from the extra node below.
  const mutTracker = new InnovationTracker(5000);
  const extraNodeId = (withNode: Fish, without: Fish): number => {
    const known = new Set(without.genome.nodes.map(n => n.id));
    return withNode.genome.nodes.find(n => !known.has(n.id))!.id;
  };

  const [a, b] = pair();
  b.genome = structuredClone(a.genome);
  addNode(b.genome, new Rng(5), tracker);
  const extra = extraNodeId(b, a);

  b.energy = 150;
  a.energy = 100;
  for (const e of mate(a, b, new Rng(1), mutTracker, 0, counter())) {
    expect(e.genome.nodes.some(n => n.id === extra)).toBe(true);
  }

  b.energy = 100;
  a.energy = 150;
  a.mateCooldown = b.mateCooldown = 0;
  for (const e of mate(a, b, new Rng(1), mutTracker, 0, counter())) {
    expect(e.genome.nodes.some(n => n.id === extra)).toBe(false);
  }
});
