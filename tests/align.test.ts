import { test } from "node:test";
import assert from "node:assert/strict";
import { aabb, alignPatches, intersects, union } from "../src/lib/align.ts";
import { emptyProject, normalizeProject } from "../src/lib/models.ts";
import { defaultDesign } from "../src/lib/templates.ts";

const box = (cx: number, cy: number, w: number, h: number, rot = 0) => ({ cx, cy, w, h, rot });

test("caixa de uma camada girada 90° troca largura e altura", () => {
  const r = aabb(box(100, 100, 40, 10, 90));
  assert.ok(Math.abs(r.right - r.left - 10) < 1e-9);
  assert.ok(Math.abs(r.bottom - r.top - 40) < 1e-9);
});

test("laço: só pega o que encosta na área", () => {
  const sel = { left: 0, top: 0, right: 50, bottom: 50 };
  assert.ok(intersects(aabb(box(40, 40, 20, 20)), sel));
  assert.ok(!intersects(aabb(box(80, 80, 20, 20)), sel));
  assert.deepEqual(union([aabb(box(10, 10, 10, 10)), aabb(box(50, 60, 20, 20))]), { left: 5, top: 5, right: 60, bottom: 70 });
});

test("alinhar várias à esquerda usa a borda mais à esquerda do grupo", () => {
  const W = 1000;
  const H = 2000;
  const items = [
    { id: "a", x: 0.2, y: 0.5, box: box(200, 1000, 100, 50) }, // borda esquerda 150
    { id: "b", x: 0.6, y: 0.5, box: box(600, 1000, 200, 50) }, // borda esquerda 500
  ];
  const p = alignPatches(items, "left", W, H);
  assert.equal(p.a, undefined); // já está na borda
  assert.ok(Math.abs(p.b.x! - 0.25) < 1e-9); // borda esquerda 500 → 150: anda -350 px = 0.6 - 0.35
});

test("uma camada só alinha ao slide", () => {
  const p = alignPatches([{ id: "a", x: 0.2, y: 0.1, box: box(200, 200, 100, 100) }], "centerX", 1000, 2000);
  assert.ok(Math.abs(p.a.x! - 0.5) < 1e-9);
  assert.equal(p.a.y, undefined);
});

test("distribuir espaça os centros igualmente (precisa de 3)", () => {
  const items = [
    { id: "a", x: 0.1, y: 0.5, box: box(100, 0, 10, 10) },
    { id: "b", x: 0.2, y: 0.5, box: box(200, 0, 10, 10) },
    { id: "c", x: 0.9, y: 0.5, box: box(900, 0, 10, 10) },
  ];
  const p = alignPatches(items, "distributeX", 1000, 1000);
  assert.ok(Math.abs(p.b.x! - 0.5) < 1e-9);
  assert.deepEqual(alignPatches(items.slice(0, 2), "distributeX", 1000, 1000), {});
});

test("fundos radial e aurora sobrevivem à normalização (e tipos desconhecidos viram degradê)", () => {
  const p = emptyProject("X", { phone: defaultDesign("phone"), tablet: defaultDesign("tablet"), feature: defaultDesign("feature") });
  p.design.phone.slides[0].bg = { type: "aurora", a: "#000000", b: "#ff0000", c: "#00ff00", angle: 180 };
  p.design.phone.slides[1].bg = { type: "radial", a: "#ffffff", b: "#000000", angle: 180 };
  (p.design.phone.slides[2].bg as { type: string }).type = "xadrez";
  const n = normalizeProject(JSON.parse(JSON.stringify(p)), defaultDesign);
  assert.deepEqual(n.design.phone.slides[0].bg, { type: "aurora", a: "#000000", b: "#ff0000", c: "#00ff00", angle: 180 });
  assert.equal(n.design.phone.slides[1].bg.type, "radial");
  assert.equal(n.design.phone.slides[2].bg.type, "gradient");
});
