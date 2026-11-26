import './style.css';
import { drawAquarium } from './ui/render';
import { makeDemoScene } from './ui/demoScene';
import { fitView } from './ui/view';

const app = document.getElementById('app')!;
app.innerHTML = `
  <canvas id="tank"></canvas>
  <div id="bar"><button id="reroll">New scene</button></div>
`;

const canvas = document.getElementById('tank') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let seed = 1;
let scene = makeDemoScene(seed);

document.getElementById('reroll')!.addEventListener('click', () => {
  scene = makeDemoScene(++seed);
});

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

function frame(ms: number): void {
  const view = fitView(canvas.width, canvas.height, scene.tankW, scene.tankH);
  drawAquarium(ctx, scene, view, ms / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
