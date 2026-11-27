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
/** A dead fish. It holds all the fish's nutrients and dissolves on the bottom. */
export interface Body {
  x: number;
  y: number;
  amount: number;
  /** Amount at death. */
  full: number;
  size: number;
  heading: number;
  bottomTicks: number;
}

/** Waste or a dead body, as the smell and the harm check see it. */
export interface Dirt {
  x: number;
  y: number;
  amount: number;
  /** 0 for a waste speck, else the body size. */
  size: number;
}

/** Algae, plankton, waste, dead bodies and rocks. */
export class FoodSystem {
  algae: AlgaeCell[] = [];
  plankton: Plankton[] = [];
  waste: Waste[] = [];
  bodies: Body[] = [];
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
        const dx = rng.range(-spread, spread);
        // On the surface of the half-ellipse that the renderer draws.
        const y = rock.y - rock.ry * Math.sqrt(1 - (dx / rock.rx) ** 2);
        this.algae.push({ x: rock.x + dx, y, biomass: CONFIG.ALGAE_INIT });
      }
    }
    for (let i = 0; i < CONFIG.ALGAE_CELLS - onRocks; i++) {
      this.algae.push({ x: rng.range(0, w), y: this.floorY, biomass: CONFIG.ALGAE_INIT });
    }
  }

  step(field: FertilizerField, rng: Rng, tick: number): void {
    this.growAlgae(field);
    this.spawnPlankton(field, rng, tick);
    this.dieInDark(field, rng, tick);
    this.movePlankton(rng);
    this.moveWaste(field);
    this.moveBodies(field);
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

  /** Plankton dies off where the light is weak and dissolves into the field. */
  private dieInDark(field: FertilizerField, rng: Rng, tick: number): void {
    this.plankton = this.plankton.filter(p => {
      if (!rng.chance(CONFIG.PLANKTON_DARK_DEATH * (1 - lightAt(p.x, p.y, tick)))) return true;
      field.add(p.x, p.y, p.amount);
      return false;
    });
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

  /** A body sinks without loss, then releases an equal share per tick and goes away on the last tick. */
  private moveBodies(field: FertilizerField): void {
    const alive: Body[] = [];
    for (const b of this.bodies) {
      const restY = this.floorY + CONFIG.BODY_REST_DEPTH * b.size;
      if (b.y < restY) {
        b.y = Math.min(b.y + CONFIG.BODY_SINK_SPEED, restY);
      } else if (++b.bottomTicks === CONFIG.BODY_DISSOLVE_TICKS) {
        field.add(b.x, b.y, b.amount);
        continue;
      } else {
        const out = b.full / CONFIG.BODY_DISSOLVE_TICKS;
        field.add(b.x, b.y, out);
        b.amount -= out;
      }
      alive.push(b);
    }
    this.bodies = alive;
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

  addBody(x: number, y: number, amount: number, size: number, heading: number): void {
    this.bodies.push({ x, y, amount, full: amount, size, heading, bottomTicks: 0 });
  }

  total(): number {
    let s = 0;
    for (const a of this.algae) s += a.biomass;
    for (const p of this.plankton) s += p.amount;
    for (const w of this.waste) s += w.amount;
    for (const b of this.bodies) s += b.amount;
    return s;
  }
}
