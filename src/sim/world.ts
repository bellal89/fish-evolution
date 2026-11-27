import { InnovationTracker, createMinimalGenome } from '../neat/genome';
import { CONFIG } from './config';
import {
  advanceAge, applyOutputs, createFish, excrete, isDead, payCost, updateReady, wasteHarm, type Fish,
} from './fish';
import { FoodSystem, type AlgaeCell, type Dirt, type Plankton } from './food';
import { Lineage } from './lineage';
import { FertilizerField } from './nutrients';
import { ScriptedPredator, createPredator, stepPredator, type Predator, type PredatorView } from './predator';
import { canMate, mate, type Egg } from './reproduction';
import { Rng } from './rng';
import { INPUT_COUNT, OUTPUT_COUNT, sense, type SenseContext } from './senses';
import { SpatialGrid } from './spatial';
import { MAX_FISH_SIZE, randomTraits } from './traits';
import { Network } from '../neat/network';

export interface WorldEvents {
  lifespansOfDead: number[];
  matings: number;
  escapes: number;
  attacks: number;
  foodEaten: number;
}

export function newEvents(): WorldEvents {
  return { lifespansOfDead: [], matings: 0, escapes: 0, attacks: 0, foodEaten: 0 };
}

/** Anything a fish can sense as food and eat, with a link back to its source. */
type FoodItem = { x: number; y: number; amount: number } & (
  | { kind: 'algae'; src: AlgaeCell }
  | { kind: 'plankton'; src: Plankton }
  | { kind: 'egg'; src: Egg }
);

interface Alarm { x: number; y: number; tick: number }

// Shared so that bg(), called for every seen fish, does not allocate.
const WATER_BG = { hue: CONFIG.BG_WATER_HUE, brightness: CONFIG.BG_WATER_BRIGHTNESS } as const;
const SAND_BG = { hue: CONFIG.BG_SAND_HUE, brightness: CONFIG.BG_SAND_BRIGHTNESS } as const;
const bg = (_x: number, y: number) => (y < CONFIG.TANK_H - CONFIG.SAND_H ? WATER_BG : SAND_BG);

/**
 * World state as a structured clone stores it (IndexedDB). The clone keeps the
 * fields of class instances but drops their prototypes and cannot hold functions.
 */
export interface WorldSave {
  tick: number;
  nextId: number;
  extinct: boolean;
  fish: Omit<Fish, 'brain'>[];
  eggs: Egg[];
  predators: Predator[];
  alarms: Alarm[];
  events: WorldEvents;
  rng: Rng;
  field: FertilizerField;
  food: FoodSystem;
  lineage: Lineage;
  tracker: InnovationTracker;
}

const revive = <T>(o: T, cls: { prototype: object }): T => Object.setPrototypeOf(o, cls.prototype);

export class World {
  tick = 0;
  fish: Fish[] = [];
  eggs: Egg[] = [];
  predators: Predator[] = [];
  readonly food: FoodSystem;
  readonly field: FertilizerField;
  readonly lineage = new Lineage();
  events = newEvents();
  extinct = false;

  private readonly rng: Rng;
  private readonly tracker = new InnovationTracker(INPUT_COUNT + 1 + OUTPUT_COUNT);
  private readonly controller = new ScriptedPredator();
  private readonly fishGrid = new SpatialGrid<Fish>(CONFIG.GRID_CELL, CONFIG.TANK_W, CONFIG.TANK_H);
  private readonly foodGrid = new SpatialGrid<FoodItem>(CONFIG.GRID_CELL, CONFIG.TANK_W, CONFIG.TANK_H);
  private readonly dirtGrid = new SpatialGrid<Dirt>(CONFIG.GRID_CELL, CONFIG.TANK_W, CONFIG.TANK_H);
  private alarms: Alarm[] = [];
  private nextId = 1;
  private readonly newId = () => this.nextId++;
  private readonly senseCtx: SenseContext;
  private readonly predView: PredatorView;

  /** Creates a new world from a seed, or continues a saved one. */
  constructor(from: number | WorldSave) {
    if (typeof from === 'number') {
      const { TANK_W: w, TANK_H: h } = CONFIG;
      const waterH = h - CONFIG.SAND_H;
      this.rng = new Rng(from);
      this.field = new FertilizerField(CONFIG.FIELD_COLS, CONFIG.FIELD_ROWS, w, h);
      this.food = new FoodSystem(this.rng, w, h);

      for (let i = 0; i < CONFIG.INITIAL_FISH; i++) {
        const traits = randomTraits(this.rng);
        const genome = createMinimalGenome(INPUT_COUNT, OUTPUT_COUNT, this.rng, this.tracker);
        const x = this.rng.range(traits.size, w - traits.size);
        const y = this.rng.range(traits.size, waterH - traits.size);
        const f = createFish(this.newId(), x, y, i % 2 === 0 ? 'M' : 'F', traits, genome, CONFIG.INITIAL_FISH_ENERGY, null);
        f.heading = this.rng.range(-Math.PI, Math.PI);
        this.fish.push(f);
        this.lineage.born(f.id, null, genome, traits);
      }
      this.predators.push(createPredator(
        this.rng.range(CONFIG.PRED_SIZE, w - CONFIG.PRED_SIZE),
        this.rng.range(CONFIG.PRED_SIZE, waterH - CONFIG.PRED_SIZE),
        this.rng.range(-Math.PI, Math.PI),
      ));

      // Whatever the fish and the initial algae do not hold starts as fertilizer, spread evenly.
      const fishEnergy = this.fish.length * CONFIG.INITIAL_FISH_ENERGY;
      const perCell = (CONFIG.TOTAL_NUTRIENTS - fishEnergy - this.food.total()) / this.field.cells.length;
      this.field.cells.fill(perCell);
    } else {
      ({ tick: this.tick, nextId: this.nextId, extinct: this.extinct, eggs: this.eggs,
        predators: this.predators, alarms: this.alarms, events: this.events } = from);
      this.rng = revive(from.rng, Rng);
      this.field = revive(from.field, FertilizerField);
      this.food = revive(from.food, FoodSystem);
      this.lineage = revive(from.lineage, Lineage);
      this.tracker = revive(from.tracker, InnovationTracker);
      this.fish = from.fish.map(f => ({ ...f, brain: new Network(f.genome) }));
    }

    this.senseCtx = {
      food: this.foodGrid, dirt: this.dirtGrid, fish: this.fishGrid, predators: this.predators, alarms: this.alarms,
      tick: 0, bg, tankW: CONFIG.TANK_W, tankH: CONFIG.TANK_H,
    };
    this.predView = { fish: this.fishGrid, eggs: this.eggs, bg };
  }

  save(): WorldSave {
    const { tick, nextId, extinct, eggs, predators, alarms, events, rng, field, food, lineage, tracker } = this;
    const fish = this.fish.map(({ brain: _, ...f }) => f);
    return { tick, nextId, extinct, fish, eggs, predators, alarms, events, rng, field, food, lineage, tracker };
  }

  totalNutrients(): number {
    let s = this.field.total() + this.food.total();
    for (const f of this.fish) s += f.energy + f.gut;
    for (const e of this.eggs) s += e.energy;
    for (const p of this.predators) s += p.gut;
    return s;
  }

  step(): void {
    if (this.extinct) return;
    this.rebuildGrids();
    this.stepFish();
    this.rebuildFishGrid();
    this.stepMating();
    this.stepPredators();
    this.hatchEggs();
    this.removeDead();
    this.food.step(this.field, this.rng, this.tick);
    this.field.diffuse(CONFIG.FERT_DIFFUSION);
    this.tick++;
    this.extinct = this.fish.length === 0 && this.eggs.length === 0;
  }

  private rebuildFishGrid(): void {
    this.fishGrid.clear();
    for (const f of this.fish) this.fishGrid.insert(f);
  }

  private rebuildGrids(): void {
    this.rebuildFishGrid();
    this.foodGrid.clear();
    for (const a of this.food.algae) this.foodGrid.insert({ x: a.x, y: a.y, amount: a.biomass, kind: 'algae', src: a });
    for (const p of this.food.plankton) this.foodGrid.insert({ x: p.x, y: p.y, amount: p.amount, kind: 'plankton', src: p });
    for (const e of this.eggs) this.foodGrid.insert({ x: e.x, y: e.y, amount: e.energy, kind: 'egg', src: e });
    this.dirtGrid.clear();
    for (const d of this.food.waste) this.dirtGrid.insert({ x: d.x, y: d.y, amount: d.amount, size: 0 });
    for (const b of this.food.bodies) this.dirtGrid.insert({ x: b.x, y: b.y, amount: b.amount, size: b.size });
    this.senseCtx.alarms = this.alarms = this.alarms.filter(a => this.tick - a.tick < CONFIG.ALARM_TICKS);
    this.senseCtx.tick = this.tick;
    this.predView.eggs = this.eggs;
  }

  private stepFish(): void {
    const { TANK_W, TANK_H } = CONFIG;
    for (const f of this.fish) {
      advanceAge(f);
      updateReady(f);
      sense(f, this.senseCtx, f.lastInputs);
      f.lastOutputs = f.brain.activate(f.lastInputs);
      applyOutputs(f, f.lastOutputs, TANK_W, TANK_H);
      this.eat(f);
      f.wasteAge += wasteHarm(f, this.dirtGrid.query(f.x, f.y, f.traits.size + MAX_FISH_SIZE + CONFIG.EAT_REACH));
      payCost(f);
      const waste = excrete(f);
      if (waste > 0) this.food.addWaste(f.x, f.y, waste);
    }
  }

  private eat(f: Fish): void {
    let got = 0;
    for (const it of this.foodGrid.query(f.x, f.y, f.traits.size + CONFIG.EAT_REACH)) {
      if (it.kind === 'algae') {
        if (f.biteCooldown > 0 || it.src.biomass === 0) continue;
        got += this.food.eatAlgae(it.src, CONFIG.BITE);
        f.biteCooldown = CONFIG.BITE_COOLDOWN;
      }
      else if (it.kind === 'plankton') got += this.food.removePlankton(it.src);
      // The clutch is laid between the parents, so they would eat it at once.
      else if (!it.src.parents.includes(f.id)) got += this.removeEgg(it.src);
    }
    f.energy += got;
    this.events.foodEaten += got;
  }

  /** Removes the egg and returns its energy (0 if already gone). */
  private removeEgg(e: Egg): number {
    const i = this.eggs.indexOf(e);
    if (i < 0) return 0;
    this.eggs.splice(i, 1);
    this.lineage.died(e.id);
    return e.energy;
  }

  private stepMating(): void {
    const mated = new Set<Fish>();
    for (const a of this.fish) {
      if (!a.ready || mated.has(a)) continue;
      for (const b of this.fishGrid.query(a.x, a.y, a.traits.size + MAX_FISH_SIZE)) {
        if (b === a || mated.has(b) || !canMate(a, b)) continue;
        for (const egg of mate(a, b, this.rng, this.tracker, this.tick, this.newId)) {
          this.eggs.push(egg);
          this.lineage.born(egg.id, egg.parents, egg.genome, egg.traits);
        }
        mated.add(a);
        mated.add(b);
        this.events.matings++;
        break;
      }
    }
  }

  private stepPredators(): void {
    const eaten = new Set<Fish>();
    for (const p of this.predators) {
      const chased = p.state === 'chase' ? p.targetId : null;
      stepPredator(p, this.controller.decide(p, this.predView, this.rng), CONFIG.TANK_W, CONFIG.TANK_H);
      // A chase that switched target or stopped is an escape; a kill ends it below instead.
      if (chased !== null && p.targetId !== chased) this.events.escapes++;
      if (p.state === 'chase' && p.targetId !== chased) this.events.attacks++;

      for (const f of this.fishGrid.query(p.x, p.y, p.size + MAX_FISH_SIZE)) {
        if (eaten.has(f) || Math.hypot(f.x - p.x, f.y - p.y) >= p.size + f.traits.size) continue;
        const isTarget = p.state === 'chase' && p.targetId === f.id;
        if (!isTarget && p.satiety > 0) continue;
        eaten.add(f);
        p.gut += f.energy + f.gut;
        p.satiety = CONFIG.PRED_SATIETY_TICKS;
        this.alarms.push({ x: f.x, y: f.y, tick: this.tick });
        this.recordDeath(f);
        if (isTarget) {
          p.state = 'patrol';
          p.targetId = null;
        }
      }

      for (const e of [...this.eggs]) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < p.size) p.gut += this.removeEgg(e);
      }
      const waste = excrete(p);
      if (waste > 0) this.food.addWaste(p.x, p.y, waste);
    }
    if (eaten.size > 0) this.fish = this.fish.filter(f => !eaten.has(f));
  }

  private hatchEggs(): void {
    const waiting: Egg[] = [];
    for (const e of this.eggs) {
      if (this.tick < e.hatchAt) { waiting.push(e); continue; }
      this.fish.push(createFish(e.id, e.x, e.y, e.sex, e.traits, e.genome, e.energy, e.parents));
    }
    this.eggs = waiting;
  }

  private removeDead(): void {
    const alive: Fish[] = [];
    for (const f of this.fish) {
      if (!isDead(f)) { alive.push(f); continue; }
      // A fish can excrete its gut on the tick its energy runs out; then there is nothing to leave.
      const left = f.energy + f.gut;
      if (left > 0) this.food.addBody(f.x, f.y, left, f.traits.size, f.heading);
      this.recordDeath(f);
    }
    this.fish = alive;
  }

  private recordDeath(f: Fish): void {
    this.events.lifespansOfDead.push(f.age);
    this.lineage.died(f.id);
  }
}
