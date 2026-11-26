import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { hueDist } from '../../src/sim/traits';
import { Stats } from '../../src/sim/stats';
import { World } from '../../src/sim/world';

test('sample appends one point and resets event counters', () => {
  const w = new World(1);
  const s = new Stats();
  for (let i = 0; i < 50; i++) w.step();
  w.events.attacks = 4; w.events.escapes = 3; w.events.lifespansOfDead = [10, 20];
  s.sample(w);
  const p = s.history[0];
  expect(s.history).toHaveLength(1);
  expect(p.population).toBe(w.fish.length);
  expect(p.males + p.females).toBe(p.population);
  expect(p.escapeRate).toBeCloseTo(0.75);
  expect(p.avgLifespan).toBe(15);
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

test('average hue is circular', () => {
  const w = new World(1);
  const males = w.fish.filter(f => f.sex === 'M');
  males[0].traits.colorM.hue = 0.95;
  males[1].traits.colorM.hue = 0.05;
  w.fish = males.slice(0, 2);
  const s = new Stats();
  s.sample(w);
  expect(hueDist(s.history[0].avgHueM, 0)).toBeLessThan(1e-6);
});
