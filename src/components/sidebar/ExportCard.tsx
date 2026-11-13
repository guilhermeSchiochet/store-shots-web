"use client";
import { Check, FileDown } from "lucide-react";
import { useState } from "react";
import { CATEGORY_LABEL, exportSizeOf, presetsOf, type ExportPreset } from "@/lib/models";
import { cur, useApp } from "@/store/app";
import { cx, Segmented } from "../ui/controls";
import { Note } from "../ui/feedback";
import { Card, Reveal } from "../ui/Card";

/** Tamanhos da categoria ativa (marcar, resolução de cada um) e formato do arquivo. */
export function ExportCard() {
  const category = useApp((s) => s.category);
  const format = useApp((s) => cur(s)?.format ?? "png");
  const setFormat = useApp((s) => s.setFormat);
  return (
    <Card title="Exportação" subtitle={`${CATEGORY_LABEL[category].many} · tamanhos e formato`} icon={FileDown} accent="slate">
      <div className="space-y-1.5">
        {presetsOf(category).map((p) => (
          <PresetRow key={p.id} preset={p} />
        ))}
      </div>
      <p className="mt-3 mb-1.5 text-[11px] font-medium text-slate-600">Formato (todos os tamanhos)</p>
      <Segmented<"png" | "jpeg">
        size="sm"
        value={format}
        onChange={setFormat}
        items={[
          { value: "png", label: "PNG sem transparência", title: "PNG RGB, sem canal alfa — aceito pela App Store e pela Play Store" },
          { value: "jpeg", label: "JPG", title: "Arquivos menores (qualidade 95%)" },
        ]}
      />
      <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
        A App Store recusa imagens com canal de transparência e confere o tamanho exato em pixels. Os dois formatos daqui
        saem sem transparência.
      </p>
    </Card>
  );
}

function PresetRow({ preset }: { preset: ExportPreset }) {
  const on = useApp((s) => !!cur(s)?.presets.includes(preset.id));
  const size = useApp((s) => (cur(s) ? exportSizeOf(cur(s)!, preset) : preset.sizes[0]));
  const { togglePreset, setExportSize } = useApp.getState();
  const custom = !preset.sizes.some((x) => x.w === size.w && x.h === size.h);
  const [editing, setEditing] = useState(custom);
  const value = editing || custom ? "custom" : `${size.w}x${size.h}`;

  return (
    <div className={cx("rounded-lg border transition-colors", on ? "border-brand-200 bg-brand-50/50" : "border-slate-200")}>
      <button type="button" onClick={() => togglePreset(preset.id, !on)} className="press flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
        <span
          className={cx(
            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
            on ? "border-brand-600 bg-brand-600 text-ink" : "border-slate-300 bg-white",
          )}
        >
          {on && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-slate-800">{preset.label}</span>
          <span className="block text-[10px] text-slate-400">
            {preset.platform === "ios" ? "App Store" : "Play Store"}
            {preset.note ? ` · ${preset.note}` : ""}
          </span>
        </span>
        <span className="font-mono text-[10px] text-slate-500 tabular-nums">
          {size.w} × {size.h}
        </span>
      </button>
      <Reveal show={on}>
        <div className="px-2.5 pb-2.5">
          <select
            value={value}
            onChange={(e) => {
              if (e.target.value === "custom") return setEditing(true);
              setEditing(false);
              const [w, h] = e.target.value.split("x").map(Number);
              setExportSize(preset.id, w === preset.sizes[0].w && h === preset.sizes[0].h ? null : { w, h });
            }}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {preset.sizes.map((x, i) => (
              <option key={i} value={`${x.w}x${x.h}`}>
                {x.w} × {x.h}
                {i === 0 ? " (padrão)" : ""}
              </option>
            ))}
            <option value="custom">Personalizado…</option>
          </select>
          <Reveal show={value === "custom"}>
            <div className="flex items-center gap-1.5 pt-2">
              <SizeInput label="Largura" value={size.w} onChange={(w) => setExportSize(preset.id, { w, h: size.h })} />
              <span className="text-slate-400">×</span>
              <SizeInput label="Altura" value={size.h} onChange={(h) => setExportSize(preset.id, { w: size.w, h })} />
            </div>
            <div className="mt-2">
              <Note tone="warning">Use um tamanho aceito pela loja — a App Store não aceita nem 1 pixel de diferença.</Note>
            </div>
          </Reveal>
        </div>
      </Reveal>
    </div>
  );
}

function SizeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    const n = Math.round(Number(text));
    setText(null);
    if (Number.isFinite(n) && n >= 100 && n <= 8000) onChange(n);
  };
  return (
    <label className="flex flex-1 items-center gap-1 rounded-md border border-slate-200 bg-white px-2">
      <span className="text-[10px] text-slate-400">{label}</span>
      <input
        inputMode="numeric"
        value={text ?? String(value)}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-7 min-w-0 flex-1 bg-transparent text-right font-mono text-xs text-slate-800 outline-none"
      />
      <span className="text-[10px] text-slate-400">px</span>
    </label>
  );
}
