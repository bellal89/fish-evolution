/// <reference lib="webworker" />
import type { ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';
import { SimLoop, type LoopSave } from './loop';

/** Bump when the saved state changes shape, so that an old save is ignored. */
const SAVE_VERSION = 1;
const SAVE_KEY = 'world';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fish-evolution', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('saves');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const dbReady = openDb();

async function readSave(): Promise<LoopSave | null> {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const req = db.transaction('saves').objectStore('saves').get(SAVE_KEY);
    req.onsuccess = () => resolve(req.result?.version === SAVE_VERSION ? req.result.data : null);
    req.onerror = () => reject(req.error);
  });
}

async function save(loop: SimLoop): Promise<void> {
  const db = await dbReady;
  db.transaction('saves', 'readwrite').objectStore('saves').put({ version: SAVE_VERSION, data: loop.save() }, SAVE_KEY);
}

function run(loop: SimLoop): void {
  self.onmessage = (e: MessageEvent<ToWorker>) => {
    loop.handle(e.data);
    if (e.data.type === 'reset' || e.data.type === 'save') save(loop).catch(() => {});
  };
  setInterval(() => save(loop).catch(() => {}), CONFIG.SAVE_INTERVAL_MS);
  const frame = (): void => {
    const start = performance.now();
    loop.frame(start);
    const spent = performance.now() - start;
    setTimeout(frame, Math.max(0, CONFIG.WORKER_TIMER_MS - spent));
  };
  frame();
}

// Without storage (for example, a private window) the world starts fresh and is not saved.
readSave()
  .catch(() => null)
  .then(saved => run(new SimLoop(saved ?? Date.now(), m => postMessage(m))));
