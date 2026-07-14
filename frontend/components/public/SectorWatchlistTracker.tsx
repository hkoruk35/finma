"use client";

import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import { translateEMAStatus, translatePattern } from "@/lib/translationHelpers";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import TickerHoverChart from "@/components/TickerHoverChart";
import DeepAnalysisOverlay from "@/components/global/DeepAnalysisOverlay";
import { MARKET_THEMES } from "@/lib/themeData";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

const REFRESH_MS = 5 * 60 * 1000;
const ACCENT = "#58a6ff";
const BATCH_SIZE = 100;
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

const SIGNAL_ICON: Record<string, string> = { BUY: "●", WATCH: "◑", HOLD: "○", SELL: "✕" };
const SIGNAL_COLOR: Record<string, string> = { BUY: "#3fb950", WATCH: "#e3b341", HOLD: "#8b949e", SELL: "#f85149" };
const SIGNAL_RANK: Record<string, number> = { BUY: 4, WATCH: 3, HOLD: 2, SELL: 1 };
const ROW_BG: Record<string, string> = { BUY: "#0f1117", WATCH: "#0f1117", HOLD: "#0f1117", SELL: "#0f1117" };

// GICS aliasing kept in sync with lib/sectorHeatMap.ts's SECTOR_ORDER names.
const normalizeGicsSector = (sec: string | undefined): string => {
  if (!sec) return "Other";
  const s = sec.trim();
  if (s === "Basic Materials") return "Materials";
  if (s === "Consumer Defensive") return "Consumer Staples";
  if (s === "Consumer Cyclical") return "Consumer Discretionary";
  if (s === "Financial Services") return "Financials";
  return s;
};

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

function isMarketOpen() {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = h * 60 + m;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

const PAGE_LABELS: Record<Locale, {
  titleSuffix: string; lastUpdate: string; marketOpen: string; marketClosed: string;
  tickers: string; refresh: string; mainTable: string; heatmap: string;
  search: string; allSignals: string; allPatterns: string; day: string;
  heatmapNote: string; colCompany: string; analyze: string; chart: string;
}> = {
  en: {
    titleSuffix: "Sector Stocks", lastUpdate: "last update", marketOpen: "market open", marketClosed: "market closed",
    tickers: "tickers", refresh: "REFRESH", mainTable: "MAIN TABLE", heatmap: "HEATMAP",
    search: "search...", allSignals: "ALL SIGNALS", allPatterns: "ALL PATTERNS", day: "DAY",
    heatmapNote: "End-of-day hourly Δ% heatmap — each cell shows that hour's change", colCompany: "COMPANY", analyze: "ANALYZE", chart: "CHART",
  },
  tr: {
    titleSuffix: "Sektörü Hisseleri", lastUpdate: "son güncelleme", marketOpen: "market açık", marketClosed: "market kapalı",
    tickers: "ticker", refresh: "YENİLE", mainTable: "ANA TABLO", heatmap: "ISI HARİTASI",
    search: "hisse ara...", allSignals: "TÜM SİNYAL", allPatterns: "TÜM PATERNLER", day: "GÜN",
    heatmapNote: "Gün sonu saatlik Δ% ısı haritası — her hücre o saatin değişimini gösterir", colCompany: "ŞİRKET", analyze: "ANALİZ", chart: "GRAFİK",
  },
  es: {
    titleSuffix: "Acciones del Sector", lastUpdate: "última actualización", marketOpen: "mercado abierto", marketClosed: "mercado cerrado",
    tickers: "tickers", refresh: "ACTUALIZAR", mainTable: "TABLA PRINCIPAL", heatmap: "MAPA DE CALOR",
    search: "buscar...", allSignals: "TODAS LAS SEÑALES", allPatterns: "TODOS LOS PATRONES", day: "DÍA",
    heatmapNote: "Mapa de calor horario de fin de día Δ% — cada celda muestra el cambio de esa hora", colCompany: "EMPRESA", analyze: "ANALIZAR", chart: "GRÁFICO",
  },
  fr: {
    titleSuffix: "Actions du Secteur", lastUpdate: "dernière mise à jour", marketOpen: "marché ouvert", marketClosed: "marché fermé",
    tickers: "titres", refresh: "ACTUALISER", mainTable: "TABLEAU PRINCIPAL", heatmap: "CARTE THERMIQUE",
    search: "rechercher...", allSignals: "TOUS LES SIGNAUX", allPatterns: "TOUS LES MOTIFS", day: "JOUR",
    heatmapNote: "Carte thermique horaire de fin de journée Δ% — chaque cellule montre la variation de cette heure", colCompany: "ENTREPRISE", analyze: "ANALYSER", chart: "GRAPHIQUE",
  },
  pt: {
    titleSuffix: "Ações do Setor", lastUpdate: "última atualização", marketOpen: "mercado aberto", marketClosed: "mercado fechado",
    tickers: "ativos", refresh: "ATUALIZAR", mainTable: "TABELA PRINCIPAL", heatmap: "MAPA DE CALOR",
    search: "buscar...", allSignals: "TODOS OS SINAIS", allPatterns: "TODOS OS PADRÕES", day: "DIA",
    heatmapNote: "Mapa de calor horário de fim de dia Δ% — cada célula mostra a variação daquela hora", colCompany: "EMPRESA", analyze: "ANALISAR", chart: "GRÁFICO",
  },
};

interface Props {
  locale: Locale;
  /** GICS sector name, e.g. "Technology" — must match lib/sectorHeatMap.ts's SECTOR_ORDER entries. */
  sector: string;
  sectorLabel: string;
}

export default function SectorWatchlistTracker({ locale, sector, sectorLabel }: Props) {
  const t = copy[locale].top100;
  const L = PAGE_LABELS[locale];

  const [tickerUniverse] = useState<string[]>(() =>
    Array.from(
      new Set([
        ...MARKET_THEMES.flatMap((th) => th.tickers),
        ...HOT_THEMES_2026.flatMap((th) => th.stocks.map((s) => s.ticker)),
      ])
    ).sort()
  );

  const [live, setLive] = useState<Record<string, LiveData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterSignal, setFilterSignal] = useState("");
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
      const map: Record<string, LiveData> = {};
      for (let i = 0; i < tickerUniverse.length; i += BATCH_SIZE) {
        const chunk = tickerUniverse.slice(i, i + BATCH_SIZE);
        const res = await fetch(`/api/watchlist-data?tickers=${chunk.join(",")}`);
        if (!res.ok) continue;
        const rows: LiveData[] = await res.json();
        rows.forEach((item) => {
          if (item?.ticker && normalizeGicsSector(item.sector) === sector) {
            map[item.ticker] = item;
          }
        });
      }
      setLive(map);
      setLastUpdated(new Date());
      setError("");
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [tickerUniverse, sector, t.error]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  const rows = useMemo(() => Object.values(live), [live]);

  const patternOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.tracker_1h?.candle_pattern) s.add(r.tracker_1h.candle_pattern); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((d) => {
      if (filterSignal && d.tracker_1h?.signal !== filterSignal) return false;
      if (filterPattern && d.tracker_1h?.candle_pattern !== filterPattern) return false;
      if (searchQuery) {
        const q = searchQuery.toUpperCase();
        if (!d.ticker.includes(q) && !(d.company || "").toUpperCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterSignal, filterPattern, searchQuery]);

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  };

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    return [...filtered].sort((a, b) => {
      let va: number, vb: number;
      switch (sortBy) {
        case "price": va = a.price?.current ?? 0; vb = b.price?.current ?? 0; break;
        case "volume": va = a.price?.volume ?? 0; vb = b.price?.volume ?? 0; break;
        case "chg1d": va = a.tracker_1h?.change_pct_1d ?? 0; vb = b.tracker_1h?.change_pct_1d ?? 0; break;
        case "goran": va = a.tracker_1h?.volume_ratio_1d ?? 0; vb = b.tracker_1h?.volume_ratio_1d ?? 0; break;
        case "ema20": va = a.tracker_1h?.ema_20 ?? 0; vb = b.tracker_1h?.ema_20 ?? 0; break;
        case "ema50": va = a.tracker_1h?.ema_50 ?? 0; vb = b.tracker_1h?.ema_50 ?? 0; break;
        case "ema200": va = a.tracker_1h?.ema_200 ?? 0; vb = b.tracker_1h?.ema_200 ?? 0; break;
        case "rsi": va = a.tracker_1h?.rsi ?? 0; vb = b.tracker_1h?.rsi ?? 0; break;
        case "signal": va = SIGNAL_RANK[a.tracker_1h?.signal ?? ""] ?? 0; vb = SIGNAL_RANK[b.tracker_1h?.signal ?? ""] ?? 0; break;
        default: return 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [filtered, sortBy, sortDir]);

  const alCount = filtered.filter((d) => d.tracker_1h?.signal === "BUY").length;
  const izleCount = filtered.filter((d) => d.tracker_1h?.signal === "WATCH").length;

  const toggleExpand = (ticker: string) => setExpandedTicker((cur) => (cur === ticker ? null : ticker));

  const signalLabel = (s: string) =>
    s === "BUY" ? t.signalBuy : s === "WATCH" ? t.signalWatch : s === "HOLD" ? t.signalWait : s === "SELL" ? t.signalSell : s;

  if (!mounted || (loading && rows.length === 0)) {
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
      {/* Header */}
      <div style={{ borderBottom: "1px solid #30363d", paddingBottom: 10, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px" }}>
              {sectorLabel} {L.titleSuffix}
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lastUpdated && <span>{L.lastUpdate}: {lastUpdated.toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>● {isMarketOpen() ? L.marketOpen : L.marketClosed}</span>
              <span>{filtered.length} {L.tickers}</span>
              {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} {t.signalBuy}</span>}
              {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} {t.signalWatch}</span>}
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
                {tab === "table" ? L.mainTable : L.heatmap}
              </button>
            ))}
            <button onClick={fetchAll} disabled={loading}
              style={{ padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700, border: "1px solid #30363d", background: "transparent", color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer" }}>
              {loading ? "..." : L.refresh}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            placeholder={L.search}
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
              {s ? `${SIGNAL_ICON[s]} ${signalLabel(s)}` : L.allSignals}
            </button>
          ))}
          <div style={{ width: 1, background: "#30363d", margin: "0 4px" }} />
          <select value={filterPattern} onChange={(e) => setFilterPattern(e.target.value)}
            style={{ background: "#161b22", border: `1px solid ${filterPattern ? ACCENT : "#30363d"}`, color: filterPattern ? ACCENT : "#8b949e", padding: "3px 8px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{L.allPatterns}</option>
            {patternOptions.map((p) => <option key={p} value={p}>{translatePattern(p, locale)}</option>)}
          </select>
        </div>
      </div>

      {!loading && rows.length === 0 && <div className="text-center py-16 text-white/40 text-sm">{t.empty}</div>}

      {/* TABLE */}
      {activeTab === "table" && rows.length > 0 && (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%", maxWidth: "100vw" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "max-content", minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {([
                  { label: t.colTicker, key: null, align: "left" },
                  { label: L.colCompany, key: null, align: "left" },
                  { label: t.colPrice, key: "price", align: "right" },
                  { label: t.colVolume, key: "volume", align: "right" },
                  { label: t.colChange, key: "chg1d", align: "right" },
                  { label: "RVOL", key: "goran", align: "right" },
                  { label: "EMA20", key: "ema20", align: "right" },
                  { label: "EMA50", key: "ema50", align: "right" },
                  { label: "EMA200", key: "ema200", align: "right" },
                  { label: t.colRsi, key: "rsi", align: "right" },
                  { label: t.colPattern, key: null, align: "right" },
                  { label: t.colSignal, key: "signal", align: "right" },
                  { label: L.analyze, key: null, align: "right" },
                  { label: L.chart, key: null, align: "right" },
                ] as { label: string; key: string | null; align: string }[]).map(({ label, key, align }) => (
                  <th key={label} onClick={key ? () => toggleSort(key) : undefined}
                    style={{
                      padding: "7px 8px", textAlign: align as "left" | "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: sortBy === key && key ? ACCENT : "#58a6ff",
                      whiteSpace: "nowrap", background: "#0f1117",
                      cursor: key ? "pointer" : "default", userSelect: "none",
                    }}>
                    {label}{key && sortBy === key ? (sortDir === "desc" ? " ↓" : " ↑") : key ? " ↕" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const signal = d.tracker_1h?.signal || "—";
                const bg = signal !== "—" ? (ROW_BG[signal] || "#0f1117") : "#0f1117";
                const isExpanded = expandedTicker === d.ticker;

                return (
                  <Fragment key={d.ticker}>
                    <tr style={{ background: bg, borderBottom: isExpanded ? "none" : "1px solid #21262d", cursor: "pointer" }} onClick={() => toggleExpand(d.ticker)}>
                      <td style={{ padding: "6px 8px", fontWeight: 700, color: "#58a6ff" }}>
                        <TickerHoverChart ticker={d.ticker} locale={locale} onDetailClick={() => setAnalyzeTicker(d.ticker)} detailLabel={`${L.analyze} ↗`}>
                          <span>{d.ticker}</span>
                        </TickerHoverChart>
                      </td>
                      <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 11, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.company || ""}>{d.company || "—"}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>${fmt2(d.price?.current)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmtVol(d.price?.volume)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: (d.tracker_1h?.change_pct_1d ?? 0) >= 0 ? "#3fb950" : "#f85149", fontWeight: 700 }}>
                        {fmt2(d.tracker_1h?.change_pct_1d)}%
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmt1(d.tracker_1h?.volume_ratio_1d)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d.price?.current ?? 0, d.tracker_1h?.ema_20) }}>
                        {fmt2(d.tracker_1h?.ema_20)} {emaArrow(d.price?.current ?? 0, d.tracker_1h?.ema_20)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d.price?.current ?? 0, d.tracker_1h?.ema_50) }}>
                        {fmt2(d.tracker_1h?.ema_50)} {emaArrow(d.price?.current ?? 0, d.tracker_1h?.ema_50)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d.price?.current ?? 0, d.tracker_1h?.ema_200) }}>
                        {fmt2(d.tracker_1h?.ema_200)} {emaArrow(d.price?.current ?? 0, d.tracker_1h?.ema_200)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: rsiColor(d.tracker_1h?.rsi), fontWeight: 700 }}>{fmt1(d.tracker_1h?.rsi)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{translatePattern(d.tracker_1h?.candle_pattern, locale)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: SIGNAL_COLOR[signal] || "#8b949e" }}>{signal === "—" ? signal : signalLabel(signal)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAnalyzeTicker(d.ticker); }}
                          style={{ color: ACCENT, textDecoration: "none", fontWeight: 700, fontSize: 10, background: ACCENT + "15", border: "1px solid " + ACCENT + "50", borderRadius: 3, padding: "3px 8px", display: "inline-block", cursor: "pointer" }}
                        >
                          {L.analyze}
                        </button>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <Link
                          href={`/global/${locale}/graphic/${d.ticker}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "#8b949e", textDecoration: "none", fontWeight: 700, fontSize: 10, background: "transparent", border: "1px solid #30363d", borderRadius: 3, padding: "3px 8px", display: "inline-block", cursor: "pointer" }}
                        >
                          {L.chart}
                        </Link>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "#0f1117", borderBottom: "1px solid #30363d" }}>
                        <td colSpan={14} style={{ padding: 0 }}>
                          <div style={{ width: "calc(100vw - 64px)", maxWidth: 1200, overflowX: "auto" }}>
                            <TickerDetailPanel ticker={d.ticker} locale={locale} />
                          </div>
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

      {/* Hourly heatmap */}
      {activeTab === "heatmap" && rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 12, padding: "0 4px" }}>
            {L.heatmapNote}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, fontFamily: "monospace", minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "#58a6ff", fontSize: 11, letterSpacing: "0.1em" }}>{t.colTicker}</th>
                  {HOUR_SLOTS.map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "center", color: "#58a6ff", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  <th style={{ padding: "10px 14px", textAlign: "right", color: "#58a6ff", fontSize: 11 }}>{L.day}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => {
                  const dayPct = d.price?.change_pct ?? null;
                  const dayColors = { bg: dayPct && dayPct >= 0 ? "#0d2a0d" : "#2a0d0d", text: dayPct && dayPct >= 0 ? "#3fb950" : "#f85149" };
                  return (
                    <tr key={d.ticker} style={{ background: "#0f1117", borderBottom: "1px solid #21262d" }}>
                      <td style={{ padding: "6px 10px" }}>
                        <TickerHoverChart ticker={d.ticker} locale={locale} onDetailClick={() => setAnalyzeTicker(d.ticker)} detailLabel={`${L.analyze} ↗`}>
                          <button onClick={() => setAnalyzeTicker(d.ticker)} style={{ color: "#58a6ff", fontWeight: 900, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>{d.ticker}</button>
                        </TickerHoverChart>
                      </td>
                      {HOUR_SLOTS.map((h, i) => {
                        const bar = d.hourly?.[i];
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
