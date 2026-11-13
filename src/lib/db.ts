// Persistência local no navegador (IndexedDB): projetos (JSON) e imagens (Blob).
// Nada sai da máquina do usuário.
import type { Project } from "./models";

const DB_NAME = "store-shots";
const VERSION = 1;

export interface StoredImage {
  id: string;
  blob: Blob;
  name: string;
  width: number;
  height: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const db = {
  allProjects: () => run<Project[]>("projects", "readonly", (s) => s.getAll() as IDBRequest<Project[]>),
  putProject: (p: Project) => run("projects", "readwrite", (s) => s.put(p)),
  deleteProject: (id: string) => run("projects", "readwrite", (s) => s.delete(id)),
  imageKeys: () => run<IDBValidKey[]>("images", "readonly", (s) => s.getAllKeys()).then((k) => k.map(String)),
  getImage: (id: string) => run<StoredImage | undefined>("images", "readonly", (s) => s.get(id)),
  putImage: (img: StoredImage) => run("images", "readwrite", (s) => s.put(img)),
  deleteImage: (id: string) => run("images", "readwrite", (s) => s.delete(id)),
};
