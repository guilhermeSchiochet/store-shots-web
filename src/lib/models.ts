// Modelo de dados do Store Shots (v2).
//
// Um projeto tem três CATEGORIAS de saída (Celulares, Tablets, Recurso gráfico).
// Cada categoria tem SLIDES; cada slide tem um fundo e uma pilha de CAMADAS livres
// (aparelho, texto, imagem, selo da loja, forma). Os PRINTS (capturas do app)
// ficam separados por tipo de aparelho e são usados pelas camadas de aparelho.
//
// Tudo é guardado em frações (posição = centro em fração da largura/altura do
// slide; tamanho = fração da largura), então o mesmo design vale para qualquer
// resolução de exportação.
import * as v1 from "./legacy.ts";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const uid = (p = "l") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ------------------------------------------------------------ categorias e aparelhos

export type DeviceKind = "phone" | "tablet";
export type Category = DeviceKind | "feature";
export type Platform = "ios" | "android";

export const KINDS: DeviceKind[] = ["phone", "tablet"];
export const CATEGORIES: Category[] = ["phone", "tablet", "feature"];
export const KIND_LABEL: Record<DeviceKind, { one: string; many: string }> = {
  phone: { one: "Celular", many: "Celulares" },
  tablet: { one: "Tablet", many: "Tablets" },
};
export const CATEGORY_LABEL: Record<Category, { one: string; many: string; hint: string }> = {
  phone: { one: "Celular", many: "Celulares", hint: "Capturas de celular para a App Store e a Play Store" },
  tablet: { one: "Tablet", many: "Tablets", hint: "Capturas de tablet para a App Store e a Play Store" },
  feature: { one: "Recurso gráfico", many: "Recurso gráfico", hint: "Imagem de destaque da Play Store (1024 × 500)" },
};

export interface FrameDef {
  id: string;
  name: string;
  src: string;
  kind: DeviceKind;
  platform: Platform;
  /** largura / altura do PNG da moldura (para posicionar antes de carregar). */
  aspect: number;
}

/** Para adicionar uma moldura: PNG com a tela transparente em public/frames + entrada aqui. */
export const FRAMES: FrameDef[] = [
  { id: "iphone18", name: "iPhone 18 Pro Max", src: "/frames/iphone_18_pro_max.png", kind: "phone", platform: "ios", aspect: 389 / 800 },
  { id: "ipadair4", name: "iPad Air", src: "/frames/ipad_air_4.png", kind: "tablet", platform: "ios", aspect: 577 / 800 },
  { id: "s26", name: "Galaxy S26 Ultra", src: "/frames/galaxy_s26_ultra.png", kind: "phone", platform: "android", aspect: 385 / 800 },
  { id: "tabs7", name: "Galaxy Tab S7", src: "/frames/galaxy_tab_s7.png", kind: "tablet", platform: "android", aspect: 522 / 800 },
];
export const frameOf = (id: string) => FRAMES.find((f) => f.id === id)!;
export const frameFor = (kind: DeviceKind, platform: Platform) =>
  FRAMES.find((f) => f.kind === kind && f.platform === platform) ?? FRAMES.find((f) => f.kind === kind)!;

export interface ExportSize {
  w: number;
  h: number;
}

export interface ExportPreset {
  id: string;
  label: string;
  category: Category;
  platform: Platform;
  folder: string;
  /** Tamanhos aceitos pela loja; o primeiro é o padrão. */
  sizes: ExportSize[];
  note?: string;
}

/**
 * Tamanhos aceitos pelas lojas (App Store Connect confere o tamanho EXATO).
 * Fonte: App Store Connect → Screenshot specifications; Play Console → Graphic assets.
 */
export const PRESETS: ExportPreset[] = [
  {
    id: "iphone69",
    label: 'iPhone 6.9"',
    category: "phone",
    platform: "ios",
    folder: "iphone_6.9",
    sizes: [
      { w: 1320, h: 2868 },
      { w: 1290, h: 2796 },
      { w: 1260, h: 2736 },
    ],
    note: "Obrigatório na App Store",
  },
  {
    id: "iphone65",
    label: 'iPhone 6.5"',
    category: "phone",
    platform: "ios",
    folder: "iphone_6.5",
    sizes: [
      { w: 1284, h: 2778 },
      { w: 1242, h: 2688 },
    ],
  },
  {
    id: "androidphone",
    label: "Android celular",
    category: "phone",
    platform: "android",
    folder: "android_celular",
    sizes: [
      { w: 1080, h: 1920 },
      { w: 1080, h: 2160 },
      { w: 1440, h: 2560 },
    ],
  },
  {
    id: "ipad13",
    label: 'iPad 13"',
    category: "tablet",
    platform: "ios",
    folder: "ipad_13",
    sizes: [
      { w: 2064, h: 2752 },
      { w: 2048, h: 2732 },
    ],
    note: "Obrigatório se o app roda no iPad",
  },
  {
    id: "ipad129",
    label: 'iPad 12.9"',
    category: "tablet",
    platform: "ios",
    folder: "ipad_12.9",
    sizes: [{ w: 2048, h: 2732 }],
  },
  {
    id: "androidtab",
    label: 'Android tablet 10"',
    category: "tablet",
    platform: "android",
    folder: "android_tablet",
    sizes: [
      { w: 1600, h: 2560 },
      { w: 1200, h: 1920 },
    ],
  },
  {
    id: "playfeature",
    label: "Recurso gráfico (Play Store)",
    category: "feature",
    platform: "android",
    folder: "recurso_grafico",
    sizes: [{ w: 1024, h: 500 }],
    note: "Obrigatório na Play Store",
  },
];
export const presetById = (id: string) => PRESETS.find((p) => p.id === id);
export const presetsOf = (c: Category) => PRESETS.filter((p) => p.category === c);

// ------------------------------------------------------------ enquadramento do print

export type ShotFit = "cover" | "contain" | "fill";
export const FIT_LABEL: Record<ShotFit, string> = { cover: "Cobrir", contain: "Conter", fill: "Preencher" };

/** Enquadramento de UM print. Ordem: corte das barras → área segura → encaixe → zoom/posição. */
export interface ShotAdjust {
  fit: ShotFit;
  zoom: number;
  alignX: number;
  alignY: number;
  stripBars: boolean;
  cropTop: number;
  cropBottom: number;
  autoTop: number | null;
  autoBottom: number | null;
  padColor: string | null;
  safeArea: boolean;
  safeExtra: number;
}

export const ZOOM = v1.ZOOM;
export const SAFE_EXTRA = v1.SAFE_EXTRA;
export const CROP_MAX = v1.CROP_MAX;
export const INITIAL_ADJUST: ShotAdjust = v1.INITIAL_ADJUST;
export const normalizeAdjust = (a: Partial<ShotAdjust> | null | undefined): ShotAdjust => v1.normalizeAdjust(a);
export const effectiveCrop = v1.effectiveCrop;
export const hasFraming = (a: ShotAdjust) => a.fit !== NEW_FIT || a.zoom !== 1 || a.alignX !== 0 || a.alignY !== -1;

/** Encaixe inicial dos prints novos. */
export const NEW_FIT: ShotFit = "fill";

export function detectedAdjust(top: number | null, bottom: number | null, padColor: string | null): ShotAdjust {
  return { ...v1.detectedAdjust(top, bottom, padColor), fit: NEW_FIT };
}

// ------------------------------------------------------------ camadas

export type FontId = "inter" | "poppins" | "montserrat" | "nunito" | "playfair" | "roboto-slab";
export const FONTS: Record<FontId, { label: string; cssVar: string; fallback: string }> = {
  inter: { label: "Inter", cssVar: "--font-inter", fallback: "Inter, 'Segoe UI', system-ui, sans-serif" },
  poppins: { label: "Poppins", cssVar: "--font-poppins", fallback: "Poppins, 'Segoe UI', sans-serif" },
  montserrat: { label: "Montserrat", cssVar: "--font-montserrat", fallback: "Montserrat, 'Segoe UI', sans-serif" },
  nunito: { label: "Nunito", cssVar: "--font-nunito", fallback: "Nunito, 'Segoe UI', sans-serif" },
  playfair: { label: "Playfair Display", cssVar: "--font-playfair", fallback: "'Playfair Display', Georgia, serif" },
  "roboto-slab": { label: "Roboto Slab", cssVar: "--font-roboto-slab", fallback: "'Roboto Slab', Georgia, serif" },
};

interface LayerBase {
  id: string;
  name: string;
  /** Centro, em fração da largura/altura do slide. */
  x: number;
  y: number;
  /** Largura em fração da largura do slide (a altura sai do conteúdo). */
  w: number;
  rotation: number; // graus
  opacity: number; // 0..1
  hidden: boolean;
  locked: boolean;
}

export interface DeviceLayer extends LayerBase {
  type: "device";
  /** Qual print mostrar. */
  shot: { kind: DeviceKind; index: number };
  /** "auto" = moldura do aparelho do tamanho exportado; "none" = só a tela, sem moldura. */
  frame: "auto" | "none";
  /** Fração da altura do aparelho cortada na base. */
  cut: number;
  shadow: number; // 0..1
  /** Raio dos cantos quando sem moldura (fração da largura). */
  radius: number;
}

export interface TextLayer extends LayerBase {
  type: "text";
  text: string;
  font: FontId;
  weight: number;
  /** Tamanho da fonte em fração da largura do slide. */
  size: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number; // em
  uppercase: boolean;
  italic: boolean;
  /** Fundo opcional atrás do texto (etiqueta). */
  bg: string | null;
}

export interface ImageLayer extends LayerBase {
  type: "image";
  imageId: string | null;
  /** "icon": quadrado arredondado com fundo, margem e sombra (estilo ícone de app). */
  style: "plain" | "icon";
  radius: number; // fração da largura
  bg: string;
  pad: number; // fração da largura (só no estilo ícone)
  shadow: number;
}

export interface BadgeLayer extends LayerBase {
  type: "badge";
  /** "auto" = selo da loja do tamanho exportado (Apple nos tamanhos iOS, Google nos Android). */
  store: "auto" | "apple" | "google";
  /** Arquivo oficial enviado pelo usuário; null = selo desenhado. */
  imageId: string | null;
}

export interface ShapeLayer extends LayerBase {
  type: "shape";
  shape: "rect" | "ellipse";
  /** Altura / largura. */
  ratio: number;
  fill: string;
  /** Segunda cor = degradê vertical. */
  fill2: string | null;
  radius: number; // fração da menor dimensão
}

export type Layer = DeviceLayer | TextLayer | ImageLayer | BadgeLayer | ShapeLayer;
export type LayerType = Layer["type"];
export const LAYER_TYPE_LABEL: Record<LayerType, string> = {
  device: "Aparelho",
  text: "Texto",
  image: "Imagem",
  badge: "Selo da loja",
  shape: "Forma",
};

export interface Background {
  type: "solid" | "gradient";
  a: string;
  b: string;
  angle: number; // graus, 180 = de cima para baixo
}

export interface Slide {
  id: string;
  bg: Background;
  layers: Layer[]; // ordem de desenho: o último fica por cima
}

export interface CategoryDesign {
  template: string;
  slides: Slide[];
}

export const MAX_SLIDES = 10;
export const MAX_SHOTS = 8;

export interface Project {
  version: 2;
  id: string;
  name: string;
  updatedAt: number;
  design: Record<Category, CategoryDesign>;
  shots: Record<DeviceKind, (string | null)[]>;
  adjust: Record<DeviceKind, ShotAdjust[]>;
  presets: string[];
  exportSizes: Record<string, ExportSize>;
  format: "png" | "jpeg";
  /** Imagens enviadas para o projeto (biblioteca para reutilizar em camadas). */
  library: string[];
}

// ------------------------------------------------------------ fábricas de camadas

const base = (name: string, x: number, y: number, w: number): LayerBase => ({
  id: uid(),
  name,
  x,
  y,
  w,
  rotation: 0,
  opacity: 1,
  hidden: false,
  locked: false,
});

export const make = {
  device: (kind: DeviceKind, index: number, p: Partial<DeviceLayer> = {}): DeviceLayer => ({
    ...base(`Aparelho · print ${index + 1}`, 0.5, 0.5, kind === "phone" ? 0.8 : 0.76),
    type: "device",
    shot: { kind, index },
    frame: "auto",
    cut: 0,
    shadow: 0,
    radius: 0.08,
    ...p,
  }),
  text: (text: string, p: Partial<TextLayer> = {}): TextLayer => ({
    ...base(text.split("\n")[0].slice(0, 24) || "Texto", 0.5, 0.1, 0.84),
    type: "text",
    text,
    font: "inter",
    weight: 700,
    size: 0.07,
    color: "#0f172a",
    align: "center",
    lineHeight: 1.15,
    letterSpacing: 0,
    uppercase: false,
    italic: false,
    bg: null,
    ...p,
  }),
  image: (imageId: string | null, p: Partial<ImageLayer> = {}): ImageLayer => ({
    ...base("Imagem", 0.5, 0.5, 0.4),
    type: "image",
    imageId,
    style: "plain",
    radius: 0,
    bg: "#ffffff",
    pad: 0.08,
    shadow: 0,
    ...p,
  }),
  icon: (p: Partial<ImageLayer> = {}): ImageLayer =>
    make.image(null, { name: "Ícone do app", style: "icon", radius: 0.2237, shadow: 0.5, ...p }),
  badge: (store: BadgeLayer["store"], p: Partial<BadgeLayer> = {}): BadgeLayer => ({
    ...base(store === "apple" ? "Selo App Store" : store === "google" ? "Selo Google Play" : "Selo da loja", 0.5, 0.8, 0.42),
    type: "badge",
    store,
    imageId: null,
    ...p,
  }),
  shape: (p: Partial<ShapeLayer> = {}): ShapeLayer => ({
    ...base("Forma", 0.5, 0.5, 0.5),
    type: "shape",
    shape: "rect",
    ratio: 0.6,
    fill: "#2563eb",
    fill2: null,
    radius: 0.12,
    ...p,
  }),
};

export const cloneLayer = <T extends Layer>(l: T, dx = 0.03, dy = 0.03): T => ({
  ...structuredClone(l),
  id: uid(),
  x: clamp(l.x + dx, 0, 1),
  y: clamp(l.y + dy, 0, 1),
  name: `${l.name} (cópia)`,
});

export const cloneSlide = (s: Slide): Slide => ({
  id: uid("s"),
  bg: { ...s.bg },
  layers: s.layers.map((l) => ({ ...structuredClone(l), id: uid() })),
});

// ------------------------------------------------------------ projeto

export function emptyProject(name: string, design: Record<Category, CategoryDesign>): Project {
  return {
    version: 2,
    id: uid("p"),
    name,
    updatedAt: Date.now(),
    design,
    shots: { phone: [null, null, null], tablet: [null, null, null] },
    adjust: { phone: [INITIAL_ADJUST, INITIAL_ADJUST, INITIAL_ADJUST], tablet: [INITIAL_ADJUST, INITIAL_ADJUST, INITIAL_ADJUST] },
    presets: ["iphone69", "ipad13", "playfeature"],
    exportSizes: {},
    format: "png",
    library: [],
  };
}

export const exportSizeOf = (p: Project, preset: ExportPreset): ExportSize => {
  const s = p.exportSizes[preset.id];
  return s && s.w >= 100 && s.h >= 100 ? s : preset.sizes[0];
};

/** Ids de imagem usados no projeto (para limpar ao excluir e para o backup). */
export function imageIds(p: Project): string[] {
  const ids = new Set<string>([...p.library, ...p.shots.phone, ...p.shots.tablet].filter(Boolean) as string[]);
  for (const c of CATEGORIES)
    for (const s of p.design[c].slides)
      for (const l of s.layers) if ((l.type === "image" || l.type === "badge") && l.imageId) ids.add(l.imageId);
  return [...ids];
}

/** Prints que as camadas de aparelho da categoria usam. */
export function shotsUsed(p: Project, c: Category): { kind: DeviceKind; index: number }[] {
  const seen = new Map<string, { kind: DeviceKind; index: number }>();
  for (const s of p.design[c].slides)
    for (const l of s.layers) if (l.type === "device" && !l.hidden) seen.set(`${l.shot.kind}:${l.shot.index}`, l.shot);
  return [...seen.values()];
}

export const missingShots = (p: Project, c: Category) => shotsUsed(p, c).filter((s) => !p.shots[s.kind][s.index]);

/** Presets marcados cujos slides têm todos os prints. */
export const readyPresets = (p: Project) =>
  PRESETS.filter((x) => p.presets.includes(x.id) && p.design[x.category].slides.length > 0 && !missingShots(p, x.category).length);

export const shotCount = (p: Project, k: DeviceKind) => p.shots[k].filter(Boolean).length;

// ------------------------------------------------------------ normalização

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);

export function normalizeLayer(raw: Partial<Layer>): Layer | null {
  const t = raw.type;
  const fill = <T extends Layer>(def: T): T => {
    const o = { ...def, ...raw, id: str(raw.id, def.id) } as T;
    o.x = num(o.x, def.x);
    o.y = num(o.y, def.y);
    o.w = clamp(num(o.w, def.w), 0.01, 4);
    o.rotation = num(o.rotation, 0);
    o.opacity = clamp(num(o.opacity, 1), 0, 1);
    o.hidden = !!o.hidden;
    o.locked = !!o.locked;
    return o;
  };
  if (t === "device") {
    const d = make.device(raw.shot?.kind === "tablet" ? "tablet" : "phone", num(raw.shot?.index, 0));
    const o = fill(d);
    o.shot = { kind: raw.shot?.kind === "tablet" ? "tablet" : "phone", index: clamp(Math.round(num(raw.shot?.index, 0)), 0, MAX_SHOTS - 1) };
    return o;
  }
  if (t === "text") return fill(make.text(str((raw as TextLayer).text, "Texto")));
  if (t === "image") return fill(make.image(null));
  if (t === "badge") {
    const s = (raw as BadgeLayer).store;
    return fill(make.badge(s === "google" || s === "apple" ? s : "auto"));
  }
  if (t === "shape") return fill(make.shape());
  return null;
}

function normalizeSlide(raw: Partial<Slide>): Slide {
  const bg = (raw.bg ?? {}) as Partial<Background>;
  return {
    id: str(raw.id, uid("s")),
    bg: {
      type: bg.type === "solid" ? "solid" : "gradient",
      a: str(bg.a, "#ffffff"),
      b: str(bg.b, "#e6ecf5"),
      angle: num(bg.angle, 180),
    },
    layers: (Array.isArray(raw.layers) ? raw.layers : []).map(normalizeLayer).filter((l): l is Layer => !!l),
  };
}

/**
 * Garante todos os campos. Projetos v1 (logo/ícone/selo fixos) são convertidos
 * em camadas — [aspectOf] informa a proporção das imagens já guardadas.
 */
export function normalizeProject(
  raw: Record<string, unknown>,
  defaults: (c: Category) => CategoryDesign,
  aspectOf: (id: string | null) => number | null = () => null,
): Project {
  if (raw.version !== 2) return fromV1(v1.normalizeProject(raw as unknown as v1.Project), defaults, aspectOf);
  const p = raw as unknown as Project;
  const list = (v: unknown) => {
    const arr = Array.isArray(v) ? v : [];
    const n = clamp(arr.length || 3, 1, MAX_SHOTS);
    return Array.from({ length: n }, (_, i) => (typeof arr[i] === "string" ? (arr[i] as string) : null));
  };
  const shots = { phone: list(p.shots?.phone), tablet: list(p.shots?.tablet) };
  const adj = (k: DeviceKind) => shots[k].map((_, i) => normalizeAdjust(p.adjust?.[k]?.[i]));
  const design = {} as Record<Category, CategoryDesign>;
  for (const c of CATEGORIES) {
    const d = p.design?.[c];
    design[c] = d && Array.isArray(d.slides)
      ? { template: str(d.template, "custom"), slides: d.slides.map(normalizeSlide) }
      : defaults(c);
  }
  return {
    version: 2,
    id: str(p.id, uid("p")),
    name: str(p.name, "Sem título"),
    updatedAt: num(p.updatedAt, Date.now()),
    design,
    shots,
    adjust: { phone: adj("phone"), tablet: adj("tablet") },
    presets: Array.isArray(p.presets) ? p.presets.filter((x) => !!presetById(x)) : ["iphone69", "ipad13", "playfeature"],
    exportSizes: p.exportSizes && typeof p.exportSizes === "object" ? p.exportSizes : {},
    format: p.format === "jpeg" ? "jpeg" : "png",
    library: Array.isArray(p.library) ? p.library.filter((x) => typeof x === "string") : [],
  };
}

/** Converte um projeto v1 (layout fixo: aparelho, logo, ícone, selo) em slides com camadas. */
function fromV1(
  o: v1.Project,
  defaults: (c: Category) => CategoryDesign,
  aspectOf: (id: string | null) => number | null,
): Project {
  const bg: Background = { type: "gradient", a: o.bgTop, b: o.bgBottom, angle: 180 };
  const design = {} as Record<Category, CategoryDesign>;
  for (const kind of KINDS) {
    const L = o.layouts[kind];
    const ref = PRESETS.find((x) => x.category === kind && x.platform === "ios")!.sizes[0];
    const aspect = frameFor(kind, "ios").aspect;
    const devH = (L.deviceScale * ref.w) / aspect / ref.h; // altura do aparelho em fração da altura
    const logoLayer = () => {
      if (!o.logo) return [];
      const a = aspectOf(o.logo) ?? 3;
      const w = (L.logo.size * ref.h * a) / ref.w;
      return [make.image(o.logo, { name: "Logo", x: L.logo.cx, y: L.logo.cy, w })];
    };
    const slides: Slide[] = [0, 1, 2].map((i) => ({
      id: uid("s"),
      bg: { ...bg },
      layers: [
        make.device(kind, i, { x: 0.5, y: L.deviceTop + devH / 2, w: L.deviceScale, cut: L.deviceCut }),
        ...logoLayer(),
      ],
    }));
    const store: Layer[] = [];
    if (o.icon || o.logo) {
      store.push(
        o.icon
          ? make.icon({
              imageId: o.icon,
              x: L.icon.cx,
              y: L.icon.cy,
              w: L.icon.size,
              bg: o.iconBg,
              pad: o.iconPad,
              style: o.iconBgEnabled ? "icon" : "plain",
              shadow: o.iconBgEnabled ? 0.5 : 0,
              radius: o.iconBgEnabled ? 0.2237 : 0,
            })
          : make.image(o.logo, { name: "Logo", x: L.icon.cx, y: L.icon.cy, w: L.icon.size }),
      );
    }
    store.push(make.badge("apple", { imageId: o.badge, x: L.badge.cx, y: L.badge.cy, w: L.badge.size }));
    slides.push({ id: uid("s"), bg: { ...bg }, layers: store });
    design[kind] = { template: "classic", slides };
  }
  design.feature = defaults("feature");
  const library = [o.logo, o.icon].filter((x): x is string => !!x);
  return {
    version: 2,
    id: o.id,
    name: o.name,
    updatedAt: o.updatedAt ?? Date.now(),
    design,
    shots: { phone: [...o.shots.phone], tablet: [...o.shots.tablet] },
    adjust: { phone: [...o.adjust.phone], tablet: [...o.adjust.tablet] },
    presets: [...new Set([...o.presets, "playfeature"])],
    exportSizes: {},
    format: "png",
    library,
  };
}

/** Projeto do app desktop (Flutter) → v2. */
export function fromDesktopJson(
  j: Record<string, unknown>,
  fileId: (path: string | null) => string | null,
  defaults: (c: Category) => CategoryDesign,
  aspectOf: (id: string | null) => number | null,
): Project {
  return fromV1(v1.fromDesktopJson(j, fileId), defaults, aspectOf);
}
