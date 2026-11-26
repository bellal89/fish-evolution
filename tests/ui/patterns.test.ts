import { expect, test } from 'vitest';
import { patternMarks } from '../../src/ui/patterns';
import type { ColorGenes } from '../../src/sim/traits';

const base: ColorGenes = { hue: 0.1, brightness: 0.8, pattern: 'solid', patternCount: 3, hue2: 0.6 };

test('solid has no marks', () => {
  expect(patternMarks(base, 1, 20, 10)).toHaveLength(0);
});

test.each([
  ['stripes', 4, 4, 'x'],
  ['bands', 6, 3, 'y'],
] as const)('%s: patternCount %i gives %i marks spread along %s', (pattern, patternCount, n, axis) => {
  const marks = patternMarks({ ...base, pattern, patternCount }, 1, 20, 10);
  expect(new Set(marks.map((m) => m[axis])).size).toBe(n);
});

test('spots are twice patternCount and stay inside body box', () => {
  const marks = patternMarks({ ...base, pattern: 'spots', patternCount: 4 }, 7, 20, 10);
  expect(marks).toHaveLength(8);
  for (const m of marks) {
    expect(Math.abs(m.x)).toBeLessThanOrEqual(20);
    expect(Math.abs(m.y)).toBeLessThanOrEqual(10);
  }
});

test('spots are stable for the same fish id', () => {
  const c = { ...base, pattern: 'spots' as const };
  expect(patternMarks(c, 5, 20, 10)).toEqual(patternMarks(c, 5, 20, 10));
});
