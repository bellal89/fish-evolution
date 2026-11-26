import { CONFIG } from '../sim/config';
import { patternMarks } from './patterns';
import type { StatPoint } from '../sim/stats';
import type { ColorGenes, Pattern } from '../sim/traits';

export interface Line {
  values: number[];
  color: string;
}

/** One small line chart; all lines share the y range (from 0 for non-negative data). */
export function sparkline(canvas: HTMLCanvasElement, lines: Line[]): void {
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

/** A tiny fish body with the pattern, for swatches and the top-pattern rows. */
export function drawFishIcon(canvas: HTMLCanvasElement, c: ColorGenes): void {
  const ctx = canvas.getContext('2d')!;
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);
  const hl = W * 0.42, hh = H * 0.34;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, hl, hh, 0, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${c.hue * 360}, ${20 + 70 * c.brightness}%, ${32 + 26 * c.brightness}%)`;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = `hsl(${c.hue2 * 360}, ${25 + 65 * c.brightness}%, ${22 + 40 * c.brightness}%)`;
  for (const m of patternMarks(c, 1, hl, hh)) {
    ctx.beginPath();
    if (m.kind === 'spot') ctx.arc(m.x, m.y, m.w, 0, Math.PI * 2);
    else ctx.rect(m.x - m.w, m.y - m.h, m.w * 2, m.h * 2);
    ctx.fill();
  }
  ctx.restore();
}

type Num = (p: StatPoint) => number;

interface Row {
  title: string;
  /** Lines to draw; the last value of each is shown as text. */
  lines: { name: string; get: Num; color: string }[];
  fmt?: (v: number) => string;
}

const f1 = (v: number): string => v.toFixed(1);
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const secs = (v: number): string => `${Math.round(v / CONFIG.TICKS_PER_SEC)}s`;

const ROWS: Row[] = [
  {
    title: 'Population',
    lines: [
      { name: 'all', get: p => p.population, color: '#dfe' },
      { name: 'M', get: p => p.males, color: '#6ab0ff' },
      { name: 'F', get: p => p.females, color: '#ff8ac0' },
    ],
    fmt: v => String(Math.round(v)),
  },
  { title: 'Eggs', lines: [{ name: '', get: p => p.eggs, color: '#f5e6a0' }], fmt: v => String(Math.round(v)) },
  { title: 'Avg lifespan', lines: [{ name: '', get: p => p.avgLifespan, color: '#b8e0a0' }], fmt: secs },
  { title: 'Offspring per fish', lines: [{ name: '', get: p => p.avgChildren, color: '#e0b0ff' }], fmt: f1 },
  { title: 'Size', lines: [{ name: '', get: p => p.avgSize, color: '#9ad' }], fmt: f1 },
  { title: 'Speed', lines: [{ name: '', get: p => p.avgSpeed, color: '#fc8' }], fmt: f1 },
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
  { title: 'Escapes', lines: [{ name: '', get: p => p.escapeRate, color: '#f88' }], fmt: pct },
  { title: 'Food per fish', lines: [{ name: '', get: p => p.foodPerFish, color: '#8d8' }], fmt: v => v.toFixed(2) },
  { title: 'Matings per fish', lines: [{ name: '', get: p => p.matingsPerFish, color: '#f9c' }], fmt: v => v.toFixed(2) },
];

const SPARK_W = 220, SPARK_H = 36;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Hue history as a strip of colored blocks (one per sampled point). */
function drawHueStrip(canvas: HTMLCanvasElement, hues: number[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width / Math.max(hues.length, 1);
  hues.forEach((h, i) => {
    ctx.fillStyle = `hsl(${h * 360}, 70%, 50%)`;
    ctx.fillRect(Math.floor(i * w), 0, Math.ceil(w), canvas.height);
  });
}

export function mountCharts(root: HTMLElement): { update(history: StatPoint[]): void } {
  root.innerHTML = '';
  const rows = ROWS.map(row => {
    const el = document.createElement('div');
    el.className = 'chart-row';
    const head = document.createElement('div');
    head.className = 'chart-head';
    const title = document.createElement('span');
    title.textContent = row.title;
    const value = document.createElement('span');
    value.className = 'chart-val';
    head.append(title, value);
    const canvas = makeCanvas(SPARK_W, SPARK_H);
    el.append(head, canvas);
    root.append(el);
    return { row, canvas, value };
  });

  const hueRows = (['M', 'F'] as const).map(sex => {
    const el = document.createElement('div');
    el.className = 'chart-row';
    const head = document.createElement('div');
    head.className = 'chart-head';
    head.textContent = sex === 'M' ? 'Male hue' : 'Female hue';
    const canvas = makeCanvas(SPARK_W, 12);
    el.append(head, canvas);
    root.append(el);
    return { sex, canvas };
  });

  const patRow = document.createElement('div');
  patRow.className = 'chart-row';
  const patHead = document.createElement('div');
  patHead.className = 'chart-head';
  patHead.textContent = 'Top pattern';
  const patBody = document.createElement('div');
  patBody.className = 'pattern-line';
  const patIcons = (['M', 'F'] as const).map(sex => {
    const icon = makeCanvas(40, 20);
    const label = document.createElement('span');
    patBody.append(sex === 'M' ? '♂ ' : '♀ ', icon, label);
    return { sex, icon, label };
  });
  patRow.append(patHead, patBody);
  root.append(patRow);

  const iconColor = (hue: number, pattern: Pattern): ColorGenes =>
    ({ hue, brightness: 0.6, pattern, patternCount: 3, hue2: (hue + 0.5) % 1 });

  return {
    update(history) {
      if (history.length === 0) return;
      const last = history[history.length - 1];
      for (const { row, canvas, value } of rows) {
        sparkline(canvas, row.lines.map(l => ({ values: history.map(l.get), color: l.color })));
        value.textContent = row.lines
          .map(l => `${l.name ? l.name + ' ' : ''}${(row.fmt ?? f1)(l.get(last))}`)
          .join(' · ');
      }
      for (const { sex, canvas } of hueRows) {
        drawHueStrip(canvas, history.map(p => (sex === 'M' ? p.avgHueM : p.avgHueF)));
      }
      for (const { sex, icon, label } of patIcons) {
        const pattern = sex === 'M' ? last.topPatternM : last.topPatternF;
        label.textContent = pattern;
        drawFishIcon(icon, iconColor(sex === 'M' ? last.avgHueM : last.avgHueF, pattern));
      }
    },
  };
}
