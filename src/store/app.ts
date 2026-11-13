"use client";
// Estado da aplicação. Componentes usam seletores (`useApp(s => ...)`) e só
// re-renderizam quando o valor que escolheram muda (atualizações imutáveis).
import { create } from "zustand";
import { analyzeShot } from "@/lib/analyzer";
import { db } from "@/lib/db";
import { imageBank } from "@/lib/images";
import {
  clamp,
  cloneLayer,
  cloneSlide,
  detectedAdjust,
  emptyProject,
  imageIds,
  INITIAL_ADJUST,
  make,
  MAX_SHOTS,
  MAX_SLIDES,
  normalizeProject,
  type Background,
  type Category,
  type DeviceKind,
  type ExportSize,
  type Layer,
  type Project,
  type ShotAdjust,
  type Slide,
} from "@/lib/models";
import { autoDevice, defaultDesign, templateById } from "@/lib/templates";

export type Theme = "system" | "light" | "dark";

export interface Toast {
  id: number;
  text: string;
  error?: boolean;
}

export interface ShotRef {
  kind: DeviceKind;
  index: number;
}

interface AppState {
  loaded: boolean;
  projects: Project[];
  currentId: string | null;
  category: Category;
  slideIndex: number;
  layerId: string | null;
  shot: ShotRef;
  busy: Record<string, boolean>;
  progress: { done: number; total: number; label: string } | null;
  toasts: Toast[];
  theme: Theme;
  /** Incrementa para pedir foco no campo de texto da camada selecionada. */
  focusText: number;
  canUndo: boolean;
  canRedo: boolean;

  init(): Promise<void>;
  toast(text: string, error?: boolean): void;
  dismissToast(id: number): void;
  setTheme(t: Theme): void;
  setBusy(slot: string, v: boolean): void;
  setProgress(p: AppState["progress"]): void;

  setCategory(c: Category): void;
  selectSlide(i: number): void;
  selectLayer(id: string | null, slideIndex?: number): void;
  selectShot(s: ShotRef): void;
  requestTextFocus(): void;

  createProject(name: string): void;
  addProject(p: Project): void;
  selectProject(id: string): void;
  deleteProject(id: string): Promise<void>;
  update(fn: (p: Project) => Project, checkpoint?: boolean): void;
  undo(): void;
  redo(): void;

  applyTemplate(c: Category, id: string): void;
  addSlide(c: Category, duplicateOf?: number): void;
  removeSlide(c: Category, i: number): void;
  moveSlide(c: Category, i: number, dir: -1 | 1): void;
  setBackground(c: Category, i: number, bg: Background, all?: boolean): void;

  updateLayer(c: Category, i: number, id: string, patch: Partial<Layer> | ((l: Layer) => Layer)): void;
  addLayer(c: Category, i: number, layer: Layer): void;
  removeLayer(c: Category, i: number, id: string): void;
  duplicateLayer(c: Category, i: number, id: string): void;
  reorderLayer(c: Category, i: number, id: string, to: "up" | "down" | "top" | "bottom"): void;
  setLayerImage(c: Category, i: number, id: string, file: File | string | null): Promise<void>;
  addImageLayer(c: Category, i: number, file: File, at?: { x: number; y: number }): Promise<void>;

  updateAdjust(kind: DeviceKind, i: number, fn: (a: ShotAdjust) => ShotAdjust): void;
  applyAdjustToOthers(kind: DeviceKind, from: number): void;
  addShotSlot(kind: DeviceKind): void;
  importShots(kind: DeviceKind, start: number, files: File[]): Promise<void>;
  /**
   * Envia prints para a categoria e garante um aparelho mostrando cada um.
   * [at.slide]: começa pelo print do aparelho desse slide (ou pelo índice do slide);
   * [at.shot]: começa nesse print; sem nada: começa no print 1.
   */
  placePrints(c: Category, files: File[], at?: { slide?: number; shot?: number }): Promise<void>;
  removeShot(kind: DeviceKind, i: number): Promise<void>;
  redetect(kind: DeviceKind, i: number): Promise<void>;
  ensurePadColor(kind: DeviceKind, i: number): Promise<void>;

  togglePreset(id: string, on: boolean): void;
  setExportSize(id: string, size: ExportSize | null): void;
  setFormat(f: Project["format"]): void;
}

export const slotKey = (kind: DeviceKind, i: number) => `${kind}:${i}`;

// ------------------------------------------------------------ gravação (debounce)

const dirty = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(id: string, now = false) {
  dirty.add(id);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSaves, now ? 0 : 400);
}
export async function flushSaves() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const { projects } = useApp.getState();
  const ids = [...dirty];
  dirty.clear();
  await Promise.all(
    ids.map((id) => {
      const p = projects.find((x) => x.id === id);
      return p ? db.putProject(p) : Promise.resolve();
    }),
  );
}
if (typeof window !== "undefined") window.addEventListener("beforeunload", () => void flushSaves());

// ------------------------------------------------------------ histórico (desfazer)

interface History {
  past: Project[];
  future: Project[];
  last: number;
}
const histories = new Map<string, History>();
const historyOf = (id: string) => {
  let h = histories.get(id);
  if (!h) histories.set(id, (h = { past: [], future: [], last: 0 }));
  return h;
};

const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

let toastSeq = 0;

const aspectOf = (id: string | null) => {
  const s = imageBank.size(id);
  return s ? s.w / s.h : null;
};

export const useApp = create<AppState>()((set, get) => {
  const current = () => get().projects.find((p) => p.id === get().currentId) ?? null;

  const syncHistoryFlags = () => {
    const p = current();
    const h = p ? historyOf(p.id) : null;
    set({ canUndo: !!h?.past.length, canRedo: !!h?.future.length });
  };

  /**
   * Troca o projeto atual por fn(projeto) e agenda a gravação. Mudanças
   * seguidas (arraste, slider) viram UM passo de desfazer.
   */
  const mutate = (fn: (p: Project) => Project, opts: { now?: boolean; checkpoint?: boolean } = {}) => {
    const p = current();
    if (!p) return;
    const next = { ...fn(p), updatedAt: Date.now() };
    const h = historyOf(p.id);
    const t = Date.now();
    if (opts.checkpoint || t - h.last > 600) {
      h.past.push(p);
      if (h.past.length > 80) h.past.shift();
      h.future = [];
    }
    h.last = t;
    set({ projects: get().projects.map((x) => (x.id === p.id ? next : x)) });
    scheduleSave(p.id, opts.now);
    syncHistoryFlags();
  };

  const replaceCurrent = (next: Project) => {
    set({ projects: get().projects.map((x) => (x.id === next.id ? next : x)) });
    scheduleSave(next.id);
    // A seleção pode apontar para algo que não existe mais.
    const s = get();
    const slides = next.design[s.category].slides;
    const slideIndex = clamp(s.slideIndex, 0, Math.max(0, slides.length - 1));
    const layerId = slides[slideIndex]?.layers.some((l) => l.id === s.layerId) ? s.layerId : null;
    set({ slideIndex, layerId });
    syncHistoryFlags();
  };

  const withSlides = (p: Project, c: Category, fn: (slides: Slide[]) => Slide[]): Project => ({
    ...p,
    design: { ...p.design, [c]: { ...p.design[c], slides: fn(p.design[c].slides) } },
  });
  const withLayers = (p: Project, c: Category, i: number, fn: (layers: Layer[]) => Layer[]): Project =>
    withSlides(p, c, (slides) => slides.map((s, k) => (k === i ? { ...s, layers: fn(s.layers) } : s)));

  const setShotIn = (p: Project, kind: DeviceKind, i: number, id: string | null, a: ShotAdjust): Project => {
    const shots = [...p.shots[kind]];
    const adjust = [...p.adjust[kind]];
    while (shots.length <= i) {
      shots.push(null);
      adjust.push(INITIAL_ADJUST);
    }
    shots[i] = id;
    adjust[i] = a;
    return { ...p, shots: { ...p.shots, [kind]: shots }, adjust: { ...p.adjust, [kind]: adjust } };
  };

  return {
    loaded: false,
    projects: [],
    currentId: null,
    category: "phone",
    slideIndex: 0,
    layerId: null,
    shot: { kind: "phone", index: 0 },
    busy: {},
    progress: null,
    toasts: [],
    theme: "system",
    focusText: 0,
    canUndo: false,
    canRedo: false,

    async init() {
      const theme = (read("store-shots:theme") as Theme) || "system";
      const raw = (await db.allProjects().catch(() => [])) as unknown as Record<string, unknown>[];
      // Projetos antigos (v1): mede as imagens antes de converter (logo vira camada).
      await Promise.all(
        raw
          .filter((p) => p.version !== 2)
          .flatMap((p) => [p.logo, p.icon, p.badge])
          .filter((x): x is string => typeof x === "string")
          .map((id) => imageBank.record(id).then(() => imageBank.load(id, "preview"))),
      );
      const projects = raw.map((p) => normalizeProject(p, defaultDesign, aspectOf)).sort((a, b) => b.updatedAt - a.updatedAt);
      raw.forEach((p, i) => p.version !== 2 && scheduleSave(projects.find((x) => x.id === p.id)?.id ?? projects[i].id));
      const last = read("store-shots:last");
      const currentId = projects.find((p) => p.id === last)?.id ?? projects[0]?.id ?? null;
      set({ projects, currentId, loaded: true, theme });
      syncHistoryFlags();
      // Limpa imagens que nenhum projeto usa mais (trocadas/removidas em sessões anteriores).
      const used = new Set(projects.flatMap(imageIds));
      void db.imageKeys().then((keys) => keys.filter((k) => !used.has(k)).forEach((k) => void db.deleteImage(k)));
    },

    toast(text, error) {
      const id = ++toastSeq;
      set({ toasts: [...get().toasts.slice(-2), { id, text, error }] });
      setTimeout(() => get().dismissToast(id), error ? 6000 : text.length > 80 ? 5000 : 3200);
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    setTheme: (theme) => {
      store("store-shots:theme", theme);
      set({ theme });
    },
    setBusy: (slot, v) => {
      const busy = { ...get().busy };
      if (v) busy[slot] = true;
      else delete busy[slot];
      set({ busy });
    },
    setProgress: (progress) => set({ progress }),

    setCategory: (category) =>
      set({ category, slideIndex: 0, layerId: null, shot: { kind: category === "tablet" ? "tablet" : "phone", index: 0 } }),
    selectSlide: (slideIndex) => set({ slideIndex, layerId: null }),
    selectLayer: (layerId, slideIndex) => {
      const s = get();
      const idx = slideIndex ?? s.slideIndex;
      const layer = current()?.design[s.category].slides[idx]?.layers.find((l) => l.id === layerId);
      set({ layerId, slideIndex: idx, ...(layer?.type === "device" ? { shot: { ...layer.shot } } : {}) });
    },
    selectShot: (shot) => set({ shot }),
    requestTextFocus: () => set({ focusText: get().focusText + 1 }),

    createProject(name) {
      get().addProject(emptyProject(name, { phone: defaultDesign("phone"), tablet: defaultDesign("tablet"), feature: defaultDesign("feature") }));
    },
    addProject(p) {
      set({ projects: [p, ...get().projects], currentId: p.id, slideIndex: 0, layerId: null });
      scheduleSave(p.id, true);
      store("store-shots:last", p.id);
      syncHistoryFlags();
    },
    selectProject(id) {
      void flushSaves();
      set({ currentId: id, slideIndex: 0, layerId: null });
      store("store-shots:last", id);
      syncHistoryFlags();
    },
    async deleteProject(id) {
      const p = get().projects.find((x) => x.id === id);
      if (!p) return;
      const rest = get().projects.filter((x) => x.id !== id);
      set({ projects: rest, currentId: get().currentId === id ? (rest[0]?.id ?? null) : get().currentId, layerId: null, slideIndex: 0 });
      dirty.delete(id);
      histories.delete(id);
      await db.deleteProject(id);
      await Promise.all(imageIds(p).map((x) => imageBank.remove(x)));
      syncHistoryFlags();
    },

    update: (fn, checkpoint) => mutate(fn, { checkpoint }),
    undo() {
      const p = current();
      const h = p && historyOf(p.id);
      const prev = h?.past.pop();
      if (!p || !h || !prev) return;
      h.future.push(p);
      h.last = 0;
      replaceCurrent(prev);
    },
    redo() {
      const p = current();
      const h = p && historyOf(p.id);
      const next = h?.future.pop();
      if (!p || !h || !next) return;
      h.past.push(p);
      h.last = 0;
      replaceCurrent(next);
    },

    applyTemplate(c, id) {
      const t = templateById(id);
      if (!t) return;
      mutate((p) => ({ ...p, design: { ...p.design, [c]: t.build(c) } }), { checkpoint: true, now: true });
      set({ slideIndex: 0, layerId: null });
    },
    addSlide(c, duplicateOf) {
      const p = current();
      if (!p || p.design[c].slides.length >= MAX_SLIDES) return;
      const slides = p.design[c].slides;
      const src = slides[duplicateOf ?? slides.length - 1];
      const fresh: Slide = src
        ? duplicateOf !== undefined
          ? cloneSlide(src)
          : { ...cloneSlide(src), layers: cloneSlide(src).layers.filter((l) => l.type !== "badge") }
        : { id: `s_${Date.now()}`, bg: { type: "gradient", a: "#ffffff", b: "#e6ecf5", angle: 180 }, layers: [] };
      const at = duplicateOf !== undefined ? duplicateOf + 1 : slides.length;
      mutate((pp) => withSlides(pp, c, (s) => [...s.slice(0, at), fresh, ...s.slice(at)]), { checkpoint: true });
      set({ slideIndex: at, layerId: null });
    },
    removeSlide(c, i) {
      const p = current();
      if (!p || p.design[c].slides.length <= 1) return;
      mutate((pp) => withSlides(pp, c, (s) => s.filter((_, k) => k !== i)), { checkpoint: true });
      set({ slideIndex: Math.max(0, i - 1), layerId: null });
    },
    moveSlide(c, i, dir) {
      const p = current();
      const j = i + dir;
      if (!p || j < 0 || j >= p.design[c].slides.length) return;
      mutate(
        (pp) =>
          withSlides(pp, c, (s) => {
            const n = [...s];
            [n[i], n[j]] = [n[j], n[i]];
            return n;
          }),
        { checkpoint: true },
      );
      set({ slideIndex: j });
    },
    setBackground(c, i, bg, all) {
      mutate((p) => withSlides(p, c, (s) => s.map((sl, k) => (all || k === i ? { ...sl, bg: { ...bg } } : sl))), {
        checkpoint: all,
      });
    },

    updateLayer(c, i, id, patch) {
      mutate((p) =>
        withLayers(p, c, i, (ls) =>
          ls.map((l) => (l.id !== id ? l : typeof patch === "function" ? patch(l) : ({ ...l, ...patch } as Layer))),
        ),
      );
    },
    addLayer(c, i, layer) {
      mutate((p) => withLayers(p, c, i, (ls) => [...ls, layer]), { checkpoint: true });
      get().selectLayer(layer.id, i);
    },
    removeLayer(c, i, id) {
      mutate((p) => withLayers(p, c, i, (ls) => ls.filter((l) => l.id !== id)), { checkpoint: true });
      if (get().layerId === id) set({ layerId: null });
    },
    duplicateLayer(c, i, id) {
      const l = current()?.design[c].slides[i]?.layers.find((x) => x.id === id);
      if (!l) return;
      const copy = cloneLayer(l);
      mutate((p) => withLayers(p, c, i, (ls) => [...ls, copy]), { checkpoint: true });
      set({ layerId: copy.id });
    },
    reorderLayer(c, i, id, to) {
      mutate(
        (p) =>
          withLayers(p, c, i, (ls) => {
            const k = ls.findIndex((l) => l.id === id);
            if (k < 0) return ls;
            const n = [...ls];
            const [l] = n.splice(k, 1);
            const target = to === "top" ? n.length : to === "bottom" ? 0 : to === "up" ? Math.min(n.length, k + 1) : Math.max(0, k - 1);
            n.splice(target, 0, l);
            return n;
          }),
        { checkpoint: true },
      );
    },
    async setLayerImage(c, i, id, file) {
      let imageId: string | null = typeof file === "string" ? file : null;
      if (file instanceof File) {
        get().setBusy(`layer:${id}`, true);
        try {
          imageId = await imageBank.put(file, file.name);
          await imageBank.load(imageId, "preview");
        } finally {
          get().setBusy(`layer:${id}`, false);
        }
      }
      mutate(
        (p) => ({
          ...withLayers(p, c, i, (ls) => ls.map((l) => (l.id === id && (l.type === "image" || l.type === "badge") ? { ...l, imageId } : l))),
          library: imageId && !p.library.includes(imageId) ? [...p.library, imageId] : p.library,
        }),
        { checkpoint: true, now: true },
      );
    },
    async addImageLayer(c, i, file, at) {
      const imageId = await imageBank.put(file, file.name);
      await imageBank.load(imageId, "preview");
      const layer = make.image(imageId, { name: file.name.replace(/\.\w+$/, "").slice(0, 28) || "Imagem", x: at?.x ?? 0.5, y: at?.y ?? 0.5, w: 0.4 });
      mutate((p) => ({ ...withLayers(p, c, i, (ls) => [...ls, layer]), library: [...p.library, imageId] }), { checkpoint: true, now: true });
      get().selectLayer(layer.id, i);
    },

    updateAdjust: (kind, i, fn) =>
      mutate((p) => ({ ...p, adjust: { ...p.adjust, [kind]: p.adjust[kind].map((a, k) => (k === i ? fn(a) : a)) } })),
    applyAdjustToOthers(kind, from) {
      mutate(
        (p) => {
          const src = p.adjust[kind][from];
          return {
            ...p,
            adjust: {
              ...p.adjust,
              [kind]: p.adjust[kind].map((a, k) =>
                k === from || !p.shots[kind][k] ? a : { ...src, autoTop: a.autoTop, autoBottom: a.autoBottom, padColor: a.padColor ?? src.padColor },
              ),
            },
          };
        },
        { checkpoint: true },
      );
    },
    addShotSlot(kind) {
      const p = current();
      if (!p || p.shots[kind].length >= MAX_SHOTS) return;
      mutate((pp) => setShotIn(pp, kind, pp.shots[kind].length, null, INITIAL_ADJUST), { checkpoint: true });
      set({ shot: { kind, index: p.shots[kind].length } });
    },
    async importShots(kind, start, files) {
      const imgs = files
        .filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!imgs.length) {
        get().toast("Formato não suportado. Use PNG, JPG ou WebP.", true);
        return;
      }
      const slots = Math.min(imgs.length, MAX_SHOTS - start);
      for (let k = 0; k < slots; k++) get().setBusy(slotKey(kind, start + k), true);
      await Promise.all(
        imgs.slice(0, slots).map(async (file, k) => {
          const i = start + k;
          try {
            const [analysis, id] = await Promise.all([analyzeShot(file), imageBank.put(file, file.name)]);
            await imageBank.load(id, "preview"); // troca sem "piscar"
            const a = analysis ? detectedAdjust(analysis.statusBar, analysis.navBar, analysis.edgeColor) : detectedAdjust(null, null, null);
            // A imagem antiga continua guardada (desfazer); órfãs são limpas ao abrir o app.
            mutate((pp) => setShotIn(pp, kind, i, id, a), { now: true, checkpoint: true });
          } catch (e) {
            get().toast(`Não foi possível importar "${file.name}": ${e}`, true);
          } finally {
            get().setBusy(slotKey(kind, i), false);
          }
        }),
      );
      set({ shot: { kind, index: start } });
    },
    async placePrints(c, files, at = {}) {
      const p = current();
      if (!p) return;
      const imgs = files.filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type)).sort((a, b) => a.name.localeCompare(b.name));
      if (!imgs.length) {
        get().toast("Formato não suportado. Use PNG, JPG ou WebP.", true);
        return;
      }
      const kind: DeviceKind = c === "tablet" ? "tablet" : "phone";
      const slides = p.design[c].slides;
      const devOf = (sl: Slide | undefined) =>
        sl?.layers.find((l): l is Extract<Layer, { type: "device" }> => l.type === "device" && l.shot.kind === kind);
      let start = at.shot ?? (at.slide !== undefined ? (devOf(slides[at.slide])?.shot.index ?? at.slide) : 0);
      start = clamp(start, 0, MAX_SHOTS - 1);
      const n = Math.min(imgs.length, MAX_SHOTS - start);

      // Garante um aparelho para cada print enviado (sem apagar nada que exista).
      let created = 0;
      let addedSlides = 0;
      const isStore = (sl: Slide) => sl.layers.some((l) => l.type === "badge");
      const shows = (ss: Slide[], s: number) =>
        ss.some((sl) => sl.layers.some((l) => l.type === "device" && l.shot.kind === kind && l.shot.index === s));
      const next = (() => {
        let ss = [...slides];
        for (let k = 0; k < n; k++) {
          const s = start + k;
          if (shows(ss, s)) continue;
          const ti = at.slide !== undefined ? at.slide + k : s;
          const target = ss[ti];
          if (target && !target.layers.some((l) => l.type === "device") && (!isStore(target) || c === "feature")) {
            ss = ss.map((sl, j) => (j === ti ? { ...sl, layers: [...sl.layers, autoDevice(c, kind, s, sl)] } : sl));
            created++;
          } else if (c !== "feature" && (!target || isStore(target)) && ss.length < MAX_SLIDES) {
            // Faltou slide: cria um novo antes do slide final da loja.
            const ins = ss.length && isStore(ss[ss.length - 1]) ? ss.length - 1 : ss.length;
            const ref = ss[Math.max(0, ins - 1)];
            const fresh: Slide = { id: `s_${Date.now().toString(36)}${k}`, bg: ref ? { ...ref.bg } : { type: "gradient", a: "#ffffff", b: "#e6ecf5", angle: 180 }, layers: [] };
            fresh.layers = [autoDevice(c, kind, s, fresh)];
            ss = [...ss.slice(0, ins), fresh, ...ss.slice(ins)];
            created++;
            addedSlides++;
          }
        }
        return ss;
      })();
      if (created) mutate((pp) => withSlides(pp, c, () => next), { checkpoint: true, now: true });
      await get().importShots(kind, start, imgs.slice(0, n));
      const parts = [`${n} print${n > 1 ? "s" : ""} enviado${n > 1 ? "s" : ""}`];
      if (created) parts.push(`${created} aparelho${created > 1 ? "s" : ""} criado${created > 1 ? "s" : ""}`);
      if (addedSlides) parts.push(`${addedSlides} slide${addedSlides > 1 ? "s" : ""} novo${addedSlides > 1 ? "s" : ""}`);
      if (imgs.length > n) parts.push(`${imgs.length - n} ignorado(s): máximo de ${MAX_SHOTS} prints`);
      get().toast(parts.join(" · ") + ".");
    },
    async removeShot(kind, i) {
      mutate((p) => setShotIn(p, kind, i, null, INITIAL_ADJUST), { now: true, checkpoint: true });
    },
    async redetect(kind, i) {
      const id = current()?.shots[kind][i];
      if (!id) return;
      get().setBusy(slotKey(kind, i), true);
      try {
        const rec = await imageBank.record(id);
        const a = rec ? await analyzeShot(rec.blob) : null;
        if (!a) {
          get().toast("Não foi possível analisar o print.", true);
          return;
        }
        get().updateAdjust(kind, i, (old) => ({
          ...old,
          stripBars: a.statusBar !== null || a.navBar !== null || old.stripBars,
          safeArea: a.statusBar !== null || old.safeArea,
          cropTop: a.statusBar ?? old.cropTop,
          cropBottom: a.navBar ?? old.cropBottom,
          autoTop: a.statusBar,
          autoBottom: a.navBar,
          padColor: old.padColor ?? a.edgeColor,
        }));
        get().toast(
          a.statusBar === null && a.navBar === null
            ? "Nenhuma barra do sistema encontrada. Ajuste manualmente se precisar."
            : "Barras detectadas e removidas.",
        );
      } finally {
        get().setBusy(slotKey(kind, i), false);
      }
    },
    async ensurePadColor(kind, i) {
      const p = current();
      const id = p?.shots[kind][i];
      if (!p || !id || p.adjust[kind][i]?.padColor) return;
      const rec = await imageBank.record(id);
      const a = rec ? await analyzeShot(rec.blob) : null;
      if (a) get().updateAdjust(kind, i, (old) => ({ ...old, padColor: old.padColor ?? a.edgeColor }));
    },

    togglePreset: (id, on) =>
      mutate((p) => ({ ...p, presets: on ? [...new Set([...p.presets, id])] : p.presets.filter((x) => x !== id) }), {
        checkpoint: true,
      }),
    setExportSize: (id, size) =>
      mutate((p) => {
        const exportSizes = { ...p.exportSizes };
        if (size) exportSizes[id] = size;
        else delete exportSizes[id];
        return { ...p, exportSizes };
      }),
    setFormat: (format) => mutate((p) => ({ ...p, format }), { checkpoint: true }),
  };
});

export const useProject = () => useApp((s) => s.projects.find((p) => p.id === s.currentId) ?? null);
export const getProject = () => {
  const s = useApp.getState();
  return s.projects.find((p) => p.id === s.currentId) ?? null;
};
/** Seletor do projeto atual (para usar dentro de `useApp`). */
export const cur = (s: AppState) => s.projects.find((p) => p.id === s.currentId);
