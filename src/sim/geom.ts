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
