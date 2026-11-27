import { genomeSize } from '../neat/genome';
import { CONFIG } from './config';
import { PATTERNS, expressedColor, type Pattern } from './traits';
import { newEvents, type World } from './world';

export interface StatPoint {
  tick: number;
  population: number;
  males: number;
  females: number;
  eggs: number;
  avgLifespan: number;
  avgChildren: number;
  /** Most common expressed hue: the center of the most populated sector. */
  topHueM: number;
  topHueF: number;
  topPatternM: Pattern;
  topPatternF: Pattern;
  avgSize: number;
  avgSpeed: number;
  avgHidden: number;
  avgConns: number;
  leaderHidden: number;
  leaderConns: number;
  escapeRate: number;
  foodPerFish: number;
  matingsPerFish: number;
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Center of the most populated hue sector; a tie goes to the lowest sector; 0 with no hues. */
export function modeHue(hues: number[]): number {
  if (hues.length === 0) return 0;
  const counts = new Array<number>(CONFIG.HUE_BINS).fill(0);
  // The hue wrap can give exactly 1 (for example, -1e-17 wraps to 1), which is sector 0.
  for (const h of hues) counts[Math.floor(h * CONFIG.HUE_BINS) % CONFIG.HUE_BINS]++;
  return (counts.indexOf(Math.max(...counts)) + 0.5) / CONFIG.HUE_BINS;
}

function topPattern(patterns: Pattern[]): Pattern {
  let best: Pattern = 'solid', bestN = 0;
  for (const p of PATTERNS) {
    const n = patterns.filter(q => q === p).length;
    if (n > bestN) { best = p; bestN = n; }
  }
  return best;
}

export class Stats {
  history: StatPoint[] = [];

  /** Appends one point and resets the world's event counters. */
  sample(w: World): void {
    const fish = w.fish;
    const males = fish.filter(f => f.sex === 'M');
    const females = fish.filter(f => f.sex === 'F');
    const sizes = fish.map(f => genomeSize(f.genome));
    const lead = w.lineage.leader();
    const leadSize = lead ? genomeSize(lead.genome) : null;
    const e = w.events;
    const n = fish.length;
    const hue = (fs: typeof fish) => fs.map(f => expressedColor(f.traits, f.sex).hue);
    const pats = (fs: typeof fish) => fs.map(f => expressedColor(f.traits, f.sex).pattern);

    this.history.push({
      tick: w.tick,
      population: n,
      males: males.length,
      females: females.length,
      eggs: w.eggs.length,
      avgLifespan: mean(e.lifespansOfDead),
      avgChildren: mean(fish.map(f => f.children)),
      topHueM: modeHue(hue(males)),
      topHueF: modeHue(hue(females)),
      topPatternM: topPattern(pats(males)),
      topPatternF: topPattern(pats(females)),
      avgSize: mean(fish.map(f => f.traits.size)),
      avgSpeed: mean(fish.map(f => f.traits.maxSpeed)),
      avgHidden: mean(sizes.map(s => s.hidden)),
      avgConns: mean(sizes.map(s => s.enabledConns)),
      leaderHidden: leadSize?.hidden ?? 0,
      leaderConns: leadSize?.enabledConns ?? 0,
      escapeRate: e.attacks > 0 ? e.escapes / e.attacks : 0,
      foodPerFish: n > 0 ? e.foodEaten / n : 0,
      matingsPerFish: n > 0 ? e.matings / n : 0,
    });
    w.events = newEvents();

    if (this.history.length >= CONFIG.STATS_MAX) this.merge();
  }

  private merge(): void {
    const out: StatPoint[] = [];
    for (let i = 0; i < this.history.length; i += 2) {
      const a = this.history[i], b = this.history[i + 1];
      const m = { ...a };
      for (const k of Object.keys(a) as (keyof StatPoint)[]) {
        // A mode has no counts to merge, so the merged point keeps the earlier one.
        if (k === 'tick' || k === 'topPatternM' || k === 'topPatternF' || k === 'topHueM' || k === 'topHueF') continue;
        (m[k] as number) = ((a[k] as number) + (b[k] as number)) / 2;
      }
      out.push(m);
    }
    this.history = out;
  }
}
