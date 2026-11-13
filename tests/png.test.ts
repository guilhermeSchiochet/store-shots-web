import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { encodePngRgb, filterRows } from "../src/lib/png.ts";

/** Desfaz os filtros PNG (para conferir que a codificação é reversível). */
function unfilter(data: Uint8Array, w: number, h: number) {
  const stride = w * 3;
  const out = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = data[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = data[y * (stride + 1) + 1 + i];
      const a = i >= 3 ? out[y * stride + i - 3] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= 3 && y > 0 ? out[(y - 1) * stride + i - 3] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * stride + i] = (x + pred) & 255;
    }
  }
  return out;
}

const W = 37, H = 23;
const rgba = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = (i * 7) % 256;
  rgba[i * 4 + 1] = (i * 13 + 40) % 256;
  rgba[i * 4 + 2] = i % 3 === 0 ? 200 : 20;
  rgba[i * 4 + 3] = 255;
}

test("filtros PNG são reversíveis (pixel a pixel)", () => {
  const back = unfilter(filterRows(rgba, W, H), W, H);
  for (let i = 0; i < W * H; i++) {
    assert.equal(back[i * 3], rgba[i * 4]);
    assert.equal(back[i * 3 + 1], rgba[i * 4 + 1]);
    assert.equal(back[i * 3 + 2], rgba[i * 4 + 2]);
  }
});

test("PNG gerado é RGB 8 bits SEM canal alfa e decodifica certo", async () => {
  const buf = new Uint8Array(await (await encodePngRgb(rgba, W, H)).arrayBuffer());
  assert.deepEqual([...buf.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const v = new DataView(buf.buffer);
  assert.equal(String.fromCharCode(...buf.slice(12, 16)), "IHDR");
  assert.equal(v.getUint32(16), W);
  assert.equal(v.getUint32(20), H);
  assert.equal(buf[24], 8); // bits
  assert.equal(buf[25], 2); // tipo de cor 2 = RGB (sem alfa)
  // IDAT começa logo após o IHDR (8 + 25 bytes)
  const len = v.getUint32(33);
  assert.equal(String.fromCharCode(...buf.slice(37, 41)), "IDAT");
  const raw = inflateSync(buf.slice(41, 41 + len));
  const back = unfilter(new Uint8Array(raw), W, H);
  assert.equal(back[5 * 3 + 1], rgba[5 * 4 + 1]);
  assert.equal(back.length, W * H * 3);
});
