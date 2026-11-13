"use client";
import { AnimatePresence, motion } from "motion/react";
import {
  Copy,
  Crop,
  Images,
  Plus,
  RotateCcw,
  Expand,
  ImagePlus,
  Maximize,
  RefreshCw,
  Signal,
  Trash2,
  Upload,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { fitReport, shotArea } from "@/lib/geometry";
import { useFrameVersion, useImageUrl, useImageVersion } from "@/lib/hooks";
import { frameBank } from "@/lib/frames";
import { imageBank } from "@/lib/images";
import {
  CROP_MAX,
  FIT_LABEL,
  frameFor,
  KIND_LABEL,
  MAX_SHOTS,
  NEW_FIT,
  SAFE_EXTRA,
  hasFraming,
  INITIAL_ADJUST,
  ZOOM,
  type DeviceKind,
  type ShotAdjust,
  type ShotFit,
} from "@/lib/models";
import { cur, slotKey, useApp } from "@/store/app";
import { Btn, cx, Segmented, Slider, SwitchRow } from "../ui/controls";
import { ColorField } from "../ui/ColorField";
import { EmptyHint, Note, Spinner } from "../ui/feedback";
import { Card, Reveal } from "../ui/Card";
import { pickImages, useFileDrop } from "../ui/files";
import { ShotDropZone } from "./ShotDrop";

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d).replace(".", ",")}%`;

export function PanelHeader({
  icon: Icon,
  title,
  onReset,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  onReset?: (() => void) | null;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex h-7 items-center gap-1.5 border-b border-slate-100 pb-1.5">
      <Icon className="size-3.5 text-slate-500" strokeWidth={2} />
      <span className="flex-1 truncate text-xs font-semibold text-slate-800">{title}</span>
      {trailing}
      <AnimatePresence initial={false}>
        {onReset && (
          <motion.span
            initial={{ opacity: 0, transform: "scale(0.95)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.95)" }}
            transition={{ duration: 0.14 }}
          >
            <Btn variant="ghost" size="sm" icon={RotateCcw} onClick={onReset} className="!h-6 !px-1.5">
              Resetar
            </Btn>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Prints (capturas do app) usados pelas camadas de aparelho: enviar, trocar e
 * ajustar encaixe, zoom, posição e barras do sistema de cada um.
 */
export function PrintsCard() {
  const category = useApp((s) => s.category);
  const shotSel = useApp((s) => s.shot);
  const kind: DeviceKind = category === "tablet" ? "tablet" : category === "phone" ? "phone" : shotSel.kind;
  const index = shotSel.kind === kind ? shotSel.index : 0;
  const shots = useApp((s) => cur(s)?.shots[kind]);
  const busy = useApp((s) => s.busy);
  const { selectShot, addShotSlot } = useApp.getState();
  if (!shots) return null;
  const i = Math.min(index, shots.length - 1);
  return (
    <Card title="Prints" subtitle={`Capturas de ${KIND_LABEL[kind].one.toLowerCase()} · ${shots.filter(Boolean).length} de ${shots.length}`} icon={Images} accent="green">
      {category === "feature" && (
        <div className="mb-2">
          <Segmented<DeviceKind>
            size="sm"
            value={kind}
            onChange={(k) => selectShot({ kind: k, index: 0 })}
            items={[
              { value: "phone", label: "Celular" },
              { value: "tablet", label: "Tablet" },
            ]}
          />
        </div>
      )}
      <ShotDropZone
        onFiles={(files, t) => useApp.getState().placePrints(category === "feature" ? (kind === "tablet" ? "tablet" : "phone") : category, files, { shot: t ?? 0 })}
        startFor={(t) => t ?? 0}
        className="mb-3"
      >
        {(target) => (
      <div className="grid grid-cols-4 gap-2" title="Arraste vários prints para cá: eles entram em ordem de nome">
        {shots.map((id, k) => (
          <div key={k} data-drop-index={k} className={cx("rounded-lg", target === k && "ring-2 ring-brand-600")}>
            <Thumb id={id} index={k} selected={k === i} busy={!!busy[slotKey(kind, k)]} onClick={() => selectShot({ kind, index: k })} />
          </div>
        ))}
        {shots.length < MAX_SHOTS && (
          <button
            type="button"
            title="Mais um print"
            onClick={() => addShotSlot(kind)}
            className="press flex h-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-600"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
        )}
      </ShotDropZone>
      {shots[i] ? <ShotControls kind={kind} index={i} id={shots[i]!} /> : <EmptyShot kind={kind} index={i} />}
    </Card>
  );
}

function Thumb({ id, index, selected, busy, onClick }: { id: string | null; index: number; selected: boolean; busy: boolean; onClick: () => void }) {
  const url = useImageUrl(id);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "press relative h-14 w-full overflow-hidden rounded-lg border bg-slate-50",
        selected ? "border-brand-600 ring-2 ring-brand-600/20" : "border-slate-200 hover:border-brand-300",
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="enter size-full object-cover object-top" />
      ) : (
        <ImagePlus className="mx-auto size-4 text-slate-400" strokeWidth={1.8} />
      )}
      <span
        className={cx(
          "absolute bottom-1 left-1 rounded px-1 text-[9px] font-bold text-ink",
          selected ? "bg-brand-600" : "bg-[#0f172a]/75",
        )}
      >
        {index + 1}
      </span>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/70">
          <Spinner className="size-3.5" />
        </span>
      )}
    </button>
  );
}

function EmptyShot({ kind, index }: { kind: DeviceKind; index: number }) {
  const importShots = useApp((s) => s.importShots);
  const drop = useFileDrop((files) => importShots(kind, index, files));
  return (
    <div {...drop.props} className={cx("rounded-xl transition-shadow", drop.over && "ring-2 ring-brand-500")}>
      <EmptyHint
        icon={ImagePlus}
        title={`Print ${index + 1} vazio`}
        message="Clique no aparelho do slide, arraste um arquivo para cá ou cole (Ctrl+V). As barras de status e de navegação são detectadas automaticamente."
        action={
          <Btn
            variant="primary"
            icon={Upload}
            onClick={async () => {
              const files = await pickImages(true);
              if (files.length) await importShots(kind, index, files);
            }}
          >
            Escolher print
          </Btn>
        }
      />
    </div>
  );
}

function ShotControls({ kind, index, id }: { kind: DeviceKind; index: number; id: string }) {
  const adjust = useApp((s) => cur(s)?.adjust[kind][index] ?? INITIAL_ADJUST);
  const others = useApp((s) => (cur(s)?.shots[kind].filter(Boolean).length ?? 1) - 1);
  const frameDef = frameFor(kind, "ios");
  const busy = useApp((s) => !!s.busy[slotKey(kind, index)]);
  const { updateAdjust, applyAdjustToOthers, redetect, removeShot, importShots, ensurePadColor, toast } = useApp.getState();
  useImageVersion();
  useFrameVersion();

  const size = imageBank.size(id);
  const frame = frameBank.get(frameDef.id);
  const report = size && frame ? fitReport(size, adjust, shotArea(adjust, frame.cameraInset, frame.screen)) : null;
  const camera = frame?.cameraInset ?? 0;
  const set = (patch: Partial<ShotAdjust>) => updateAdjust(kind, index, (a) => ({ ...a, ...patch }));

  return (
    <div>
      <PanelHeader
        icon={Crop}
        title="Encaixe na tela"
        trailing={size && <span className="font-mono text-[10px] text-slate-400">{size.w} × {size.h}</span>}
        onReset={hasFraming(adjust) ? () => set({ fit: NEW_FIT, zoom: 1, alignX: 0, alignY: -1 }) : null}
      />
      <Segmented<ShotFit>
        size="sm"
        value={adjust.fit}
        onChange={(fit) => {
          set({ fit });
          if (fit === "contain") void ensurePadColor(kind, index);
        }}
        items={[
          { value: "cover", label: FIT_LABEL.cover, icon: Crop, title: "Preenche a tela; corta o excedente" },
          { value: "contain", label: FIT_LABEL.contain, icon: Maximize, title: "Mostra o print inteiro" },
          { value: "fill", label: FIT_LABEL.fill, icon: Expand, title: "Estica; pode distorcer" },
        ]}
      />
      <div className="mt-2">
        <FitNote adjust={adjust} report={report} onPad={(c) => set({ padColor: c })} />
      </div>
      <div className="mt-1">
        <Slider label="Zoom" value={adjust.zoom} min={ZOOM.min} max={ZOOM.max} onChange={(v) => set({ zoom: v })} />
        <Reveal show={!!report?.canPanX}>
          <Slider label="Posição horizontal" value={(adjust.alignX + 1) / 2} min={0} max={1} onChange={(v) => set({ alignX: v * 2 - 1 })} />
        </Reveal>
        <Reveal show={!!report?.canPanY}>
          <Slider label="Posição vertical" value={(adjust.alignY + 1) / 2} min={0} max={1} onChange={(v) => set({ alignY: v * 2 - 1 })} />
        </Reveal>
        <Reveal show={!!report && (report.canPanX || report.canPanY)}>
          <p className="pb-1 text-[10px] text-slate-400">Dica: arraste o print no slide · Ctrl + roda do mouse = zoom.</p>
        </Reveal>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <PanelHeader
          icon={Signal}
          title="Barras do sistema"
          trailing={
            busy ? (
              <Spinner className="mr-1 size-3.5" />
            ) : (
              <Btn variant="ghost" size="sm" icon={Wand2} className="!h-6 !px-1.5" onClick={() => redetect(kind, index)}>
                Detectar
              </Btn>
            )
          }
        />
        <SwitchRow
          title="Remover barra de status e de navegação"
          subtitle={detectionText(adjust)}
          checked={adjust.stripBars}
          onChange={(on) =>
            updateAdjust(kind, index, (a) =>
              on && a.cropTop === 0 && a.cropBottom === 0
                ? // Sem detecção: começa com uma estimativa comum (~24 dp no Android).
                  { ...a, stripBars: true, safeArea: true, cropTop: a.autoTop ?? 0.035, cropBottom: a.autoBottom ?? 0 }
                : { ...a, stripBars: on, safeArea: on ? true : a.safeArea },
            )
          }
        />
        <Reveal show={adjust.stripBars}>
          <div className="pt-1.5">
            <Slider
              label="Topo (hora, sinal, bateria)"
              value={adjust.cropTop}
              min={0}
              max={CROP_MAX.top}
              decimals={1}
              hint={adjust.autoTop === null ? "Não detectado automaticamente" : `Detectado: ${pct(adjust.autoTop)}`}
              onChange={(v) => set({ cropTop: v })}
            />
            <Slider
              label="Base (barra de navegação)"
              value={adjust.cropBottom}
              min={0}
              max={CROP_MAX.bottom}
              decimals={1}
              hint={adjust.autoBottom === null ? "Barra de gestos não detectada" : `Detectado: ${pct(adjust.autoBottom)}`}
              onChange={(v) => set({ cropBottom: v })}
            />
            <div className="mt-2">
              <SwitchRow
                title="Afastar da câmera (área segura)"
                subtitle={
                  camera > 0
                    ? `O conteúdo começa abaixo da câmera do ${frameDef.name}; o topo ganha a cor do cabeçalho do app.`
                    : "Este aparelho não tem câmera na tela; use o espaço extra se quiser uma folga no topo."
                }
                checked={adjust.safeArea}
                onChange={(v) => set({ safeArea: v })}
              />
            </div>
            <Reveal show={adjust.safeArea}>
              <Slider
                label="Espaço abaixo da câmera"
                value={adjust.safeExtra}
                min={SAFE_EXTRA.min}
                max={SAFE_EXTRA.max}
                decimals={1}
                hint={camera > 0 ? `Câmera ocupa ${pct(camera)} do topo da tela` : undefined}
                onChange={(v) => set({ safeExtra: v })}
              />
            </Reveal>
          </div>
        </Reveal>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
        <Btn
          icon={RefreshCw}
          className="flex-1"
          disabled={busy}
          onClick={async () => {
            const [f] = await pickImages();
            if (f) await importShots(kind, index, [f]);
          }}
        >
          Trocar
        </Btn>
        {others > 0 && (
          <Btn
            icon={Copy}
            className="flex-1"
            title="Copia encaixe, zoom, posição e corte das barras para os outros prints deste tipo"
            onClick={() => {
              applyAdjustToOthers(kind, index);
              toast("Ajustes aplicados aos outros prints.");
            }}
          >
            Aplicar a todos
          </Btn>
        )}
        <Btn variant="danger" icon={Trash2} disabled={busy} title="Remover print" onClick={() => removeShot(kind, index)} className="!px-2" />
      </div>
    </div>
  );
}

function detectionText(a: ShotAdjust) {
  if (a.autoTop === null && a.autoBottom === null) return "Nada detectado — ajuste à mão se precisar";
  return `Detectado: ${[a.autoTop !== null && `topo ${pct(a.autoTop)}`, a.autoBottom !== null && `base ${pct(a.autoBottom)}`]
    .filter(Boolean)
    .join(" · ")}`;
}

function FitNote({
  adjust,
  report,
  onPad,
}: {
  adjust: ShotAdjust;
  report: ReturnType<typeof fitReport> | null;
  onPad: (c: string) => void;
}) {
  if (!report) return <Note>Medindo o print...</Note>;
  if (adjust.fit === "cover") {
    if (!report.crops) return <Note tone="success">Preenche a tela sem cortar nada.</Note>;
    const v = Math.max(report.cropX, report.cropY);
    return (
      <Note>
        Preenche a tela e corta <b>{pct(v, 0)}</b> do print {report.cropY > report.cropX ? "na altura" : "na largura"}.
      </Note>
    );
  }
  if (adjust.fit === "contain") {
    return (
      <div className="space-y-2">
        {report.hasGaps ? (
          <Note>
            Mostra o print inteiro; sobra <b>{pct(Math.max(report.gapX, report.gapY), 0)}</b> de borda.
          </Note>
        ) : (
          <Note tone="success">Mostra o print inteiro, sem bordas.</Note>
        )}
        {report.hasGaps && (
          <div className="w-36">
            <ColorField label="Cor da borda" value={adjust.padColor ?? "#ffffff"} onChange={onPad} />
          </div>
        )}
      </div>
    );
  }
  return report.distorts ? (
    <Note tone="warning">
      Estica o print: distorção de <b>{pct(report.distortion, 0)}</b>. Prefira Cobrir ou Conter.
    </Note>
  ) : (
    <Note tone="success">Proporções iguais: preenche sem distorcer.</Note>
  );
}

