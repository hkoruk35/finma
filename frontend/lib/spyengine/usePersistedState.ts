"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Motor sayfası 60 saniyede bir tam yenileniyor. Panel ve uyarı tercihleri sekme boyunca sessionStorage'da tutulur.
 * İlk render varsayılanla yapılır (hydration uyumu), kayıtlı değer sonraki turda yüklenir.
 */
export function usePersistedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(key);
        if (raw != null) setValue(JSON.parse(raw) as T);
      } catch {
        // depolama yoksa varsayılanla devam edilir
      }
    }, 0);
    return () => clearTimeout(id);
  }, [key]);

  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* depolama yok */ }
      return v;
    });
  }, [key]);

  return [value, set];
}
