"use client";
import { motion } from "motion/react";
import { LayoutTemplate, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { frameBank } from "@/lib/frames";
import { getProject, useApp } from "@/store/app";
import { Preview } from "./preview/Preview";
import { NewProjectModal } from "./sidebar/ProjectPicker";
import { Sidebar } from "./sidebar/Sidebar";
import { Btn } from "./ui/controls";
import { Spinner, Toaster } from "./ui/feedback";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/** Aplicação inteira (roda só no navegador: Canvas, IndexedDB, Web Worker). */
export function StoreShots() {
  const loaded = useApp((s) => s.loaded);
  const hasProject = useApp((s) => !!s.currentId);
  const theme = useApp((s) => s.theme);

  useEffect(() => {
    const { init, toast } = useApp.getState();
    void init();
    frameBank.loadAll().catch((e) => toast(`Erro ao carregar molduras: ${e}`, true));
  }, []);

  // Tema: claro, escuro ou seguindo o sistema (ao vivo).
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // Atalhos de teclado (sem animação: são ações repetidas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !isTyping(e.target)) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y" && !isTyping(e.target)) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (isTyping(e.target)) return;
      const c = s.category;
      const i = s.slideIndex;
      const layers = getProject()?.design[c].slides[i]?.layers ?? [];
      // A seleção pode ter camadas de vários slides.
      const everywhere = getProject()?.design[c].slides.flatMap((sl) => sl.layers) ?? [];
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        s.selectLayers(layers.filter((l) => !l.hidden && !l.locked).map((l) => l.id), i);
        return;
      }
      if (!s.layerId) return;
      const ids = s.layerIds.length ? s.layerIds : [s.layerId];
      const layer = layers.find((l) => l.id === s.layerId);
      // Ctrl+C / Ctrl+X: tratados nos eventos "copy"/"cut" abaixo (escrevem na área de transferência do sistema).
      if (e.key === "Enter" && layer?.type === "text" && ids.length === 1) {
        e.preventDefault();
        s.editText(layer.id);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        s.removeLayers(c, i, ids);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        s.duplicateLayers(c, i, ids);
      } else if (e.key === "Escape") {
        s.selectLayer(null);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.002;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const patches: Record<string, { x: number; y: number }> = {};
        for (const l of everywhere) if (ids.includes(l.id) && !l.locked) patches[l.id] = { x: l.x + dx, y: l.y + dy };
        s.patchLayers(c, i, patches);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /*
   * Ctrl+C / Ctrl+X com camadas selecionadas: além de guardar as camadas, põe
   * uma MARCA na área de transferência do sistema. Assim o Ctrl+V sabe que o
   * último "copiar" foi aqui — uma captura de tela antiga no Windows não passa
   * mais na frente das camadas copiadas.
   */
  useEffect(() => {
    const onCopy = (e: ClipboardEvent, cut: boolean) => {
      const s = useApp.getState();
      if (isTyping(e.target) || !s.layerId || window.getSelection()?.toString()) return;
      const ids = s.layerIds.length ? s.layerIds : [s.layerId];
      const token = s.copyLayers(s.category, s.slideIndex, ids);
      if (!token) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", token);
      if (cut) s.removeLayers(s.category, s.slideIndex, ids);
    };
    const copy = (e: ClipboardEvent) => onCopy(e, false);
    const cut = (e: ClipboardEvent) => onCopy(e, true);
    window.addEventListener("copy", copy);
    window.addEventListener("cut", cut);
    return () => {
      window.removeEventListener("copy", copy);
      window.removeEventListener("cut", cut);
    };
  }, []);

  // Ctrl+V: camadas copiadas aqui, ou uma imagem vinda de fora.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      const p = getProject();
      if (!p) return;
      const s = useApp.getState();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      // 1) A área de transferência tem a nossa marca (ou nada de fora): cola as camadas copiadas.
      if (s.clip && (text === s.clipToken || (!files.length && !text))) {
        e.preventDefault();
        s.pasteLayer(s.category, s.slideIndex);
        return;
      }
      if (!files.length) return;
      // 2) Imagem de fora. Só troca algo que esteja SELECIONADO; senão entra como camada nova.
      e.preventDefault();
      const ids = s.layerIds.length ? s.layerIds : s.layerId ? [s.layerId] : [];
      const layer = ids.length === 1 ? p.design[s.category].slides[s.slideIndex]?.layers.find((l) => l.id === ids[0]) : undefined;
      if (layer?.type === "device") void s.importShots(layer.shot.kind, layer.shot.index, files.slice(0, 1));
      else if (layer?.type === "image") void s.setLayerImage(s.category, s.slideIndex, layer.id, files[0]);
      else {
        void s.addImageLayer(s.category, s.slideIndex, files[0]);
        s.toast("Imagem colada como camada. Para usar como print, selecione o aparelho antes de colar.");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden select-none">
      {loaded ? (
        <>
          <Sidebar />
          {hasProject ? <Preview /> : <Welcome />}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs text-slate-500">
          <Spinner /> Carregando projetos...
        </div>
      )}
      <Toaster />
    </div>
  );
}

function Welcome() {
  const [open, setOpen] = useState(false);
  const { createProject, toast } = useApp.getState();
  return (
    <main className="flex flex-1 items-center justify-center bg-canvas p-6">
      <motion.div
        initial={{ opacity: 0, transform: "translateY(12px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        className="w-[420px] rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5"
      >
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <LayoutTemplate className="size-5" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Bem-vindo ao Store Shots</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Monte as capturas da App Store e da Play Store e o recurso gráfico a partir dos prints do seu app — com modelos
          prontos, textos e imagens livres. Tudo fica salvo neste navegador.
        </p>
        <Btn variant="primary" icon={Plus} className="mt-5" onClick={() => setOpen(true)}>
          Criar primeiro projeto
        </Btn>
      </motion.div>
      <NewProjectModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={(n) => {
          createProject(n);
          toast(`Projeto "${n}" criado.`);
        }}
      />
    </main>
  );
}
