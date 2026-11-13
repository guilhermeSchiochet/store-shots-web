"use client";
import { AnimatePresence, motion } from "motion/react";
import { Info, Monitor, Moon, RectangleHorizontal, Smartphone, Sun, Tablet } from "lucide-react";
import { CATEGORY_LABEL, presetsOf, type Category } from "@/lib/models";
import { cur, useApp, useProject, type Theme } from "@/store/app";
import { cx, Segmented } from "../ui/controls";
import { ExportCard } from "./ExportCard";
import { LayersCard } from "./LayersCard";
import { PrintsCard } from "./ShotPanel";
import { ProjectPicker } from "./ProjectPicker";
import { SlideCard } from "./SlideCard";
import { TemplateCard } from "./TemplateCard";

export const CATEGORY_ICON = { phone: Smartphone, tablet: Tablet, feature: RectangleHorizontal } as const;
export const KIND_ICON = CATEGORY_ICON;

/**
 * Barra lateral. Fixo no topo: marca, projeto, nome e categoria ativa (o
 * contexto de tudo abaixo). Rolável: modelo → slide → camadas → prints → exportação.
 */
export function Sidebar() {
  const hasProject = useApp((s) => !!s.currentId);
  return (
    <aside className="z-20 flex h-screen w-[372px] min-w-[372px] flex-col border-r border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 p-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-brand-600 text-[10px] font-extrabold text-ink shadow-sm shadow-brand-600/30">
              SS
            </div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-900">Store Shots</h1>
          </div>
          <ThemeToggle />
        </div>
        <ProjectPicker />
        {hasProject && (
          <>
            <NameField />
            <CategoryScope />
          </>
        )}
      </div>
      {hasProject ? (
        <div className="thin-scroll flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <TemplateCard />
          <SlideCard />
          <LayersCard />
          <PrintsCard />
          <ExportCard />
          <div className="h-2" />
        </div>
      ) : (
        <p className="p-6 text-center text-xs leading-relaxed text-slate-500">
          Crie um projeto para começar. Cada projeto guarda os prints, as imagens e o design de um app.
        </p>
      )}
    </aside>
  );
}

function ThemeToggle() {
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const items: { v: Theme; icon: typeof Sun; label: string }[] = [
    { v: "light", icon: Sun, label: "Tema claro" },
    { v: "dark", icon: Moon, label: "Tema escuro" },
    { v: "system", icon: Monitor, label: "Seguir o sistema" },
  ];
  return (
    <div className="flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
      {items.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === v}
          onClick={() => setTheme(v)}
          className={cx(
            "press flex size-6 items-center justify-center rounded-md",
            theme === v ? "bg-white text-brand-600 shadow-sm" : "text-slate-400 hover:text-slate-700",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

function NameField() {
  const project = useProject();
  const update = useApp((s) => s.update);
  if (!project) return null;
  return (
    <div className="mt-2.5">
      <label className="mb-1 block px-0.5 text-[10px] font-medium tracking-wider text-slate-400 uppercase">Nome do projeto</label>
      <input
        value={project.name}
        onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
        placeholder="Nome do app ou da marca"
        className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-medium text-slate-800 transition-colors outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function CategoryScope() {
  const category = useApp((s) => s.category);
  const setCategory = useApp((s) => s.setCategory);
  const labels = useApp((s) =>
    presetsOf(s.category)
      .filter((x) => cur(s)?.presets.includes(x.id))
      .map((x) => x.label)
      .join(", "),
  );
  return (
    <div className="mt-3 border-t border-slate-100 pt-2.5">
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
        <Smartphone className="size-3" /> O que você está criando
      </p>
      <Segmented<Category>
        value={category}
        onChange={setCategory}
        items={(["phone", "tablet", "feature"] as const).map((k) => ({
          value: k,
          label: k === "feature" ? "Gráfico" : CATEGORY_LABEL[k].many,
          icon: CATEGORY_ICON[k],
          title: CATEGORY_LABEL[k].hint,
        }))}
      />
      <div className="mt-1.5 flex items-center gap-1 overflow-hidden rounded border border-slate-200/50 bg-slate-50 p-1.5 text-[10px] text-slate-500">
        <Info className="size-3 shrink-0 text-slate-400" />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={category + labels}
            initial={{ opacity: 0, transform: "translateY(4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-4px)" }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="truncate"
          >
            {labels || `Nenhum tamanho marcado — veja "Exportação"`}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
