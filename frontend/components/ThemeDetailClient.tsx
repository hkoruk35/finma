"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import TickerHoverChart from "@/components/TickerHoverChart";
import { useTracker } from "@/components/TrackerContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TickerData {
  ticker: string;
  company: string;
  sector: string;
  price: {
    current: number;
    change_pct: number;
    change_pct_1w?: number;
    change_pct_1m?: number;
    volume: number;
    avg_volume_30d?: number;
  };
  tracker_1h: {
    ema_20: number;
    ema_50: number;
    ema_200: number;
    ema_status: string;
    rsi: number;
    candle_pattern: string;
    signal: string;
    volume_ratio: number;
    change_pct_1h: number;
  };
  fundamental?: { market_cap?: number; pe_ratio?: number };
  scores?: { master_score?: number; score_type?: string };
}

interface ThemeDetailClientProps {
  themeName: string;
  initialTickers: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt2 = (n: number | null | undefined) =>
  n != null && isFinite(n) ? n.toFixed(2) : "—";
const fmt1 = (n: number | null | undefined) =>
  n != null && isFinite(n) ? n.toFixed(1) : "—";
const fmtLarge = (v?: number) => {
  if (!v) return "—";
  if (v >= 1e12) return "$" + (v / 1e12).toFixed(1) + "T";
  if (v >= 1e9)  return "$" + (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6)  return "$" + (v / 1e6).toFixed(0) + "M";
  return "$" + v.toLocaleString();
};

function heatBg(pct: number | null | undefined): { bg: string; text: string } {
  if (pct == null) return { bg: "#111417", text: "#444" };
  if (pct >= 3.0)  return { bg: "#0a3d12", text: "#56d364" };
  if (pct >= 2.0)  return { bg: "#0d4a0d", text: "#56d364" };
  if (pct >= 1.0)  return { bg: "#0d3a0d", text: "#3fb950" };
  if (pct >= 0.3)  return { bg: "#0d2a0d", text: "#3fb950" };
  if (pct > -0.3)  return { bg: "#1a1f26", text: "#8b949e" };
  if (pct > -1.0)  return { bg: "#2a0d0d", text: "#f85149" };
  if (pct > -2.0)  return { bg: "#3a0d0d", text: "#f85149" };
  return              { bg: "#4a0d0d", text: "#ff7b72" };
}

function rsiColor(rsi?: number) {
  if (!rsi) return "#8b949e";
  if (rsi >= 70) return "#f85149";
  if (rsi >= 50) return "#3fb950";
  if (rsi >= 40) return "#e3b341";
  return "#f85149";
}

function emaColor(price: number, ema?: number) {
  if (!ema) return "#8b949e";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "#e3b341";
  return price > ema ? "#3fb950" : "#f85149";
}

function emaArrow(price: number, ema?: number) {
  if (!ema) return "";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "~";
  return price > ema ? "↑" : "↓";
}

const SIGNAL_COLOR: Record<string, string> = {
  AL: "#3fb950", "İzle": "#e3b341", Bekle: "#8b949e", SAT: "#f85149",
};
const SIGNAL_ICON: Record<string, string> = {
  AL: "●", "İzle": "◑", Bekle: "○", SAT: "✕",
};
const ROW_BG: Record<string, string> = {
  AL: "#0d1f0d", "İzle": "#1a1a0d", Bekle: "#0d1117", SAT: "#1f0d0d",
};

const SCORE_TYPE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  HIGH_CONVICTION: { bg: "#2a1f00", text: "#e3b341", border: "#e3b34150" },
  POSITIVE_BIAS:   { bg: "#0d2a0d", text: "#3fb950", border: "#3fb95050" },
  NEGATIVE_BIAS:   { bg: "#2a0d0d", text: "#f85149", border: "#f8514950" },
  UNDERPERFORM:    { bg: "#2a0d0d", text: "#f85149", border: "#f8514950" },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ThemeDetailClient({ themeName, initialTickers }: ThemeDetailClientProps) {
  const [tickers, setTickers]       = useState<string[]>([]);
  const [customTickers, setCustomTickers] = useState<string[]>([]);
  const [data, setData]             = useState<Record<string, TickerData>>({});
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab]   = useState<"table" | "heatmap">("table");
  const [sortBy, setSortBy]         = useState<string>("1G%");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [addInput, setAddInput] = useState("");
  const { addToTracker, isInTracker } = useTracker();

  // ── Load tickers (cache-first, then API) ──────────────────────────────────
  useEffect(() => {
    function applyOverrides(overrides: Record<string, string[]>) {
      const customList = overrides[themeName] || [];
      setCustomTickers(customList);
      const merged = Array.from(new Set([...initialTickers, ...customList]));
      setTickers(merged);
      return merged;
    }

    let cached: Record<string, string[]> = {};
    try { cached = JSON.parse(localStorage.getItem("t_theme_overrides") || "{}"); } catch {}
    const mergedFromCache = applyOverrides(cached);
    setVisibleCount(50);
    fetchStocks(mergedFromCache.slice(0, 50));

    fetch("/api/store/theme_overrides")
      .then(r => r.json())
      .then(({ value }) => {
        const overrides: Record<string, string[]> = value ?? {};
        try { localStorage.setItem("t_theme_overrides", JSON.stringify(overrides)); } catch {}
        const merged = applyOverrides(overrides);
        setVisibleCount(50);
        fetchStocks(merged.slice(0, 50));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeName]);

  const fetchStocks = useCallback(async (list: string[]) => {
    if (list.length === 0) { setData({}); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist-data?tickers=${list.join(",")}`);
      if (!res.ok) throw new Error("API error");
      const results: TickerData[] = await res.json();
      const map: Record<string, TickerData> = {};
      results.forEach(item => { if (item?.ticker) map[item.ticker] = item; });
      setData(map);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("ThemeDetail fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (allTickers: string[], currentVisible: number) => {
    const nextBatch = allTickers.slice(currentVisible, currentVisible + 50);
    if (nextBatch.length === 0) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/watchlist-data?tickers=${nextBatch.join(",")}`);
      if (!res.ok) throw new Error("API error");
      const results: TickerData[] = await res.json();
      setData(prev => {
        const updated = { ...prev };
        results.forEach(item => { if (item?.ticker) updated[item.ticker] = item; });
        return updated;
      });
      setVisibleCount(currentVisible + 50);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("loadMore error:", e);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  const refresh = () => fetchStocks(tickers.slice(0, visibleCount));

  const syncOverrides = (overrides: Record<string, string[]>) => {
    try { localStorage.setItem("t_theme_overrides", JSON.stringify(overrides)); } catch {}
    fetch("/api/store/theme_overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: overrides }),
    }).catch(() => {});
  };

  const addCustomTicker = async (input: string) => {
    const sym = input.trim().toUpperCase();
    if (!sym || tickers.includes(sym)) return;

    let overrides: Record<string, string[]> = {};
    try { overrides = JSON.parse(localStorage.getItem("t_theme_overrides") || "{}"); } catch {}
    const updatedCustom = [...(overrides[themeName] || []), sym];
    overrides[themeName] = updatedCustom;
    syncOverrides(overrides);

    setCustomTickers(updatedCustom);
    setTickers(prev => [...prev, sym]);
    setVisibleCount(prev => prev + 1);
    setAddInput("");

    try {
      const res = await fetch(`/api/watchlist-data?tickers=${sym}`);
      if (!res.ok) throw new Error("API error");
      const results: TickerData[] = await res.json();
      setData(prev => {
        const updated = { ...prev };
        results.forEach(item => { if (item?.ticker) updated[item.ticker] = item; });
        return updated;
      });
    } catch (e) {
      console.error("addCustomTicker fetch error:", e);
    }
  };

  const removeCustomTicker = (ticker: string) => {
    let overrides: Record<string, string[]> = {};
    try { overrides = JSON.parse(localStorage.getItem("t_theme_overrides") || "{}"); } catch {}
    if (overrides[themeName]) {
      overrides[themeName] = overrides[themeName].filter(t => t !== ticker);
      syncOverrides(overrides);
    }
    setCustomTickers(prev => prev.filter(t => t !== ticker));
    const newList = tickers.filter(t => t !== ticker);
    setTickers(newList);
    setData(prev => { const d = { ...prev }; delete d[ticker]; return d; });
  };

  // ── Sorting ────────────────────────────────────────────────────────────────
  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const getValue = (sym: string, col: string): number => {
    const d = data[sym];
    if (!d) return -Infinity;
    switch (col) {
      case "FİYAT":  return d.price?.current ?? 0;
      case "1G%":    return d.price?.change_pct ?? 0;
      case "1H%":    return d.tracker_1h?.change_pct_1h ?? 0;
      case "RSI":    return d.tracker_1h?.rsi ?? 0;
      case "H.ORAN": return d.tracker_1h?.volume_ratio ?? 0;
      case "EMA20":  return d.tracker_1h?.ema_20 ?? 0;
      case "EMA50":  return d.tracker_1h?.ema_50 ?? 0;
      case "EMA200": return d.tracker_1h?.ema_200 ?? 0;
      case "MKT CAP": return d.fundamental?.market_cap ?? 0;
      case "SKOR":   return d.scores?.master_score ?? 0;
      default:       return 0;
    }
  };

  const sortedTickers = [...tickers].sort((a, b) => {
    const diff = getValue(a, sortBy) - getValue(b, sortBy);
    return sortDir === "desc" ? -diff : diff;
  });
  const visibleTickers = sortedTickers.slice(0, visibleCount);

  // ── Market status ──────────────────────────────────────────────────────────
  const isMarketOpen = () => {
    const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 9 * 60 + 30 && mins < 16 * 60;
  };

  const alCount  = tickers.filter(s => data[s]?.tracker_1h?.signal === "AL").length;
  const izleCount = tickers.filter(s => data[s]?.tracker_1h?.signal === "İzle").length;

  const SORTABLE_COLS = ["FİYAT","1G%","1H%","RSI","H.ORAN","EMA20","EMA50","EMA200","MKT CAP","SKOR"];
  const ACCENT = "#22d3ee";

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", fontFamily: "monospace", color: "#e6edf3" }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #30363d", paddingBottom: 12 }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 10 }}>
          <Link href="/theme" style={{ color: ACCENT, textDecoration: "none" }}>THEMES</Link>
          <span style={{ margin: "0 6px", color: "#444" }}>/</span>
          <span style={{ color: "#e6edf3", fontWeight: 700 }}>{themeName.toUpperCase()}</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px" }}>
                {themeName.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: "#8b949e" }}>
              {visibleCount < tickers.length ? `${visibleCount}/${tickers.length}` : tickers.length} ticker
            </span>
              {customTickers.length > 0 && (
                <span style={{ fontSize: 10, color: "#3fb950", background: "#0d2a0d", border: "1px solid #3fb95040", padding: "2px 8px", borderRadius: 3 }}>
                  +{customTickers.length} custom
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", display: "flex", gap: 14, flexWrap: "wrap" }}>
              {lastUpdated && (
                <span>son güncelleme: {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} ET</span>
              )}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>
                ● {isMarketOpen() ? "market açık" : "market kapalı"}
              </span>
              {alCount > 0   && <span style={{ color: "#3fb950" }}>{alCount} AL</span>}
              {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} İzle</span>}
            </div>
          </div>

          {/* Tabs + Actions */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["table", "heatmap"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid",
                borderColor: activeTab === tab ? ACCENT : "#30363d",
                background: activeTab === tab ? ACCENT + "20" : "transparent",
                color: activeTab === tab ? ACCENT : "#8b949e",
                borderRadius: 4, cursor: "pointer", letterSpacing: "0.05em",
              }}>
                {tab === "table" ? "ANA TABLO" : "ISI HARİTASI"}
              </button>
            ))}
            <button
              onClick={refresh}
              disabled={loading}
              style={{
                padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid #30363d", background: "transparent",
                color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer",
              }}
            >
              {loading ? "..." : "YENİLE"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && tickers.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12 }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${ACCENT}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ color: "#8b949e", fontSize: 12 }}>Veri yükleniyor...</span>
        </div>
      )}

      {/* ══ HEATMAP TAB ══════════════════════════════════════════════════════ */}
      {activeTab === "heatmap" && !loading && (
        <div style={{ padding: "16px 0" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#8b949e", fontWeight: 700, letterSpacing: 1 }}>1G DEĞİŞİM:</span>
            {[
              { label: "≥+3%",  ...heatBg(3.5) },
              { label: "+1%–3%",...heatBg(1.5) },
              { label: "±0.3%", ...heatBg(0) },
              { label: "−1%–3%",...heatBg(-1.5) },
              { label: "≤−3%",  ...heatBg(-3.5) },
            ].map(({ label, bg, text }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${text}30`, borderRadius: 3, padding: "2px 8px", fontSize: 9, color: text, fontWeight: 700 }}>
                {label}
              </div>
            ))}
          </div>

          {/* Sector groups */}
          {(() => {
            // Group by sector
            const bySector: Record<string, string[]> = {};
            visibleTickers.forEach(sym => {
              const sec = data[sym]?.sector || "Diğer";
              if (!bySector[sec]) bySector[sec] = [];
              bySector[sec].push(sym);
            });
            // Ungrouped (no data yet) in "Yükleniyor"
            const noDataTickers = visibleTickers.filter(sym => !data[sym]);
            if (noDataTickers.length > 0) bySector["—"] = noDataTickers;

            return Object.entries(bySector).map(([sec, syms]) => (
              <div key={sec} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
                  {sec} <span style={{ color: "#555", fontWeight: 400 }}>({syms.length})</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {syms.map(sym => {
                    const d = data[sym];
                    const pct = d?.price?.change_pct ?? null;
                    const { bg, text } = heatBg(pct);
                    const signal = d?.tracker_1h?.signal;
                    return (
                      <Link key={sym} href={`/stock/${sym}`} style={{ textDecoration: "none" }}>
                        <div style={{
                          background: bg,
                          border: `1px solid ${text}35`,
                          borderRadius: 5,
                          padding: "9px 12px",
                          minWidth: 76,
                          textAlign: "center",
                          cursor: "pointer",
                          transition: "transform 0.1s, border-color 0.1s",
                          position: "relative",
                        }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; (e.currentTarget as HTMLElement).style.borderColor = text; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.borderColor = text + "35"; }}
                        >
                          {signal && SIGNAL_COLOR[signal] && (
                            <div style={{ position: "absolute", top: 3, right: 4, fontSize: 8, color: SIGNAL_COLOR[signal], fontWeight: 900 }}>
                              {SIGNAL_ICON[signal]}
                            </div>
                          )}
                          <div style={{ color: text, fontSize: 13, fontWeight: 900, letterSpacing: "-0.3px" }}>{sym}</div>
                          <div style={{ color: text, fontSize: 11, marginTop: 3, fontWeight: 700 }}>
                            {pct != null ? (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%" : "—"}
                          </div>
                          <div style={{ color: text + "90", fontSize: 9, marginTop: 2 }}>
                            {d?.price?.current != null ? "$" + fmt2(d.price.current) : "—"}
                          </div>
                          {d?.tracker_1h?.rsi != null && (
                            <div style={{ color: rsiColor(d.tracker_1h.rsi), fontSize: 9, marginTop: 1, fontWeight: 700 }}>
                              RSI {fmt1(d.tracker_1h.rsi)}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* ══ TABLE TAB ════════════════════════════════════════════════════════ */}
      {activeTab === "table" && !loading && tickers.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#8b949e" }}>
          <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>∅</div>
          <p>Bu tema için ticker bulunamadı.</p>
        </div>
      )}

      {activeTab === "table" && !loading && tickers.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {[
                  "TICKER","ŞİRKET","SEKTÖR","FİYAT","1G%","1H%","H.ORAN",
                  "EMA20","EMA50","EMA200","DURUM","RSI","PATERN","SİNYAL","MKT CAP","SKOR","TRACKER"
                ].map((h, i) => {
                  const sortable = SORTABLE_COLS.includes(h);
                  const isSorted = sortBy === h;
                  return (
                    <th key={i} onClick={() => sortable && toggleSort(h)} style={{
                      padding: "7px 8px",
                      textAlign: i <= 2 ? "left" : "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                      color: isSorted ? "#ffd700" : ACCENT,
                      whiteSpace: "nowrap", background: "#0d1117",
                      cursor: sortable ? "pointer" : "default",
                      userSelect: "none",
                    }}>
                      {h}{isSorted ? (sortDir === "desc" ? " ▼" : " ▲") : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleTickers.map((sym, idx) => {
                const d = data[sym];
                const signal  = d?.tracker_1h?.signal || "—";
                const rowBg   = ROW_BG[signal] || (idx % 2 === 1 ? "#161b22" : "#0d1117");
                const price   = d?.price?.current ?? 0;
                const isExpanded = expandedRow === sym;
                const isCustom   = customTickers.includes(sym);
                const scoreStyle = SCORE_TYPE_STYLE[d?.scores?.score_type || ""] || null;

                return (
                  <>
                    <tr
                      key={sym}
                      style={{ background: rowBg, borderBottom: isExpanded ? "none" : "1px solid #21262d", cursor: "pointer" }}
                      onClick={() => setExpandedRow(isExpanded ? null : sym)}
                    >
                      {/* TICKER */}
                      <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                        <TickerHoverChart ticker={sym}>
                          <Link
                            href={`/stock/${sym}`}
                            onClick={e => e.stopPropagation()}
                            style={{ color: "#58a6ff", fontWeight: 900, fontSize: 13, textDecoration: "none" }}
                          >
                            {sym}
                          </Link>
                        </TickerHoverChart>
                        {isCustom && (
                          <>
                            <span style={{ marginLeft: 5, fontSize: 8, color: "#3fb950", background: "#0d2a0d", border: "1px solid #3fb95030", padding: "1px 5px", borderRadius: 2 }}>
                              CUSTOM
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); removeCustomTicker(sym); }}
                              style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 12, lineHeight: 1 }}
                              title="Listeden kaldır"
                            >✕</button>
                          </>
                        )}
                        <span style={{ color: "#8b949e", marginLeft: 5, fontSize: 10 }}>{isExpanded ? "▼" : "▶"}</span>
                      </td>

                      {/* ŞİRKET */}
                      <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d?.company ? d.company.slice(0, 18) : "—"}
                      </td>

                      {/* SEKTÖR */}
                      <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, whiteSpace: "nowrap", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {d?.sector && d.sector !== "Unknown" ? d.sector : "—"}
                      </td>

                      {/* FİYAT */}
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                        {d ? `$${fmt2(price)}` : <span style={{ color: "#555" }}>—</span>}
                      </td>

                      {/* 1G% */}
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: !d ? "#555" : (d.price?.change_pct ?? 0) >= 0 ? "#3fb950" : "#f85149" }}>
                        {d ? `${(d.price?.change_pct ?? 0) >= 0 ? "+" : ""}${fmt2(d.price?.change_pct)}%` : "—"}
                      </td>

                      {/* 1H% */}
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: !d ? "#555" : (d.tracker_1h?.change_pct_1h ?? 0) >= 0 ? "#3fb950" : "#f85149" }}>
                        {d ? `${(d.tracker_1h?.change_pct_1h ?? 0) >= 0 ? "+" : ""}${fmt2(d.tracker_1h?.change_pct_1h)}%` : "—"}
                      </td>

                      {/* H.ORAN */}
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: !d ? "#555" : (d.tracker_1h?.volume_ratio ?? 0) >= 1.5 ? "#3fb950" : (d.tracker_1h?.volume_ratio ?? 0) >= 0.8 ? "#e6edf3" : "#8b949e" }}>
                        {d ? `${fmt2(d.tracker_1h?.volume_ratio)}x` : "—"}
                      </td>

                      {/* EMA20 */}
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_20) : "#555" }}>
                        {d ? `${fmt2(d.tracker_1h?.ema_20)}${emaArrow(price, d.tracker_1h?.ema_20)}` : "—"}
                      </td>

                      {/* EMA50 */}
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_50) : "#555" }}>
                        {d ? `${fmt2(d.tracker_1h?.ema_50)}${emaArrow(price, d.tracker_1h?.ema_50)}` : "—"}
                      </td>

                      {/* EMA200 */}
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_200) : "#555" }}>
                        {d ? `${fmt2(d.tracker_1h?.ema_200)}${emaArrow(price, d.tracker_1h?.ema_200)}` : "—"}
                      </td>

                      {/* DURUM */}
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {d?.tracker_1h?.ema_status && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                            background: d.tracker_1h.ema_status.includes("Bull") || d.tracker_1h.ema_status === "Yükseliş" ? "#1a3a1a" : d.tracker_1h.ema_status === "Nötr" ? "#1a1a2e" : "#2e1a1a",
                            color: d.tracker_1h.ema_status.includes("Bull") || d.tracker_1h.ema_status === "Yükseliş" ? "#3fb950" : d.tracker_1h.ema_status === "Nötr" ? "#8b949e" : "#f85149",
                          }}>
                            {d.tracker_1h.ema_status}
                          </span>
                        )}
                      </td>

                      {/* RSI */}
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? rsiColor(d.tracker_1h?.rsi) : "#555" }}>
                        {d ? fmt1(d.tracker_1h?.rsi) : "—"}
                      </td>

                      {/* PATERN */}
                      <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 10, whiteSpace: "nowrap" }}>
                        {(() => {
                          const p = d?.tracker_1h?.candle_pattern;
                          if (!p || p === "—") return <span style={{ color: "#555" }}>—</span>;
                          const isBull = ["Hammer","Bullish","Morning","Asker","Dragonfly","Marubozu","Outside Bar ↑","Güçlü ↑","Yeşil"].some(x => p.includes(x)) && !p.includes("↓");
                          const isBear = ["Shooting","Bearish","Evening","Karga","Gravestone","Hanging","Outside Bar ↓","Güçlü ↓","Kırmızı"].some(x => p.includes(x)) && !p.includes("↑");
                          return <span style={{ color: isBull ? "#3fb950" : isBear ? "#f85149" : "#e3b341", fontWeight: 700 }}>{p}</span>;
                        })()}
                      </td>

                      {/* SİNYAL */}
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {d && (
                          <span style={{ fontWeight: 900, fontSize: 12, color: SIGNAL_COLOR[signal] || "#8b949e" }}>
                            {SIGNAL_ICON[signal] || "○"} {signal}
                          </span>
                        )}
                      </td>

                      {/* MKT CAP */}
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 10 }}>
                        {fmtLarge(d?.fundamental?.market_cap)}
                      </td>

                      {/* SKOR */}
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {d?.scores?.master_score != null && (
                          <span style={{ fontWeight: 900, fontSize: 12, color: "#e6edf3" }}>
                            {Math.round(d.scores.master_score)}
                          </span>
                        )}
                        {scoreStyle && (
                          <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: scoreStyle.bg, color: scoreStyle.text, border: `1px solid ${scoreStyle.border}` }}>
                            {(d?.scores?.score_type || "").replace("_", " ")}
                          </span>
                        )}
                      </td>

                      {/* TRACKER */}
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {isInTracker(sym) ? (
                          <Link
                            href="/tracker"
                            onClick={e => e.stopPropagation()}
                            style={{
                              display: "inline-block", padding: "2px 8px", fontSize: 10,
                              fontFamily: "monospace", fontWeight: 700, borderRadius: 3,
                              border: "1px solid #3fb950", color: "#3fb950",
                              background: "#0d2a0d", textDecoration: "none", whiteSpace: "nowrap",
                            }}
                          >
                            ✓ Tracker
                          </Link>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); addToTracker(sym, "Swing"); }}
                            style={{
                              padding: "2px 8px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                              border: "1px solid #30363d", background: "transparent",
                              color: "#8b949e", borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            + Tracker
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && d && (
                      <tr key={`${sym}-detail`} style={{ background: "#111820" }}>
                        <td colSpan={17} style={{ padding: "12px 16px", borderBottom: "1px solid #30363d" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, fontSize: 11 }}>
                            {/* Fiyat Değişimleri */}
                            <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 5, padding: "10px 12px" }}>
                              <div style={{ fontSize: 9, color: ACCENT, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Fiyat Değişimleri</div>
                              {[
                                ["1H %", d.tracker_1h?.change_pct_1h],
                                ["1G %", d.price?.change_pct],
                                ["1H % (haftalık)", d.price?.change_pct_1w],
                                ["1A %", d.price?.change_pct_1m],
                              ].map(([label, val]) => (
                                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                  <span style={{ color: "#8b949e" }}>{label}</span>
                                  <span style={{ fontWeight: 700, color: (val as number ?? 0) >= 0 ? "#3fb950" : "#f85149" }}>
                                    {val != null ? `${(val as number) >= 0 ? "+" : ""}${fmt2(val as number)}%` : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* EMA Göstergeleri */}
                            <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 5, padding: "10px 12px" }}>
                              <div style={{ fontSize: 9, color: ACCENT, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>EMA Göstergeleri</div>
                              {[
                                ["EMA 20",  d.tracker_1h?.ema_20,  emaColor(price, d.tracker_1h?.ema_20)],
                                ["EMA 50",  d.tracker_1h?.ema_50,  emaColor(price, d.tracker_1h?.ema_50)],
                                ["EMA 200", d.tracker_1h?.ema_200, emaColor(price, d.tracker_1h?.ema_200)],
                                ["Durum",   d.tracker_1h?.ema_status, d.tracker_1h?.ema_status?.includes("Bull") ? "#3fb950" : "#f85149"],
                              ].map(([label, val, color]) => (
                                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                  <span style={{ color: "#8b949e" }}>{label}</span>
                                  <span style={{ fontWeight: 700, color: color as string }}>
                                    {typeof val === "number" ? `$${fmt2(val)}` : val || "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Momentum */}
                            <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 5, padding: "10px 12px" }}>
                              <div style={{ fontSize: 9, color: ACCENT, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Momentum</div>
                              {[
                                ["RSI",     d.tracker_1h?.rsi,          rsiColor(d.tracker_1h?.rsi)],
                                ["Hacim Oran", d.tracker_1h?.volume_ratio, (d.tracker_1h?.volume_ratio ?? 0) >= 1.5 ? "#3fb950" : "#8b949e"],
                                ["Patern",  d.tracker_1h?.candle_pattern, "#e3b341"],
                                ["Sinyal",  d.tracker_1h?.signal,         SIGNAL_COLOR[d.tracker_1h?.signal || ""] || "#8b949e"],
                              ].map(([label, val, color]) => (
                                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                  <span style={{ color: "#8b949e" }}>{label}</span>
                                  <span style={{ fontWeight: 700, color: color as string, fontSize: 10 }}>
                                    {typeof val === "number" ? fmt2(val) + "x" : val || "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Temel Veriler + Linkler */}
                            <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 5, padding: "10px 12px" }}>
                              <div style={{ fontSize: 9, color: ACCENT, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Temel & Linkler</div>
                              {[
                                ["Piyasa Değeri", fmtLarge(d.fundamental?.market_cap), "#8b949e"],
                                ["F/K", d.fundamental?.pe_ratio != null ? fmt1(d.fundamental.pe_ratio) : "—", "#8b949e"],
                                ["Sektör", d.sector || "—", "#8b949e"],
                                ["Skor", d.scores?.master_score != null ? String(Math.round(d.scores.master_score)) : "—", "#e3b341"],
                              ].map(([label, val, color]) => (
                                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                  <span style={{ color: "#8b949e" }}>{label}</span>
                                  <span style={{ fontWeight: 700, color: color as string, fontSize: 10 }}>{val}</span>
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                                <Link href={`/stock/${sym}`} style={{ flex: 1, background: "#0a2a4a", border: "1px solid #3b82f6", color: "#60a5fa", padding: "5px 0", borderRadius: 3, fontSize: 10, fontWeight: 700, textAlign: "center", textDecoration: "none", display: "block" }}>
                                  Detay ↗
                                </Link>
                                <Link href={`/terminal?ticker=${sym}`} style={{ flex: 1, background: "#0a2a0a", border: "1px solid #22c55e", color: "#4ade80", padding: "5px 0", borderRadius: 3, fontSize: 10, fontWeight: 700, textAlign: "center", textDecoration: "none", display: "block" }}>
                                  Chart ↗
                                </Link>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {/* Load more */}
          {tickers.length > visibleCount && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 0", borderTop: "1px solid #21262d", gap: 12 }}>
              <span style={{ fontSize: 11, color: "#8b949e" }}>
                {visibleCount} / {tickers.length} gösteriliyor
              </span>
              <button
                onClick={() => loadMore(tickers, visibleCount)}
                disabled={loadingMore}
                style={{
                  padding: "7px 20px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: `1px solid ${ACCENT}`, background: ACCENT + "18",
                  color: loadingMore ? "#8b949e" : ACCENT,
                  borderRadius: 4, cursor: loadingMore ? "default" : "pointer",
                  letterSpacing: "0.06em",
                }}
              >
                {loadingMore ? "Yükleniyor..." : `Sonraki ${Math.min(50, tickers.length - visibleCount)} Hisse ↓`}
              </button>
            </div>
          )}
          {tickers.length <= visibleCount && tickers.length > 0 && (
            <div style={{ textAlign: "center", padding: "10px 0", fontSize: 10, color: "#444" }}>
              Tüm {tickers.length} hisse gösteriliyor
            </div>
          )}

          {/* ── Hisse Ekle ── */}
          <div style={{
            marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 12,
            display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
          }}>
            <input
              value={addInput}
              onChange={e => setAddInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addCustomTicker(addInput)}
              placeholder="ticker ekle..."
              maxLength={8}
              style={{
                background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
                padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 120,
                outline: "none",
              }}
            />
            <button
              onClick={() => addCustomTicker(addInput)}
              style={{
                background: ACCENT + "20", border: `1px solid ${ACCENT}`,
                color: ACCENT, padding: "6px 16px", borderRadius: 4,
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace",
              }}
            >
              + EKLE
            </button>
            {customTickers.length > 0 && (
              <span style={{ color: "#8b949e", fontSize: 11 }}>{customTickers.length} özel hisse eklendi</span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
