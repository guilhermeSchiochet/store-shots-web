// Garante que as fontes usadas nos textos estão carregadas antes de desenhar
// (o Canvas não espera fonte: sem isso o PNG sairia com a fonte reserva).
import { CATEGORIES, type Project, type TextLayer } from "./models";
import { fontFamily } from "./render";

const loaded = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

export const fontEvents = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  version: () => version,
};

const keyOf = (l: Pick<TextLayer, "font" | "weight" | "italic">) => `${l.italic ? "italic " : ""}${l.weight} 32px ${fontFamily(l.font)}`;

/** Carrega (uma vez) as variações de fonte das camadas; avisa quem desenha. */
export async function ensureFonts(layers: Pick<TextLayer, "font" | "weight" | "italic">[]) {
  if (typeof document === "undefined") return;
  const todo = [...new Set(layers.map(keyOf))].filter((k) => !loaded.has(k));
  if (!todo.length) return;
  await Promise.all(todo.map((k) => document.fonts.load(k).catch(() => [])));
  todo.forEach((k) => loaded.add(k));
  version++;
  listeners.forEach((l) => l());
}

export const textLayersOf = (p: Project) =>
  CATEGORIES.flatMap((c) => p.design[c].slides.flatMap((s) => s.layers)).filter((l): l is TextLayer => l.type === "text");
