"use client";
import { AnimatePresence, motion } from "motion/react";
import { X, type LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cx } from "./controls";

/** Diálogo no estilo da referência HTML: cabeçalho com ícone, corpo e rodapé. */
export function Modal({
  open,
  onClose,
  icon: Icon,
  tone = "blue",
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  icon: LucideIcon;
  tone?: "blue" | "red";
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={cx("w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl", wide ? "max-w-5xl" : "max-w-md")}
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={cx(
                    "flex size-8 items-center justify-center rounded-lg border",
                    tone === "red" ? "border-red-100 bg-red-50 text-red-600" : "border-brand-100 bg-brand-50 text-brand-600",
                  )}
                >
                  <Icon className="size-4" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm leading-tight font-bold text-slate-900">{title}</h3>
                  {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="press rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className={cx("text-xs text-slate-600", wide ? "thin-scroll max-h-[72vh] overflow-y-auto p-5" : "p-5")}>{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
