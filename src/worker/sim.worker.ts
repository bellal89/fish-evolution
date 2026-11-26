/// <reference lib="webworker" />
import type { ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';
import { SimLoop } from './loop';

const loop = new SimLoop(Date.now(), m => postMessage(m));

self.onmessage = (e: MessageEvent<ToWorker>) => loop.handle(e.data);

function tick(): void {
  loop.frame(performance.now());
  setTimeout(tick, CONFIG.WORKER_TIMER_MS);
}
tick();
