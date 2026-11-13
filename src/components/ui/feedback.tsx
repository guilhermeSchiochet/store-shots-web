"use client";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "@/store/app";
import { cx } from "./controls";

export function Note({
  children,
  tone = "info",
  action,
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success";
  action?: ReactNode;
}) {
  const t = {
    info: ["border-slate-200 bg-slate-50 text-slate-500", Info],
    warning: ["border-amber-200/80 bg-amber-50 text-amber-800", AlertTriangle],
    success: ["border-emerald-200 bg-emerald-50 text-emerald-700", CheckCircle2],
  }[tone] as [string, LucideIcon];
  const Icon = t[1];
  return (
    <div className={cx("flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug", t[0])}>
      <Icon className="mt-px size-3.5 shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function EmptyHint({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center">
      <div className="mb-2 flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
        <Icon className="size-4" strokeWidth={1.8} />
      </div>
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      {message && <p className="mt-1 max-w-[260px] text-[11px] leading-relaxed text-slate-500">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block size-4 animate-spin rounded-full border-2 border-brand-600/25 border-t-brand-600 [animation-duration:650ms]",
        className,
      )}
    />
  );
}

/** Toasts no canto inferior direito; entram e saem pelo mesmo lado. */
export function Toaster() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            layout
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, transform: "translateY(12px) scale(0.98)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={{ opacity: 0, transform: "translateY(8px) scale(0.98)", transition: { duration: 0.15 } }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-auto flex max-w-[420px] items-center gap-2.5 rounded-xl bg-toast px-3.5 py-2.5 text-left text-xs leading-snug text-ink shadow-xl shadow-slate-900/20"
          >
            <span className={cx("size-2 shrink-0 rounded-full", t.error ? "bg-red-400" : "bg-emerald-400")} />
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
