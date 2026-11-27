import type { BrainChoice, FromWorker, Speed, ToWorker } from '../protocol';
import type { Brain } from '../sim/arena';
import { CONFIG } from '../sim/config';
import { leaderRows, makeSnapshot } from '../sim/snapshot';
import { Stats, type StatPoint } from '../sim/stats';
import { World, type WorldSave } from '../sim/world';
import { Arena, type ArenaPick } from './arena';

const TICK_MS = 1000 / CONFIG.TICKS_PER_SEC;

export interface LoopSave { world: WorldSave; history: StatPoint[] }

/** Runs the simulation at the chosen speed and posts snapshots; independent of a real Worker. */
export class SimLoop {
  private world: World;
  private stats = new Stats();
  private speed: Speed = 1;
  private selectedId: number | null = null;
  private statsDirty = false;
  private debt = 0;
  private lastFrame: number | null = null;
  private lastPost = -Infinity;
  /** While the arena is open, the main world does not step. */
  private arena: Arena | null = null;

  /** Starts a new world from a seed, or continues a saved one. */
  constructor(
    from: number | LoopSave,
    private readonly post: (m: FromWorker) => void,
    private readonly clock: () => number = () => performance.now(),
  ) {
    if (typeof from === 'number') {
      this.world = new World(from);
    } else {
      this.world = new World(from.world);
      this.stats.history = from.history;
      this.statsDirty = true;
    }
  }

  save(): LoopSave {
    return { world: this.world.save(), history: this.stats.history };
  }

  handle(msg: ToWorker): void {
    switch (msg.type) {
      case 'speed': this.speed = msg.speed; break;
      case 'select': this.selectedId = msg.id; break;
      case 'reset':
        this.world = new World(msg.seed);
        this.stats = new Stats();
        this.selectedId = null;
        this.statsDirty = true;
        this.debt = 0;
        break;
      case 'arenaOpen': {
        const right: BrainChoice = this.world.lineage.leader() ? { kind: 'leader' } : { kind: 'random' };
        this.arena = new Arena(msg.seed, [this.pick({ kind: 'random' }), this.pick(right)]);
        this.debt = 0;
        this.lastPost = -Infinity;
        break;
      }
      case 'arenaClose':
        this.arena = null;
        this.debt = 0;
        this.lastPost = -Infinity;
        break;
      case 'arenaBrain': this.arena!.setPick(msg.side, this.pick(msg.choice)); break;
      case 'arenaRestart': this.arena!.restart(msg.seed); break;
      case 'arenaSpeed': this.arena!.speed = msg.speed; break;
      case 'arenaSelect': this.arena!.select(msg.side, msg.id); break;
    }
  }

  /** The brain for an arena choice. Genomes and traits never change after birth, so a reference is a copy. */
  private pick(choice: BrainChoice): ArenaPick {
    const brain = ({ genome, traits }: Brain): ArenaPick => ({ choice, brain: { genome, traits } });
    switch (choice.kind) {
      case 'random': return { choice, brain: null };
      case 'leader': return brain(this.world.lineage.leader()!);
      case 'selected': return brain(this.world.fish.find(f => f.id === this.selectedId)!);
      case 'history': return brain(this.world.leaderHistory[choice.index]);
    }
  }

  frame(nowMs: number): void {
    const elapsed = this.lastFrame === null ? 0 : nowMs - this.lastFrame;
    this.lastFrame = nowMs;
    const post = nowMs - this.lastPost >= CONFIG.SNAPSHOT_INTERVAL_MS;
    if (post) this.lastPost = nowMs;
    const arena = this.arena;
    if (arena) {
      this.advance(elapsed, arena.speed, () => arena.step(), () => arena.done);
      if (post) this.post({ type: 'arena', arena: {
        ...arena.view(),
        history: leaderRows(this.world),
        hasLeader: this.world.lineage.leader() !== null,
        hasSelected: this.world.fish.some(f => f.id === this.selectedId),
      } });
      return;
    }
    this.advance(elapsed, this.speed, () => this.stepMain(), () => this.world.extinct);
    if (post) {
      this.post({ type: 'snapshot', snap: makeSnapshot(this.world, this.selectedId, this.statsDirty ? this.stats.history : undefined) });
      this.statsDirty = false;
    }
  }

  private stepMain(): void {
    this.world.step();
    if (this.world.tick % CONFIG.STATS_EVERY === 0) {
      this.stats.sample(this.world);
      this.statsDirty = true;
    }
  }

  private advance(elapsedMs: number, speed: Speed, step: () => void, stopped: () => boolean): void {
    const unlimited = speed === 'max';
    if (!unlimited) this.debt += (speed * elapsedMs) / TICK_MS;
    const start = this.clock();
    while ((unlimited || this.debt >= 1) && !stopped()) {
      if (this.clock() - start >= CONFIG.WORKER_BUDGET_MS) break;
      step();
      this.debt -= 1;
    }
    // Over budget: drop the whole-tick debt so it cannot spiral.
    this.debt = unlimited ? 0 : this.debt % 1;
  }
}
