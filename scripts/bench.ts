// Mean ms per World.step() with ~200 live fish. Run: npx tsx scripts/bench.ts
// Starts with more fish than that because some die during the warm-up.
import { createMinimalGenome } from '../src/neat/genome';
import { CONFIG } from '../src/sim/config';
import { createFish } from '../src/sim/fish';
import { Rng } from '../src/sim/rng';
import { INPUT_COUNT, OUTPUT_COUNT } from '../src/sim/senses';
import { randomTraits } from '../src/sim/traits';
import { World } from '../src/sim/world';

const START_FISH = 240;
const WARMUP = 200;
const TICKS = 2000;

const w = new World(1);
const rng = new Rng(2);
// Same creation path as the World constructor; the world's private tracker and ids keep genomes compatible.
const tracker = w['tracker'];
const newId = w['newId'];
const waterH = CONFIG.TANK_H - CONFIG.SAND_H;
while (w.fish.length < START_FISH) {
  const traits = randomTraits(rng);
  const genome = createMinimalGenome(INPUT_COUNT, OUTPUT_COUNT, rng, tracker);
  const x = rng.range(traits.size, CONFIG.TANK_W - traits.size);
  const y = rng.range(traits.size, waterH - traits.size);
  const f = createFish(newId(), x, y, w.fish.length % 2 === 0 ? 'M' : 'F', traits, genome, CONFIG.INITIAL_FISH_ENERGY, null);
  f.heading = rng.range(-Math.PI, Math.PI);
  w.fish.push(f);
  w.lineage.born(f.id, null, genome);
}

for (let i = 0; i < WARMUP; i++) w.step();
let fishTicks = 0;
const t0 = performance.now();
for (let i = 0; i < TICKS; i++) {
  w.step();
  fishTicks += w.fish.length;
}
const ms = performance.now() - t0;
console.log(`mean ${(ms / TICKS).toFixed(3)} ms/tick over ${TICKS} ticks, mean fish ${(fishTicks / TICKS).toFixed(0)}, end fish ${w.fish.length}`);
