"use client";
/**
 * useCloudStore — Cloud-first veri hook'u
 *
 * Kural:
 *   - Supabase = tek gerçek kaynak
 *   - localStorage = anlık görüntü cache'i (sadece)
 *   - API boş dönerse → state boş (localStorage'a bakılmaz)
 *   - Kullanıcı değişiklik yaparsa → API'nin üzerine yazması engellenir
 */

import { useEffect, useRef, useState, useCallback } from "react";

type Endpoint =
  | { type: "store"; key: string }
  | { type: "csp"; slug: string };

interface Options<T> {
  endpoint: Endpoint;
  cacheKey: string;        // localStorage cache anahtarı
  defaultValue: T;
}

function buildUrl(ep: Endpoint): string {
  if (ep.type === "store") return `/api/store/${ep.key}`;
  return `/api/csp-watchlist/${ep.slug}`;
}

function extractValue<T>(ep: Endpoint, json: Record<string, unknown>): T {
  if (ep.type === "store") return (json.value ?? null) as T;
  // CSP endpoint: { tickers, types, notes }
  return json as unknown as T;
}

function buildBody<T>(ep: Endpoint, value: T): string {
  if (ep.type === "store") return JSON.stringify({ value });
  return JSON.stringify(value);
}

export function useCloudStore<T>(opts: Options<T>) {
  const { endpoint, cacheKey, defaultValue } = opts;
  const [data, setData] = useState<T>(defaultValue);
  const [ready, setReady] = useState(false);
  const userModified = useRef(false);
  const latestData = useRef<T>(defaultValue);

  /* ── Mount: cache göster → API çek ─────────────────────────────── */
  useEffect(() => {
    userModified.current = false;

    // 1. Cache'den anlık göster
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as T;
        latestData.current = cached;
        setData(cached);
      }
    } catch {}

    // 2. API'den taze veri
    fetch(buildUrl(endpoint))
      .then((r) => r.json())
      .then((json) => {
        if (userModified.current) return; // kullanıcı değiştirdiyse dokunma
        const fresh = extractValue<T>(endpoint, json);
        latestData.current = fresh;
        setData(fresh);
        // Cache güncelle
        try { localStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch {}
      })
      .catch(() => {}) // cache zaten gösteriliyor
      .finally(() => setReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  /* ── Save: kullanıcı değişikliği ────────────────────────────────── */
  const save = useCallback((value: T) => {
    userModified.current = true;
    latestData.current = value;
    setData(value);
    try { localStorage.setItem(cacheKey, JSON.stringify(value)); } catch {}

    // Sync to cloud and clear userModified flag on success
    fetch(buildUrl(endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buildBody(endpoint, value),
    })
      .then((r) => {
        if (r.ok) {
          userModified.current = false;
          console.log(`[useCloudStore] Successfully saved to cloud`);
        } else {
          console.error(`[useCloudStore] Save failed with status ${r.status}`);
        }
      })
      .catch((err) => {
        console.error(`[useCloudStore] Save error:`, err);
      });
  }, [cacheKey, endpoint]);

  return { data, save, ready, latestData };
}
