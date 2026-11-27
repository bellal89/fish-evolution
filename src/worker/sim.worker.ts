/// <reference lib="webworker" />
import type { FromWorker, ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';
import { SAVE_VERSION, packSave, unpackSave } from '../saveFile';
import { SimLoop, type LoopSave } from './loop';

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

async function exportWorld(loop: SimLoop): Promise<void> {
  const save = loop.save();
  const { buffer } = await packSave(save);
  postMessage({ type: 'exported', data: buffer, tick: save.world.tick } satisfies FromWorker, [buffer]);
}

async function importWorld(loop: SimLoop, data: ArrayBuffer): Promise<void> {
  try {
    loop.importSave(await unpackSave(new Uint8Array(data)));
  } catch {
    postMessage({ type: 'importResult', error: 'This file is not a world from this version of the app. Nothing changed.' } satisfies FromWorker);
    return;
  }
  postMessage({ type: 'importResult', error: null } satisfies FromWorker);
  await save(loop);
}

function run(loop: SimLoop): void {
  self.onmessage = (e: MessageEvent<ToWorker>) => {
    const msg = e.data;
    if (msg.type === 'export') exportWorld(loop);
    else if (msg.type === 'import') importWorld(loop, msg.data).catch(() => {});
    else loop.handle(msg);
    if (msg.type === 'reset' || msg.type === 'save') save(loop).catch(() => {});
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
