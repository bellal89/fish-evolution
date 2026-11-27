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

/** Keeps a body of radius r inside the water and bounces its heading off the wall it hit. */
export function keepInTank(b: { x: number; y: number; heading: number }, r: number, w: number, waterH: number): void {
  const dx = Math.cos(b.heading), dy = Math.sin(b.heading);
  let hitX = false, hitY = false;
  if (b.x < r) { b.x = r; hitX = dx < 0; }
  else if (b.x > w - r) { b.x = w - r; hitX = dx > 0; }
  if (b.y < r) { b.y = r; hitY = dy < 0; }
  else if (b.y > waterH - r) { b.y = waterH - r; hitY = dy > 0; }
  if (hitX) b.heading = wrapAngle(Math.PI - b.heading);
  if (hitY) b.heading = wrapAngle(-b.heading);
}
