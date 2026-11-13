import { test } from "node:test";
import assert from "node:assert/strict";
import { fitReport, panShot, shotDestRect, shotSourceRect } from "../src/lib/geometry.ts";
import { INITIAL_ADJUST, type ShotAdjust } from "../src/lib/models.ts";

// Print Android 1080×2400 numa tela de iPad (3:4).
const img = { w: 1080, h: 2400 };
const screen = { w: 900, h: 1200 };
const A = (p: Partial<ShotAdjust>): ShotAdjust => ({ ...INITIAL_ADJUST, ...p });
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≈ ${b}`);

test("cover preenche a tela e mantém a proporção, alinhado ao topo", () => {
  const r = shotDestRect(img, INITIAL_ADJUST, screen);
  close(r.w, 900);
  close(r.h, 2000);
  close(r.y, 0);
  const rep = fitReport(img, INITIAL_ADJUST, screen);
  assert.ok(rep.crops && !rep.hasGaps && !rep.distorts && rep.canPanY && !rep.canPanX);
});

test("contain mostra o print inteiro e sobra borda", () => {
  const a = A({ fit: "contain", alignY: 0 });
  const r = shotDestRect(img, a, screen);
  close(r.h, 1200);
  close(r.w, 540);
  close(r.x, 180);
  const rep = fitReport(img, a, screen);
  assert.ok(!rep.crops && rep.hasGaps);
});

test("fill ocupa a tela exata e reporta a distorção", () => {
  const a = A({ fit: "fill" });
  assert.deepEqual(shotDestRect(img, a, screen), { x: 0, y: 0, w: 900, h: 1200 });
  assert.ok(fitReport(img, a, screen).distorts);
  assert.ok(!fitReport({ w: 450, h: 600 }, a, screen).distorts);
});

test("corte das barras remove topo/base antes do encaixe (só com o interruptor ligado)", () => {
  const a = A({ stripBars: true, cropTop: 0.05, cropBottom: 0.02 });
  const src = shotSourceRect(img, a);
  close(src.y, 120);
  close(src.y + src.h, 2352);
  assert.deepEqual(shotSourceRect(img, { ...a, stripBars: false }), { x: 0, y: 0, w: 1080, h: 2400 });
});

test("arraste acompanha o cursor e para nas bordas", () => {
  const a = A({ zoom: 2, alignX: 0, alignY: 0 });
  const before = shotDestRect(img, a, screen);
  const after = shotDestRect(img, panShot(img, a, screen, 50, 30), screen);
  close(after.x - before.x, 50);
  close(after.y - before.y, 30);
  const far = panShot(img, a, screen, 100000, 0);
  assert.equal(far.alignX, -1);
  close(shotDestRect(img, far, screen).x, 0);
});

test("arraste num eixo sem folga não muda a posição", () => {
  assert.equal(panShot(img, INITIAL_ADJUST, screen, 80, 0).alignX, 0);
});

test("a proporção (não a resolução) define o enquadramento: preview reduzido = exportação", () => {
  const a = A({ zoom: 1.4, alignX: 0.3, alignY: -0.2, stripBars: true, cropTop: 0.03 });
  const full = shotDestRect(img, a, screen);
  const small = shotDestRect({ w: 540, h: 1200 }, a, screen);
  close(full.x, small.x);
  close(full.y, small.y);
  close(full.w, small.w);
  close(full.h, small.h);
});

test("área segura: só com barras removidas; reserva câmera + extra e encolhe a área do print", async () => {
  const { safeInset, shotArea } = await import("../src/lib/geometry.ts");
  const on = A({ stripBars: true, safeArea: true, safeExtra: 0.01 });
  close(safeInset(on, 0.05, 1000), 60);
  assert.equal(safeInset({ ...on, stripBars: false }, 0.05, 1000), 0);
  assert.equal(safeInset({ ...on, safeArea: false }, 0.05, 1000), 0);
  assert.deepEqual(shotArea(on, 0.05, { w: 500, h: 1000 }), { w: 500, h: 940 });
  // Projetos antigos (sem o campo) continuam sem faixa.
  assert.equal(safeInset(INITIAL_ADJUST, 0.05, 1000), 0);
});
