import './style.css';
import type { FromWorker, Snapshot, ToWorker } from './protocol';
import { mountControls } from './ui/controls';
import { drawAquarium } from './ui/render';
import { fitView, screenToWorld } from './ui/view';

const app = document.getElementById('app')!;
app.innerHTML = `<canvas id="tank"></canvas><div id="bar"></div>`;
const canvas = document.getElementById('tank') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
const send = (m: ToWorker): void => worker.postMessage(m);
const controls = mountControls(document.getElementById('bar')!, send);

let snap: Snapshot | null = null;
worker.onmessage = (e: MessageEvent<FromWorker>) => {
  snap = e.data.snap;
  controls.update(snap);
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
  send({ type: 'selectAt', x: p.x, y: p.y });
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
