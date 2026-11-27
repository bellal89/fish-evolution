import type { FromWorker, Speed, ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';
import { makeSnapshot } from '../sim/snapshot';
import { Stats, type StatPoint } from '../sim/stats';
import { World, type WorldSave } from '../sim/world';

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
    }
  }

  frame(nowMs: number): void {
    const elapsed = this.lastFrame === null ? 0 : nowMs - this.lastFrame;
    this.lastFrame = nowMs;
    this.advance(elapsed);
    if (nowMs - this.lastPost >= CONFIG.SNAPSHOT_INTERVAL_MS) {
      this.lastPost = nowMs;
      this.post({ type: 'snapshot', snap: makeSnapshot(this.world, this.selectedId, this.statsDirty ? this.stats.history : undefined) });
      this.statsDirty = false;
    }
  }

  private advance(elapsedMs: number): void {
    const speed = this.speed;
    const unlimited = speed === 'max';
    if (!unlimited) this.debt += (speed * elapsedMs) / TICK_MS;
    const start = this.clock();
    while ((unlimited || this.debt >= 1) && !this.world.extinct) {
      if (this.clock() - start >= CONFIG.WORKER_BUDGET_MS) break;
      this.world.step();
      this.debt -= 1;
      if (this.world.tick % CONFIG.STATS_EVERY === 0) {
        this.stats.sample(this.world);
        this.statsDirty = true;
      }
    }
    // Over budget: drop the whole-tick debt so it cannot spiral.
    this.debt = unlimited ? 0 : this.debt % 1;
  }
}
