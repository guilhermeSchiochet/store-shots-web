"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ensureFonts, fontEvents } from "@/lib/fonts";
import { frameBank } from "@/lib/frames";
import { useFrameVersion, useImageVersion } from "@/lib/hooks";
import { imageBank } from "@/lib/images";
import { exportSizeOf, type ExportPreset, type Project, type Slide, type TextLayer } from "@/lib/models";
import { renderSlide, type RenderEnv } from "@/lib/render";
import { cx } from "../ui/controls";

export const useFontVersion = () => useSyncExternalStore(fontEvents.subscribe, fontEvents.version, () => 0);

/** Ambiente de desenho do preview (imagens reduzidas, marcadores de vazio). */
export function previewEnv(project: Project, preset: ExportPreset): RenderEnv {
  const { w, h } = exportSizeOf(project, preset);
  return {
    project,
    preset,
    W: w,
    H: h,
    frame: (id) => frameBank.get(id),
    image: (id) => (id ? imageBank.peek(id, "preview") : undefined),
    aspect: (id) => {
      const s = imageBank.size(id);
      return s ? s.w / s.h : null;
    },
    preview: true,
  };
}

/**
 * Um slide desenhado com a MESMA função da exportação, na escala da tela.
 * Redesenha só quando o slide, os prints, as imagens, as molduras ou as
 * fontes mudam. [fade] faz o desenho anterior sumir suavemente ao trocar imagem.
 */
export function SlideCanvas({
  project,
  preset,
  slide,
  className,
  fade = true,
  maxDpr = 2,
}: {
  project: Project;
  preset: ExportPreset;
  slide: Slide;
  className?: string;
  fade?: boolean;
  maxDpr?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ghost = useRef<HTMLCanvasElement>(null);
  const scratch = useRef<OffscreenCanvas | null>(null);
  const [width, setWidth] = useState(0);
  const imgV = useImageVersion();
  const frameV = useFrameVersion();
  const fontV = useFontVersion();
  const size = exportSizeOf(project, preset);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    void ensureFonts(slide.layers.filter((l): l is TextLayer => l.type === "text"));
  }, [slide.layers]);

  // Identidade do conteúdo visual (imagens) para o crossfade ao trocar.
  const content = slide.layers
    .map((l) =>
      l.type === "device" ? project.shots[l.shot.kind][l.shot.index] : l.type === "image" || l.type === "badge" ? l.imageId : "",
    )
    .join("|");
  const lastContent = useRef(content);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(width * dpr));
    const H = Math.max(1, Math.round((width * size.h * dpr) / size.w));

    if (fade && lastContent.current !== content && ghost.current && c.width > 1) {
      const g = ghost.current;
      g.width = c.width;
      g.height = c.height;
      g.getContext("2d")!.drawImage(c, 0, 0);
      g.style.transition = "none";
      g.style.opacity = "1";
      requestAnimationFrame(() => {
        g.style.transition = "opacity 260ms cubic-bezier(0.23, 1, 0.32, 1)";
        g.style.opacity = "0";
      });
    }
    lastContent.current = content;

    const raf = requestAnimationFrame(() => {
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const ctx = c.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(W / size.w, 0, 0, W / size.w, 0, 0);
      scratch.current ??= new OffscreenCanvas(1, 1);
      renderSlide(ctx, previewEnv(project, preset), slide, scratch.current);
    });
    return () => cancelAnimationFrame(raf);
    // Redesenha só quando algo que ESTE slide usa mudou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, imgV, frameV, fontV, slide, project.shots, project.adjust, size.w, size.h, preset, content, fade, maxDpr]);

  return (
    <div ref={wrap} className={cx("relative overflow-hidden", className)} style={{ aspectRatio: `${size.w} / ${size.h}` }}>
      <canvas ref={canvas} className="block size-full" />
      {fade && <canvas ref={ghost} className="pointer-events-none absolute inset-0 size-full opacity-0" />}
    </div>
  );
}
