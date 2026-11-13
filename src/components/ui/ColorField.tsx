"use client";
import { AnimatePresence, motion } from "motion/react";
import { HexColorInput, HexAlphaColorPicker, HexColorPicker } from "react-colorful";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./controls";

const SWATCHES = ["#ffffff", "#f1f5f9", "#0f172a", "#1e3a8a", "#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#e6ecf5"];

/**
 * Botão com amostra de cor que abre um seletor flutuante.
 *
 * O seletor é renderizado num PORTAL (no <body>) com posição fixa calculada a
 * partir do botão: assim nunca fica cortado por cartões com `overflow:hidden`
 * ou pela rolagem da barra lateral. Abre para cima se não couber embaixo.
 */
export function ColorField({
  label,
  value,
  onChange,
  showSwatch = true,
  title,
  alpha = false,
  compact = false,
}: {
  label?: string;
  value: string;
  onChange: (hex: string) => void;
  showSwatch?: boolean;
  title?: string;
  alpha?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean }>({ left: 0, top: 0, up: false });

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const W = 228;
    const Hh = alpha ? 300 : 280;
    const up = r.bottom + Hh + 8 > window.innerHeight && r.top - Hh - 8 > 0;
    setPos({
      left: Math.min(Math.max(8, r.left), window.innerWidth - W - 8),
      top: up ? r.top - 6 : r.bottom + 6,
      up,
    });
  }, [alpha]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const Picker = alpha ? HexAlphaColorPicker : HexColorPicker;
  return (
    <>
      <button
        ref={btn}
        type="button"
        title={title ?? label}
        onClick={() => setOpen(!open)}
        className={cx(
          "press flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold",
          compact ? "w-7 px-0" : "w-full px-2",
          open ? "border-brand-400 bg-white text-brand-700" : "border-slate-200 bg-slate-100/60 text-slate-600 hover:bg-white",
        )}
      >
        <span
          className="size-3.5 shrink-0 rounded-full border border-slate-300"
          style={{
            background: showSwatch
              ? `linear-gradient(${value}, ${value}), repeating-conic-gradient(#cbd5e1 0 25%, #fff 0 50%) 50% / 6px 6px`
              : "conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)",
          }}
        />
        {label && !compact && <span className="truncate">{label}</span>}
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={pop}
                initial={{ opacity: 0, transform: "scale(0.96)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                exit={{ opacity: 0, transform: "scale(0.97)", transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  position: "fixed",
                  left: pos.left,
                  top: pos.top,
                  translate: pos.up ? "0 -100%" : undefined,
                  transformOrigin: pos.up ? "bottom left" : "top left",
                }}
                className="z-[100] w-[228px] rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl shadow-slate-900/20"
              >
                <Picker color={value} onChange={onChange} style={{ width: "100%", height: 150 }} />
                <div className="mt-2 grid grid-cols-12 gap-1">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => onChange(c)}
                      className="press aspect-square rounded border border-slate-300"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="size-6 shrink-0 rounded-md border border-slate-200" style={{ background: value }} />
                  <span className="text-[11px] text-slate-400">#</span>
                  <HexColorInput
                    color={value}
                    alpha={alpha}
                    onChange={onChange}
                    className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 font-mono text-xs text-slate-800 uppercase outline-none focus:border-brand-500"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
