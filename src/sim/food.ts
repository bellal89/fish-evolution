import { CONFIG } from './config';
import { clamp } from './geom';
import { lightAt } from './light';
import type { FertilizerField } from './nutrients';
import type { Rng } from './rng';

export interface AlgaeCell { x: number; y: number; biomass: number }
export interface Plankton { x: number; y: number; vx: number; vy: number; amount: number }
export interface Rock {
  x: number;
  /** Ground level the rock sits on. */
  y: number;
  /** Half-width. */
  rx: number;
  /** Height. */
  ry: number;
}
export interface Waste { x: number; y: number; vy: number; amount: number; bottomTicks: number }

/** Algae, plankton, waste and rocks. */
export class FoodSystem {
  algae: AlgaeCell[] = [];
  plankton: Plankton[] = [];
  waste: Waste[] = [];
  readonly rocks: Rock[] = [];
  private readonly floorY: number;

  constructor(rng: Rng, private readonly w: number, h: number) {
    this.floorY = h - CONFIG.SAND_H;
    const onRocks = CONFIG.ROCK_COUNT * CONFIG.ALGAE_PER_ROCK;
    for (let r = 0; r < CONFIG.ROCK_COUNT; r++) {
      const rock: Rock = {
        x: rng.range(CONFIG.ROCK_MARGIN_FRAC * w, (1 - CONFIG.ROCK_MARGIN_FRAC) * w),
        y: this.floorY,
        rx: rng.range(CONFIG.ROCK_MIN_RX, CONFIG.ROCK_MAX_RX),
        ry: rng.range(CONFIG.ROCK_MIN_H, CONFIG.ROCK_MAX_H),
      };
      this.rocks.push(rock);
      const spread = rock.rx * CONFIG.ALGAE_ROCK_SPREAD;
      for (let i = 0; i < CONFIG.ALGAE_PER_ROCK; i++) {
        this.algae.push({ x: rock.x + rng.range(-spread, spread), y: rock.y - rock.ry, biomass: CONFIG.ALGAE_INIT });
      }
    }
    for (let i = 0; i < CONFIG.ALGAE_CELLS - onRocks; i++) {
      this.algae.push({ x: rng.range(0, w), y: this.floorY, biomass: CONFIG.ALGAE_INIT });
    }
  }

  step(field: FertilizerField, rng: Rng, tick: number): void {
    this.growAlgae(field);
    this.spawnPlankton(field, rng, tick);
    this.movePlankton(rng);
    this.moveWaste(field);
  }

  private growAlgae(field: FertilizerField): void {
    for (const a of this.algae) {
      const want = Math.min(field.at(a.x, a.y) * CONFIG.ALGAE_GROWTH, CONFIG.ALGAE_MAX - a.biomass);
      if (want > 0) a.biomass += field.take(a.x, a.y, want);
    }
  }

  /** Plankton spawns where there is fertilizer, more often where the light is stronger. */
  private spawnPlankton(field: FertilizerField, rng: Rng, tick: number): void {
    for (let i = 0; i < CONFIG.PLANKTON_TRIES; i++) {
      if (this.plankton.length >= CONFIG.PLANKTON_MAX) return;
      const x = rng.range(0, this.w), y = rng.range(0, this.floorY);
      if (field.at(x, y) <= CONFIG.PLANKTON_FERT_MIN || !rng.chance(lightAt(x, y, tick))) continue;
      const amount = field.take(x, y, CONFIG.PLANKTON_AMOUNT);
      this.plankton.push({ x, y, vx: 0, vy: 0, amount });
    }
  }

  private movePlankton(rng: Rng): void {
    for (const p of this.plankton) {
      p.vx = (p.vx + rng.normal() * CONFIG.PLANKTON_DRIFT) * CONFIG.PLANKTON_DAMPING;
      p.vy = (p.vy + rng.normal() * CONFIG.PLANKTON_DRIFT) * CONFIG.PLANKTON_DAMPING;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > this.w) { p.x = clamp(p.x, 0, this.w); p.vx = -p.vx; }
      if (p.y < 0 || p.y > this.floorY) { p.y = clamp(p.y, 0, this.floorY); p.vy = -p.vy; }
    }
  }

  private moveWaste(field: FertilizerField): void {
    const alive: Waste[] = [];
    for (const wst of this.waste) {
      const dissolved = wst.amount * CONFIG.WASTE_DISSOLVE_RATE;
      field.add(wst.x, wst.y, dissolved);
      wst.amount -= dissolved;
      if (wst.y < this.floorY) {
        wst.y = Math.min(wst.y + wst.vy, this.floorY);
      } else if (++wst.bottomTicks >= CONFIG.WASTE_BOTTOM_TICKS) {
        field.add(wst.x, wst.y, wst.amount);
        continue;
      }
      alive.push(wst);
    }
    this.waste = alive;
  }

  /** Removes up to `amt` biomass from the cell; returns what was eaten. */
  eatAlgae(cell: AlgaeCell, amt: number): number {
    const eaten = Math.min(amt, cell.biomass);
    cell.biomass -= eaten;
    return eaten;
  }

  /** Removes the plankton and returns its amount (0 if already removed). */
  removePlankton(p: Plankton): number {
    const i = this.plankton.indexOf(p);
    if (i < 0) return 0;
    this.plankton.splice(i, 1);
    return p.amount;
  }

  addWaste(x: number, y: number, amt: number): void {
    this.waste.push({ x, y, vy: CONFIG.WASTE_SINK_SPEED, amount: amt, bottomTicks: 0 });
  }

  total(): number {
    let s = 0;
    for (const a of this.algae) s += a.biomass;
    for (const p of this.plankton) s += p.amount;
    for (const w of this.waste) s += w.amount;
    return s;
  }
}
