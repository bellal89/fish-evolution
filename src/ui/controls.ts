import type { Snapshot, Speed, ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';

const SPEEDS = [1, 10, 50, 'max'] as const;

function simTime(tick: number): string {
  const s = Math.floor(tick / CONFIG.TICKS_PER_SEC);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function mountControls(root: HTMLElement, send: (m: ToWorker) => void): { update(snap: Snapshot): void } {
  let speed: Speed = 1;
  let lastRunning: Exclude<Speed, 0> = 1;

  root.innerHTML = `
    <button data-act="pause">⏸</button>
    <button data-act="play">▶</button>
    ${SPEEDS.map(s => `<button data-speed>${s === 'max' ? s : `x${s}`}</button>`).join('')}
    <span id="info"></span>
    <div id="extinct" hidden><div>Population extinct</div><button id="restart">Start over</button></div>
  `;
  const info = root.querySelector<HTMLElement>('#info')!;
  const overlay = root.querySelector<HTMLElement>('#extinct')!;
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-act="pause"]')!;
  const playBtn = root.querySelector<HTMLButtonElement>('[data-act="play"]')!;
  const speedButtons = [...root.querySelectorAll<HTMLButtonElement>('button[data-speed]')];

  function setSpeed(s: Speed): void {
    speed = s;
    if (s !== 0) lastRunning = s;
    send({ type: 'speed', speed: s });
    highlight();
  }
  function highlight(): void {
    pauseBtn.classList.toggle('active', speed === 0);
    playBtn.classList.toggle('active', speed !== 0);
    speedButtons.forEach((b, i) => b.classList.toggle('active', SPEEDS[i] === speed));
  }

  pauseBtn.onclick = () => setSpeed(0);
  playBtn.onclick = () => setSpeed(lastRunning);
  speedButtons.forEach((b, i) => (b.onclick = () => setSpeed(SPEEDS[i])));
  root.querySelector<HTMLButtonElement>('#restart')!.onclick = () => {
    send({ type: 'reset', seed: Date.now() });
    setSpeed(1);
  };
  highlight();

  return {
    update(snap) {
      info.textContent = `tick ${snap.tick} · ${simTime(snap.tick)} · fish ${snap.fish.length}`;
      overlay.hidden = !snap.extinct;
    },
  };
}
