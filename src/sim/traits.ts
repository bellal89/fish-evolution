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
