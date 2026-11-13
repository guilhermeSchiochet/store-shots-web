"use client";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileArchive,
  FolderDown,
  Plus,
  Ratio,
  Redo2,
  Undo2,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { buildExport, canSaveToFolder, downloadZip, pickFolder, writeToFolder } from "@/lib/export";
import {
  CATEGORY_LABEL,
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
            Clique para selecionar · arraste para mover · alças para redimensionar e girar · Alt + arrastar ajusta o print dentro do
            aparelho · Ctrl + roda = zoom no print · solte imagens no slide · Ctrl+Z desfaz · Delete apaga · Ctrl+D duplica
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ preset, order, first }: { preset: ExportPreset; order: number; first: boolean }) {
  const count = useApp((s) => cur(s)?.design[preset.category].slides.length ?? 0);
  const size = useApp((s) => (cur(s) ? exportSizeOf(cur(s)!, preset) : preset.sizes[0]));
  const addSlide = useApp((s) => s.addSlide);
  const feature = preset.category === "feature";
  return (
    <motion.section
      initial={{ opacity: 0, transform: "translateY(8px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.26, delay: order * 0.05, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-3"
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
      <div className={cx("grid gap-4", feature ? "max-w-[920px] grid-cols-1" : "grid-cols-4")}>
        {Array.from({ length: count }, (_, i) => (
          <SlideTile key={i} preset={preset} slideIndex={i} />
        ))}
        {first && !feature && count < MAX_SLIDES && (
          <button
            type="button"
            onClick={() => addSlide(preset.category)}
            style={{ aspectRatio: `${size.w} / ${size.h}` }}
            className="press flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-400 hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600"
          >
            <Plus className="size-5" />
            Adicionar slide
          </button>
        )}
      </div>
    </motion.section>
  );
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
