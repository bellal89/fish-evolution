import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Rng } from '../../src/sim/rng';
import {
  accepts,
  crossTraits,
  expressedColor,
  hueDist,
  mutateTraits,
  randomTraits,
  visibility,
  type ColorGenes,
} from '../../src/sim/traits';

const R = CONFIG.TRAIT_RANGES;
const inRange = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi;

test('males and females express own color', () => {
  const t = randomTraits(new Rng(1));
  expect(expressedColor(t, 'M')).toBe(t.colorM);
  expect(expressedColor(t, 'F')).toBe(t.colorF);
});

test('hueDist is circular', () => {
  expect(hueDist(0.05, 0.95)).toBeCloseTo(0.1);
  expect(hueDist(0, 0.5)).toBeCloseTo(0.5);
});

test('mutation stays in range over many rounds', () => {
  const rng = new Rng(3);
  let t = randomTraits(rng);
  for (let i = 0; i < 1000; i++) {
    t = mutateTraits(t, rng);
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
});

test('mutateTraits does not modify its input', () => {
  const rng = new Rng(4);
  const t = randomTraits(rng);
  const copy = structuredClone(t);
  mutateTraits(t, rng);
  expect(t).toEqual(copy);
});

test('crossTraits takes every field from one parent, without sharing objects', () => {
  const rng = new Rng(5);
  const a = randomTraits(rng);
  const b = randomTraits(rng);
  for (let i = 0; i < 20; i++) {
    const c = crossTraits(a, b, rng);
    for (const k of Object.keys(a) as (keyof typeof a)[]) {
      expect([a[k], b[k]]).toContainEqual(c[k]);
    }
    expect(c.colorM).not.toBe(a.colorM);
    expect(c.colorM).not.toBe(b.colorM);
    expect(c.colorF).not.toBe(a.colorF);
    expect(c.colorF).not.toBe(b.colorF);
  }
});

test('perfect match is attractive, opposite hue is not', () => {
  const t = { ...randomTraits(new Rng(2)), prefHue: 0.3, prefPattern: 'stripes' as const, choosiness: 1 };
  expect(accepts(t, { hue: 0.3, brightness: 1, pattern: 'stripes', patternCount: 3, hue2: 0 })).toBe(true);
  expect(accepts(t, { hue: 0.8, brightness: 1, pattern: 'solid', patternCount: 1, hue2: 0 })).toBe(false);
});

test('non-choosy accepts anyone', () => {
  const rng = new Rng(6);
  const t = { ...randomTraits(rng), prefHue: 0.3, prefPattern: 'stripes' as const, choosiness: 0 };
  const worst: ColorGenes = { hue: 0.8, brightness: 0, pattern: 'solid', patternCount: 1, hue2: 0 };
  expect(accepts(t, worst)).toBe(true);
});

test('camouflaged color is less visible', () => {
  const bg = { hue: 0.55, b: 0.3 };
  const camo = { hue: 0.55, brightness: 0.3, pattern: 'solid' as const, patternCount: 1, hue2: 0.55 };
  const loud = { hue: 0.05, brightness: 1, pattern: 'stripes' as const, patternCount: 4, hue2: 0.6 };
  expect(visibility(camo, bg.hue, bg.b)).toBeLessThan(visibility(loud, bg.hue, bg.b));
  expect(visibility(camo, bg.hue, bg.b)).toBeGreaterThanOrEqual(0.25);
  expect(visibility(loud, bg.hue, bg.b)).toBeLessThanOrEqual(1);
});
