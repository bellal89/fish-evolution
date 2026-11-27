import { expect, test } from 'vitest';
import type { FromWorker, Snapshot } from '../../src/protocol';
import { CONFIG } from '../../src/sim/config';
import { SimLoop } from '../../src/worker/loop';

const FRAME_MS = 1000 / 60;

function setup(clock: () => number = () => 0) {
  const msgs: FromWorker[] = [];
  const loop = new SimLoop(1, m => msgs.push(m), clock);
  const snaps = (): Snapshot[] => msgs.map(m => m.snap);
  return { loop, msgs, snaps };
}

test('speed 0 does not advance', () => {
  const { loop, snaps } = setup();
  loop.handle({ type: 'speed', speed: 0 });
  loop.frame(0);
  loop.frame(FRAME_MS);
  loop.frame(2 * FRAME_MS);
  expect(snaps().every(s => s.tick === 0)).toBe(true);
  expect(snaps().length).toBeGreaterThan(0);
});

test('speed 10 advances ~10 ticks per frame, default speed is 1', () => {
  const a = setup();
  a.loop.frame(0);
  a.loop.frame(6 * FRAME_MS); // 6 frames of wall time
  expect(Math.abs(a.snaps().at(-1)!.tick - 6)).toBeLessThanOrEqual(1);

  const b = setup();
  b.loop.handle({ type: 'speed', speed: 10 });
  b.loop.frame(0);
  b.loop.frame(6 * FRAME_MS);
  expect(Math.abs(b.snaps().at(-1)!.tick - 60)).toBeLessThanOrEqual(1);
});

test('fractional remainder carries over between frames', () => {
  const { loop, snaps } = setup();
  loop.frame(0);
  // each half-frame owes 0.5 tick; 8 of them owe 4 ticks in total
  for (let i = 1; i <= 8; i++) loop.frame((i * FRAME_MS) / 2);
  loop.frame(CONFIG.SNAPSHOT_INTERVAL_MS + 100); // far enough to post; owes extra time
  const ticks = snaps().at(-1)!.tick;
  const owed = (CONFIG.SNAPSHOT_INTERVAL_MS + 100) / FRAME_MS;
  expect(Math.abs(ticks - owed)).toBeLessThanOrEqual(1);
});

test('numeric speed never spends more than the budget and drops the debt', () => {
  let t = 0;
  let cost = 5; // every clock read costs this many ms
  const { loop, snaps } = setup(() => (t += cost));
  loop.handle({ type: 'speed', speed: 50 });
  loop.frame(0);
  loop.frame(10_000); // enormous debt (~30000 ticks)
  const ticks = snaps().at(-1)!.tick;
  expect(ticks).toBeGreaterThan(0);
  expect(ticks).toBeLessThanOrEqual(CONFIG.WORKER_BUDGET_MS / 5 + 1);
  cost = 0; // budget no longer limits: only the owed debt does
  loop.frame(10_000 + 6 * FRAME_MS);
  // 6 normal frames at speed 50 owe ~300 ticks, not the old debt
  expect(Math.abs(snaps().at(-1)!.tick - ticks - 300)).toBeLessThanOrEqual(1);
});

test("'max' steps until the wall-time budget is spent", () => {
  let t = 0;
  const { loop, snaps } = setup(() => (t += 1));
  loop.handle({ type: 'speed', speed: 'max' });
  loop.frame(0);
  const ticks = snaps().at(-1)!.tick;
  expect(ticks).toBeGreaterThan(5);
  expect(ticks).toBeLessThanOrEqual(CONFIG.WORKER_BUDGET_MS + 1);
});

test('snapshots are throttled to the snapshot interval', () => {
  const { loop, msgs } = setup();
  loop.frame(0);
  loop.frame(10);
  loop.frame(20);
  expect(msgs.length).toBe(1);
  loop.frame(CONFIG.SNAPSHOT_INTERVAL_MS);
  expect(msgs.length).toBe(2);
});

test('stats are included only after a new sample', () => {
  const { loop, snaps } = setup();
  loop.handle({ type: 'speed', speed: 50 });
  loop.frame(0);
  expect(snaps()[0].stats).toBeUndefined();
  loop.frame(100); // ~300 ticks owed: one STATS_EVERY boundary
  expect(snaps()[1].tick).toBeGreaterThanOrEqual(CONFIG.STATS_EVERY);
  expect(snaps()[1].stats!.length).toBe(1);
  loop.handle({ type: 'speed', speed: 0 });
  loop.frame(200);
  expect(snaps()[2].stats).toBeUndefined();
});

test('reset clears world and stats, keeps speed, clears selection', () => {
  const { loop, snaps } = setup();
  loop.handle({ type: 'speed', speed: 50 });
  loop.frame(0);
  loop.frame(100);
  expect(snaps().some(s => s.stats)).toBe(true);
  const id = snaps().at(-1)!.fish[0].id;
  loop.handle({ type: 'select', id });
  loop.handle({ type: 'reset', seed: 1 });
  const n = snaps().length;
  loop.frame(140);
  const s = snaps()[n];
  expect(s.tick).toBeGreaterThan(0); // speed 50 kept: stepped after reset
  expect(s.selected).toBeNull();
  expect(s.stats).toEqual([]);

  loop.handle({ type: 'speed', speed: 0 });
  loop.handle({ type: 'reset', seed: 7 });
  loop.frame(300);
  expect(snaps().at(-1)!.tick).toBe(0);
});

test('select chooses a fish', () => {
  const { loop, snaps } = setup();
  loop.handle({ type: 'speed', speed: 0 });
  loop.frame(0);
  const f = snaps().at(-1)!.fish[0];
  loop.handle({ type: 'select', id: f.id });
  loop.frame(1000);
  expect(snaps().at(-1)!.selected!.id).toBe(f.id);
  loop.handle({ type: 'select', id: null });
  loop.frame(2000);
  expect(snaps().at(-1)!.selected).toBeNull();
  loop.handle({ type: 'select', id: f.id });
  loop.frame(3000);
  expect(snaps().at(-1)!.selected!.id).toBe(f.id);
});

test('same seed gives the same world', () => {
  const run = () => {
    const { loop, snaps } = setup();
    loop.handle({ type: 'speed', speed: 10 });
    loop.frame(0);
    loop.frame(FRAME_MS);
    return snaps().at(-1)!.fish.map(f => [f.x, f.y]);
  };
  expect(run()).toEqual(run());
});
