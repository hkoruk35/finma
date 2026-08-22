"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTracker } from "@/components/TrackerContext";
import { useUserRole } from "@/hooks/useUserRole";
import Link from "next/link";
import * as XLSX from "xlsx";
import TickerHoverChart from "@/components/TickerHoverChart";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import { formatNumber } from "@/lib/formatNumber";
import { latestGeneratedAt, formatUpdatedAtET } from "@/lib/formatUpdatedAt";

// ── Types ──────────────────────────────────────────────────────────────────

interface HourlyBar {
  time: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  volume_ratio: number | null;
}

interface TrackerData {
  ticker: string;
  company: string;
  sector: string;
  generated_at?: string;
  price: { current: number; prev_close: number; change_pct: number; volume?: number };
  tracker_1h: {
    ema_20: number; ema_50: number; ema_200: number;
    ema_status: string; rsi: number; candle_pattern: string;
    signal: string; volume_ratio: number; change_pct_1h: number;
    change_pct_1d: number; volume_ratio_1d: number;
  };
  hourly?: HourlyBar[];
}

// ── Config ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Swing:  { bg: "#1c2a1c", text: "#3fb950" },
  Long:   { bg: "#1c2433", text: "#58a6ff" },
  Option: { bg: "#2a1c2a", text: "#d2a8ff" },
  CSP:    { bg: "#2a2010", text: "#e3b341" },
  CC:     { bg: "#2a1c1c", text: "#f0883e" },
};

const SIGNAL_ICON: Record<string, string> = { AL: "●", "İzle": "◑", Bekle: "○", SAT: "✕" };
const SIGNAL_COLOR: Record<string, string> = { AL: "#3fb950", "İzle": "#e3b341", Bekle: "#8b949e", SAT: "#f85149" };
const ROW_BG: Record<string, string> = { AL: "#0d1f0d", "İzle": "#1a1a0d", Bekle: "#0d1117", SAT: "#1f0d0d" };

const HOUR_SLOTS = ["09:15","10:00","11:00","12:00","13:00","14:00","15:00","16:00","16:15"];

const ACCENT = "#58a6ff";

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? formatNumber(n, 2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? formatNumber(n, 1) : "—");
const fmtVol = (v: number | null | undefined) => !v ? "—" : v >= 1e6 ? formatNumber(v / 1e6, 2) + "M" : v >= 1e3 ? formatNumber(v / 1e3, 1) + "K" : String(v);

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

function isMarketOpen() {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = h * 60 + m;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function TrackerPageClient() {
  const { tickers, types, removeFromTracker, updateType, addToTracker } = useTracker();
  const role = useUserRole();
  const isReadonly = role === "readonly";
  const [data, setData] = useState<Record<string, TrackerData>>({});
  const [loading, setLoading] = useState(false);
  // Verinin sunucudaki uretim zamani (ISO) — tarayici saati DEGIL.
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [filterSignal, setFilterSignal] = useState("");
  const [filterType, setFilterType] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");
  const [addInput, setAddInput] = useState("");
  const [addType, setAddType] = useState("Swing");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchData = useCallback(async () => {
    if (tickers.length === 0) { setData({}); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist-data?tickers=${tickers.join(",")}`);
      if (!res.ok) throw new Error();
      const results = await res.json();
      const map: Record<string, TrackerData> = {};
      results.forEach((item: TrackerData) => { if (item?.ticker) map[item.ticker] = item; });
      setData(map);
      setLastUpdated(latestGeneratedAt(results));
    } catch {}
    finally { setLoading(false); }
  }, [tickers]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const filtered = useMemo(() => tickers.filter(sym => {
    const d = data[sym];
    if (filterSignal && d?.tracker_1h?.signal !== filterSignal) return false;
    if (filterType && (types[sym] || "Swing") !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toUpperCase();
      if (!sym.includes(q) && !(d?.company || "").toUpperCase().includes(q) && !(d?.sector || "").toUpperCase().includes(q)) return false;
    }
    return true;
  }), [tickers, data, filterSignal, filterType, types, searchQuery]);

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const SIGNAL_RANK: Record<string, number> = { AL: 4, "İzle": 3, Bekle: 2, SAT: 1 };

  const sortedFiltered = useMemo(() => {
    if (!sortBy) return filtered;
    return [...filtered].sort((a, b) => {
      const da = data[a], db = data[b];
      let va: number, vb: number;
      switch (sortBy) {
        case "price":   va = da?.price?.current ?? 0;              vb = db?.price?.current ?? 0; break;
        case "volume":  va = da?.price?.volume ?? 0;               vb = db?.price?.volume ?? 0; break;
        case "chg1d":   va = da?.tracker_1h?.change_pct_1d ?? 0;   vb = db?.tracker_1h?.change_pct_1d ?? 0; break;
        case "goran":   va = da?.tracker_1h?.volume_ratio_1d ?? 0; vb = db?.tracker_1h?.volume_ratio_1d ?? 0; break;
        case "ema20":   va = da?.tracker_1h?.ema_20 ?? 0;          vb = db?.tracker_1h?.ema_20 ?? 0; break;
        case "ema50":   va = da?.tracker_1h?.ema_50 ?? 0;          vb = db?.tracker_1h?.ema_50 ?? 0; break;
        case "ema200":  va = da?.tracker_1h?.ema_200 ?? 0;         vb = db?.tracker_1h?.ema_200 ?? 0; break;
        case "rsi":     va = da?.tracker_1h?.rsi ?? 0;             vb = db?.tracker_1h?.rsi ?? 0; break;
        case "signal":  va = SIGNAL_RANK[da?.tracker_1h?.signal ?? ""] ?? 0; vb = SIGNAL_RANK[db?.tracker_1h?.signal ?? ""] ?? 0; break;
        default: return 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, data, sortBy, sortDir]);

  const alCount = filtered.filter(s => data[s]?.tracker_1h?.signal === "AL").length;
  const izleCount = filtered.filter(s => data[s]?.tracker_1h?.signal === "İzle").length;

  const handleAdd = () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym || tickers.includes(sym)) return;
    addToTracker(sym, addType);
    setAddInput("");
  };

  const downloadXLS = useCallback(() => {
    const rows = filtered.map(sym => {
      const d = data[sym];
      const signal = d?.tracker_1h?.signal || "—";
      const price = d?.price?.current ?? null;
      return {
        "TICKER": sym,
        "TİP": types[sym] || "Swing",
        "SEKTÖR": d?.sector && d.sector !== "Unknown" ? d.sector : (d?.company || "—"),
        "FİYAT": price != null ? price : "",
        "HACİM": d?.price?.volume != null ? d.price.volume : "",
        "Δ% 1G": d?.tracker_1h?.change_pct_1d != null ? d.tracker_1h.change_pct_1d : "",
        "G.ORAN": d?.tracker_1h?.volume_ratio_1d != null ? d.tracker_1h.volume_ratio_1d : "",
        "EMA20": d?.tracker_1h?.ema_20 != null ? d.tracker_1h.ema_20 : "",
        "EMA50": d?.tracker_1h?.ema_50 != null ? d.tracker_1h.ema_50 : "",
        "EMA200": d?.tracker_1h?.ema_200 != null ? d.tracker_1h.ema_200 : "",
        "DURUM": d?.tracker_1h?.ema_status || "—",
        "RSI": d?.tracker_1h?.rsi != null ? d.tracker_1h.rsi : "",
        "PATERN": d?.tracker_1h?.candle_pattern || "—",
        "SİNYAL": signal,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOGA Tracker");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `boga-tracker-${date}.xlsx`);
  }, [filtered, data, types]);

  if (!mounted) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1117" }}>
      <span style={{ color: "#3fb950", fontFamily: "monospace" }} className="animate-pulse">loading...</span>
    </div>
  );

  if (tickers.length === 0) return (
    <div style={{ background: "#0d1117", minHeight: "60vh", fontFamily: "monospace", color: "#e6edf3", padding: "40px 0" }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px", marginBottom: 6 }}>
        BOGA TRACKER — ACTIVE
      </div>
      <div style={{ color: "#8b949e", fontSize: 13, marginBottom: 20 }}>1H teknik analiz · gerçek zamanlı izleme</div>
      <div style={{ border: "1px solid #30363d", borderRadius: 6, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 32, color: ACCENT, opacity: 0.2, marginBottom: 12 }}>∅</div>
        <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 16 }}>Tracker listeniz boş.</p>
        <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 20 }}>Diğer sayfalardan "Active Tracker" butonunu kullanarak hisse ekleyin ya da aşağıdan ekleyin.</p>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          <input
            value={addInput}
            onChange={e => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="ticker..."
            maxLength={8}
            style={{
              background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
              padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 100, outline: "none"
            }}
          />
          <select value={addType} onChange={e => setAddType(e.target.value)}
            style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 8px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}>
            {["Swing","Long","Option","CSP","CC"].map(t => <option key={t}>{t}</option>)}
          </select>
          <button onClick={handleAdd}
            style={{ background: ACCENT + "20", border: `1px solid ${ACCENT}`, color: ACCENT, padding: "6px 16px", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}>
            + EKLE
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ background: "#0d1117", minHeight: "60vh", fontFamily: "monospace", color: "#e6edf3" }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #30363d", paddingBottom: 10, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px" }}>
              BOGA TRACKER — ACTIVE
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {formatUpdatedAtET(lastUpdated, "tr") && <span>son güncelleme: {formatUpdatedAtET(lastUpdated, "tr")}</span>}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>
                ● {isMarketOpen() ? "market açık" : "market kapalı"}
              </span>
              <span>{filtered.length} ticker</span>
              {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} AL</span>}
              {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} İzle</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {(["table", "heatmap"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid", borderColor: activeTab === tab ? ACCENT : "#30363d",
                  background: activeTab === tab ? ACCENT + "20" : "transparent",
                  color: activeTab === tab ? ACCENT : "#8b949e",
                  borderRadius: 4, cursor: "pointer", letterSpacing: "0.05em"
                }}>
                {tab === "table" ? "ANA TABLO" : "ISI HARİTASI"}
              </button>
            ))}
            <button onClick={fetchData} disabled={loading}
              style={{
                padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid #30363d", background: "transparent",
                color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer"
              }}>
              {loading ? "..." : "YENİLE"}
            </button>
            <button onClick={downloadXLS} disabled={filtered.length === 0}
              style={{
                padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid #3fb950", background: "#3fb95020",
                color: filtered.length === 0 ? "#8b949e" : "#3fb950",
                borderRadius: 4, cursor: filtered.length === 0 ? "not-allowed" : "pointer"
              }}>
              XLS ↓
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value.toUpperCase())}
            placeholder="hisse ara..."
            maxLength={12}
            style={{
              background: "#161b22", border: `1px solid ${searchQuery ? ACCENT : "#30363d"}`,
              color: "#e6edf3", padding: "3px 8px", borderRadius: 3,
              fontSize: 11, fontFamily: "monospace", width: 100, outline: "none"
            }}
          />
          <div style={{ width: 1, background: "#30363d", margin: "0 2px", alignSelf: "stretch" }} />
          {["", "Swing", "Long", "Option", "CSP", "CC"].map(t => (
            <button key={t || "all-type"} onClick={() => setFilterType(t)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid", borderColor: filterType === t ? ACCENT : "#30363d",
                background: filterType === t ? ACCENT + "20" : "transparent",
                color: filterType === t ? ACCENT : "#8b949e",
                borderRadius: 3, cursor: "pointer"
              }}>
              {t || "TÜM TİPLER"}
            </button>
          ))}
          <div style={{ width: 1, background: "#30363d", margin: "0 4px" }} />
          {["", "AL", "İzle", "Bekle", "SAT"].map(s => (
            <button key={s || "all-signal"} onClick={() => setFilterSignal(s)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid",
                borderColor: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) : "#30363d",
                background: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) + "20" : "transparent",
                color: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) : "#8b949e",
                borderRadius: 3, cursor: "pointer"
              }}>
              {s ? `${SIGNAL_ICON[s]} ${s}` : "TÜM SİNYAL"}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════ */}
      {/* ANA TABLO TAB                            */}
      {/* ════════════════════════════════════════ */}
      {activeTab === "table" && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  {([
                    { label: "TICKER",  key: null       , align: "left"  },
                    { label: "TİP",     key: null       , align: "left"  },
                    { label: "SEKTÖR",  key: null       , align: "left"  },
                    { label: "FİYAT",   key: "price"    , align: "right" },
                    { label: "HACİM",   key: "volume"   , align: "right" },
                    { label: "Δ% 1G",   key: "chg1d"   , align: "right" },
                    { label: "G.ORAN",  key: "goran"    , align: "right" },
                    { label: "EMA20",   key: "ema20"    , align: "right" },
                    { label: "EMA50",   key: "ema50"    , align: "right" },
                    { label: "EMA200",  key: "ema200"   , align: "right" },
                    { label: "DURUM (Trend)",   key: null       , align: "right" },
                    { label: "RSI",     key: "rsi"      , align: "right" },
                    { label: "PATERN (Günlük)",  key: null       , align: "right" },
                    { label: "SİNYAL (Günlük)",  key: "signal"   , align: "right" },
                    { label: "PRE",     key: null       , align: "right" },
                    { label: "",        key: null       , align: "right" },
                  ] as { label: string; key: string | null; align: string }[]).map(({ label, key, align }) => (
                    <th key={label || "del"} onClick={key ? () => toggleSort(key) : undefined} style={{
                      padding: "7px 8px", textAlign: align as "left" | "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: sortBy === key && key ? ACCENT : "#58a6ff",
                      whiteSpace: "nowrap", background: "#0d1117",
                      cursor: key ? "pointer" : "default",
                      userSelect: "none",
                    }}>
                      {label}{key && sortBy === key ? (sortDir === "desc" ? " ↓" : " ↑") : (key ? " ↕" : "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((sym, idx) => {
                  const d = data[sym];
                  const signal = d?.tracker_1h?.signal || "—";
                  const rowBg = ROW_BG[signal] || (idx % 2 === 1 ? "#161b22" : "#0d1117");
                  const bg = signal !== "—" ? rowBg : (idx % 2 === 1 ? "#161b22" : "#0d1117");
                  const isExpanded = expandedRow === sym;
                  const tipKey = types[sym] || "Swing";
                  const tipStyle = TYPE_COLORS[tipKey] || TYPE_COLORS.Swing;
                  const price = d?.price?.current ?? 0;

                  return (
                    <>
                      <tr
                        key={sym}
                        style={{ background: bg, borderBottom: isExpanded ? "none" : "1px solid #21262d", cursor: "pointer" }}
                        onClick={() => setExpandedRow(isExpanded ? null : sym)}
                      >
                        {/* TICKER */}
                        <td
                          style={{ padding: "7px 8px", whiteSpace: "nowrap" }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div>
                            <TickerHoverChart ticker={sym}>
                              <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 13 }}>{sym}</span>
                            </TickerHoverChart>
                            <span style={{ color: isExpanded ? "#3fb950" : "#8b949e", marginLeft: 6, fontSize: 10 }}>
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            {d && (
                              <div style={{ color: "#8b949e", fontSize: 10, marginTop: 1 }}>
                                {d.sector && d.sector !== "Unknown" ? d.sector.slice(0, 12) : (d.company?.slice(0, 12) || "")}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* TİP */}
                        <td style={{ padding: "7px 8px" }}>
                          <select
                            value={tipKey}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { e.stopPropagation(); updateType(sym, e.target.value); }}
                            style={{
                              background: tipStyle.bg, color: tipStyle.text,
                              border: "none", borderRadius: 3, fontSize: 10, fontWeight: 700,
                              padding: "2px 4px", cursor: "pointer", fontFamily: "monospace"
                            }}
                          >
                            {["Swing","Long","Option","CSP","CC"].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>

                        {/* SEKTÖR */}
                        <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 10, whiteSpace: "nowrap" }}>
                          {d?.sector && d.sector !== "Unknown" ? d.sector.toUpperCase().slice(0, 8) : (d?.company?.slice(0, 8) || "—")}
                        </td>

                        {/* FİYAT */}
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>
                          {d ? `$${fmt2(price)}` : <span style={{ color: "#8b949e" }}>—</span>}
                        </td>

                        {/* HACİM */}
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>
                          {fmtVol(d?.price?.volume)}
                        </td>

                        {/* Δ% 1G */}
                        <td style={{
                          padding: "7px 8px", textAlign: "right", fontWeight: 700,
                          color: !d ? "#8b949e" : (d.tracker_1h?.change_pct_1d ?? 0) >= 0 ? "#3fb950" : "#f85149"
                        }}>
                          {d ? `${(d.tracker_1h?.change_pct_1d ?? 0) >= 0 ? "+" : ""}${fmt2(d.tracker_1h?.change_pct_1d)}%` : "—"}
                        </td>

                        {/* G.ORAN */}
                        <td style={{
                          padding: "7px 8px", textAlign: "right",
                          color: !d ? "#8b949e" : (d.tracker_1h?.volume_ratio_1d ?? 0) >= 1.5 ? "#3fb950" : (d.tracker_1h?.volume_ratio_1d ?? 0) >= 0.8 ? "#e6edf3" : "#8b949e"
                        }}>
                          {d ? `${fmt2(d.tracker_1h?.volume_ratio_1d)}x` : "—"}
                        </td>

                        {/* EMA20 */}
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_20) : "#8b949e" }}>
                          {d ? `${fmt2(d.tracker_1h?.ema_20)}${emaArrow(price, d.tracker_1h?.ema_20)}` : "—"}
                        </td>

                        {/* EMA50 */}
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_50) : "#8b949e" }}>
                          {d ? `${fmt2(d.tracker_1h?.ema_50)}${emaArrow(price, d.tracker_1h?.ema_50)}` : "—"}
                        </td>

                        {/* EMA200 */}
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_200) : "#8b949e" }}>
                          {d ? `${fmt2(d.tracker_1h?.ema_200)}${emaArrow(price, d.tracker_1h?.ema_200)}` : "—"}
                        </td>

                        {/* DURUM */}
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>
                          {d && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                              background: d.tracker_1h?.ema_status === "Bullish" ? "#1a3a1a" : d.tracker_1h?.ema_status === "BullishWeak" ? "#1c2e1c" : d.tracker_1h?.ema_status === "Neutral" ? "#1a1a2e" : d.tracker_1h?.ema_status === "BearishWeak" ? "#2e1a1a" : "#3a1a1a",
                              color: d.tracker_1h?.ema_status === "Bullish" ? "#3fb950" : d.tracker_1h?.ema_status === "BullishWeak" ? "#56d364" : d.tracker_1h?.ema_status === "Neutral" ? "#8b949e" : d.tracker_1h?.ema_status === "BearishWeak" ? "#f85149" : "#ff7b72",
                            }}>
                              {d.tracker_1h?.ema_status}
                            </span>
                          )}
                        </td>

                        {/* RSI */}
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? rsiColor(d.tracker_1h?.rsi ?? 50) : "#8b949e" }}>
                          {d ? fmt1(d.tracker_1h?.rsi) : "—"}
                        </td>

                        {/* PATERN */}
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>
                          {d?.tracker_1h?.candle_pattern || "—"}
                        </td>

                        {/* SİNYAL */}
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>
                          {d && (
                            <span style={{ fontWeight: 900, fontSize: 12, color: SIGNAL_COLOR[signal] || "#8b949e" }}>
                              {SIGNAL_ICON[signal] || "○"} {signal}
                            </span>
                          )}
                        </td>

                        {/* PRE-ORDER */}
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>
                          <a
                            href={`/preorder/${sym}`}
                            onClick={e => e.stopPropagation()}
                            style={{
                              background: "transparent", border: "1px solid #3b82f666", color: "#3b82f6",
                              borderRadius: 3, padding: "1px 7px", fontSize: 10, cursor: "pointer",
                              fontFamily: "monospace", fontWeight: 700, textDecoration: "none", display: "inline-block"
                            }}
                          >📋</a>
                        </td>

                        {/* REMOVE */}
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>
                          {!isReadonly && (
                            <button
                              onClick={e => { e.stopPropagation(); removeFromTracker(sym); }}
                              style={{
                                background: "transparent", border: "1px solid #f85149", color: "#f85149",
                                borderRadius: 3, padding: "1px 6px", fontSize: 10, cursor: "pointer", fontFamily: "monospace"
                              }}
                            >✕</button>
                          )}
                        </td>
                      </tr>

                      {/* ── Genişleyen Satır ── */}
                      {isExpanded && (
                        <tr key={sym + "-expanded"} style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
                          <td colSpan={16} style={{ padding: 0 }}>
                            <TrackerExpandedRow sym={sym} d={d} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "#8b949e", fontSize: 12 }}>Veriler yükleniyor...</div>
          )}

          {/* ── Add Ticker Form ── */}
          <div style={{ marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {isReadonly ? (
            <span style={{ color: "#8b949e", fontSize: 11 }}>{tickers.length} hisse takipte</span>
          ) : (<>
            <input
              value={addInput}
              onChange={e => setAddInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder="ticker..."
              maxLength={8}
              style={{
                background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
                padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 100, outline: "none"
              }}
            />
            <select value={addType} onChange={e => setAddType(e.target.value)}
              style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 8px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}>
              {["Swing","Long","Option","CSP","CC"].map(t => <option key={t}>{t}</option>)}
            </select>
            <button onClick={handleAdd}
              style={{ background: ACCENT + "20", border: `1px solid ${ACCENT}`, color: ACCENT, padding: "6px 16px", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}>
              + EKLE
            </button>
            <span style={{ color: "#8b949e", fontSize: 11 }}>{tickers.length} hisse takipte</span>
          </>) }
          </div>
        </>
      )}

      {/* ════════════════════════════════════════ */}
      {/* ISI HARİTASI TAB                         */}
      {/* ════════════════════════════════════════ */}
      {activeTab === "heatmap" && (
        <TrackerHeatmapTab tickers={filtered} data={data} types={types} />
      )}

    </div>
  );
}


// ── Expanded Row ───────────────────────────────────────────────────────────

function TrackerExpandedRow({ sym, d }: { sym: string; d: TrackerData | undefined }) {
  return (
    <div style={{ display: "flex", gap: 0, background: "#161b22" }}>
      {/* Hourly Grid */}
      <div style={{ flex: 1, padding: "12px 16px", borderRight: "1px solid #30363d" }}>
        <div style={{ fontSize: 10, color: "#58a6ff", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>
          SAATLİK ÖZET — {sym}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 10, fontFamily: "monospace" }}>
            <thead>
              <tr>
                {HOUR_SLOTS.map(h => (
                  <th key={h} style={{ padding: "3px 8px", color: "#8b949e", fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", borderBottom: "1px solid #30363d" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {HOUR_SLOTS.map((h, i) => {
                  const bar = d?.hourly?.[i];
                  const { bg, text } = heatBg(bar?.change_pct ?? null);
                  return (
                    <td key={h} style={{ padding: "4px 8px", textAlign: "center", background: bg, color: text, fontWeight: 700, minWidth: 52 }}>
                      {bar?.price != null ? `$${formatNumber(bar.price, 2)}` : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                {HOUR_SLOTS.map((h, i) => {
                  const bar = d?.hourly?.[i];
                  const { bg, text } = heatBg(bar?.change_pct ?? null);
                  return (
                    <td key={h} style={{ padding: "3px 8px", textAlign: "center", background: bg, color: text, fontSize: 10 }}>
                      {bar?.change_pct != null ? `${bar.change_pct >= 0 ? "+" : ""}${formatNumber(bar.change_pct, 1)}%` : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                {HOUR_SLOTS.map((h, i) => {
                  const bar = d?.hourly?.[i];
                  return (
                    <td key={h} style={{ padding: "3px 8px", textAlign: "center", color: "#8b949e", fontSize: 10 }}>
                      {bar?.volume != null ? fmtVol(bar.volume) : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                {HOUR_SLOTS.map((h, i) => {
                  const bar = d?.hourly?.[i];
                  const vr = bar?.volume_ratio;
                  return (
                    <td key={h} style={{ padding: "3px 8px", textAlign: "center", color: vr == null ? "#333" : vr >= 1.5 ? "#3fb950" : "#8b949e", fontSize: 10 }}>
                      {vr != null ? `${formatNumber(vr, 1)}x` : "—"}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {!d?.hourly && (
          <p style={{ color: "#8b949e", fontSize: 10, marginTop: 8 }}>Saatlik veriler yakında eklenecek.</p>
        )}
        {d && (
          <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 10, color: "#8b949e" }}>
            <span>EMA: <b style={{ color: d.tracker_1h?.ema_status === "Bullish" ? "#3fb950" : d.tracker_1h?.ema_status?.includes("Düşüş") || d.tracker_1h?.ema_status === "Bearish" ? "#f85149" : "#8b949e" }}>{d.tracker_1h?.ema_status}</b></span>
            <span>RSI: <b style={{ color: rsiColor(d.tracker_1h?.rsi ?? 50) }}>{fmt1(d.tracker_1h?.rsi)}</b></span>
            <span>Patern: <b style={{ color: "#e6edf3" }}>{d.tracker_1h?.candle_pattern || "—"}</b></span>
            <span>Hacim: <b style={{ color: (d.tracker_1h?.volume_ratio ?? 0) >= 1.5 ? "#3fb950" : "#8b949e" }}>{fmt2(d.tracker_1h?.volume_ratio)}x</b></span>
          </div>
        )}
      </div>

      {/* BOGA Chart */}
      <div style={{ width: 420, flexShrink: 0, padding: "12px 16px" }}>
        <div style={{ fontSize: 10, color: "#58a6ff", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>
          1H GRAFİK — EMA 20/50/200
        </div>
        <div style={{ width: 410, height: 220, border: "1px solid #30363d", borderRadius: 4, overflow: "hidden" }}>
          <BogaChartEngine symbol={sym} interval="60" height={220} compact showToolbar={false} indicators={["ema20", "ema50", "ema200"]} />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Link href={`/global/en/graphic/${sym}`}
            style={{ color: "#58a6ff", fontSize: 10, textDecoration: "none" }}>Chart Detail ↗</Link>
          <Link href={`/en/analysis/${sym.toLowerCase()}`}
            style={{ color: "#58a6ff", fontSize: 10, textDecoration: "none" }}>BOGA Analiz ↗</Link>
          <Link href={`/optanaliz?symbol=${sym}`}
            style={{ color: "#d2a8ff", fontSize: 10, textDecoration: "none" }}>OptAnaliz ↗</Link>
        </div>
      </div>
    </div>
  );
}

// ── Heat Map Tab ───────────────────────────────────────────────────────────

function TrackerHeatmapTab({ tickers, data, types }: { tickers: string[]; data: Record<string, TrackerData>; types: Record<string, string> }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 12 }}>
        Gün sonu saatlik Δ% ısı haritası — her hücre o saatin değişimini gösterir
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", minWidth: 750 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #30363d" }}>
              <th style={{ padding: "6px 10px", textAlign: "left", color: "#58a6ff", fontSize: 10, letterSpacing: "0.1em" }}>TICKER</th>
              <th style={{ padding: "6px 8px", textAlign: "left", color: "#58a6ff", fontSize: 10 }}>TİP</th>
              {HOUR_SLOTS.map(h => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "center", color: "#58a6ff", fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
              ))}
              <th style={{ padding: "6px 10px", textAlign: "right", color: "#58a6ff", fontSize: 10 }}>GÜN</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map((sym, idx) => {
              const d = data[sym];
              const dayPct = d?.price?.change_pct ?? null;
              const dayColors = heatBg(dayPct);
              const tipKey = types[sym] || "Swing";
              const tipStyle = TYPE_COLORS[tipKey] || TYPE_COLORS.Swing;

              return (
                <tr key={sym} style={{ background: idx % 2 === 1 ? "#161b22" : "#0d1117", borderBottom: "1px solid #21262d" }}>
                  <td style={{ padding: "6px 10px" }}>
                    <Link href={`/en/analysis/${sym.toLowerCase()}`} style={{ color: "#58a6ff", fontWeight: 900 }}>{sym}</Link>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ background: tipStyle.bg, color: tipStyle.text, fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 2 }}>
                      {tipKey}
                    </span>
                  </td>
                  {HOUR_SLOTS.map((h, i) => {
                    const bar = d?.hourly?.[i];
                    const pct = bar?.change_pct ?? null;
                    const { bg, text } = heatBg(pct);
                    return (
                      <td key={h} style={{ padding: "6px 10px", textAlign: "center", background: bg, color: text, fontSize: 10, fontWeight: 700, minWidth: 58 }}>
                        {pct != null ? `${pct >= 0 ? "+" : ""}${formatNumber(pct, 1)}%` : <span style={{ color: "#333" }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "6px 10px", textAlign: "right", background: dayColors.bg, color: dayColors.text, fontWeight: 700 }}>
                    {dayPct != null ? `${dayPct >= 0 ? "+" : ""}${formatNumber(dayPct, 1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { label: "+2%+", bg: "#0d4a0d", text: "#56d364" },
          { label: "+1–2%", bg: "#0d3a0d", text: "#3fb950" },
          { label: "+0.3–1%", bg: "#0d2a0d", text: "#3fb950" },
          { label: "±0.3%", bg: "#1a1a1a", text: "#8b949e" },
          { label: "-0.3–1%", bg: "#2a0d0d", text: "#f85149" },
          { label: "-1–2%", bg: "#3a0d0d", text: "#f85149" },
          { label: "-2%+", bg: "#4a0d0d", text: "#ff7b72" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 14, height: 14, background: item.bg, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: item.text }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
