import type { Genome } from '../neat/genome';
import { INPUT_LABELS } from '../sim/senses';

interface Pos {
  x: number;
  y: number;
}

/** Inputs (and bias) on the left, outputs on the right, hidden nodes by longest-path depth. Coordinates in [0,1]. */
export function layoutBrain(g: Genome): Map<number, Pos> {
  const left = g.nodes.filter(n => n.kind === 'input' || n.kind === 'bias');
  const right = g.nodes.filter(n => n.kind === 'output');
  const hidden = g.nodes.filter(n => n.kind === 'hidden');

  const depth = new Map<number, number>();
  for (const n of hidden) depth.set(n.id, 1);
  let changed: boolean;
  do {
    changed = false;
    for (const c of g.conns) {
      if (!c.enabled || !depth.has(c.to)) continue;
      const d = (depth.get(c.from) ?? 0) + 1;
      if (d > depth.get(c.to)!) {
        depth.set(c.to, d);
        changed = true;
      }
    }
  } while (changed);
  const maxDepth = Math.max(1, ...depth.values());

  const columns = new Map<number, number[]>();
  for (const n of hidden) {
    const d = depth.get(n.id)!;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(n.id);
  }

  const pos = new Map<number, Pos>();
  const place = (ids: number[], x: number): void => {
    ids.forEach((id, i) => pos.set(id, { x, y: ids.length === 1 ? 0.5 : i / (ids.length - 1) }));
  };
  place(left.map(n => n.id), 0);
  place(right.map(n => n.id), 1);
  for (const [d, ids] of columns) place(ids, d / (maxDepth + 1));
  return pos;
}

const MARGIN_L = 78;
const MARGIN_R = 44;
const PAD_Y = 8;
const OUT_LABELS = ['turn', 'thrust', 'mate'];

/** Draws into the whole canvas. Edges colored by weight sign; nodes filled by activation (-1..1). */
export function drawBrain(ctx: CanvasRenderingContext2D, g: Genome, activations?: Map<number, number>): void {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);
  const pos = layoutBrain(g);
  const px = (p: Pos): number => MARGIN_L + p.x * (W - MARGIN_L - MARGIN_R);
  const py = (p: Pos): number => PAD_Y + p.y * (H - 2 * PAD_Y);

  for (const c of g.conns) {
    if (!c.enabled) continue;
    const a = pos.get(c.from)!, b = pos.get(c.to)!;
    ctx.strokeStyle = c.weight >= 0 ? 'rgba(90,200,120,0.55)' : 'rgba(230,90,90,0.55)';
    ctx.lineWidth = Math.min(4, 0.4 + Math.abs(c.weight));
    ctx.beginPath();
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
    ctx.stroke();
  }

  const inputs = g.nodes.filter(n => n.kind === 'input');
  const outputs = g.nodes.filter(n => n.kind === 'output');
  const r = Math.max(2.5, Math.min(6, (H / (inputs.length + 1)) * 0.35));
  ctx.font = '9px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const n of g.nodes) {
    const p = pos.get(n.id)!;
    const v = activations?.get(n.id);
    ctx.beginPath();
    ctx.arc(px(p), py(p), r, 0, Math.PI * 2);
    if (v === undefined) ctx.fillStyle = '#41586a';
    else {
      const a = Math.min(1, Math.abs(v));
      ctx.fillStyle = v >= 0 ? `rgba(255,220,90,${0.15 + 0.85 * a})` : `rgba(90,170,255,${0.15 + 0.85 * a})`;
    }
    ctx.fill();
    ctx.strokeStyle = '#9ab';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cde';
    if (n.kind === 'input' || n.kind === 'bias') {
      ctx.textAlign = 'right';
      ctx.fillText(n.kind === 'bias' ? 'bias' : INPUT_LABELS[n.id], px(p) - r - 3, py(p));
    } else if (n.kind === 'output') {
      ctx.textAlign = 'left';
      ctx.fillText(OUT_LABELS[outputs.indexOf(n)], px(p) + r + 3, py(p));
    }
  }
}
