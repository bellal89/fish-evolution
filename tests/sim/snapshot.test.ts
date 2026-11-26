import { expect, test } from 'vitest';
import { fishAt, makeSnapshot } from '../../src/sim/snapshot';
import { Stats } from '../../src/sim/stats';
import { World } from '../../src/sim/world';

function setup() {
  const w = new World(3);
  for (let i = 0; i < 20; i++) w.step();
  return { w, s: new Stats() };
}

test('snapshot is structured-cloneable', () => {
  const { w, s } = setup();
  s.sample(w);
  const snap = makeSnapshot(w, s, w.fish[0].id, true);
  expect(() => structuredClone(snap)).not.toThrow();
  expect(snap.selected!.fish.activations.length).toBeGreaterThan(0);
  expect(snap.stats).toHaveLength(1);
  expect(snap.fish).toHaveLength(w.fish.length);
});

test('selected fish missing yields null', () => {
  const { w, s } = setup();
  const snap = makeSnapshot(w, s, 999999, false);
  expect(snap.selected).toBeNull();
  expect(snap.stats).toBeUndefined();
});

test('snapshot copies do not alias the live world', () => {
  const { w, s } = setup();
  const snap = makeSnapshot(w, s, null, false);
  const x = snap.fish[0].x;
  w.fish[0].x += 100;
  expect(snap.fish[0].x).toBe(x);
});

test('fishAt picks the nearest fish within the radius', () => {
  const { w } = setup();
  const f = w.fish[0];
  expect(fishAt(w, f.x + 3, f.y)).toBe(f.id);
  expect(fishAt(w, -1000, -1000)).toBeNull();
});
