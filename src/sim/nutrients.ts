import { clamp } from './geom';

/** Dissolved fertilizer on a coarse grid. Conserves its total except through add/take. */
export class FertilizerField {
  // Float64 so that diffusion conserves the total to well within 1e-6.
  readonly cells: Float64Array;
  private readonly next: Float64Array;

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = new Float64Array(cols * rows);
    this.next = new Float64Array(cols * rows);
  }

  private index(x: number, y: number): number {
    const c = clamp(Math.floor((x / this.w) * this.cols), 0, this.cols - 1);
    const r = clamp(Math.floor((y / this.h) * this.rows), 0, this.rows - 1);
    return r * this.cols + c;
  }

  add(x: number, y: number, amt: number): void {
    this.cells[this.index(x, y)]! += amt;
  }

  /** Removes up to `amt` from the cell and returns the amount actually taken. */
  take(x: number, y: number, amt: number): number {
    const i = this.index(x, y);
    const taken = Math.min(amt, this.cells[i]!);
    this.cells[i]! -= taken;
    return taken;
  }

  at(x: number, y: number): number {
    return this.cells[this.index(x, y)]!;
  }

  /** Exchanges `rate` of each neighbour difference between adjacent cells. Needs rate <= 0.25. */
  diffuse(rate: number): void {
    const { cols, rows, cells, next } = this;
    next.set(cells);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (c + 1 < cols) {
          const flow = (cells[i]! - cells[i + 1]!) * rate;
          next[i]! -= flow;
          next[i + 1]! += flow;
        }
        if (r + 1 < rows) {
          const flow = (cells[i]! - cells[i + cols]!) * rate;
          next[i]! -= flow;
          next[i + cols]! += flow;
        }
      }
    }
    cells.set(next);
  }

  total(): number {
    let s = 0;
    for (let i = 0; i < this.cells.length; i++) s += this.cells[i]!;
    return s;
  }
}
