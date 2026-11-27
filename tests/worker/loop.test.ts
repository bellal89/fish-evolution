import { expect, test } from 'vitest';
import type { ArenaSnapshot, FromWorker, Snapshot } from '../../src/protocol';
import { CONFIG } from '../../src/sim/config';
import { World } from '../../src/sim/world';
import { SimLoop, type LoopSave } from '../../src/worker/loop';

const FRAME_MS = 1000 / 60;

function setup(clock: () => number = () => 0, from: number | LoopSave = 1) {
  const msgs: FromWorker[] = [];
  const loop = new SimLoop(from, m => msgs.push(m), clock);
  const snaps = (): Snapshot[] => msgs.flatMap(m => (m.type === 'snapshot' ? [m.snap] : []));
  const arenas = (): ArenaSnapshot[] => msgs.flatMap(m => (m.type === 'arena' ? [m.arena] : []));
  return { loop, msgs, snaps, arenas };
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
  a.loop.frame(1000); // the first frame owes nothing
  a.loop.frame(1000 + 6 * FRAME_MS); // 6 frames of wall time
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
});

test('the main world pauses while the arena is open', () => {
  const { loop, msgs, snaps } = setup();
  loop.handle({ type: 'speed', speed: 10 });
  loop.frame(0);
  loop.frame(100);
  const t0 = snaps().at(-1)!.tick;
  expect(t0).toBeGreaterThan(0);
  loop.handle({ type: 'arenaOpen', seed: 5 });
  const n = msgs.length;
  loop.frame(200);
  loop.frame(300);
  expect(msgs.slice(n).map(m => m.type)).toEqual(['arena', 'arena']);
  loop.handle({ type: 'arenaClose' });
  loop.frame(300);
  expect(msgs.at(-1)!.type).toBe('snapshot');
  expect(snaps().at(-1)!.tick).toBe(t0);
  loop.frame(400);
  expect(snaps().at(-1)!.tick).toBeGreaterThan(t0);
});

test('both arena sides step in lockstep and one message carries both', () => {
  let t = 0;
  const { loop, arenas } = setup(() => (t += 5));
  loop.handle({ type: 'arenaOpen', seed: 5 });
  loop.handle({ type: 'arenaSpeed', speed: 10 });
  for (let i = 0; i < 4; i++) loop.frame(i * 100);
  for (const a of arenas()) expect(a.sides[0].scene.tick).toBe(a.sides[1].scene.tick);
  const tick = arenas().at(-1)!.sides[0].scene.tick;
  expect(tick).toBeGreaterThan(0);
  expect(arenas().at(-1)!.speed).toBe(10);
  loop.handle({ type: 'arenaSpeed', speed: 0 });
  loop.frame(500);
  loop.frame(600);
  expect(arenas().at(-1)!.sides[0].scene.tick).toBe(tick);
});

test('arena defaults to Random when no leader exists', () => {
  const { loop, arenas } = setup();
  loop.handle({ type: 'arenaOpen', seed: 5 });
  loop.frame(0);
  const a = arenas()[0];
  expect(a.choices).toEqual([{ kind: 'random' }, { kind: 'random' }]);
  expect(a.hasLeader).toBe(false);
  expect(a.hasSelected).toBe(false);
});

test('arena right side starts with the leader brain', () => {
  const w = new World(1);
  const [a, b] = w.fish;
  w.lineage.born(999_999, [a.id, b.id], a.genome, a.traits);
  const { loop, arenas } = setup(() => 0, { world: w.save(), history: [] });
  loop.handle({ type: 'arenaOpen', seed: 5 });
  loop.frame(0);
  const s = arenas()[0];
  expect(s.choices[1]).toEqual({ kind: 'leader' });
  expect(s.sides[1].genome).toBe(a.genome);
  expect(s.hasLeader).toBe(true);
});

test('picking the selected fish and a history entry uses their brains', () => {
  const w = new World(1);
  const [f, , owner] = w.fish;
  w.leaderHistory.push({ tick: CONFIG.LEADER_SNAPSHOT_TICKS, living: 3, genome: owner.genome, traits: owner.traits });
  const { loop, arenas } = setup(() => 0, { world: w.save(), history: [] });
  loop.handle({ type: 'select', id: f.id });
  loop.handle({ type: 'arenaOpen', seed: 5 });
  loop.handle({ type: 'arenaBrain', side: 0, choice: { kind: 'selected' } });
  loop.handle({ type: 'arenaBrain', side: 1, choice: { kind: 'history', index: 0 } });
  loop.frame(0);
  const s = arenas()[0];
  expect(s.hasSelected).toBe(true);
  expect(s.choices).toEqual([{ kind: 'selected' }, { kind: 'history', index: 0 }]);
  expect(s.sides[0].genome).toBe(f.genome);
  expect(s.sides[1].genome).toBe(owner.genome);
  expect(s.sides[1].scene.fish[0].color).toEqual(owner.traits.colorM);
  expect(s.history).toEqual([{
    tick: CONFIG.LEADER_SNAPSHOT_TICKS, living: 3, hidden: 0, conns: owner.genome.conns.length,
    colorM: owner.traits.colorM, colorF: owner.traits.colorF,
  }]);
});
