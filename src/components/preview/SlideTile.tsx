"use client";
import { Upload } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { hitBox, panShot, rotateVec, shotArea, toLocal, type Box } from "@/lib/geometry";
import { frameBank } from "@/lib/frames";
import { imageBank } from "@/lib/images";
import { clamp, ZOOM, type DeviceLayer, type ExportPreset, type Layer, type TextLayer } from "@/lib/models";
import { deviceFrameDef, fontFamily, layerBox, layoutText } from "@/lib/render";
import { cur, flushSaves, slotKey, useApp } from "@/store/app";
import { cx } from "../ui/controls";
import { Spinner } from "../ui/feedback";
import { pickImages, useFileDrop } from "../ui/files";
import { aabb, intersects, union } from "@/lib/align";
import { GroupToolbar, LayerToolbar } from "./LayerToolbar";
import { previewEnv, SlideCanvas, useFontVersion } from "./SlideCanvas";

const SNAP = 0.012; // ímã do centro (fração do slide)
const HOLD_MS = 380; // pressionar e segurar no fundo do slide = arrastar o slide

const NONE: string[] = [];

type Drag =
  | {
      mode: "move";
      id: string;
      /** Posição inicial de cada camada que se move junto (seleção múltipla). */
      starts: { id: string; x: number; y: number }[];
      /** Centro do grupo no início (fração do slide), para o ímã do centro. */
      gx: number;
      gy: number;
      px: number;
      py: number;
      moved: boolean;
      /** Clique sem arrastar numa camada de um grupo: deixa só ela selecionada. */
      collapse: boolean;
    }
  | { mode: "pan"; id: string; px: number; py: number; moved: boolean }
  | { mode: "scale"; id: string; w0: number; size0: number; d0: number; moved: boolean }
  | { mode: "width"; id: string; moved: boolean }
  | { mode: "rotate"; id: string; moved: boolean };

/**
 * Um slide editável no preview. O desenho é feito por `SlideCanvas` (mesma
 * função da exportação); por cima, uma camada HTML mostra seleção, alças e
 * guias — nada disso vai para a imagem exportada.
 */
export function SlideTile({
  preset,
  slideIndex,
  first,
  onHoldDrag,
}: {
  preset: ExportPreset;
  slideIndex: number;
  /** Primeiro tamanho da categoria: mostra a barra flutuante quando nenhum tamanho foi clicado ainda. */
  first: boolean;
  /** Pressionou e segurou no fundo do slide: começa a arrastar o slide para reordenar. */
  onHoldDrag?: (slideIndex: number, x: number, y: number) => void;
}) {
  const c = preset.category;
  const project = useApp(cur)!;
  const slide = project.design[c].slides[slideIndex];
  const selected = useApp((s) => s.slideIndex === slideIndex);
  const layerId = useApp((s) => (s.slideIndex === slideIndex ? s.layerId : null));
  // Seleção global: pode juntar camadas de vários slides.
  const layerIds = useApp((s) => s.layerIds);
  const multi = layerIds.length > 1;
  const exporting = useApp((s) => !!s.progress);
  const busyMap = useApp((s) => s.busy);
  const activeTile = useApp((s) => s.tile === preset.id || (s.tile === null && first));
  // Só o tamanho ativo mostra o campo de edição (os outros acompanham pelo desenho).
  const editingHere = useApp((s) => (s.slideIndex === slideIndex ? s.editingText : null));
  const editing = activeTile ? editingHere : null;
  const api = useApp.getState();
  useFontVersion(); // caixas de texto dependem da fonte carregada

  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ x: boolean; y: boolean } | null>(null);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const hold = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const selRef = useRef<HTMLDivElement>(null);
  // Laço de seleção: arrastar a partir do fundo do slide.
  const marq = useRef<{ x0: number; y0: number; base: string[]; active: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const env = useMemo(() => previewEnv(project, preset), [project, preset]);
  const scale = width / env.W; // px de tela por px do slide
  const boxes = useMemo(() => new Map(slide?.layers.map((l) => [l.id, layerBox(l, env)])), [slide, env]);
  // Enquanto edita um texto no slide, o Canvas não desenha essa camada (o campo de edição fica no lugar).
  const drawn = useMemo(
    () => (slide && editing ? { ...slide, layers: slide.layers.filter((l) => l.id !== editing) } : slide),
    [slide, editing],
  );

  const busy = slide?.layers.some((l) => l.type === "device" && busyMap[slotKey(l.shot.kind, l.shot.index)]);

  // Ctrl + roda sobre um aparelho = zoom no print.
  useEffect(() => {
    const el = wrap.current;
    if (!el || !slide) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const hit = hitAt(e.clientX, e.clientY, (l) => l.type === "device") as DeviceLayer | undefined;
      if (!hit) return;
      e.preventDefault();
      api.selectLayer(hit.id, slideIndex);
      api.updateAdjust(hit.shot.kind, hit.shot.index, (a) => ({
        ...a,
        zoom: clamp(a.zoom * Math.exp(-e.deltaY * 0.0015), ZOOM.min, ZOOM.max),
      }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const lastDrop = useRef<{ x: number; y: number; shift: boolean } | null>(null);
  const [dropHint, setDropHint] = useState("");

  /**
   * O que acontece ao soltar arquivos neste ponto do slide:
   * - sobre uma imagem: substitui a imagem;
   * - Shift: adiciona como camada de imagem;
   * - qualquer outro lugar: vira print do aparelho (sob o cursor, ou o do
   *   slide); se o slide não tiver aparelho, um é criado.
   */
  function dropAction(x: number, y: number, shift: boolean) {
    const over = hitAt(x, y, (l) => l.type === "device" || l.type === "image");
    if (over?.type === "image") return { kind: "image-replace" as const, layer: over, hint: "Substituir esta imagem" };
    if (shift) return { kind: "image-add" as const, hint: "Adicionar como imagem" };
    const dev = (over?.type === "device" ? over : slide?.layers.find((l) => l.type === "device")) as DeviceLayer | undefined;
    if (dev) return { kind: "shot" as const, layer: dev, hint: `Usar como print ${dev.shot.index + 1} · Shift = como imagem` };
    return { kind: "create" as const, hint: "Criar aparelho com este print · Shift = como imagem" };
  }

  const drop = useFileDrop(async (files) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return api.toast("Formato não suportado. Use PNG, JPG ou WebP.", true);
    const pt = lastDrop.current;
    const a = pt && slide ? dropAction(pt.x, pt.y, pt.shift) : { kind: "create" as const };
    if (a.kind === "image-replace") await api.setLayerImage(c, slideIndex, a.layer.id, imgs[0]);
    else if (a.kind === "image-add") {
      const p = pt ? toSlide(pt.x, pt.y) : null;
      await api.addImageLayer(c, slideIndex, imgs[0], p ? { x: p.x / env.W, y: p.y / env.H } : undefined);
    } else if (a.kind === "shot") await api.placePrints(c, imgs, { shot: a.layer.shot.index });
    else await api.placePrints(c, imgs, { slide: slideIndex });
  });

  if (!slide) return null;

  const toSlide = (clientX: number, clientY: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  };
  function hitAt(clientX: number, clientY: number, filter: (l: Layer) => boolean = () => true) {
    if (!scale) return undefined;
    const p = toSlide(clientX, clientY);
    for (let k = slide.layers.length - 1; k >= 0; k--) {
      const l = slide.layers[k];
      const b = boxes.get(l.id);
      if (!l.hidden && b && filter(l) && hitBox(b, p.x, p.y, 4 / scale)) return l;
    }
    return undefined;
  }
  const layerOf = (id: string) => slide.layers.find((l) => l.id === id);

  // ------------------------------------------------------------ gestos
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (exporting || e.button !== 0) return;
    api.setTile(preset.id);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const hit = hitAt(e.clientX, e.clientY);
    if (!hit) {
      if (!additive || !selected) api.selectSlide(slideIndex);
      const p0 = toSlide(e.clientX, e.clientY);
      marq.current = { x0: p0.x, y0: p0.y, base: additive ? useApp.getState().layerIds : [], active: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      if (onHoldDrag && !additive) {
        const x = e.clientX;
        const y = e.clientY;
        const t = setTimeout(() => {
          hold.current = null;
          marq.current = null;
          onHoldDrag(slideIndex, x, y);
        }, HOLD_MS);
        hold.current = { t, x, y };
      }
      return;
    }
    // Shift/Ctrl + clique soma ou tira (mesmo em outro slide); clique numa camada do grupo mantém o grupo (para arrastar todas).
    const inGroup = layerIds.includes(hit.id);
    if (additive) {
      api.selectLayer(hit.id, slideIndex, true);
      if (!useApp.getState().layerIds.includes(hit.id)) return; // acabou de sair da seleção
    } else if (!inGroup) api.selectLayer(hit.id, slideIndex);
    else if (useApp.getState().layerId !== hit.id) api.selectLayers([...layerIds.filter((x) => x !== hit.id), hit.id], slideIndex);
    if (hit.locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.altKey && hit.type === "device") {
      drag.current = { mode: "pan", id: hit.id, px: e.clientX, py: e.clientY, moved: false };
      return;
    }
    const ids = useApp.getState().layerIds;
    // Move junto tudo o que está selecionado, inclusive em outros slides (mesmas frações = mesmo lugar).
    const movers = project.design[c].slides.flatMap((sl) => sl.layers).filter((l) => ids.includes(l.id) && !l.locked);
    const g = union(movers.map((l) => aabb(layerBox(l, env))))!;
    drag.current = {
      mode: "move",
      id: hit.id,
      starts: movers.map((l) => ({ id: l.id, x: l.x, y: l.y })),
      gx: (g.left + g.right) / 2 / env.W,
      gy: (g.top + g.bottom) / 2 / env.H,
      px: e.clientX,
      py: e.clientY,
      moved: false,
      collapse: inGroup && !additive && ids.length > 1,
    };
  };

  const startHandle = (mode: "scale" | "width" | "rotate") => (e: RPointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const l = layerId ? layerOf(layerId) : undefined;
    const b = l && boxes.get(l.id);
    if (!l || !b || l.locked) return;
    wrap.current!.setPointerCapture(e.pointerId);
    const p = toSlide(e.clientX, e.clientY);
    drag.current =
      mode === "scale"
        ? { mode, id: l.id, w0: l.w, size0: l.type === "text" ? l.size : 0, d0: Math.max(1, Math.hypot(p.x - b.cx, p.y - b.cy)), moved: false }
        : { mode, id: l.id, moved: false };
  };

  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.t);
    hold.current = null;
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 6) cancelHold();
    const m = marq.current;
    if (m && scale) {
      const p = toSlide(e.clientX, e.clientY);
      if (!m.active && Math.hypot(p.x - m.x0, p.y - m.y0) * scale < 5) return;
      m.active = true;
      cancelHold();
      const r = { left: Math.min(m.x0, p.x), right: Math.max(m.x0, p.x), top: Math.min(m.y0, p.y), bottom: Math.max(m.y0, p.y) };
      setMarquee(r);
      const hits = slide.layers.filter((l) => !l.hidden && !l.locked && intersects(aabb(boxes.get(l.id)!), r)).map((l) => l.id);
      const ids = [...new Set([...m.base, ...hits])];
      const cur = useApp.getState().layerIds;
      if (ids.length !== cur.length || ids.some((x, k) => x !== cur[k])) api.selectLayers(ids, slideIndex);
      return;
    }
    const d = drag.current;
    if (!d) {
      if (!exporting) setHover(hitAt(e.clientX, e.clientY)?.id ?? null);
      return;
    }
    const l = layerOf(d.id);
    const b = boxes.get(d.id);
    if (!l || !b || !scale) return;
    if (!d.moved) setDragging(true);
    d.moved = true;
    const p = toSlide(e.clientX, e.clientY);

    if (d.mode === "move") {
      // O grupo inteiro anda junto; o ímã usa o centro do grupo.
      let dx = (e.clientX - d.px) / scale / env.W;
      let dy = (e.clientY - d.py) / scale / env.H;
      const sx = Math.abs(d.gx + dx - 0.5) < SNAP;
      const sy = Math.abs(d.gy + dy - 0.5) < SNAP;
      if (sx) dx = 0.5 - d.gx;
      if (sy) dy = 0.5 - d.gy;
      setGuides({ x: sx, y: sy });
      api.patchLayers(c, slideIndex, Object.fromEntries(d.starts.map((st) => [st.id, { x: st.x + dx, y: st.y + dy }])));
    } else if (d.mode === "pan" && l.type === "device") {
      const dx = (e.clientX - d.px) / scale;
      const dy = (e.clientY - d.py) / scale;
      d.px = e.clientX;
      d.py = e.clientY;
      const local = rotateVec(dx, dy, -b.rot);
      const img = imageBank.size(project.shots[l.shot.kind][l.shot.index]);
      const frame = frameBank.get(deviceFrameDef(l, preset).id);
      if (!img) return;
      const screen =
        l.frame === "none" || !frame
          ? { w: b.w, h: b.h }
          : { w: (b.w * frame.screen.w) / frame.size.w, h: (b.h * frame.screen.h) / frame.size.h };
      const cam = l.frame === "none" ? 0 : (frame?.cameraInset ?? 0);
      api.updateAdjust(l.shot.kind, l.shot.index, (a) => panShot(img, a, shotArea(a, cam, screen), local.x, local.y));
    } else if (d.mode === "scale") {
      const ratio = Math.hypot(p.x - b.cx, p.y - b.cy) / d.d0;
      const w = clamp(d.w0 * ratio, 0.02, 3);
      api.updateLayer(c, slideIndex, d.id, (x) =>
        x.type === "text" ? { ...x, w, size: clamp(d.size0 * ratio, 0.008, 0.5) } : { ...x, w },
      );
    } else if (d.mode === "width") {
      const local = toLocal(b, p.x, p.y);
      api.updateLayer(c, slideIndex, d.id, { w: clamp((Math.abs(local.x) * 2) / env.W, 0.05, 3) });
    } else if (d.mode === "rotate") {
      let deg = (Math.atan2(p.y - b.cy, p.x - b.cx) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      else for (const s of [-180, -90, -45, 0, 45, 90, 180]) if (Math.abs(deg - s) < 4) deg = s;
      api.updateLayer(c, slideIndex, d.id, { rotation: Math.round(deg * 10) / 10 });
    }
  };

  const onPointerUp = async (e: RPointerEvent<HTMLDivElement>) => {
    cancelHold();
    const m = marq.current;
    marq.current = null;
    if (m) {
      setMarquee(null);
      return;
    }
    const d = drag.current;
    drag.current = null;
    setGuides(null);
    setDragging(false);
    if (d?.moved) {
      void flushSaves();
      return;
    }
    if (d?.mode === "move" && d.collapse) {
      api.selectLayer(d.id, slideIndex);
      return;
    }
    // Clique num aparelho sem print: escolhe o arquivo.
    const hit = d && layerOf(d.id);
    if (hit?.type === "device" && !project.shots[hit.shot.kind][hit.shot.index]) {
      const files = await pickImages(true);
      if (files.length) await api.importShots(hit.shot.kind, hit.shot.index, files);
    } else if (hit && (hit.type === "image" || hit.type === "badge") && !hit.imageId && hit.type === "image") {
      const [f] = await pickImages();
      if (f) await api.setLayerImage(c, slideIndex, hit.id, f);
    }
    void e;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const hit = hitAt(e.clientX, e.clientY);
    if (hit?.type === "text" && !hit.locked) {
      api.selectLayer(hit.id, slideIndex);
      api.editText(hit.id);
    }
  };


  const sel = layerId && !multi ? layerOf(layerId) : undefined;
  const selBox = sel && boxes.get(sel.id);
  const hoverBox = hover && !layerIds.includes(hover) ? boxes.get(hover) : undefined;
  const groupIds = multi ? layerIds.filter((id) => boxes.has(id)) : NONE; // as do grupo que estão NESTE slide
  const group = multi ? union(groupIds.map((id) => aabb(boxes.get(id)!))) : null;
  const style = (b: Box) => ({
    left: (b.cx - b.w / 2) * scale,
    top: (b.cy - b.h / 2) * scale,
    width: b.w * scale,
    height: b.h * scale,
    transform: b.rot ? `rotate(${b.rot}deg)` : undefined,
  });

  return (
    <div
      ref={wrap}
      {...drop.props}
      onDragOver={(e) => {
        lastDrop.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
        const hint = dropAction(e.clientX, e.clientY, e.shiftKey).hint;
        if (hint !== dropHint) setDropHint(hint);
        drop.props.onDragOver(e);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        cancelHold();
        if (!drag.current) setHover(null);
      }}
      onPointerCancel={() => {
        cancelHold();
        marq.current = null;
        setMarquee(null);
        drag.current = null;
        setGuides(null);
        setDragging(false);
      }}
      onDoubleClick={onDoubleClick}
      className={cx(
        "group relative touch-none rounded-[10px] select-none",
        "transition-shadow duration-200 ease-[var(--ease-out)]",
        hover && !exporting ? "cursor-move" : "cursor-default",
        selected && !layerId
          ? "shadow-[0_0_0_2px_var(--color-brand-600),0_10px_24px_-8px_rgb(37_99_235/0.35)]"
          : drop.over
            ? "shadow-[0_0_0_2px_var(--color-brand-600)]"
            : "shadow-[0_0_0_1px_var(--color-slate-200),0_1px_2px_rgb(15_23_42/0.05)] hover:shadow-[0_0_0_1px_var(--color-brand-300),0_10px_24px_-10px_rgb(15_23_42/0.25)]",
      )}
    >
      <SlideCanvas project={project} preset={preset} slide={drawn!} className="rounded-[10px]" />

      {!exporting && scale > 0 && (
        <div className="pointer-events-none absolute inset-0">
          {guides && (
            <>
              <span className={cx("absolute inset-y-0 left-1/2 w-px -translate-x-1/2", guides.x ? "bg-pink-500" : "bg-pink-500/25")} />
              <span className={cx("absolute inset-x-0 top-1/2 h-px -translate-y-1/2", guides.y ? "bg-pink-500" : "bg-pink-500/25")} />
            </>
          )}
          {hoverBox && <div className="absolute rounded-[2px] border border-brand-600/60" style={style(hoverBox)} />}
          {groupIds.map((id) => (
            <div
              key={id}
              className={cx("absolute rounded-[2px] border-[1.5px]", layerOf(id)?.locked ? "border-amber-500" : "border-brand-600")}
              style={style(boxes.get(id)!)}
            />
          ))}
          {group && (
            <div
              ref={selRef}
              className="absolute rounded-[3px] border border-dashed border-brand-600/80"
              style={{
                left: group.left * scale - 4,
                top: group.top * scale - 4,
                width: (group.right - group.left) * scale + 8,
                height: (group.bottom - group.top) * scale + 8,
              }}
            />
          )}
          {marquee && (
            <div
              className="absolute rounded-[2px] border border-brand-600 bg-brand-600/10"
              style={{
                left: marquee.left * scale,
                top: marquee.top * scale,
                width: (marquee.right - marquee.left) * scale,
                height: (marquee.bottom - marquee.top) * scale,
              }}
            />
          )}
          {selBox && sel && sel.id === editing && sel.type === "text" && (
            <InlineText
              layer={sel}
              box={selBox}
              scale={scale}
              W={env.W}
              onDone={(empty) => {
                api.editText(null);
                if (empty) api.removeLayer(c, slideIndex, sel.id);
              }}
            />
          )}
          {selBox && sel && sel.id !== editing && (
            <div ref={selRef} className="absolute" style={style(selBox)}>
              <div className={cx("absolute -inset-px rounded-[2px] border-[1.5px]", sel.locked ? "border-amber-500" : "border-brand-600")} />
              {!sel.locked && (
                <>
                  {[
                    [0, 0],
                    [1, 0],
                    [0, 1],
                    [1, 1],
                  ].map(([x, y]) => (
                    <span
                      key={`${x}${y}`}
                      onPointerDown={startHandle("scale")}
                      className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-600 bg-[#fff] shadow"
                      style={{ left: `${x * 100}%`, top: `${y * 100}%`, cursor: x === y ? "nwse-resize" : "nesw-resize" }}
                    />
                  ))}
                  {sel.type === "text" && (
                    <span
                      onPointerDown={startHandle("width")}
                      title="Largura da caixa de texto"
                      className="pointer-events-auto absolute top-1/2 left-full h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-brand-600 bg-[#fff] shadow"
                    />
                  )}
                  <span className="absolute -top-5 left-1/2 h-5 w-px -translate-x-1/2 bg-brand-600/70" />
                  <span
                    onPointerDown={startHandle("rotate")}
                    title="Girar (Shift = de 15 em 15°)"
                    className="pointer-events-auto absolute -top-7 left-1/2 size-3 -translate-x-1/2 cursor-grab rounded-full border-2 border-brand-600 bg-[#fff] shadow"
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {sel && activeTile && !dragging && !exporting && sel.id !== editing && (
        <LayerToolbar key={sel.id} layer={sel} category={c} slideIndex={slideIndex} anchor={selRef} env={env} />
      )}
      {group && selected && activeTile && !dragging && !exporting && (
        <GroupToolbar ids={layerIds} category={c} slideIndex={slideIndex} anchor={selRef} env={env} />
      )}

      <div
        className={cx(
          "pointer-events-none absolute inset-0 flex items-center justify-center rounded-[10px] bg-brand-600/10 transition-opacity duration-150",
          drop.over ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-ink shadow-lg">
          <Upload className="size-3.5" /> {dropHint || "Soltar print"}
        </span>
      </div>

      <div
        className={cx(
          "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[10px] bg-white/70 transition-opacity duration-200",
          busy ? "opacity-100" : "opacity-0",
        )}
      >
        <Spinner className="size-5" />
        <span className="text-[11px] font-semibold text-slate-500">Processando...</span>
      </div>
    </div>
  );
}

/**
 * Campo de edição do texto direto no slide: fica exatamente sobre a camada,
 * com a mesma fonte, tamanho, cor e alinhamento. Cada tecla atualiza o slide
 * (as outras prévias acompanham ao vivo). Esc, Ctrl+Enter ou clicar fora termina.
 */
function InlineText({
  layer: l,
  box,
  scale: k,
  W,
  onDone,
}: {
  layer: TextLayer;
  box: Box;
  scale: number;
  W: number;
  onDone: (empty: boolean) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.select();
  }, []);
  const t = layoutText(l, W);
  const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: (box.cx - box.w / 2) * k,
        top: (box.cy - box.h / 2) * k,
        width: box.w * k,
        height: box.h * k,
        transform: box.rot ? `rotate(${box.rot}deg)` : undefined,
      }}
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onDoubleClick={stop}
    >
      <textarea
        ref={ref}
        value={l.text}
        spellCheck={false}
        aria-label="Texto da camada"
        onChange={(e) => {
          const s = useApp.getState();
          s.updateLayer(s.category, s.slideIndex, l.id, { text: e.target.value });
        }}
        onBlur={(e) => onDone(!e.currentTarget.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className="block size-full resize-none overflow-hidden rounded-[2px] border-0 outline-[1.5px] outline-offset-2 outline-brand-600 select-text outline-solid"
        style={{
          fontFamily: fontFamily(l.font),
          fontWeight: l.weight,
          fontStyle: l.italic ? "italic" : undefined,
          fontSize: t.size * k,
          lineHeight: `${t.lineH * k}px`,
          letterSpacing: `${l.letterSpacing * t.size * k}px`,
          color: l.color,
          caretColor: l.color,
          textAlign: l.align,
          textTransform: l.uppercase ? "uppercase" : undefined,
          padding: t.pad * k,
          background: l.bg ?? "transparent",
          borderRadius: l.bg ? t.size * 0.45 * k : undefined,
          whiteSpace: "pre-wrap",
        }}
      />
    </div>
  );
}
