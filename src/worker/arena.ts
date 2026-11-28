import type { ArenaSideView, ArenaSpeed, BrainChoice, Side } from '../protocol';
import { CONFIG } from '../sim/config';
import { arenaTraits, randomBrain, type Brain } from '../sim/arena';
import { makeSnapshot } from '../sim/snapshot';
import { World } from '../sim/world';

/** The brain choice of one side. `brain: null` means Random: the brain comes from the arena seed. */
export interface ArenaPick {
  choice: BrainChoice;
  brain: Brain | null;
}

/** Two arena worlds with the same start that step in lockstep. */
export class Arena {
  speed: ArenaSpeed = 1;
  /** Fish per side. */
  count: number = CONFIG.ARENA_FISH;
  predators: number = CONFIG.ARENA_PREDATORS;
  worlds!: [World, World];
  private brains!: [Brain, Brain];
  private selected: [number | null, number | null] = [null, null];

  constructor(private seed: number, private readonly picks: [ArenaPick, ArenaPick]) {
    this.restart();
  }

  /** Both sides are extinct. */
  get done(): boolean {
    return this.worlds.every(w => w.extinct);
  }

  /** Sets the brain of a side and restarts both sides with the current seed. */
  setPick(side: Side, pick: ArenaPick): void {
    this.picks[side] = pick;
    this.restart();
  }

  /** With a seed, a new start; without, the same start again. */
  restart(seed = this.seed): void {
    this.seed = seed;
    const brain = (side: Side): Brain => this.picks[side].brain ?? randomBrain(seed, side);
    this.brains = [brain(0), brain(1)];
    const world = ({ genome, traits }: Brain) => new World(seed, { genome, traits: arenaTraits(traits), count: this.count, predators: this.predators });
    this.worlds = [world(this.brains[0]), world(this.brains[1])];
    this.selected = [null, null];
  }

  select(side: Side, id: number | null): void {
    this.selected[side] = id;
  }

  /** Steps both sides. An extinct side does not step, so its clock stops. */
  step(): void {
    for (const w of this.worlds) w.step();
  }

  view(): { speed: ArenaSpeed; count: number; choices: [BrainChoice, BrainChoice]; sides: [ArenaSideView, ArenaSideView] } {
    const side = (s: Side): ArenaSideView => {
      const w = this.worlds[s];
      const id = this.selected[s];
      const shown = w.fish.some(f => f.id === id) ? id : (w.fish[0]?.id ?? null);
      return { scene: makeSnapshot(w, shown), foodEaten: w.events.foodEaten, genome: this.brains[s].genome };
    };
    return { speed: this.speed, count: this.count, choices: [this.picks[0].choice, this.picks[1].choice], sides: [side(0), side(1)] };
  }
}
