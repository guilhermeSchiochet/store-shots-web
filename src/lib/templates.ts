// Modelos prontos. Cada modelo gera os slides de uma categoria; depois de
// aplicado, tudo é camada livre (dá para mover, trocar, apagar e adicionar).
//
// Layouts escolhidos a partir dos padrões mais usados em capturas de loja:
// título em cima + aparelho (o mais comum), título embaixo, aparelho inclinado,
// dois aparelhos, tela cheia e destaque escuro; além do clássico (só aparelho).
import {
  frameFor,
  make,
  PRESETS,
  uid,
  type Background,
  type Category,
  type CategoryDesign,
  type DeviceKind,
  type Layer,
  type Slide,
  type TextLayer,
} from "./models.ts";

export interface Template {
  id: string;
  name: string;
  description: string;
  categories: Category[];
  build: (c: Category) => CategoryDesign;
}

const TITLES = [
  ["Tudo o que você precisa", "em um só lugar, na palma da mão"],
  ["Acompanhe em tempo real", "Informações sempre atualizadas"],
  ["Resolva em poucos toques", "Rápido, simples e sem filas"],
];
const STORE_TEXT = ["Baixe agora", "Disponível gratuitamente"];

const light: Background = { type: "gradient", a: "#ffffff", b: "#e6ecf5", angle: 180 };
const soft: Background = { type: "gradient", a: "#eef4ff", b: "#c9dafc", angle: 180 };
const dark: Background = { type: "gradient", a: "#0f172a", b: "#1e3a8a", angle: 160 };

/** Tamanho de referência (proporção) de cada categoria. */
const ref = (c: Category) => PRESETS.find((p) => p.category === c && p.platform === (c === "feature" ? "android" : "ios"))!.sizes[0];

/** Altura do aparelho (fração da altura do slide) para uma largura (fração da largura). */
export function deviceHeight(c: Category, kind: DeviceKind, w: number) {
  const r = ref(c);
  const platform = c === "feature" ? "android" : "ios";
  return (w * r.w) / frameFor(kind, platform).aspect / r.h;
}

const kindOf = (c: Category): DeviceKind => (c === "tablet" ? "tablet" : "phone");
const slide = (bg: Background, layers: Layer[]): Slide => ({ id: uid("s"), bg: { ...bg }, layers });

/** Slide final: ícone do app, nome e selo da loja (o selo segue a loja do tamanho exportado). */
function storeSlide(c: Category, bg: Background, onDark = false): Slide {
  const color = onDark ? "#ffffff" : "#0f172a";
  const t = c === "tablet";
  return slide(bg, [
    make.icon({ x: 0.5, y: 0.36, w: t ? 0.3 : 0.4 }),
    make.text(STORE_TEXT[0], { x: 0.5, y: t ? 0.57 : 0.56, w: 0.84, size: t ? 0.06 : 0.075, color }),
    make.text(STORE_TEXT[1], { x: 0.5, y: t ? 0.63 : 0.615, w: 0.84, size: t ? 0.032 : 0.042, weight: 500, color: onDark ? "#cbd5e1" : "#475569" }),
    make.badge("auto", { x: 0.5, y: t ? 0.73 : 0.7, w: t ? 0.34 : 0.46 }),
  ]);
}

function deviceSlides(c: Category, fn: (i: number, kind: DeviceKind) => Slide, last: Slide): CategoryDesign["slides"] {
  return [0, 1, 2].map((i) => fn(i, kindOf(c))).concat(last);
}

const title = (c: Category, i: number, p: Partial<TextLayer> = {}) =>
  make.text(TITLES[i][0], { size: c === "tablet" ? 0.058 : 0.072, ...p });
const subtitle = (c: Category, i: number, p: Partial<TextLayer> = {}) =>
  make.text(TITLES[i][1], { size: c === "tablet" ? 0.03 : 0.04, weight: 500, color: "#475569", ...p });

const solid = (a: string): Background => ({ type: "solid", a, b: a, angle: 180 });
const grad = (a: string, b: string, angle = 160): Background => ({ type: "gradient", a, b, angle });

/** Proporção (altura/largura) de uma forma de largura [w] que ocupa [hFrac] da altura do slide. */
function shapeRatio(c: Category, w: number, hFrac: number) {
  const r = ref(c);
  return (hFrac * r.h) / (w * r.w);
}

/**
 * "Panorama": um círculo grande atravessa a divisa entre cada par de slides
 * (metade em cada um). Lado a lado na loja, parece um fundo contínuo.
 */
function connect(slides: Slide[], fill: string, fill2: string, ys: number[], w = 0.95): Slide[] {
  for (let k = 0; k < slides.length - 1; k++) {
    const y = ys[k % ys.length];
    const half = (x: number) => make.shape({ name: "Círculo contínuo", shape: "ellipse", x, y, w, ratio: 1, fill, fill2, radius: 0 });
    slides[k].layers.unshift(half(1));
    slides[k + 1].layers.unshift(half(0));
  }
  return slides;
}

const VIVID: Background[] = [
  grad("#7c3aed", "#4338ca"),
  grad("#f97316", "#db2777"),
  grad("#06b6d4", "#0d9488"),
  grad("#4338ca", "#7c3aed"),
];
const TAGS = ["NOVO", "TEMPO REAL", "MAIS RÁPIDO"];

export const TEMPLATES: Template[] = [
  {
    id: "caption-top",
    name: "Título em cima",
    description: "O layout mais usado: título e subtítulo no topo, aparelho saindo pela base.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "caption-top",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.7 : 0.82;
          return slide(light, [
            title(c, i, { y: 0.075 }),
            subtitle(c, i, { y: k === "tablet" ? 0.135 : 0.142 }),
            make.device(k, i, { w, y: 0.215 + deviceHeight(c, k, w) / 2, shadow: 0.35 }),
          ]);
        },
        storeSlide(c, light),
      ),
    }),
  },
  {
    id: "caption-bottom",
    name: "Título embaixo",
    description: "Aparelho em destaque no topo e a mensagem embaixo.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "caption-bottom",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.66 : 0.72;
          return slide(soft, [
            make.device(k, i, { w, y: 0.045 + deviceHeight(c, k, w) / 2, shadow: 0.35 }),
            title(c, i, { y: 0.865 }),
            subtitle(c, i, { y: 0.93 }),
          ]);
        },
        storeSlide(c, soft),
      ),
    }),
  },
  {
    id: "classic",
    name: "Clássico",
    description: "Só o aparelho, grande e centralizado, com uma legenda discreta.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "classic",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.76 : 0.8;
          return slide(light, [
            make.device(k, i, { w, y: 0.055 + deviceHeight(c, k, w) / 2 }),
            make.text(TITLES[i][0], { y: 0.93, size: c === "tablet" ? 0.032 : 0.042, weight: 600, color: "#334155" }),
          ]);
        },
        storeSlide(c, light),
      ),
    }),
  },
  {
    id: "tilted",
    name: "Inclinado",
    description: "Aparelho levemente girado e título alinhado à esquerda. Visual mais dinâmico.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "tilted",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.72 : 0.8;
          return slide(soft, [
            title(c, i, { y: 0.085, align: "left", font: "poppins", weight: 800 }),
            subtitle(c, i, { y: 0.15, align: "left", font: "poppins" }),
            make.device(k, i, { w, x: 0.53, y: 0.25 + deviceHeight(c, k, w) / 2, rotation: -8, shadow: 0.5 }),
          ]);
        },
        storeSlide(c, soft),
      ),
    }),
  },
  {
    id: "duo",
    name: "Dois aparelhos",
    description: "Dois prints sobrepostos no mesmo slide, para mostrar mais de uma tela.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "duo",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.55 : 0.62;
          const h = deviceHeight(c, k, w);
          return slide(light, [
            title(c, i, { y: 0.075 }),
            subtitle(c, i, { y: 0.14 }),
            make.device(k, (i + 1) % 3, { w, x: 0.66, y: 0.27 + h / 2, rotation: 6, shadow: 0.35 }),
            make.device(k, i, { w, x: 0.36, y: 0.23 + h / 2, rotation: -4, shadow: 0.5 }),
          ]);
        },
        storeSlide(c, light),
      ),
    }),
  },
  {
    id: "fullscreen",
    name: "Tela cheia",
    description: "O print ocupa o slide inteiro, sem moldura, com o texto sobre uma faixa escura.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "fullscreen",
      slides: deviceSlides(
        c,
        (i, k) =>
          slide(light, [
            make.device(k, i, { w: 1, y: 0.5, frame: "none", radius: 0 }),
            make.shape({ name: "Faixa", x: 0.5, y: 0.82, w: 1.02, ratio: c === "tablet" ? 0.5 : 0.85, fill: "#0f172a00", fill2: "#0f172ae6", radius: 0 }),
            title(c, i, { y: 0.86, color: "#ffffff" }),
            subtitle(c, i, { y: 0.925, color: "#e2e8f0" }),
          ]),
        storeSlide(c, dark, true),
      ),
    }),
  },
  {
    id: "bold",
    name: "Destaque escuro",
    description: "Fundo escuro, título forte em caixa alta e um círculo de destaque atrás do aparelho.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "bold",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.68 : 0.78;
          return slide(dark, [
            make.shape({ name: "Círculo", shape: "ellipse", x: 0.5, y: 0.6, w: 1.05, ratio: 1, fill: "#3b82f6", fill2: null, opacity: 0.25 }),
            title(c, i, { y: 0.08, color: "#ffffff", font: "montserrat", weight: 800, uppercase: true, letterSpacing: 0.02 }),
            subtitle(c, i, { y: 0.145, color: "#bfdbfe", font: "montserrat" }),
            make.device(k, i, { w, y: 0.215 + deviceHeight(c, k, w) / 2, shadow: 0.6 }),
          ]);
        },
        storeSlide(c, dark, true),
      ),
    }),
  },

  {
    id: "vivid",
    name: "Cores vibrantes",
    description: "Cada slide com um degradê forte e título branco em destaque. Chama atenção na busca.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "vivid",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.7 : 0.8;
          return slide(VIVID[i], [
            title(c, i, { y: 0.08, color: "#ffffff", font: "poppins", weight: 800 }),
            subtitle(c, i, { y: k === "tablet" ? 0.14 : 0.145, color: "#ffffffcc", font: "poppins" }),
            make.device(k, i, { w, y: 0.22 + deviceHeight(c, k, w) / 2, shadow: 0.7 }),
          ]);
        },
        storeSlide(c, VIVID[3], true),
      ),
    }),
  },
  {
    id: "panorama",
    name: "Panorama",
    description: "Círculos que atravessam de um slide para o outro: na loja, as capturas parecem uma faixa contínua.",
    categories: ["phone", "tablet"],
    build: (c) => {
      const bg = solid("#eef2ff");
      const slides = deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.66 : 0.74;
          return slide(bg, [
            title(c, i, { y: 0.075, color: "#1e1b4b", font: "nunito", weight: 800 }),
            subtitle(c, i, { y: k === "tablet" ? 0.135 : 0.14, color: "#4338ca", font: "nunito" }),
            make.device(k, i, { w, y: 0.215 + deviceHeight(c, k, w) / 2, shadow: 0.45 }),
          ]);
        },
        storeSlide(c, bg),
      );
      return { template: "panorama", slides: connect(slides, "#a5b4fc", "#6366f1", [0.62, 0.42, 0.7], c === "tablet" ? 0.8 : 0.95) };
    },
  },
  {
    id: "minimal",
    name: "Minimalista",
    description: "Fundo claro liso, título com serifa alinhado à esquerda e o aparelho saindo pela base.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "minimal",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.62 : 0.7;
          const small = c === "tablet" ? 0.022 : 0.03;
          return slide(solid("#f6f4ef"), [
            make.text(`0${i + 1}`, { name: "Número", x: 0.5, y: 0.07, w: 0.84, size: small, weight: 600, color: "#a8a29e", align: "left", letterSpacing: 0.2 }),
            title(c, i, { y: 0.125, align: "left", font: "playfair", weight: 700, color: "#1c1917" }),
            subtitle(c, i, { y: k === "tablet" ? 0.19 : 0.2, align: "left", color: "#78716c" }),
            make.device(k, i, { w, y: 0.3 + deviceHeight(c, k, w) / 2, shadow: 0.25 }),
          ]);
        },
        storeSlide(c, solid("#f6f4ef")),
      ),
    }),
  },
  {
    id: "tag",
    name: "Etiqueta",
    description: "Uma etiqueta colorida acima do título destaca o recurso de cada slide.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "tag",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.68 : 0.78;
          const t = c === "tablet";
          return slide(light, [
            make.text(TAGS[i], {
              name: "Etiqueta",
              y: 0.06,
              w: t ? 0.26 : 0.4,
              size: t ? 0.022 : 0.032,
              weight: 800,
              color: "#ffffff",
              bg: "#2563eb",
              letterSpacing: 0.08,
            }),
            title(c, i, { y: t ? 0.125 : 0.13 }),
            subtitle(c, i, { y: t ? 0.18 : 0.19 }),
            make.device(k, i, { w, y: 0.255 + deviceHeight(c, k, w) / 2, shadow: 0.35 }),
          ]);
        },
        storeSlide(c, light),
      ),
    }),
  },
  {
    id: "zoom",
    name: "Aparelho ampliado",
    description: "Aparelho bem grande e inclinado, cortado pela borda. Mostra os detalhes da tela.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "zoom",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 1.0 : 1.12;
          return slide(grad("#fdf2f8", "#fbcfe8", 180), [
            title(c, i, { y: 0.08, align: "left", color: "#831843", font: "montserrat", weight: 800 }),
            subtitle(c, i, { y: k === "tablet" ? 0.14 : 0.15, align: "left", color: "#9d174d", font: "montserrat" }),
            make.device(k, i, { w, x: 0.62, y: 0.26 + deviceHeight(c, k, w) / 2, rotation: -12, shadow: 0.6 }),
          ]);
        },
        storeSlide(c, grad("#fdf2f8", "#fbcfe8", 180)),
      ),
    }),
  },
  {
    id: "card",
    name: "Cartão",
    description: "Fundo colorido com um cartão branco arredondado em volta do aparelho.",
    categories: ["phone", "tablet"],
    build: (c) => {
      const bg = grad("#2563eb", "#1e3a8a", 180);
      return {
        template: "card",
        slides: deviceSlides(
          c,
          (i, k) => {
            const w = k === "tablet" ? 0.6 : 0.68;
            const cardW = 0.88;
            return slide(bg, [
              title(c, i, { y: 0.07, color: "#ffffff" }),
              subtitle(c, i, { y: k === "tablet" ? 0.13 : 0.135, color: "#bfdbfe" }),
              make.shape({ name: "Cartão", x: 0.5, y: 0.6, w: cardW, ratio: shapeRatio(c, cardW, 0.72), fill: "#ffffff", fill2: null, radius: 0.08 }),
              make.device(k, i, { w, y: 0.29 + deviceHeight(c, k, w) / 2, shadow: 0.3 }),
            ]);
          },
          storeSlide(c, bg, true),
        ),
      };
    },
  },
  {
    id: "screen",
    name: "Só a tela",
    description: "Sem moldura: a tela do app com cantos arredondados e sombra, sobre um fundo suave.",
    categories: ["phone", "tablet"],
    build: (c) => ({
      template: "screen",
      slides: deviceSlides(
        c,
        (i, k) => {
          const w = k === "tablet" ? 0.7 : 0.76;
          return slide(grad("#ecfdf5", "#a7f3d0", 180), [
            title(c, i, { y: 0.075, color: "#064e3b" }),
            subtitle(c, i, { y: k === "tablet" ? 0.135 : 0.14, color: "#047857" }),
            make.device(k, i, { w, y: 0.22 + (deviceHeight(c, k, w) * 0.95) / 2, frame: "none", radius: 0.07, shadow: 0.5 }),
          ]);
        },
        storeSlide(c, grad("#ecfdf5", "#a7f3d0", 180)),
      ),
    }),
  },

  // ---------------------------------------------------- recurso gráfico (1024 × 500)
  {
    id: "feature-title-device",
    name: "Título + aparelho",
    description: "Mensagem à esquerda e um aparelho saindo pela base, à direita.",
    categories: ["feature"],
    build: () => ({
      template: "feature-title-device",
      slides: [
        slide(dark, [
          make.text("Tudo o que você precisa", { x: 0.3, y: 0.4, w: 0.5, size: 0.05, align: "left", color: "#ffffff", font: "poppins", weight: 800 }),
          make.text("em um só lugar", { x: 0.3, y: 0.56, w: 0.5, size: 0.03, align: "left", color: "#bfdbfe", weight: 500 }),
          make.device("phone", 0, { x: 0.76, y: 0.68, w: 0.26, shadow: 0.6 }),
        ]),
      ],
    }),
  },
  {
    id: "feature-icon-devices",
    name: "Ícone + aparelhos",
    description: "Ícone do app à esquerda e dois aparelhos sobrepostos à direita.",
    categories: ["feature"],
    build: () => ({
      template: "feature-icon-devices",
      slides: [
        slide(soft, [
          make.icon({ x: 0.25, y: 0.5, w: 0.2 }),
          make.device("phone", 1, { x: 0.62, y: 0.47, w: 0.2, shadow: 0.4 }),
          make.device("phone", 0, { x: 0.76, y: 0.57, w: 0.2, shadow: 0.5 }),
        ]),
      ],
    }),
  },
  {
    id: "feature-big-title",
    name: "Só a mensagem",
    description: "Frase grande no centro sobre um degradê forte. Sem aparelho.",
    categories: ["feature"],
    build: () => ({
      template: "feature-big-title",
      slides: [
        slide(grad("#7c3aed", "#db2777", 120), [
          make.text("Tudo o que você precisa", { x: 0.5, y: 0.43, w: 0.86, size: 0.068, color: "#ffffff", font: "poppins", weight: 800 }),
          make.text("em um só lugar, na palma da mão", { x: 0.5, y: 0.6, w: 0.8, size: 0.03, color: "#ffffffd9", font: "poppins", weight: 500 }),
        ]),
      ],
    }),
  },
  {
    id: "feature-fan",
    name: "Três aparelhos",
    description: "Três telas em leque no centro, saindo pela base, sobre um fundo escuro.",
    categories: ["feature"],
    build: () => ({
      template: "feature-fan",
      slides: [
        slide(dark, [
          make.shape({ name: "Brilho", shape: "ellipse", x: 0.5, y: 0.75, w: 0.7, ratio: 0.6, fill: "#3b82f6", fill2: null, opacity: 0.3 }),
          make.device("phone", 1, { x: 0.33, y: 0.66, w: 0.19, rotation: -12, shadow: 0.5 }),
          make.device("phone", 2, { x: 0.67, y: 0.66, w: 0.19, rotation: 12, shadow: 0.5 }),
          make.device("phone", 0, { x: 0.5, y: 0.6, w: 0.21, shadow: 0.7 }),
        ]),
      ],
    }),
  },
  {
    id: "feature-tilted",
    name: "Aparelho inclinado",
    description: "Título à esquerda e um aparelho grande e girado atravessando a direita.",
    categories: ["feature"],
    build: () => ({
      template: "feature-tilted",
      slides: [
        slide(grad("#fff7ed", "#fed7aa", 135), [
          make.text("Resolva em poucos toques", { x: 0.3, y: 0.42, w: 0.48, size: 0.05, align: "left", color: "#7c2d12", font: "montserrat", weight: 800 }),
          make.text("Rápido, simples e sem filas", { x: 0.3, y: 0.6, w: 0.48, size: 0.028, align: "left", color: "#9a3412", weight: 500 }),
          make.device("phone", 0, { x: 0.76, y: 0.62, w: 0.3, rotation: 18, shadow: 0.6 }),
        ]),
      ],
    }),
  },
  {
    id: "feature-split",
    name: "Dividido",
    description: "Metade colorida com a mensagem, metade clara com dois aparelhos.",
    categories: ["feature"],
    build: () => ({
      template: "feature-split",
      slides: [
        slide(solid("#f1f5f9"), [
          make.shape({ name: "Metade colorida", x: 0.24, y: 0.5, w: 0.5, ratio: shapeRatio("feature", 0.5, 1.02), fill: "#2563eb", fill2: "#1e3a8a", radius: 0 }),
          make.text("Acompanhe em tempo real", { x: 0.24, y: 0.42, w: 0.4, size: 0.042, align: "left", color: "#ffffff", font: "poppins", weight: 800 }),
          make.text("Informações sempre atualizadas", { x: 0.24, y: 0.6, w: 0.4, size: 0.024, align: "left", color: "#bfdbfe", weight: 500 }),
          make.device("phone", 1, { x: 0.66, y: 0.62, w: 0.2, rotation: -6, shadow: 0.4 }),
          make.device("phone", 0, { x: 0.82, y: 0.56, w: 0.2, rotation: 4, shadow: 0.5 }),
        ]),
      ],
    }),
  },
  {
    id: "feature-brand",
    name: "Marca",
    description: "Ícone do app ao lado do nome e do slogan, alinhados no centro.",
    categories: ["feature"],
    build: () => ({
      template: "feature-brand",
      slides: [
        slide(grad("#ecfeff", "#a5f3fc", 160), [
          make.icon({ x: 0.27, y: 0.5, w: 0.17 }),
          make.text("Nome do app", { x: 0.62, y: 0.42, w: 0.5, size: 0.06, align: "left", color: "#164e63", font: "nunito", weight: 800 }),
          make.text("Tudo o que você precisa, em um só lugar", { x: 0.62, y: 0.58, w: 0.5, size: 0.026, align: "left", color: "#0e7490", weight: 500 }),
        ]),
      ],
    }),
  },
  {
    id: "feature-centered",
    name: "Centralizado",
    description: "Ícone e nome do app no centro, limpo e direto.",
    categories: ["feature"],
    build: () => ({
      template: "feature-centered",
      slides: [
        slide(light, [
          make.icon({ x: 0.5, y: 0.4, w: 0.16 }),
          make.text("Nome do app", { x: 0.5, y: 0.76, w: 0.8, size: 0.045 }),
        ]),
      ],
    }),
  },
];

export const templatesFor = (c: Category) => TEMPLATES.filter((t) => t.categories.includes(c));
export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
export const DEFAULT_TEMPLATE: Record<Category, string> = {
  phone: "caption-top",
  tablet: "caption-top",
  feature: "feature-title-device",
};
export const defaultDesign = (c: Category): CategoryDesign => templateById(DEFAULT_TEMPLATE[c])!.build(c);

/**
 * Aparelho criado automaticamente ao enviar um print para um slide sem
 * aparelho: centralizado, logo abaixo dos textos da metade de cima e
 * reduzido se for preciso para caber até a base.
 */
export function autoDevice(c: Category, kind: DeviceKind, index: number, slide: Slide) {
  if (c === "feature") return make.device(kind, index, { x: 0.72, y: 0.55, w: 0.22, shadow: 0.4 });
  let w = kind === "tablet" ? 0.7 : 0.8;
  const texts = slide.layers.filter((l) => l.type === "text" && !l.hidden && l.y < 0.45);
  const top = texts.length ? Math.max(...texts.map((t) => t.y)) + 0.06 : 0.06;
  let h = deviceHeight(c, kind, w);
  const room = 0.97 - top;
  if (h > room) {
    w *= room / h;
    h = room;
  }
  return make.device(kind, index, { w, y: top + h / 2, shadow: 0.35 });
}
