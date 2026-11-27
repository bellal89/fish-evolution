/// <reference lib="webworker" />
import type { ToWorker } from '../protocol';
import { CONFIG } from '../sim/config';
import { SimLoop } from './loop';

const loop = new SimLoop(Date.now(), m => postMessage(m));

self.onmessage = (e: MessageEvent<ToWorker>) => loop.handle(e.data);

function runFrame(): void {
  const start = performance.now();
  loop.frame(start);
  const spent = performance.now() - start;
  setTimeout(runFrame, Math.max(0, CONFIG.WORKER_TIMER_MS - spent));
}
runFrame();
