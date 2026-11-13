// Banco de imagens em memória: blobs (IndexedDB) → ImageBitmap decodificado,
// em duas resoluções — "preview" (reduzida, desenho rápido na tela) e "full"
// (original, usada na exportação). Componentes assinam para redesenhar quando
// uma imagem fica pronta.
import { db, type StoredImage } from "./db";
import type { Size } from "./geometry";

export type Variant = "preview" | "full";
const PREVIEW_MAX = 1600; // lado maior da versão de preview

const meta = new Map<string, Size>();
const bitmaps = new Map<string, ImageBitmap>();
const pending = new Map<string, Promise<ImageBitmap | null>>();
const urls = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

export const imageBank = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  version: () => version,

  /** Guarda um arquivo e devolve o id. Mede antes, para o preview já saber a proporção. */
  async put(blob: Blob, name: string): Promise<string> {
    const bmp = await createImageBitmap(blob);
    const id = `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const size = { w: bmp.width, h: bmp.height };
    bmp.close();
    await db.putImage({ id, blob, name, width: size.w, height: size.h });
    meta.set(id, size);
    return id;
  },

  async remove(id: string | null | undefined) {
    if (!id) return;
    for (const v of ["preview", "full"] as Variant[]) {
      bitmaps.get(`${id}@${v}`)?.close();
      bitmaps.delete(`${id}@${v}`);
    }
    const u = urls.get(id);
    if (u) URL.revokeObjectURL(u);
    urls.delete(id);
    meta.delete(id);
    await db.deleteImage(id).catch(() => {});
  },

  async record(id: string): Promise<StoredImage | undefined> {
    return db.getImage(id);
  },

  /** Tamanho original em px (síncrono; null enquanto não carregou). */
  size(id: string | null | undefined): Size | null {
    if (!id) return null;
    const s = meta.get(id);
    if (!s) void this.load(id, "preview");
    return s ?? null;
  },

  /** Bitmap já pronto (síncrono), ou undefined — nesse caso dispara o carregamento. */
  peek(id: string | null | undefined, v: Variant): ImageBitmap | undefined {
    if (!id) return undefined;
    const b = bitmaps.get(`${id}@${v}`);
    if (!b) void this.load(id, v);
    return b;
  },

  load(id: string, v: Variant): Promise<ImageBitmap | null> {
    const key = `${id}@${v}`;
    const have = bitmaps.get(key);
    if (have) return Promise.resolve(have);
    let p = pending.get(key);
    if (!p) {
      p = (async () => {
        const rec = await db.getImage(id);
        if (!rec) return null;
        meta.set(id, { w: rec.width, h: rec.height });
        const long = Math.max(rec.width, rec.height);
        const bmp =
          v === "preview" && long > PREVIEW_MAX
            ? await createImageBitmap(rec.blob, {
                resizeWidth: Math.round((rec.width * PREVIEW_MAX) / long),
                resizeHeight: Math.round((rec.height * PREVIEW_MAX) / long),
                resizeQuality: "high",
              })
            : await createImageBitmap(rec.blob);
        bitmaps.set(key, bmp);
        pending.delete(key);
        notify();
        return bmp;
      })().catch(() => {
        pending.delete(key);
        return null;
      });
      pending.set(key, p);
    }
    return p;
  },

  /** URL para miniaturas (<img>). */
  async url(id: string): Promise<string | null> {
    const u = urls.get(id);
    if (u) return u;
    const rec = await db.getImage(id);
    if (!rec) return null;
    const url = URL.createObjectURL(rec.blob);
    urls.set(id, url);
    return url;
  },
};
