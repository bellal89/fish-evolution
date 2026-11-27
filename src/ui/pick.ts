import { CONFIG } from '../sim/config';

/** Id of the nearest fish within the pick radius, or null. */
export function pickFish(fish: { id: number; x: number; y: number }[], x: number, y: number): number | null {
  let best: number | null = null;
  let bestD: number = CONFIG.PICK_RADIUS;
  for (const f of fish) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d <= bestD) { best = f.id; bestD = d; }
  }
  return best;
}
