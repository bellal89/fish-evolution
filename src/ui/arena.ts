import type { ArenaSnapshot, ArenaSpeed, Side, ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';
import { drawBrain } from './brainView';
import { mountBrainPicker } from './brainPicker';
import { makeCanvas } from './charts';
import { simTime } from './controls';
import { pickFish } from './pick';
import { drawAquarium } from './render';
import { fitView, screenToWorld, type View } from './view';

/** Frame colors of the left and the right side. */
const FRAME = ['#e0a040', '#4ab8e8'];
const SPEEDS: ArenaSpeed[] = [0, 1, 10];

/** Two arena sides: brain picker, aquarium, counters and live brain of each. */
export function mountArena(root: HTMLElement, send: (m: ToWorker) => void): { update(a: ArenaSnapshot): void; draw(t: number): void } {
  root.innerHTML = `
    <div class="arena-bar">
      <button data-act="same" title="Start both sides again from the same start">Same start again</button>
      <button data-act="new" title="New food, fish positions and random brains">New start</button>
      ${SPEEDS.map(s => `<button data-speed>${s === 0 ? '⏸' : `x${s}`}</button>`).join('')}
      <label title="Fish per side. A change starts both sides again from the same start">fish <input type="number" min="1" max="150" value="${CONFIG.ARENA_FISH}"></label>
      <label title="Predators per side. A change starts both sides again from the same start">predators <input type="number" min="0" max="10" value="${CONFIG.ARENA_PREDATORS}"></label>
    </div>
    <div class="halves"></div>`;
  root.querySelector<HTMLButtonElement>('[data-act="same"]')!.onclick = () => send({ type: 'arenaRestart' });
  root.querySelector<HTMLButtonElement>('[data-act="new"]')!.onclick = () => send({ type: 'arenaRestart', seed: Date.now() });
  const [fishInput, predInput] = root.querySelectorAll<HTMLInputElement>('input');
  fishInput.onchange = predInput.onchange = () => send({
    type: 'arenaCount',
    count: Math.max(1, Math.round(fishInput.valueAsNumber) || 1),
    predators: Math.max(0, Math.round(predInput.valueAsNumber) || 0),
  });
  const speedButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-speed]')];
  speedButtons.forEach((b, i) => (b.onclick = () => send({ type: 'arenaSpeed', speed: SPEEDS[i] })));

  const halves = root.querySelector<HTMLElement>('.halves')!;
  let last: ArenaSnapshot | null = null;

  const sides = ([0, 1] as Side[]).map(side => {
    const half = document.createElement('div');
    half.className = 'half';
    half.style.borderColor = FRAME[side];
    const pickerRoot = document.createElement('div');
    const tank = document.createElement('canvas');
    tank.className = 'arena-tank';
    tank.style.borderColor = FRAME[side];
    const counters = document.createElement('div');
    counters.className = 'counters';
    const brain = makeCanvas(420, 300);
    brain.className = 'brain';
    half.append(pickerRoot, tank, counters, brain);
    halves.append(half);

    /** Last view drawn on this side; clicks map through it. */
    let view: View | null = null;
    tank.addEventListener('click', e => {
      if (!last || !view) return;
      const dpr = tank.width / tank.clientWidth;
      const r = tank.getBoundingClientRect();
      const p = screenToWorld(view, (e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
      send({ type: 'arenaSelect', side, id: pickFish(last.sides[side].scene.fish, p.x, p.y) });
    });

    return {
      picker: mountBrainPicker(pickerRoot, side, send),
      update(a: ArenaSnapshot): void {
        const { scene, foodEaten, genome } = a.sides[side];
        const alive = scene.fish.length;
        const food = `food ${foodEaten.toFixed(0)}`;
        counters.textContent = alive > 0
          ? `alive ${alive}/${a.count} · ${food} · ${simTime(scene.tick)}`
          : `all died at ${simTime(scene.tick)} · ${food}`;
        drawBrain(brain.getContext('2d')!, genome, scene.selected?.activations);
      },
      draw(a: ArenaSnapshot, t: number): void {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(tank.clientWidth * dpr);
        const h = Math.round(tank.clientHeight * dpr);
        if (tank.width !== w || tank.height !== h) {
          tank.width = w;
          tank.height = h;
        }
        const scene = a.sides[side].scene;
        view = fitView(w, h, scene.tankW, scene.tankH);
        drawAquarium(tank.getContext('2d')!, scene, view, t);
      },
    };
  });

  return {
    update(a) {
      last = a;
      speedButtons.forEach((b, i) => b.classList.toggle('active', SPEEDS[i] === a.speed));
      for (const s of sides) {
        s.picker.update(a);
        s.update(a);
      }
    },
    draw(t) {
      if (!last) return;
      for (const s of sides) s.draw(last, t);
    },
  };
}
