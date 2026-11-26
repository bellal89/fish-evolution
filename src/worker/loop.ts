import type { FromWorker, ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';
import { makeSnapshot } from '../sim/snapshot';
import { Stats } from '../sim/stats';
import { World } from '../sim/world';

type Speed = Extract<ToWorker, { type: 'speed' }>['speed'];

const TICK_MS = 1000 / CONFIG.TICKS_PER_SEC;

/** Runs the simulation at the chosen speed and posts snapshots; independent of a real Worker. */
export class SimLoop {
  private world: World;
  private stats = new Stats();
  private speed: Speed = 1;
  private selectedId: number | null = null;
  private statsDirty = false;
  private debt = 0;
  private lastFrame: number | null = null;
  private lastPost: number | null = null;

  constructor(
    private readonly seed: number,
    private readonly post: (m: FromWorker) => void,
    private readonly clock: () => number = () => performance.now(),
  ) {
    this.world = new World(seed);
  }

  handle(msg: ToWorker): void {
    switch (msg.type) {
      case 'speed': this.speed = msg.speed; break;
      case 'select': this.selectedId = msg.id; break;
      case 'reset':
        this.world = new World(msg.seed ?? this.seed);
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
    if (this.lastPost === null || nowMs - this.lastPost >= CONFIG.SNAPSHOT_INTERVAL_MS) {
      this.lastPost = nowMs;
      this.post({ type: 'snapshot', snap: makeSnapshot(this.world, this.stats, this.selectedId, this.statsDirty) });
      this.statsDirty = false;
    }
  }

  private advance(elapsedMs: number): void {
    if (this.speed === 0 || this.world.extinct) return;
    const unlimited = this.speed === 'max';
    if (this.speed !== 'max') this.debt += (this.speed * elapsedMs) / TICK_MS;
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
