"use client";
import { Upload } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { MAX_SHOTS } from "@/lib/models";
import { cx } from "../ui/controls";
import { useFileDrop } from "../ui/files";

/**
 * Área que aceita VÁRIOS prints arrastados do Explorer de uma vez.
 *
 * Os arquivos entram em ordem de nome, um por print, a partir de [startFor]:
 * soltar sobre um item marcado com `data-drop-index` começa por ele; soltar no
 * resto da área começa pelo print 1. Enquanto arrasta, mostra quais prints
 * serão preenchidos.
 */
export function ShotDropZone({
  onFiles,
  startFor,
  children,
  className,
}: {
  /** Recebe os arquivos e o item sob o cursor (null = fora dos itens). */
  onFiles: (files: File[], target: number | null) => void;
  /** Índice do print inicial para o item sob o cursor (null = fora dos itens). */
  startFor: (target: number | null) => number;
  children: (target: number | null) => ReactNode;
  className?: string;
}) {
  const [target, setTarget] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const targetRef = useRef<number | null>(null);
  const drop = useFileDrop((files) => {
    const t = targetRef.current;
    setTarget(null);
    onFiles(files, t);
  });

  const onDragOver = (e: DragEvent) => {
    drop.props.onDragOver(e);
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-drop-index]");
    const t = el ? Number(el.dataset.dropIndex) : null;
    targetRef.current = t;
    setTarget(t);
    setCount(e.dataTransfer.items?.length || 1);
  };

  const start = startFor(target);
  const end = Math.min(MAX_SHOTS, start + count) - 1;
  const label = count > 1 ? `Preencher os prints ${start + 1} a ${end + 1}` : `Usar como print ${start + 1}`;

  return (
    <div
      {...drop.props}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        drop.props.onDragLeave();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setTarget(null);
      }}
      className={cx("relative rounded-lg transition-shadow", drop.over && "ring-2 ring-brand-500 ring-offset-2 ring-offset-white", className)}
    >
      {children(drop.over ? target : null)}
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 -bottom-1 z-10 flex justify-center transition-[opacity,transform] duration-150 ease-[var(--ease-out)]",
          drop.over ? "translate-y-full opacity-100" : "translate-y-[90%] opacity-0",
        )}
      >
        <span className="mt-1 flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-ink shadow-lg">
          <Upload className="size-3" /> {label} (em ordem de nome)
        </span>
      </div>
    </div>
  );
}
