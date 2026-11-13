import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  cloneSlide,
  emptyProject,
  exportSizeOf,
  fromDesktopJson,
  imageIds,
  INITIAL_ADJUST,
  missingShots,
  normalizeProject,
  presetById,
  readyPresets,
  type DeviceLayer,
  type ImageLayer,
  type Project,
} from "../src/lib/models.ts";
import { defaultDesign, TEMPLATES, templatesFor } from "../src/lib/templates.ts";

const fresh = () => emptyProject("Meu App", { phone: defaultDesign("phone"), tablet: defaultDesign("tablet"), feature: defaultDesign("feature") });

test("projeto v1 (layout fixo) vira slides com camadas sem perder conteúdo", () => {
  const v1 = {
    id: "p1",
    name: "Meu App",
    bgTop: "#ffffff",
    bgBottom: "#dde6f5",
    logo: "img_logo",
    icon: "img_icon",
    badge: null,
    shots: { phone: ["a", "b", "c"], tablet: [null, null, null] },
    layouts: { phone: { deviceScale: 0.7, deviceTop: 0.1, deviceCut: 0.2, logo: { cx: 0.4, cy: 0.9, size: 0.05 } } },
    iconBgEnabled: true,
    presets: ["iphone69", "ipad13"],
  };
  const p = normalizeProject(v1, defaultDesign, (id) => (id === "img_logo" ? 2 : null));
  assert.equal(p.version, 2);
  assert.equal(p.id, "p1");
  assert.deepEqual(p.shots.phone, ["a", "b", "c"]);
  const slides = p.design.phone.slides;
  assert.equal(slides.length, 4);
  const dev = slides[0].layers.find((l) => l.type === "device") as DeviceLayer;
  assert.equal(dev.w, 0.7);
  assert.equal(dev.cut, 0.2);
  assert.deepEqual(dev.shot, { kind: "phone", index: 0 });
  assert.equal(slides[0].bg.b, "#dde6f5");
  const logo = slides[0].layers.find((l) => l.type === "image") as ImageLayer;
  assert.equal(logo.imageId, "img_logo");
  assert.equal(logo.x, 0.4);
  // Ícone e selo no último slide.
  const last = slides[3].layers;
  assert.ok(last.some((l) => l.type === "image" && l.imageId === "img_icon" && l.style === "icon"));
  assert.ok(last.some((l) => l.type === "badge"));
  // Recurso gráfico ganha o modelo padrão e o tamanho da Play Store é marcado.
  assert.ok(p.design.feature.slides.length >= 1);
  assert.ok(p.presets.includes("playfeature"));
  assert.ok(imageIds(p).includes("img_logo") && imageIds(p).includes("img_icon"));
});

test("projeto do app desktop (Flutter) é importado como v2", () => {
  const p = fromDesktopJson(
    {
      layoutV: 4,
      name: "Meu App",
      bgTop: 0xffffffff,
      bgBottom: 0xffe6ecf5,
      phoneShots: ["C:\\x\\files\\phone_1_1.png", null, null],
      layouts: { phone: { deviceScale: 0.75 } },
    },
    (path) => (path?.endsWith("phone_1_1.png") ? "img_a" : null),
    defaultDesign,
    () => null,
  );
  assert.equal(p.version, 2);
  assert.deepEqual(p.shots.phone, ["img_a", null, null]);
  assert.equal((p.design.phone.slides[0].layers[0] as DeviceLayer).w, 0.75);
  assert.deepEqual(p.adjust.phone[0], INITIAL_ADJUST);
});

test("normalizeProject v2 completa campos e descarta camadas inválidas", () => {
  const base = fresh();
  const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown> & Project;
  raw.design.phone.slides[0].layers.push({ type: "desconhecido" } as never);
  (raw.design.phone.slides[0].layers[0] as unknown as Record<string, unknown>).opacity = 9;
  raw.presets = ["iphone69", "nao-existe"];
  const p = normalizeProject(raw, defaultDesign);
  assert.equal(p.design.phone.slides[0].layers.length, base.design.phone.slides[0].layers.length);
  assert.equal(p.design.phone.slides[0].layers[0].opacity, 1);
  assert.deepEqual(p.presets, ["iphone69"]);
});

test("todos os modelos geram slides válidos (e ids únicos)", () => {
  for (const c of CATEGORIES) {
    assert.ok(templatesFor(c).length >= 3, `poucos modelos para ${c}`);
    for (const t of templatesFor(c)) {
      const d = t.build(c);
      assert.ok(d.slides.length >= 1);
      const ids = d.slides.flatMap((s) => s.layers.map((l) => l.id));
      assert.equal(new Set(ids).size, ids.length, `${t.id}: ids repetidos`);
      for (const s of d.slides)
        for (const l of s.layers) {
          assert.ok(Number.isFinite(l.x) && Number.isFinite(l.y) && l.w > 0, `${t.id}: camada inválida`);
          if (l.type === "device") assert.equal(l.shot.kind, c === "tablet" ? "tablet" : "phone");
        }
    }
  }
  assert.ok(TEMPLATES.some((t) => t.id === "feature-icon-devices"));
});

test("prontos para exportar = tamanhos marcados com todos os prints usados", () => {
  const p = fresh();
  assert.equal(readyPresets(p).length, 0);
  assert.ok(missingShots(p, "phone").length > 0);
  const filled: Project = { ...p, shots: { phone: ["a", "b", "c"], tablet: ["d", "e", "f"] } };
  const ids = readyPresets(filled).map((x) => x.id);
  assert.deepEqual(ids.sort(), ["ipad13", "iphone69", "playfeature"].sort());
});

test("tamanho de exportação escolhido (ou o padrão)", () => {
  const p = fresh();
  const pre = presetById("iphone69")!;
  assert.deepEqual(exportSizeOf(p, pre), { w: 1320, h: 2868 });
  assert.deepEqual(exportSizeOf({ ...p, exportSizes: { iphone69: { w: 1290, h: 2796 } } }, pre), { w: 1290, h: 2796 });
});

test("duplicar slide gera ids novos e mantém o conteúdo", () => {
  const s = fresh().design.phone.slides[0];
  const c = cloneSlide(s);
  assert.notEqual(c.id, s.id);
  assert.equal(c.layers.length, s.layers.length);
  assert.ok(c.layers.every((l, i) => l.id !== s.layers[i].id && l.type === s.layers[i].type));
});
