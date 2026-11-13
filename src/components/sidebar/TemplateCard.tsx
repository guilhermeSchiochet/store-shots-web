"use client";
import { Check, LayoutTemplate, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_LABEL, presetsOf, type Category } from "@/lib/models";
import { templateById, templatesFor, type Template } from "@/lib/templates";
import { cur, useApp } from "@/store/app";
import { Btn, cx } from "../ui/controls";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { SlideCanvas } from "../preview/SlideCanvas";

/** Modelo da categoria ativa e a galeria para trocar. */
export function TemplateCard() {
  const category = useApp((s) => s.category);
  const templateId = useApp((s) => cur(s)?.design[s.category].template ?? "");
  const [open, setOpen] = useState(false);
  const t = templateById(templateId);
  return (
    <Card title="Modelo" subtitle={`${CATEGORY_LABEL[category].many} · ponto de partida do design`} icon={LayoutTemplate} accent="purple">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-800">{t?.name ?? "Personalizado"}</p>
          <p className="line-clamp-2 text-[10px] leading-snug text-slate-400">
            {t?.description ?? "Design montado à mão a partir de um modelo."}
          </p>
        </div>
        <Btn variant="soft" size="sm" icon={Sparkles} onClick={() => setOpen(true)}>
          Trocar
        </Btn>
      </div>
      <TemplateGallery open={open} onClose={() => setOpen(false)} category={category} current={templateId} />
    </Card>
  );
}

function TemplateGallery({ open, onClose, category, current }: { open: boolean; onClose: () => void; category: Category; current: string }) {
  const list = templatesFor(category);
  const { applyTemplate, toast } = useApp.getState();
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={LayoutTemplate}
      title={`Modelos · ${CATEGORY_LABEL[category].many}`}
      subtitle="As prévias usam os seus prints. Depois de aplicar, tudo continua editável."
    >
      <div className={cx("grid gap-4", category === "feature" ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3")}>
        {list.map((t) => (
          <TemplateOption
            key={t.id}
            template={t}
            category={category}
            active={t.id === current}
            onPick={() => {
              applyTemplate(category, t.id);
              onClose();
              toast(`Modelo "${t.name}" aplicado. Ctrl+Z desfaz.`);
            }}
          />
        ))}
      </div>
    </Modal>
  );
}

function TemplateOption({ template, category, active, onPick }: { template: Template; category: Category; active: boolean; onPick: () => void }) {
  const project = useApp(cur)!;
  // Gera uma vez (ids estáveis = sem redesenho a cada render).
  const design = useMemo(() => template.build(category), [template, category]);
  const preset = presetsOf(category)[0];
  const shown = category === "feature" ? design.slides.slice(0, 1) : design.slides.slice(0, 3);
  return (
    <button
      type="button"
      onClick={onPick}
      className={cx(
        "press group flex flex-col gap-2 rounded-xl border p-2.5 text-left",
        active ? "border-brand-600 ring-2 ring-brand-600/20" : "border-slate-200 hover:border-brand-300 hover:bg-slate-50",
      )}
    >
      <div className={cx("grid gap-1.5", category === "feature" ? "grid-cols-1" : "grid-cols-3")}>
        {shown.map((s) => (
          <SlideCanvas key={s.id} project={project} preset={preset} slide={s} fade={false} maxDpr={1.5} className="rounded-md" />
        ))}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">{template.name}</p>
          <p className="text-[10px] leading-snug text-slate-400">{template.description}</p>
        </div>
        {active && <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />}
      </div>
    </button>
  );
}
