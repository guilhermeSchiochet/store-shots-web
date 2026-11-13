"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "./controls";

const ACCENTS = {
  blue: "border-brand-100 bg-brand-50 text-brand-600",
  purple: "border-purple-100 bg-purple-50 text-purple-600",
  green: "border-emerald-100 bg-emerald-50 text-emerald-600",
  slate: "border-slate-200 bg-slate-50 text-slate-500",
};

/** Cartão da barra lateral: cabeçalho com ícone e corpo recolhível (altura animada). */
export function Card({
  title,
  subtitle,
  icon: Icon,
  accent = "blue",
  trailing,
  header,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: keyof typeof ACCENTS;
  trailing?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className={cx(!!header && "border-b border-slate-100 bg-slate-50/60")}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className={cx("flex size-6 shrink-0 items-center justify-center rounded-md border", ACCENTS[accent])}>
            <Icon className="size-3.5" strokeWidth={2} />
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="min-w-0 flex-1 text-left outline-none"
            aria-expanded={open}
          >
            <h2 className="text-xs leading-tight font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="truncate text-[10px] text-slate-400">{subtitle}</p>}
          </button>
          {trailing}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Recolher" : "Expandir"}
            className="press rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronDown
              className="size-4 transition-transform duration-200 ease-[var(--ease-out)]"
              style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          </button>
        </div>
        {open && header && <div className="px-2.5 pb-2.5">{header}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Some/aparece com altura + fade (controles contextuais). */
export function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Seção recolhível dentro de um painel ("Mais ajustes"): fechada por padrão para não poluir. */
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded py-1 text-left text-[10px] font-semibold tracking-wider text-slate-400 uppercase hover:text-slate-600"
      >
        {title}
        <ChevronDown
          className="size-3.5 transition-transform duration-200 ease-[var(--ease-out)]"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      <Reveal show={open}>{children}</Reveal>
    </div>
  );
}
