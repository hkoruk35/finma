"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Evrensel cross-device store hook
// localStorage = anlık UI (cache), Supabase = gerçek kayıt

export function useSharedStore<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, boolean] {
  const [data, setData] = useState<T>(defaultValue);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount: önce localStorage'dan yükle, sonra API'den taze veriyi al
  useEffect(() => {
    // 1. localStorage'dan anlık yükle
    try {
      const raw = localStorage.getItem(`shared_${key}`);
      if (raw) setData(JSON.parse(raw));
    } catch {}

    // 2. API'den taze veriyi al
    fetch(`/api/store/${key}`)
      .then((r) => r.json())
      .then(({ value }) => {
        if (value !== null && value !== undefined) {
          setData(value as T);
          try { localStorage.setItem(`shared_${key}`, JSON.stringify(value)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [key]);

  // Kaydet: localStorage'a anında, API'ye debounced (500ms)
  const save = useCallback(
    (value: T) => {
      setData(value);
      try { localStorage.setItem(`shared_${key}`, JSON.stringify(value)); } catch {}
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`/api/store/${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        }).catch(() => {});
      }, 500);
    },
    [key]
  );

  return [data, save, ready];
}
