import { genomeSize } from '../neat/genome';
import { CONFIG } from './config';
import { PATTERNS, expressedColor, type Pattern } from './traits';
import type { World } from './world';

export interface StatPoint {
  tick: number;
  population: number;
  males: number;
  females: number;
  eggs: number;
  avgLifespan: number;
  avgChildren: number;
  /** Circular mean of the expressed hue. */
  avgHueM: number;
  avgHueF: number;
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

function circularMean(hues: number[]): number {
  if (hues.length === 0) return 0;
  let s = 0, c = 0;
  for (const h of hues) { s += Math.sin(h * 2 * Math.PI); c += Math.cos(h * 2 * Math.PI); }
  return (((Math.atan2(s, c) / (2 * Math.PI)) % 1) + 1) % 1;
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
      avgHueM: circularMean(hue(males)),
      avgHueF: circularMean(hue(females)),
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
    w.events = {
      births: 0, deaths: { starved: 0, old: 0, eaten: 0 }, lifespansOfDead: [],
      matings: 0, escapes: 0, attacks: 0, foodEaten: 0,
    };

    if (this.history.length >= CONFIG.STATS_MAX) this.merge();
  }

  private merge(): void {
    const out: StatPoint[] = [];
    for (let i = 0; i < this.history.length; i += 2) {
      const a = this.history[i], b = this.history[i + 1];
      if (!b) { out.push(a); break; }
      const m = { ...a };
      for (const k of Object.keys(a) as (keyof StatPoint)[]) {
        if (k === 'tick' || k === 'topPatternM' || k === 'topPatternF') continue;
        (m[k] as number) = ((a[k] as number) + (b[k] as number)) / 2;
      }
      out.push(m);
    }
    this.history = out;
  }
}
