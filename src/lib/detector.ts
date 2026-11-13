// Detecção das barras do sistema em prints (função pura; roda no Web Worker e nos testes).
//
// Barra de status (topo), igual para Android e iOS:
// 1. Do topo até os ícones, as linhas têm fundo liso (cor dominante ≥ 60%).
//    Foto/degradê atrás → não arrisca (null; o usuário ajusta à mão).
// 2. O primeiro bloco de "tinta" são hora/ícones: baixo (≤ 3,2% da altura),
//    esparso (≤ 40% da largura), com tinta nas DUAS metades (hora de um lado,
//    bateria do outro) e o centro vazio (notch/ilha). Título de app não passa.
// 3. Ícones ficam centralizados na barra → altura = 2 × centro do bloco
//    (Android 24 dp; iPhone com ilha 59 pt).
// 4. Se o fundo muda de cor logo abaixo, corta exatamente na fronteira.
// 5. Nunca passa da primeira linha de conteúdo do app abaixo dos ícones.
//
// Barra de navegação (base): só a pílula de gestos do Android (traço fino,
// centralizado e isolado). Barra de 3 botões e barra de abas do app se parecem
// demais para cortar com segurança.

export interface ShotAnalysis {
  statusBar: number | null; // fração da altura
  navBar: number | null;
  edgeColor: string; // #rrggbb
}

interface Row {
  bg: number;
  bgShare: number;
  ink: number;
  inkMinX: number;
  inkMaxX: number;
  inkLeft: number;
  inkRight: number;
  inkCenter: number;
}

const NEAR = 30;
const INK = 90;
const BOUNDARY = 36;

const dist = (a: number, b: number) =>
  Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) +
  Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) +
  Math.abs((a & 255) - (b & 255));

const binOf = (r: number, g: number, b: number) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);

function rowStats(px: Uint8ClampedArray | Uint8Array, w: number, y: number, hist: Int32Array): Row {
  hist.fill(0);
  const base = y * w * 4;
  let best = 0;
  for (let x = 0; x < w; x++) {
    const i = base + x * 4;
    const bin = binOf(px[i], px[i + 1], px[i + 2]);
    if (++hist[bin] > hist[best]) best = bin;
  }
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let x = 0; x < w; x++) {
    const i = base + x * 4;
    if (binOf(px[i], px[i + 1], px[i + 2]) === best) {
      sr += px[i];
      sg += px[i + 1];
      sb += px[i + 2];
      n++;
    }
  }
  const bg = n === 0 ? 0 : (((sr / n) | 0) << 16) | (((sg / n) | 0) << 8) | ((sb / n) | 0);
  let near = 0, ink = 0, minX = w, maxX = -1, left = 0, right = 0, center = 0;
  const c0 = Math.floor(w * 0.42), c1 = Math.ceil(w * 0.58), half = w >> 1;
  for (let x = 0; x < w; x++) {
    const i = base + x * 4;
    const d = dist((px[i] << 16) | (px[i + 1] << 8) | px[i + 2], bg);
    if (d <= NEAR) near++;
    if (d > INK) {
      ink++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (x < half) left++;
      else right++;
      if (x >= c0 && x < c1) center++;
    }
  }
  return { bg, bgShare: near / w, ink, inkMinX: minX, inkMaxX: maxX, inkLeft: left, inkRight: right, inkCenter: center };
}

function detectTop(rows: Row[], w: number, h: number): number | null {
  if (rows.length < 4) return null;
  const minInk = Math.max(2, Math.round(w * 0.006));
  const inked = (y: number) => rows[y].ink >= minInk;

  let g0 = -1;
  const searchEnd = Math.min(rows.length, Math.ceil(h * 0.05) + 1);
  for (let y = 0; y < searchEnd; y++) {
    if (inked(y)) {
      g0 = y;
      break;
    }
    if (rows[y].bgShare < 0.6) return null;
  }
  if (g0 < 1) return null;

  const maxGap = Math.max(1, Math.round(h * 0.003));
  let g1 = g0;
  let gap = 0;
  for (let y = g0 + 1; y < rows.length; y++) {
    if (inked(y)) {
      g1 = y;
      gap = 0;
    } else if (++gap > maxGap) break;
  }
  const gh = g1 - g0 + 1;
  if (gh < 2 || gh > h * 0.032) return null;

  let inkSum = 0, left = 0, right = 0, center = 0;
  let leftEdge = false, rightEdge = false;
  for (let y = g0; y <= g1; y++) {
    const r = rows[y];
    inkSum += r.ink;
    left += r.inkLeft;
    right += r.inkRight;
    center += r.inkCenter;
    if (r.ink > 0 && r.inkMinX < w * 0.3) leftEdge = true;
    if (r.ink > 0 && r.inkMaxX > w * 0.7) rightEdge = true;
  }
  if (inkSum / (gh * w) > 0.4) return null;
  if (!leftEdge || !rightEdge || left === 0 || right === 0) return null;
  if (center > inkSum * 0.08) return null;

  const sym = g0 + g1 + 1;
  if (sym > h * 0.085) return null;

  const statusBg = rows[g0 - 1].bg;
  const scanEnd = Math.min(rows.length - 1, Math.ceil(sym * 1.5));
  for (let y = g1 + 1; y <= scanEnd; y++) {
    const r = rows[y];
    if (r.bgShare >= 0.5 && dist(r.bg, statusBg) > BOUNDARY) return y / h;
    if (inked(y)) return Math.min(sym, y) / h;
  }
  return sym / h;
}

function detectBottom(rows: Row[], w: number, h: number): number | null {
  // rows[k] = linha h-1-k
  if (rows.length < 4) return null;
  const minInk = Math.max(2, Math.round(w * 0.006));
  const inked = (k: number) => rows[k].ink >= minInk;

  let p1 = -1;
  for (let k = 0; k < rows.length; k++) {
    if (inked(k)) {
      p1 = k;
      break;
    }
    if (rows[k].bgShare < 0.6) return null;
  }
  if (p1 < 1) return null;

  let p0 = p1;
  while (p0 + 1 < rows.length && inked(p0 + 1)) p0++;
  if (p0 - p1 + 1 > Math.max(3, Math.round(h * 0.007))) return null;

  for (let k = p1; k <= p0; k++) {
    const r = rows[k];
    const span = r.inkMaxX - r.inkMinX;
    if (r.inkMinX < w * 0.25 || r.inkMaxX > w * 0.75) return null;
    if (span < w * 0.12 || span > w * 0.5) return null;
  }
  const band = p0 + p1 + 1;
  if (band > h * 0.05 || band >= rows.length) return null;
  for (let k = p0 + 1; k < band; k++) if (inked(k)) return null;
  return band / h;
}

function edgeColor(px: Uint8ClampedArray | Uint8Array, w: number, y0: number, y1: number, hist: Int32Array) {
  hist.fill(0);
  const xs = [...new Set([0, 1, Math.max(0, w - 2), Math.max(0, w - 1)])];
  let best = 0;
  const samples: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (const x of xs) {
      const i = (y * w + x) * 4;
      samples.push((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
      const bin = binOf(px[i], px[i + 1], px[i + 2]);
      if (++hist[bin] > hist[best]) best = bin;
    }
  }
  if (!samples.length) return "#ffffff";
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (const c of samples) {
    if (binOf((c >> 16) & 255, (c >> 8) & 255, c & 255) === best) {
      sr += (c >> 16) & 255;
      sg += (c >> 8) & 255;
      sb += c & 255;
      n++;
    }
  }
  const hex = (v: number) => ((v / n) | 0).toString(16).padStart(2, "0");
  return `#${hex(sr)}${hex(sg)}${hex(sb)}`;
}

export function analyzeShotPixels(px: Uint8ClampedArray | Uint8Array, w: number, h: number): ShotAnalysis {
  const hist = new Int32Array(4096);
  const top: Row[] = [];
  for (let y = 0; y < Math.min(h, Math.ceil(h * 0.12)); y++) top.push(rowStats(px, w, y, hist));
  const bottom: Row[] = [];
  for (let k = 0; k < Math.min(h, Math.ceil(h * 0.07)); k++) bottom.push(rowStats(px, w, h - 1 - k, hist));
  const statusBar = detectTop(top, w, h);
  const navBar = detectBottom(bottom, w, h);
  const y0 = Math.round((statusBar ?? 0) * h);
  const y1 = Math.max(y0 + 1, h - Math.round((navBar ?? 0) * h));
  return { statusBar, navBar, edgeColor: edgeColor(px, w, y0, y1, hist) };
}
