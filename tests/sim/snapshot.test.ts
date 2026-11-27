import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { makeSnapshot } from '../../src/sim/snapshot';
import { Stats } from '../../src/sim/stats';
import { expressedColor } from '../../src/sim/traits';
import { World } from '../../src/sim/world';

function setup() {
  const w = new World(3);
  for (let i = 0; i < 20; i++) w.step();
  return { w, s: new Stats() };
}

test('snapshot is structured-cloneable', () => {
  const { w, s } = setup();
  s.sample(w);
  const snap = makeSnapshot(w, w.fish[0].id, s.history);
  expect(() => structuredClone(snap)).not.toThrow();
  expect(snap.selected!.activations.size).toBeGreaterThan(0);
  expect(snap.stats).toHaveLength(1);
  expect(snap.fish).toHaveLength(w.fish.length);
});

test('selected fish missing yields null', () => {
  const { w } = setup();
  const snap = makeSnapshot(w, 999999);
  expect(snap.selected).toBeNull();
  expect(snap.stats).toBeUndefined();
});

test('snapshot copies do not alias the live world', () => {
  const { w } = setup();
  const snap = makeSnapshot(w, null);
  const x = snap.fish[0].x;
  w.fish[0].x += 100;
  expect(snap.fish[0].x).toBe(x);
});

test('snapshot shows the expressed color, scaled algae and the leader', () => {
  const { w } = setup();
  const [m, f] = w.fish;
  w.lineage.born(-1, [m.id, f.id], m.genome, m.traits);
  const snap = makeSnapshot(w, null);
  expect(snap.fish[1].color).toBe(expressedColor(f.traits, f.sex));
  expect(snap.food.algae[0].biomass).toBe(w.food.algae[0].biomass / CONFIG.ALGAE_MAX);
  expect(snap.leader?.living).toBe(1);
});

test('snapshot lists bodies with their shape and fade', () => {
  const { w } = setup();
  w.food.addBody(300, 200, 40, 12, 0.5);
  w.food.bodies[0].amount = 10;
  const snap = makeSnapshot(w, null);
  expect(snap.food.bodies).toEqual([{ x: 300, y: 200, size: 12, heading: 0.5, fade: 0.25 }]);
});

test('selected view carries wasteAge', () => {
  const { w } = setup();
  w.fish[0].wasteAge = 123;
  expect(makeSnapshot(w, w.fish[0].id).selected!.wasteAge).toBe(123);
});
