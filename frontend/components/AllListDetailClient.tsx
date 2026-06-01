"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MARKET_THEMES } from "@/lib/themeData";

interface HourlyBar {
  time: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  volume_ratio: number | null;
}

interface TickerData {
  ticker: string;
  company: string;
  sector: string;
  price: { current: number; change_pct: number; volume: number };
  tracker_1h: {
    ema_20: number; ema_50: number; ema_200: number;
    ema_status: string; rsi: number; candle_pattern: string;
    signal: string; volume_ratio: number; change_pct_1h: number;
  };
  hourly?: HourlyBar[];
}

const SIGNAL_ICON: Record<string, string> = { AL: "●", "İzle": "◑", Bekle: "○", SAT: "✕" };
const SIGNAL_COLOR: Record<string, string> = { AL: "#3fb950", "İzle": "#e3b341", Bekle: "#8b949e", SAT: "#f85149" };

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");

function rsiColor(rsi: number) {
  if (rsi >= 70) return "#f85149";
  if (rsi >= 50) return "#3fb950";
  if (rsi >= 40) return "#e3b341";
  return "#f85149";
}

function emaColor(price: number, ema: number) {
  if (!ema) return "#8b949e";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "#e3b341";
  return price > ema ? "#3fb950" : "#f85149";
}

function emaArrow(price: number, ema: number) {
  if (!ema) return "";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "~";
  return price > ema ? "↑" : "↓";
}

function heatBg(pct: number | null) {
  if (pct === null) return { bg: "#111111", text: "#333333" };
  if (pct >= 2.0) return { bg: "#0d4a0d", text: "#56d364" };
  if (pct >= 1.0) return { bg: "#0d3a0d", text: "#3fb950" };
  if (pct >= 0.3) return { bg: "#0d2a0d", text: "#3fb950" };
  if (pct > -0.3) return { bg: "#1a1a1a", text: "#8b949e" };
  if (pct > -1.0) return { bg: "#2a0d0d", text: "#f85149" };
  if (pct > -2.0) return { bg: "#3a0d0d", text: "#f85149" };
  return { bg: "#4a0d0d", text: "#ff7b72" };
}

const ITEMS_PER_PAGE = 50;

export default function AllListDetailClient() {
  const [data, setData] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterSignal, setFilterSignal] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Extract all unique tickers from MARKET_THEMES
  const allTickers = Array.from(
    new Set(MARKET_THEMES.flatMap((t) => t.tickers))
  ).sort();

  // Filtered tickers
  const filtered = allTickers.filter(sym => {
    const d = data[sym];
    if (filterSignal && d?.tracker_1h?.signal !== filterSignal) return false;
    return true;
  });

  // Sorting
  const sortedTickers = [...filtered].sort((a, b) => {
    if (!sortBy) return 0;
    const da = data[a];
    const db = data[b];
    let valA: any, valB: any;

    switch (sortBy) {
      case "TICKER": valA = a; valB = b; break;
      case "ŞİRKET": valA = da?.company || ""; valB = db?.company || ""; break;
      case "SEKTÖR": valA = da?.sector || ""; valB = db?.sector || ""; break;
      case "FİYAT": valA = da?.price?.current ?? 0; valB = db?.price?.current ?? 0; break;
      case "Δ%": valA = da?.tracker_1h?.change_pct_1h ?? 0; valB = db?.tracker_1h?.change_pct_1h ?? 0; break;
      case "H.ORAN": valA = da?.tracker_1h?.volume_ratio ?? 0; valB = db?.tracker_1h?.volume_ratio ?? 0; break;
      case "EMA20": valA = da?.tracker_1h?.ema_20 ?? 0; valB = db?.tracker_1h?.ema_20 ?? 0; break;
      case "EMA50": valA = da?.tracker_1h?.ema_50 ?? 0; valB = db?.tracker_1h?.ema_50 ?? 0; break;
      case "EMA200": valA = da?.tracker_1h?.ema_200 ?? 0; valB = db?.tracker_1h?.ema_200 ?? 0; break;
      case "RSI": valA = da?.tracker_1h?.rsi ?? 0; valB = db?.tracker_1h?.rsi ?? 0; break;
      case "SİNYAL": {
        const signalOrder = { "AL": 3, "İzle": 2, "Bekle": 1, "SAT": 0, "—": -1 };
        valA = signalOrder[da?.tracker_1h?.signal as keyof typeof signalOrder] ?? -1;
        valB = signalOrder[db?.tracker_1h?.signal as keyof typeof signalOrder] ?? -1;
        break;
      }
      default: return 0;
    }

    if (typeof valA === "string") {
      const cmp = valA.localeCompare(valB);
      return sortDir === "asc" ? cmp : -cmp;
    }
    const diff = valA - valB;
    return sortDir === "asc" ? diff : -diff;
  });

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  // Fetch data for current page only (lazy loading)
  useEffect(() => {
    const fetchPageData = async () => {
      // Get tickers for current page
      const pageStart = (page - 1) * ITEMS_PER_PAGE;
      const pageEnd = pageStart + ITEMS_PER_PAGE;
      const tickersToFetch = sortedTickers.slice(pageStart, pageEnd);

      if (tickersToFetch.length === 0) return;

      // Check if we already have data for these tickers
      const needsFetch = tickersToFetch.some((t) => !data[t]);
      if (!needsFetch) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const batch = tickersToFetch.join(",");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const result = await fetch(`/api/watchlist-data?tickers=${batch}`, {
          signal: controller.signal,
        })
          .then((r) => {
            clearTimeout(timeoutId);
            return r.json();
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            console.error("Fetch error:", err);
            return [];
          });

        const newData = { ...data };
        result.forEach((item: TickerData) => {
          if (item?.ticker) newData[item.ticker] = item;
        });
        setData(newData);
        setLastUpdated(new Date());
        setLoading(false);
      } catch (err) {
        console.error("Data fetch failed:", err);
        setLoading(false);
      }
    };

    fetchPageData();
  }, [page]);

  const isMarketOpen = () => {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 9 * 60 + 30 && mins < 16 * 60;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <span style={{ color: "#3fb950", fontFamily: "monospace" }} className="animate-pulse">
          loading...
        </span>
      </div>
    );
  }

  const alCount = filtered.filter(s => data[s]?.tracker_1h?.signal === "AL").length;
  const izleCount = filtered.filter(s => data[s]?.tracker_1h?.signal === "İzle").length;

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = filtered.slice(start, end);

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", fontFamily: "monospace", color: "#e6edf3" }}>
      {/* Top Header */}
      <div style={{ borderBottom: "1px solid #30363d", padding: "10px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#e3b341", letterSpacing: "-0.5px" }}>
            BOGA TRACKER — ALL LIST
          </span>
          <span style={{ fontSize: 12, color: "#8b949e" }}>900+ hisse</span>
        </div>

        {/* CSP Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {[
            { slug: "525", label: "525 CSP", color: "#10b981" },
            { slug: "2550", label: "2550 CSP", color: "#3b82f6" },
            { slug: "50250", label: "50250 CSP", color: "#a78bfa" },
            { slug: "all-list", label: "ALL LIST", color: "#e3b341" },
          ].map((csp) => (
            <a
              key={csp.slug}
              href={`/csp/${csp.slug}`}
              style={{
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 700,
                border: `1px solid ${csp.slug === "all-list" ? csp.color : "#30363d"}`,
                background: csp.slug === "all-list" ? csp.color + "20" : "transparent",
                color: csp.slug === "all-list" ? csp.color : "#8b949e",
                borderRadius: 4,
                cursor: "pointer",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (csp.slug !== "all-list") {
                  e.currentTarget.style.borderColor = csp.color + "80";
                  e.currentTarget.style.color = "#e6edf3";
                }
              }}
              onMouseLeave={(e) => {
                if (csp.slug !== "all-list") {
                  e.currentTarget.style.borderColor = "#30363d";
                  e.currentTarget.style.color = "#8b949e";
                }
              }}
            >
              {csp.label}
            </a>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12 }}>
          {lastUpdated && <span>son güncelleme: {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} ET</span>}
          <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>
            ● {isMarketOpen() ? "market açık" : "market kapalı"}
          </span>
          <span style={{ color: "#8b949e" }}>{filtered.length} ticker</span>
          {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} AL</span>}
          {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} İzle</span>}
        </div>
      </div>

      {/* Filter Buttons */}
      <div style={{ padding: "10px 0", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #30363d" }}>
        {["", "AL", "İzle", "Bekle", "SAT"].map((sig) => (
          <button
            key={sig || "TÜM"}
            onClick={() => setFilterSignal(sig)}
            style={{
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 700,
              border: `1px solid ${filterSignal === sig ? "#e3b341" : "#30363d"}`,
              background: filterSignal === sig ? "#e3b34120" : "transparent",
              color: filterSignal === sig ? "#e3b341" : "#8b949e",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            {sig ? `${SIGNAL_ICON[sig]} ${sig}` : "TÜM SİNYAL"}
          </button>
        ))}
      </div>

      {/* Table Header */}
      <div style={{ padding: "8px 0", fontSize: 11, color: "#e6edf3", borderBottom: "1px solid #30363d" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px 80px 140px 150px 90px 80px 90px 90px 90px 90px 80px 80px 80px 80px 40px", gap: "1px" }}>
          <div style={{ paddingLeft: 8 }}>TICKER</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("ŞİRKET")}>ŞİRKET {sortBy === "ŞİRKET" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("SEKTÖR")}>SEKTÖR {sortBy === "SEKTÖR" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("FİYAT")}>FİYAT {sortBy === "FİYAT" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("Δ%")}>Δ% {sortBy === "Δ%" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("H.ORAN")}>H.ORAN {sortBy === "H.ORAN" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("EMA20")}>EMA20 {sortBy === "EMA20" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("EMA50")}>EMA50 {sortBy === "EMA50" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("EMA200")}>EMA200 {sortBy === "EMA200" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("RSI")}>RSI {sortBy === "RSI" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div style={{ cursor: "pointer" }} onClick={() => toggleSort("SİNYAL")}>SİNYAL {sortBy === "SİNYAL" && (sortDir === "asc" ? "▲" : "▼")}</div>
          <div>PATTERN</div>
          <div>DURUM</div>
          <div>NOT</div>
          <div></div>
        </div>
      </div>

      {/* Pagination Info */}
      <div style={{ padding: "8px 0", fontSize: 11, color: "#8b949e", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Sayfa {page}/{totalPages}</span>
        <span>{start + 1}–{Math.min(end, filtered.length)} / {filtered.length}</span>
      </div>

      {/* Table Rows */}
      <div style={{ fontSize: 11 }}>
        {pageItems.map((ticker) => {
          const d = data[ticker];
          if (!d) return null;

          const changeBg = heatBg(d.tracker_1h?.change_pct_1h);
          const ema20Bg = heatBg(((d.price?.current ?? 0) - (d.tracker_1h?.ema_20 ?? 0)) / (d.tracker_1h?.ema_20 ?? 1) * 100);

          return (
            <div key={ticker} style={{ borderBottom: "1px solid #21262d" }}>
              <Link
                href={`/stock/${ticker}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 80px 140px 150px 90px 80px 90px 90px 90px 90px 80px 80px 80px 80px 40px",
                  gap: "1px",
                  padding: "6px 0",
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#161b22"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ paddingLeft: 8 }}>
                  <span style={{ color: "#58a6ff", fontWeight: 700 }}>{ticker}</span>
                </div>
                <div style={{ color: "#8b949e" }}>{d.company?.substring(0, 20)}</div>
                <div style={{ color: "#8b949e" }}>{d.sector}</div>
                <div style={{ color: "#e6edf3", fontWeight: 700 }}>${fmt2(d.price?.current)}</div>
                <div style={{ ...changeBg, padding: "2px 4px", borderRadius: 2, textAlign: "center" }}>
                  {fmt2(d.tracker_1h?.change_pct_1h)}%
                </div>
                <div style={{ ...heatBg(d.tracker_1h?.volume_ratio), padding: "2px 4px", borderRadius: 2 }}>
                  {fmt2(d.tracker_1h?.volume_ratio)}
                </div>
                <div style={{ color: emaColor(d.price?.current ?? 0, d.tracker_1h?.ema_20 ?? 0) }}>
                  {emaArrow(d.price?.current ?? 0, d.tracker_1h?.ema_20 ?? 0)} {fmt2(d.tracker_1h?.ema_20)}
                </div>
                <div style={{ color: emaColor(d.price?.current ?? 0, d.tracker_1h?.ema_50 ?? 0) }}>
                  {emaArrow(d.price?.current ?? 0, d.tracker_1h?.ema_50 ?? 0)} {fmt2(d.tracker_1h?.ema_50)}
                </div>
                <div style={{ color: emaColor(d.price?.current ?? 0, d.tracker_1h?.ema_200 ?? 0) }}>
                  {emaArrow(d.price?.current ?? 0, d.tracker_1h?.ema_200 ?? 0)} {fmt2(d.tracker_1h?.ema_200)}
                </div>
                <div style={{ color: rsiColor(d.tracker_1h?.rsi ?? 0) }}>
                  {fmt1(d.tracker_1h?.rsi)}
                </div>
                <div style={{ color: SIGNAL_COLOR[d.tracker_1h?.signal] || "#8b949e", fontWeight: 700 }}>
                  {SIGNAL_ICON[d.tracker_1h?.signal] || "○"} {d.tracker_1h?.signal || "—"}
                </div>
                <div style={{ color: "#8b949e", fontSize: 10 }}>{d.tracker_1h?.candle_pattern || "—"}</div>
                <div style={{ color: "#8b949e" }}>{d.tracker_1h?.ema_status || "—"}</div>
                <div style={{ color: "#8b949e" }}>—</div>
                <div style={{ color: "#f85149", textAlign: "center", fontWeight: 700 }}>✕</div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ padding: "16px 0", display: "flex", gap: 8, justifyContent: "center", alignItems: "center", borderTop: "1px solid #30363d", flexWrap: "wrap" }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid #30363d",
              background: "transparent",
              color: page === 1 ? "#555" : "#8b949e",
              borderRadius: 4,
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.5 : 1,
            }}
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
              <div key={p} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span style={{ color: "#333", fontSize: 11 }}>…</span>
                )}
                <button
                  onClick={() => setPage(p)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    border: `1px solid ${page === p ? "#e3b341" : "#30363d"}`,
                    background: page === p ? "#e3b34120" : "transparent",
                    color: page === p ? "#e3b341" : "#8b949e",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              </div>
            ))}

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid #30363d",
              background: "transparent",
              color: page === totalPages ? "#555" : "#8b949e",
              borderRadius: 4,
              cursor: page === totalPages ? "not-allowed" : "pointer",
              opacity: page === totalPages ? 0.5 : 1,
            }}
          >
            Sonraki →
          </button>
        </div>
      )}
    </div>
  );
}
