// Cliente do Web Worker de análise. Um worker para o app todo; resultados em cache.
import type { ShotAnalysis } from "./detector";

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (r: ShotAnalysis | null) => void>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: ShotAnalysis; error?: string }>) => {
      waiting.get(e.data.id)?.(e.data.result ?? null);
      waiting.delete(e.data.id);
    };
  }
  return worker;
}

export function analyzeShot(blob: Blob): Promise<ShotAnalysis | null> {
  return new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    try {
      getWorker().postMessage({ id, blob });
    } catch {
      waiting.delete(id);
      resolve(null);
    }
  });
}
