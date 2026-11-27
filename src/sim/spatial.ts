import { clamp } from './geom';

/** Uniform bucket grid for radius queries. Rebuilt every tick by the caller. */
export class SpatialGrid<T extends { x: number; y: number }> {
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: T[][];

  constructor(private readonly cell: number, w: number, h: number) {
    this.cols = Math.ceil(w / cell);
    this.rows = Math.ceil(h / cell);
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (const b of this.buckets) b.length = 0;
  }

  private col(x: number): number {
    return clamp(Math.floor(x / this.cell), 0, this.cols - 1);
  }

  private row(y: number): number {
    return clamp(Math.floor(y / this.cell), 0, this.rows - 1);
  }

  insert(item: T): void {
    this.buckets[this.row(item.y) * this.cols + this.col(item.x)].push(item);
  }

  /** Items within distance `r` of (x, y). */
  query(x: number, y: number, r: number): T[] {
    const out: T[] = [];
    const r2 = r * r;
    for (let row = this.row(y - r); row <= this.row(y + r); row++) {
      for (let col = this.col(x - r); col <= this.col(x + r); col++) {
        for (const it of this.buckets[row * this.cols + col]) {
          const dx = it.x - x, dy = it.y - y;
          if (dx * dx + dy * dy <= r2) out.push(it);
        }
      }
    }
    return out;
  }
}
