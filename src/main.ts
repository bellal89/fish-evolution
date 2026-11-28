import './style.css';
import type { FromWorker, Snapshot, ToWorker } from './protocol';
import { mountArena } from './ui/arena';
import { mountCharts } from './ui/charts';
import { mountControls, simTime } from './ui/controls';
import { pickFish } from './ui/pick';
import { mountInspector } from './ui/inspector';
import { drawAquarium } from './ui/render';
import { fitView, screenToWorld, type View } from './ui/view';

const app = document.getElementById('app')!;
app.innerHTML = `
  <canvas id="tank"></canvas><div id="bar"></div>
  <aside id="side"><div id="inspector"></div></aside>
  <div id="arena" hidden></div>`;
const canvas = document.getElementById('tank') as HTMLCanvasElement;
const side = document.getElementById('side')!;
const arenaRoot = document.getElementById('arena')!;
const ctx = canvas.getContext('2d')!;

const worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' });
const inspector = mountInspector(document.getElementById('inspector')!);
const charts = mountCharts(document.getElementById('charts')!);
const send = (m: ToWorker): void => {
  if (m.type === 'select') inspector.setWanted(m.id);
  if (m.type === 'reset') inspector.setWanted(null);
  worker.postMessage(m);
};
const arena = mountArena(arenaRoot, send);
let arenaOpen = false;
const controls = mountControls(document.getElementById('bar')!, send, open => {
  arenaOpen = open;
  send(open ? { type: 'arenaOpen', seed: Date.now() } : { type: 'arenaClose' });
  canvas.hidden = open;
  side.hidden = open;
  arenaRoot.hidden = !open;
});
// The tab may close after it hides; save then so that little progress is lost.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) send({ type: 'save' });
});

let snap: Snapshot | null = null;
worker.onmessage = (e: MessageEvent<FromWorker>) => {
  const m = e.data;
  switch (m.type) {
    case 'snapshot':
      snap = m.snap;
      controls.update(snap);
      if (snap.stats) charts.update(snap.stats);
      inspector.update(snap);
      break;
    case 'arena': arena.update(m.arena); break;
    case 'exported': download(new Blob([m.data]), `fish-evolution-${simTime(m.tick).replaceAll(':', '-')}.json.gz`); break;
    case 'importResult':
      if (m.error) alert(m.error);
      else inspector.setWanted(null);
      break;
  }
};

function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

/** Last view drawn by `frame`; clicks map through it. */
let view: View | null = null;

canvas.addEventListener('click', e => {
  if (!snap || !view) return;
  const dpr = canvas.width / canvas.clientWidth;
  const r = canvas.getBoundingClientRect();
  const p = screenToWorld(view, (e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
  send({ type: 'select', id: pickFish(snap.fish, p.x, p.y) });
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') send({ type: 'select', id: null });
});

function frame(ms: number): void {
  if (arenaOpen) arena.draw(ms / 1000);
  else if (snap) {
    view = fitView(canvas.width, canvas.height, snap.tankW, snap.tankH);
    drawAquarium(ctx, snap, view, ms / 1000);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
