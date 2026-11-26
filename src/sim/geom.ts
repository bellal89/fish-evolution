/** Wraps an angle into (-π, π]. */
export function wrapAngle(a: number): number {
  const t = 2 * Math.PI;
  let r = ((a % t) + t) % t;
  if (r > Math.PI) r -= t;
  return r;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Distance along a unit ray (ox,oy)+(dx,dy)·t to the first hit with a circle,
 * or null if the ray misses or the circle is behind the origin.
 */
export function rayCircle(
  ox: number, oy: number, dx: number, dy: number,
  cx: number, cy: number, r: number,
): number | null {
  const lx = cx - ox, ly = cy - oy;
  const proj = lx * dx + ly * dy;
  const d2 = lx * lx + ly * ly - proj * proj;
  const r2 = r * r;
  if (d2 > r2) return null;
  const half = Math.sqrt(r2 - d2);
  if (proj + half < 0) return null;
  return Math.max(proj - half, 0);
}
