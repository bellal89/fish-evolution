import { CONFIG } from './config';
import type { Rng } from './rng';

export type Sex = 'M' | 'F';

export type Pattern = 'solid' | 'stripes' | 'spots' | 'bands';
export const PATTERNS: readonly Pattern[] = ['solid', 'stripes', 'spots', 'bands'];

export interface ColorGenes {
  /** Main hue, 0..1. */
  hue: number;
  /** Saturation + lightness contrast, 0..1 (0 = dull, 1 = vivid). */
  brightness: number;
  pattern: Pattern;
  /** 1..6 */
  patternCount: number;
  /** Pattern hue, 0..1. */
  hue2: number;
}

export interface Traits {
  size: number;
  maxSpeed: number;
  /** Radians. */
  viewAngle: number;
  viewRange: number;
  /** Energy needed to mate. */
  mateThreshold: number;
  /** Share of energy given to offspring, 0.1..0.6. */
  investFraction: number;
  lifespanTicks: number;
  colorM: ColorGenes;
  colorF: ColorGenes;
  prefHue: number;
  prefPattern: Pattern;
  /** 0 = accepts anyone, 1 = very picky. */
  choosiness: number;
}

type Range = readonly [number, number];
const R = CONFIG.TRAIT_RANGES;

const SCALAR_KEYS = [
  'size',
  'maxSpeed',
  'viewAngle',
  'viewRange',
  'mateThreshold',
  'investFraction',
  'lifespanTicks',
  'choosiness',
] as const;

const TRAIT_KEYS = [...SCALAR_KEYS, 'colorM', 'colorF', 'prefHue', 'prefPattern'] as const;

const clamp = (x: number, [lo, hi]: Range) => Math.min(hi, Math.max(lo, x));
const wrap01 = (x: number) => x - Math.floor(x);

function randomColor(rng: Rng): ColorGenes {
  return {
    hue: rng.next(),
    brightness: rng.range(...R.brightness),
    pattern: rng.pick(PATTERNS),
    patternCount: rng.int(R.patternCount[1] - R.patternCount[0] + 1) + R.patternCount[0],
    hue2: rng.next(),
  };
}

export function randomTraits(rng: Rng): Traits {
  const t = {
    colorM: randomColor(rng),
    colorF: randomColor(rng),
    prefHue: rng.next(),
    prefPattern: rng.pick(PATTERNS),
  } as Traits;
  for (const k of SCALAR_KEYS) t[k] = rng.range(R[k][0], R[k][1]);
  return t;
}

/** Each field comes from a random parent; color blocks are copied. */
export function crossTraits(a: Traits, b: Traits, rng: Rng): Traits {
  const child: Record<string, unknown> = {};
  for (const k of TRAIT_KEYS) {
    const v = (rng.chance(0.5) ? a : b)[k];
    child[k] = typeof v === 'object' ? { ...v } : v;
  }
  return child as unknown as Traits;
}

function noisy(x: number, range: Range, rng: Rng): number {
  return clamp(x + rng.normal() * CONFIG.TRAIT_MUT_SD * (range[1] - range[0]), range);
}

function noisyHue(h: number, rng: Rng): number {
  return wrap01(h + rng.normal() * CONFIG.TRAIT_MUT_SD);
}

function mutatePattern(p: Pattern, rng: Rng): Pattern {
  return rng.chance(CONFIG.P_PATTERN_MUT) ? rng.pick(PATTERNS) : p;
}

function mutateColor(c: ColorGenes, rng: Rng): ColorGenes {
  return {
    hue: noisyHue(c.hue, rng),
    brightness: noisy(c.brightness, R.brightness, rng),
    pattern: mutatePattern(c.pattern, rng),
    patternCount: Math.round(noisy(c.patternCount, R.patternCount, rng)),
    hue2: noisyHue(c.hue2, rng),
  };
}

/** Returns a mutated copy; the input is untouched. */
export function mutateTraits(t: Traits, rng: Rng): Traits {
  const m = { ...t };
  for (const k of SCALAR_KEYS) m[k] = noisy(t[k], R[k], rng);
  m.colorM = mutateColor(t.colorM, rng);
  m.colorF = mutateColor(t.colorF, rng);
  m.prefHue = noisyHue(t.prefHue, rng);
  m.prefPattern = mutatePattern(t.prefPattern, rng);
  return m;
}

export function expressedColor(t: Traits, sex: Sex): ColorGenes {
  return sex === 'M' ? t.colorM : t.colorF;
}

/** Circular hue distance, 0..0.5. */
export function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
}

/** How much the chooser likes this color, 0..1. */
export function attraction(chooser: Traits, c: ColorGenes): number {
  const match =
    0.6 * (1 - 2 * hueDist(c.hue, chooser.prefHue)) +
    0.4 * (c.pattern === chooser.prefPattern ? 1 : 0);
  return match * (0.5 + 0.5 * c.brightness);
}

export function accepts(chooser: Traits, c: ColorGenes): boolean {
  return attraction(chooser, c) >= chooser.choosiness * CONFIG.CHOOSY_MAX;
}

/** How easily a predator spots this color against the background. */
export function visibility(c: ColorGenes, bgHue: number, bgBrightness: number): number {
  const v =
    CONFIG.VIS_HUE_W * 2 * hueDist(c.hue, bgHue) +
    CONFIG.VIS_BRIGHT_W * Math.abs(c.brightness - bgBrightness) +
    (c.pattern === 'solid' ? 0 : CONFIG.VIS_PATTERN_BONUS);
  return Math.min(1, Math.max(CONFIG.MIN_VISIBILITY, v));
}
