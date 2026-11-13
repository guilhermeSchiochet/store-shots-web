"use client";
import { ChevronLeft, ChevronRight, Copy, Paintbrush, Plus, Trash2 } from "lucide-react";
import { MAX_SHOTS, MAX_SLIDES, presetsOf, type Background } from "@/lib/models";
import { cur, useApp } from "@/store/app";
import { Btn, cx, IconBtn, Segmented, Slider } from "../ui/controls";
import { ColorField } from "../ui/ColorField";
import { Card, Reveal } from "../ui/Card";
import { SlideCanvas } from "../preview/SlideCanvas";
import { ShotDropZone } from "./ShotDrop";

const PRESET_BG: Background[] = [
  { type: "gradient", a: "#ffffff", b: "#e6ecf5", angle: 180 },
  { type: "gradient", a: "#eef4ff", b: "#c9dafc", angle: 180 },
  { type: "gradient", a: "#0f172a", b: "#1e3a8a", angle: 160 },
  { type: "gradient", a: "#fdf2f8", b: "#fbcfe8", angle: 180 },
  { type: "gradient", a: "#ecfdf5", b: "#a7f3d0", angle: 180 },
  { type: "gradient", a: "#fff7ed", b: "#fed7aa", angle: 180 },
  { type: "gradient", a: "#4f46e5", b: "#9333ea", angle: 135 },
  { type: "solid", a: "#111827", b: "#111827", angle: 180 },
];

const css = (bg: Background) => (bg.type === "solid" ? bg.a : `linear-gradient(${bg.angle}deg, ${bg.a}, ${bg.b})`);

/** Slide selecionado: navegação entre slides e fundo. */
export function SlideCard() {
  const category = useApp((s) => s.category);
  const slideIndex = useApp((s) => s.slideIndex);
  const slides = useApp((s) => cur(s)?.design[s.category].slides);
  const project = useApp(cur)!;
  const { selectSlide, addSlide, removeSlide, moveSlide, setBackground } = useApp.getState();
  if (!slides?.length) return null;
  const i = Math.min(slideIndex, slides.length - 1);
  const slide = slides[i];
  const preset = presetsOf(category)[0];
  const feature = category === "feature";
  const set = (patch: Partial<Background>) => setBackground(category, i, { ...slide.bg, ...patch });

  return (
    <Card title={feature ? "Recurso gráfico" : `Slide ${i + 1} de ${slides.length}`} subtitle="Fundo e ordem dos slides" icon={Paintbrush} accent="blue">
      {!feature && (
        <div className="mb-3">
          <ShotDropZone
            onFiles={(files, t) => useApp.getState().placePrints(category, files, t === null ? {} : { slide: t })}
            // Sobre um slide: começa pelo print que o aparelho dele mostra; fora: pelo print 1.
            startFor={(t) => {
              if (t === null) return 0;
              const dev = slides[t]?.layers.find((l) => l.type === "device");
              return Math.min(MAX_SHOTS - 1, dev?.type === "device" ? dev.shot.index : t);
            }}
          >
            {(target) => (
          <div className="thin-scroll flex gap-1.5 overflow-x-auto pb-1" title="Arraste vários prints para cá: eles preenchem os slides em ordem de nome">
            {slides.map((s, k) => (
              <button
                key={s.id}
                type="button"
                data-drop-index={k}
                onClick={() => selectSlide(k)}
                title={`Slide ${k + 1}`}
                className={cx(
                  "press relative w-11 shrink-0 overflow-hidden rounded-md border",
                  target === k
                    ? "border-brand-600 ring-2 ring-brand-600/50"
                    : k === i
                      ? "border-brand-600 ring-2 ring-brand-600/25"
                      : "border-slate-200 hover:border-brand-300",
                )}
              >
                <SlideCanvas project={project} preset={preset} slide={s} fade={false} maxDpr={1} />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-[#0f172a]/70 px-1 text-[8px] font-bold text-ink">{k + 1}</span>
              </button>
            ))}
            {slides.length < MAX_SLIDES && (
              <button
                type="button"
                onClick={() => addSlide(category)}
                title="Adicionar slide"
                className="press flex w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-600"
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
            )}
          </ShotDropZone>
          <div className="mt-1.5 flex items-center gap-0.5">
            <IconBtn icon={ChevronLeft} label="Mover para a esquerda" disabled={i === 0} onClick={() => moveSlide(category, i, -1)} />
            <IconBtn
              icon={ChevronRight}
              label="Mover para a direita"
              disabled={i === slides.length - 1}
              onClick={() => moveSlide(category, i, 1)}
            />
            <IconBtn icon={Copy} label="Duplicar slide" disabled={slides.length >= MAX_SLIDES} onClick={() => addSlide(category, i)} />
            <IconBtn icon={Trash2} label="Excluir slide" danger disabled={slides.length <= 1} onClick={() => removeSlide(category, i)} />
            <span className="ml-auto text-[10px] text-slate-400">máx. {MAX_SLIDES} por loja</span>
          </div>
        </div>
      )}

      <p className="mb-1.5 text-[11px] font-medium text-slate-600">Fundo</p>
      <Segmented<Background["type"]>
        size="sm"
        value={slide.bg.type}
        onChange={(type) => set({ type })}
        items={[
          { value: "solid", label: "Cor sólida" },
          { value: "gradient", label: "Degradê" },
        ]}
      />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <ColorField label={slide.bg.type === "solid" ? "Cor" : "Cor inicial"} value={slide.bg.a} onChange={(a) => set({ a })} />
        {slide.bg.type === "gradient" && <ColorField label="Cor final" value={slide.bg.b} onChange={(b) => set({ b })} />}
      </div>
      <Reveal show={slide.bg.type === "gradient"}>
        <Slider label="Ângulo do degradê" value={slide.bg.angle} min={0} max={360} step={1} scale={1} suffix="°" onChange={(v) => set({ angle: Math.round(v) })} />
      </Reveal>
      <div className="mt-2 grid grid-cols-8 gap-1">
        {PRESET_BG.map((bg, k) => (
          <button
            key={k}
            type="button"
            title="Usar este fundo"
            onClick={() => setBackground(category, i, bg)}
            className="press aspect-square rounded-md border border-slate-200"
            style={{ background: css(bg) }}
          />
        ))}
      </div>
      {!feature && slides.length > 1 && (
        <Btn variant="ghost" size="sm" icon={Copy} className="mt-2 w-full" onClick={() => setBackground(category, i, slide.bg, true)}>
          Aplicar este fundo a todos os slides
        </Btn>
      )}
    </Card>
  );
}
