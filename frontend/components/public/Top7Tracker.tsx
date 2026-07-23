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

const HOUR_SLOTS = ["09:15", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "16:15"];

interface HourlyBar {
  time: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  volume_ratio: number | null;
}

const REFRESH_MS = 5 * 60 * 1000;
const ACCENT = "#58a6ff";

const SIGNAL_ICON: Record<string, string> = { BUY: "●", WATCH: "◑", HOLD: "○", SELL: "✕" };
const SIGNAL_COLOR: Record<string, string> = { BUY: "#3fb950", WATCH: "#e3b341", HOLD: "#8b949e", SELL: "#f85149" };
const ROW_BG: Record<string, string> = { BUY: "#0f1117", WATCH: "#0f1117", HOLD: "#0f1117", SELL: "#0f1117" };

interface WatchlistPick {
  ticker: string;
  sector: string;
  date_added: string;
  score: number;
}

interface WatchlistRow {
  ticker: string;
  company: string;
  price: number;
  change_pct: number;
  rsi: number;
  signal: string;
  volume: number;
  sector: string;
  dateAdded: string;
  score: number;
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

function localeTag(locale: Locale) {
  return locale === "tr" ? "tr-TR" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : locale === "pt" ? "pt-BR" : "en-US";
}

function formatDateAdded(d: string | null | undefined, locale: Locale) {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00Z").toLocaleDateString(localeTag(locale), {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

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

const SIGNAL_RANK: Record<string, number> = { BUY: 4, WATCH: 3, HOLD: 2, SELL: 1 };
const SIGNAL_LABEL_TR: Record<string, string> = { BUY: "AL", WATCH: "İzle", HOLD: "Bekle", SELL: "SAT" };
const signalLabel = (s: string, locale: string) => (locale === "tr" ? SIGNAL_LABEL_TR[s] ?? s : s);

export default function Top7Tracker({ locale }: { locale: Locale }) {
  const t = copy[locale].watchlist;
  const { isPremium } = useMemberPlan();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [composition, setComposition] = useState<WatchlistRow[]>([]);
  const [live, setLive] = useState<Record<string, LiveData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterSignal, setFilterSignal] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterPattern, setFilterPattern] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [mounted, setMounted] = useState(false);
  const [analyzeTicker, setAnalyzeTicker] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const TOP7_TICKERS = ["AAPL", "GOOG", "MSFT", "AMZN", "NVDA", "META", "TSLA"];
      const rows: WatchlistRow[] = TOP7_TICKERS.map((ticker) => ({
        ticker,
        company: ticker,
        price: 0,
        change_pct: 0,
        rsi: 0,
        signal: "WATCH",
        volume: 0,
        sector: "Unknown",
        dateAdded: new Date().toISOString(),
        score: 0,
      }));

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
    } catch (err) {
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
      const sec = live[r.ticker]?.sector || r.sector;
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
      if (filterSignal && d?.tracker_1h?.signal !== filterSignal) return false;
      if (filterSector && (d?.sector || r.sector) !== filterSector) return false;
      if (filterPattern && d?.tracker_1h?.candle_pattern !== filterPattern) return false;
      if (searchQuery) {
        const q = searchQuery.toUpperCase();
        const sector = d?.sector || r.sector || "";
        const company = d?.company || r.company || "";
        if (!r.ticker.includes(q) && !company.toUpperCase().includes(q) && !sector.toUpperCase().includes(q)) return false;
      }
      return true;
    });
  }, [composition, live, filterSignal, filterSector, filterPattern, searchQuery]);

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
        case "rsi": va = da?.tracker_1h?.rsi ?? 0; vb = db?.tracker_1h?.rsi ?? 0; break;
        case "signal": va = SIGNAL_RANK[da?.tracker_1h?.signal ?? ""] ?? 0; vb = SIGNAL_RANK[db?.tracker_1h?.signal ?? ""] ?? 0; break;
        case "dateAdded": va = a.dateAdded ? new Date(a.dateAdded).getTime() : 0; vb = b.dateAdded ? new Date(b.dateAdded).getTime() : 0; break;
        default: return 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, live, sortBy, sortDir]);

  const alCount = filtered.filter((r) => live[r.ticker]?.tracker_1h?.signal === "BUY").length;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            TOP 7
          </h2>  </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lastUpdated && <span>{locale === "tr" ? "son güncelleme" : locale === "pt" ? "última atualização" : "last update"}: {lastUpdated.toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>● {isMarketOpen() ? (locale === "tr" ? "market açık" : locale === "pt" ? "mercado aberto" : "market open") : locale === "tr" ? "market kapalı" : locale === "pt" ? "mercado fechado" : "market closed"}</span>
              <span>{filtered.length} {locale === "tr" ? "ticker" : locale === "pt" ? "ativos" : "tickers"}</span>
              {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} {signalLabel("BUY", locale)}</span>}
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
            <button onClick={fetchAll} disabled={loading}
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
            style={{ background: "#161b22", border: `1px solid ${searchQuery ? ACCENT : "#30363d"}`, color: "#e6edf3", padding: "3px 8px", borderRadius: 3, fontSize: 11, fontFamily: "monospace", width: 110, outline: "none" }}
          />
          <div style={{ width: 1, background: "#30363d", margin: "0 2px", alignSelf: "stretch" }} />
          {["", "BUY", "WATCH", "HOLD", "SELL"].map((s) => (
            <button key={s || "all-signal"} onClick={() => setFilterSignal(s)}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
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
            style={{ background: "#161b22", border: `1px solid ${filterSector ? ACCENT : "#30363d"}`, color: filterSector ? ACCENT : "#8b949e", padding: "3px 8px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{locale === "tr" ? "TÜM SEKTÖRLER" : locale === "pt" ? "TODOS OS SETORES" : "ALL SECTORS"}</option>
            {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPattern} onChange={(e) => setFilterPattern(e.target.value)}
            style={{ background: "#161b22", border: `1px solid ${filterPattern ? ACCENT : "#30363d"}`, color: filterPattern ? ACCENT : "#8b949e", padding: "3px 8px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{locale === "tr" ? "TÜM PATERNLER" : locale === "pt" ? "TODOS OS PADRÕES" : "ALL PATTERNS"}</option>
            {patternOptions.map((p) => <option key={p} value={p}>{translatePattern(p, locale)}</option>)}
          </select>
        </div>
      </div>

      {!loading && !error && composition.length === 0 && <div className="text-center py-16 text-white/40 text-sm">{t.empty}</div>}

      {/* TABLE */}
      {activeTab === "table" && composition.length > 0 && (
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 260px)" }}>
          <table className="sm:min-w-[1000px]" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {((locale === "tr" ? [
                  { label: "TICKER", key: null, align: "left" },
                  { label: t.colDateAdded, key: "dateAdded", align: "left" },
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
                  { label: t.colDateAdded, key: "dateAdded", align: "left" },
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
                  { label: t.colDateAdded, key: "dateAdded", align: "left" },
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

                return (
                  <Fragment key={r.ticker}>
                    <tr style={{ background: bg, borderBottom: isExpanded ? "none" : "1px solid #21262d", cursor: "pointer" }} onClick={() => toggleExpand(r.ticker)}>
                      <td style={{ padding: "6px 8px", fontWeight: 700, color: "#58a6ff" }}>
                        <TickerHoverChart ticker={r.ticker} locale={locale} onDetailClick={() => setAnalyzeTicker(r.ticker)} detailLabel={locale === "tr" ? "Grafik Detay ↗" : locale === "pt" ? "Detalhe de Gráfico ↗" : locale === "es" ? "Detalle de Gráfico ↗" : locale === "fr" ? "Détail Graphique ↗" : "Chart Detail ↗"}>
                          <span>{r.ticker}</span>
                        </TickerHoverChart>
                      </td>
                      <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 11, whiteSpace: "nowrap" }}>{formatDateAdded(r.dateAdded, locale)}</td>
                      <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 11, whiteSpace: "nowrap" }} title={translateSector(d?.sector || r.sector, locale)}>{translateSector(d?.sector || r.sector, locale).slice(0, 12)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>${fmt2(d?.price?.current ?? r.price)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: heatBg(d?.tracker_1h?.change_pct_1d ?? r.change_pct).text, fontWeight: 700 }}>
                        {fmt2(d?.tracker_1h?.change_pct_1d ?? r.change_pct)}%
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmtVol(d?.price?.volume ?? r.volume)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmt1(d?.tracker_1h?.volume_ratio_1d)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? r.price, d?.tracker_1h?.ema_20) }}>
                        {fmt2(d?.tracker_1h?.ema_20)} {emaArrow(d?.price?.current ?? r.price, d?.tracker_1h?.ema_20)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? r.price, d?.tracker_1h?.ema_50) }}>
                        {fmt2(d?.tracker_1h?.ema_50)} {emaArrow(d?.price?.current ?? r.price, d?.tracker_1h?.ema_50)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? r.price, d?.tracker_1h?.ema_200) }}>
                        {fmt2(d?.tracker_1h?.ema_200)} {emaArrow(d?.price?.current ?? r.price, d?.tracker_1h?.ema_200)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{translateEMAStatus(d?.tracker_1h?.ema_status, locale)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: rsiColor(d?.tracker_1h?.rsi), fontWeight: 700 }}>{fmt1(d?.tracker_1h?.rsi)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{translatePattern(d?.tracker_1h?.candle_pattern, locale)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: SIGNAL_COLOR[signal] || "#8b949e" }}>{signal === "—" ? signal : signalLabel(signal, locale)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <Link
                          href={`/global/${locale}/graphic/${r.ticker}`}
                          style={{ color: ACCENT, textDecoration: "none", fontWeight: 700, fontSize: 10, background: ACCENT + "15", border: "1px solid " + ACCENT + "50", borderRadius: 3, padding: "3px 8px", display: "inline-block", cursor: "pointer" }}
                        >
                          {locale === "tr" ? "GRAFIK DETAY" : locale === "pt" ? "DETALHE DE GRÁFICO" : locale === "es" ? "DETALLE DE GRÁFICO" : locale === "fr" ? "DÉTAIL GRAPHIQUE" : "CHART DETAIL"}
                        </Link>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "#0f1117", borderBottom: "1px solid #30363d" }}>
                        <td colSpan={15} style={{ padding: 0 }}>
                          <TickerDetailPanel ticker={r.ticker} locale={locale} lockTradePlanCard />
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

      {/* ISI HARİTASI — saatlik Δ% grid */}
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
                  const dayColors = { bg: dayPct && dayPct >= 0 ? "#0d2a0d" : "#2a0d0d", text: dayPct && dayPct >= 0 ? "#3fb950" : "#f85149" };
                  return (
                    <tr key={r.ticker} style={{ background: "#0f1117", borderBottom: "1px solid #21262d" }}>
                      <td style={{ padding: "6px 10px" }}>
                        <TickerHoverChart ticker={r.ticker} locale={locale} onDetailClick={() => setAnalyzeTicker(r.ticker)} detailLabel={locale === "tr" ? "Grafik Detay ↗" : locale === "pt" ? "Detalhe de Gráfico ↗" : locale === "es" ? "Detalle de Gráfico ↗" : locale === "fr" ? "Détail Graphique ↗" : "Chart Detail ↗"}>
                          <button onClick={() => setAnalyzeTicker(r.ticker)} style={{ color: "#58a6ff", fontWeight: 900, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>{r.ticker}</button>
                        </TickerHoverChart>
                      </td>
                      {HOUR_SLOTS.map((h, i) => {
                        const bar = d?.hourly?.[i];
                        const pct = bar?.change_pct ?? null;
                        const heatBgColor = pct == null ? "#111111" : pct >= 2.0 ? "#0d4a0d" : pct >= 1.0 ? "#0d3a0d" : pct >= 0.3 ? "#0d2a0d" : pct > -0.3 ? "#1a1a1a" : pct > -1.0 ? "#2a0d0d" : pct > -2.0 ? "#3a0d0d" : "#4a0d0d";
                        const heatTextColor = pct == null ? "#333333" : pct >= 2.0 ? "#56d364" : pct >= 1.0 ? "#3fb950" : pct >= 0.3 ? "#3fb950" : pct > -0.3 ? "#8b949e" : pct > -1.0 ? "#f85149" : pct > -2.0 ? "#f85149" : "#ff7b72";
                        return (
                          <td key={h} style={{ padding: "10px 14px", textAlign: "center", background: heatBgColor, color: heatTextColor, fontSize: 12, fontWeight: 700, minWidth: 72 }}>
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
