import type { Snapshot, Speed, ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';

const SPEEDS = [1, 10, 50, 'max'] as const;

/** Sim time as m:ss or h:mm:ss. */
export function simTime(tick: number): string {
  const s = Math.floor(tick / CONFIG.TICKS_PER_SEC);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const mmss = `${m}:${String(s % 60).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss.padStart(5, '0')}` : mmss;
}

/** `onArena(true)` opens the arena, `onArena(false)` returns to the main world. */
export function mountControls(
  root: HTMLElement, send: (m: ToWorker) => void, onArena: (open: boolean) => void,
): { update(snap: Snapshot): void } {
  let speed: Speed = 1;
  let lastRunning: Exclude<Speed, 0> = 1;

  root.innerHTML = `
    <button data-act="pause">⏸</button>
    <button data-act="play">▶</button>
    ${SPEEDS.map(s => s === 'max'
      ? '<button data-speed title="As fast as this computer can run the simulation">max</button>'
      : `<button data-speed>x${s}</button>`).join('')}
    <button data-act="restart" title="Start a new world">⟲ Restart</button>
    <button data-act="arena" title="Compare two brains side by side">Arena</button>
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
  const restart = (): void => {
    send({ type: 'reset', seed: Date.now() });
    setSpeed(1);
  };
  root.querySelector<HTMLButtonElement>('#restart')!.onclick = restart;
  root.querySelector<HTMLButtonElement>('[data-act="restart"]')!.onclick = () => {
    if (confirm('Start a new world? The current world will be lost.')) restart();
  };
  // The main speed and Restart act on the main world, which pauses while the arena is open.
  const mainButtons = [pauseBtn, playBtn, ...speedButtons, root.querySelector<HTMLButtonElement>('[data-act="restart"]')!];
  const arenaBtn = root.querySelector<HTMLButtonElement>('[data-act="arena"]')!;
  let arenaOpen = false;
  arenaBtn.onclick = () => {
    arenaOpen = !arenaOpen;
    arenaBtn.textContent = arenaOpen ? '← Back' : 'Arena';
    arenaBtn.title = arenaOpen ? 'Return to the main world' : 'Compare two brains side by side';
    for (const b of mainButtons) b.hidden = arenaOpen;
    onArena(arenaOpen);
  };
  highlight();

  return {
    update(snap) {
      info.textContent = `tick ${snap.tick} · ${simTime(snap.tick)} · fish ${snap.fish.length}`;
      overlay.hidden = !snap.extinct;
    },
  };
}
