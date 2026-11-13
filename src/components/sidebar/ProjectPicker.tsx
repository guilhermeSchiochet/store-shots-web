"use client";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Download,
  FolderInput,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadBackup, importBackupZip, importDesktopFolder } from "@/lib/backup";
import { KINDS, shotCount } from "@/lib/models";
import { useApp, useProject } from "@/store/app";
import { Btn, cx, IconBtn } from "../ui/controls";
import { Modal } from "../ui/Modal";

/** Seletor de projeto (popover com busca) + criar/excluir + backup/importação. */
export function ProjectPicker() {
  const project = useProject();
  const projects = useApp((s) => s.projects);
  const { selectProject, createProject, deleteProject, addProject, toast } = useApp.getState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
  }, [projects, query]);

  const choose = (id: string) => {
    setOpen(false);
    if (id !== project?.id) {
      selectProject(id);
      toast(`Projeto "${projects.find((p) => p.id === id)?.name}" carregado.`);
    }
  };

  const runImport = async (fn: () => Promise<import("@/lib/models").Project>) => {
    setOpen(false);
    try {
      const p = await fn();
      addProject(p);
      toast(`Projeto "${p.name}" importado.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), true);
    }
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-0.5 rounded-lg border border-slate-200/80 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(!open);
          }}
          className="press group flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1 text-left text-xs font-semibold text-slate-800 hover:bg-white"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-brand-600" />
            <span className="truncate">{project ? project.name || "Sem título" : "Nenhum projeto"}</span>
          </span>
          <ChevronDown
            className="ml-1 size-3.5 shrink-0 text-slate-500 transition-transform duration-200 ease-[var(--ease-out)]"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          />
        </button>
        <IconBtn icon={Plus} label="Criar novo projeto" onClick={() => setCreating(true)} />
        <IconBtn icon={Trash2} label="Excluir projeto" danger disabled={!project} onClick={() => setDeleting(true)} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.97) translateY(-4px)" }}
            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
            exit={{ opacity: 0, transform: "scale(0.98)", transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top center" }}
            className="absolute inset-x-0 top-full z-40 mt-1 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-xl shadow-slate-900/10"
          >
            <div className="border-b border-slate-100 bg-slate-50/70 p-2">
              <label className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2 size-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && filtered[0] && choose(filtered[0].id)}
                  placeholder="Buscar projeto..."
                  className="h-8 w-full rounded-md border border-slate-200 bg-white pr-2 pl-7 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </label>
            </div>
            <div className="thin-scroll max-h-60 space-y-0.5 overflow-y-auto p-1">
              {filtered.length === 0 && <p className="py-4 text-center text-slate-400">Nenhum projeto encontrado</p>}
              {filtered.map((p) => {
                const active = p.id === project?.id;
                const prints = KINDS.reduce((n, k) => n + shotCount(p, k), 0);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p.id)}
                    className={cx(
                      "press flex w-full items-center justify-between rounded-lg border p-2 text-left",
                      active ? "border-brand-200 bg-brand-50/80" : "border-transparent hover:bg-slate-100/70",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className={cx("size-1.5 shrink-0 rounded-full", active ? "bg-brand-600" : "bg-slate-300")} />
                        <span className={cx("truncate font-semibold", active ? "text-blue-900" : "text-slate-800")}>
                          {p.name || "Sem título"}
                        </span>
                      </span>
                      <span className="block pl-3 text-[10px] text-slate-400">
                        {prints} de 6 prints · {p.presets.length} tamanho(s) · {timeAgo(p.updatedAt)}
                      </span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1 border-t border-slate-100 bg-slate-50 p-1.5">
              <Btn variant="soft" size="sm" icon={Plus} className="w-full" onClick={() => (setOpen(false), setCreating(true))}>
                Criar novo projeto
              </Btn>
              <div className="grid grid-cols-3 gap-1">
                <Btn
                  variant="ghost"
                  size="sm"
                  icon={Download}
                  disabled={!project}
                  title="Baixa um .zip com o projeto e as imagens"
                  onClick={() => project && (setOpen(false), void downloadBackup(project))}
                >
                  Backup
                </Btn>
                <Btn variant="ghost" size="sm" icon={Upload} title="Restaura um backup .zip" onClick={() => zipInput.current?.click()}>
                  Restaurar
                </Btn>
                <Btn
                  variant="ghost"
                  size="sm"
                  icon={FolderInput}
                  title="Importa a pasta de um projeto do app desktop (Documentos/StoreShots/<projeto>)"
                  onClick={() => folderInput.current?.click()}
                >
                  Desktop
                </Btn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={zipInput}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void runImport(() => importBackupZip(f));
        }}
      />
      <input
        ref={folderInput}
        type="file"
        hidden
        // @ts-expect-error atributo não-padrão, suportado por Chrome/Edge/Firefox
        webkitdirectory=""
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) {
            const list = Array.from(files);
            e.target.value = "";
            void runImport(() => importDesktopFolder(list));
          }
        }}
      />

      <NewProjectModal open={creating} onClose={() => setCreating(false)} onCreate={(n) => (createProject(n), toast(`Projeto "${n}" criado.`))} />
      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        icon={Trash2}
        tone="red"
        title="Excluir projeto?"
        subtitle="Esta ação não pode ser desfeita."
        footer={
          <>
            <Btn onClick={() => setDeleting(false)}>Cancelar</Btn>
            <Btn
              variant="primary"
              className="!bg-red-600 hover:!bg-red-700"
              onClick={async () => {
                setDeleting(false);
                if (project) {
                  await deleteProject(project.id);
                  toast("Projeto excluído.");
                }
              }}
            >
              Excluir
            </Btn>
          </>
        }
      >
        <p className="leading-relaxed">
          &ldquo;{project?.name}&rdquo; e todas as imagens dele (prints, logo, ícone e selo) serão removidos deste navegador.
          Se quiser guardar, faça um backup antes.
        </p>
      </Modal>
    </div>
  );
}

export function NewProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const close = () => {
    setName("");
    onClose();
  };
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    close();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      icon={Plus}
      title="Criar novo projeto"
      subtitle="Um kit de telas para as lojas de aplicativos"
      footer={
        <>
          <Btn onClick={close}>Cancelar</Btn>
          <Btn variant="primary" icon={Check} disabled={!name.trim()} onClick={submit}>
            Criar projeto
          </Btn>
        </>
      }
    >
      <label className="block text-xs font-semibold text-slate-700">
        Nome do projeto <span className="text-brand-600">*</span>
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Ex.: Meu App"
        className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      <p className="mt-1.5 text-[10px] text-slate-400">Você pode alterar o nome a qualquer momento.</p>
    </Modal>
  );
}

function timeAgo(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}
