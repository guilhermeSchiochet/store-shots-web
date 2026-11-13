"use client";
import { Reorder } from "motion/react";
import {
  Award,
  ClipboardPaste,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  Layers,
  Lock,
  LockOpen,
  Shapes,
  Smartphone,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { LAYER_TYPE_LABEL, make, type Category, type DeviceKind, type Layer, type LayerType } from "@/lib/models";
import { cur, useApp } from "@/store/app";
import { Btn, cx } from "../ui/controls";
import { Card } from "../ui/Card";
import { pickImages } from "../ui/files";

export const LAYER_ICON: Record<LayerType, LucideIcon> = {
  device: Smartphone,
  text: Type,
  image: ImageIcon,
  badge: Award,
  shape: Shapes,
};

export const kindOfCategory = (c: Category): DeviceKind => (c === "tablet" ? "tablet" : "phone");

/** Slide selecionado: adicionar elementos e a lista de camadas (arraste para mudar a ordem). */
export function LayersCard() {
  const category = useApp((s) => s.category);
  const slideIndex = useApp((s) => s.slideIndex);
  const layers = useApp((s) => cur(s)?.design[s.category].slides[s.slideIndex]?.layers);
  const layerIds = useApp((s) => s.layerIds);
  const hasClip = useApp((s) => !!s.clip);
  const shots = useApp((s) => cur(s)?.shots[kindOfCategory(s.category)].length ?? 3);
  const api = useApp.getState();
  if (!layers) return null;
  const add = (l: Layer) => api.addLayer(category, slideIndex, l);
  const kind = kindOfCategory(category);
  const usedShots = new Set(layers.filter((l) => l.type === "device").map((l) => (l.type === "device" ? l.shot.index : -1)));
  const nextShot = Array.from({ length: shots }, (_, i) => i).find((i) => !usedShots.has(i)) ?? 0;
  const top = [...layers].reverse(); // topo primeiro, como no Figma

  return (
    <Card
      title={category === "feature" ? "Recurso gráfico" : `Slide ${slideIndex + 1}`}
      subtitle="Adicione elementos e organize as camadas"
      icon={Layers}
      accent="blue"
    >
      <p className="mb-1.5 text-[11px] font-medium text-slate-600">Adicionar</p>
      <div className="grid grid-cols-5 gap-1">
        <AddBtn
          icon={Type}
          label="Texto"
          onClick={() => {
            const l = make.text("Seu texto aqui", { y: 0.5 });
            add(l);
            api.editText(l.id);
          }}
        />
        <AddBtn
          icon={ImageIcon}
          label="Imagem"
          onClick={async () => {
            const [f] = await pickImages();
            if (f) await api.addImageLayer(category, slideIndex, f);
          }}
        />
        <AddBtn icon={Smartphone} label="Aparelho" onClick={() => add(make.device(kind, nextShot, { w: category === "feature" ? 0.22 : 0.6 }))} />
        <AddBtn icon={Award} label="Selo" onClick={() => add(make.badge("auto", { w: category === "feature" ? 0.2 : 0.42 }))} />
        <AddBtn icon={Shapes} label="Forma" onClick={() => add(make.shape({ w: 0.4, ratio: category === "feature" ? 1 : 0.5 }))} />
      </div>
      {hasClip && (
        <Btn size="sm" variant="soft" icon={ClipboardPaste} className="mt-1.5 w-full" onClick={() => api.pasteLayer(category, slideIndex)}>
          Colar camada copiada (Ctrl+V)
        </Btn>
      )}

      <p className="mt-3 mb-1 flex items-center justify-between text-[11px] font-medium text-slate-600">
        Camadas
        {layers.length > 1 && <span className="text-[10px] font-normal text-slate-400">arraste para ordenar · Shift soma</span>}
      </p>
      {layers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-[11px] text-slate-400">
          Slide vazio. Adicione elementos acima.
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={top}
          onReorder={(order: Layer[]) => api.setLayerOrder(category, slideIndex, [...order].reverse().map((l) => l.id))}
          className="space-y-0.5"
        >
          {top.map((l) => (
            <Reorder.Item key={l.id} value={l} className="relative" whileDrag={{ scale: 1.02, zIndex: 10 }}>
              <LayerRow layer={l} category={category} slideIndex={slideIndex} active={layerIds.includes(l.id)} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}
    </Card>
  );
}

function AddBtn({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Adicionar ${label.toLowerCase()}`}
      className="press flex flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[10px] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    >
      <Icon className="size-4" strokeWidth={1.8} />
      {label}
    </button>
  );
}

function LayerRow({ layer: l, category, slideIndex, active }: { layer: Layer; category: Category; slideIndex: number; active: boolean }) {
  const api = useApp.getState();
  const [editing, setEditing] = useState(false);
  const Icon = LAYER_ICON[l.type];
  const name = l.type === "text" ? l.text.split("\n")[0] || "Texto vazio" : l.name;
  return (
    <div
      onClick={(e) => api.selectLayer(l.id, slideIndex, e.shiftKey || e.ctrlKey || e.metaKey)}
      onDoubleClick={() => (l.type === "text" ? api.editText(l.id) : setEditing(true))}
      className={cx(
        "group flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-1.5 text-xs transition-colors",
        active ? "border-brand-300 bg-brand-50 text-brand-700" : "border-transparent bg-white text-slate-700 hover:bg-slate-50",
        l.hidden && "opacity-50",
      )}
    >
      <GripVertical className="size-3.5 shrink-0 cursor-grab text-slate-300 group-hover:text-slate-500" />
      <Icon className="size-3.5 shrink-0 opacity-70" />
      {editing ? (
        <input
          autoFocus
          defaultValue={l.name}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            setEditing(false);
            api.updateLayer(category, slideIndex, l.id, { name: e.target.value || l.name });
          }}
          onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && e.currentTarget.blur()}
          className="h-6 min-w-0 flex-1 rounded border border-brand-400 bg-white px-1 text-xs outline-none"
        />
      ) : (
        <span
          className="min-w-0 flex-1 truncate"
          title={`${LAYER_TYPE_LABEL[l.type]} · clique duplo para ${l.type === "text" ? "editar" : "renomear"}`}
        >
          {name}
        </span>
      )}
      <span className="flex items-center" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <RowBtn label={l.locked ? "Destravar" : "Travar posição"} onClick={() => api.updateLayer(category, slideIndex, l.id, { locked: !l.locked })}>
          {l.locked ? <Lock className="size-3.5 text-amber-600" /> : <LockOpen className="size-3.5 opacity-0 group-hover:opacity-100" />}
        </RowBtn>
        <RowBtn label={l.hidden ? "Mostrar" : "Ocultar"} onClick={() => api.updateLayer(category, slideIndex, l.id, { hidden: !l.hidden })}>
          {l.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5 opacity-0 group-hover:opacity-100" />}
        </RowBtn>
      </span>
    </div>
  );
}

function RowBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="press flex size-6 items-center justify-center rounded text-slate-500 hover:bg-white hover:text-slate-800"
    >
      {children}
    </button>
  );
}
