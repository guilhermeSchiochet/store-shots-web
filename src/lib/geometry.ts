// Matemática pura compartilhada pelo desenho (preview e exportação), pelos
// arrastes no preview e pelos avisos da barra lateral. Uma só conta = o PNG
// exportado é idêntico ao preview.
import type { ShotAdjust } from "./models.ts";
import { clamp, effectiveCrop } from "./models.ts";

export interface Size {
  w: number;
  h: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Parte do print (px da imagem) que sobra depois de cortar as barras. */
export function shotSourceRect(img: Size, a: ShotAdjust): Rect {
  const c = effectiveCrop(a);
  const top = img.h * c.top;
  const bottom = Math.max(top + 1, img.h * (1 - c.bottom));
  return { x: 0, y: top, w: img.w, h: bottom - top };
}

/** Onde a parte visível é desenhada, relativo à tela do aparelho ([target]). */
export function shotDestRect(img: Size, a: ShotAdjust, target: Size): Rect {
  const src = shotSourceRect(img, a);
  let sx = target.w / src.w;
  let sy = target.h / src.h;
  if (a.fit === "cover") sx = sy = Math.max(sx, sy);
  else if (a.fit === "contain") sx = sy = Math.min(sx, sy);
  const w = src.w * sx * a.zoom;
  const h = src.h * sy * a.zoom;
  return { x: ((target.w - w) * (a.alignX + 1)) / 2, y: ((target.h - h) * (a.alignY + 1)) / 2, w, h };
}

export interface FitReport {
  cropX: number; // fração do print fora da tela
  cropY: number;
  gapX: number; // fração da tela sem imagem
  gapY: number;
  distortion: number;
  crops: boolean;
  hasGaps: boolean;
  distorts: boolean;
  canPanX: boolean;
  canPanY: boolean;
}

export function fitReport(img: Size, a: ShotAdjust, target: Size): FitReport {
  const src = shotSourceRect(img, a);
  const dst = shotDestRect(img, a, target);
  const sx = dst.w / src.w;
  const sy = dst.h / src.h;
  const over = (d: number, t: number) => (d > t ? (d - t) / d : 0);
  const gap = (d: number, t: number) => (d < t ? (t - d) / t : 0);
  const r = {
    cropX: over(dst.w, target.w),
    cropY: over(dst.h, target.h),
    gapX: gap(dst.w, target.w),
    gapY: gap(dst.h, target.h),
    distortion: Math.abs(sx - sy) / Math.min(sx, sy),
  };
  return {
    ...r,
    crops: r.cropX > 0.005 || r.cropY > 0.005,
    hasGaps: r.gapX > 0.005 || r.gapY > 0.005,
    distorts: r.distortion > 0.01,
    canPanX: r.cropX > 0.002 || r.gapX > 0.002,
    canPanY: r.cropY > 0.002 || r.gapY > 0.002,
  };
}

/**
 * Faixa reservada no topo da tela (px), quando as barras foram removidas e a
 * área segura está ligada: altura da câmera da moldura + espaço extra.
 */
export function safeInset(a: ShotAdjust, cameraInset: number, screenH: number): number {
  if (!a.stripBars || !a.safeArea) return 0;
  return clamp(cameraInset + a.safeExtra, 0, 0.3) * screenH;
}

/** Área onde o print é encaixado: a tela menos a faixa da área segura. */
export function shotArea(a: ShotAdjust, cameraInset: number, screen: Size): Size {
  return { w: screen.w, h: screen.h - safeInset(a, cameraInset, screen.h) };
}

/** Arraste (px da tela do aparelho) → nova posição. A imagem acompanha o cursor. */
export function panShot(img: Size, a: ShotAdjust, target: Size, dx: number, dy: number): ShotAdjust {
  const dst = shotDestRect(img, a, target);
  const ox = target.w - dst.w;
  const oy = target.h - dst.h;
  return {
    ...a,
    alignX: Math.abs(ox) < 0.5 ? a.alignX : clamp(a.alignX + (2 * dx) / ox, -1, 1),
    alignY: Math.abs(oy) < 0.5 ? a.alignY : clamp(a.alignY + (2 * dy) / oy, -1, 1),
  };
}

/** Moldura carregada: tamanho e retângulo da tela (px da moldura). */
export interface FrameInfo {
  size: Size;
  screen: Rect;
}

/** Caixa de uma camada em px do slide: centro, tamanho e rotação (graus). */
export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
}

/** Converte um ponto do slide para o sistema local (sem rotação) da caixa. */
export function toLocal(b: Box, x: number, y: number) {
  const r = (-b.rot * Math.PI) / 180;
  const dx = x - b.cx;
  const dy = y - b.cy;
  return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
}

/** O ponto (px do slide) está dentro da caixa (considerando a rotação)? */
export function hitBox(b: Box, x: number, y: number, pad = 0) {
  const p = toLocal(b, x, y);
  return Math.abs(p.x) <= b.w / 2 + pad && Math.abs(p.y) <= b.h / 2 + pad;
}

/** Gira um vetor (dx, dy) pelos graus dados. */
export function rotateVec(dx: number, dy: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
}
