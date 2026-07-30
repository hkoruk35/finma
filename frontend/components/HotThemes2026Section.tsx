"use client";

import Link from "next/link";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";
import { useEffect, useState } from "react";

const REMOVED_THEMES_KEY = "removed_hot_themes_2026";
const REMOVED_STOCKS_KEY_PREFIX = "removed_stocks_";

type RemovedStocksMap = Record<string, Set<string>>;

export default function HotThemes2026Section() {
  const [removedSlugs, setRemovedSlugs] = useState<Set<string>>(new Set());
  const [removedStocks, setRemovedStocks] = useState<RemovedStocksMap>({});
  const [mounted, setMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const visibleThemes = HOT_THEMES_2026.filter((t) => !removedSlugs.has(t.slug));
  const totalStocks = new Set(
    visibleThemes.flatMap((t) =>
      t.stocks
        .filter((s) => !(removedStocks[t.slug]?.has(s.ticker)))
        .map((s) => s.ticker)
    )
  ).size;

  const syncRemovalsToAPI = async (slugs: Set<string>, stocks: RemovedStocksMap, showAlert = false) => {
    setIsSyncing(true);
    const payload = {
      removedSlugs: Array.from(slugs),
      removedStocks: Object.fromEntries(
        Object.entries(stocks).map(([k, v]) => [k, Array.from(v)])
      )
    };
    try {
      await fetch("/api/store/hot_themes_removals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: payload }),
      });
      if (showAlert) alert("Tüm listeler (çıkarılanlar) başarıyla güncellendi ve senkronize edildi!");
    } catch (e) {
      console.error("Failed to sync removals:", e);
      if (showAlert) alert("Senkronizasyon hatası: " + e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // 1. Load from localStorage for immediate render
    let initialSlugs = new Set<string>();
    let initialStocks: RemovedStocksMap = {};
    
    try {
      const stored = localStorage.getItem(REMOVED_THEMES_KEY);
      if (stored) initialSlugs = new Set(JSON.parse(stored));
    } catch {}

    HOT_THEMES_2026.forEach((theme) => {
      try {
        const key = REMOVED_STOCKS_KEY_PREFIX + theme.slug;
        const stored = localStorage.getItem(key);
        if (stored) initialStocks[theme.slug] = new Set(JSON.parse(stored));
        else initialStocks[theme.slug] = new Set();
      } catch {
        initialStocks[theme.slug] = new Set();
      }
    });
    setRemovedSlugs(initialSlugs);
    setRemovedStocks(initialStocks);
    setMounted(true);

    // 2. Fetch from API to get the true global state
    fetch("/api/store/hot_themes_removals")
      .then(res => res.json())
      .then(data => {
        if (data && data.value) {
          const apiSlugs = new Set<string>(data.value.removedSlugs || []);
          const apiStocks: RemovedStocksMap = {};
          HOT_THEMES_2026.forEach(t => {
            apiStocks[t.slug] = new Set<string>((data.value.removedStocks || {})[t.slug] || []);
          });
          setRemovedSlugs(apiSlugs);
          setRemovedStocks(apiStocks);
          
          // Update localStorage to match API
          try {
            localStorage.setItem(REMOVED_THEMES_KEY, JSON.stringify(Array.from(apiSlugs)));
            HOT_THEMES_2026.forEach(t => {
              localStorage.setItem(REMOVED_STOCKS_KEY_PREFIX + t.slug, JSON.stringify(Array.from(apiStocks[t.slug])));
            });
          } catch {}
        }
      })
      .catch(err => console.error("Failed to fetch removals API", err));
  }, []);

  const removeTheme = (slug: string) => {
    if (!confirm("Bu temayı listeden kaldırmak istediğinizden emin misiniz?")) return;
    const newRemoved = new Set(removedSlugs);
    newRemoved.add(slug);
    setRemovedSlugs(newRemoved);
    syncRemovalsToAPI(newRemoved, removedStocks);
    try {
      localStorage.setItem(REMOVED_THEMES_KEY, JSON.stringify(Array.from(newRemoved)));
    } catch {
      // localStorage error
    }
  };

  const removeStock = (slug: string, ticker: string) => {
    const newRemoved = { ...removedStocks };
    if (!newRemoved[slug]) newRemoved[slug] = new Set();
    newRemoved[slug].add(ticker);
    setRemovedStocks(newRemoved);
    syncRemovalsToAPI(removedSlugs, newRemoved);
    try {
      const key = REMOVED_STOCKS_KEY_PREFIX + slug;
      localStorage.setItem(key, JSON.stringify(Array.from(newRemoved[slug])));
    } catch {
      // localStorage error
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <span className="text-[10px] text-white/40 uppercase tracking-wide">
          {HOT_THEMES_2026.length} tema · {totalStocks} hisse · CES 2026 / Pentagon bütçesi / CHIPS Act katalizörleri
        </span>
        <button
          onClick={() => syncRemovalsToAPI(removedSlugs, removedStocks, true)}
          disabled={isSyncing}
          className="text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 transition-all disabled:opacity-50"
        >
          {isSyncing ? "GÜNCELLENİYOR..." : "GÜNCELLE & SENKRONİZE ET"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleThemes.map((theme) => (
          <Link
            key={theme.slug}
            href={`/csp/${theme.slug}`}
            className="group border rounded-xl p-4 transition-all hover:border-opacity-60 flex flex-col"
            style={{ borderColor: `${theme.accent}25`, background: `${theme.accent}06` }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-medium tabular-nums" style={{ color: theme.accent }}>
                  {String(theme.number).padStart(2, "0")}
                </span>
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-white leading-snug">
                  {theme.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full border"
                  style={{ borderColor: theme.accent, color: theme.accent }}
                >
                  {theme.stocks.length}
                </span>
                {mounted && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeTheme(theme.slug);
                    }}
                    className="shrink-0 text-[8px] font-medium px-1.5 py-0.5 rounded bg-red-950/30 border border-red-700/40 text-red-400 hover:bg-red-950/50 transition-colors"
                  >
                    KALDIR
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mt-auto mb-3">
              {theme.stocks
                .filter((s) => !(removedStocks[theme.slug]?.has(s.ticker)))
                .map((s) => (
                  <span
                    key={s.ticker}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/30 text-slate-300 group relative cursor-pointer hover:bg-black/50 transition-colors"
                  >
                    {s.ticker}
                    {mounted && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          removeStock(theme.slug, s.ticker);
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[7px] text-white font-medium flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Kaldır"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
            </div>

            <span
              className="text-[10px] font-medium uppercase tracking-wider group-hover:underline"
              style={{ color: theme.accent }}
            >
              Takip Sayfasını Aç →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
