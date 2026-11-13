// Desenho de um slide no Canvas, em coordenadas do slide (px de exportação).
// Preview e exportação chamam ESTA função; a única diferença é a escala do
// contexto e a resolução das imagens (preview reduzida × original).
import type { LoadedFrame } from "./frames";
import { safeInset, shotDestRect, shotSourceRect, type Box, type Rect } from "./geometry";
import {
  FONTS,
  frameFor,
  type BadgeLayer,
  type DeviceLayer,
  type ExportPreset,
  type FontId,
  type ImageLayer,
  type Layer,
  type Project,
  type ShapeLayer,
  type Slide,
  type TextLayer,
} from "./models";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface RenderEnv {
  project: Project;
  preset: ExportPreset;
  W: number;
  H: number;
  frame: (id: string) => LoadedFrame | undefined;
  image: (id: string | null) => ImageBitmap | undefined;
  /** Proporção (largura/altura) de uma imagem, mesmo antes do bitmap carregar. */
  aspect: (id: string | null) => number | null;
  /** Preview desenha marcadores para o que está vazio; a exportação não. */
  preview: boolean;
}

const SCREEN_EMPTY = "#e9edf2";
const UI_FONT = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';

// ------------------------------------------------------------ fontes

const familyCache = new Map<FontId, string>();
/** Família CSS real da fonte (as fontes do Next ganham nomes próprios). */
export function fontFamily(id: FontId): string {
  const hit = familyCache.get(id);
  if (hit) return hit;
  let fam = FONTS[id]?.fallback ?? UI_FONT;
  if (typeof document !== "undefined") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(FONTS[id].cssVar).trim();
    if (v) fam = v;
    familyCache.set(id, fam);
  }
  return fam;
}

// ------------------------------------------------------------ utilidades

const APPLE_D =
  "M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.78-7.87-12.24-14.37-6.09-8.86-10.9-18.7-14.43-29.5-3.53-10.8-5.3-21.2-5.3-31.2 0-14.07 3.52-25.7 10.57-34.91 7.04-9.2 15.96-13.88 26.75-14.02 5.02 0 10.52 1.34 16.5 4.02 5.97 2.68 9.77 4.07 11.4 4.17 1.3 0 5.2-1.48 11.71-4.44 6.52-2.96 12.35-4.27 17.51-3.92 13.59.78 24.32 5.86 32.19 15.24-11.83 7.15-17.6 16.89-17.3 29.21.32 9.68 4.18 17.65 11.58 23.9 7.4 6.25 15.95 9.73 25.65 10.45-2.07 6.42-4.55 12.87-7.46 19.34zM119.22 33.56c0-6.85 2.51-13.4 7.54-19.66 5.03-6.26 11.35-10.23 18.96-11.9 1.08 7.37-1.12 14.15-6.6 20.33-5.48 6.19-12.11 9.94-19.9 11.23z";
let apple: Path2D | null = null;
const applePath = () => (apple ??= new Path2D(APPLE_D));

/** Escala atual do contexto (px de saída por px do slide), mesmo com rotação. */
const scaleOf = (ctx: Ctx) => {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
};

function drawContain(ctx: Ctx, img: ImageBitmap, r: Rect) {
  const s = Math.min(r.w / img.width, r.h / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

function roundRect(ctx: Ctx, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, Math.max(0, Math.min(radius, r.w / 2, r.h / 2)));
}

/** Sombra suave proporcional ao tamanho; blur e deslocamento são em px de saída. */
function setShadow(ctx: Ctx, size: number, amount: number) {
  if (amount <= 0) return;
  const k = scaleOf(ctx);
  ctx.shadowColor = `rgba(15, 23, 42, ${0.18 + 0.27 * amount})`;
  ctx.shadowBlur = size * 0.07 * amount * k;
  ctx.shadowOffsetY = size * 0.03 * amount * k;
}

/** Cor dominante de uma linha do print (cabeçalho do app logo abaixo do corte). */
const rowColors = new WeakMap<ImageBitmap, Map<number, string>>();
let sampler: OffscreenCanvasRenderingContext2D | null = null;
function rowColor(img: ImageBitmap, y: number): string {
  const row = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  let map = rowColors.get(img);
  if (!map) rowColors.set(img, (map = new Map()));
  const hit = map.get(row);
  if (hit) return hit;
  sampler ??= new OffscreenCanvas(48, 1).getContext("2d", { willReadFrequently: true });
  let color = "#ffffff";
  if (sampler) {
    sampler.imageSmoothingEnabled = false;
    sampler.clearRect(0, 0, 48, 1);
    sampler.drawImage(img, 0, row, img.width, 1, 0, 0, 48, 1);
    const d = sampler.getImageData(0, 0, 48, 1).data;
    const count = new Map<number, number>();
    let best = 0;
    let bestN = 0;
    for (let i = 0; i < 48; i++) {
      const c = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
      const n = (count.get(c & 0xf0f0f0) ?? 0) + 1;
      count.set(c & 0xf0f0f0, n);
      if (n > bestN) {
        bestN = n;
        best = c;
      }
    }
    color = `#${best.toString(16).padStart(6, "0")}`;
  }
  map.set(row, color);
  return color;
}

// ------------------------------------------------------------ medidas das camadas

const BADGE_ASPECT = { apple: 3, google: 3.36 };

export const badgeStore = (l: BadgeLayer, preset: ExportPreset) =>
  l.store === "auto" ? (preset.platform === "ios" ? "apple" : "google") : l.store;

/** Moldura de uma camada de aparelho no tamanho exportado (null = sem moldura). */
export const deviceFrameDef = (l: DeviceLayer, preset: ExportPreset) => frameFor(l.shot.kind, preset.platform);

let measureCtx: OffscreenCanvasRenderingContext2D | null = null;
const measurer = () => (measureCtx ??= new OffscreenCanvas(1, 1).getContext("2d")!);

export interface TextLayout {
  lines: string[];
  font: string;
  size: number;
  lineH: number;
  w: number;
  h: number;
  pad: number;
}

/** Quebra o texto em linhas dentro da largura da camada. */
export function layoutText(l: TextLayer, W: number, ctx: Ctx = measurer()): TextLayout {
  const size = l.size * W;
  const font = `${l.italic ? "italic " : ""}${l.weight} ${size}px ${fontFamily(l.font)}`;
  ctx.font = font;
  ctx.letterSpacing = `${l.letterSpacing * size}px`;
  const pad = l.bg ? size * 0.35 : 0;
  const maxW = Math.max(1, l.w * W - pad * 2);
  const text = l.uppercase ? l.text.toLocaleUpperCase("pt-BR") : l.text;
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const test = `${line} ${word}`;
      if (ctx.measureText(test).width <= maxW) line = test;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  const lineH = size * l.lineHeight;
  return { lines, font, size, lineH, w: l.w * W, h: lines.length * lineH + pad * 2, pad };
}

/** Caixa (px do slide) de uma camada. */
export function layerBox(l: Layer, env: Pick<RenderEnv, "W" | "H" | "preset" | "frame" | "aspect">): Box {
  const w = l.w * env.W;
  let h: number;
  switch (l.type) {
    case "device": {
      const def = deviceFrameDef(l, env.preset);
      if (l.frame === "none") {
        const f = env.frame(def.id);
        h = f ? (w * f.screen.h) / f.screen.w : w / (def.aspect * 0.94);
      } else h = w / def.aspect;
      break;
    }
    case "text":
      h = layoutText(l, env.W).h;
      break;
    case "image":
      h = l.style === "icon" ? w : w / (env.aspect(l.imageId) ?? 1);
      break;
    case "badge": {
      const a = l.imageId ? env.aspect(l.imageId) : null;
      h = w / (a ?? BADGE_ASPECT[badgeStore(l, env.preset)]);
      break;
    }
    case "shape":
      h = w * l.ratio;
      break;
  }
  return { cx: l.x * env.W, cy: l.y * env.H, w, h, rot: l.rotation };
}

// ------------------------------------------------------------ desenho

export function renderSlide(ctx: Ctx, env: RenderEnv, slide: Slide, scratch: OffscreenCanvas) {
  const { W, H } = env;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawBackground(ctx, slide, W, H);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  for (const l of slide.layers) {
    if (l.hidden || l.opacity <= 0) continue;
    const b = layerBox(l, env);
    ctx.save();
    ctx.globalAlpha = l.opacity;
    ctx.translate(b.cx, b.cy);
    if (b.rot) ctx.rotate((b.rot * Math.PI) / 180);
    const r: Rect = { x: -b.w / 2, y: -b.h / 2, w: b.w, h: b.h };
    if (l.type === "device") drawDevice(ctx, env, l, r, scratch);
    else if (l.type === "text") drawText(ctx, l, r, W);
    else if (l.type === "image") drawImageLayer(ctx, env, l, r);
    else if (l.type === "badge") drawBadge(ctx, env, l, r);
    else drawShape(ctx, l, r);
    ctx.restore();
  }
  ctx.restore();
}

function drawBackground(ctx: Ctx, s: Slide, W: number, H: number) {
  if (s.bg.type === "solid") ctx.fillStyle = s.bg.a;
  else {
    const a = ((s.bg.angle - 90) * Math.PI) / 180;
    const len = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
    const dx = (Math.cos(a) * len) / 2;
    const dy = (Math.sin(a) * len) / 2;
    const g = ctx.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
    g.addColorStop(0, s.bg.a);
    g.addColorStop(1, s.bg.b);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, W, H);
}

function drawDevice(ctx: Ctx, env: RenderEnv, l: DeviceLayer, r: Rect, scratch: OffscreenCanvas) {
  const def = deviceFrameDef(l, env.preset);
  const frame = env.frame(def.id);
  const noFrame = l.frame === "none";
  if (!frame && !noFrame) return;
  const k = scaleOf(ctx);

  // Compõe o aparelho num canvas à parte, na resolução de saída.
  const cw = Math.max(1, Math.ceil(r.w * k));
  const ch = Math.max(1, Math.ceil(r.h * k));
  if (scratch.width !== cw || scratch.height !== ch) {
    scratch.width = cw;
    scratch.height = ch;
  }
  const s = scratch.getContext("2d")!;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = "source-over";
  s.clearRect(0, 0, cw, ch);
  s.setTransform(cw / r.w, 0, 0, ch / r.h, 0, 0);
  s.imageSmoothingEnabled = true;
  s.imageSmoothingQuality = "high";

  const fs = frame ? r.w / frame.size.w : 1;
  const screen: Rect = noFrame
    ? { x: 0, y: 0, w: r.w, h: r.h }
    : { x: frame!.screen.x * fs - 2, y: frame!.screen.y * fs - 2, w: frame!.screen.w * fs + 4, h: frame!.screen.h * fs + 4 };
  const camera = noFrame ? 0 : frame!.cameraInset;

  const shotId = env.project.shots[l.shot.kind][l.shot.index] ?? null;
  const shot = env.image(shotId);
  const adjust = env.project.adjust[l.shot.kind][l.shot.index];
  s.save();
  if (noFrame) roundRect(s, screen, l.radius * r.w);
  else {
    s.beginPath();
    s.rect(screen.x, screen.y, screen.w, screen.h);
  }
  s.clip();
  if (shot && adjust) {
    s.fillStyle = adjust.padColor ?? "#ffffff";
    s.fillRect(screen.x, screen.y, screen.w, screen.h);
    const img = { w: shot.width, h: shot.height };
    const src = shotSourceRect(img, adjust);
    const inset = safeInset(adjust, camera, screen.h);
    if (inset > 0) {
      s.fillStyle = rowColor(shot, src.y + 1);
      s.fillRect(screen.x, screen.y, screen.w, inset + 1);
    }
    const area = { x: screen.x, y: screen.y + inset, w: screen.w, h: screen.h - inset };
    s.beginPath();
    s.rect(area.x, area.y, area.w, area.h);
    s.clip();
    const dst = shotDestRect(img, adjust, area);
    s.drawImage(shot, src.x, src.y, src.w, src.h, area.x + dst.x, area.y + dst.y, dst.w, dst.h);
  } else {
    s.fillStyle = SCREEN_EMPTY;
    s.fillRect(screen.x, screen.y, screen.w, screen.h);
    if (!shotId && env.preview) {
      s.fillStyle = "#7a8594";
      s.textAlign = "center";
      s.textBaseline = "middle";
      const fz = screen.w * 0.075;
      s.font = `600 ${fz}px ${UI_FONT}`;
      const cx = screen.x + screen.w / 2;
      const cy = screen.y + screen.h / 2;
      s.fillText("Arraste ou clique", cx, cy - fz * 0.75);
      s.font = `500 ${fz * 0.85}px ${UI_FONT}`;
      s.fillText(`print ${l.shot.index + 1}`, cx, cy + fz * 0.75);
    }
  }
  s.restore();

  if (frame && !noFrame) {
    // Recorta no formato exato da tela; a moldura vai por cima.
    s.globalCompositeOperation = "destination-in";
    s.drawImage(frame.mask, 0, 0, r.w, r.h);
    s.globalCompositeOperation = "source-over";
    s.drawImage(frame.image, 0, 0, r.w, r.h);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x - r.w, r.y - r.h, r.w * 3, r.h * (1 - l.cut) + r.h); // corte da base
  ctx.clip();
  setShadow(ctx, r.w, l.shadow);
  ctx.drawImage(scratch, 0, 0, cw, ch, r.x, r.y, r.w, r.h);
  ctx.restore();
}

function drawText(ctx: Ctx, l: TextLayer, r: Rect, W: number) {
  const t = layoutText(l, W, ctx);
  if (l.bg) {
    ctx.fillStyle = l.bg;
    roundRect(ctx, r, t.size * 0.45);
    ctx.fill();
  }
  ctx.fillStyle = l.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = l.align;
  const x = l.align === "left" ? r.x + t.pad : l.align === "right" ? r.x + r.w - t.pad : 0;
  t.lines.forEach((line, i) => ctx.fillText(line, x, r.y + t.pad + t.lineH * (i + 0.5)));
  ctx.letterSpacing = "0px";
}

function placeholder(ctx: Ctx, r: Rect, label: string, round: number) {
  ctx.save();
  roundRect(ctx, r, round);
  ctx.fillStyle = "rgba(37, 99, 235, 0.06)";
  ctx.fill();
  ctx.setLineDash([r.w * 0.04, r.w * 0.03]);
  ctx.lineWidth = Math.max(1, r.w * 0.012);
  ctx.strokeStyle = "rgba(37, 99, 235, 0.55)";
  ctx.stroke();
  ctx.fillStyle = "rgba(30, 64, 175, 0.8)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.min(r.w, r.h) * 0.13}px ${UI_FONT}`;
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawImageLayer(ctx: Ctx, env: RenderEnv, l: ImageLayer, r: Rect) {
  const img = env.image(l.imageId);
  const radius = l.radius * r.w;
  if (!l.imageId) {
    if (env.preview) placeholder(ctx, r, l.style === "icon" ? "Ícone" : "Imagem", l.style === "icon" ? radius : r.w * 0.04);
    return;
  }
  if (!img) return;
  if (l.style === "icon") {
    ctx.save();
    setShadow(ctx, r.w, l.shadow);
    ctx.fillStyle = l.bg;
    roundRect(ctx, r, radius);
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, r, radius);
    ctx.clip();
    const pad = r.w * l.pad;
    drawContain(ctx, img, { x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 });
    ctx.restore();
    return;
  }
  ctx.save();
  if (radius > 0) {
    if (l.shadow > 0) {
      ctx.save();
      setShadow(ctx, r.w, l.shadow);
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, r, radius);
      ctx.fill();
      ctx.restore();
    }
    roundRect(ctx, r, radius);
    ctx.clip();
  } else setShadow(ctx, r.w, l.shadow);
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  ctx.restore();
}

function drawBadge(ctx: Ctx, env: RenderEnv, l: BadgeLayer, r: Rect) {
  if (l.imageId) {
    const img = env.image(l.imageId);
    if (img) ctx.drawImage(img, r.x, r.y, r.w, r.h);
    return;
  }
  const store = badgeStore(l, env.preset);
  const h = r.h;
  ctx.save();
  roundRect(ctx, r, h * 0.2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.lineWidth = h * 0.02;
  ctx.strokeStyle = "#a6a6a6";
  ctx.stroke();

  const small = store === "apple" ? "Baixar na" : "DISPONÍVEL NO";
  const big = store === "apple" ? "App Store" : "Google Play";
  const iconSize = h * 0.56;
  ctx.font = `${store === "apple" ? 400 : 500} ${h * 0.17}px ${UI_FONT}`;
  const sw = ctx.measureText(small).width;
  ctx.font = `600 ${h * 0.36}px ${UI_FONT}`;
  const bw = ctx.measureText(big).width;
  const gap = h * 0.12;
  const total = iconSize + gap + Math.max(sw, bw);
  const fit = Math.min(1, (r.w * 0.84) / total);
  ctx.translate(-(total * fit) / 2, 0);
  ctx.scale(fit, fit);
  ctx.save();
  ctx.translate(0, -iconSize / 2);
  if (store === "apple") {
    ctx.fillStyle = "#fff";
    ctx.translate(0, -h * 0.02);
    ctx.scale(iconSize / 170, iconSize / 170);
    ctx.fill(applePath());
  } else {
    // Triângulo "play" em quatro cores.
    const s = iconSize;
    const tri = (pts: number[][], color: string) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (const p of pts.slice(1)) ctx.lineTo(p[0] * s, p[1] * s);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    tri([[0.08, 0], [0.08, 1], [0.58, 0.5]], "#00d7fe");
    tri([[0.08, 0], [0.58, 0.5], [0.78, 0.3]], "#00f076");
    tri([[0.08, 1], [0.58, 0.5], [0.78, 0.7]], "#ff3a44");
    tri([[0.58, 0.5], [0.78, 0.3], [0.95, 0.4], [0.95, 0.6], [0.78, 0.7]], "#ffd400");
  }
  ctx.restore();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${store === "apple" ? 400 : 500} ${h * 0.17}px ${UI_FONT}`;
  ctx.fillText(small, iconSize + gap, -h * 0.1);
  ctx.font = `600 ${h * 0.36}px ${UI_FONT}`;
  ctx.fillText(big, iconSize + gap, h * 0.27);
  ctx.restore();
}

function drawShape(ctx: Ctx, l: ShapeLayer, r: Rect) {
  if (l.fill2) {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, l.fill);
    g.addColorStop(1, l.fill2);
    ctx.fillStyle = g;
  } else ctx.fillStyle = l.fill;
  ctx.beginPath();
  if (l.shape === "ellipse") ctx.ellipse(0, 0, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
  else ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(r.w, r.h) * l.radius);
  ctx.fill();
}
