// Seleção múltipla: caixas que envolvem camadas (mesmo giradas) e alinhamento.
// Tudo em px do slide; os ajustes voltam em frações (como o modelo guarda).
import type { Box } from "./geometry.ts";

export interface Rect4 {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Retângulo alinhado aos eixos que contém a caixa (considerando a rotação). */
export function aabb(b: Box): Rect4 {
  const r = (b.rot * Math.PI) / 180;
  const hw = Math.abs((b.w / 2) * Math.cos(r)) + Math.abs((b.h / 2) * Math.sin(r));
  const hh = Math.abs((b.w / 2) * Math.sin(r)) + Math.abs((b.h / 2) * Math.cos(r));
  return { left: b.cx - hw, right: b.cx + hw, top: b.cy - hh, bottom: b.cy + hh };
}

export function union(rs: Rect4[]): Rect4 | null {
  if (!rs.length) return null;
  return {
    left: Math.min(...rs.map((r) => r.left)),
    top: Math.min(...rs.map((r) => r.top)),
    right: Math.max(...rs.map((r) => r.right)),
    bottom: Math.max(...rs.map((r) => r.bottom)),
  };
}

export const intersects = (a: Rect4, b: Rect4) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export type AlignMode = "left" | "centerX" | "right" | "top" | "centerY" | "bottom" | "distributeX" | "distributeY";

/**
 * Deslocamentos para alinhar as camadas. Com uma camada só, alinha ao slide
 * (W × H); com várias, à caixa que envolve todas. Distribuir (3 ou mais)
 * espaça os centros igualmente entre o primeiro e o último.
 */
export function alignPatches(
  items: { id: string; x: number; y: number; box: Box }[],
  mode: AlignMode,
  W: number,
  H: number,
): Record<string, { x?: number; y?: number }> {
  const out: Record<string, { x?: number; y?: number }> = {};
  if (!items.length) return out;
  const rects = items.map((it) => aabb(it.box));
  const ref = items.length === 1 ? { left: 0, top: 0, right: W, bottom: H } : union(rects)!;

  if (mode === "distributeX" || mode === "distributeY") {
    if (items.length < 3) return out;
    const horiz = mode === "distributeX";
    const order = items.map((it, k) => ({ it, k, c: horiz ? it.box.cx : it.box.cy })).sort((a, b) => a.c - b.c);
    const first = order[0].c;
    const step = (order[order.length - 1].c - first) / (order.length - 1);
    order.forEach(({ it, c }, n) => {
      const d = first + step * n - c;
      if (Math.abs(d) > 1e-6) out[it.id] = horiz ? { x: it.x + d / W } : { y: it.y + d / H };
    });
    return out;
  }

  items.forEach((it, k) => {
    const r = rects[k];
    let dx = 0;
    let dy = 0;
    if (mode === "left") dx = ref.left - r.left;
    else if (mode === "right") dx = ref.right - r.right;
    else if (mode === "centerX") dx = (ref.left + ref.right) / 2 - (r.left + r.right) / 2;
    else if (mode === "top") dy = ref.top - r.top;
    else if (mode === "bottom") dy = ref.bottom - r.bottom;
    else if (mode === "centerY") dy = (ref.top + ref.bottom) / 2 - (r.top + r.bottom) / 2;
    if (Math.abs(dx) > 1e-6) out[it.id] = { ...out[it.id], x: it.x + dx / W };
    if (Math.abs(dy) > 1e-6) out[it.id] = { ...out[it.id], y: it.y + dy / H };
  });
  return out;
}
