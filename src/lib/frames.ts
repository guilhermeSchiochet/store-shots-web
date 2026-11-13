// Carrega as molduras e detecta a tela (área transparente conectada ao centro).
// A região vira uma MÁSCARA no formato exato da tela (cantos, ilha dinâmica),
// expandida 2 px para não deixar fresta sob a borda suavizada da moldura.
import { FRAMES, type FrameDef } from "./models";
import type { FrameInfo } from "./geometry";

export interface LoadedFrame extends FrameInfo {
  /** Fim da câmera (ilha dinâmica, notch ou furo) em fração da altura da tela; 0 = sem câmera. */
  cameraInset: number;
  image: ImageBitmap;
  mask: ImageBitmap;
}

const cache = new Map<string, Promise<LoadedFrame>>();
const ready = new Map<string, LoadedFrame>();
const listeners = new Set<() => void>();

export const frameBank = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: (id: string) => ready.get(id),
  load(def: FrameDef) {
    let p = cache.get(def.id);
    if (!p) {
      p = loadFrame(def).then((f) => {
        ready.set(def.id, f);
        listeners.forEach((l) => l());
        return f;
      });
      cache.set(def.id, p);
    }
    return p;
  },
  loadAll: () => Promise.all(FRAMES.map((f) => frameBank.load(f))),
};

async function loadFrame(def: FrameDef): Promise<LoadedFrame> {
  const blob = await (await fetch(def.src)).blob();
  const image = await createImageBitmap(blob);
  const w = image.width;
  const h = image.height;
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  const clear = (x: number, y: number) => px[(y * w + x) * 4 + 3] < 128;

  const cx = w >> 1;
  const cy = h >> 1;
  if (!clear(cx, cy)) throw new Error(`Moldura ${def.name}: o centro não é transparente.`);

  // Flood fill por linhas a partir do centro.
  const mask = new Uint8Array(w * h);
  let minX = cx, maxX = cx, minY = cy, maxY = cy;
  const stack = [cy * w + cx];
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % w;
    const y = (idx / w) | 0;
    if (mask[idx] || !clear(x, y)) continue;
    let xl = x;
    while (xl > 0 && !mask[y * w + xl - 1] && clear(xl - 1, y)) xl--;
    let xr = x;
    while (xr < w - 1 && !mask[y * w + xr + 1] && clear(xr + 1, y)) xr++;
    for (let xx = xl; xx <= xr; xx++) mask[y * w + xx] = 1;
    minX = Math.min(minX, xl);
    maxX = Math.max(maxX, xr);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= h) continue;
      let inRun = false;
      for (let xx = xl; xx <= xr; xx++) {
        const ok = !mask[ny * w + xx] && clear(xx, ny);
        if (ok && !inRun) {
          stack.push(ny * w + xx);
          inRun = true;
        } else if (!ok) inRun = false;
      }
    }
  }

  // Dilata 2 px (vizinhança de 4), só perto da tela.
  let cur = mask;
  const y0 = Math.max(0, minY - 3), y1 = Math.min(h - 1, maxY + 3);
  const x0 = Math.max(0, minX - 3), x1 = Math.min(w - 1, maxX + 3);
  for (let pass = 0; pass < 2; pass++) {
    const next = cur.slice();
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (cur[y * w + x]) {
          if (x > 0) next[y * w + x - 1] = 1;
          if (x < w - 1) next[y * w + x + 1] = 1;
          if (y > 0) next[(y - 1) * w + x] = 1;
          if (y < h - 1) next[(y + 1) * w + x] = 1;
        }
    cur = next;
  }
  const out = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) if (cur[i]) out.data[i * 4 + 3] = 255;
  const m = new OffscreenCanvas(w, h);
  m.getContext("2d")!.putImageData(out, 0, 0);

  // Câmera: buracos opacos na faixa central do topo da tela (ilha, notch, furo).
  // A faixa central evita confundir com os cantos arredondados.
  const sw = maxX + 1 - minX;
  const sh = maxY + 1 - minY;
  let cameraBottom = -1;
  for (let y = minY; y < minY + sh * 0.15; y++) {
    for (let x = Math.round(minX + sw * 0.2); x < minX + sw * 0.8; x++) {
      if (!mask[y * w + x]) {
        cameraBottom = y;
        break;
      }
    }
  }

  return {
    image,
    mask: await createImageBitmap(m),
    size: { w, h },
    screen: { x: minX, y: minY, w: sw, h: sh },
    cameraInset: cameraBottom < 0 ? 0 : (cameraBottom + 1 - minY) / sh,
  };
}
