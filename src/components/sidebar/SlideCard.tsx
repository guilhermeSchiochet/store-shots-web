"use client";
import { Copy, Paintbrush } from "lucide-react";
import type { Background } from "@/lib/models";
import { cur, useApp } from "@/store/app";
import { Btn, Segmented, Slider } from "../ui/controls";
import { ColorField } from "../ui/ColorField";
import { Card, Reveal } from "../ui/Card";

const PRESET_BG: Background[] = [
  { type: "aurora", a: "#f8fafc", b: "#c7d2fe", c: "#fbcfe8", angle: 180 },
  { type: "aurora", a: "#0b1020", b: "#4f46e5", c: "#db2777", angle: 180 },
  { type: "aurora", a: "#fff7ed", b: "#fdba74", c: "#fda4af", angle: 180 },
  { type: "aurora", a: "#052e2b", b: "#10b981", c: "#0ea5e9", angle: 180 },
  { type: "aurora", a: "#f0fdfa", b: "#99f6e4", c: "#bfdbfe", angle: 180 },
  { type: "aurora", a: "#1e1b4b", b: "#8b5cf6", c: "#22d3ee", angle: 180 },
  { type: "radial", a: "#ffffff", b: "#c7d2fe", angle: 180 },
  { type: "radial", a: "#3b82f6", b: "#0f172a", angle: 180 },
  { type: "radial", a: "#fde68a", b: "#f97316", angle: 180 },
  { type: "radial", a: "#a78bfa", b: "#312e81", angle: 180 },
  { type: "gradient", a: "#f97316", b: "#db2777", angle: 160 },
  { type: "gradient", a: "#06b6d4", b: "#0d9488", angle: 160 },
  { type: "gradient", a: "#ffffff", b: "#e6ecf5", angle: 180 },
  { type: "gradient", a: "#eef4ff", b: "#c9dafc", angle: 180 },
  { type: "gradient", a: "#0f172a", b: "#1e3a8a", angle: 160 },
  { type: "gradient", a: "#fdf2f8", b: "#fbcfe8", angle: 180 },
  { type: "gradient", a: "#ecfdf5", b: "#a7f3d0", angle: 180 },
  { type: "gradient", a: "#fff7ed", b: "#fed7aa", angle: 180 },
  { type: "gradient", a: "#4f46e5", b: "#9333ea", angle: 135 },
  { type: "solid", a: "#111827", b: "#111827", angle: 180 },
];

const css = (bg: Background) =>
  bg.type === "solid"
    ? bg.a
    : bg.type === "radial"
      ? `radial-gradient(circle at 50% 35%, ${bg.a}, ${bg.b} 85%)`
      : bg.type === "aurora"
        ? `radial-gradient(circle at 10% 8%, ${bg.b}, transparent 75%), radial-gradient(circle at 95% 90%, ${bg.c ?? bg.b}, transparent 75%), ${bg.a}`
        : `linear-gradient(${bg.angle}deg, ${bg.a}, ${bg.b})`;

const LABEL_A: Record<Background["type"], string> = { solid: "Cor", gradient: "Cor inicial", radial: "Centro", aurora: "Base" };
const LABEL_B: Record<Background["type"], string> = { solid: "", gradient: "Cor final", radial: "Bordas", aurora: "Mancha 1" };

/** Fundo do slide selecionado (as ações do slide ficam no cabeçalho de cada slide, na área principal). */
export function SlideCard() {
  const category = useApp((s) => s.category);
  const slideIndex = useApp((s) => s.slideIndex);
  const slides = useApp((s) => cur(s)?.design[s.category].slides);
  const { setBackground } = useApp.getState();
  if (!slides?.length) return null;
  const i = Math.min(slideIndex, slides.length - 1);
  const slide = slides[i];
  const feature = category === "feature";
  const set = (patch: Partial<Background>) => setBackground(category, i, { ...slide.bg, ...patch });

  return (
    <Card title="Fundo" subtitle={feature ? "Recurso gráfico" : `Slide ${i + 1}`} icon={Paintbrush} accent="blue">
      <div className="grid grid-cols-7 gap-1">
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
      <div className="mt-2.5">
        <Segmented<Background["type"]>
          size="sm"
          value={slide.bg.type}
          onChange={(type) => set({ type })}
          items={[
            { value: "solid", label: "Sólida" },
            { value: "gradient", label: "Degradê" },
            { value: "radial", label: "Radial", title: "Luz no centro espalhando para as bordas" },
            { value: "aurora", label: "Aurora", title: "Manchas de cor suaves (mesh gradient)" },
          ]}
        />
      </div>
      <div className={slide.bg.type === "aurora" ? "mt-2 grid grid-cols-3 gap-1.5" : "mt-2 grid grid-cols-2 gap-1.5"}>
        <ColorField label={LABEL_A[slide.bg.type]} value={slide.bg.a} onChange={(a) => set({ a })} />
        {slide.bg.type !== "solid" && <ColorField label={LABEL_B[slide.bg.type]} value={slide.bg.b} onChange={(b) => set({ b })} />}
        {slide.bg.type === "aurora" && <ColorField label="Mancha 2" value={slide.bg.c ?? slide.bg.b} onChange={(c) => set({ c })} />}
      </div>
      <Reveal show={slide.bg.type === "gradient"}>
        <Slider label="Ângulo do degradê" value={slide.bg.angle} min={0} max={360} step={1} scale={1} suffix="°" onChange={(v) => set({ angle: Math.round(v) })} />
      </Reveal>
      {!feature && slides.length > 1 && (
        <Btn variant="ghost" size="sm" icon={Copy} className="mt-2 w-full" onClick={() => setBackground(category, i, slide.bg, true)}>
          Aplicar este fundo a todos os slides
        </Btn>
      )}
    </Card>
  );
}
