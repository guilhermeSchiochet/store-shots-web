"use client";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Download,
  FileArchive,
  FolderDown,
  GripVertical,
  Plus,
  Ratio,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { buildExport, canSaveToFolder, downloadZip, pickFolder, writeToFolder } from "@/lib/export";
import {
  CATEGORY_LABEL,
  clamp,
  exportSizeOf,
  MAX_SLIDES,
  missingShots,
  presetById,
  presetsOf,
  readyPresets,
  type Category,
  type ExportPreset,
} from "@/lib/models";
import { cur, flushSaves, getProject, useApp } from "@/store/app";
import { Btn, cx, IconBtn } from "../ui/controls";
import { EmptyHint, Spinner } from "../ui/feedback";
import { CATEGORY_ICON } from "../sidebar/Sidebar";
import { SlideTile } from "./SlideTile";

/** Área principal: cabeçalho + slides da categoria ativa, por tamanho de loja. */
export function Preview() {
  const category = useApp((s) => s.category);
  const projectId = useApp((s) => s.currentId);
  return (
    <main className="flex h-screen min-w-0 flex-1 flex-col bg-canvas">
      <Header />
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${projectId}-${category}`}
            className="absolute inset-0"
            initial={{ opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-4px)", transition: { duration: 0.12, ease: "easeOut" } }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <CategoryView category={category} />
          </motion.div>
        </AnimatePresence>
        <ExportOverlay />
      </div>
    </main>
  );
}

function Header() {
  const category = useApp((s) => s.category);
  const missing = useApp((s) => (cur(s) ? missingShots(cur(s)!, s.category).length : 0));
  const slides = useApp((s) => cur(s)?.design[s.category].slides.length ?? 0);
  const progress = useApp((s) => s.progress);
  const canUndo = useApp((s) => s.canUndo);
  const canRedo = useApp((s) => s.canRedo);
  const { undo, redo } = useApp.getState();
  const Icon = CATEGORY_ICON[category];
  return (
    <header className="relative flex h-13 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-md border border-brand-100 bg-brand-50 p-1.5 text-brand-600">
          <Icon className="size-4" strokeWidth={1.9} />
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h2
            key={category}
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-6px)" }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="text-sm font-bold whitespace-nowrap text-slate-800"
          >
            {CATEGORY_LABEL[category].many}
          </motion.h2>
        </AnimatePresence>
        <span className="text-xs whitespace-nowrap text-slate-400">
          {slides} slide{slides === 1 ? "" : "s"}
        </span>
        <span
          className={cx(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
            missing ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {missing ? <AlertCircle className="size-3" /> : <CheckCircle2 className="size-3" />}
          {missing ? `Falta${missing > 1 ? "m" : ""} ${missing} print${missing > 1 ? "s" : ""}` : "Prints completos"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <IconBtn icon={Undo2} label="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={undo} />
        <IconBtn icon={Redo2} label="Refazer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo} />
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ExportButton />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
        <div
          className="h-full bg-brand-600 transition-[width,opacity] duration-300 ease-[var(--ease-out)]"
          style={{ width: progress ? `${(progress.done / Math.max(1, progress.total)) * 100}%` : "0%", opacity: progress ? 1 : 0 }}
        />
      </div>
    </header>
  );
}

function ExportButton() {
  const ready = useApp((s) => (cur(s) ? readyPresets(cur(s)!).length : 0));
  const enabled = useApp((s) => cur(s)?.presets.length ?? 0);
  const format = useApp((s) => cur(s)?.format ?? "png");
  const progress = useApp((s) => s.progress);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const folder = canSaveToFolder();
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const busy = !!progress;
  const tip = busy
    ? "Exportando..."
    : enabled === 0
      ? "Marque ao menos um tamanho em Exportação, na barra lateral."
      : ready === 0
        ? "Envie os prints usados pelos slides para exportar."
        : `Exporta ${ready} tamanho(s) em ${format === "png" ? "PNG sem transparência" : "JPG"}.`;

  const run = async (mode: "zip" | "folder") => {
    setMenu(false);
    const { setProgress, toast } = useApp.getState();
    const p = getProject();
    if (!p) return;
    await flushSaves();
    const dir = mode === "folder" ? await pickFolder() : null;
    if (mode === "folder" && !dir) return;
    setProgress({ done: 0, total: 1, label: "Preparando" });
    try {
      const { files, skipped, root } = await buildExport(p, setProgress);
      if (!files.length) {
        toast("Nada para exportar: faltam prints nos tamanhos marcados.", true);
        return;
      }
      if (dir) await writeToFolder(dir, root, files);
      else await downloadZip(root, files);
      const names = skipped.map((id) => presetById(id)?.label ?? id).join(", ");
      toast(skipped.length ? `${files.length} imagens exportadas. Faltam prints para: ${names}.` : `Pronto! ${files.length} imagens exportadas.`);
    } catch (e) {
      toast(`Erro na exportação: ${e instanceof Error ? e.message : e}`, true);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div ref={ref} className="relative flex" title={tip}>
      <Btn
        variant="primary"
        icon={busy ? undefined : Download}
        disabled={!ready || busy}
        onClick={() => run("zip")}
        className={cx(folder && "rounded-r-none")}
      >
        {busy && <Spinner className="size-3.5 border-ink/30 border-t-ink" />}
        {busy ? `Exportando ${progress!.done}/${progress!.total}` : "Exportar"}
      </Btn>
      {folder && (
        <Btn
          variant="primary"
          disabled={!ready || busy}
          onClick={() => setMenu(!menu)}
          aria-label="Mais opções de exportação"
          className="rounded-l-none border-l border-ink/20 !px-2"
        >
          <ChevronDown className="size-4" />
        </Btn>
      )}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.96) translateY(-4px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute top-full right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10"
          >
            <MenuItem icon={FileArchive} title="Baixar .zip" text="Um arquivo com uma pasta por tamanho" onClick={() => run("zip")} />
            <MenuItem icon={FolderDown} title="Salvar em uma pasta" text="Grava as pastas direto no computador" onClick={() => run("folder")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon: Icon, title, text, onClick }: { icon: typeof Download; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-start gap-2.5 rounded-lg p-2 text-left hover:bg-slate-50">
      <Icon className="mt-0.5 size-4 text-slate-500" />
      <span>
        <span className="block text-xs font-semibold text-slate-800">{title}</span>
        <span className="block text-[10px] text-slate-400">{text}</span>
      </span>
    </button>
  );
}

function ExportOverlay() {
  const progress = useApp((s) => s.progress);
  return (
    <div
      className={cx(
        "absolute inset-0 z-10 flex items-end justify-center bg-canvas/40 pb-7 transition-opacity duration-200",
        progress ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {progress && (
        <div className="enter flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xl shadow-slate-900/10">
          <Spinner className="size-3.5" />
          Gerando {progress.label} · {progress.done}/{progress.total}
        </div>
      )}
    </div>
  );
}

// Cada categoria lembra onde a rolagem parou.
const scrollMemory: Partial<Record<string, number>> = {};

function CategoryView({ category }: { category: Category }) {
  const projectId = useApp((s) => s.currentId);
  const ids = useApp((s) => presetsOf(category).filter((x) => cur(s)?.presets.includes(x.id)).map((x) => x.id).join());
  const enabled = presetsOf(category).filter((x) => ids.split(",").includes(x.id));
  const ref = useRef<HTMLDivElement>(null);
  const key = `${projectId}-${category}`;
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = scrollMemory[key] ?? 0;
  }, [key]);

  return (
    <div
      ref={ref}
      onScroll={(e) => (scrollMemory[key] = e.currentTarget.scrollTop)}
      onPointerDown={(e) => e.target === e.currentTarget && useApp.getState().selectLayer(null)}
      data-scroll-area
      className="thin-scroll h-full overflow-y-auto px-6 pt-6 pb-12"
    >
      <div className="mx-auto max-w-[1480px] space-y-10">
        {enabled.length === 0 ? (
          <div className="mx-auto mt-16 max-w-sm">
            <EmptyCategory category={category} />
          </div>
        ) : (
          enabled.map((pre, i) => <Section key={pre.id} preset={pre} order={i} first={i === 0} />)
        )}
        {enabled.length > 0 && (
          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Clique para selecionar · clique duplo no texto para editar · arraste o &ldquo;Slide N&rdquo; (ou segure o fundo do slide) para
            mudar a ordem · Ctrl+C / Ctrl+V copia uma camada para outro slide · Alt + arrastar ajusta o print · Ctrl + roda = zoom no
            print · Delete apaga · Ctrl+D duplica · Ctrl+Z desfaz
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ preset, order, first }: { preset: ExportPreset; order: number; first: boolean }) {
  const count = useApp((s) => cur(s)?.design[preset.category].slides.length ?? 0);
  const ids = useApp((s) => cur(s)?.design[preset.category].slides.map((x) => x.id).join() ?? "");
  const size = useApp((s) => (cur(s) ? exportSizeOf(cur(s)!, preset) : preset.sizes[0]));
  const slideDrag = useApp((s) => s.slideDrag);
  const addSlide = useApp((s) => s.addSlide);
  const grid = useRef<HTMLDivElement>(null);
  const feature = preset.category === "feature";
  const slideIds = ids.split(",");

  // Ordem exibida: durante o arraste, o slide arrastado já aparece no lugar de destino.
  const shown = Array.from({ length: count }, (_, i) => i);
  if (slideDrag) {
    const [x] = shown.splice(slideDrag.from, 1);
    shown.splice(slideDrag.to, 0, x);
  }
  const startDrag = (from: number, x: number, y: number, immediate = true) =>
    grid.current && beginSlideDrag(preset.category, from, grid.current, x, y, immediate);

  return (
    <motion.section
      initial={{ opacity: 0, transform: "translateY(8px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.26, delay: order * 0.05, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-wide">
          <span className="size-2 rounded-full bg-brand-600" />
          <span className="font-semibold text-slate-800">{preset.label}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{preset.platform === "ios" ? "App Store" : "Play Store"}</span>
        </div>
        <span className="font-mono text-[11px] text-slate-400">
          {size.w} × {size.h} px
        </span>
      </div>
      <div ref={grid} className={cx("grid gap-x-4 gap-y-3", feature ? "max-w-[920px] grid-cols-1" : "grid-cols-4")}>
        {shown.map((i, pos) => (
          <motion.div
            key={slideIds[i] ?? i}
            layout={slideDrag ? "position" : false}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            data-slide-pos={pos}
            className={cx(
              "min-w-0 transition-[opacity,scale] duration-150",
              slideDrag?.from === i && "relative z-10 scale-[1.03] opacity-80",
            )}
          >
            {!feature && <SlideBar category={preset.category} index={i} count={count} onDragStart={(x, y) => startDrag(i, x, y, false)} dragging={slideDrag?.from === i} />}
            <SlideTile preset={preset} slideIndex={i} first={first} onHoldDrag={feature || count < 2 ? undefined : (k, x, y) => startDrag(k, x, y)} />
          </motion.div>
        ))}
        {first && !feature && count < MAX_SLIDES && (
          <div className="min-w-0">
            <div className="h-7" />
            <button
              type="button"
              onClick={() => addSlide(preset.category)}
              style={{ aspectRatio: `${size.w} / ${size.h}` }}
              className="press flex w-full flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-400 hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600"
            >
              <Plus className="size-5" />
              Adicionar slide
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
}

/** Cabeçalho de cada slide: alça para arrastar (mudar a ordem) e ações do slide. */
function SlideBar({
  category,
  index,
  count,
  onDragStart,
  dragging,
}: {
  category: Category;
  index: number;
  count: number;
  onDragStart: (x: number, y: number) => void;
  dragging: boolean;
}) {
  const selected = useApp((s) => s.slideIndex === index && !s.slideDrag);
  const hasClip = useApp((s) => !!s.clip);
  const api = useApp.getState();
  return (
    <div className="group/bar flex h-7 items-center gap-1">
      <button
        type="button"
        title={count > 1 ? "Arraste para mudar a ordem (ou pressione e segure o slide)" : `Slide ${index + 1}`}
        onPointerDown={(e) => {
          if (e.button !== 0 || count < 2) return;
          e.preventDefault();
          onDragStart(e.clientX, e.clientY);
        }}
        onClick={() => api.selectSlide(index)}
        className={cx(
          "flex h-6 touch-none items-center gap-1 rounded-md pr-2 pl-1 text-[11px] font-semibold select-none",
          count > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
          selected ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
        )}
      >
        <GripVertical className={cx("size-3.5", count > 1 ? "opacity-60" : "opacity-0")} />
        Slide {index + 1}
      </button>
      <div
        className={cx(
          "ml-auto flex items-center transition-opacity duration-150",
          selected ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100 focus-within:opacity-100",
        )}
      >
        {hasClip && <IconBtn icon={ClipboardPaste} label="Colar a camada copiada aqui (Ctrl+V)" onClick={() => api.pasteLayer(category, index)} />}
        <IconBtn icon={Copy} label="Duplicar slide" disabled={count >= MAX_SLIDES} onClick={() => api.addSlide(category, index)} />
        <IconBtn icon={Trash2} label="Excluir slide" danger disabled={count <= 1} onClick={() => api.removeSlide(category, index)} />
      </div>
    </div>
  );
}

/**
 * Arrasta um slide para mudar a ordem. O destino sai da posição do ponteiro
 * na grade (colunas fixas), não das caixas animadas — assim não "pula".
 * Perto das bordas da área de rolagem, rola sozinho. Esc cancela.
 */
function beginSlideDrag(c: Category, from: number, grid: HTMLElement, x: number, y: number, immediate: boolean) {
  const api = useApp.getState();
  const n = getProject()?.design[c].slides.length ?? 0;
  if (n < 2) return;
  api.selectSlide(from);
  // Pela alça, só vira arraste depois de mexer um pouco (um clique simples só seleciona).
  let started = immediate;
  if (started) api.setSlideDrag({ from, to: from });
  const scroller = grid.closest("[data-scroll-area]") as HTMLElement | null;
  const origin = { x, y };
  let last = { x, y };
  let raf = 0;

  const target = () => {
    const r = grid.getBoundingClientRect();
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1;
    const cell = grid.querySelector<HTMLElement>("[data-slide-pos]");
    const gapX = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const gapY = parseFloat(getComputedStyle(grid).rowGap) || 0;
    const cw = (r.width - gapX * (cols - 1)) / cols;
    const ch = cell?.offsetHeight ?? cw * 2;
    const col = clamp(Math.floor((last.x - r.left) / (cw + gapX)), 0, cols - 1);
    const row = Math.max(0, Math.floor((last.y - r.top) / (ch + gapY)));
    return clamp(row * cols + col, 0, n - 1);
  };
  const update = () => {
    const to = target();
    if (useApp.getState().slideDrag?.to !== to) api.setSlideDrag({ from, to });
  };
  const tick = () => {
    if (scroller && started) {
      const r = scroller.getBoundingClientRect();
      const edge = 70;
      const v = last.y < r.top + edge ? -(r.top + edge - last.y) : last.y > r.bottom - edge ? last.y - (r.bottom - edge) : 0;
      if (v) {
        scroller.scrollTop += clamp(v * 0.35, -24, 24);
        update();
      }
    }
    raf = requestAnimationFrame(tick);
  };
  const move = (e: PointerEvent) => {
    last = { x: e.clientX, y: e.clientY };
    if (!started && Math.hypot(last.x - origin.x, last.y - origin.y) > 4) {
      started = true;
      document.body.style.cursor = "grabbing";
      api.setSlideDrag({ from, to: from });
    }
    if (started) update();
  };
  const end = (commit: boolean) => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key);
    document.body.style.removeProperty("cursor");
    const d = useApp.getState().slideDrag;
    api.setSlideDrag(null);
    if (commit && d && d.to !== d.from) api.moveSlideTo(c, d.from, d.to);
  };
  const up = () => end(true);
  const cancel = () => end(false);
  const key = (e: KeyboardEvent) => e.key === "Escape" && end(false);
  if (started) document.body.style.cursor = "grabbing";
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key);
  raf = requestAnimationFrame(tick);
}

function EmptyCategory({ category }: { category: Category }) {
  const toggle = useApp((s) => s.togglePreset);
  const first = presetsOf(category)[0];
  return (
    <EmptyHint
      icon={Ratio}
      title={`Nenhum tamanho de ${CATEGORY_LABEL[category].one.toLowerCase()} marcado`}
      message='Escolha os tamanhos em "Exportação", na barra lateral.'
      action={
        <Btn variant="primary" icon={Plus} onClick={() => toggle(first.id, true)}>
          Ativar {first.label}
        </Btn>
      }
    />
  );
}
