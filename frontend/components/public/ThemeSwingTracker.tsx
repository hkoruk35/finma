"use client";

import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import { translateEMAStatus, translatePattern, translateSector, translateSignal } from "@/lib/translationHelpers";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import TickerHoverChart from "@/components/TickerHoverChart";
import DeepAnalysisOverlay from "@/components/global/DeepAnalysisOverlay";
import { useMemberPlan } from "@/hooks/useMemberPlan";

const REFRESH_MS = 5 * 60 * 1000;
const ACCENT = "#58a6ff";
const HOUR_SLOTS = ["09:15", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "16:15"];

interface HourlyBar {
  time: string;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  volume_ratio: number | null;
}

const SIGNAL_ICON: Record<string, string> = { STRONG: "●", WATCH: "◑", HOLD: "○", WEAK: "✕" };
const SIGNAL_COLOR: Record<string, string> = { STRONG: "#3fb950", WATCH: "#e3b341", HOLD: "#8b949e", WEAK: "#f85149" };
const ROW_BG: Record<string, string> = { STRONG: "#0f1117", WATCH: "#0f1117", HOLD: "#0f1117", WEAK: "#0f1117" };

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

function isMarketOpen() {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = h * 60 + m;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

const SIGNAL_RANK: Record<string, number> = { STRONG: 4, WATCH: 3, HOLD: 2, WEAK: 1 };

const CHART_DETAIL_LABEL: Record<Locale, string> = {
  tr: "Grafik Detay ↗", en: "Chart Detail ↗", es: "Detalle de Gráfico ↗", fr: "Détail Graphique ↗", pt: "Detalhe de Gráfico ↗",
};

const DETAIL_BTN_LABEL: Record<Locale, string> = {
  tr: "GRAFIK DETAY", en: "CHART DETAIL", es: "DETALLE DE GRÁFICO", fr: "DÉTAIL GRAPHIQUE", pt: "DETALHE DE GRÁFICO",
};

const MARKET_STATUS: Record<Locale, { open: string; closed: string }> = {
  tr: { open: "market açık", closed: "market kapalı" },
  en: { open: "market open", closed: "market closed" },
  es: { open: "mercado abierto", closed: "mercado cerrado" },
  fr: { open: "marché ouvert", closed: "marché fermé" },
  pt: { open: "mercado aberto", closed: "mercado fechado" },
};

const LAST_UPDATE_LABEL: Record<Locale, string> = {
  tr: "son güncelleme", en: "last update", es: "última actualización", fr: "dernière mise à jour", pt: "última atualização",
};

const TICKER_WORD: Record<Locale, string> = {
  tr: "ticker", en: "tickers", es: "acciones", fr: "titres", pt: "ativos",
};

const TAB_LABEL: Record<Locale, { table: string; heatmap: string; refresh: string; refreshing: string }> = {
  tr: { table: "ANA TABLO", heatmap: "ISI HARİTASI", refresh: "YENİLE", refreshing: "..." },
  en: { table: "MAIN TABLE", heatmap: "HEATMAP", refresh: "REFRESH", refreshing: "..." },
  es: { table: "TABLA PRINCIPAL", heatmap: "MAPA DE CALOR", refresh: "ACTUALIZAR", refreshing: "..." },
  fr: { table: "TABLEAU PRINCIPAL", heatmap: "CARTE THERMIQUE", refresh: "ACTUALISER", refreshing: "..." },
  pt: { table: "TABELA PRINCIPAL", heatmap: "MAPA DE CALOR", refresh: "ATUALIZAR", refreshing: "..." },
};

const SEARCH_PLACEHOLDER: Record<Locale, string> = {
  tr: "hisse ara...", en: "search...", es: "buscar...", fr: "rechercher...", pt: "buscar...",
};

const ALL_SIGNALS_LABEL: Record<Locale, string> = {
  tr: "TÜM SİNYAL", en: "ALL SIGNALS", es: "TODAS LAS SEÑALES", fr: "TOUS SIGNAUX", pt: "TODOS OS SINAIS",
};

const ALL_SECTORS_LABEL: Record<Locale, string> = {
  tr: "TÜM SEKTÖRLER", en: "ALL SECTORS", es: "TODOS LOS SECTORES", fr: "TOUS SECTEURS", pt: "TODOS OS SETORES",
};

const ALL_PATTERNS_LABEL: Record<Locale, string> = {
  tr: "TÜM PATERNLER", en: "ALL PATTERNS", es: "TODOS LOS PATRONES", fr: "TOUS MOTIFS", pt: "TODOS OS PADRÕES",
};

const HEATMAP_LEGEND: Record<Locale, string> = {
  tr: "Gün sonu saatlik Δ% ısı haritası — her hücre o saatin değişimini gösterir",
  en: "End-of-day hourly Δ% heatmap — each cell shows that hour's change",
  es: "Mapa de calor horario Δ% de fin de día — cada celda muestra el cambio de esa hora",
  fr: "Carte thermique horaire Δ% de fin de journée — chaque cellule montre la variation de cette heure",
  pt: "Mapa de calor horário Δ% de fim de dia — cada célula mostra a variação daquela hora",
};

const DAY_LABEL: Record<Locale, string> = { tr: "GÜN", en: "DAY", es: "DÍA", fr: "JOUR", pt: "DIA" };

const COLUMN_HEADERS: Record<Locale, { label: string; key: string | null; align: "left" | "right" }[]> = {
  tr: [
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
  ],
  en: [
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
  ],
  es: [
    { label: "TICKER", key: null, align: "left" },
    { label: "SECTOR", key: null, align: "left" },
    { label: "PRECIO", key: "price", align: "right" },
    { label: "Δ% 1D", key: "chg1d", align: "right" },
    { label: "VOLUMEN", key: "volume", align: "right" },
    { label: "RATIO VOL", key: "goran", align: "right" },
    { label: "EMA20", key: "ema20", align: "right" },
    { label: "EMA50", key: "ema50", align: "right" },
    { label: "EMA200", key: "ema200", align: "right" },
    { label: "ESTADO", key: null, align: "right" },
    { label: "RSI", key: "rsi", align: "right" },
    { label: "PATRÓN", key: null, align: "right" },
    { label: "SEÑAL", key: "signal", align: "right" },
    { label: "DETALLE", key: null, align: "right" },
  ],
  fr: [
    { label: "TICKER", key: null, align: "left" },
    { label: "SECTEUR", key: null, align: "left" },
    { label: "PRIX", key: "price", align: "right" },
    { label: "Δ% 1J", key: "chg1d", align: "right" },
    { label: "VOLUME", key: "volume", align: "right" },
    { label: "RATIO VOL", key: "goran", align: "right" },
    { label: "EMA20", key: "ema20", align: "right" },
    { label: "EMA50", key: "ema50", align: "right" },
    { label: "EMA200", key: "ema200", align: "right" },
    { label: "STATUT", key: null, align: "right" },
    { label: "RSI", key: "rsi", align: "right" },
    { label: "MOTIF", key: null, align: "right" },
    { label: "SIGNAL", key: "signal", align: "right" },
    { label: "DÉTAIL", key: null, align: "right" },
  ],
  pt: [
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
  ],
};

const PREMIUM_LABEL: Record<Locale, string> = {
  tr: "Premium", en: "Premium", es: "Premium", fr: "Premium", pt: "Premium",
};

const PREMIUM_LOCK_MESSAGE: Record<Locale, string> = {
  tr: "Bu temanın canlı hisse tablosu Premium üyelere özeldir. Ücretsiz olarak açık olan tema için üstteki listeden ilk temaya göz atabilirsiniz.",
  en: "This theme's live stock table is exclusive to Premium members. The first theme in the list above is free to browse.",
  es: "La tabla de acciones en vivo de este tema es exclusiva para miembros Premium. El primer tema de la lista superior es de acceso gratuito.",
  fr: "Le tableau boursier en direct de ce thème est réservé aux membres Premium. Le premier thème de la liste ci-dessus est en accès libre.",
  pt: "A tabela de ações ao vivo deste tema é exclusiva para membros Premium. O primeiro tema da lista acima é de acesso gratuito.",
};

const PREMIUM_CTA_LABEL: Record<Locale, string> = {
  tr: "Üye Ol", en: "Sign Up", es: "Regístrate", fr: "S'inscrire", pt: "Cadastre-se",
};

function registerHrefFor(locale: Locale): string {
  return locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;
}

interface ThemeSwingTrackerProps {
  locale: Locale;
  tickers: string[];
  isFirstTheme?: boolean;
}

export default function ThemeSwingTracker({ locale, tickers, isFirstTheme = false }: ThemeSwingTrackerProps) {
  const t = copy[locale].top100;
  const { isPremium, loading: memberLoading } = useMemberPlan();
  // Sadece ilk tema (havuzun public "vitrini") uye olmayanlara acik — digerleri
  // Premium kilitli. loading bitene kadar kilitlemiyoruz (BogaChartEngine'in
  // premiumGate deseniyle ayni, ani "kilitli->acik" titremesini onlemek icin).
  const locked = !isFirstTheme && !isPremium && !memberLoading;
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
    if (tickers.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const liveRes = await fetch(`/api/watchlist-data?tickers=${tickers.join(",")}`);
      if (!liveRes.ok) {
        setError(t.error);
        return;
      }
      const liveRows: LiveData[] = await liveRes.json();
      const map: Record<string, LiveData> = {};
      liveRows.forEach((item) => { if (item?.ticker) map[item.ticker] = item; });
      setLive(map);
      setLastUpdated(new Date());
      setError("");
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [tickers, t.error]);

  useEffect(() => {
    // Uye olmayan ziyaretci icin kilitli (ilk tema disi) bir sayfada canlı
    // veriyi hic cekmeyelim — hem gereksiz istek hem de kilitli ekranda
    // gosterilmeyecek veriyi bosuna indirmis oluruz. Uyelik durumu (memberLoading)
    // netlesene kadar da bekleriz, aksi halde "locked" gecici olarak yanlis
    // (false) hesaplanip fetch tetiklenebilir.
    if (!isFirstTheme && memberLoading) return;
    if (locked) { setLoading(false); return; }
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll, isFirstTheme, memberLoading, locked]);

  const sectorOptions = useMemo(() => {
    const s = new Set<string>();
    tickers.forEach((tk) => {
      const sec = live[tk]?.sector;
      if (sec && sec !== "Unknown") s.add(sec);
    });
    return Array.from(s).sort();
  }, [tickers, live]);

  const patternOptions = useMemo(() => {
    const s = new Set<string>();
    tickers.forEach((tk) => {
      const p = live[tk]?.tracker_1h?.candle_pattern;
      if (p) s.add(p);
    });
    return Array.from(s).sort();
  }, [tickers, live]);

  const filtered = useMemo(() => {
    return tickers.filter((tk) => {
      const d = live[tk];
      if (filterSignal && d?.tracker_1h?.signal !== filterSignal) return false;
      if (filterSector && d?.sector !== filterSector) return false;
      if (filterPattern && d?.tracker_1h?.candle_pattern !== filterPattern) return false;
      if (searchQuery) {
        const q = searchQuery.toUpperCase();
        const sector = d?.sector || "";
        const company = d?.company || "";
        if (!tk.includes(q) && !company.toUpperCase().includes(q) && !sector.toUpperCase().includes(q)) return false;
      }
      return true;
    });
  }, [tickers, live, filterSignal, filterSector, filterPattern, searchQuery]);

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  };

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    return [...filtered].sort((a, b) => {
      const da = live[a], db = live[b];
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

  const alCount = filtered.filter((tk) => live[tk]?.tracker_1h?.signal === "STRONG").length;
  const izleCount = filtered.filter((tk) => live[tk]?.tracker_1h?.signal === "WATCH").length;

  const toggleExpand = (ticker: string) => setExpandedTicker((cur) => (cur === ticker ? null : ticker));

  if (!mounted || (loading && tickers.length > 0 && Object.keys(live).length === 0)) {
    return (
      <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117" }}>
        <span style={{ color: "#3fb950", fontFamily: "monospace" }} className="animate-pulse">{t.loading}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117", color: "#f85149", fontFamily: "monospace" }}>
        {error}
      </div>
    );
  }

  if (locked) {
    return (
      <div style={{ background: "#0f1117", minHeight: "40vh", fontFamily: "monospace", color: "#e6edf3", borderRadius: 8, border: "1px solid #30363d", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", maxWidth: 420 }}>
          <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor" style={{ color: "#e3b341" }}>
            <path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#e3b341" }}>
            {PREMIUM_LABEL[locale]}
          </span>
          <span style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.6 }}>{PREMIUM_LOCK_MESSAGE[locale]}</span>
          <Link
            href={registerHrefFor(locale)}
            style={{ marginTop: 6, padding: "8px 20px", borderRadius: 6, background: "#e3b341", color: "#0d1117", fontWeight: 700, fontSize: 12, textDecoration: "none" }}
          >
            {PREMIUM_CTA_LABEL[locale]}
          </Link>
        </div>
      </div>
    );
  }

  const columns = COLUMN_HEADERS[locale];

  return (
    <div style={{ background: "#0f1117", minHeight: "40vh", fontFamily: "monospace", color: "#e6edf3", padding: "0 0 40px", borderRadius: 8, border: "1px solid #30363d", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #30363d", padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#8b949e", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {lastUpdated && <span>{LAST_UPDATE_LABEL[locale]}: {lastUpdated.toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
            <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>● {isMarketOpen() ? MARKET_STATUS[locale].open : MARKET_STATUS[locale].closed}</span>
            <span>{filtered.length} {TICKER_WORD[locale]}</span>
            {alCount > 0 && <span style={{ color: "#3fb950" }}>{alCount} {translateSignal("STRONG", locale)}</span>}
            {izleCount > 0 && <span style={{ color: "#e3b341" }}>{izleCount} {translateSignal("WATCH", locale)}</span>}
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
                {tab === "table" ? TAB_LABEL[locale].table : TAB_LABEL[locale].heatmap}
              </button>
            ))}
            <button onClick={fetchAll} disabled={loading}
              style={{ padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700, border: "1px solid #30363d", background: "transparent", color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer" }}>
              {loading ? TAB_LABEL[locale].refreshing : TAB_LABEL[locale].refresh}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            placeholder={SEARCH_PLACEHOLDER[locale]}
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
              {s ? `${SIGNAL_ICON[s]} ${translateSignal(s, locale)}` : ALL_SIGNALS_LABEL[locale]}
            </button>
          ))}
          <div style={{ width: 1, background: "#30363d", margin: "0 4px" }} />
          <select value={filterSector} onChange={(e) => setFilterSector(e.target.value)}
            style={{ background: "#161b22", border: `1px solid ${filterSector ? ACCENT : "#30363d"}`, color: filterSector ? ACCENT : "#8b949e", padding: "5px 8px", borderRadius: 3, fontSize: 13, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{ALL_SECTORS_LABEL[locale]}</option>
            {sectorOptions.map((s) => <option key={s} value={s}>{translateSector(s, locale)}</option>)}
          </select>
          <select value={filterPattern} onChange={(e) => setFilterPattern(e.target.value)}
            style={{ background: "#161b22", border: `1px solid ${filterPattern ? ACCENT : "#30363d"}`, color: filterPattern ? ACCENT : "#8b949e", padding: "5px 8px", borderRadius: 3, fontSize: 13, fontFamily: "monospace", fontWeight: 700, cursor: "pointer" }}>
            <option value="">{ALL_PATTERNS_LABEL[locale]}</option>
            {patternOptions.map((p) => <option key={p} value={p}>{translatePattern(p, locale)}</option>)}
          </select>
        </div>
      </div>

      {tickers.length === 0 && <div className="text-center py-16 text-white/40 text-sm">{t.empty}</div>}

      {/* TABLE */}
      {activeTab === "table" && tickers.length > 0 && (
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 260px)", WebkitOverflowScrolling: "touch", width: "100%", maxWidth: "100vw" }}>
          <table className="sm:min-w-[1000px]" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {columns.map(({ label, key, align }) => (
                  <th key={label} onClick={key ? () => toggleSort(key) : undefined}
                    style={{
                      padding: "7px 8px", textAlign: align,
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
              {sorted.map((tk) => {
                const d = live[tk];
                const signal = d?.tracker_1h?.signal || "—";
                const rowBg = ROW_BG[signal] || "#0f1117";
                const bg = signal !== "—" ? rowBg : "#0f1117";
                const isExpanded = expandedTicker === tk;

                return (
                  <Fragment key={tk}>
                    <tr style={{ background: bg, borderBottom: isExpanded ? "none" : "1px solid #21262d", cursor: "pointer" }} onClick={() => toggleExpand(tk)}>
                      <td style={{ padding: "6px 8px", fontWeight: 700, color: "#58a6ff" }}>
                        <TickerHoverChart ticker={tk} locale={locale} onDetailClick={() => setAnalyzeTicker(tk)} detailLabel={CHART_DETAIL_LABEL[locale]}>
                          <span>{tk}</span>
                        </TickerHoverChart>
                      </td>
                      <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 12 }} title={translateSector(d?.sector, locale)}>{translateSector(d?.sector, locale)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>${fmt2(d?.price?.current)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: (d?.tracker_1h?.change_pct_1d ?? 0) >= 0 ? "#3fb950" : "#f85149", fontWeight: 700 }}>
                        {fmt2(d?.tracker_1h?.change_pct_1d)}%
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmtVol(d?.price?.volume)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{fmt1(d?.tracker_1h?.volume_ratio_1d)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? 0, d?.tracker_1h?.ema_20) }}>
                        {fmt2(d?.tracker_1h?.ema_20)} {emaArrow(d?.price?.current ?? 0, d?.tracker_1h?.ema_20)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? 0, d?.tracker_1h?.ema_50) }}>
                        {fmt2(d?.tracker_1h?.ema_50)} {emaArrow(d?.price?.current ?? 0, d?.tracker_1h?.ema_50)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: emaColor(d?.price?.current ?? 0, d?.tracker_1h?.ema_200) }}>
                        {fmt2(d?.tracker_1h?.ema_200)} {emaArrow(d?.price?.current ?? 0, d?.tracker_1h?.ema_200)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{translateEMAStatus(d?.tracker_1h?.ema_status, locale)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: rsiColor(d?.tracker_1h?.rsi), fontWeight: 700 }}>{fmt1(d?.tracker_1h?.rsi)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>{translatePattern(d?.tracker_1h?.candle_pattern, locale)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: SIGNAL_COLOR[signal] || "#8b949e" }}>{signal === "—" ? signal : translateSignal(signal, locale)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <Link
                          href={`/global/${locale}/graphic/${tk}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: ACCENT, textDecoration: "none", fontWeight: 700, fontSize: 10, background: ACCENT + "15", border: "1px solid " + ACCENT + "50", borderRadius: 3, padding: "3px 8px", display: "inline-block", cursor: "pointer" }}
                        >
                          {DETAIL_BTN_LABEL[locale]}
                        </Link>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "#0f1117", borderBottom: "1px solid #30363d" }}>
                        <td colSpan={14} style={{ padding: 0 }}>
                          <TickerDetailPanel ticker={tk} locale={locale} />
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
      {activeTab === "heatmap" && tickers.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 12, padding: "0 12px" }}>
            {HEATMAP_LEGEND[locale]}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, fontFamily: "monospace", minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "#58a6ff", fontSize: 11, letterSpacing: "0.1em" }}>TICKER</th>
                  {HOUR_SLOTS.map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "center", color: "#58a6ff", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  <th style={{ padding: "10px 14px", textAlign: "right", color: "#58a6ff", fontSize: 11 }}>{DAY_LABEL[locale]}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((tk) => {
                  const d = live[tk];
                  const dayPct = d?.price?.change_pct ?? null;
                  const dayColors = { bg: dayPct && dayPct >= 0 ? "#0d2a0d" : "#2a0d0d", text: dayPct && dayPct >= 0 ? "#3fb950" : "#f85149" };
                  return (
                    <tr key={tk} style={{ background: "#0f1117", borderBottom: "1px solid #21262d" }}>
                      <td style={{ padding: "6px 10px" }}>
                        <TickerHoverChart ticker={tk} locale={locale} onDetailClick={() => setAnalyzeTicker(tk)} detailLabel={CHART_DETAIL_LABEL[locale]}>
                          <button onClick={() => setAnalyzeTicker(tk)} style={{ color: "#58a6ff", fontWeight: 900, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>{tk}</button>
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
          <div style={{ marginTop: 12, padding: "0 12px 12px", display: "flex", gap: 16, flexWrap: "wrap" }}>
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
