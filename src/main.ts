import './style.css';
import type { FromWorker, Snapshot, ToWorker } from './protocol';
import { mountCharts } from './ui/charts';
import { mountControls } from './ui/controls';
import { pickFish } from './ui/pick';
import { mountInspector } from './ui/inspector';
import { drawAquarium } from './ui/render';
import { fitView, screenToWorld } from './ui/view';

const app = document.getElementById('app')!;
app.innerHTML = `
  <canvas id="tank"></canvas><div id="bar"></div>
  <aside id="side"><div id="inspector"></div><div id="charts"></div></aside>`;
const canvas = document.getElementById('tank') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
const inspector = mountInspector(document.getElementById('inspector')!);
const charts = mountCharts(document.getElementById('charts')!);
const send = (m: ToWorker): void => {
  if (m.type === 'select') inspector.setWanted(m.id);
  if (m.type === 'reset') inspector.setWanted(null);
  worker.postMessage(m);
};
const controls = mountControls(document.getElementById('bar')!, send);

let snap: Snapshot | null = null;
worker.onmessage = (e: MessageEvent<FromWorker>) => {
  snap = e.data.snap;
  controls.update(snap);
  if (snap.stats) {
    charts.update(snap.stats);
    inspector.setHistory(snap.stats);
  }
  inspector.update(snap);
};

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('click', e => {
  if (!snap) return;
  const dpr = canvas.width / canvas.clientWidth;
  const view = fitView(canvas.width, canvas.height, snap.tankW, snap.tankH);
  const r = canvas.getBoundingClientRect();
  const p = screenToWorld(view, (e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
  send({ type: 'select', id: pickFish(snap.fish, p.x, p.y) });
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') send({ type: 'select', id: null });
});

function frame(ms: number): void {
  if (snap) {
    const view = fitView(canvas.width, canvas.height, snap.tankW, snap.tankH);
    drawAquarium(ctx, snap, view, ms / 1000, snap.selected);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
