"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { frameBank } from "./frames";
import { imageBank } from "./images";

/** Muda sempre que uma imagem termina de carregar (para redesenhar). */
export const useImageVersion = () => useSyncExternalStore(imageBank.subscribe, imageBank.version, () => 0);

let frameVersion = 0;
const frameSub = (l: () => void) =>
  frameBank.subscribe(() => {
    frameVersion++;
    l();
  });
export const useFrameVersion = () => useSyncExternalStore(frameSub, () => frameVersion, () => 0);

/** URL de miniatura de uma imagem guardada. */
export function useImageUrl(id: string | null | undefined) {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    void imageBank.url(id).then((url) => alive && setState({ id, url }));
    return () => {
      alive = false;
    };
  }, [id]);
  return id && state?.id === id ? state.url : null;
}
