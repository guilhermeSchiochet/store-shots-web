// Exportação: desenha cada slide na resolução escolhida (OffscreenCanvas,
// imagens originais) com a MESMA função do preview e entrega um ZIP ou grava
// numa pasta. PNG sai em RGB (sem canal alfa), como as lojas exigem.
import JSZip from "jszip";
import { ensureFonts, textLayersOf } from "./fonts";
import { frameBank } from "./frames";
import { imageBank } from "./images";
import { exportSizeOf, imageIds, readyPresets, type ExportPreset, type Project } from "./models";
import { encodePngRgb } from "./png";
import { renderSlide } from "./render";

export interface ExportStep {
  done: number;
  total: number;
  label: string;
}

const safeName = (s: string) => s.replace(/[<>:"/\\|?*]/g, "_").trim() || "projeto";

export async function renderExport(project: Project, preset: ExportPreset, slideIndex: number): Promise<Blob> {
  const { w, h } = exportSizeOf(project, preset);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  // O design é em px da largura de referência; escala para o tamanho escolhido
  // mantendo frações (posições/tamanhos relativos ao slide).
  renderSlide(
    ctx,
    {
      project,
      preset,
      W: w,
      H: h,
      frame: (id) => frameBank.get(id),
      image: (id) => (id ? imageBank.peek(id, "full") : undefined),
      aspect: (id) => {
        const s = imageBank.size(id);
        return s ? s.w / s.h : null;
      },
      preview: false,
    },
    project.design[preset.category].slides[slideIndex],
    new OffscreenCanvas(1, 1),
  );
  if (project.format === "jpeg") return canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 });
  return encodePngRgb(ctx.getImageData(0, 0, w, h).data, w, h);
}

/** Gera todas as imagens. Retorna arquivos `<pasta do tamanho>/N.ext` e o que foi pulado. */
export async function buildExport(project: Project, onStep: (s: ExportStep) => void) {
  await frameBank.loadAll();
  await ensureFonts(textLayersOf(project));
  await Promise.all(imageIds(project).map((id) => imageBank.load(id, "full")));
  const presets = readyPresets(project);
  const skipped = project.presets.filter((id) => !presets.some((p) => p.id === id));
  const ext = project.format === "jpeg" ? "jpg" : "png";
  const total = presets.reduce((n, p) => n + project.design[p.category].slides.length, 0);
  const files: { path: string; blob: Blob }[] = [];
  let done = 0;
  for (const pre of presets) {
    const slides = project.design[pre.category].slides;
    for (let i = 0; i < slides.length; i++) {
      onStep({ done, total, label: pre.label });
      await new Promise((r) => setTimeout(r, 0)); // deixa o progresso animar
      files.push({ path: `${pre.folder}/${i + 1}.${ext}`, blob: await renderExport(project, pre, i) });
      done++;
    }
  }
  onStep({ done, total, label: "Concluído" });
  return { files, skipped, root: safeName(project.name) };
}

export async function downloadZip(root: string, files: { path: string; blob: Blob }[]) {
  const zip = new JSZip();
  for (const f of files) zip.file(`${root}/${f.path}`, f.blob);
  triggerDownload(await zip.generateAsync({ type: "blob" }), `${root}.zip`);
}

type DirHandle = {
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<WritableStreamLike> }>;
};
type WritableStreamLike = { write(b: Blob): Promise<void>; close(): Promise<void> };

export const canSaveToFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/** Pede a pasta ANTES de gerar (o navegador exige o clique do usuário). */
export async function pickFolder(): Promise<DirHandle | null> {
  try {
    const w = window as unknown as { showDirectoryPicker(o?: object): Promise<DirHandle> };
    return await w.showDirectoryPicker({ mode: "readwrite", id: "store-shots-export" });
  } catch {
    return null;
  }
}

export async function writeToFolder(dir: DirHandle, root: string, files: { path: string; blob: Blob }[]) {
  const base = await dir.getDirectoryHandle(root, { create: true });
  for (const f of files) {
    const [folder, name] = f.path.split("/");
    const sub = await base.getDirectoryHandle(folder, { create: true });
    const w = await (await sub.getFileHandle(name, { create: true })).createWritable();
    await w.write(f.blob);
    await w.close();
  }
}

export function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
