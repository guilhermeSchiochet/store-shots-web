import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeShotPixels } from "../src/lib/detector.ts";

// Imagem sintética RGBA no tamanho de análise (360 × 780).
const W = 360, H = 780;
const BLUE = 0x1565c0, DARK = 0x0d47a1, WHITE = 0xffffff, GREY = 0x202124;

function canvas(color: number) {
  const px = new Uint8ClampedArray(W * H * 4);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: number) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        px[i] = (c >> 16) & 255;
        px[i + 1] = (c >> 8) & 255;
        px[i + 2] = c & 255;
        px[i + 3] = 255;
      }
  };
  /** "Texto": traços verticais finos, como glifos. */
  const glyphs = (x0: number, y0: number, x1: number, y1: number, c: number) => {
    for (let x = x0; x < x1; x += 4) rect(x, y0, x + 2, y1, c);
  };
  rect(0, 0, W, H, color);
  return { px, rect, glyphs, analyze: () => analyzeShotPixels(px, W, H) };
}

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b} ±${tol}`);

test("Android: barra de status da mesma cor da barra do app — corta só a barra", () => {
  const c = canvas(WHITE);
  c.rect(0, 0, W, 76, BLUE);
  c.glyphs(10, 5, 40, 16, WHITE); // hora
  c.glyphs(300, 6, 350, 15, WHITE); // ícones
  c.glyphs(16, 38, 160, 54, WHITE); // título do app (fica)
  const rows = c.analyze().statusBar! * H;
  near(rows, 21, 1);
  assert.ok(rows < 38);
});

test("barra de status de outra cor: corta exatamente na fronteira", () => {
  const c = canvas(WHITE);
  c.rect(0, 0, W, 21, DARK);
  c.rect(0, 21, W, 80, BLUE);
  c.glyphs(10, 4, 40, 12, WHITE);
  c.glyphs(300, 4, 350, 12, WHITE);
  near(c.analyze().statusBar! * H, 21, 0.01);
});

test("iPhone com ilha dinâmica: barra alta, ícones centralizados nela", () => {
  const c = canvas(WHITE);
  c.glyphs(30, 19, 70, 30, GREY);
  c.glyphs(290, 20, 340, 29, GREY);
  c.glyphs(16, 62, 200, 80, GREY); // título grande do app
  const rows = c.analyze().statusBar! * H;
  near(rows, 49, 1);
  assert.ok(rows < 62);
});

test("conteúdo logo abaixo dos ícones limita o corte (não come o app)", () => {
  const c = canvas(WHITE);
  c.glyphs(10, 8, 40, 18, GREY);
  c.glyphs(300, 8, 350, 18, GREY);
  c.glyphs(16, 21, 340, 40, GREY);
  assert.ok(c.analyze().statusBar! * H <= 21);
});

test("print sem barra de status (título no topo) não é cortado", () => {
  const a = canvas(WHITE);
  a.glyphs(120, 10, 240, 24, GREY);
  assert.equal(a.analyze().statusBar, null);
  const b = canvas(WHITE);
  b.glyphs(16, 14, 170, 28, GREY);
  assert.equal(b.analyze().statusBar, null);
});

test("foto/degradê no topo: não arrisca", () => {
  const c = canvas(WHITE);
  for (let y = 0; y < 80; y++)
    for (let x = 0; x < W; x += 2) c.rect(x, y, x + 1, y + 1, (((x * 7 + y * 13) % 256) << 16) | (((x * 3) % 256) << 8) | y % 256);
  assert.equal(c.analyze().statusBar, null);
});

test("pílula de gestos do Android na base é detectada", () => {
  const c = canvas(WHITE);
  c.glyphs(10, 5, 40, 16, GREY);
  c.glyphs(300, 6, 350, 15, GREY);
  c.rect(135, H - 8, 225, H - 5, GREY);
  near(c.analyze().navBar! * H, 13, 1);
});

test("barra de abas do app na base NÃO é barra do sistema", () => {
  const c = canvas(WHITE);
  c.rect(0, H - 60, W, H, 0xf5f5f5);
  for (const x of [20, 160, 300]) c.glyphs(x, H - 45, x + 40, H - 20, GREY);
  assert.equal(c.analyze().navBar, null);
});

test("cor das bordas = cor predominante nas laterais", () => {
  const c = canvas(0xfafafa);
  c.rect(0, 0, W, 30, BLUE);
  assert.equal(c.analyze().edgeColor, "#fafafa");
});
