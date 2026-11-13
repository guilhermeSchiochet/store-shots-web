"use client";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  ImagePlus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useImageUrl } from "@/lib/hooks";
import {
  FONTS,
  LAYER_TYPE_LABEL,
  type BadgeLayer,
  type Category,
  type DeviceLayer,
  type FontId,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type TextLayer,
} from "@/lib/models";
import { cur, useApp } from "@/store/app";
import { Btn, cx, IconBtn, Segmented, Slider, SwitchRow } from "../ui/controls";
import { ColorField } from "../ui/ColorField";
import { Note } from "../ui/feedback";
import { Reveal } from "../ui/Card";
import { pickImages } from "../ui/files";
import { LAYER_ICON } from "./LayersCard";

type Patch<T extends Layer> = (patch: Partial<T>) => void;

/** Propriedades da camada selecionada (só o que se aplica ao tipo dela). */
export function LayerProps({ layer: l, category, slideIndex }: { layer: Layer; category: Category; slideIndex: number }) {
  const api = useApp.getState();
  const set = (patch: Partial<Layer>) => api.updateLayer(category, slideIndex, l.id, patch);
  const Icon = LAYER_ICON[l.type];

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="size-3.5 text-slate-500" />
        <span className="flex-1 truncate text-xs font-semibold text-slate-800">{LAYER_TYPE_LABEL[l.type]}</span>
        <IconBtn icon={ArrowUpToLine} label="Trazer para a frente" onClick={() => api.reorderLayer(category, slideIndex, l.id, "top")} />
        <IconBtn icon={ArrowDownToLine} label="Enviar para trás" onClick={() => api.reorderLayer(category, slideIndex, l.id, "bottom")} />
        <IconBtn icon={Copy} label="Duplicar (Ctrl+D)" onClick={() => api.duplicateLayer(category, slideIndex, l.id)} />
        <IconBtn icon={Trash2} label="Excluir (Delete)" danger onClick={() => api.removeLayer(category, slideIndex, l.id)} />
      </div>

      {l.type === "text" && <TextProps l={l} set={set as Patch<TextLayer>} />}
      {l.type === "device" && <DeviceProps l={l} set={set as Patch<DeviceLayer>} category={category} />}
      {l.type === "image" && <ImageProps l={l} set={set as Patch<ImageLayer>} category={category} slideIndex={slideIndex} />}
      {l.type === "badge" && <BadgeProps l={l} set={set as Patch<BadgeLayer>} category={category} slideIndex={slideIndex} />}
      {l.type === "shape" && <ShapeProps l={l} set={set as Patch<ShapeLayer>} />}

      <Group title="Posição e tamanho">
        <div className="grid grid-cols-2 gap-x-3">
          <Slider label="Horizontal" value={l.x} min={-0.5} max={1.5} onChange={(x) => set({ x })} />
          <Slider label="Vertical" value={l.y} min={-0.5} max={1.5} onChange={(y) => set({ y })} />
          <Slider label="Largura" value={l.w} min={0.02} max={2} onChange={(w) => set({ w })} />
          <Slider label="Rotação" value={l.rotation} min={-180} max={180} step={0.5} scale={1} suffix="°" onChange={(rotation) => set({ rotation })} />
        </div>
        <Slider label="Opacidade" value={l.opacity} min={0} max={1} onChange={(opacity) => set({ opacity })} />
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <Btn size="sm" onClick={() => set({ x: 0.5 })}>
            Centralizar na largura
          </Btn>
          <Btn size="sm" onClick={() => set({ rotation: 0 })} disabled={!l.rotation}>
            Zerar rotação
          </Btn>
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-2.5 first:mt-0 first:border-0 first:pt-0">
      <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">{title}</p>
      {children}
    </div>
  );
}

const select =
  "h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

// ------------------------------------------------------------ texto

function TextProps({ l, set }: { l: TextLayer; set: Patch<TextLayer> }) {
  const focus = useApp((s) => s.focusText);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focus) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [focus]);
  return (
    <Group title="Texto">
      <textarea
        ref={ref}
        value={l.text}
        rows={Math.min(5, Math.max(2, l.text.split("\n").length))}
        onChange={(e) => set({ text: e.target.value })}
        placeholder="Digite o texto"
        className="w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-800 outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-2 grid grid-cols-[1fr_96px] gap-1.5">
        <select value={l.font} onChange={(e) => set({ font: e.target.value as FontId })} className={select}>
          {(Object.keys(FONTS) as FontId[]).map((f) => (
            <option key={f} value={f}>
              {FONTS[f].label}
            </option>
          ))}
        </select>
        <select value={l.weight} onChange={(e) => set({ weight: Number(e.target.value) })} className={select}>
          {[
            [400, "Regular"],
            [500, "Médio"],
            [600, "Semi-negrito"],
            [700, "Negrito"],
            [800, "Extra-negrito"],
          ].map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <div className="w-24">
          <ColorField label="Cor" value={l.color} onChange={(color) => set({ color })} />
        </div>
        <Segmented<TextLayer["align"]>
          size="sm"
          value={l.align}
          onChange={(align) => set({ align })}
          items={[
            { value: "left", label: "", icon: AlignLeft, title: "Esquerda" },
            { value: "center", label: "", icon: AlignCenter, title: "Centro" },
            { value: "right", label: "", icon: AlignRight, title: "Direita" },
          ]}
        />
        <Toggle on={l.uppercase} onClick={() => set({ uppercase: !l.uppercase })} title="Caixa alta">
          AA
        </Toggle>
        <Toggle on={l.italic} onClick={() => set({ italic: !l.italic })} title="Itálico">
          <i className="font-serif">I</i>
        </Toggle>
      </div>
      <Slider label="Tamanho da fonte" value={l.size} min={0.01} max={0.25} decimals={1} onChange={(size) => set({ size })} />
      <div className="grid grid-cols-2 gap-x-3">
        <Slider label="Entrelinha" value={l.lineHeight} min={0.8} max={2} scale={1} suffix="×" decimals={2} onChange={(lineHeight) => set({ lineHeight })} />
        <Slider label="Espaçamento" value={l.letterSpacing} min={-0.1} max={0.4} decimals={1} onChange={(letterSpacing) => set({ letterSpacing })} />
      </div>
      <SwitchRow title="Etiqueta (fundo atrás do texto)" checked={!!l.bg} onChange={(on) => set({ bg: on ? "#2563eb" : null })} />
      <Reveal show={!!l.bg}>
        <div className="w-36 pt-2">
          <ColorField label="Cor da etiqueta" value={l.bg ?? "#2563eb"} alpha onChange={(bg) => set({ bg })} />
        </div>
      </Reveal>
    </Group>
  );
}

function Toggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "press flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-[11px] font-bold",
        on ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800",
      )}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------ aparelho

function DeviceProps({ l, set, category }: { l: DeviceLayer; set: Patch<DeviceLayer>; category: Category }) {
  const shots = useApp((s) => cur(s)?.shots[l.shot.kind]);
  const selectShot = useApp((s) => s.selectShot);
  return (
    <Group title="Aparelho">
      <p className="mb-1 text-xs font-medium text-slate-600">Print exibido</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {(shots ?? []).map((id, i) => (
          <ShotChip
            key={i}
            id={id}
            index={i}
            active={i === l.shot.index}
            onClick={() => {
              set({ shot: { ...l.shot, index: i }, name: `Aparelho · print ${i + 1}` });
              selectShot({ kind: l.shot.kind, index: i });
            }}
          />
        ))}
      </div>
      {category === "feature" && (
        <Segmented<DeviceLayer["shot"]["kind"]>
          size="sm"
          value={l.shot.kind}
          onChange={(kind) => set({ shot: { kind, index: 0 } })}
          items={[
            { value: "phone", label: "Prints de celular" },
            { value: "tablet", label: "Prints de tablet" },
          ]}
        />
      )}
      <div className="mt-2">
        <Segmented<DeviceLayer["frame"]>
          size="sm"
          value={l.frame}
          onChange={(frame) => set({ frame })}
          items={[
            { value: "auto", label: "Com moldura", title: "Moldura do aparelho de cada loja (iPhone/iPad ou Galaxy)" },
            { value: "none", label: "Só a tela" },
          ]}
        />
      </div>
      <Reveal show={l.frame === "none"}>
        <Slider label="Cantos arredondados" value={l.radius} min={0} max={0.25} onChange={(radius) => set({ radius })} />
      </Reveal>
      <Slider label="Sombra" value={l.shadow} min={0} max={1} onChange={(shadow) => set({ shadow })} />
      <Slider label="Corte da base" value={l.cut} min={0} max={0.6} onChange={(cut) => set({ cut })} />
      <p className="text-[10px] text-slate-400">O encaixe do print (zoom, barras do sistema) fica em &ldquo;Prints&rdquo;, logo abaixo.</p>
    </Group>
  );
}

function ShotChip({ id, index, active, onClick }: { id: string | null; index: number; active: boolean; onClick: () => void }) {
  const url = useImageUrl(id);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Print ${index + 1}`}
      className={cx(
        "press relative h-12 w-8 overflow-hidden rounded-md border bg-slate-50",
        active ? "border-brand-600 ring-2 ring-brand-600/25" : "border-slate-200 hover:border-brand-300",
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover object-top" />
      ) : (
        <ImagePlus className="mx-auto size-3.5 text-slate-400" />
      )}
      <span className="absolute bottom-0 left-0 rounded-tr bg-[#0f172a]/70 px-1 text-[8px] font-bold text-ink">{index + 1}</span>
    </button>
  );
}

// ------------------------------------------------------------ imagem

function ImageProps({ l, set, category, slideIndex }: { l: ImageLayer; set: Patch<ImageLayer>; category: Category; slideIndex: number }) {
  const library = useApp((s) => cur(s)?.library ?? []);
  const busy = useApp((s) => !!s.busy[`layer:${l.id}`]);
  const setLayerImage = useApp((s) => s.setLayerImage);
  const url = useImageUrl(l.imageId);
  return (
    <Group title="Imagem">
      <div className="flex items-center gap-2.5">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[repeating-conic-gradient(#e2e8f0_0_25%,transparent_0_50%)] bg-[length:10px_10px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className="size-full object-contain" /> : <ImagePlus className="size-4 text-slate-400" />}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Btn
            size="sm"
            variant={l.imageId ? "secondary" : "primary"}
            icon={Upload}
            disabled={busy}
            onClick={async () => {
              const [f] = await pickImages();
              if (f) await setLayerImage(category, slideIndex, l.id, f);
            }}
          >
            {l.imageId ? "Trocar imagem" : "Escolher imagem"}
          </Btn>
          {l.imageId && (
            <Btn size="sm" variant="ghost" icon={X} onClick={() => setLayerImage(category, slideIndex, l.id, null)}>
              Remover imagem
            </Btn>
          )}
        </div>
      </div>
      {library.length > 0 && (
        <>
          <p className="mt-2 mb-1 text-[10px] text-slate-400">Imagens já enviadas neste projeto</p>
          <div className="grid grid-cols-6 gap-1">
            {library.map((id) => (
              <LibraryThumb key={id} id={id} active={id === l.imageId} onClick={() => setLayerImage(category, slideIndex, l.id, id)} />
            ))}
          </div>
        </>
      )}
      <div className="mt-2">
        <Segmented<ImageLayer["style"]>
          size="sm"
          value={l.style}
          onChange={(style) => set(style === "icon" ? { style, radius: 0.2237, shadow: 0.5 } : { style, radius: 0, shadow: 0 })}
          items={[
            { value: "plain", label: "Imagem livre" },
            { value: "icon", label: "Estilo ícone de app", title: "Quadrado arredondado com fundo e sombra" },
          ]}
        />
      </div>
      <Reveal show={l.style === "icon"}>
        <div className="flex items-center gap-2 pt-2">
          <div className="w-32">
            <ColorField label="Fundo do ícone" value={l.bg} onChange={(bg) => set({ bg })} />
          </div>
        </div>
        <Slider label="Margem interna" value={l.pad} min={0} max={0.3} onChange={(pad) => set({ pad })} />
      </Reveal>
      <Slider label="Cantos arredondados" value={l.radius} min={0} max={0.5} onChange={(radius) => set({ radius })} />
      <Slider label="Sombra" value={l.shadow} min={0} max={1} onChange={(shadow) => set({ shadow })} />
    </Group>
  );
}

function LibraryThumb({ id, active, onClick }: { id: string; active: boolean; onClick: () => void }) {
  const url = useImageUrl(id);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "press aspect-square overflow-hidden rounded-md border bg-slate-50",
        active ? "border-brand-600 ring-2 ring-brand-600/25" : "border-slate-200 hover:border-brand-300",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="size-full object-contain p-0.5" />}
    </button>
  );
}

// ------------------------------------------------------------ selo

function BadgeProps({ l, set, category, slideIndex }: { l: BadgeLayer; set: Patch<BadgeLayer>; category: Category; slideIndex: number }) {
  const setLayerImage = useApp((s) => s.setLayerImage);
  return (
    <Group title="Selo da loja">
      <Segmented<BadgeLayer["store"]>
        size="sm"
        value={l.store}
        onChange={(store) => set({ store })}
        items={[
          { value: "auto", label: "Automático", title: "App Store nos tamanhos iOS, Google Play nos Android" },
          { value: "apple", label: "App Store" },
          { value: "google", label: "Google Play" },
        ]}
      />
      <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
        {l.store === "auto" ? "Mostra o selo da loja de cada tamanho exportado. " : ""}O selo desenhado é provisório.
      </p>
      <div className="mt-2">
        {l.imageId ? (
          <Note
            tone="success"
            action={
              <Btn size="sm" variant="ghost" icon={X} onClick={() => setLayerImage(category, slideIndex, l.id, null)}>
                Remover
              </Btn>
            }
          >
            Usando o arquivo oficial enviado.
          </Note>
        ) : (
          <Btn
            size="sm"
            icon={Upload}
            className="w-full"
            onClick={async () => {
              const [f] = await pickImages();
              if (f) await setLayerImage(category, slideIndex, l.id, f);
            }}
          >
            Usar o arquivo oficial do selo
          </Btn>
        )}
      </div>
    </Group>
  );
}

// ------------------------------------------------------------ forma

function ShapeProps({ l, set }: { l: ShapeLayer; set: Patch<ShapeLayer> }) {
  return (
    <Group title="Forma">
      <Segmented<ShapeLayer["shape"]>
        size="sm"
        value={l.shape}
        onChange={(shape) => set({ shape })}
        items={[
          { value: "rect", label: "Retângulo" },
          { value: "ellipse", label: "Círculo / elipse" },
        ]}
      />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <ColorField label={l.fill2 ? "Cor de cima" : "Cor"} value={l.fill} alpha onChange={(fill) => set({ fill })} />
        {l.fill2 ? (
          <ColorField label="Cor de baixo" value={l.fill2} alpha onChange={(fill2) => set({ fill2 })} />
        ) : (
          <Btn size="sm" onClick={() => set({ fill2: "#1e3a8a" })}>
            + Degradê
          </Btn>
        )}
      </div>
      {l.fill2 && (
        <Btn size="sm" variant="ghost" className="mt-1" onClick={() => set({ fill2: null })}>
          Usar cor única
        </Btn>
      )}
      <Slider label="Altura (proporção da largura)" value={l.ratio} min={0.02} max={4} onChange={(ratio) => set({ ratio })} />
      {l.shape === "rect" && <Slider label="Cantos arredondados" value={l.radius} min={0} max={0.5} onChange={(radius) => set({ radius })} />}
    </Group>
  );
}
