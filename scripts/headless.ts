// Runs one world without the UI and prints stats. Run: npx tsx scripts/headless.ts [seed] [ticks]
import { CONFIG } from '../src/sim/config';
import { Stats, type StatPoint } from '../src/sim/stats';
import { World } from '../src/sim/world';

const seed = Number(process.argv[2] ?? 1);
const ticks = Number(process.argv[3] ?? 500_000);
const LINE_EVERY = 18_000;
const EDGE = 50_000;

const w = new World(seed);
const stats = new Stats();
const points: StatPoint[] = [];
let window: StatPoint[] = [];
let minPop = Infinity, maxPop = 0;
// Waste age and total age of living fish, summed over samples: the share of age that came from waste.
let wasteSum = 0, ageSum = 0, lineWaste = 0, lineAge = 0;

const mean = (ps: StatPoint[], k: 'escapeRate' | 'foodPerFish' | 'avgHidden') =>
  ps.length ? ps.reduce((s, p) => s + p[k], 0) / ps.length : 0;
const f2 = (x: number) => x.toFixed(2);
const pct = (part: number, all: number) => `${((all > 0 ? part / all : 0) * 100).toFixed(1)}%`;

while (w.tick < ticks && !w.extinct) {
  w.step();
  if (w.tick % CONFIG.STATS_EVERY === 0) {
    stats.sample(w);
    // Pop the point so that the history never fills up and merges points.
    const p = stats.history.pop()!;
    points.push(p);
    window.push(p);
    for (const f of w.fish) { lineWaste += f.wasteAge; lineAge += f.age + f.wasteAge; }
    minPop = Math.min(minPop, p.population);
    maxPop = Math.max(maxPop, p.population);
  }
  if (w.tick % LINE_EVERY === 0) {
    const p = window.at(-1)!;
    console.log(
      `tick ${w.tick} pop ${p.population} M ${p.males} F ${p.females} eggs ${p.eggs}` +
      ` escape ${f2(mean(window, 'escapeRate'))} food ${f2(mean(window, 'foodPerFish'))}` +
      ` hidden ${f2(p.avgHidden)} hueM ${f2(p.topHueM)} hueF ${f2(p.topHueF)}` +
      ` wasteAged ${pct(lineWaste, lineAge)}`,
    );
    window = [];
    wasteSum += lineWaste;
    ageSum += lineAge;
    lineWaste = lineAge = 0;
  }
}

const first = points.filter(p => p.tick <= EDGE);
const last = points.filter(p => p.tick > w.tick - EDGE);
console.log(
  `seed ${seed} ticks ${w.tick} ${w.extinct ? 'EXTINCT' : 'survived'} pop ${w.fish.length} range ${minPop}-${maxPop}` +
  ` wasteAged ${pct(wasteSum + lineWaste, ageSum + lineAge)}` +
  ` | first50k escape ${f2(mean(first, 'escapeRate'))} food ${f2(mean(first, 'foodPerFish'))} hidden ${f2(mean(first, 'avgHidden'))}` +
  ` | last50k escape ${f2(mean(last, 'escapeRate'))} food ${f2(mean(last, 'foodPerFish'))} hidden ${f2(mean(last, 'avgHidden'))}`,
);
