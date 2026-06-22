"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import TickerHoverChart from "@/components/TickerHoverChart";

// ── Types ──────────────────────────────────────────────────────────────────

interface StatusHistoryItem {
  hour: string;
  status: string;
  price: number;
}

interface IntradayData {
  rsi_1h: number;
  adx_1h: number;
  volume_ratio: number;
  change_1h: number;
  change_24h: number;
  trend_1h: string;
  setup: string;
  pattern_15m?: string;
  rs_score: number;
  natr: number;
  // GAP-UP / PRE-GAP skoru (5 bileşen, 0-15)
  pre_gap_total?: number;
  pre_gap_grade?: string;
  gap_pct?: number;
  gap_score?: number;
  hourly_strength_pct?: number;
  hourly_score?: number;
  daily_rvol?: number;
  daily_rvol_score?: number;
  close_to_high_pct?: number;
  close_to_high_score?: number;
  late_volume_ratio?: number;
  late_volume_score?: number;
}

interface TickerRow {
  ticker: string;
  company: string;
  sector: string;
  swing_pick_date: string;
  first_seen: string;
  first_seen_price: number;
  entry_price: number | null;
  entry_triggered_at: string | null;
  current_price: number;
  current_status: string;
  current_detail: string;
  alert_level: string;
  pnl_pct: number;
  buy_zone: { low?: number; high?: number };
  stop_zone: { low?: number; high?: number };
  profit_zone: { low?: number; high?: number };
  status_history: StatusHistoryItem[];
  intraday: IntradayData;
  notes: string[];
}

interface DayData {
  date: string;
  market_regime: string;
  vix_level: number;
  hour_slots: string[];
  tickers: TickerRow[];
  total: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ENTRY_NOW:    { bg: "#0d2a0d", text: "#56d364", border: "#3fb950" },
  ENTRY_WATCH:  { bg: "#1a1a0d", text: "#e3b341", border: "#b8941f" },
  HOLD:         { bg: "#0d1a2a", text: "#58a6ff", border: "#3b82f6" },
  WAIT:         { bg: "#161b22", text: "#8b949e", border: "#30363d" },
  TAKE_PROFIT:  { bg: "#0d0d2a", text: "#d2a8ff", border: "#8b5cf6" },
  STOP_HIT:     { bg: "#2a0d0d", text: "#f85149", border: "#ef4444" },
  NEUTRAL:      { bg: "#161b22", text: "#8b949e", border: "#30363d" },
};

const ALERT_BADGE: Record<string, { bg: string; text: string }> = {
  HIGH:   { bg: "#0d2a0d", text: "#56d364" },
  MEDIUM: { bg: "#2a1a0d", text: "#e3b341" },
  LOW:    { bg: "#161b22", text: "#8b949e" },
};

const GAP_GRADE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  "A+": { bg: "#0d4a0d", text: "#56d364", border: "#3fb950" },
  "A":  { bg: "#0d2a0d", text: "#3fb950", border: "#2ea043" },
  "B":  { bg: "#1a1a0d", text: "#e3b341", border: "#b8941f" },
  "C":  { bg: "#161b22", text: "#555", border: "#30363d" },
};

const REGIME_COLORS: Record<string, string> = {
  Bull: "#3fb950",
  Bear: "#f85149",
  Neutral: "#e3b341",
  Unknown: "#8b949e",
};

const fmt2 = (n: number | null | undefined) =>
  n != null && isFinite(n) ? n.toFixed(2) : "—";
const fmt1 = (n: number | null | undefined) =>
  n != null && isFinite(n) ? n.toFixed(1) : "—";
const pctColor = (v: number) => (v >= 0 ? "#3fb950" : "#f85149");

function heatCell(status: string) {
  switch (status) {
    case "ENTRY_NOW":   return { bg: "#0d4a0d", text: "#56d364" };
    case "ENTRY_WATCH": return { bg: "#2a2000", text: "#e3b341" };
    case "HOLD":        return { bg: "#0d1a3a", text: "#58a6ff" };
    case "TAKE_PROFIT": return { bg: "#1a0d3a", text: "#d2a8ff" };
    case "STOP_HIT":    return { bg: "#3a0d0d", text: "#f85149" };
    case "WAIT":        return { bg: "#1a1a1a", text: "#555" };
    default:            return { bg: "#111", text: "#333" };
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ENTRY_NOW:   "🚀 GİRİŞ",
    ENTRY_WATCH: "👁 İZLE",
    HOLD:        "🤝 TUT",
    WAIT:        "⏳ BEKLE",
    TAKE_PROFIT: "💰 KAR AL",
    STOP_HIT:    "🛑 STOP",
    NEUTRAL:     "—",
  };
  return map[status] || status;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DailyTrackerClient() {
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState("today");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>("alert");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isMarketOpen = () => {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 9 * 60 + 30 && mins < 16 * 60;
  };

  const fetchDates = useCallback(async () => {
    try {
      const res = await fetch("/api/daily?mode=dates");
      if (res.ok) {
        const d = await res.json();
        setAvailableDates(d.dates || []);
      }
    } catch {}
  }, []);

  const fetchDay = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily?date=${date}`);
      if (res.ok) {
        const d: DayData = await res.json();
        setDayData(d);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error("[DailyTracker] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDates();
    fetchDay(selectedDate);
  }, [fetchDates, fetchDay, selectedDate]);

  // Auto-refresh when market open
  useEffect(() => {
    if (selectedDate !== "today") return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isMarketOpen()) {
      intervalRef.current = setInterval(() => fetchDay("today"), 5 * 60 * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedDate, fetchDay]);

  // ── Sorting ──
  const sorted = [...(dayData?.tickers || [])].sort((a, b) => {
    const alertOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const statusOrder: Record<string, number> = { ENTRY_NOW: 5, ENTRY_WATCH: 4, HOLD: 3, TAKE_PROFIT: 2, WAIT: 1, STOP_HIT: 0 };

    let va: any, vb: any;
    switch (sortBy) {
      case "alert":    va = alertOrder[a.alert_level] ?? 0; vb = alertOrder[b.alert_level] ?? 0; break;
      case "status":   va = statusOrder[a.current_status] ?? 0; vb = statusOrder[b.current_status] ?? 0; break;
      case "ticker":   va = a.ticker; vb = b.ticker; break;
      case "pnl":      va = a.pnl_pct; vb = b.pnl_pct; break;
      case "price":    va = a.current_price; vb = b.current_price; break;
      case "rsi":      va = a.intraday?.rsi_1h ?? 0; vb = b.intraday?.rsi_1h ?? 0; break;
      case "vol":      va = a.intraday?.volume_ratio ?? 0; vb = b.intraday?.volume_ratio ?? 0; break;
      case "first":    va = a.first_seen; vb = b.first_seen; break;
      case "gap":      va = a.intraday?.pre_gap_total ?? 0; vb = b.intraday?.pre_gap_total ?? 0; break;
      default: return 0;
    }
    if (typeof va === "string") {
      const cmp = va.localeCompare(vb);
      return sortDir === "asc" ? cmp : -cmp;
    }
    const diff = va - vb;
    return sortDir === "asc" ? diff : -diff;
  });

  const filtered = sorted.filter(t => !filterStatus || t.current_status === filterStatus);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const entryCount = filtered.filter(t => t.current_status === "ENTRY_NOW").length;
  const watchCount = filtered.filter(t => t.current_status === "ENTRY_WATCH").length;
  const stopCount  = filtered.filter(t => t.current_status === "STOP_HIT").length;

  // ── Hour slots for heatmap ──
  const allHours = dayData?.hour_slots || [];

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", fontFamily: "monospace", color: "#e6edf3", padding: "0 16px 40px" }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #30363d", paddingBottom: 10, marginBottom: 12, paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>
          <Link href="/" style={{ color: "#58a6ff" }}>BOGA AI</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#e3b341" }}>DAILY TRACKER</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#e3b341", letterSpacing: "-0.5px" }}>
                📊 BOGA DAILY TRACKER
              </span>
              {dayData && (
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 3,
                  background: REGIME_COLORS[dayData.market_regime] + "22",
                  border: `1px solid ${REGIME_COLORS[dayData.market_regime]}`,
                  color: REGIME_COLORS[dayData.market_regime]
                }}>
                  {dayData.market_regime} | VIX {fmt2(dayData.vix_level)}
                </span>
              )}
            </div>

            {/* Date Selector */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <button
                onClick={() => setSelectedDate("today")}
                style={{
                  padding: "4px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid", cursor: "pointer", borderRadius: 3,
                  borderColor: selectedDate === "today" ? "#e3b341" : "#30363d",
                  background: selectedDate === "today" ? "#e3b34122" : "transparent",
                  color: selectedDate === "today" ? "#e3b341" : "#8b949e",
                }}
              >🔴 BUGÜN</button>
              {availableDates.slice(0, 10).map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  style={{
                    padding: "4px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                    border: "1px solid", cursor: "pointer", borderRadius: 3,
                    borderColor: selectedDate === d ? "#58a6ff" : "#30363d",
                    background: selectedDate === d ? "#58a6ff22" : "transparent",
                    color: selectedDate === d ? "#58a6ff" : "#8b949e",
                  }}
                >{d}</button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#8b949e", display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lastUpdated && <span>güncelleme: {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} ET</span>}
              <span style={{ color: isMarketOpen() && selectedDate === "today" ? "#3fb950" : "#f85149" }}>
                ● {isMarketOpen() && selectedDate === "today" ? "AÇIK" : "KAPALI"}
              </span>
              {dayData && <span>{dayData.total} hisse takipte</span>}
              {entryCount > 0 && <span style={{ color: "#56d364" }}>🚀 {entryCount} GİRİŞ</span>}
              {watchCount > 0 && <span style={{ color: "#e3b341" }}>👁 {watchCount} İZLE</span>}
              {stopCount > 0  && <span style={{ color: "#f85149" }}>🛑 {stopCount} STOP</span>}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {(["table", "heatmap"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid",
                  borderColor: activeTab === tab ? "#e3b341" : "#30363d",
                  background: activeTab === tab ? "#e3b34122" : "transparent",
                  color: activeTab === tab ? "#e3b341" : "#8b949e",
                  borderRadius: 4, cursor: "pointer",
                }}
              >
                {tab === "table" ? "ANA TABLO" : "ISI HARİTASI"}
              </button>
            ))}
            <button
              onClick={() => fetchDay(selectedDate)}
              disabled={loading}
              style={{
                padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid #30363d", background: "transparent",
                color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer"
              }}
            >
              {loading ? "..." : "🔄 YENİLE"}
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {[
            { k: "", label: "TÜM DURUM" },
            { k: "ENTRY_NOW",   label: "🚀 GİRİŞ" },
            { k: "ENTRY_WATCH", label: "👁 İZLE" },
            { k: "HOLD",        label: "🤝 TUT" },
            { k: "TAKE_PROFIT", label: "💰 KAR AL" },
            { k: "WAIT",        label: "⏳ BEKLE" },
            { k: "STOP_HIT",    label: "🛑 STOP" },
          ].map(({ k, label }) => {
            const s = STATUS_COLORS[k] || { border: "#30363d", bg: "transparent", text: "#8b949e" };
            const active = filterStatus === k;
            return (
              <button key={k || "all"}
                onClick={() => setFilterStatus(k)}
                style={{
                  padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                  border: `1px solid ${active ? s.border : "#30363d"}`,
                  background: active ? s.bg : "transparent",
                  color: active ? s.text : "#8b949e",
                  borderRadius: 3, cursor: "pointer",
                }}
              >{label}</button>
            );
          })}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#e3b341", fontSize: 13 }}>
          <span className="animate-pulse">Yükleniyor...</span>
        </div>
      )}

      {/* ── No data ── */}
      {!loading && !dayData && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>📭</div>
          <p style={{ color: "#8b949e", fontSize: 13 }}>Bu tarih için veri bulunamadı.</p>
          <p style={{ color: "#8b949e", fontSize: 11, marginTop: 4 }}>inday313 botu henüz çalışmamış olabilir.</p>
        </div>
      )}

      {/* ══ TABLE TAB ══ */}
      {!loading && dayData && activeTab === "table" && (
        <div style={{ overflowX: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#8b949e", fontSize: 12 }}>
              Filtreye uyan hisse yok.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 1000 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  {[
                    { label: "TİCKER",  key: "ticker",  align: "left"  },
                    { label: "ŞİRKET",  key: null,      align: "left"  },
                    { label: "SEKTÖR",  key: null,      align: "left"  },
                    { label: "İLK GÖR", key: "first",  align: "right" },
                    { label: "GİRİŞ",   key: null,      align: "right" },
                    { label: "FİYAT",   key: "price",   align: "right" },
                    { label: "KAR/Z%",  key: "pnl",     align: "right" },
                    { label: "1H Δ%",   key: null,      align: "right" },
                    { label: "RSI",     key: "rsi",     align: "right" },
                    { label: "VOL×",    key: "vol",     align: "right" },
                    { label: "ADX",     key: null,      align: "right" },
                    { label: "15M PATERN", key: null,   align: "right" },
                    { label: "SETUP",   key: null,      align: "right" },
                    { label: "GAP",     key: "gap",     align: "right" },
                    { label: "ALERT",   key: "alert",   align: "right" },
                    { label: "📋",      key: null,      align: "right" },
                  ].map(({ label, key, align }, i) => (
                    <th key={i}
                      onClick={() => key && toggleSort(key)}
                      style={{
                        padding: "6px 8px", textAlign: align as any,
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                        color: sortBy === key ? "#ffd700" : "#e3b341",
                        background: "#0d1117",
                        cursor: key ? "pointer" : "default",
                        userSelect: "none", whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                      {sortBy === key && <span style={{ fontSize: 8, marginLeft: 2 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tk, idx) => {
                  const altBg = idx % 2 === 1 ? "#161b22" : "#0d1117";
                  const isExp = expandedRow === tk.ticker;

                  return (
                    <>
                      <tr
                        key={tk.ticker}
                        style={{ background: altBg, borderBottom: isExp ? "none" : "1px solid #21262d", cursor: "pointer" }}
                        onClick={() => setExpandedRow(isExp ? null : tk.ticker)}
                      >
                        {/* TICKER */}
                        <td style={{ padding: "6px 8px" }}>
                          <TickerHoverChart ticker={tk.ticker}>
                            <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 12 }}>{tk.ticker}</span>
                          </TickerHoverChart>
                          {isExp && <span style={{ color: "#e3b341", marginLeft: 4, fontSize: 9 }}>▼</span>}
                          {!isExp && <span style={{ color: "#8b949e", marginLeft: 4, fontSize: 9 }}>▶</span>}
                        </td>

                        {/* ŞIRKET */}
                        <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 10, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tk.company !== tk.ticker ? tk.company?.slice(0, 14) : "—"}
                        </td>

                        {/* SEKTÖR */}
                        <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 9, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tk.sector !== "Unknown" ? tk.sector?.slice(0, 12) : "—"}
                        </td>

                        {/* İLK GÖR */}
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 10 }}>
                          {tk.first_seen}
                        </td>

                        {/* GİRİŞ FİYAT */}
                        <td style={{ padding: "6px 8px", textAlign: "right", color: tk.entry_price ? "#56d364" : "#8b949e", fontSize: 10 }}>
                          {tk.entry_price ? `$${fmt2(tk.entry_price)}` : "—"}
                        </td>

                        {/* GÜNCEL FİYAT */}
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#e6edf3" }}>
                          ${fmt2(tk.current_price)}
                        </td>

                        {/* KAR/ZARAR */}
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: pctColor(tk.pnl_pct) }}>
                          {tk.entry_price
                            ? `${tk.pnl_pct >= 0 ? "+" : ""}${fmt2(tk.pnl_pct)}%`
                            : <span style={{ color: "#8b949e" }}>—</span>}
                        </td>

                        {/* 1H Δ% */}
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: pctColor(tk.intraday?.change_1h ?? 0) }}>
                          {tk.intraday?.change_1h != null
                            ? `${tk.intraday.change_1h >= 0 ? "+" : ""}${fmt2(tk.intraday.change_1h)}%`
                            : "—"}
                        </td>

                        {/* RSI */}
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700,
                          color: (tk.intraday?.rsi_1h ?? 50) >= 70 ? "#f85149" : (tk.intraday?.rsi_1h ?? 50) >= 50 ? "#3fb950" : "#e3b341"
                        }}>
                          {fmt1(tk.intraday?.rsi_1h)}
                        </td>

                        {/* VOL× */}
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700,
                          color: (tk.intraday?.volume_ratio ?? 0) >= 1.5 ? "#3fb950" : (tk.intraday?.volume_ratio ?? 0) >= 0.8 ? "#e6edf3" : "#8b949e"
                        }}>
                          {fmt2(tk.intraday?.volume_ratio)}x
                        </td>

                        {/* ADX */}
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 10 }}>
                          {fmt1(tk.intraday?.adx_1h)}
                        </td>

                        {/* 15M PATERN */}
                        <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 9, maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {tk.intraday?.pattern_15m && !["NONE", "Neutral", "Insufficient Data", "Pattern Error"].includes(tk.intraday.pattern_15m)
                            ? <span style={{ color: "#58a6ff", fontWeight: 700 }}>{tk.intraday.pattern_15m}</span>
                            : <span style={{ color: "#555" }}>—</span>}
                        </td>

                        {/* SETUP */}
                        <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 9 }}>
                          {tk.intraday?.setup && tk.intraday.setup !== "NONE"
                            ? <span style={{ color: "#e3b341", fontWeight: 700 }}>{tk.intraday.setup}</span>
                            : <span style={{ color: "#555" }}>—</span>}
                        </td>

                        {/* GAP — PRE-GAP / GAP-UP skoru (0-15, A+/A/B/C) */}
                        <td style={{ padding: "6px 8px", textAlign: "right" }} title={`GAP-UP: ${tk.intraday?.pre_gap_total ?? 0}/15`}>
                          {(() => {
                            const grade = tk.intraday?.pre_gap_grade;
                            if (!grade) return <span style={{ color: "#555", fontSize: 9 }}>—</span>;
                            const g = GAP_GRADE_BADGE[grade] || GAP_GRADE_BADGE.C;
                            return (
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 2,
                                background: g.bg, border: `1px solid ${g.border}`, color: g.text,
                              }}>
                                {grade} {tk.intraday?.pre_gap_total ?? 0}
                              </span>
                            );
                          })()}
                        </td>

                        {/* ALERT */}
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          {(() => {
                            const a = ALERT_BADGE[tk.alert_level] || ALERT_BADGE.LOW;
                            return (
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 2,
                                background: a.bg, color: a.text,
                              }}>
                                {tk.alert_level}
                              </span>
                            );
                          })()}
                        </td>

                        {/* NOTES ICON */}
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 10 }}>
                          {(tk.notes?.length ?? 0) > 0 ? `📋 ${tk.notes.length}` : "—"}
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExp && (
                        <tr key={tk.ticker + "-exp"} style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
                          <td colSpan={16} style={{ padding: 0 }}>
                            <ExpandedRow tk={tk} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ HEATMAP TAB ══ */}
      {!loading && dayData && activeTab === "heatmap" && (
        <HeatmapView tickers={filtered} hourSlots={allHours} />
      )}
    </div>
  );
}

// ── Expanded Row ───────────────────────────────────────────────────────────

function ExpandedRow({ tk }: { tk: TickerRow }) {
  const hasZones = tk.buy_zone?.low || tk.stop_zone?.high || tk.profit_zone?.low;

  return (
    <div style={{ display: "flex", gap: 0, background: "#161b22", flexWrap: "wrap" }}>

      {/* Status Timeline */}
      <div style={{ flex: 1, minWidth: 240, padding: "12px 16px", borderRight: "1px solid #30363d" }}>
        <div style={{ fontSize: 9, color: "#e3b341", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>
          DURUM GEÇMİŞİ — {tk.ticker}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(tk.status_history || []).map((h, i) => {
            const { bg, text } = heatCell(h.status);
            return (
              <div key={i} style={{
                padding: "4px 8px", borderRadius: 3, background: bg, border: `1px solid ${text}30`,
                textAlign: "center", minWidth: 60,
              }}>
                <div style={{ fontSize: 9, color: "#8b949e", marginBottom: 2 }}>{h.hour}</div>
                <div style={{ fontSize: 8, color: text, fontWeight: 700 }}>{statusLabel(h.status)}</div>
                <div style={{ fontSize: 9, color: "#e6edf3" }}>${h.price?.toFixed(2) ?? "—"}</div>
              </div>
            );
          })}
          {tk.status_history.length === 0 && (
            <span style={{ color: "#555", fontSize: 11 }}>Geçmiş yok</span>
          )}
        </div>
      </div>

      {/* Zones */}
      {hasZones && (
        <div style={{ minWidth: 200, padding: "12px 16px", borderRight: "1px solid #30363d" }}>
          <div style={{ fontSize: 9, color: "#e3b341", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>
            BÖLGELER
          </div>
          {tk.buy_zone?.low != null && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: "#8b949e" }}>Alım: </span>
              <span style={{ fontSize: 10, color: "#3fb950", fontWeight: 700 }}>
                ${tk.buy_zone.low?.toFixed(2)} – ${tk.buy_zone.high?.toFixed(2)}
              </span>
            </div>
          )}
          {tk.stop_zone?.high != null && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: "#8b949e" }}>Stop: </span>
              <span style={{ fontSize: 10, color: "#f85149", fontWeight: 700 }}>
                ${tk.stop_zone.low?.toFixed(2)} – ${tk.stop_zone.high?.toFixed(2)}
              </span>
            </div>
          )}
          {tk.profit_zone?.low != null && (
            <div>
              <span style={{ fontSize: 9, color: "#8b949e" }}>Hedef: </span>
              <span style={{ fontSize: 10, color: "#d2a8ff", fontWeight: 700 }}>
                ${tk.profit_zone.low?.toFixed(2)} – ${(tk.profit_zone as any).high?.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* GAP-UP / PRE-GAP Skoru */}
      {tk.intraday?.pre_gap_grade && (
        <div style={{ minWidth: 260, padding: "12px 16px", borderRight: "1px solid #30363d" }}>
          <div style={{ fontSize: 9, color: "#e3b341", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            GAP-UP SKORU
            {(() => {
              const g = GAP_GRADE_BADGE[tk.intraday.pre_gap_grade!] || GAP_GRADE_BADGE.C;
              return (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: g.bg, border: `1px solid ${g.border}`, color: g.text }}>
                  {tk.intraday.pre_gap_grade} · {tk.intraday.pre_gap_total ?? 0}/15
                </span>
              );
            })()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { label: "Açılış GAP%", val: `${(tk.intraday.gap_pct ?? 0) >= 0 ? "+" : ""}${fmt2(tk.intraday.gap_pct)}%`, score: tk.intraday.gap_score },
              { label: "Saatlik momentum", val: `${(tk.intraday.hourly_strength_pct ?? 0) >= 0 ? "+" : ""}${fmt2(tk.intraday.hourly_strength_pct)}%`, score: tk.intraday.hourly_score },
              { label: "Günlük RVOL", val: `${fmt2(tk.intraday.daily_rvol)}x`, score: tk.intraday.daily_rvol_score },
              { label: "Kapanış/Zirve", val: `${fmt2(tk.intraday.close_to_high_pct)}%`, score: tk.intraday.close_to_high_score },
              { label: "Son 30dk Hacim", val: `${fmt2(tk.intraday.late_volume_ratio)}x`, score: tk.intraday.late_volume_score },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ color: "#8b949e" }}>{row.label}</span>
                <span>
                  <span style={{ color: "#e6edf3", marginRight: 6 }}>{row.val}</span>
                  <span style={{ color: "#e3b341", fontWeight: 700 }}>{row.score ?? 0}/3</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {(tk.notes?.length ?? 0) > 0 && (
        <div style={{ flex: 1, minWidth: 200, padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: "#e3b341", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>
            NOTLAR
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {tk.notes.map((n, i) => (
              <div key={i} style={{ fontSize: 10, color: "#8b949e" }}>{n}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Heatmap View ────────────────────────────────────────────────────────────

function HeatmapView({ tickers, hourSlots }: { tickers: TickerRow[]; hourSlots: string[] }) {
  if (tickers.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "#8b949e", fontSize: 12 }}>
        Isı haritası için veri yok.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <div style={{ fontSize: 9, color: "#8b949e", marginBottom: 8, letterSpacing: "0.08em" }}>
        DURUM ISISI: HİSSE × SAAT GRİD (renk = durum)
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== "NEUTRAL").map(([status, colors]) => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: colors.bg, border: `1px solid ${colors.border}` }} />
            <span style={{ fontSize: 9, color: "#8b949e" }}>{statusLabel(status)}</span>
          </div>
        ))}
      </div>

      <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ padding: "4px 10px", color: "#e3b341", fontSize: 9, textAlign: "left", borderRight: "1px solid #30363d", fontWeight: 700, whiteSpace: "nowrap" }}>
              HİSSE
            </th>
            {hourSlots.map(h => (
              <th key={h} style={{ padding: "4px 8px", color: "#8b949e", fontSize: 9, textAlign: "center", fontWeight: 700, minWidth: 50, borderRight: "1px solid #1a1f27" }}>
                {h}
              </th>
            ))}
            <th style={{ padding: "4px 8px", color: "#e3b341", fontSize: 9, textAlign: "center", fontWeight: 700 }}>KAR/Z%</th>
          </tr>
        </thead>
        <tbody>
          {tickers.map((tk, idx) => {
            // Build hour → status map
            const hourStatus: Record<string, StatusHistoryItem> = {};
            for (const h of tk.status_history) {
              hourStatus[h.hour] = h;
            }

            return (
              <tr key={tk.ticker} style={{ borderBottom: "1px solid #1a1f27", background: idx % 2 ? "#161b22" : "#0d1117" }}>
                {/* Ticker label */}
                <td style={{ padding: "5px 10px", borderRight: "1px solid #30363d", whiteSpace: "nowrap" }}>
                  <TickerHoverChart ticker={tk.ticker}>
                    <span style={{ color: "#58a6ff", fontWeight: 900, fontSize: 11 }}>{tk.ticker}</span>
                  </TickerHoverChart>
                  {tk.entry_price && (
                    <span style={{ color: "#8b949e", fontSize: 9, marginLeft: 4 }}>
                      @${tk.entry_price.toFixed(2)}
                    </span>
                  )}
                </td>

                {/* Hour cells */}
                {hourSlots.map(h => {
                  const item = hourStatus[h];
                  const { bg, text } = item ? heatCell(item.status) : { bg: "#111", text: "#333" };
                  return (
                    <td
                      key={h}
                      title={item ? `${item.hour}: ${item.status} ($${item.price?.toFixed(2)})` : "—"}
                      style={{
                        padding: "5px 4px", textAlign: "center", background: bg,
                        borderRight: "1px solid #1a1f27", minWidth: 50,
                      }}
                    >
                      {item ? (
                        <>
                          <div style={{ fontSize: 8, color: text, fontWeight: 700 }}>
                            {statusLabel(item.status).replace(/[^\w%$+.-]/g, "").slice(0, 4)}
                          </div>
                          <div style={{ fontSize: 8, color: "#aaa" }}>${item.price?.toFixed(1)}</div>
                        </>
                      ) : (
                        <span style={{ color: "#333", fontSize: 9 }}>·</span>
                      )}
                    </td>
                  );
                })}

                {/* PnL */}
                <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 10, color: pctColor(tk.pnl_pct) }}>
                  {tk.entry_price
                    ? `${tk.pnl_pct >= 0 ? "+" : ""}${tk.pnl_pct.toFixed(2)}%`
                    : <span style={{ color: "#555" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
