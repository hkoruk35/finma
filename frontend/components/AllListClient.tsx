"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MARKET_THEMES } from "@/lib/themeData";

interface TickerData {
  ticker: string;
  company: string;
  sector: string;
  price: { current: number; change_pct: number };
}

const ITEMS_PER_PAGE = 50;

export default function AllListClient() {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"ticker" | "price" | "change" | "sector">("ticker");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [tickerData, setTickerData] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(false);

  // Extract all unique tickers from MARKET_THEMES
  const allTickers = Array.from(
    new Set(MARKET_THEMES.flatMap((t) => t.tickers))
  ).sort();

  // Fetch ticker data
  useEffect(() => {
    if (allTickers.length === 0) return;
    setLoading(true);

    // Fetch in batches (API might have limits)
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < allTickers.length; i += batchSize) {
      batches.push(allTickers.slice(i, i + batchSize).join(","));
    }

    Promise.all(
      batches.map((batch) =>
        fetch(`/api/watchlist-data?tickers=${batch}`)
          .then((r) => r.json())
          .catch(() => [])
      )
    )
      .then((results) => {
        const map: Record<string, TickerData> = {};
        results.flat().forEach((item: TickerData) => {
          if (item?.ticker) map[item.ticker] = item;
        });
        setTickerData(map);
      })
      .finally(() => setLoading(false));
  }, []);

  // Sort tickers
  const sortedTickers = [...allTickers].sort((a, b) => {
    const dataA = tickerData[a];
    const dataB = tickerData[b];
    let valA: any, valB: any;

    switch (sortBy) {
      case "ticker":
        valA = a;
        valB = b;
        break;
      case "price":
        valA = dataA?.price?.current ?? 0;
        valB = dataB?.price?.current ?? 0;
        break;
      case "change":
        valA = dataA?.price?.change_pct ?? 0;
        valB = dataB?.price?.change_pct ?? 0;
        break;
      case "sector":
        valA = dataA?.sector ?? "";
        valB = dataB?.sector ?? "";
        break;
      default:
        return 0;
    }

    if (typeof valA === "string") {
      const cmp = valA.localeCompare(valB);
      return sortDir === "asc" ? cmp : -cmp;
    }
    const diff = valA - valB;
    return sortDir === "asc" ? diff : -diff;
  });

  // Paginate
  const totalPages = Math.ceil(sortedTickers.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = sortedTickers.slice(start, end);

  const toggleSort = (col: "ticker" | "price" | "change" | "sector") => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const getSortIndicator = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full animate-pulse bg-[#e3b341]" />
          <h1 className="text-xl font-black uppercase tracking-tight text-[#e3b341]">
            ALL LIST - Tüm Market Themes
          </h1>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Swing Universe (900+)</span>
        </div>
        <p className="text-xs text-slate-400 font-mono">
          {sortedTickers.length} hisse · Sayfa {page}/{totalPages}
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => toggleSort("ticker")}
            className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${
              sortBy === "ticker"
                ? "bg-white/10 border-white/30 text-white"
                : "border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            TICKER{getSortIndicator("ticker")}
          </button>
          <button
            onClick={() => toggleSort("price")}
            className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${
              sortBy === "price"
                ? "bg-white/10 border-white/30 text-white"
                : "border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            FİYAT{getSortIndicator("price")}
          </button>
          <button
            onClick={() => toggleSort("change")}
            className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${
              sortBy === "change"
                ? "bg-white/10 border-white/30 text-white"
                : "border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            DEĞ.%{getSortIndicator("change")}
          </button>
          <button
            onClick={() => toggleSort("sector")}
            className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${
              sortBy === "sector"
                ? "bg-white/10 border-white/30 text-white"
                : "border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            SEKTÖR{getSortIndicator("sector")}
          </button>
        </div>

        {/* Pagination Info */}
        <div className="text-xs text-slate-500 font-mono">
          {pageItems.length > 0 && (
            <>
              {start + 1}–{Math.min(end, sortedTickers.length)} / {sortedTickers.length}
            </>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm animate-pulse">fiyat verileri yükleniyor...</p>
        </div>
      )}

      {/* Stock List */}
      {!loading && pageItems.length > 0 && (
        <div className="space-y-2">
          {pageItems.map((ticker) => {
            const data = tickerData[ticker];
            const price = data?.price?.current ?? 0;
            const change = data?.price?.change_pct ?? 0;

            return (
              <Link
                key={ticker}
                href={`/stock/${ticker}`}
                className="block p-4 border border-[#e3b341]/30 rounded-lg transition-all hover:bg-white/5 hover:border-[#e3b341]/50 bg-[#e3b341]/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="min-w-16">
                      <div className="text-sm font-black text-[#e3b341]">{ticker}</div>
                      <div className="text-xs text-slate-500 truncate max-w-32">
                        {data?.company || "—"}
                      </div>
                    </div>
                    <div className="hidden sm:block text-xs text-slate-400 min-w-24">
                      {data?.sector || "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">${price.toFixed(2)}</div>
                      <div
                        className="text-xs font-mono"
                        style={{
                          color:
                            change >= 1 ? "#3fb950" : change <= -1 ? "#f85149" : "#8b949e",
                        }}
                      >
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-slate-500 text-lg">→</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-bold border border-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-all"
          >
            ← Önceki
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) =>
                p === 1 ||
                p === totalPages ||
                (p >= page - 1 && p <= page + 1)
            )
            .map((p, idx, arr) => (
              <div key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="px-2 text-slate-600">…</span>
                )}
                <button
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
                    page === p
                      ? "bg-[#e3b341]/30 border border-[#e3b341] text-[#e3b341]"
                      : "border border-white/10 text-slate-400 hover:bg-white/5"
                  }`}
                >
                  {p}
                </button>
              </div>
            ))}

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs font-bold border border-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-all"
          >
            Sonraki →
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 text-xs text-slate-500 border-t border-white/10 pt-4">
        <p>
          <strong>{sortedTickers.length}</strong> benzersiz hisse • <strong>{totalPages}</strong> sayfa • Her sayfada <strong>50 hisse</strong>
        </p>
      </div>
    </div>
  );
}
