import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { loadSave, summarize } from '../../scripts/saveTools';
import { packSave } from '../../src/saveFile';
import { CONFIG } from '../../src/sim/config';
import { World } from '../../src/sim/world';
import { simTime } from '../../src/ui/controls';

test('loadSave reads a file written by packSave and the world continues', async () => {
  const w = new World(2);
  for (let i = 0; i < 300; i++) w.step();
  const path = join(mkdtempSync(join(tmpdir(), 'fish-')), 'world.json.gz');
  writeFileSync(path, await packSave({ world: w.save(), history: [] }));
  const { world, save } = loadSave(path);
  expect(world.tick).toBe(w.tick);
  expect(save.history).toEqual([]);
  w.step();
  world.step();
  expect(world.fish.length).toBe(w.fish.length);
  expect(world.fish[0].x).toBe(w.fish[0].x);
});

test('summarize names the main facts', () => {
  const w = new World(1);
  const [a, b] = w.fish;
  w.lineage.born(999_999, [a.id, b.id], a.genome, a.traits);
  w.leaderHistory.push({ tick: CONFIG.LEADER_SNAPSHOT_TICKS * 3, living: 4, genome: a.genome, traits: a.traits });
  const out = summarize(w);
  for (const s of ['tick', 'males', 'Top lineages', 'Leader history', simTime(CONFIG.LEADER_SNAPSHOT_TICKS * 3)]) {
    expect(out).toContain(s);
  }
});
