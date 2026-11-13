// Backup e importação de projetos.
// - Backup do site: ZIP com project.json (formato web) + images/<id>.
// - App desktop (Flutter): a pasta <Documentos>/StoreShots/<projeto> com
//   project.json + files/. Os caminhos antigos são casados pelo nome do arquivo.
import JSZip from "jszip";
import { triggerDownload } from "./export";
import { imageBank } from "./images";
import { fromDesktopJson, imageIds, normalizeProject, uid, type Project } from "./models";
import { defaultDesign } from "./templates";

const FORMAT = "store-shots-web@2";
const aspectOf = (id: string | null) => {
  const s = imageBank.size(id);
  return s ? s.w / s.h : null;
};

export async function downloadBackup(p: Project) {
  const zip = new JSZip();
  const names: Record<string, string> = {};
  for (const id of imageIds(p)) {
    const rec = await imageBank.record(id);
    if (!rec) continue;
    const name = `${id}_${rec.name.replace(/[^\w.-]/g, "_")}`;
    names[id] = name;
    zip.file(`images/${name}`, rec.blob);
  }
  zip.file("project.json", JSON.stringify({ format: FORMAT, project: p, images: names }, null, 2));
  triggerDownload(await zip.generateAsync({ type: "blob" }), `${p.name || "projeto"} (backup).zip`);
}

export async function importBackupZip(file: Blob): Promise<Project> {
  const zip = await JSZip.loadAsync(file);
  const meta = zip.file("project.json");
  if (!meta) throw new Error("O arquivo não tem project.json.");
  const json = JSON.parse(await meta.async("string"));
  if (typeof json.format !== "string" || !json.format.startsWith("store-shots-web")) {
    // ZIP de uma pasta do app desktop
    const files = new Map<string, Blob>();
    await Promise.all(
      Object.values(zip.files)
        .filter((f) => !f.dir && f.name.includes("files/"))
        .map(async (f) => files.set(baseName(f.name), await f.async("blob"))),
    );
    return importDesktop(json, files);
  }
  // Reenvia as imagens com ids novos e troca as referências no projeto inteiro.
  let text = JSON.stringify(json.project);
  for (const [oldId, name] of Object.entries(json.images as Record<string, string>)) {
    const f = zip.file(`images/${name}`);
    if (!f) continue;
    const id = await imageBank.put(await f.async("blob"), name);
    text = text.split(`"${oldId}"`).join(`"${id}"`);
  }
  return { ...normalizeProject(JSON.parse(text), defaultDesign, aspectOf), id: uid("p"), updatedAt: Date.now() };
}

/** Arquivos escolhidos com <input webkitdirectory> (a pasta do projeto desktop). */
export async function importDesktopFolder(list: FileList | File[]): Promise<Project> {
  const all = Array.from(list);
  const meta = all.find((f) => f.name === "project.json");
  if (!meta) throw new Error("Escolha a pasta de um projeto (a que contém project.json).");
  const files = new Map(all.filter((f) => f !== meta).map((f) => [f.name, f as Blob]));
  return importDesktop(JSON.parse(await meta.text()), files);
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;

async function importDesktop(json: Record<string, unknown>, files: Map<string, Blob>): Promise<Project> {
  const ids = new Map<string, string>();
  const paths = [json.logoPath, json.iconPath, json.badgePath, json.phoneShots, json.tabletShots]
    .flat()
    .filter((x): x is string => typeof x === "string");
  for (const path of paths) {
    const name = baseName(path);
    const blob = files.get(name);
    if (blob && !ids.has(name)) ids.set(name, await imageBank.put(blob, name));
  }
  return fromDesktopJson(json, (path) => (path ? (ids.get(baseName(path)) ?? null) : null), defaultDesign, aspectOf);
}
