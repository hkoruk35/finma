"use client";

import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import { translateEMAStatus, translatePattern, translateSector } from "@/lib/translationHelpers";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import TickerHoverChart from "@/components/TickerHoverChart";
import DeepAnalysisOverlay from "@/components/global/DeepAnalysisOverlay";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import PremiumModal from "@/components/global/PremiumModal";
import type { Top100Row } from "@/app/api/top100/route";

const REFRESH_MS = 5 * 60 * 1000;
const ACCENT = "#58a6ff";

const SIGNAL_ICON: Record<string, string> = { STRONG: "●", WATCH: "◑", HOLD: "○", WEAK: "✕" };
const SIGNAL_COLOR: Record<string, string> = { STRONG: "#3fb950", WATCH: "#e3b341", HOLD: "#8b949e", WEAK: "#f85149" };
const ROW_BG: Record<string, string> = { STRONG: "#0f1117", WATCH: "#0f1117", HOLD: "#0f1117", WEAK: "#0f1117" };
const HOUR_SLOTS = ["09:15", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "16:15"];

interface HourlyBar {
  time: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  volume_ratio: number | null;
}

interface LiveData {
  ticker: string;
  company: string;
  sector: string;
  price: { current: number; prev_close: number; change_pct: number; volume?: number };
  tracker_1h: {
    ema_20: number; ema_50: number; ema_200: number;
    ema_status: string; rsi: number; candle_pattern: string;
    signal: string; volume_ratio: number; change_pct_1h: number;
    change_pct_1d: number; volume_ratio_1d: number;
  };
  hourly?: HourlyBar[];
}

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");
const fmtVol = (v: number | null | undefined) =>
  !v ? "—" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(v);

function rsiColor(rsi: number | undefined) {
  if (rsi == null) return "#8b949e";
  if (rsi >= 70) return "#f85149";
  if (rsi >= 50) return "#3fb950";
  if (rsi >= 40) return "#e3b341";
  return "#f85149";
}

function emaColor(price: number, ema: number | undefined) {
  if (!ema) return "#8b949e";
  const diff = Math.abs(price - ema) / ema;
  if (diff < 0.005) return "#e3b341";
  return price > ema ? "#3fb950" : "#f85149";
}

function emaArrow(price: number, ema: number | undefined) {
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

const SIGNAL_RANK: Record<string, number> = { STRONG: 4, WATCH: 3, HOLD: 2, WEAK: 1 };
const SIGNAL_LABEL_TR: Record<string, string> = { STRONG: "Güçlü", WATCH: "İzle", HOLD: "Bekle", WEAK: "Zayıf" };
const signalLabel = (s: string, locale: string) => (locale === "tr" ? SIGNAL_LABEL_TR[s] ?? s : s);

// Normalize sector names so "Financials" and "Financial Services" are treated as one
function normalizeSector(sector: string | null | undefined): string | null {
  if (!sector) return null;
  if (sector === "Financials") return "Financial Services";
  return sector;
}

export default function Top100Tracker({ locale }: { locale: Locale }) {
  const t = copy[locale].top100;
  const [composition, setComposition] = useState<Top100Row[]>([]);
  const [live, setLive] = useState<Record<string, LiveData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterSource, setFilterSource] = useState<"" | "fixed" | "swing_daily">("fixed");
  const [filterSignal, setFilterSignal] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterPattern, setFilterPattern] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");
  const [sortBy, setSortBy] = useState<string | null>("volume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [mounted, setMounted] = useState(false);
  const [analyzeTicker, setAnalyzeTicker] = useState<string | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { isPremium } = useMemberPlan();

  useEffect(() => setMounted(true), []);

  const refreshSnapshot = useCallback(async () => {
    // First, trigger server-side snapshot refresh
    try {
      await fetch("/api/refresh-top100", { method: "POST" });
    } catch {}
    // Then fetch fresh data
    await fetchAll();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const compRes = await fetch("/api/top100");
      const compData = await compRes.json();
      if (compData.error) {
        setError(t.error);
        return;
      }
      const rows: Top100Row[] = compData.rows ?? [];
      setComposition(rows);

      if (rows.length > 0) {
        const tickers = rows.map((r) => r.ticker).join(",");
        const liveRes = await fetch(`/api/watchlist-data?tickers=${tickers}`);
        if (liveRes.ok) {
          const liveRows: LiveData[] = await liveRes.json();
          const map: Record<string, LiveData> = {};
          liveRows.forEach((item) => { if (item?.ticker) map[item.ticker] = item; });
          setLive(map);
        }
      }
      setLastUpdated(new Date());
      setError("");
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  const sectorOptions = useMemo(() => {
    const s = new Set<string>();
    composition.forEach((r) => {
      const raw = live[r.ticker]?.sector || r.sector;
      const sec = normalizeSector(raw);
      if (sec && sec !== "Unknown") s.add(sec);
    });
    return Array.from(s).sort();
  }, [composition, live]);

  const patternOptions = useMemo(() => {
    const s = new Set<string>();
    composition.forEach((r) => {
      const p = live[r.ticker]?.tracker_1h?.candle_pattern;
      if (p) s.add(p);
    });
    return Array.from(s).sort();
  }, [composition, live]);

  const filtered = useMemo(() => {
    return composition.filter((r) => {
      const d = live[r.ticker];
      if (filterSource && r.source !== filterSource) return false;
      if (filterSignal && d?.tracker_1h?.signal !== filterSignal) return false;
      const rowSector = normalizeSector(d?.sector || r.sector);
      if (filterSector && rowSector !== filterSector) return false;
      if (filterPattern && d?.tracker_1h?.candle_pattern !== filterPattern) return false;
      if (searchQuery) {
        const q = searchQuery.toUpperCase();
        const sector = d?.sector || r.sector || "";
        const company = d?.company || r.company || "";
        if (!r.ticker.includes(q) && !company.toUpperCase().includes(q) && !sector.toUpperCase().includes(q)) return false;
      }
      return true;
    });
  }, [composition, live, filterSource, filterSignal, filterSector, filterPattern, searchQuery]);

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  };

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    return [...filtered].sort((a, b) => {
      const da = live[a.ticker], db = live[b.ticker];
      let va: number, vb: number;
      switch (sortBy) {
        case "price": va = da?.price?.current ?? 0; vb = db?.price?.current ?? 0; break;
        case "volume": va = da?.price?.volume ?? 0; vb = db?.price?.volume ?? 0; break;
        case "chg1d": va = da?.tracker_1h?.change_pct_1d ?? 0; vb = db?.tracker_1h?.change_pct_1d ?? 0; break;
        case "goran": va = da?.tracker_1h?.volume_ratio_1d ?? 0; vb = db?.tracker_1h?.volume_ratio_1d ?? 0; break;
        case "ema20": va = da?.tracker_1h?.ema_20 ?? 0; vb = db?.tracker_1h?.ema_20 ?? 0; break;
        case "ema50": va = da?.tracker_1h?.ema_50 ?? 0; vb = db?.tracker_1h?.ema_50 ?? 0; break;
        case "ema200": va = da?.tracker_1h?.ema_200 ?? 0; vb = db?.tracker_1h?.ema_200 ?? 0; break;
        case "rsi": va = da?.tracker_1h?.rsi ?? 0; vb = db?.tracker_1h?.rsi ?? 0; break;
        case "signal": va = SIGNAL_RANK[da?.tracker_1h?.signal ?? ""] ?? 0; vb = SIGNAL_RANK[db?.tracker_1h?.signal ?? ""] ?? 0; break;
        default: return 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, live, sortBy, sortDir]);

  const alCount = filtered.filter((r) => live[r.ticker]?.tracker_1h?.signal === "STRONG").length;
  const izleCount = filtered.filter((r) => live[r.ticker]?.tracker_1h?.signal === "WATCH").length;

  const toggleExpand = (ticker: string) => setExpandedTicker((cur) => (cur === ticker ? null : ticker));



  if (!mounted || loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117" }}>
        <span style={{ color: "#3fb950", fontFamily: "monospace" }} className="animate-pulse">{t.loading}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117", color: "#f85149", fontFamily: "monospace" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ background: "#0f1117", minHeight: "60vh", fontFamily: "monospace", color: "#e6edf3", padding: "0 0 40px" }}>
      {showPremiumModal && <PremiumModal locale={locale} onClose={() => setShowPremiumModal(false)} />}
      {/* Header */}
      <div style={{ borderBottom: "1px solid #30363d", paddingBottom: 10, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px" }}>{t.title}</div>
            <div style={{ fontSize: 12, color: "#8b949e", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lastUpdated && <span>{locale === "tr" ? "son güncelleme" : locale === "pt" ? "última atualização" : "last update"}: {lastUpdated.toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>● {isMarketOpen() ? (locale === "tr" ? "market açık" : locale === "pt" ? "mercado aberto" : "market open") : locale === "tr" ? "market kapalı" : locale === "pt" ? "mercado fechado" : "market closed"}</span>
              <span>{filtered.length} {locale === "tr" ? "ticker" : locale === "pt" ? "ativos" : "tickers"}</span>
              {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} {signalLabel("STRONG", locale)}</span>}
              {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} {signalLabel("WATCH", locale)}</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {(["table", "heatmap"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid", borderColor: activeTab === tab ? ACCENT : "#30363d",
                  background: activeTab === tab ? ACCENT + "20" : "transparent",
                  color: activeTab === tab ? ACCENT : "#8b949e",
                  borderRadius: 4, cursor: "pointer", letterSpacing: "0.05em",
                }}>
                {tab === "table" ? (locale === "tr" ? "ANA TABLO" : locale === "pt" ? "TABELA PRINCIPAL" : "MAIN TABLE") : (locale === "tr" ? "ISI HARİTASI" : locale === "pt" ? "MAPA DE CALOR" : "HEATMAP")}
              </button>
            ))}
            <button onClick={refreshSnapshot} disabled={loading}
              style={{ padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700, border: "1px solid #30363d", background: "transparent", color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer" }}>
              {loading ? "..." : (locale === "tr" ? "YENİLE" : locale === "pt" ? "ATUALIZAR" : "REFRESH")}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            placeholder={locale === "tr" ? "hisse ara..." : locale === "pt" ? "buscar..." : "search..."}
            maxLength={12}
            style={{ background: searchQuery ? ACCENT + "33" : ACCENT + "1a", border: `1px solid ${searchQuery ? ACCENT : ACCENT + "66"}`, color: "#e6edf3", padding: "5px 8px", borderRadius: 3, fontSize: 13, fontFamily: "monospace", width: 110, outline: "none" }}
          />
          <div style={{ width: 1, background: "#30363d", margin: "0 2px", alignSelf: "stretch" }} />
          {["", "STRONG", "WATCH", "HOLD", "WEAK"].map((s) => (
            <button key={s || "all-signal"} onClick={() => setFilterSignal(s)}
              style={{
                padding: "5px 12px", fontSize: 13, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid",
                borderColor: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) : "#30363d",
                background: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) + "20" : "transparent",
                color: filterSignal === s ? (SIGNAL_COLOR[s] || ACCENT) : "#8b949e",
                borderRadius: 3, cursor: "pointer",
              }}>
              {s ? `${SIGNAL_ICON[s]} ${signalLabel(s, locale)}` : (locale === "tr" ? "TÜM SİNYAL" : locale === "pt" ? "TODOS OS SINAIS" : "ALL SIGNALS")}
            </button>
          ))}
          <div style={{ width: 1, background: "#30363d", margin: "0 4px" }} />
          <select value={filterSector} onChange={(e) => setFilterSector(e.target.value)}
            style={{ background: "#161b22", border: `1px solid ${filterSector ? ACCENT : "#30363d"}`, color: filterSector ? ACCENT : "#8b949e", padding: "5px 8px", borderRadius: 3, fontSize: 13, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{locale === "tr" ? "TÜM SEKTÖRLER" : locale === "pt" ? "TODOS OS SETORES" : "ALL SECTORS"}</option>
            {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPattern} onChange={(e) => setFilterPattern(e.target.value)}
            style={{ background: "#161b22", border: `1px solid ${filterPattern ? ACCENT : "#30363d"}`, color: filterPattern ? ACCENT : "#8b949e", padding: "5px 8px", borderRadius: 3, fontSize: 13, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{locale === "tr" ? "TÜM PATERNLER" : locale === "pt" ? "TODOS OS PADRÕES" : "ALL PATTERNS"}</option>
            {patternOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {!loading && !error && composition.length === 0 && <div className="text-center py-16 text-white/40 text-sm">{t.empty}</div>}

      {/* ANA TABLO */}
      {activeTab === "table" && composition.length > 0 && (
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 260px)" }}>
          <table className="sm:min-w-[1000px]" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {((locale === "tr" ? [
                  { label: "TICKER", key: null, align: "left" },
                  { label: "SEKTÖR", key: null, align: "left" },
                  { label: "FİYAT", key: "price", align: "right" },
                  { label: "Δ% 1G", key: "chg1d", align: "right" },
                  { label: "HACİM", key: "volume", align: "right" },
                  { label: "HACİM ORANI", key: "goran", align: "right" },
                  { label: "EMA20", key: "ema20", align: "right" },
                  { label: "EMA50", key: "ema50", align: "right" },
                  { label: "EMA200", key: "ema200", align: "right" },
                  { label: "DURUM", key: null, align: "right" },
                  { label: "RSI", key: "rsi", align: "right" },
                  { label: "PATERN", key: null, align: "right" },
                  { label: "SİNYAL", key: "signal", align: "right" },
                  { label: "DETAY", key: null, align: "right" },
                ] : locale === "pt" ? [
                  { label: "TICKER", key: null, align: "left" },
                  { label: "SETOR", key: null, align: "left" },
                  { label: "PREÇO", key: "price", align: "right" },
                  { label: "Δ% 1D", key: "chg1d", align: "right" },
                  { label: "VOLUME", key: "volume", align: "right" },
                  { label: "RAZÃO VOL", key: "goran", align: "right" },
                  { label: "EMA20", key: "ema20", align: "right" },
                  { label: "EMA50", key: "ema50", align: "right" },
                  { label: "EMA200", key: "ema200", align: "right" },
                  { label: "STATUS", key: null, align: "right" },
                  { label: "RSI", key: "rsi", align: "right" },
                  { label: "PADRÃO", key: null, align: "right" },
                  { label: "SINAL", key: "signal", align: "right" },
                  { label: "DETALHE", key: null, align: "right" },
                ] : [
                  { label: "TICKER", key: null, align: "left" },
                  { label: "SECTOR", key: null, align: "left" },
                  { label: "PRICE", key: "price", align: "right" },
                  { label: "Δ% 1D", key: "chg1d", align: "right" },
                  { label: "VOLUME", key: "volume", align: "right" },
                  { label: "VOL RATIO", key: "goran", align: "right" },
                  { label: "EMA20", key: "ema20", align: "right" },
                  { label: "EMA50", key: "ema50", align: "right" },
                  { label: "EMA200", key: "ema200", align: "right" },
                  { label: "STATUS", key: null, align: "right" },
                  { label: "RSI", key: "rsi", align: "right" },
                  { label: "PATTERN", key: null, align: "right" },
                  { label: "SIGNAL", key: "signal", align: "right" },
                  { label: "DETAIL", key: null, align: "right" },
                ]) as { label: string; key: string | null; align: string }[]).map(({ label, key, align }) => (
                  <th key={label} onClick={key ? () => toggleSort(key) : undefined}
                    style={{
                      padding: "7px 8px", textAlign: align as "left" | "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: sortBy === key && key ? ACCENT : "#58a6ff",
                      whiteSpace: "nowrap", background: "#0f1117",
                      cursor: key ? "pointer" : "default", userSelect: "none",
                      position: "sticky", top: 0, zIndex: 1,
                    }}>
                    {label}{key && sortBy === key ? (sortDir === "desc" ? " ↓" : " ↑") : key ? " ↕" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => {
                const d = live[r.ticker];
                const signal = d?.tracker_1h?.signal || "—";
                const rowBg = ROW_BG[signal] || "#0f1117";
                const bg = signal !== "—" ? rowBg : "#0f1117";
                const isExpanded = expandedTicker === r.ticker;
                const isSwingDaily = r.source === "swing_daily";
                const price = d?.price?.current ?? 0;
                const sectorLabel = normalizeSector(d?.sector && d.sector !== "Unknown" ? d.sector : r.sector || r.company || null) ?? "—";
                // Non-premium: only the first 20 rows are unlocked
                const rowLocked = !isPremium && idx > 0;

                if (rowLocked) {
                  return (
                    <Fragment key={r.ticker}>
                      <tr
                        onClick={() => setShowPremiumModal(true)}
                        style={{ background: "#0f1117", borderBottom: "1px solid #21262d", cursor: "pointer" }}
                      >
                        {/* Ticker — lock icon + Premium */}
                        <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#f59e0b", fontWeight: 700, fontSize: 11 }}>
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                            Premium
                          </span>
                        </td>
                        <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 12, whiteSpace: "nowrap" }}>{translateSector(sectorLabel === "—" ? null : sectorLabel, locale).toUpperCase().slice(0, 14)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>{d ? `$${fmt2(price)}` : "—"}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: !d ? "#8b949e" : (d.tracker_1h?.change_pct_1d ?? 0) >= 0 ? "#3fb950" : "#f85149" }}>
                          {d ? `${(d.tracker_1h?.change_pct_1d ?? 0) >= 0 ? "+" : ""}${fmt2(d.tracker_1h?.change_pct_1d)}%` : "—"}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmtVol(d?.price?.volume)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: !d ? "#8b949e" : (d.tracker_1h?.volume_ratio_1d ?? 0) >= 1.5 ? "#3fb950" : (d.tracker_1h?.volume_ratio_1d ?? 0) >= 0.8 ? "#e6edf3" : "#8b949e" }}>
                          {d ? `${fmt2(d.tracker_1h?.volume_ratio_1d)}x` : "—"}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_20) : "#8b949e" }}>
                          {d ? `${fmt2(d.tracker_1h?.ema_20)}${emaArrow(price, d.tracker_1h?.ema_20)}` : "—"}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_50) : "#8b949e" }}>
                          {d ? `${fmt2(d.tracker_1h?.ema_50)}${emaArrow(price, d.tracker_1h?.ema_50)}` : "—"}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_200) : "#8b949e" }}>
                          {d ? `${fmt2(d.tracker_1h?.ema_200)}${emaArrow(price, d.tracker_1h?.ema_200)}` : "—"}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>
                          {d && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                              background: d.tracker_1h?.ema_status === "Bullish" ? "#1a3a1a" : d.tracker_1h?.ema_status === "BullishWeak" ? "#1c2e1c" : d.tracker_1h?.ema_status === "Neutral" ? "#1a1a2e" : d.tracker_1h?.ema_status === "BearishWeak" ? "#2e1a1a" : "#3a1a1a",
                              color: d.tracker_1h?.ema_status === "Bullish" ? "#3fb950" : d.tracker_1h?.ema_status === "BullishWeak" ? "#56d364" : d.tracker_1h?.ema_status === "Neutral" ? "#8b949e" : d.tracker_1h?.ema_status === "BearishWeak" ? "#f85149" : "#ff7b72",
                            }}>
                              {translateEMAStatus(d.tracker_1h?.ema_status, locale)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? rsiColor(d.tracker_1h?.rsi) : "#8b949e" }}>{d ? fmt1(d.tracker_1h?.rsi) : "—"}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{translatePattern(d?.tracker_1h?.candle_pattern, locale)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>
                          {d && (
                            <span style={{ fontWeight: 900, fontSize: 12, color: SIGNAL_COLOR[signal] || "#8b949e" }}>
                              {SIGNAL_ICON[signal] || "○"} {signalLabel(signal, locale)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setShowPremiumModal(true)}
                            style={{ background: "transparent", border: "1px solid #f59e0b44", color: "#f59e0b", borderRadius: 3, padding: "1px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: 700, display: "inline-block" }}
                          >
                            🔒 Premium
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={r.ticker}>
                    <tr onClick={() => toggleExpand(r.ticker)}
                      style={{ background: bg, borderBottom: isExpanded ? "none" : "1px solid #21262d", cursor: "pointer" }}>
                      <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <span onClick={() => toggleExpand(r.ticker)} style={{ cursor: "pointer" }}>
                          <TickerHoverChart ticker={r.ticker} locale={locale} onDetailClick={() => setAnalyzeTicker(r.ticker)} detailLabel={locale === "tr" ? "Grafik Detay ↗" : locale === "pt" ? "Detalhe de Gráfico ↗" : locale === "es" ? "Detalle de Gráfico ↗" : locale === "fr" ? "Détail Graphique ↗" : "Chart Detail ↗"}>
                            <span style={{ color: isSwingDaily ? "#58a6ff" : "#e6edf3", fontWeight: 900, fontSize: 13 }}>{r.ticker}</span>
                          </TickerHoverChart>
                          <span style={{ color: isExpanded ? "#3fb950" : "#8b949e", marginLeft: 6, fontSize: 10 }}>{isExpanded ? "▼" : "▶"}</span>
                        </span>
                        {isSwingDaily && (
                          <span style={{ marginLeft: 6, fontSize: 8, background: "#1c243380", color: "#58a6ff", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>
                            {t.swingDailyBadge}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 12, whiteSpace: "nowrap" }}>{translateSector(sectorLabel === "—" ? null : sectorLabel, locale).toUpperCase().slice(0, 14)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#e6edf3", fontWeight: 700 }}>{d ? `$${fmt2(price)}` : "—"}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: !d ? "#8b949e" : (d.tracker_1h?.change_pct_1d ?? 0) >= 0 ? "#3fb950" : "#f85149" }}>
                        {d ? `${(d.tracker_1h?.change_pct_1d ?? 0) >= 0 ? "+" : ""}${fmt2(d.tracker_1h?.change_pct_1d)}%` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmtVol(d?.price?.volume)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: !d ? "#8b949e" : (d.tracker_1h?.volume_ratio_1d ?? 0) >= 1.5 ? "#3fb950" : (d.tracker_1h?.volume_ratio_1d ?? 0) >= 0.8 ? "#e6edf3" : "#8b949e" }}>
                        {d ? `${fmt2(d.tracker_1h?.volume_ratio_1d)}x` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_20) : "#8b949e" }}>
                        {d ? `${fmt2(d.tracker_1h?.ema_20)}${emaArrow(price, d.tracker_1h?.ema_20)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_50) : "#8b949e" }}>
                        {d ? `${fmt2(d.tracker_1h?.ema_50)}${emaArrow(price, d.tracker_1h?.ema_50)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? emaColor(price, d.tracker_1h?.ema_200) : "#8b949e" }}>
                        {d ? `${fmt2(d.tracker_1h?.ema_200)}${emaArrow(price, d.tracker_1h?.ema_200)}` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {d && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                            background: d.tracker_1h?.ema_status === "Bullish" ? "#1a3a1a" : d.tracker_1h?.ema_status === "BullishWeak" ? "#1c2e1c" : d.tracker_1h?.ema_status === "Neutral" ? "#1a1a2e" : d.tracker_1h?.ema_status === "BearishWeak" ? "#2e1a1a" : "#3a1a1a",
                            color: d.tracker_1h?.ema_status === "Bullish" ? "#3fb950" : d.tracker_1h?.ema_status === "BullishWeak" ? "#56d364" : d.tracker_1h?.ema_status === "Neutral" ? "#8b949e" : d.tracker_1h?.ema_status === "BearishWeak" ? "#f85149" : "#ff7b72",
                          }}>
                            {translateEMAStatus(d.tracker_1h?.ema_status, locale)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: d ? rsiColor(d.tracker_1h?.rsi) : "#8b949e" }}>{d ? fmt1(d.tracker_1h?.rsi) : "—"}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{translatePattern(d?.tracker_1h?.candle_pattern, locale)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        {d && (
                          <span style={{ fontWeight: 900, fontSize: 12, color: SIGNAL_COLOR[signal] || "#8b949e" }}>
                            {SIGNAL_ICON[signal] || "○"} {signalLabel(signal, locale)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/global/${locale}/graphic/${r.ticker}`}
                          style={{ color: ACCENT, textDecoration: "none", fontWeight: 700, fontSize: 10, background: ACCENT + "15", border: "1px solid " + ACCENT + "50", borderRadius: 3, padding: "3px 8px", display: "inline-block", cursor: "pointer" }}
                        >
                          {locale === "tr" ? "Grafik Detay ↗" : locale === "pt" ? "Detalhe de Gráfico ↗" : locale === "es" ? "Detalle de Gráfico ↗" : locale === "fr" ? "Détail Graphique ↗" : "Chart Detail ↗"}
                        </Link>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "#0f1117", borderBottom: "1px solid #30363d" }}>
                        <td colSpan={14} style={{ padding: 0 }}>
                          <TickerDetailPanel ticker={r.ticker} locale={locale} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ISI HARİTASI — saatlik Δ% grid (tracker ile aynı) */}
      {activeTab === "heatmap" && composition.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 12, padding: "0 4px" }}>
            {locale === "tr" ? "Gün sonu saatlik Δ% ısı haritası — her hücre o saatin değişimini gösterir" : locale === "pt" ? "Mapa de calor horário de fim de dia Δ% — cada célula mostra a variação daquela hora" : "End-of-day hourly Δ% heatmap — each cell shows that hour's change"}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, fontFamily: "monospace", minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "#58a6ff", fontSize: 11, letterSpacing: "0.1em" }}>TICKER</th>
                  {HOUR_SLOTS.map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "center", color: "#58a6ff", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  <th style={{ padding: "10px 14px", textAlign: "right", color: "#58a6ff", fontSize: 11 }}>{locale === "tr" ? "GÜN" : locale === "pt" ? "DIA" : "DAY"}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, idx) => {
                  const d = live[r.ticker];
                  const dayPct = d?.price?.change_pct ?? null;
                  const dayColors = heatBg(dayPct);
                  const hmLocked = !isPremium && idx >= 20;
                  return (
                    <tr
                      key={r.ticker}
                      style={{ background: "#0f1117", borderBottom: "1px solid #21262d", opacity: hmLocked ? 0.5 : 1, cursor: hmLocked ? "pointer" : undefined }}
                      onClick={hmLocked ? () => setShowPremiumModal(true) : undefined}
                    >
                      <td style={{ padding: "6px 10px" }}>
                        {hmLocked ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#f59e0b", fontWeight: 700, fontSize: 11 }}>
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                            Premium
                          </span>
                        ) : (
                          <TickerHoverChart ticker={r.ticker} locale={locale} onDetailClick={() => setAnalyzeTicker(r.ticker)} detailLabel={locale === "tr" ? "Grafik Detay ↗" : locale === "pt" ? "Detalhe de Gráfico ↗" : locale === "es" ? "Detalle de Gráfico ↗" : locale === "fr" ? "Détail Graphique ↗" : "Chart Detail ↗"}>
                            <button onClick={() => setAnalyzeTicker(r.ticker)} style={{ color: "#58a6ff", fontWeight: 900, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>{r.ticker}</button>
                          </TickerHoverChart>
                        )}
                      </td>
                      {HOUR_SLOTS.map((h, i) => {
                        const bar = d?.hourly?.[i];
                        const pct = bar?.change_pct ?? null;
                        const { bg, text } = heatBg(pct);
                        return (
                          <td key={h} style={{ padding: "10px 14px", textAlign: "center", background: bg, color: text, fontSize: 12, fontWeight: 700, minWidth: 72 }}>
                            {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : <span style={{ color: "#333" }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ padding: "10px 14px", textAlign: "right", background: dayColors.bg, color: dayColors.text, fontWeight: 700 }}>
                        {dayPct != null ? `${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(1)}%` : "—"}
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
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 16, height: 16, background: item.bg, borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: item.text }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <DeepAnalysisOverlay ticker={analyzeTicker} locale={locale} onClose={() => setAnalyzeTicker(null)} />
    </div>
  );
}
