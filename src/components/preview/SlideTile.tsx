"use client";
import { Upload } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { hitBox, panShot, rotateVec, shotArea, toLocal, type Box } from "@/lib/geometry";
import { frameBank } from "@/lib/frames";
import { imageBank } from "@/lib/images";
import { clamp, ZOOM, type DeviceLayer, type ExportPreset, type Layer } from "@/lib/models";
import { deviceFrameDef, layerBox } from "@/lib/render";
import { cur, flushSaves, slotKey, useApp } from "@/store/app";
import { cx } from "../ui/controls";
import { Spinner } from "../ui/feedback";
import { pickImages, useFileDrop } from "../ui/files";
import { previewEnv, SlideCanvas, useFontVersion } from "./SlideCanvas";

const SNAP = 0.012; // ímã do centro (fração do slide)

type Drag =
  | { mode: "move"; id: string; x0: number; y0: number; px: number; py: number; moved: boolean }
  | { mode: "pan"; id: string; px: number; py: number; moved: boolean }
  | { mode: "scale"; id: string; w0: number; size0: number; d0: number; moved: boolean }
  | { mode: "width"; id: string; moved: boolean }
  | { mode: "rotate"; id: string; moved: boolean };

/**
 * Um slide editável no preview. O desenho é feito por `SlideCanvas` (mesma
 * função da exportação); por cima, uma camada HTML mostra seleção, alças e
 * guias — nada disso vai para a imagem exportada.
 */
export function SlideTile({ preset, slideIndex }: { preset: ExportPreset; slideIndex: number }) {
  const c = preset.category;
  const project = useApp(cur)!;
  const slide = project.design[c].slides[slideIndex];
  const selected = useApp((s) => s.slideIndex === slideIndex);
  const layerId = useApp((s) => (s.slideIndex === slideIndex ? s.layerId : null));
  const exporting = useApp((s) => !!s.progress);
  const busyMap = useApp((s) => s.busy);
  const api = useApp.getState();
  useFontVersion(); // caixas de texto dependem da fonte carregada

  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ x: boolean; y: boolean } | null>(null);
  const drag = useRef<Drag | null>(null);

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
    const hit = hitAt(e.clientX, e.clientY);
    if (!hit) {
      api.selectSlide(slideIndex);
      return;
    }
    api.selectLayer(hit.id, slideIndex);
    if (hit.locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current =
      e.altKey && hit.type === "device"
        ? { mode: "pan", id: hit.id, px: e.clientX, py: e.clientY, moved: false }
        : { mode: "move", id: hit.id, x0: hit.x, y0: hit.y, px: e.clientX, py: e.clientY, moved: false };
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

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) {
      if (!exporting) setHover(hitAt(e.clientX, e.clientY)?.id ?? null);
      return;
    }
    const l = layerOf(d.id);
    const b = boxes.get(d.id);
    if (!l || !b || !scale) return;
    d.moved = true;
    const p = toSlide(e.clientX, e.clientY);

    if (d.mode === "move") {
      const x = d.x0 + (e.clientX - d.px) / scale / env.W;
      const y = d.y0 + (e.clientY - d.py) / scale / env.H;
      const sx = Math.abs(x - 0.5) < SNAP;
      const sy = Math.abs(y - 0.5) < SNAP;
      setGuides({ x: sx, y: sy });
      api.updateLayer(c, slideIndex, d.id, { x: sx ? 0.5 : x, y: sy ? 0.5 : y });
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
    const d = drag.current;
    drag.current = null;
    setGuides(null);
    if (d?.moved) {
      void flushSaves();
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
    if (hit?.type === "text") api.requestTextFocus();
  };


  const sel = layerId ? layerOf(layerId) : undefined;
  const selBox = sel && boxes.get(sel.id);
  const hoverBox = hover && hover !== layerId ? boxes.get(hover) : undefined;
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
      onPointerLeave={() => !drag.current && setHover(null)}
      onPointerCancel={() => {
        drag.current = null;
        setGuides(null);
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
      <SlideCanvas project={project} preset={preset} slide={slide} className="rounded-[10px]" />

      {!exporting && scale > 0 && (
        <div className="pointer-events-none absolute inset-0">
          {guides && (
            <>
              <span className={cx("absolute inset-y-0 left-1/2 w-px -translate-x-1/2", guides.x ? "bg-pink-500" : "bg-pink-500/25")} />
              <span className={cx("absolute inset-x-0 top-1/2 h-px -translate-y-1/2", guides.y ? "bg-pink-500" : "bg-pink-500/25")} />
            </>
          )}
          {hoverBox && <div className="absolute rounded-[2px] border border-brand-600/60" style={style(hoverBox)} />}
          {selBox && sel && (
            <div className="absolute" style={style(selBox)}>
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

      <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-ink opacity-0 transition-opacity group-hover:opacity-100 dark:bg-black/60">
        {slideIndex + 1}
      </span>

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
