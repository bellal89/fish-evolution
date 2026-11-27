import { CONFIG } from '../sim/config';
import type { StatPoint } from '../sim/stats';
import { drawFishIcon } from './render';

/** One small line chart; all lines share the y range (from 0 for non-negative data). */
function sparkline(canvas: HTMLCanvasElement, lines: { values: number[]; color: string }[]): void {
  const ctx = canvas.getContext('2d')!;
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);
  const all = lines.flatMap(l => l.values);
  if (all.length < 2) return;
  const lo = Math.min(0, ...all);
  const hi = Math.max(...all, lo + 1e-9);
  for (const l of lines) {
    ctx.strokeStyle = l.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    l.values.forEach((v, i) => {
      const x = (i / (l.values.length - 1)) * (W - 2) + 1;
      const y = H - 2 - ((v - lo) / (hi - lo)) * (H - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

interface Row {
  title: string;
  /** Lines to draw; the last value of each is shown as text. */
  lines: { name: string; get: (p: StatPoint) => number; color: string }[];
  fmt: (v: number) => string;
}

const f1 = (v: number): string => v.toFixed(1);
const int = (v: number): string => String(Math.round(v));
const pct = (v: number): string => `${Math.round(v * 100)}%`;
/** Ticks as whole seconds. */
export const secs = (ticks: number): string => `${Math.round(ticks / CONFIG.TICKS_PER_SEC)}s`;

/** A row with a single unnamed line. */
const one = (title: string, get: (p: StatPoint) => number, color: string, fmt = f1): Row =>
  ({ title, lines: [{ name: '', get, color }], fmt });

const ROWS: Row[] = [
  {
    title: 'Population',
    lines: [
      { name: 'all', get: p => p.population, color: '#dfe' },
      { name: 'M', get: p => p.males, color: '#6ab0ff' },
      { name: 'F', get: p => p.females, color: '#ff8ac0' },
    ],
    fmt: int,
  },
  one('Eggs', p => p.eggs, '#f5e6a0', int),
  one('Avg lifespan', p => p.avgLifespan, '#b8e0a0', secs),
  one('Offspring per fish', p => p.avgChildren, '#e0b0ff'),
  one('Size', p => p.avgSize, '#9ad'),
  one('Speed', p => p.avgSpeed, '#fc8'),
  {
    title: 'Hidden neurons',
    lines: [
      { name: 'avg', get: p => p.avgHidden, color: '#9ad' },
      { name: 'leader', get: p => p.leaderHidden, color: '#fc6' },
    ],
    fmt: f1,
  },
  {
    title: 'Connections',
    lines: [
      { name: 'avg', get: p => p.avgConns, color: '#9ad' },
      { name: 'leader', get: p => p.leaderConns, color: '#fc6' },
    ],
    fmt: f1,
  },
  one('Escapes', p => p.escapeRate, '#f88', pct),
  one('Food per fish', p => p.foodPerFish, '#8d8', v => v.toFixed(2)),
  one('Matings per fish', p => p.matingsPerFish, '#f9c', v => v.toFixed(2)),
];

const SEXES = [
  { sym: '♂', title: 'Male hue', hue: (p: StatPoint) => p.avgHueM, pat: (p: StatPoint) => p.topPatternM },
  { sym: '♀', title: 'Female hue', hue: (p: StatPoint) => p.avgHueF, pat: (p: StatPoint) => p.topPatternF },
];

const SPARK_W = 420, SPARK_H = 36;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Hue history as a strip of colored blocks (one per sampled point). */
function drawHueStrip(canvas: HTMLCanvasElement, hues: number[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width / hues.length;
  hues.forEach((h, i) => {
    ctx.fillStyle = `hsl(${h * 360}, 70%, 50%)`;
    ctx.fillRect(Math.floor(i * w), 0, Math.ceil(w), canvas.height);
  });
}

export function mountCharts(root: HTMLElement): { update(history: StatPoint[]): void } {
  root.innerHTML = '';
  /** Appends a titled row; returns the span for its value text. */
  function addRow(title: string, body: HTMLElement): HTMLElement {
    const el = document.createElement('div');
    el.className = 'chart-row';
    const head = document.createElement('div');
    head.className = 'chart-head';
    const name = document.createElement('span');
    name.textContent = title;
    const value = document.createElement('span');
    value.className = 'chart-val';
    head.append(name, value);
    el.append(head, body);
    root.append(el);
    return value;
  }

  const rows = ROWS.map(row => {
    const canvas = makeCanvas(SPARK_W, SPARK_H);
    return { row, canvas, value: addRow(row.title, canvas) };
  });

  const hueRows = SEXES.map(sex => {
    const canvas = makeCanvas(SPARK_W, 12);
    addRow(sex.title, canvas);
    return { sex, canvas };
  });

  const patBody = document.createElement('div');
  patBody.className = 'pattern-line';
  const patIcons = SEXES.map(sex => {
    const icon = makeCanvas(40, 20);
    const label = document.createElement('span');
    patBody.append(`${sex.sym} `, icon, label);
    return { sex, icon, label };
  });
  addRow('Top pattern', patBody);

  return {
    update(history) {
      const last = history.at(-1);
      for (const { row, canvas, value } of rows) {
        sparkline(canvas, row.lines.map(l => ({ values: history.map(l.get), color: l.color })));
        value.textContent = last
          ? row.lines.map(l => `${l.name ? l.name + ' ' : ''}${row.fmt(l.get(last))}`).join(' · ')
          : '';
      }
      for (const { sex, canvas } of hueRows) drawHueStrip(canvas, history.map(sex.hue));
      for (const { sex, icon, label } of patIcons) {
        label.textContent = last ? sex.pat(last) : '';
        if (last) {
          const hue = sex.hue(last);
          drawFishIcon(icon, { hue, brightness: 0.6, pattern: sex.pat(last), patternCount: 3, hue2: (hue + 0.5) % 1 });
        } else {
          icon.getContext('2d')!.clearRect(0, 0, icon.width, icon.height);
        }
      }
    },
  };
}
