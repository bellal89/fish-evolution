import { CONFIG } from './config';

/** X of the light spot center: it moves from the left wall to the right wall and back. */
export function lightCenter(tick: number): number {
  return (CONFIG.TANK_W / 2) * (1 - Math.cos((2 * Math.PI * tick) / CONFIG.LIGHT_PERIOD_TICKS));
}

/** Light level 0..1: highest at the surface under the spot center. */
export function lightAt(x: number, y: number, tick: number): number {
  const spot = Math.exp(-(((x - lightCenter(tick)) / CONFIG.LIGHT_SPOT_WIDTH) ** 2));
  return spot * (1 - (CONFIG.LIGHT_DEPTH_FADE * y) / (CONFIG.TANK_H - CONFIG.SAND_H));
}
