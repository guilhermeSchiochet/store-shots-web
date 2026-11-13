/// <reference lib="webworker" />
// Decodifica o print reduzido e analisa as barras sem travar a interface.
import { analyzeShotPixels } from "./detector.ts";

const WIDTH = 360;

self.onmessage = async (e: MessageEvent<{ id: number; blob: Blob }>) => {
  const { id, blob } = e.data;
  try {
    const full = await createImageBitmap(blob);
    const w = Math.min(WIDTH, full.width);
    const h = Math.max(16, Math.round((full.height * w) / full.width));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(full, 0, 0, w, h);
    full.close();
    const data = ctx.getImageData(0, 0, w, h).data;
    (self as unknown as Worker).postMessage({ id, result: analyzeShotPixels(data, w, h) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
