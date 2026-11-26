# Fish Aquarium (NEAT evolution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser 2D aquarium where fish with NEAT brains and color/body genes evolve under a scripted predator, a closed nutrient cycle and sexual selection, with live charts and a fish inspector.

**Architecture:** Pure, deterministic simulation in `src/sim` + `src/neat` (no DOM, fully unit-tested with Vitest in Node). A Web Worker runs the simulation loop and posts snapshots; the main thread renders the canvas, charts and inspector from snapshots and sends control messages back.

**Tech Stack:** TypeScript (strict), Vite, Vitest, Canvas 2D, GitHub Actions → GitHub Pages. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-11-26-fish-aquarium-design.md` (Russian). Read it before starting any task.

## Global Constraints

- Runs entirely in the browser, static files only, deployed to GitHub Pages.
- Simulation code (`src/sim`, `src/neat`) must not import DOM/browser APIs; testable in Node.
- Simulation uses a fixed tick (1 tick = 1/60 sim-second) and a seeded RNG (`Rng`); never `Math.random()` inside `src/sim`/`src/neat`. Same seed → same world.
- Nutrients are conserved: `world.totalNutrients()` is constant (±1e-6 relative) across ticks. Fish energy *is* nutrient.
- All balance numbers live in `src/sim/config.ts` (`CONFIG`); no magic numbers elsewhere.
- Target: 100–200 fish comfortably; speeds x1 / x10 / x50 / max + pause.
- No species in NEAT. No fitness function, no generations: selection is purely natural.
- Two sexes, 50/50 at birth; mating only male + female.
- No external feeding. No auto-respawn: when there are no fish and no eggs, the sim stops with «Популяция вымерла» and a «Начать заново» button.
- UI text in Russian.

## Review Focus

1. Long runs (≥ 50k ticks): no NaN/Infinity in positions, energy or network outputs; nutrient total stays constant → Task 9 `long run stays finite and conserved`.
2. Inspected fish dies or is eaten → inspector shows «Рыба погибла», no crash → Task 12 `selected fish missing yields null`.
3. Fish pushed into a wall or corner stays inside the tank and can turn away → Task 7 `fish is clamped inside tank`.
4. Restart after extinction gives a fresh world and empty charts, not leftovers → Task 11 `reset clears world and stats`.
5. Brains bloat: a larger brain must strictly cost more energy per tick → Task 7 `brain cost grows with size`.

---

## File Structure

```
index.html                     page shell
src/main.ts                    boots worker, wires UI
src/style.css
src/protocol.ts                worker⇄UI message types + Snapshot types
src/sim/config.ts              CONFIG constants
src/sim/rng.ts                 seeded PRNG
src/sim/geom.ts                angle/vector helpers, ray-circle hit
src/sim/spatial.ts             uniform grid for neighbor queries
src/sim/traits.ts              body/color/preference genes, expression, attraction, visibility
src/sim/nutrients.ts           fertilizer grid (diffusion)
src/sim/food.ts                algae cells, plankton, waste particles
src/sim/fish.ts                Fish type, creation, energy costs, movement
src/sim/senses.ts              builds brain input vector
src/sim/predator.ts            PredatorController interface + ScriptedPredator
src/sim/reproduction.ts        mating rules, eggs, hatching
src/sim/lineage.ts             living-descendant counts, leader genome
src/sim/world.ts               World: owns everything, step()
src/sim/stats.ts               periodic metric sampling, downsampling history
src/sim/snapshot.ts            World → Snapshot
src/neat/genome.ts             genes, InnovationTracker, minimal genome
src/neat/mutate.ts             NEAT mutations
src/neat/crossover.ts          NEAT crossover
src/neat/network.ts            genome → feed-forward network
src/worker/sim.worker.ts       loop, speed control, messaging
src/ui/render.ts               aquarium canvas drawing (fish patterns, food, predator, rays)
src/ui/charts.ts               sparkline charts panel
src/ui/brainView.ts            draws a genome graph with activations
src/ui/inspector.ts            selected fish panel + leader brain panel
src/ui/controls.ts             speed buttons, extinction overlay
tests/**/*.test.ts             mirrors src paths
.github/workflows/deploy.yml
```

---

### Task 1: Project scaffold, RNG, geometry

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/main.ts` (placeholder), `src/sim/rng.ts`, `src/sim/geom.ts`, `src/sim/config.ts`
- Test: `tests/sim/rng.test.ts`, `tests/sim/geom.test.ts`

**Interfaces:**
- Produces:
  - `class Rng { constructor(seed: number); next(): number /*[0,1)*/; range(a: number, b: number): number; int(n: number): number /*[0,n)*/; chance(p: number): boolean; normal(): number; pick<T>(arr: T[]): T }` — mulberry32.
  - `wrapAngle(a: number): number` → (-π, π]; `clamp(v, lo, hi)`; `rayCircle(ox, oy, dx, dy, cx, cy, r): number | null` → distance along unit ray to circle, null if miss/behind.
  - `CONFIG` object (`as const`), initially `{ TANK_W: 1600, TANK_H: 900, TICKS_PER_SEC: 60 }`; later tasks append keys.

- [ ] **Step 1:** `git init`; `npm create vite@latest . -- --template vanilla-ts` (keep existing `docs/`, `.idea`); `npm i -D vitest`; add `"test": "vitest run"` script; `.gitignore` adds `node_modules`, `dist`, `.idea`. Set `base: './'` in `vite.config.ts` (Pages subpath). Delete Vite demo files (counter, logo).
- [ ] **Step 2: Write failing tests**

```ts
test('same seed same sequence', () => {
  const a = new Rng(42), b = new Rng(42);
  for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
});
test('next in [0,1)', () => { const r = new Rng(1); for (let i=0;i<10000;i++){ const v=r.next(); expect(v>=0 && v<1).toBe(true);} });
test('int in range', () => { const r = new Rng(3); for (let i=0;i<1000;i++){ const v=r.int(5); expect(Number.isInteger(v) && v>=0 && v<5).toBe(true);} });
test('wrapAngle', () => { expect(wrapAngle(3*Math.PI)).toBeCloseTo(Math.PI); expect(wrapAngle(-Math.PI/2)).toBeCloseTo(-Math.PI/2); });
test('rayCircle hit and miss', () => {
  expect(rayCircle(0,0,1,0, 10,0,2)).toBeCloseTo(8);
  expect(rayCircle(0,0,1,0, -10,0,2)).toBeNull();
  expect(rayCircle(0,0,1,0, 10,5,2)).toBeNull();
});
```

- [ ] **Step 3:** Run `npm test` → FAIL (modules missing).
- [ ] **Step 4:** Implement `rng.ts`, `geom.ts`, `config.ts`.
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → succeeds.
- [ ] **Step 6:** Commit `chore: scaffold vite+ts, rng, geometry`.

---

### Task 2: NEAT genome and network

**Files:**
- Create: `src/neat/genome.ts`, `src/neat/network.ts`
- Test: `tests/neat/genome.test.ts`, `tests/neat/network.test.ts`

**Interfaces:**
- Produces:
  - `type NodeKind = 'input' | 'bias' | 'hidden' | 'output'`
  - `interface NodeGene { id: number; kind: NodeKind }`
  - `interface ConnGene { innov: number; from: number; to: number; weight: number; enabled: boolean }`
  - `interface Genome { nodes: NodeGene[]; conns: ConnGene[] }` — node ids: inputs `0..nIn-1`, bias `nIn`, outputs `nIn+1..nIn+nOut`, hidden ids allocated by tracker.
  - `class InnovationTracker { constructor(firstNodeId: number); connInnov(from: number, to: number): number; splitNode(connInnov: number): number }` — same structural mutation anywhere in the run gets the same number (map keyed by `from-to` / by split conn innov).
  - `createMinimalGenome(nIn: number, nOut: number, rng: Rng, tracker: InnovationTracker): Genome` — every input+bias connected to every output, weights `rng.range(-1,1)`.
  - `genomeSize(g: Genome): { hidden: number; enabledConns: number }`
  - `class Network { constructor(g: Genome); activate(inputs: Float32Array): Float32Array; readonly activations: Map<number, number> }` — feed-forward, topological order computed once; bias node = 1; hidden and output activation `tanh`; disabled conns ignored; output array length nOut.

- [ ] **Step 1: Write failing tests**

```ts
test('minimal genome is fully connected', () => {
  const t = new InnovationTracker(10);
  const g = createMinimalGenome(3, 2, new Rng(1), t);
  expect(g.nodes.filter(n => n.kind === 'output')).toHaveLength(2);
  expect(g.conns).toHaveLength((3 + 1) * 2);
});
test('same structural mutation gets same innovation', () => {
  const t = new InnovationTracker(10);
  expect(t.connInnov(1, 5)).toBe(t.connInnov(1, 5));
  expect(t.connInnov(1, 5)).not.toBe(t.connInnov(2, 5));
  expect(t.splitNode(7)).toBe(t.splitNode(7));
});
test('network computes tanh of weighted sum', () => {
  const g: Genome = { nodes: [{id:0,kind:'input'},{id:1,kind:'bias'},{id:2,kind:'output'}],
    conns: [{innov:0,from:0,to:2,weight:0.5,enabled:true},{innov:1,from:1,to:2,weight:0.25,enabled:true}] };
  expect(new Network(g).activate(new Float32Array([2]))[0]).toBeCloseTo(Math.tanh(1.25));
});
test('disabled connection ignored', () => { /* same genome, conn 0 disabled → tanh(0.25) */ });
test('hidden node chain', () => { /* in→h (w=1), h→out (w=1), input 0.5 → tanh(tanh(0.5)) */ });
```

- [ ] **Step 2:** `npx vitest run tests/neat` → FAIL.
- [ ] **Step 3:** Implement. Topological sort via Kahn over enabled conns; nodes unreachable are skipped (output 0).
- [ ] **Step 4:** `npx vitest run tests/neat` → PASS.
- [ ] **Step 5:** Commit `feat(neat): genome, innovation tracker, network`.

---

### Task 3: NEAT mutation and crossover

**Files:**
- Create: `src/neat/mutate.ts`, `src/neat/crossover.ts`; append to `src/sim/config.ts`
- Test: `tests/neat/mutate.test.ts`, `tests/neat/crossover.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `Rng`.
- Produces:
  - `mutateGenome(g: Genome, rng: Rng, t: InnovationTracker): Genome` — returns new genome (no shared mutable conn objects). Applies with CONFIG probabilities: `P_WEIGHT_PERTURB 0.8` (each conn ± `normal()*0.3`, 10% of those fully reset to `range(-1,1)`), `P_ADD_CONN 0.08`, `P_ADD_NODE 0.03`, `P_TOGGLE 0.02`. Weights clamped to ±4.
  - `addConnection` never creates a cycle, never targets input/bias, never duplicates an existing from→to.
  - `addNode` disables the split conn, adds `from→new` weight 1 and `new→to` with the old weight.
  - `crossover(fitter: Genome, other: Genome, rng: Rng): Genome` — matching innovs pick randomly; disjoint/excess from `fitter` only; a gene disabled in either parent stays disabled with prob 0.75; nodes = all nodes referenced by child conns plus all input/bias/output nodes.

- [ ] **Step 1: Write failing tests**

```ts
test('addNode keeps old conn disabled and adds two', () => { /* force via exported addNode(g,rng,t) */ });
test('mutations never create cycles', () => {
  const t = new InnovationTracker(20); const rng = new Rng(5);
  let g = createMinimalGenome(4, 2, rng, t);
  for (let i = 0; i < 2000; i++) g = mutateGenome(g, rng, t);
  expect(() => new Network(g).activate(new Float32Array(4))).not.toThrow();
  expect(hasCycle(g)).toBe(false);          // helper in test file
});
test('mutate does not modify parent', () => { /* deep-equal parent before/after */ });
test('crossover child only has fitter disjoint genes', () => {
  // fitter has extra innov 99, other has extra innov 77 → child has 99, not 77
});
test('crossover child network runs', () => { /* two mutated genomes → child activates */ });
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(neat): mutation and crossover`.

---

### Task 4: Traits — body, sex-dependent color, preference, visibility

**Files:**
- Create: `src/sim/traits.ts`; append CONFIG
- Test: `tests/sim/traits.test.ts`

**Interfaces:**
- Produces:
  - `type Sex = 'M' | 'F'`
  - `type Pattern = 'solid' | 'stripes' | 'spots' | 'bands'`
  - `interface ColorGenes { hue: number /*0..1*/; brightness: number /*0..1, saturation+lightness contrast*/; pattern: Pattern; patternCount: number /*1..6 int*/; hue2: number }`
  - `interface Traits { size: number; maxSpeed: number; viewAngle: number; viewRange: number; mateThreshold: number /*energy*/; investFraction: number /*0.1..0.6*/; lifespanTicks: number; colorM: ColorGenes; colorF: ColorGenes; prefHue: number; prefPattern: Pattern; choosiness: number /*0..1*/ }`
  - CONFIG ranges `TRAIT_RANGES` for each numeric trait (min,max); mutation `TRAIT_MUT_SD 0.05` (fraction of range), `P_PATTERN_MUT 0.03`.
  - `randomTraits(rng): Traits`, `crossTraits(a, b, rng): Traits` (each field from random parent), `mutateTraits(t, rng): Traits` (clamped to ranges; hues wrap).
  - `expressedColor(t: Traits, sex: Sex): ColorGenes`
  - `attraction(chooser: Traits, c: ColorGenes): number` → `0.6*(1 - 2*hueDist(c.hue, prefHue)) + 0.4*(c.pattern===prefPattern ? 1 : 0)` scaled by `(0.5 + 0.5*c.brightness)`; in [0,1].
  - `accepts(chooser: Traits, c: ColorGenes): boolean` → `attraction >= chooser.choosiness * CONFIG.CHOOSY_MAX` (`CHOOSY_MAX 0.8`).
  - `visibility(c: ColorGenes, bgHue: number, bgBrightness: number): number` in `[CONFIG.MIN_VISIBILITY=0.25, 1]` — grows with hue distance and brightness difference from background, `+0.15` if pattern ≠ solid.

- [ ] **Step 1: Write failing tests**

```ts
test('males and females express own color', () => { const t = randomTraits(new Rng(1)); expect(expressedColor(t,'M')).toBe(t.colorM); expect(expressedColor(t,'F')).toBe(t.colorF); });
test('mutation stays in range over many rounds', () => { /* 1000 rounds, every numeric field within TRAIT_RANGES, hues in [0,1) */ });
test('perfect match is attractive, opposite hue is not', () => {
  const t = { ...randomTraits(new Rng(2)), prefHue: 0.3, prefPattern: 'stripes' as const, choosiness: 1 };
  expect(accepts(t, { hue: 0.3, brightness: 1, pattern: 'stripes', patternCount: 3, hue2: 0 })).toBe(true);
  expect(accepts(t, { hue: 0.8, brightness: 1, pattern: 'solid', patternCount: 1, hue2: 0 })).toBe(false);
});
test('non-choosy accepts anyone', () => { /* choosiness 0 → accepts anything */ });
test('camouflaged color is less visible', () => {
  const bg = { hue: 0.55, b: 0.3 };
  const camo = { hue: 0.55, brightness: 0.3, pattern: 'solid' as const, patternCount: 1, hue2: 0.55 };
  const loud = { hue: 0.05, brightness: 1, pattern: 'stripes' as const, patternCount: 4, hue2: 0.6 };
  expect(visibility(camo, bg.hue, bg.b)).toBeLessThan(visibility(loud, bg.hue, bg.b));
  expect(visibility(camo, bg.hue, bg.b)).toBeGreaterThanOrEqual(0.25);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(sim): traits, sex-dependent color, mate preference, visibility`.

---

### Task 5: Nutrient field, food and waste

**Files:**
- Create: `src/sim/nutrients.ts`, `src/sim/food.ts`, `src/sim/spatial.ts`; append CONFIG
- Test: `tests/sim/nutrients.test.ts`, `tests/sim/food.test.ts`, `tests/sim/spatial.test.ts`

**Interfaces:**
- Produces:
  - `class FertilizerField { constructor(cols: number /*64*/, rows: number /*36*/, w: number, h: number); add(x, y, amt): void; take(x, y, amt): number /*actually taken ≤ available*/; at(x, y): number; diffuse(rate: number): void /*conservative*/; total(): number; readonly cells: Float32Array }`
  - `interface AlgaeCell { x: number; y: number; biomass: number }` — placed along the bottom and on rock tops at world creation (`ALGAE_CELLS 80`, rocks `ROCK_COUNT 4`).
  - `interface Plankton { id: number; x: number; y: number; vx: number; vy: number; amount: number }`
  - `interface Waste { x: number; y: number; vy: number; amount: number }` — sinks at `WASTE_SINK_SPEED`; dissolves into fertilizer at its cell gradually (`WASTE_DISSOLVE_RATE` fraction/tick) and fully on reaching bottom after `WASTE_BOTTOM_TICKS`.
  - `class FoodSystem { algae: AlgaeCell[]; plankton: Plankton[]; waste: Waste[]; step(field: FertilizerField, rng: Rng): void; total(): number; eatAlgae(cell: AlgaeCell, amt: number): number; removePlankton(p: Plankton): number; addWaste(x, y, amt): void }`
    - Algae growth per tick: `take(cell, min(fert*ALGAE_GROWTH, ALGAE_MAX - biomass))`.
    - Plankton spawn: each tick for `PLANKTON_TRIES 3` random cells in the water column, if `fert > PLANKTON_FERT_MIN`, take `PLANKTON_AMOUNT` and spawn; slow random drift, bounce inside tank.
  - `class SpatialGrid<T extends { x: number; y: number }> { constructor(cell: number, w: number, h: number); clear(); insert(item: T); query(x, y, r): T[] }`

- [ ] **Step 1: Write failing tests**

```ts
test('diffusion conserves total', () => { const f = new FertilizerField(8,4,80,40); f.add(5,5,100); for (let i=0;i<500;i++) f.diffuse(0.2); expect(f.total()).toBeCloseTo(100, 6); });
test('take never exceeds available', () => { /* add 1, take 5 → returns 1, cell 0 */ });
test('food step conserves field+food total', () => {
  const f = new FertilizerField(64,36,1600,900); const rng = new Rng(1);
  for (let i=0;i<64*36;i++) f.cells[i]=1;
  const food = new FoodSystem(rng, 1600, 900); food.addWaste(100,100,50);
  const before = f.total() + food.total();
  for (let i=0;i<3000;i++){ food.step(f, rng); f.diffuse(0.1); }
  expect(f.total() + food.total()).toBeCloseTo(before, 4);
  expect(food.plankton.length).toBeGreaterThan(0);
});
test('algae grows faster with more fertilizer', () => { /* two worlds, rich vs poor field, compare biomass after 600 ticks */ });
test('spatial grid query returns only nearby', () => { /* insert at (10,10),(500,500); query(12,12,20) → only first */ });
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(sim): fertilizer field, algae, plankton, waste`.

---

### Task 6: Senses

**Files:**
- Create: `src/sim/senses.ts`; append CONFIG (`RAY_COUNT 5`, `LATERAL_RADIUS 120`, `LATERAL_MIN_SPEED 1.5`, `SMELL_RADIUS 250`, `ALARM_RADIUS 200`, `ALARM_TICKS 180`)
- Test: `tests/sim/senses.test.ts`

**Interfaces:**
- Consumes: `Traits`, `visibility`, `rayCircle`, `SpatialGrid`.
- Produces:
  - `INPUT_COUNT = 26`, `OUTPUT_COUNT = 3`, and `INPUT_LABELS: string[]` (Russian short labels for the brain view).
  - Input layout (each in [-1,1] or [0,1]):
    - `0..14` — per ray i (5 rays spread evenly across `viewAngle`, length `viewRange`): `[foodNear, fishNear, predatorNear]`, `near = 1 - dist/viewRange`, 0 if nothing. Fish/predator target effective hit range scaled by its `visibility`.
    - `15` — attraction (`attraction(self, otherColor)`) of the nearest opposite-sex fish hit by any ray, else 0.
    - `16..19` — lateral line: strength of fast movers (speed > `LATERAL_MIN_SPEED`, fish or predator) within `LATERAL_RADIUS` in body-frame quadrants front/back/left/right, `sum(speed/maxSpeed * (1-d/R))` clamped to 1.
    - `20` — food smell gradient: `(smellLeft - smellRight)/(smellLeft + smellRight + ε)` where smell = Σ food amount / d² sampled at points left/right of head within `SMELL_RADIUS`.
    - `21` — alarm: 1 if a fish was eaten within `ALARM_RADIUS` in the last `ALARM_TICKS`, decaying linearly.
    - `22` — wall closeness along heading (`1 - d/viewRange`, 0 if beyond).
    - `23` energy / `mateThreshold` clamped to 1; `24` age / lifespan; `25` ready-to-mate (0/1) = mature && energy ≥ mateThreshold && mateCooldown == 0.
  - `interface SenseContext { food: SpatialGrid<{x,y,amount}>; fish: SpatialGrid<Fish>; predators: Predator[]; alarms: {x,y,tick}[]; tick: number; bg(x,y): {hue,brightness}; tankW; tankH }`
  - `sense(f: Fish, ctx: SenseContext, out: Float32Array): void` (Fish type from Task 7 — define a minimal `SensingFish` interface `{x,y,heading,speed,energy,age,sex,traits,ready}` here; Task 7's `Fish` satisfies it.)

- [ ] **Step 1: Write failing tests** (build small contexts by hand)

```ts
test('food straight ahead lights middle ray food channel', () => { /* fish at (100,450) heading 0, food at (200,450) → out[2*3+0] > 0.5, other rays food = 0 */ });
test('predator behind is invisible to eyes but felt by lateral line', () => { /* predator at (60,450) moving speed 3 → rays predator=0, back quadrant out[17] > 0 */ });
test('camouflaged fish seen at shorter range than loud fish', () => { /* same distance near edge of range: loud seen, camo not */ });
test('smell gradient points to food side', () => { /* food above-left of heading → out[20] > 0 */ });
test('all inputs finite and within [-1,1]', () => { /* random context, 200 fish, check */ });
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(sim): fish senses`.

---

### Task 7: Fish — movement, eating, energy, death

**Files:**
- Create: `src/sim/fish.ts`; append CONFIG
- Test: `tests/sim/fish.test.ts`

**Interfaces:**
- Consumes: `Genome`, `Network`, `Traits`, `Sex`, `genomeSize`.
- Produces:
  - `interface Fish { id: number; x: number; y: number; heading: number; speed: number; energy: number; gut: number /*spent energy waiting to be excreted*/; age: number; sex: Sex; traits: Traits; genome: Genome; brain: Network; parents: [number, number] | null; children: number; mateCooldown: number; lastOutputs: Float32Array; lastInputs: Float32Array; eaten: number /*total food eaten, for stats*/ }`
  - `createFish(id, x, y, sex, traits, genome, energy, parents): Fish`
  - `tickCost(f: Fish): number` = `BASE_COST * size + MOVE_COST * size * speed² + BRAIN_NODE_COST * hidden + BRAIN_CONN_COST * enabledConns`.
  - `applyOutputs(f: Fish, out: Float32Array, tankW, tankH): void` — `heading += out[0] * TURN_RATE`; `speed = ((out[1]+1)/2) * traits.maxSpeed`; move; clamp position to `[size, W-size]×[size, H-size]`; on wall hit reflect heading component so fish can leave.
  - `payCost(f: Fish): void` — moves `min(cost, energy)` from `energy` to `gut`.
  - `excrete(f: Fish): number` — when `gut >= EXCRETE_AMOUNT` returns gut and zeros it (World turns it into Waste).
  - `isDead(f): 'starved' | 'old' | null`.
  - `isMature(f)` = `age >= MATURITY_TICKS`.

- [ ] **Step 1: Write failing tests**

```ts
test('brain cost grows with size', () => { /* same fish, genome with +3 hidden +6 conns → tickCost strictly higher */ });
test('faster fish pays more', () => {});
test('payCost moves energy into gut, total unchanged', () => { const f = mk(); const t = f.energy + f.gut; payCost(f); expect(f.energy + f.gut).toBeCloseTo(t); });
test('fish is clamped inside tank', () => { /* at (1599,450) heading 0 full thrust 100 ticks → x <= 1600 - size; heading eventually points away when turning */ });
test('starves at zero energy, dies of old age', () => {});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(sim): fish body, movement and energy`.

---

### Task 8: Predator, reproduction, lineage

**Files:**
- Create: `src/sim/predator.ts`, `src/sim/reproduction.ts`, `src/sim/lineage.ts`; append CONFIG
- Test: `tests/sim/predator.test.ts`, `tests/sim/reproduction.test.ts`, `tests/sim/lineage.test.ts`

**Interfaces:**
- Produces:
  - `interface Predator { x; y; heading; speed; stamina: number; satiety: number /*ticks*/; gut: number; state: 'patrol' | 'chase' | 'rest'; targetId: number | null }`
  - `interface PredatorAction { turn: number /*-1..1*/; thrust: number /*0..1*/ }`
  - `interface PredatorController { decide(p: Predator, view: PredatorView, rng: Rng): PredatorAction }` with `PredatorView = { fish: SpatialGrid<Fish>; eggs: Egg[]; bg(x,y); tankW; tankH }` — this seam is where a NEAT predator plugs in later.
  - `class ScriptedPredator implements PredatorController` — patrol: wander at `PRED_PATROL_SPEED`; spots fish in `PRED_VIEW_ANGLE`/`PRED_VIEW_RANGE` with range scaled by `visibility(expressedColor)`; skip detection while `satiety > 0` unless fish within `PRED_LAZY_RANGE`; chase at `PRED_DASH_SPEED` draining stamina; rest when stamina 0 until refilled. Eats eggs opportunistically when touching.
  - `stepPredator(p: Predator, a: PredatorAction, tankW, tankH): void`
  - `interface Egg { id; x; y; energy; hatchAt: number /*tick*/; genome: Genome; traits: Traits; sex: Sex; parents: [number, number] }`
  - `canMate(a: Fish, b: Fish): boolean` — opposite sex, both mature, `mateCooldown == 0`, `energy >= traits.mateThreshold`, `lastOutputs[2] > 0`, mutual `accepts(x.traits, expressedColor(y.traits, y.sex))`, touching (`dist < a.size + b.size`).
  - `mate(a, b, rng, tracker, tick): Egg[]` — each parent gives `energy * investFraction`; clutch `n = clamp(floor(total / EGG_MIN_ENERGY), 1, MAX_CLUTCH=4)`; energy split equally; per egg: genome = `mutateGenome(crossover(fitter, other))` (fitter = higher energy before paying), traits = `mutateTraits(crossTraits)`, sex `rng.chance(0.5)`; sets both `mateCooldown = MATE_COOLDOWN`, increments `children`.
  - `class Lineage { born(id, parents: [number,number] | null, genome: Genome): void; died(id): void; alive(id): number /*living descendants*/; leader(): { id: number; genome: Genome; living: number } | null }` — on birth increments living-descendant count of ancestors up to `LINEAGE_DEPTH 10` generations (deduplicated); on death decrements; prunes records that are dead with 0 living descendants.

- [ ] **Step 1: Write failing tests**

```ts
test('same-sex pair cannot mate', () => {});
test('immature or low-energy fish cannot mate', () => {});
test('choosy fish rejects unattractive partner', () => {});
test('mating conserves energy', () => { const before = a.energy + b.energy; const eggs = mate(a,b,rng,t,0); expect(a.energy + b.energy + sum(eggs.map(e=>e.energy))).toBeCloseTo(before); });
test('clutch size between 1 and 4', () => {});
test('predator chases visible fish and rests after stamina runs out', () => {});
test('sated predator ignores distant fish', () => {});
test('lineage leader is ancestor with most living descendants', () => {
  // A,B → C,D ; C,E → F. alive: C,D,E,F (A,B dead) → leader A or B with 3 living (C,D,F)
});
test('lineage prunes dead branches', () => {});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(sim): scripted predator, reproduction, lineage`.

---

### Task 9: World — the full tick and conservation

**Files:**
- Create: `src/sim/world.ts`; append CONFIG (`INITIAL_FISH 60`, `TOTAL_NUTRIENTS` chosen so the tank supports ~100–200 fish)
- Test: `tests/sim/world.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces:
  - `class World { constructor(seed: number); tick: number; fish: Fish[]; eggs: Egg[]; predators: Predator[]; food: FoodSystem; field: FertilizerField; lineage: Lineage; events: WorldEvents; extinct: boolean; step(): void; totalNutrients(): number; bg(x, y): { hue: number; brightness: number } }`
  - `interface WorldEvents { births: number; deaths: { starved: number; old: number; eaten: number }; lifespansOfDead: number[]; matings: number; escapes: number; attacks: number; foodEaten: number }` — counters reset by `Stats` when sampled.
  - Initial world: fertilizer evenly holds `TOTAL_NUTRIENTS − fish energy`; `INITIAL_FISH` fish with `randomTraits`, minimal genomes, alternating sex, random positions; 1 predator.
  - `step()` order: rebuild spatial grids → for each fish `sense`→`brain.activate`→`applyOutputs`→eat (touching algae: `eatAlgae(min(BITE, ...))`; plankton/egg whole) → `payCost` → `excrete` to waste → mating pairs (each fish mates at most once per tick) → predator decide/step/eat (fish energy → predator gut; record alarm; `escapes++` when a chased fish's chase ends without a kill) → predator excretes gut → eggs hatch → deaths (starved/old: energy+gut → `Waste` at position as a corpse) → `food.step` → `field.diffuse` → `tick++` → `extinct = fish.length === 0 && eggs.length === 0`.
  - `step()` is a no-op when `extinct`.
  - `totalNutrients()` = field + food + Σ fish (energy+gut) + Σ eggs + Σ predator gut.

- [ ] **Step 1: Write failing tests**

```ts
test('same seed → identical world after 2000 ticks', () => { const a = new World(7), b = new World(7); for (let i=0;i<2000;i++){a.step(); b.step();} expect(a.fish.map(f=>[f.x,f.y,f.energy])).toEqual(b.fish.map(f=>[f.x,f.y,f.energy])); });
test('nutrients conserved every tick', () => { const w = new World(1); const t0 = w.totalNutrients(); for (let i=0;i<5000;i++){ w.step(); expect(Math.abs(w.totalNutrients()-t0)/t0).toBeLessThan(1e-6);} });
test('long run stays finite and conserved', () => { /* 50_000 ticks (or until extinct); every fish x,y,energy finite; brain outputs finite; conservation */ }, 120_000);
test('extinct world stops', () => { const w = new World(1); w.fish = []; w.eggs = []; w.step(); expect(w.extinct).toBe(true); const t = w.tick; w.step(); expect(w.tick).toBe(t); });
test('births happen in a normal run', () => { /* within 30_000 ticks events total births > 0 */ });
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. If conservation fails, find the leak; do not loosen the tolerance.
- [ ] **Step 5:** Commit `feat(sim): world step with closed nutrient cycle`.

---

### Task 10: Stats and snapshots

**Files:**
- Create: `src/sim/stats.ts`, `src/sim/snapshot.ts`, `src/protocol.ts`
- Test: `tests/sim/stats.test.ts`, `tests/sim/snapshot.test.ts`

**Interfaces:**
- Produces:
  - `interface StatPoint { tick: number; population: number; males: number; females: number; eggs: number; avgLifespan: number; avgChildren: number; avgHueM: number; avgHueF: number /*circular mean*/; topPatternM: Pattern; topPatternF: Pattern; avgSize: number; avgSpeed: number; avgHidden: number; avgConns: number; leaderHidden: number; leaderConns: number; escapeRate: number; foodPerFish: number; matingsPerFish: number }`
  - `class Stats { history: StatPoint[]; sample(w: World): void /*every STATS_EVERY=300 ticks, resets w.events*/; }` — when history reaches `STATS_MAX 600`, merge adjacent pairs (keeps the full run at half resolution).
  - `protocol.ts`:
    - `interface FishView { id; x; y; heading; size; sex; color: ColorGenes }`, `PredatorSnap { x; y; heading; state }`, `FoodView { algae: {x,y,biomass}[]; plankton: {x,y}[]; waste: {x,y}[]; eggs: {x,y}[] }`
    - `interface SelectedView { fish: Fish-like plain object (id, sex, age, energy, children, traits, genome, inputs: number[], outputs: number[], activations: [number, number][]) }`
    - `interface Snapshot { tick; extinct: boolean; fish: FishView[]; predators: PredatorSnap[]; food: FoodView; selected: SelectedView | null; leader: { genome: Genome; living: number } | null; stats?: StatPoint[] /*only when changed*/ }`
    - `type ToWorker = { type: 'speed'; speed: 0 | 1 | 10 | 50 | 'max' } | { type: 'select'; id: number | null } | { type: 'selectAt'; x: number; y: number } | { type: 'reset'; seed?: number }`
    - `type FromWorker = { type: 'snapshot'; snap: Snapshot }`
  - `makeSnapshot(w: World, stats: Stats, selectedId: number | null, includeStats: boolean): Snapshot` — plain cloneable data only (no class instances).
  - `fishAt(w: World, x, y): number | null` — nearest fish within 20 px.

- [ ] **Step 1: Write failing tests**

```ts
test('history downsamples instead of growing forever', () => { /* sample 2000 times → length <= 600, first tick preserved, ticks increasing */ });
test('average hue is circular', () => { /* hues 0.95 and 0.05 → avg ≈ 0 (or 1), not 0.5 */ });
test('snapshot is structured-cloneable', () => { expect(() => structuredClone(makeSnapshot(w, s, w.fish[0].id, true))).not.toThrow(); });
test('selected fish missing yields null', () => { expect(makeSnapshot(w, s, 999999, false).selected).toBeNull(); });
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(sim): stats history and snapshots`.

---

### Task 11: Worker loop

**Files:**
- Create: `src/worker/sim.worker.ts`, `src/worker/loop.ts`
- Test: `tests/worker/loop.test.ts`

**Interfaces:**
- Consumes: `World`, `Stats`, `makeSnapshot`, `fishAt`, `ToWorker`, `FromWorker`.
- Produces:
  - `class SimLoop { constructor(seed: number, post: (m: FromWorker) => void); handle(msg: ToWorker): void; frame(nowMs: number): void }` — pure-ish class so it is testable without a real Worker.
    - Speeds: ticks per 1/60 s of wall time = `speed`; `'max'` = run ticks until 25 ms of wall time spent per frame.
    - `frame` posts a snapshot at most every 33 ms of wall time; includes `stats` only when a new point was sampled.
    - `reset` builds a new `World` and new `Stats`, keeps speed, clears selection.
    - When `world.extinct`, keeps posting snapshots (so UI shows the overlay) but does not step.
  - `sim.worker.ts` — wires `SimLoop` to `self.onmessage`/`postMessage`; drives `frame` with `setTimeout(…, 16)` (not rAF, so it runs in background tabs).

- [ ] **Step 1: Write failing tests**

```ts
test('speed 0 does not advance', () => {});
test('speed 10 advances ~10 ticks per frame', () => {});
test('reset clears world and stats', () => { /* run, sample stats, reset → tick 0, stats.history empty, selection null */ });
test('selectAt selects nearest fish', () => {});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(worker): simulation loop`.

---

### Task 12: Aquarium rendering and controls

**Files:**
- Create: `src/ui/render.ts`, `src/ui/controls.ts`, `src/style.css`; modify `index.html`, `src/main.ts`
- Test: manual (browser) — record result in commit message.

**Interfaces:**
- Consumes: `Snapshot`, `ToWorker`.
- Produces:
  - `drawAquarium(ctx: CanvasRenderingContext2D, snap: Snapshot, view: { scale: number; offsetX: number; offsetY: number; follow: number | null }): void` — water gradient + bottom + rocks matching `World.bg` colors (export background constants from `config.ts` so both sides agree); algae as green tufts sized by biomass; plankton dots; waste brown specks; eggs small pale circles; fish as oriented ellipse + tail, body `hue/brightness`, pattern drawn with clip (stripes, spots, bands, `patternCount`, `hue2`), males with slightly larger tail fin; predator larger, dark, red tint when chasing; for the selected fish: vision rays and a ring.
  - `screenToWorld(view, px, py): {x,y}`
  - `mountControls(root: HTMLElement, send: (m: ToWorker) => void): { update(snap: Snapshot): void }` — buttons ⏸ ▶ x1 x10 x50 «макс», tick/sim-time display, population; extinction overlay «Популяция вымерла» + «Начать заново» (sends `reset`).
  - `main.ts`: create worker (`new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' })`), keep latest snapshot, draw on `requestAnimationFrame`, click on canvas → `selectAt`, Esc → `select null`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npm run dev`, open the page: fish swim, algae and plankton visible, predator chases, speed buttons change pace, clicking a fish shows its rays, x50 stays smooth.
- [ ] **Step 3:** Force extinction (temporarily `INITIAL_FISH: 2` in dev, revert after) → overlay appears, «Начать заново» restarts.
- [ ] **Step 4:** `npm run build` → succeeds. Commit `feat(ui): aquarium rendering and controls`.

---

### Task 13: Charts, inspector, brain view

**Files:**
- Create: `src/ui/charts.ts`, `src/ui/brainView.ts`, `src/ui/inspector.ts`; modify `src/main.ts`, `index.html`
- Test: `tests/ui/brainLayout.test.ts` (layout is pure), rest manual

**Interfaces:**
- Consumes: `StatPoint`, `Snapshot.selected`, `Snapshot.leader`, `INPUT_LABELS`.
- Produces:
  - `mountCharts(root: HTMLElement): { update(history: StatPoint[]): void }` — sparkline rows (canvas each, last value as text): Популяция (+ самцы/самки lines), Икра, Ср. жизнь, Потомство, Тон самцов / самок (row of colored blocks), Частый узор ♂/♀ (text + mini icon), Размер, Скорость, Мозг: нейроны/связи (avg and leader), Побеги %, Еда на рыбу, Спаривания на рыбу.
  - `layoutBrain(g: Genome): Map<number, { x: number; y: number }>` — inputs left column, outputs right column, hidden nodes placed by longest-path depth from inputs, normalized to [0,1].
  - `drawBrain(ctx, g: Genome, activations?: Map<number, number>, labels?: string[]): void` — edges colored by weight sign, width by |weight|, disabled edges hidden; nodes filled by activation.
  - `mountInspector(root: HTMLElement, send): { update(snap: Snapshot): void }` — tabs «Рыба» / «Мозг-лидер». Fish tab: sex, age (sim-seconds), energy bar, children, body genes, color swatch for both color sets (expressed one highlighted), preferences, live brain. If a fish was selected and `snap.selected` is null → «Рыба погибла». Leader tab: leader brain + living descendants count + avg/leader brain-size sparkline.

- [ ] **Step 1: Write failing test**

```ts
test('layout puts inputs left, outputs right, hidden between by depth', () => {
  // in0 → h(5) → out(3); in0 → out(3)
  const pos = layoutBrain(g);
  expect(pos.get(0)!.x).toBe(0); expect(pos.get(3)!.x).toBe(1);
  expect(pos.get(5)!.x).toBeGreaterThan(0); expect(pos.get(5)!.x).toBeLessThan(1);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement layout, then UI. **Step 4:** Test → PASS.
- [ ] **Step 5:** Manual: at x50 for ~10 min charts move; click a fish → brain nodes flicker live; follow the fish until it dies → «Рыба погибла»; leader tab shows a graph.
- [ ] **Step 6:** Commit `feat(ui): charts, inspector, brain view`.

---

### Task 14: Balance pass and GitHub Pages deploy

**Files:**
- Modify: `src/sim/config.ts`
- Create: `scripts/headless.ts` (run with `npx tsx scripts/headless.ts [seed] [ticks]`), `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `World`, `Stats`.
- Produces: `scripts/headless.ts` prints a StatPoint line every 18 000 ticks (5 sim-min): population, sexes, escapeRate, foodPerFish, avgHidden, avgHueM/F.

- [ ] **Step 1:** Run headless for 3 seeds × 500k ticks. Tune `CONFIG` until: population survives in ≥ 2 of 3 seeds and stays roughly in 40–250; `escapeRate` and `foodPerFish` trend upward vs the first 50k ticks; `avgHidden` does not grow without bound. Record the before/after numbers in the commit message.
- [ ] **Step 2:** `npm test` → all pass (conservation tests must still hold after tuning).
- [ ] **Step 3:** Add `deploy.yml` (official `actions/configure-pages`, `actions/upload-pages-artifact` with `dist`, `actions/deploy-pages`; on push to `main`; Node 22; `npm ci && npm test && npm run build`). README in Russian: what it is, how to run locally, what the charts mean.
- [ ] **Step 4:** Commit `chore: balance tuning, headless runner, pages deploy`.
- [ ] **Step 5:** Ask the user before creating the GitHub repo and pushing (outward-facing). After push: enable Pages "GitHub Actions" source and check the site URL loads.
