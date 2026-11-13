// Codificador PNG RGB (24 bits, SEM canal alfa).
//
// O Canvas só exporta PNG RGBA. A App Store Connect recusa capturas com canal
// alfa ("can't contain alpha channels or transparencies") e a Play Store exige
// recurso gráfico em JPEG ou PNG 24 bits. Aqui montamos o PNG à mão: filtro
// adaptativo por linha (None/Sub/Up/Paeth) + deflate nativo do navegador.

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Linhas filtradas (1 byte de filtro + RGB), escolhendo o filtro de menor soma. */
export function filterRows(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const stride = w * 3;
  const out = new Uint8Array((stride + 1) * h);
  let prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  const cand = [new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride)];
  for (let y = 0; y < h; y++) {
    for (let x = 0, i = y * w * 4; x < w; x++, i += 4) {
      cur[x * 3] = rgba[i];
      cur[x * 3 + 1] = rgba[i + 1];
      cur[x * 3 + 2] = rgba[i + 2];
    }
    const sums = [0, 0, 0, 0];
    const [c0, c1, c2, c3] = cand;
    const mag = (v: number) => (v < 128 ? v : 256 - v);
    for (let i = 0; i < stride; i++) {
      const x = cur[i];
      const a = i >= 3 ? cur[i - 3] : 0;
      const b = prev[i];
      const c = i >= 3 ? prev[i - 3] : 0;
      const v1 = (x - a) & 255;
      const v2 = (x - b) & 255;
      const v3 = (x - paeth(a, b, c)) & 255;
      c0[i] = x;
      c1[i] = v1;
      c2[i] = v2;
      c3[i] = v3;
      sums[0] += mag(x);
      sums[1] += mag(v1);
      sums[2] += mag(v2);
      sums[3] += mag(v3);
    }
    let best = 0;
    for (let f = 1; f < 4; f++) if (sums[f] < sums[best]) best = f;
    const o = y * (stride + 1);
    out[o] = [0, 1, 2, 4][best]; // códigos PNG: None, Sub, Up, Paeth
    out.set(cand[best], o + 1);
    prev = cur.slice();
  }
  return out;
}

export async function encodePngRgb(rgba: Uint8ClampedArray, w: number, h: number): Promise<Blob> {
  const raw = filterRows(rgba, w, h);
  const z = new Uint8Array(
    await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer(),
  );
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB, sem alfa
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Blob([sig, chunk("IHDR", ihdr), chunk("IDAT", z), chunk("IEND", new Uint8Array())] as BlobPart[], {
    type: "image/png",
  });
}
