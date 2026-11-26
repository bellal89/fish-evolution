import { CONFIG } from '../sim/config';
import type { ColorGenes } from '../sim/traits';
import type { FishView, PredatorSnap, Rock, SceneView, SelectedView } from '../protocol';
import { patternMarks } from './patterns';
import type { View } from './view';

/** Wall-clock seconds, only for decorative motion (sway, tail wiggle). */
type Time = number;

/** Fish are drawn a bit larger than their collision size so patterns are readable. */
const FISH_DRAW_SCALE = 1.35;

function fishBodyColor(c: ColorGenes): string {
  return `hsl(${c.hue * 360}, ${20 + 70 * c.brightness}%, ${32 + 26 * c.brightness}%)`;
}

function fishPatternColor(c: ColorGenes): string {
  return `hsl(${c.hue2 * 360}, ${25 + 65 * c.brightness}%, ${22 + 40 * c.brightness}%)`;
}

export function drawAquarium(ctx: CanvasRenderingContext2D, scene: SceneView, view: View, t: Time, selected: SelectedView | null = null): void {
  const { tankW: W, tankH: H } = scene;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1820';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);

  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  drawWater(ctx, W, H, t);
  drawSand(ctx, W, H);
  for (const r of scene.rocks) drawRock(ctx, r);
  for (const a of scene.food.algae) drawAlgae(ctx, a.x, a.y, a.biomass, t);
  drawParticles(ctx, scene);
  for (const f of scene.fish) drawFish(ctx, f, t);
  for (const p of scene.predators) drawPredator(ctx, p, t);
  if (selected) drawSelection(ctx, scene, selected);

  ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, W: number, H: number, t: Time): void {
  const hue = CONFIG.BG_WATER_HUE * 360;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${hue - 8}, 55%, 46%)`);
  g.addColorStop(0.55, `hsl(${hue}, 60%, 30%)`);
  g.addColorStop(1, `hsl(${hue + 6}, 65%, 18%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Decorative light shafts — light has no effect on the simulation.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = ((i + 0.5) / 6) * W + Math.sin(t * 0.15 + i * 1.7) * 60;
    const w = 50 + 30 * Math.sin(i * 2.3);
    const lg = ctx.createLinearGradient(0, 0, 0, H * 0.9);
    lg.addColorStop(0, 'rgba(200,240,255,0.10)');
    lg.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, 0);
    ctx.lineTo(x + w * 0.5, 0);
    ctx.lineTo(x + w * 1.6 + 120, H * 0.9);
    ctx.lineTo(x + w * 0.2 + 120, H * 0.9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSand(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const top = H - CONFIG.SAND_H;
  const hue = CONFIG.BG_SAND_HUE * 360;
  const g = ctx.createLinearGradient(0, top - 10, 0, H);
  g.addColorStop(0, `hsl(${hue}, 35%, 52%)`);
  g.addColorStop(1, `hsl(${hue - 4}, 30%, 30%)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) {
    ctx.lineTo(x, top + Math.sin(x * 0.012) * 6 + Math.sin(x * 0.037) * 3);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

function drawRock(ctx: CanvasRenderingContext2D, r: Rock): void {
  const g = ctx.createRadialGradient(r.x - r.rx * 0.3, r.y - r.ry * 0.8, r.rx * 0.1, r.x, r.y, r.rx * 1.2);
  g.addColorStop(0, '#9aa3a8');
  g.addColorStop(1, '#3f474c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}

function drawAlgae(ctx: CanvasRenderingContext2D, x: number, y: number, biomass: number, t: Time): void {
  const h = 14 + 70 * biomass;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const bx = x + (i - 1) * 5;
    const sway = Math.sin(t * 0.8 + x * 0.05 + i) * h * 0.25;
    ctx.strokeStyle = `hsl(${105 + i * 12}, ${45 + 30 * biomass}%, ${22 + 18 * biomass}%)`;
    ctx.lineWidth = 3.5 - i * 0.6;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx - sway * 0.5, y - h * 0.5, bx + sway, y - h * (0.8 + 0.1 * i));
    ctx.stroke();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, scene: SceneView): void {
  ctx.fillStyle = 'rgba(170,255,160,0.75)';
  for (const p of scene.food.plankton) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(105,78,45,0.85)';
  for (const w of scene.food.waste) {
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 1.5 + Math.sqrt(w.amount) * 1.1, 1.1 + Math.sqrt(w.amount) * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const e of scene.food.eggs) {
    ctx.fillStyle = 'rgba(255,228,170,0.8)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,40,20,0.8)';
    ctx.beginPath();
    ctx.arc(e.x + 0.8, e.y - 0.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Body outline in local coordinates: head at +hl, tail joint at -hl. */
function bodyPath(ctx: CanvasRenderingContext2D, hl: number, hh: number): void {
  ctx.beginPath();
  ctx.moveTo(hl, 0);
  ctx.bezierCurveTo(hl * 0.8, -hh * 1.1, -hl * 0.6, -hh * 1.05, -hl, -hh * 0.15);
  ctx.lineTo(-hl, hh * 0.15);
  ctx.bezierCurveTo(-hl * 0.6, hh * 1.05, hl * 0.8, hh * 1.1, hl, 0);
  ctx.closePath();
}

/** Rotate into the fish frame, keeping the back up when swimming left. */
function enterFrame(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number): void {
  ctx.translate(x, y);
  ctx.rotate(heading);
  if (Math.cos(heading) < 0) ctx.scale(1, -1);
}

function drawFish(ctx: CanvasRenderingContext2D, f: FishView, t: Time): void {
  const c = f.color;
  const s = f.size * FISH_DRAW_SCALE;
  const hl = s * 1.3;
  const hh = s * 0.6;
  const body = fishBodyColor(c);
  const accent = c.pattern === 'solid' ? body : fishPatternColor(c);
  const fin = f.sex === 'M' ? accent : body;
  const wiggle = Math.sin(t * 9 + f.id) * 0.25;

  ctx.save();
  enterFrame(ctx, f.x, f.y, f.heading);

  // Tail: males get a large fan tail in the accent color (guppy-like), females a small fork.
  ctx.save();
  ctx.translate(-hl, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = fin;
  ctx.globalAlpha = f.sex === 'M' ? 0.9 : 1;
  ctx.beginPath();
  if (f.sex === 'M') {
    const L = s * 1.1, S = s * 0.8;
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-L * 0.4, -S * 1.1, -L, -S);
    ctx.quadraticCurveTo(-L * 1.1, 0, -L, S);
    ctx.quadraticCurveTo(-L * 0.4, S * 1.1, 2, 0);
  } else {
    const L = s * 0.8, S = s * 0.5;
    ctx.moveTo(2, 0);
    ctx.lineTo(-L, -S);
    ctx.lineTo(-L * 0.7, 0);
    ctx.lineTo(-L, S);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Dorsal fin.
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(hl * 0.25, -hh * 0.9);
  ctx.quadraticCurveTo(-hl * 0.2, -hh * (f.sex === 'M' ? 2.0 : 1.5), -hl * 0.6, -hh * 0.75);
  ctx.closePath();
  ctx.fill();

  // Body with pattern clipped inside.
  bodyPath(ctx, hl, hh);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  bodyPath(ctx, hl, hh);
  ctx.clip();
  ctx.fillStyle = accent;
  for (const m of patternMarks(c, f.id, hl, hh)) {
    ctx.beginPath();
    if (m.kind === 'spot') ctx.arc(m.x, m.y, m.w, 0, Math.PI * 2);
    else ctx.rect(m.x - m.w, m.y - m.h, m.w * 2, m.h * 2);
    ctx.fill();
  }
  // Soft belly highlight for volume.
  const g = ctx.createLinearGradient(0, -hh, 0, hh);
  g.addColorStop(0, 'rgba(0,0,0,0.18)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(-hl, -hh * 1.2, hl * 2, hh * 2.4);
  ctx.restore();

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.8;
  bodyPath(ctx, hl, hh);
  ctx.stroke();

  // Eye.
  ctx.fillStyle = '#f4f4f0';
  ctx.beginPath();
  ctx.arc(hl * 0.58, -hh * 0.2, hh * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(hl * 0.62, -hh * 0.2, hh * 0.13, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPredator(ctx: CanvasRenderingContext2D, p: PredatorSnap, t: Time): void {
  const hl = p.size * 1.5;
  const hh = p.size * 0.55;
  const wiggle = Math.sin(t * (p.state === 'chase' ? 14 : 5)) * 0.2;

  ctx.save();
  enterFrame(ctx, p.x, p.y, p.heading);

  // Tail.
  ctx.save();
  ctx.translate(-hl, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = '#2c3a42';
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-p.size * 0.9, -p.size * 0.75);
  ctx.lineTo(-p.size * 0.55, 0);
  ctx.lineTo(-p.size * 0.9, p.size * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Spiky dorsal fin.
  ctx.fillStyle = '#26333a';
  ctx.beginPath();
  ctx.moveTo(hl * 0.3, -hh * 0.85);
  for (let i = 0; i < 5; i++) {
    const x = hl * 0.3 - (i + 0.5) * hl * 0.2;
    ctx.lineTo(x, -hh * (1.7 - i * 0.12));
    ctx.lineTo(x - hl * 0.1, -hh * 0.9);
  }
  ctx.closePath();
  ctx.fill();

  // Body: dark back, pale belly.
  bodyPath(ctx, hl, hh);
  const g = ctx.createLinearGradient(0, -hh, 0, hh);
  g.addColorStop(0, '#33444d');
  g.addColorStop(0.55, '#5d6f76');
  g.addColorStop(1, '#b9c3bd');
  ctx.fillStyle = g;
  ctx.fill();
  if (p.state === 'chase') {
    ctx.fillStyle = 'rgba(220,40,30,0.4)';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Jaw and teeth.
  ctx.strokeStyle = '#1b2327';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hl, hh * 0.05);
  ctx.lineTo(hl * 0.55, hh * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#f2f2ea';
  for (let i = 0; i < 4; i++) {
    const x = hl * (0.95 - i * 0.1);
    const y = hh * (0.08 + i * 0.055);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - hl * 0.04, y + hh * 0.14);
    ctx.lineTo(x - hl * 0.08, y);
    ctx.closePath();
    ctx.fill();
  }

  // Eye: red while chasing.
  ctx.fillStyle = p.state === 'chase' ? '#ff4a3a' : '#e8c060';
  ctx.beginPath();
  ctx.arc(hl * 0.62, -hh * 0.3, hh * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(hl * 0.65, -hh * 0.3, hh * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Vision rays (same angle formula as the senses) and a ring around the selected fish. */
function drawSelection(ctx: CanvasRenderingContext2D, scene: SceneView, sel: SelectedView): void {
  const f = scene.fish.find(x => x.id === sel.fish.id);
  if (!f) return;
  const { viewAngle, viewRange } = sel.fish.traits;
  const n = CONFIG.RAY_COUNT;
  ctx.save();
  ctx.lineWidth = 1.5;
  for (let i = 0; i < n; i++) {
    const a = f.heading + viewAngle * (i / (n - 1) - 0.5);
    const hit = Math.max(sel.fish.inputs[3 * i] ?? 0, sel.fish.inputs[3 * i + 1] ?? 0, sel.fish.inputs[3 * i + 2] ?? 0);
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.7 * Math.min(1, hit)})`;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x + Math.cos(a) * viewRange, f.y + Math.sin(a) * viewRange);
    ctx.stroke();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.size * FISH_DRAW_SCALE * 2.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
