"use client";
import { AnimatePresence, motion } from "motion/react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  AppWindow,
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardCopy,
  Copy,
  Crop,
  Ellipsis,
  Lock,
  LockOpen,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  SquareStack,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { alignPatches, type AlignMode } from "@/lib/align";
import { clamp, FONTS, type Category, type FontId, type Layer, type TextLayer } from "@/lib/models";
import { layerBox, type RenderEnv } from "@/lib/render";
import { cur, getProject, useApp } from "@/store/app";
import { ColorField } from "../ui/ColorField";
import { cx } from "../ui/controls";
import { pickImages } from "../ui/files";

const stop = (e: SyntheticEvent) => e.stopPropagation();

/** Copia pelo botão: guarda as camadas e põe a marca na área de transferência do sistema. */
export function copyToClipboard(c: Category, i: number, ids: string[]) {
  const token = useApp.getState().copyLayers(c, i, ids);
  if (token) void navigator.clipboard?.writeText(token).catch(() => {});
}

/**
 * Barra que flutua sobre a seleção no slide (estilo Canva/Figma). Fica num
 * portal com posição fixa para nunca ser cortada; acima da seleção quando
 * cabe, senão embaixo, sempre dentro da área dos slides.
 */
function FloatingBar({ anchor, label, children }: { anchor: RefObject<HTMLElement | null>; label: string; children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; show: boolean }>({ left: 0, top: 0, show: false });

  const place = () => {
    const a = anchor.current;
    const b = bar.current;
    if (!a || !b) return;
    const r = a.getBoundingClientRect();
    const area = (a.closest("[data-scroll-area]") as HTMLElement | null)?.getBoundingClientRect() ?? {
      top: 0,
      left: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    const visible = r.bottom > area.top + 4 && r.top < area.bottom - 4;
    let top = r.top - h - 36; // acima da alça de girar
    if (top < area.top + 8) top = r.bottom + 12;
    if (top + h > area.bottom - 8) top = Math.max(area.top + 8, Math.min(r.top + 8, area.bottom - h - 8));
    const left = clamp(r.left + r.width / 2 - w / 2, area.left + 8, Math.max(area.left + 8, area.right - w - 8));
    setPos((p) => (p.left === left && p.top === top && p.show === visible ? p : { left, top, show: visible }));
  };

  useLayoutEffect(place);
  useEffect(() => {
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  });

  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      ref={bar}
      role="toolbar"
      aria-label={label}
      initial={{ opacity: 0, transform: "translateY(4px) scale(0.98)" }}
      animate={{ opacity: pos.show ? 1 : 0, transform: "translateY(0px) scale(1)" }}
      transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      style={{ position: "fixed", left: pos.left, top: pos.top, pointerEvents: pos.show ? "auto" : "none" }}
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onDoubleClick={stop}
      onClick={stop}
      className="z-[60] flex h-10 items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-1 shadow-xl shadow-slate-900/15"
    >
      {children}
    </motion.div>,
    document.body,
  );
}

/** Barra da camada selecionada: o essencial do tipo à esquerda, ações gerais à direita. */
export function LayerToolbar({
  layer: l,
  category: c,
  slideIndex: i,
  anchor,
  env,
}: {
  layer: Layer;
  category: Category;
  slideIndex: number;
  anchor: RefObject<HTMLElement | null>;
  env: RenderEnv;
}) {
  const slides = useApp((s) => cur(s)?.design[c].slides.length ?? 0);
  const api = useApp.getState();
  const set = (patch: Partial<Layer>) => api.updateLayer(c, i, l.id, patch);

  return (
    <FloatingBar anchor={anchor} label="Ações da camada">
      {l.type === "text" && <TextTools l={l} set={set} exportWidth={env.W} />}
      {l.type === "image" && (
        <>
          <Tool
            icon={Upload}
            label={l.imageId ? "Trocar imagem" : "Escolher imagem"}
            text={l.imageId ? "Trocar" : "Escolher"}
            onClick={async () => {
              const [f] = await pickImages();
              if (f) await api.setLayerImage(c, i, l.id, f);
            }}
          />
          <Tool
            icon={AppWindow}
            label="Estilo ícone de app (fundo, cantos e sombra)"
            active={l.style === "icon"}
            onClick={() =>
              set(l.style === "icon" ? { style: "plain", radius: 0, shadow: 0 } : { style: "icon", radius: 0.2237, shadow: 0.5 })
            }
          />
          {l.style === "icon" && (
            <span className="px-0.5">
              <ColorField compact title="Fundo do ícone" value={l.bg} onChange={(bg) => set({ bg })} />
            </span>
          )}
          <Sep />
        </>
      )}
      {l.type === "device" && <DeviceTools l={l} c={c} i={i} />}
      {l.type === "shape" && (
        <>
          <span className="px-0.5">
            <ColorField compact alpha title="Cor da forma" value={l.fill} onChange={(fill) => set({ fill })} />
          </span>
          <Sep />
        </>
      )}
      {l.type === "badge" && (
        <>
          <select
            value={l.store}
            title="Loja do selo"
            onChange={(e) => set({ store: e.target.value as typeof l.store })}
            className="h-7 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-medium text-slate-700 outline-none focus:border-brand-500"
          >
            <option value="auto">Loja automática</option>
            <option value="apple">App Store</option>
            <option value="google">Google Play</option>
          </select>
          <Sep />
        </>
      )}

      <AlignMenu ids={[l.id]} c={c} i={i} env={env} />
      {slides > 1 && l.type !== "device" && (
        <Tool icon={SquareStack} label="Colocar em todos os slides (mesma posição)" onClick={() => api.copyLayersToAll(c, i, [l.id])} />
      )}
      <Tool icon={Copy} label="Duplicar (Ctrl+D)" onClick={() => api.duplicateLayer(c, i, l.id)} />
      <MoreMenu l={l} c={c} i={i} />
      <Sep />
      <Tool icon={Trash2} label="Excluir (Delete)" danger onClick={() => api.removeLayer(c, i, l.id)} />
    </FloatingBar>
  );
}

/** Barra de várias camadas selecionadas: alinhar, colocar em todos, duplicar e excluir juntas. */
export function GroupToolbar({
  ids,
  category: c,
  slideIndex: i,
  anchor,
  env,
}: {
  ids: string[];
  category: Category;
  slideIndex: number;
  anchor: RefObject<HTMLElement | null>;
  env: RenderEnv;
}) {
  const slides = useApp((s) => cur(s)?.design[c].slides.length ?? 0);
  const slideList = useApp((s) => cur(s)?.design[c].slides);
  const api = useApp.getState();
  const sel = (slideList ?? []).flatMap((sl) => sl.layers).filter((l) => ids.includes(l.id));
  const spread = (slideList ?? []).filter((sl) => sl.layers.some((l) => ids.includes(l.id))).length;
  const shareable = sel.filter((l) => l.type !== "device").map((l) => l.id);
  const locked = sel.every((l) => l.locked);
  return (
    <FloatingBar anchor={anchor} label="Ações das camadas selecionadas">
      <span className="px-2 text-[11px] font-semibold whitespace-nowrap text-slate-600">{ids.length} selecionadas{spread > 1 ? ` · ${spread} slides` : ""}</span>
      <Sep />
      <AlignMenu ids={ids} c={c} i={i} env={env} />
      {slides > 1 && shareable.length > 0 && (
        <Tool
          icon={SquareStack}
          label="Colocar em todos os slides (mesma posição)"
          onClick={() => api.copyLayersToAll(c, i, shareable)}
        />
      )}
      <Tool icon={Copy} label="Duplicar (Ctrl+D)" onClick={() => api.duplicateLayers(c, i, ids)} />
      <Tool icon={ClipboardCopy} label="Copiar (Ctrl+C)" onClick={() => copyToClipboard(c, i, ids)} />
      <Tool
        icon={locked ? LockOpen : Lock}
        label={locked ? "Destravar posição" : "Travar posição"}
        onClick={() => api.patchLayers(c, i, Object.fromEntries(ids.map((id) => [id, { locked: !locked }])))}
      />
      <Sep />
      <Tool icon={Trash2} label="Excluir todas (Delete)" danger onClick={() => api.removeLayers(c, i, ids)} />
    </FloatingBar>
  );
}

// ------------------------------------------------------------ alinhar

const ALIGN_ITEMS: { mode: AlignMode; icon: LucideIcon; text: string }[] = [
  { mode: "left", icon: AlignStartVertical, text: "Esquerda" },
  { mode: "centerX", icon: AlignCenterVertical, text: "Centro (horizontal)" },
  { mode: "right", icon: AlignEndVertical, text: "Direita" },
  { mode: "top", icon: AlignStartHorizontal, text: "Topo" },
  { mode: "centerY", icon: AlignCenterHorizontal, text: "Meio (vertical)" },
  { mode: "bottom", icon: AlignEndHorizontal, text: "Base" },
  { mode: "distributeX", icon: AlignHorizontalDistributeCenter, text: "Distribuir na horizontal" },
  { mode: "distributeY", icon: AlignVerticalDistributeCenter, text: "Distribuir na vertical" },
];

/** Aplica um alinhamento: uma camada → em relação ao slide; várias → entre si. */
export function applyAlign(c: Category, i: number, ids: string[], mode: AlignMode, env: Pick<RenderEnv, "W" | "H" | "preset" | "frame" | "aspect">) {
  // A seleção pode estar em vários slides: as frações valem igual em todos.
  const layers = getProject()?.design[c].slides.flatMap((sl) => sl.layers) ?? [];
  const items = layers.filter((l) => ids.includes(l.id) && !l.locked).map((l) => ({ id: l.id, x: l.x, y: l.y, box: layerBox(l, env) }));
  const patches = alignPatches(items, mode, env.W, env.H);
  if (Object.keys(patches).length) useApp.getState().patchLayers(c, i, patches);
}

function AlignMenu({ ids, c, i, env }: { ids: string[]; c: Category; i: number; env: RenderEnv }) {
  const single = ids.length === 1;
  return (
    <Dropdown icon={AlignCenterVertical} label={single ? "Alinhar no slide" : "Alinhar entre si"}>
      {(close) => (
        <>
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            {single ? "Alinhar no slide" : "Alinhar a seleção"}
          </p>
          {ALIGN_ITEMS.filter((a) => !a.mode.startsWith("distribute") || ids.length >= 3).map((a) => (
            <Item
              key={a.mode}
              icon={a.icon}
              text={a.text}
              onClick={() => {
                applyAlign(c, i, ids, a.mode, env);
                close();
              }}
            />
          ))}
        </>
      )}
    </Dropdown>
  );
}

/** Botão da barra que abre um menu logo abaixo. */
function Dropdown({ icon, label, children }: { icon: LucideIcon; label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Tool icon={icon} label={label} active={open} onClick={() => setOpen(!open)} />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.96) translateY(-4px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.1 } }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute top-full right-0 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/15"
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------ peças

function Tool({
  icon: Icon,
  label,
  text,
  onClick,
  active,
  danger,
  disabled,
}: {
  icon: LucideIcon | ((p: { className?: string; strokeWidth?: number }) => ReactNode);
  label: string;
  text?: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "press inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold disabled:opacity-40",
        active ? "bg-brand-50 text-brand-700" : "text-slate-600",
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon className="size-4" strokeWidth={1.9} />
      {text && <span>{text}</span>}
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />;

function TextTools({ l, set, exportWidth }: { l: TextLayer; set: (p: Partial<TextLayer>) => void; exportWidth: number }) {
  const editText = useApp((s) => s.editText);
  const px = Math.round(l.size * exportWidth);
  const step = (dir: 1 | -1) => set({ size: clamp(l.size * (dir > 0 ? 1.1 : 1 / 1.1), 0.008, 0.5) });
  const ALIGN: Record<TextLayer["align"], { icon: LucideIcon; next: TextLayer["align"]; label: string }> = {
    left: { icon: AlignLeft, next: "center", label: "Alinhado à esquerda" },
    center: { icon: AlignCenter, next: "right", label: "Centralizado" },
    right: { icon: AlignRight, next: "left", label: "Alinhado à direita" },
  };
  const al = ALIGN[l.align];
  return (
    <>
      <Tool icon={Pencil} label="Editar texto (clique duplo ou Enter)" text="Editar" onClick={() => editText(l.id)} />
      <Sep />
      <select
        value={l.font}
        title="Fonte"
        onChange={(e) => set({ font: e.target.value as FontId })}
        className="h-7 w-[112px] rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-medium text-slate-700 outline-none focus:border-brand-500"
      >
        {(Object.keys(FONTS) as FontId[]).map((f) => (
          <option key={f} value={f}>
            {FONTS[f].label}
          </option>
        ))}
      </select>
      <div className="ml-1 flex h-7 items-center rounded-md border border-slate-200 bg-slate-50" title="Tamanho da fonte (px na exportação)">
        <button type="button" aria-label="Diminuir fonte" onClick={() => step(-1)} className="press flex h-full w-6 items-center justify-center text-slate-500 hover:text-slate-900">
          <Minus className="size-3" />
        </button>
        <span className="w-8 text-center font-mono text-[11px] text-slate-700 tabular-nums">{px}</span>
        <button type="button" aria-label="Aumentar fonte" onClick={() => step(1)} className="press flex h-full w-6 items-center justify-center text-slate-500 hover:text-slate-900">
          <Plus className="size-3" />
        </button>
      </div>
      <span className="px-1">
        <ColorField compact title="Cor do texto" value={l.color} onChange={(color) => set({ color })} />
      </span>
      <Tool
        icon={BoldIcon}
        label="Negrito"
        active={l.weight >= 700}
        onClick={() => set({ weight: l.weight >= 700 ? 500 : 700 })}
      />
      <Tool icon={al.icon} label={`${al.label} · clique para trocar`} onClick={() => set({ align: al.next })} />
      <Sep />
    </>
  );
}

function BoldIcon({ className }: { className?: string }) {
  return <span className={cx(className, "flex items-center justify-center text-[13px] leading-none font-extrabold")}>B</span>;
}

function DeviceTools({ l, c, i }: { l: Extract<Layer, { type: "device" }>; c: Category; i: number }) {
  const shots = useApp((s) => cur(s)?.shots[l.shot.kind] ?? []);
  const api = useApp.getState();
  return (
    <>
      <select
        value={l.shot.index}
        title="Qual print este aparelho mostra"
        onChange={(e) => {
          const index = Number(e.target.value);
          api.updateLayer(c, i, l.id, { shot: { ...l.shot, index }, name: `Aparelho · print ${index + 1}` });
          api.selectShot({ kind: l.shot.kind, index });
        }}
        className="h-7 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-medium text-slate-700 outline-none focus:border-brand-500"
      >
        {shots.map((id, k) => (
          <option key={k} value={k}>
            Print {k + 1}
            {id ? "" : " (vazio)"}
          </option>
        ))}
      </select>
      <Tool
        icon={Upload}
        label="Enviar outro print para este aparelho"
        onClick={async () => {
          const [f] = await pickImages();
          if (f) await api.importShots(l.shot.kind, l.shot.index, [f]);
        }}
      />
      <Tool
        icon={Crop}
        label="Ajustar o print (zoom, posição, barras do sistema)"
        onClick={() => {
          api.selectShot({ ...l.shot });
          api.setPanel("prints");
        }}
      />
      <Tool
        icon={AppWindow}
        label={l.frame === "none" ? "Mostrar a moldura do aparelho" : "Mostrar só a tela (sem moldura)"}
        text={l.frame === "none" ? "Só a tela" : "Moldura"}
        onClick={() => api.updateLayer(c, i, l.id, { frame: l.frame === "none" ? "auto" : "none" })}
      />
      <Sep />
    </>
  );
}

function MoreMenu({ l, c, i }: { l: Layer; c: Category; i: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const api = useApp.getState();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative">
      <Tool icon={Ellipsis} label="Mais ações" active={open} onClick={() => setOpen(!open)} />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.96) translateY(-4px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.1 } }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute top-full right-0 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/15"
          >
            <Item icon={ClipboardCopy} text="Copiar" kbd="Ctrl+C" onClick={run(() => copyToClipboard(c, i, [l.id]))} />
            <Item icon={ArrowUpToLine} text="Trazer para a frente" onClick={run(() => api.reorderLayer(c, i, l.id, "top"))} />
            <Item icon={ArrowDownToLine} text="Enviar para trás" onClick={run(() => api.reorderLayer(c, i, l.id, "bottom"))} />
            <Item
              icon={l.locked ? LockOpen : Lock}
              text={l.locked ? "Destravar posição" : "Travar posição"}
              onClick={run(() => api.updateLayer(c, i, l.id, { locked: !l.locked }))}
            />
            {!!l.rotation && <Item icon={RotateCcw} text="Zerar rotação" onClick={run(() => api.updateLayer(c, i, l.id, { rotation: 0 }))} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Item({ icon: Icon, text, kbd, onClick }: { icon: LucideIcon; text: ReactNode; kbd?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-slate-700 hover:bg-slate-50">
      <Icon className="size-3.5 text-slate-500" />
      <span className="flex-1">{text}</span>
      {kbd && <span className="font-mono text-[10px] text-slate-400">{kbd}</span>}
    </button>
  );
}
