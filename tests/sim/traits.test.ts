import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Rng } from '../../src/sim/rng';
import {
  accepts,
  attraction,
  crossTraits,
  hueDist,
  mutateTraits,
  randomTraits,
  visibility,
  type ColorGenes,
} from '../../src/sim/traits';

const R = CONFIG.TRAIT_RANGES;
const inRange = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi;

test('hueDist is circular', () => {
  expect(hueDist(0.05, 0.95)).toBeCloseTo(0.1);
  expect(hueDist(0, 0.5)).toBeCloseTo(0.5);
});

test('mutation stays in range over many rounds', () => {
  const rng = new Rng(3);
  let t = randomTraits(rng);
  const patterns = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    t = mutateTraits(t, rng);
    patterns.add(t.prefPattern);
    expect(inRange(t.size, R.size)).toBe(true);
    expect(inRange(t.maxSpeed, R.maxSpeed)).toBe(true);
    expect(inRange(t.viewAngle, R.viewAngle)).toBe(true);
    expect(inRange(t.viewRange, R.viewRange)).toBe(true);
    expect(inRange(t.mateThreshold, R.mateThreshold)).toBe(true);
    expect(inRange(t.investFraction, R.investFraction)).toBe(true);
    expect(inRange(t.lifespanTicks, R.lifespanTicks)).toBe(true);
    expect(inRange(t.choosiness, R.choosiness)).toBe(true);
    expect(t.prefHue).toBeGreaterThanOrEqual(0);
    expect(t.prefHue).toBeLessThan(1);
    for (const c of [t.colorM, t.colorF]) {
      expect(inRange(c.brightness, R.brightness)).toBe(true);
      expect(Number.isInteger(c.patternCount)).toBe(true);
      expect(inRange(c.patternCount, R.patternCount)).toBe(true);
      for (const h of [c.hue, c.hue2]) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
      }
    }
  }
  expect(patterns.size).toBeGreaterThan(1);
});

test('mutateTraits returns a changed copy and leaves its input alone', () => {
  const rng = new Rng(4);
  const t = randomTraits(rng);
  const copy = structuredClone(t);
  const m = mutateTraits(t, rng);
  expect(t).toEqual(copy);
  expect(m.size).not.toBe(t.size);
});

test('crossTraits takes every field from one parent', () => {
  const rng = new Rng(5);
  const a = randomTraits(rng);
  const b = randomTraits(rng);
  const sizes = new Set<number>();
  for (let i = 0; i < 20; i++) {
    const c = crossTraits(a, b, rng);
    for (const k of Object.keys(a) as (keyof typeof a)[]) {
      expect([a[k], b[k]]).toContainEqual(c[k]);
    }
    sizes.add(c.size);
  }
  expect(sizes).toEqual(new Set([a.size, b.size]));
});

test('attraction weighs hue, pattern and brightness', () => {
  const t = { ...randomTraits(new Rng(2)), prefHue: 0.3, prefPattern: 'stripes' as const };
  const c: ColorGenes = { hue: 0.3, brightness: 1, pattern: 'stripes', patternCount: 3, hue2: 0 };
  expect(attraction(t, c)).toBeCloseTo(1);
  expect(attraction(t, { ...c, pattern: 'solid' })).toBeCloseTo(0.6);
  expect(attraction(t, { ...c, brightness: 0 })).toBeCloseTo(0.5);
});

const match: ColorGenes = { hue: 0.3, brightness: 1, pattern: 'stripes', patternCount: 3, hue2: 0 };
const opposite: ColorGenes = { hue: 0.8, brightness: 0, pattern: 'solid', patternCount: 1, hue2: 0 };
test.each([
  ['choosy fish accepts a perfect match', 1, match, true],
  ['choosy fish rejects the opposite', 1, opposite, false],
  ['non-choosy fish accepts the opposite', 0, opposite, true],
])('%s', (_, choosiness, color, ok) => {
  const t = { ...randomTraits(new Rng(2)), prefHue: 0.3, prefPattern: 'stripes' as const, choosiness };
  expect(accepts(t, color)).toBe(ok);
});

test('camouflaged color is less visible', () => {
  const bg = { hue: 0.55, b: 0.3 };
  const camo = { hue: 0.55, brightness: 0.3, pattern: 'solid' as const, patternCount: 1, hue2: 0.55 };
  const loud = { hue: 0.05, brightness: 1, pattern: 'stripes' as const, patternCount: 4, hue2: 0.6 };
  expect(visibility(camo, bg.hue, bg.b)).toBeLessThan(visibility(loud, bg.hue, bg.b));
  expect(visibility(camo, bg.hue, bg.b)).toBeGreaterThanOrEqual(0.25);
  expect(visibility(loud, bg.hue, bg.b)).toBeLessThanOrEqual(1);
  const plain = { ...loud, brightness: 0.3, pattern: 'solid' as const };
  expect(visibility({ ...plain, pattern: 'stripes' }, bg.hue, bg.b)).toBeGreaterThan(visibility(plain, bg.hue, bg.b));
});
