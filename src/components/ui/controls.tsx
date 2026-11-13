"use client";
import { motion } from "motion/react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

// ------------------------------------------------------------ botões

type BtnVariant = "primary" | "secondary" | "ghost" | "soft" | "danger";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand-600 text-ink shadow-sm hover:bg-brand-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-300",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:text-slate-300",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50",
  danger: "text-red-600 hover:bg-red-50 disabled:text-slate-300",
};

export function Btn({
  variant = "secondary",
  size = "md",
  icon: Icon,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: "sm" | "md"; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      className={cx(
        "press inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap select-none disabled:cursor-not-allowed",
        size === "sm" ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-xs",
        BTN[variant],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2} />}
      {children}
    </button>
  );
}

export function IconBtn({
  icon: Icon,
  label,
  danger,
  className,
  ...rest
}: ComponentProps<"button"> & { icon: LucideIcon; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        "press inline-flex size-7 items-center justify-center rounded-md text-slate-500 disabled:opacity-40",
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-white hover:text-brand-600",
        className,
      )}
      {...rest}
    >
      <Icon className="size-3.5" strokeWidth={2} />
    </button>
  );
}

// ------------------------------------------------------------ segmentado

export interface SegItem<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  title?: string;
}

/** Controle segmentado com pílula que desliza até o item ativo. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  stacked,
  size = "md",
}: {
  items: SegItem<T>[];
  value: T;
  onChange: (v: T) => void;
  stacked?: boolean;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cx(
        "grid gap-0.5 rounded-[10px] border border-slate-200/80 bg-slate-100/90 p-[3px]",
        stacked ? "h-12" : size === "sm" ? "h-8" : "h-9",
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => {
        const active = it.value === value;
        const Icon = it.icon;
        return (
          <button
            key={it.value}
            role="tab"
            type="button"
            aria-selected={active}
            title={it.title}
            onClick={() => !active && onChange(it.value)}
            className={cx(
              "press relative flex min-w-0 items-center justify-center rounded-[7px] outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
              stacked ? "flex-col gap-0.5 text-[10px]" : "gap-1.5 text-xs",
              active ? "font-semibold text-brand-700" : "font-medium text-slate-500 hover:text-slate-900",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[7px] border border-brand-300 bg-white shadow-[0_1px_3px_rgb(15_23_42/0.08)]"
                transition={{ type: "spring", duration: 0.32, bounce: 0.12 }}
              />
            )}
            {Icon && <Icon className={cx("relative", stacked ? "size-4" : "size-3.5")} strokeWidth={1.9} />}
            <span className="relative truncate">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ slider

/** Rótulo + campo numérico (em %) + slider. O modelo guarda frações. */
export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  decimals = 0,
  hint,
  step,
  scale = 100,
  suffix = "%",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  decimals?: number;
  hint?: string;
  step?: number;
  /** Multiplicador exibido (100 = porcentagem; 1 = valor direto, ex.: graus). */
  scale?: number;
  suffix?: string;
}) {
  const v = Math.min(max, Math.max(min, value));
  const fmt = (x: number) => (x * scale).toFixed(decimals);
  const [text, setText] = useState(fmt(v));
  // `text` só vale enquanto o campo está em edição; fora dela mostra o valor atual.
  const [editing, setEditing] = useState(false);

  const commit = () => {
    setEditing(false);
    const n = Number(text.replace(",", "."));
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n / scale)));
  };
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <div className="py-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <label className="flex items-center gap-1">
          <input
            inputMode="decimal"
            value={editing ? text : fmt(v).replace(".", ",")}
            onFocus={(e) => {
              setEditing(true);
              setText(fmt(v).replace(".", ","));
              e.currentTarget.select();
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setText(fmt(v));
                setEditing(false);
                e.currentTarget.blur();
              }
            }}
            className="h-6 w-14 rounded border border-slate-200 bg-slate-100/70 px-1.5 text-right font-mono text-xs font-medium text-slate-700 tabular-nums transition-colors outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          />
          <span className="w-3 text-[10px] text-slate-400">{suffix}</span>
        </label>
      </div>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step ?? (max - min) / 1000}
        value={v}
        style={{ ["--pct" as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ------------------------------------------------------------ interruptor

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-brand-600" : "bg-slate-300",
      )}
    >
      <span
        className="absolute left-0.5 size-3.5 rounded-full bg-[#fff] shadow-[0_1px_2px_rgb(15_23_42/0.3)] transition-transform duration-200 ease-[var(--ease-out)]"
        style={{ transform: `translateX(${checked ? 14 : 0}px)` }}
      />
    </button>
  );
}

export function SwitchRow({
  title,
  subtitle,
  checked,
  onChange,
}: {
  title: string;
  subtitle?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-slate-50/70 px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-xs leading-tight font-medium text-slate-700">{title}</p>
        {subtitle && <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{subtitle}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" }) {
  const t = {
    slate: "border-slate-200 bg-slate-100 text-slate-600",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", t)}>{children}</span>;
}
