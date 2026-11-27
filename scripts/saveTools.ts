// Opens an exported world in Node. A script can step the world further.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { genomeSize, type Genome } from '../src/neat/genome';
import { decodeSave } from '../src/saveFile';
import { CONFIG } from '../src/sim/config';
import { modeHue } from '../src/sim/stats';
import { SCALAR_KEYS } from '../src/sim/traits';
import { World } from '../src/sim/world';
import { simTime } from '../src/ui/controls';
import type { LoopSave } from '../src/worker/loop';

export function loadSave(path: string): { save: LoopSave; world: World } {
  const save = decodeSave(gunzipSync(readFileSync(path)).toString('utf8'));
  return { save, world: new World(save.world) };
}

const brain = (g: Genome): string => {
  const { hidden, enabledConns } = genomeSize(g);
  return `${hidden} hidden, ${enabledConns} links`;
};

/** A readable summary of a world. */
export function summarize(w: World): string {
  const males = w.fish.filter(f => f.sex === 'M');
  const females = w.fish.filter(f => f.sex === 'F');
  const lines = [
    `tick ${w.tick} (${simTime(w.tick)})${w.extinct ? ', extinct' : ''}`,
    `fish ${w.fish.length}: ${males.length} males, ${females.length} females; eggs ${w.eggs.length}`,
    '',
    'Traits (mean, min-max):',
  ];
  for (const k of SCALAR_KEYS) {
    const v = w.fish.map(f => f.traits[k]);
    const mean = v.reduce((s, x) => s + x, 0) / (v.length || 1);
    lines.push(`  ${k.padEnd(15)} ${mean.toFixed(2)}  ${Math.min(...v).toFixed(2)}-${Math.max(...v).toFixed(2)}`);
  }
  const hue = (fs: typeof w.fish, sex: 'M' | 'F') =>
    Math.round(modeHue(fs.map(f => (sex === 'M' ? f.traits.colorM : f.traits.colorF).hue)) * 360);
  lines.push(`Most common hue: males ${hue(males, 'M')}°, females ${hue(females, 'F')}°`, '', 'Top lineages:');
  for (const r of w.lineage.top(5)) lines.push(`  #${r.id}: ${r.living} living, ${brain(r.genome)}`);
  const lead = w.lineage.leader();
  lines.push(`Leader genome: ${lead ? brain(lead.genome) : 'no leader'}`, '');
  lines.push(`Leader history (every ${simTime(CONFIG.LEADER_SNAPSHOT_TICKS)}):`);
  for (const e of w.leaderHistory) lines.push(`  ${simTime(e.tick).padStart(8)}  ${e.living} living, ${brain(e.genome)}`);
  return lines.join('\n');
}
