// Modelos do Store Shots. Tudo em frações (0..1) para valer em qualquer resolução.
// Ao mudar um campo de Project: atualize defaults, normalizeProject e (se preciso) a migração.

export type DeviceKind = "phone" | "tablet";
export const KINDS: DeviceKind[] = ["phone", "tablet"];
export const KIND_LABEL: Record<DeviceKind, { one: string; many: string }> = {
  phone: { one: "Celular", many: "Celulares" },
  tablet: { one: "Tablet", many: "Tablets" },
};

// ------------------------------------------------------------ molduras e tamanhos

export interface FrameDef {
  id: string;
  name: string;
  src: string;
  kind: DeviceKind;
}

/** Para adicionar uma moldura: PNG com a tela transparente em public/frames + entrada aqui. */
export const FRAMES: FrameDef[] = [
  { id: "iphone18", name: "iPhone 18 Pro Max", src: "/frames/iphone_18_pro_max.png", kind: "phone" },
  { id: "ipadair4", name: "iPad Air", src: "/frames/ipad_air_4.png", kind: "tablet" },
  { id: "s26", name: "Galaxy S26 Ultra", src: "/frames/galaxy_s26_ultra.png", kind: "phone" },
  { id: "tabs7", name: "Galaxy Tab S7", src: "/frames/galaxy_tab_s7.png", kind: "tablet" },
];
export const frameOf = (id: string) => FRAMES.find((f) => f.id === id)!;

export interface ExportPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  frameId: string;
  folder: string;
}

/** Confira os tamanhos aceitos no App Store Connect / Play Console: a lista muda com o tempo. */
export const PRESETS: ExportPreset[] = [
  { id: "iphone69", label: 'iPhone 6.9"', width: 1320, height: 2868, frameId: "iphone18", folder: "iphone_6.9" },
  { id: "iphone65", label: 'iPhone 6.5"', width: 1284, height: 2778, frameId: "iphone18", folder: "iphone_6.5" },
  { id: "ipad13", label: 'iPad 13"', width: 2064, height: 2752, frameId: "ipadair4", folder: "ipad_13" },
  { id: "ipad129", label: 'iPad 12.9"', width: 2048, height: 2732, frameId: "ipadair4", folder: "ipad_12.9" },
  { id: "androidphone", label: "Android celular", width: 1080, height: 2160, frameId: "s26", folder: "android_celular" },
  { id: "androidtab", label: 'Android tablet 10"', width: 1600, height: 2560, frameId: "tabs7", folder: "android_tablet" },
];
export const kindOfPreset = (p: ExportPreset) => frameOf(p.frameId).kind;
export const presetsOf = (k: DeviceKind) => PRESETS.filter((p) => kindOfPreset(p) === k);

// ------------------------------------------------------------ elementos posicionáveis

export type SlideElement = "logo" | "icon" | "badge";
export const STORE_SLIDE = 3; // índice do slide 4 (ícone + selo)

export const ELEMENT_SPEC: Record<
  SlideElement,
  { label: string; minSize: number; maxSize: number; fallbackAspect: number }
> = {
  // logo: tamanho = altura / altura do slide
  logo: { label: "Logo", minSize: 0.02, maxSize: 0.2, fallbackAspect: 3 },
  // ícone: lado / largura do slide
  icon: { label: "Ícone", minSize: 0.15, maxSize: 0.85, fallbackAspect: 1 },
  // selo: largura / largura do slide
  badge: { label: "Selo", minSize: 0.15, maxSize: 0.85, fallbackAspect: 3 },
};
export const appearsOn = (e: SlideElement, slide: number) =>
  e === "logo" ? slide !== STORE_SLIDE : slide === STORE_SLIDE;

export interface Placement {
  cx: number;
  cy: number;
  size: number;
}

export interface KindLayout {
  deviceScale: number; // largura do aparelho / largura do slide
  deviceTop: number; // topo do aparelho / altura do slide
  deviceCut: number; // fração da altura do aparelho cortada na base
  logo: Placement;
  icon: Placement;
  badge: Placement;
}

export const DEFAULT_LAYOUT: Record<DeviceKind, KindLayout> = {
  phone: {
    deviceScale: 0.8,
    deviceTop: 0.06,
    deviceCut: 0,
    logo: { cx: 0.5, cy: 0.93, size: 0.05 },
    icon: { cx: 0.5, cy: 0.44, size: 0.42 },
    badge: { cx: 0.5, cy: 0.63, size: 0.4 },
  },
  tablet: {
    deviceScale: 0.76,
    deviceTop: 0.05,
    deviceCut: 0,
    logo: { cx: 0.5, cy: 0.93, size: 0.045 },
    icon: { cx: 0.5, cy: 0.42, size: 0.42 },
    badge: { cx: 0.5, cy: 0.69, size: 0.4 },
  },
};

// ------------------------------------------------------------ enquadramento do print

export type ShotFit = "cover" | "contain" | "fill";
export const FIT_LABEL: Record<ShotFit, string> = { cover: "Cobrir", contain: "Conter", fill: "Preencher" };

/**
 * Enquadramento de UM print. Ordem: corte das barras → encaixe → zoom/posição.
 * O padrão (cover + topo, sem corte) é o desenho das versões anteriores.
 */
export interface ShotAdjust {
  fit: ShotFit;
  zoom: number; // 1..4
  alignX: number; // -1..1
  alignY: number; // -1..1
  stripBars: boolean;
  cropTop: number; // fração da altura do print
  cropBottom: number;
  autoTop: number | null; // detecção automática (null = não detectado)
  autoBottom: number | null;
  padColor: string | null; // cor das bordas em "Conter"
  /**
   * Com as barras removidas, afasta o conteúdo da câmera do aparelho (ilha,
   * notch, furo): o topo da tela vira uma faixa da cor do cabeçalho do app.
   */
  safeArea: boolean;
  safeExtra: number; // espaço além da câmera, em fração da altura da tela
}

export const ZOOM = { min: 1, max: 4 };
export const SAFE_EXTRA = { min: -0.04, max: 0.1, default: 0.012 };
export const CROP_MAX = { top: 0.15, bottom: 0.12 };

export const INITIAL_ADJUST: ShotAdjust = {
  fit: "cover",
  zoom: 1,
  alignX: 0,
  alignY: -1,
  stripBars: false,
  cropTop: 0,
  cropBottom: 0,
  autoTop: null,
  autoBottom: null,
  padColor: null,
  safeArea: false,
  safeExtra: SAFE_EXTRA.default,
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function normalizeAdjust(a: Partial<ShotAdjust> | undefined | null): ShotAdjust {
  const x = { ...INITIAL_ADJUST, ...(a ?? {}) };
  return {
    ...x,
    fit: (["cover", "contain", "fill"] as const).includes(x.fit) ? x.fit : "cover",
    zoom: clamp(Number(x.zoom) || 1, ZOOM.min, ZOOM.max),
    alignX: clamp(Number(x.alignX) || 0, -1, 1),
    alignY: clamp(Number.isFinite(Number(x.alignY)) ? Number(x.alignY) : -1, -1, 1),
    cropTop: clamp(Number(x.cropTop) || 0, 0, CROP_MAX.top),
    cropBottom: clamp(Number(x.cropBottom) || 0, 0, CROP_MAX.bottom),
    // Prints anteriores à área segura: liga junto com a remoção das barras.
    safeArea: a?.safeArea === undefined ? !!x.stripBars : !!a.safeArea,
    safeExtra: clamp(Number.isFinite(Number(x.safeExtra)) ? Number(x.safeExtra) : SAFE_EXTRA.default, SAFE_EXTRA.min, SAFE_EXTRA.max),
  };
}

export const effectiveCrop = (a: ShotAdjust) => ({
  top: a.stripBars ? a.cropTop : 0,
  bottom: a.stripBars ? a.cropBottom : 0,
});

export const hasFraming = (a: ShotAdjust) => a.fit !== "cover" || a.zoom !== 1 || a.alignX !== 0 || a.alignY !== -1;

export function detectedAdjust(top: number | null, bottom: number | null, padColor: string | null): ShotAdjust {
  return {
    ...INITIAL_ADJUST,
    stripBars: top !== null || bottom !== null,
    safeArea: top !== null,
    cropTop: clamp(top ?? 0, 0, CROP_MAX.top),
    cropBottom: clamp(bottom ?? 0, 0, CROP_MAX.bottom),
    autoTop: top,
    autoBottom: bottom,
    padColor,
  };
}

// ------------------------------------------------------------ projeto

export type AssetSlot = "logo" | "icon" | "badge";

/** Um projeto = um app/marca. Imagens ficam no IndexedDB; aqui só os ids. */
export interface Project {
  id: string;
  name: string;
  updatedAt: number;
  bgTop: string;
  bgBottom: string;
  logo: string | null;
  icon: string | null;
  badge: string | null;
  shots: Record<DeviceKind, (string | null)[]>;
  adjust: Record<DeviceKind, ShotAdjust[]>;
  iconBg: string;
  iconBgEnabled: boolean;
  iconPad: number;
  layouts: Record<DeviceKind, KindLayout>;
  presets: string[];
}

export function newProject(name: string): Project {
  return {
    id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    updatedAt: Date.now(),
    bgTop: "#ffffff",
    bgBottom: "#e6ecf5",
    logo: null,
    icon: null,
    badge: null,
    shots: { phone: [null, null, null], tablet: [null, null, null] },
    adjust: { phone: [INITIAL_ADJUST, INITIAL_ADJUST, INITIAL_ADJUST], tablet: [INITIAL_ADJUST, INITIAL_ADJUST, INITIAL_ADJUST] },
    iconBg: "#ffffff",
    iconBgEnabled: true,
    iconPad: 0.08,
    layouts: structuredClone(DEFAULT_LAYOUT),
    presets: ["iphone69", "ipad13"],
  };
}

const three = <T>(v: unknown, map: (x: unknown) => T): T[] => {
  const list = Array.isArray(v) ? v : [];
  return [0, 1, 2].map((i) => map(list[i]));
};

function normalizePlacement(v: unknown, fb: Placement): Placement {
  const o = (v ?? {}) as Partial<Placement>;
  const n = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  return { cx: n(o.cx, fb.cx), cy: n(o.cy, fb.cy), size: n(o.size, fb.size) };
}

function normalizeLayout(v: unknown, kind: DeviceKind): KindLayout {
  const base = DEFAULT_LAYOUT[kind];
  const o = (v ?? {}) as Partial<KindLayout>;
  const n = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  return {
    deviceScale: n(o.deviceScale, base.deviceScale),
    deviceTop: n(o.deviceTop, base.deviceTop),
    deviceCut: n(o.deviceCut, base.deviceCut),
    logo: normalizePlacement(o.logo, base.logo),
    icon: normalizePlacement(o.icon, base.icon),
    badge: normalizePlacement(o.badge, base.badge),
  };
}

/** Garante todos os campos (projetos antigos/corrompidos carregam com padrões seguros). */
export function normalizeProject(raw: Partial<Project> & { id: string; name: string }): Project {
  const base = newProject(raw.name ?? "Sem título");
  const shots = (raw.shots ?? {}) as Partial<Record<DeviceKind, unknown>>;
  const adjust = (raw.adjust ?? {}) as Partial<Record<DeviceKind, unknown>>;
  const layouts = (raw.layouts ?? {}) as Partial<Record<DeviceKind, unknown>>;
  return {
    ...base,
    ...raw,
    shots: {
      phone: three(shots.phone, (x) => (typeof x === "string" ? x : null)),
      tablet: three(shots.tablet, (x) => (typeof x === "string" ? x : null)),
    },
    adjust: {
      phone: three(adjust.phone, (x) => normalizeAdjust(x as Partial<ShotAdjust>)),
      tablet: three(adjust.tablet, (x) => normalizeAdjust(x as Partial<ShotAdjust>)),
    },
    layouts: { phone: normalizeLayout(layouts.phone, "phone"), tablet: normalizeLayout(layouts.tablet, "tablet") },
    presets: Array.isArray(raw.presets) ? raw.presets.filter((p) => PRESETS.some((x) => x.id === p)) : base.presets,
  };
}

const argbToHex = (v: unknown, fb: string) => {
  if (typeof v !== "number") return fb;
  return `#${(v & 0xffffff).toString(16).padStart(6, "0")}`;
};

/**
 * Converte o `project.json` do app desktop (Flutter, layoutV 3/4/5) para o formato
 * do site. [fileId] mapeia o caminho de arquivo antigo → id da imagem importada.
 */
export function fromDesktopJson(j: Record<string, unknown>, fileId: (path: string | null) => string | null): Project {
  const kindLayouts = (j.layouts ?? null) as Record<string, unknown> | null;
  const layouts = {
    phone: normalizeLayout(kindLayouts?.phone, "phone"),
    tablet: normalizeLayout(kindLayouts?.tablet, "tablet"),
  };
  if (!kindLayouts) {
    // layoutV <= 3: um único ajuste para tudo, que vira o do celular.
    const d = (k: string, def: number) => (typeof j[k] === "number" ? (j[k] as number) : def);
    const base = DEFAULT_LAYOUT.phone;
    const keep = j.layoutV === 3;
    layouts.phone = {
      ...base,
      deviceScale: keep ? d("deviceScale", base.deviceScale) : base.deviceScale,
      deviceTop: keep ? d("deviceTop", base.deviceTop) : base.deviceTop,
      logo: { cx: d("logoCx", base.logo.cx), cy: d("logoCy", base.logo.cy), size: d("logoH", base.logo.size) },
    };
  }
  const mapAdjust = (v: unknown) =>
    three(v, (x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return normalizeAdjust({
        ...(o as Partial<ShotAdjust>),
        padColor: typeof o.padColor === "number" ? argbToHex(o.padColor, "#ffffff") : null,
      });
    });
  const strList = (v: unknown) => three(v, (x) => fileId(typeof x === "string" ? x : null));
  return normalizeProject({
    id: newProject("x").id,
    name: typeof j.name === "string" ? j.name : "Projeto importado",
    updatedAt: Date.now(),
    bgTop: argbToHex(j.bgTop, "#ffffff"),
    bgBottom: argbToHex(j.bgBottom, "#e6ecf5"),
    logo: fileId((j.logoPath as string) ?? null),
    icon: fileId((j.iconPath as string) ?? null),
    badge: fileId((j.badgePath as string) ?? null),
    shots: { phone: strList(j.phoneShots), tablet: strList(j.tabletShots) },
    adjust: { phone: mapAdjust(j.phoneAdjust), tablet: mapAdjust(j.tabletAdjust) },
    iconBg: argbToHex(j.iconBg, "#ffffff"),
    iconBgEnabled: typeof j.iconBgEnabled === "boolean" ? j.iconBgEnabled : true,
    iconPad: typeof j.iconPad === "number" ? j.iconPad : 0.08,
    layouts,
    presets: Array.isArray(j.presets) ? (j.presets as string[]) : ["iphone69", "ipad13"],
  });
}

export const shotCount = (p: Project, k: DeviceKind) => p.shots[k].filter(Boolean).length;
export const hasContent = (p: Project, e: SlideElement) =>
  e === "logo" ? !!p.logo : e === "icon" ? !!(p.icon || p.logo) : true;
export const readyPresets = (p: Project) =>
  PRESETS.filter((x) => p.presets.includes(x.id) && p.shots[kindOfPreset(x)].every(Boolean));
