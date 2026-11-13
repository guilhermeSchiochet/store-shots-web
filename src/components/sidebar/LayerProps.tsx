"use client";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowLeft,
  Crop,
  ImagePlus,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import type { AlignMode } from "@/lib/align";
import type { ReactNode } from "react";
import { useImageUrl } from "@/lib/hooks";
import {
  FONTS,
  LAYER_TYPE_LABEL,
  presetsOf,
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
import { Btn, cx, Segmented, Slider, SwitchRow } from "../ui/controls";
import { ColorField } from "../ui/ColorField";
import { Note } from "../ui/feedback";
import { Disclosure, Reveal } from "../ui/Card";
import { pickImages } from "../ui/files";
import { applyAlign } from "../preview/LayerToolbar";
import { previewEnv } from "../preview/SlideCanvas";
import { LAYER_ICON } from "./LayersCard";

type Patch<T extends Layer> = (patch: Partial<T>) => void;

/**
 * Painel da camada selecionada. Ações (excluir, duplicar, ordem, copiar)
 * ficam na barra flutuante sobre o slide; aqui só a aparência, com o que é
 * menos usado recolhido.
 */
export function LayerPanel({ layer: l, category, slideIndex }: { layer: Layer; category: Category; slideIndex: number }) {
  const api = useApp.getState();
  const set = (patch: Partial<Layer>) => api.updateLayer(category, slideIndex, l.id, patch);
  const Icon = LAYER_ICON[l.type];
  const name = l.type === "text" ? l.text.split("\n")[0] || "Texto vazio" : l.name;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-2">
        <button
          type="button"
          onClick={() => api.selectLayer(null)}
          title="Voltar ao slide (Esc)"
          className="press flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" />
          Slide {slideIndex + 1}
        </button>
        <span className="h-4 w-px bg-slate-200" />
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-brand-100 bg-brand-50 text-brand-600">
          <Icon className="size-3.5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs leading-tight font-bold text-slate-900">{name}</p>
          <p className="text-[10px] text-slate-400">{LAYER_TYPE_LABEL[l.type]}</p>
        </div>
      </div>
      <div className="p-3">
        {l.type === "text" && <TextProps l={l} set={set as Patch<TextLayer>} />}
        {l.type === "device" && <DeviceProps l={l} set={set as Patch<DeviceLayer>} category={category} />}
        {l.type === "image" && <ImageProps l={l} set={set as Patch<ImageLayer>} category={category} slideIndex={slideIndex} />}
        {l.type === "badge" && <BadgeProps l={l} set={set as Patch<BadgeLayer>} category={category} slideIndex={slideIndex} />}
        {l.type === "shape" && <ShapeProps l={l} set={set as Patch<ShapeLayer>} />}

        <Disclosure title="Posição, tamanho e opacidade">
          <div className="grid grid-cols-2 gap-x-3 pt-1">
            <Slider label="Horizontal" value={l.x} min={-0.5} max={1.5} onChange={(x) => set({ x })} />
            <Slider label="Vertical" value={l.y} min={-0.5} max={1.5} onChange={(y) => set({ y })} />
            <Slider label="Largura" value={l.w} min={0.02} max={2} onChange={(w) => set({ w })} />
            <Slider label="Rotação" value={l.rotation} min={-180} max={180} step={0.5} scale={1} suffix="°" onChange={(rotation) => set({ rotation })} />
          </div>
          <Slider label="Opacidade" value={l.opacity} min={0} max={1} onChange={(opacity) => set({ opacity })} />
        </Disclosure>
      </div>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-[11px] font-medium text-slate-600">{children}</p>;
}

const select =
  "h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

// ------------------------------------------------------------ texto

function TextProps({ l, set }: { l: TextLayer; set: Patch<TextLayer> }) {
  const editText = useApp((s) => s.editText);
  return (
    <>
      <Btn size="sm" variant="soft" icon={Pencil} className="mb-3 w-full" onClick={() => editText(l.id)}>
        Editar o texto no slide
      </Btn>
      <div className="grid grid-cols-[1fr_104px] gap-1.5">
        <select value={l.font} onChange={(e) => set({ font: e.target.value as FontId })} className={select} aria-label="Fonte">
          {(Object.keys(FONTS) as FontId[]).map((f) => (
            <option key={f} value={f}>
              {FONTS[f].label}
            </option>
          ))}
        </select>
        <select value={l.weight} onChange={(e) => set({ weight: Number(e.target.value) })} className={select} aria-label="Peso">
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
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
        <ColorField label="Cor" value={l.color} onChange={(color) => set({ color })} />
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
      </div>
      <Slider label="Tamanho da fonte" value={l.size} min={0.01} max={0.25} decimals={1} onChange={(size) => set({ size })} />

      <Disclosure title="Mais ajustes do texto">
        <div className="flex gap-1.5 pt-1">
          <Toggle on={l.uppercase} onClick={() => set({ uppercase: !l.uppercase })} title="Caixa alta">
            AA Caixa alta
          </Toggle>
          <Toggle on={l.italic} onClick={() => set({ italic: !l.italic })} title="Itálico">
            <i className="font-serif">I</i>&nbsp;Itálico
          </Toggle>
        </div>
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
      </Disclosure>
    </>
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
        "press flex h-7 flex-1 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold",
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
  const { selectShot, setPanel } = useApp.getState();
  return (
    <>
      <Label>Print exibido</Label>
      <div className="mb-3 flex flex-wrap gap-1.5">
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
        <div className="mb-2">
          <Segmented<DeviceLayer["shot"]["kind"]>
            size="sm"
            value={l.shot.kind}
            onChange={(kind) => set({ shot: { kind, index: 0 } })}
            items={[
              { value: "phone", label: "Prints de celular" },
              { value: "tablet", label: "Prints de tablet" },
            ]}
          />
        </div>
      )}
      <Segmented<DeviceLayer["frame"]>
        size="sm"
        value={l.frame}
        onChange={(frame) => set({ frame })}
        items={[
          { value: "auto", label: "Com moldura", title: "Moldura do aparelho de cada loja (iPhone/iPad ou Galaxy)" },
          { value: "none", label: "Só a tela" },
        ]}
      />
      <Slider label="Sombra" value={l.shadow} min={0} max={1} onChange={(shadow) => set({ shadow })} />
      <Btn
        size="sm"
        icon={Crop}
        className="mt-1 w-full"
        onClick={() => {
          selectShot({ ...l.shot });
          setPanel("prints");
        }}
      >
        Ajustar o print (zoom, posição, barras)
      </Btn>
      <Disclosure title="Mais ajustes do aparelho">
        <Slider label="Corte da base" value={l.cut} min={0} max={0.6} onChange={(cut) => set({ cut })} />
        <Reveal show={l.frame === "none"}>
          <Slider label="Cantos arredondados" value={l.radius} min={0} max={0.25} onChange={(radius) => set({ radius })} />
        </Reveal>
      </Disclosure>
    </>
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
    <>
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
      {library.length > 1 && (
        <>
          <p className="mt-2 mb-1 text-[10px] text-slate-400">Imagens já enviadas neste projeto</p>
          <div className="grid grid-cols-6 gap-1">
            {library.map((id) => (
              <LibraryThumb key={id} id={id} active={id === l.imageId} onClick={() => setLayerImage(category, slideIndex, l.id, id)} />
            ))}
          </div>
        </>
      )}
      <div className="mt-3">
        <Segmented<ImageLayer["style"]>
          size="sm"
          value={l.style}
          onChange={(style) => set(style === "icon" ? { style, radius: 0.2237, shadow: 0.5 } : { style, radius: 0, shadow: 0 })}
          items={[
            { value: "plain", label: "Imagem livre" },
            { value: "icon", label: "Ícone de app", title: "Quadrado arredondado com fundo e sombra" },
          ]}
        />
      </div>
      <Reveal show={l.style === "icon"}>
        <div className="w-32 pt-2">
          <ColorField label="Fundo do ícone" value={l.bg} onChange={(bg) => set({ bg })} />
        </div>
        <Slider label="Margem interna" value={l.pad} min={0} max={0.3} onChange={(pad) => set({ pad })} />
      </Reveal>
      <Disclosure title="Cantos e sombra">
        <Slider label="Cantos arredondados" value={l.radius} min={0} max={0.5} onChange={(radius) => set({ radius })} />
        <Slider label="Sombra" value={l.shadow} min={0} max={1} onChange={(shadow) => set({ shadow })} />
      </Disclosure>
    </>
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
    <>
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
    </>
  );
}

// ------------------------------------------------------------ forma

function ShapeProps({ l, set }: { l: ShapeLayer; set: Patch<ShapeLayer> }) {
  return (
    <>
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
    </>
  );
}

// ------------------------------------------------------------ várias camadas

const ALIGN_GRID: { mode: AlignMode; icon: typeof AlignLeft; label: string }[] = [
  { mode: "left", icon: AlignStartVertical, label: "Alinhar à esquerda" },
  { mode: "centerX", icon: AlignCenterVertical, label: "Centralizar na horizontal" },
  { mode: "right", icon: AlignEndVertical, label: "Alinhar à direita" },
  { mode: "distributeX", icon: AlignHorizontalDistributeCenter, label: "Distribuir na horizontal (3 ou mais)" },
  { mode: "top", icon: AlignStartHorizontal, label: "Alinhar ao topo" },
  { mode: "centerY", icon: AlignCenterHorizontal, label: "Centralizar na vertical" },
  { mode: "bottom", icon: AlignEndHorizontal, label: "Alinhar à base" },
  { mode: "distributeY", icon: AlignVerticalDistributeCenter, label: "Distribuir na vertical (3 ou mais)" },
];

/** Painel quando há várias camadas selecionadas: o que vale para o grupo. */
export function MultiPanel() {
  const category = useApp((s) => s.category);
  const slideIndex = useApp((s) => s.slideIndex);
  const ids = useApp((s) => s.layerIds);
  const slides = useApp((s) => cur(s)?.design[s.category].slides);
  const project = useApp(cur)!;
  const api = useApp.getState();
  // A seleção pode juntar camadas de vários slides.
  const sel = (slides ?? []).flatMap((sl, k) => sl.layers.filter((l) => ids.includes(l.id)).map((l) => ({ ...l, slide: k })));
  const spread = new Set(sel.map((l) => l.slide)).size;
  const env = previewEnv(project, presetsOf(category)[0]);
  const opacity = sel.length ? sel.reduce((a, l) => a + l.opacity, 0) / sel.length : 1;
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-2">
        <button
          type="button"
          onClick={() => api.selectLayer(null)}
          title="Voltar ao slide (Esc)"
          className="press flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" />
          Slide {slideIndex + 1}
        </button>
        <span className="h-4 w-px bg-slate-200" />
        <div className="min-w-0">
          <p className="text-xs leading-tight font-bold text-slate-900">{ids.length} camadas selecionadas</p>
          {spread > 1 && <p className="text-[10px] text-slate-400">em {spread} slides</p>}
        </div>
      </div>
      <div className="p-3">
        <Label>Alinhar entre si</Label>
        <div className="grid grid-cols-4 gap-1">
          {ALIGN_GRID.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              type="button"
              title={label}
              aria-label={label}
              disabled={mode.startsWith("distribute") && ids.length < 3}
              onClick={() => applyAlign(category, slideIndex, ids, mode, env)}
              className="press flex h-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
            >
              <Icon className="size-4" strokeWidth={1.8} />
            </button>
          ))}
        </div>
        <Slider
          label="Opacidade"
          value={opacity}
          min={0}
          max={1}
          onChange={(v) => api.patchLayers(category, slideIndex, Object.fromEntries(ids.map((id) => [id, { opacity: v }])))}
        />
        <div className="mt-2 space-y-0.5">
          {sel.map((l) => {
            const Icon = LAYER_ICON[l.type];
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => api.selectLayer(l.id, l.slide)}
                title="Editar só esta camada"
                className="flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
              >
                <Icon className="size-3.5 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{l.type === "text" ? l.text.split("\n")[0] || "Texto vazio" : l.name}</span>
                {spread > 1 && <span className="shrink-0 text-[10px] text-slate-400">Slide {l.slide + 1}</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] leading-snug text-slate-400">
          Arraste qualquer uma para mover todas juntas, mesmo em slides diferentes. Shift + clique soma ou tira uma camada (de
          qualquer slide); arrastar no fundo do slide seleciona por área; Ctrl+A seleciona tudo do slide.
        </p>
      </div>
    </section>
  );
}
