import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Stats, modeHue } from '../../src/sim/stats';
import { World } from '../../src/sim/world';

test('sample appends one point and resets event counters', () => {
  const w = new World(1);
  const s = new Stats();
  for (let i = 0; i < 50; i++) w.step();
  w.events.attacks = 4; w.events.escapes = 3; w.events.lifespansOfDead = [10, 20]; w.events.foodEaten = 10;
  s.sample(w);
  const p = s.history[0];
  expect(s.history).toHaveLength(1);
  expect(p.population).toBe(w.fish.length);
  expect(p.males + p.females).toBe(p.population);
  expect(p.escapeRate).toBeCloseTo(0.75);
  expect(p.avgLifespan).toBe(15);
  expect(p.foodPerFish).toBeCloseTo(10 / p.population);
  expect(w.events.attacks).toBe(0);
  expect(w.events.lifespansOfDead).toEqual([]);
});

test('history downsamples instead of growing forever', () => {
  const w = new World(1);
  const s = new Stats();
  for (let i = 0; i < 2000; i++) { w.tick = i; s.sample(w); }
  expect(s.history.length).toBeLessThanOrEqual(CONFIG.STATS_MAX);
  expect(s.history[0].tick).toBe(0);
  for (let i = 1; i < s.history.length; i++) expect(s.history[i].tick).toBeGreaterThan(s.history[i - 1].tick);
});

const bin = (i: number) => (i + 0.5) / CONFIG.HUE_BINS;

test('modeHue returns the center of the most populated 15° sector', () => {
  expect(modeHue([0.01, 0.02, 0.5])).toBeCloseTo(bin(0), 12);
  expect(modeHue([0.5, 0.51, 0.01])).toBeCloseTo(bin(12), 12);
  expect(modeHue([0.999])).toBeCloseTo(bin(23), 12);
  expect(modeHue([0.6, 0.3])).toBeCloseTo(bin(7), 12); // A tie: the lowest sector wins.
  expect(modeHue([1, 1, 0.5])).toBeCloseTo(bin(0), 12); // 1 is the same hue as 0.
  expect(modeHue([])).toBe(0);
});

test('sample stores the most common hue, not the mean; top pattern is the commonest', () => {
  const w = new World(1);
  const males = w.fish.filter(f => f.sex === 'M').slice(0, 3);
  [0.1, 0.11, 0.6].forEach((h, i) => { males[i].traits.colorM.hue = h; });
  for (const m of males.slice(0, 2)) m.traits.colorM.pattern = 'stripes';
  males[2].traits.colorM.pattern = 'solid';
  w.fish = males;
  const s = new Stats();
  s.sample(w);
  expect(s.history[0].topHueM).toBeCloseTo(bin(2), 12);
  expect(s.history[0].topPatternM).toBe('stripes');
});

test('merging points averages numbers and keeps the earlier most common hue', () => {
  const w = new World(1);
  const male = w.fish.find(f => f.sex === 'M')!;
  w.fish = [male];
  const s = new Stats();
  for (let i = 0; i < CONFIG.STATS_MAX - 2; i++) s.sample(w);
  male.traits.colorM.hue = 0.95;
  male.traits.size = 4;
  s.sample(w);
  male.traits.colorM.hue = 0.05;
  male.traits.size = 8;
  s.sample(w);
  expect(s.history).toHaveLength(CONFIG.STATS_MAX / 2);
  expect(s.history[s.history.length - 1].topHueM).toBeCloseTo(bin(22), 12);
  expect(s.history[s.history.length - 1].avgSize).toBe(6);
});
