import { expect, test } from 'vitest';
import { World } from '../../src/sim/world';

const drift = (w: World, t0: number) => Math.abs(w.totalNutrients() - t0) / t0;

test('same seed → identical world after 2000 ticks', () => {
  const a = new World(7), b = new World(7);
  for (let i = 0; i < 2000; i++) { a.step(); b.step(); }
  expect(a.fish.map(f => [f.x, f.y, f.energy])).toEqual(b.fish.map(f => [f.x, f.y, f.energy]));
}, 30_000);

test('nutrients conserved every tick', () => {
  const w = new World(1);
  const t0 = w.totalNutrients();
  for (let i = 0; i < 5000; i++) {
    w.step();
    expect(drift(w, t0)).toBeLessThan(1e-6);
  }
}, 30_000);

test('long run stays finite and conserved', () => {
  const w = new World(3);
  const t0 = w.totalNutrients();
  let fishChecks = 0;
  for (let i = 0; i < 50_000 && !w.extinct; i++) {
    w.step();
    if (w.tick % 500 !== 0) continue;
    for (const f of w.fish) {
      expect(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.energy)).toBe(true);
      expect([...f.lastOutputs].every(Number.isFinite)).toBe(true);
      fishChecks++;
    }
    expect(drift(w, t0)).toBeLessThan(1e-6);
  }
  expect(fishChecks).toBeGreaterThan(0);
  expect(drift(w, t0)).toBeLessThan(1e-6);
}, 300_000);

test('extinct world stops', () => {
  const w = new World(1);
  w.fish = [];
  w.eggs = [];
  w.step();
  expect(w.extinct).toBe(true);
  const t = w.tick;
  w.step();
  expect(w.tick).toBe(t);
});

test('births happen in a normal run', () => {
  const w = new World(5);
  for (let i = 0; i < 30_000 && w.events.births === 0 && !w.extinct; i++) w.step();
  expect(w.events.births).toBeGreaterThan(0);
}, 60_000);
