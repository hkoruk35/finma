"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCloudStore } from "@/hooks/useCloudStore";

interface CspData {
  tickers: string[];
  types: Record<string, string>;
  notes: Record<string, string>;
}

interface TickerData {
  ticker: string;
  company: string;
  sector: string;
  price: { current: number; change_pct: number };
}

interface Props {
  slug: "525" | "2550" | "50250";
}

const CSP_CFG = {
  "525": {
    label: "525 CSP",
    range: "$5–$25",
    color: "#10b981",
    borderColor: "border-[#10b981]/30",
    textColor: "text-[#10b981]",
    bgColor: "bg-[#10b981]/5",
  },
  "2550": {
    label: "2550 CSP",
    range: "$25–$50",
    color: "#3b82f6",
    borderColor: "border-[#3b82f6]/30",
    textColor: "text-[#3b82f6]",
    bgColor: "bg-[#3b82f6]/5",
  },
  "50250": {
    label: "50250 CSP",
    range: "$50–$250",
    color: "#a78bfa",
    borderColor: "border-[#a78bfa]/30",
    textColor: "text-[#a78bfa]",
    bgColor: "bg-[#a78bfa]/5",
  },
};

const ITEMS_PER_PAGE = 50;

export default function CSPListClient({ slug }: Props) {
  const cfg = CSP_CFG[slug];
  const { data: cspData, ready } = useCloudStore<CspData>({
    endpoint: { type: "csp", slug },
    cacheKey: `csp_${slug}`,
    defaultValue: { tickers: [], types: {}, notes: {} },
  });

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"ticker" | "price" | "change">("ticker");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [tickerData, setTickerData] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(false);

  const tickers = cspData.tickers || [];

  // Fetch ticker data
  useEffect(() => {
    if (tickers.length === 0) return;
    setLoading(true);
    fetch(`/api/watchlist-data?tickers=${tickers.join(",")}`)
      .then((r) => r.json())
      .then((data: TickerData[]) => {
        const map: Record<string, TickerData> = {};
        data.forEach((item) => {
          if (item?.ticker) map[item.ticker] = item;
        });
        setTickerData(map);
      })
      .catch(() => setTickerData({}))
      .finally(() => setLoading(false));
  }, [tickers]);

  // Sort tickers
  const sortedTickers = [...tickers].sort((a, b) => {
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

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05080f]">
        <span className="text-[#3b82f6] animate-pulse font-mono">yükleniyor...</span>
      </div>
    );
  }

  const toggleSort = (col: "ticker" | "price" | "change") => {
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
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: cfg.color }}
          />
          <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: cfg.color }}>
            {cfg.label}
          </h1>
          <span className="text-xs text-slate-500 uppercase tracking-wider">{cfg.range}</span>
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

      {/* Stock List */}
      {pageItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-600 text-sm mb-2">Bu listeye henüz hisse eklenmedi</p>
          <Link
            href="/theme"
            className={`inline-block text-xs font-bold px-3 py-1.5 border rounded transition-all ${cfg.borderColor} ${cfg.textColor} hover:bg-white/5`}
          >
            ALL LIST sekmesinden ekle →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {pageItems.map((ticker) => {
            const data = tickerData[ticker];
            const price = data?.price?.current ?? 0;
            const change = data?.price?.change_pct ?? 0;

            return (
              <Link
                key={ticker}
                href={`/stock/${ticker}`}
                className={`block p-4 border rounded-lg transition-all ${cfg.borderColor} hover:bg-white/5 hover:border-white/50`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="min-w-16">
                      <div className={`text-sm font-black ${cfg.textColor}`}>{ticker}</div>
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
                      ? `bg-white/20 border text-white`
                      : "border border-white/10 text-slate-400 hover:bg-white/5"
                  }`}
                  style={page === p ? { borderColor: cfg.color, color: cfg.color } : {}}
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
    </div>
  );
}
