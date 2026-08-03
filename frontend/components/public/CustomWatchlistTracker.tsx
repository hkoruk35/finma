"use client";

import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const REFRESH_MS_PREMIUM = 5 * 60 * 1000; // ~5dk — "saatlik" gereksiniminden daha sık, dokunulmadı
const REFRESH_MS_FREE = 24 * 60 * 60 * 1000; // günlük (bkz. Faz 3 plan matrisi)
const ACCENT = "#58a6ff";

const SIGNAL_ICON: Record<string, string> = { STRONG: "●", WATCH: "◑", HOLD: "○", WEAK: "✕" };
const SIGNAL_COLOR: Record<string, string> = { STRONG: "#3fb950", WATCH: "#e3b341", HOLD: "#8b949e", WEAK: "#f85149" };
const ROW_BG: Record<string, string> = { STRONG: "#0f1117", WATCH: "#0f1117", HOLD: "#0f1117", WEAK: "#0f1117" };

interface WatchlistRow {
  ticker: string;
  company: string;
  price: number;
  change_pct: number;
  rsi: number;
  signal: string;
  volume: number;
  sector: string;
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

export default function CustomWatchlistTracker({ locale }: { locale: Locale }) {
  const t = copy[locale].watchlist; // Fallback or we can add custom copy
  const { plan, isPremium, loading: planLoading } = useMemberPlan();
  const isLoggedIn = plan !== null;
  const router = useRouter();

  useEffect(() => {
    if (!planLoading && !isLoggedIn) {
      const regUrl = locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;
      router.push(regUrl);
    }
  }, [planLoading, isLoggedIn, locale, router]);

  // Anonim: 5 (localStorage) — free (giriş yapmış, premium değil): 10 —
  // premium/admin: 50. Sunucu tarafı sınır (/api/watchlist/custom) aynı
  // kuralı ayrıca uyguluyor (bkz. Faz 3 plan matrisi).
  const maxTickers = !isLoggedIn ? 5 : isPremium ? 50 : 10;
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [composition, setComposition] = useState<WatchlistRow[]>([]);
  const [live, setLive] = useState<Record<string, LiveData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const [myTickers, setMyTickers] = useState<string[]>([]);
  
  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ticker: string, company: string}>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [mounted, setMounted] = useState(false);
  const [analyzeTicker, setAnalyzeTicker] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      let tickers: string[] = [];
      if (isLoggedIn) {
        const hwRes = await fetch("/api/watchlist/custom", { cache: "no-store" });
        if (hwRes.ok) {
          const hwData = await hwRes.json();
          tickers = hwData.tickers || [];
        }
      } else {
        const local = localStorage.getItem("boga_guest_watchlist");
        if (local) {
          try { tickers = JSON.parse(local); } catch {}
        }
        if (!tickers || tickers.length === 0) {
          tickers = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL"];
          localStorage.setItem("boga_guest_watchlist", JSON.stringify(tickers));
        }
      }

      setMyTickers(tickers);

      if (tickers.length === 0) {
        setComposition([]);
        setLive({});
        setLoading(false);
        return;
      }

      const rows: WatchlistRow[] = tickers.map(t => ({
        ticker: t,
        company: t,
        price: 0,
        change_pct: 0,
        rsi: 0,
        signal: "WATCH",
        volume: 0,
        sector: "Unknown",
      }));
      setComposition(rows);

      const liveRes = await fetch(`/api/watchlist-data?tickers=${tickers.join(",")}`);
      if (liveRes.ok) {
        const liveRows: LiveData[] = await liveRes.json();
        const map: Record<string, LiveData> = {};
        liveRows.forEach((item) => { if (item?.ticker) map[item.ticker] = item; });
        setLive(map);
      }
      
      setLastUpdated(new Date());
      setError("");
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!planLoading) {
      fetchWatchlist();
    }
    const id = setInterval(fetchWatchlist, isPremium ? REFRESH_MS_PREMIUM : REFRESH_MS_FREE);
    return () => clearInterval(id);
  }, [fetchWatchlist, planLoading, isPremium]);

  // Handle Search Autocomplete
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/tickers/search?q=${encodeURIComponent(searchInput)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchInput]);

  const updateWatchlist = async (newTickers: string[]) => {
    if (isLoggedIn) {
      try {
        const res = await fetch("/api/watchlist/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: newTickers })
        });
        if (res.ok) {
          const data = await res.json();
          setMyTickers(data.tickers);
          fetchWatchlist();
        } else {
          const err = await res.json();
          alert(err.error || "Failed to update");
        }
      } catch (e) {
        console.error(e);
        alert("Error updating watchlist");
      }
    } else {
      localStorage.setItem("boga_guest_watchlist", JSON.stringify(newTickers));
      setMyTickers(newTickers);
      fetchWatchlist();
    }
  };

  const addTicker = (ticker: string) => {
    if (myTickers.includes(ticker)) return;
    if (!isLoggedIn && myTickers.length >= 5) {
      alert(locale === "tr" ? "Üye olmadan en fazla 5 hisse ekleyebilirsiniz. Listelerinizi kaydetmek ve 10 hisseye kadar çıkarmak için lütfen üye girişi yapın." : "Non-members can add up to 5 tickers. Please log in to save watchlists and expand up to 10 tickers.");
      return;
    }
    if (isLoggedIn && !isPremium && myTickers.length >= 10) {
      alert(locale === "tr" ? "Ücretsiz planda maksimum 10 hisse ekleyebilirsiniz. Daha fazlası için Premium'a geçin." : "You can add up to 10 tickers on the Free plan. Upgrade to Premium for more.");
      return;
    }
    if (isLoggedIn && isPremium && myTickers.length >= 50) {
      alert(locale === "tr" ? "Maksimum 50 hisse ekleyebilirsiniz." : "You can add maximum 50 tickers.");
      return;
    }
    setSearchInput("");
    setSearchResults([]);
    updateWatchlist([...myTickers, ticker]);
  };

  const removeTicker = (ticker: string) => {
    const newTickers = myTickers.filter(t => t !== ticker);
    updateWatchlist(newTickers);
  };

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  };

  const sorted = useMemo(() => {
    if (!sortBy) return composition;
    return [...composition].sort((a, b) => {
      const da = live[a.ticker], db = live[b.ticker];
      let va: number, vb: number;
      switch (sortBy) {
        case "price": va = da?.price?.current ?? 0; vb = db?.price?.current ?? 0; break;
        case "volume": va = da?.price?.volume ?? 0; vb = db?.price?.volume ?? 0; break;
        case "chg1d": va = da?.tracker_1h?.change_pct_1d ?? 0; vb = db?.tracker_1h?.change_pct_1d ?? 0; break;
        case "rsi": va = da?.tracker_1h?.rsi ?? 0; vb = db?.tracker_1h?.rsi ?? 0; break;
        case "signal": va = SIGNAL_RANK[da?.tracker_1h?.signal ?? ""] ?? 0; vb = SIGNAL_RANK[db?.tracker_1h?.signal ?? ""] ?? 0; break;
        default: return 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [composition, live, sortBy, sortDir]);

  const toggleExpand = (ticker: string) => setExpandedTicker((cur) => (cur === ticker ? null : ticker));

  if (!mounted) return null;

  return (
    <div style={{ background: "#0f1117", minHeight: "60vh", fontFamily: "monospace", color: "#e6edf3", padding: "0 0 40px" }}>
      {showPremiumModal && <PremiumModal locale={locale} onClose={() => setShowPremiumModal(false)} />}
      
      {/* Header */}
      <div style={{ borderBottom: "1px solid #30363d", paddingBottom: 10, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px" }}>
              {locale === "tr" ? "KİŞİSEL TAKİP LİSTESİ" : locale === "pt" ? "MINHA LISTA DE OBSERVAÇÃO" : locale === "es" ? "MI LISTA DE SEGUIMIENTO" : locale === "fr" ? "MA LISTE DE SURVEILLANCE" : "MY WATCHLIST"}
            </div>
            <div style={{ fontSize: 12, color: "#8b949e", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {lastUpdated && <span>{locale === "tr" ? "son güncelleme" : "last update"}: {lastUpdated.toLocaleTimeString(localeTag(locale), { hour: "2-digit", minute: "2-digit" })}</span>}
              <span style={{ color: isMarketOpen() ? "#3fb950" : "#f85149" }}>● {isMarketOpen() ? (locale === "tr" ? "market açık" : "market open") : (locale === "tr" ? "market kapalı" : "market closed")}</span>
              <span>{myTickers.length} / {maxTickers} {locale === "tr" ? "hisse" : "tickers"}</span>
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
                {tab === "table" ? (locale === "tr" ? "ANA TABLO" : "MAIN TABLE") : (locale === "tr" ? "ISI HARİTASI" : "HEATMAP")}
              </button>
            ))}
            <button onClick={fetchWatchlist} disabled={loading}
              style={{ padding: "5px 12px", fontSize: 11, fontFamily: "monospace", fontWeight: 700, border: "1px solid #30363d", background: "transparent", color: loading ? "#8b949e" : "#e6edf3", borderRadius: 4, cursor: "pointer" }}>
              {loading ? "..." : (locale === "tr" ? "YENİLE" : "REFRESH")}
            </button>
          </div>
        </div>

        {/* Add Ticker Search */}
        <div style={{ marginTop: 15, position: "relative", maxWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", background: "#161b22", border: `1px solid ${searchInput ? ACCENT : "#30363d"}`, borderRadius: 4, padding: "4px 8px" }}>
            <span style={{ color: "#8b949e", marginRight: 8 }}>+</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              placeholder={locale === "tr" ? "Hisse ara ve ekle (örn. TSLA)..." : "Search and add ticker..."}
              maxLength={12}
              style={{ background: "transparent", color: "#e6edf3", fontSize: 12, fontFamily: "monospace", width: "100%", outline: "none", border: "none" }}
            />
          </div>
          {/* Autocomplete Results */}
          {searchInput && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#161b22", border: "1px solid #30363d", borderRadius: 4, marginTop: 4, zIndex: 50, maxHeight: 200, overflowY: "auto" }}>
              {isSearching ? (
                <div style={{ padding: "8px 12px", fontSize: 11, color: "#8b949e" }}>...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(res => (
                  <div key={res.ticker} onClick={() => addTicker(res.ticker)}
                    style={{ padding: "8px 12px", borderBottom: "1px solid #21262d", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    className="hover:bg-[#21262d]"
                  >
                    <span style={{ color: ACCENT, fontWeight: 700, fontSize: 12 }}>{res.ticker}</span>
                    <span style={{ color: "#8b949e", fontSize: 10, maxWidth: "60%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{res.company}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: "8px 12px", fontSize: 11, color: "#8b949e" }}>{locale === "tr" ? "Bulunamadı" : "Not found"}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {!loading && !error && composition.length === 0 && (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          {/* Animated gradient container */}
          <div style={{
            background: "linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)",
            border: "1px solid #388bfd44",
            borderRadius: 16,
            padding: "40px 32px",
            maxWidth: 560,
            margin: "0 auto",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Glow effect */}
            <div style={{
              position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
              width: 200, height: 200, borderRadius: "50%",
              background: "radial-gradient(circle, #388bfd33 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Icon */}
            <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>📋</div>

            {/* Title */}
            <div style={{
              fontSize: 20, fontWeight: 900, color: "#58a6ff",
              letterSpacing: "-0.5px", marginBottom: 10,
            }}>
              {locale === "tr" ? "Kişisel Takip Listenizi Oluşturun" :
               locale === "es" ? "Crea Tu Lista de Seguimiento Personal" :
               locale === "fr" ? "Créez Votre Liste de Surveillance" :
               locale === "pt" ? "Crie Sua Lista de Observação" :
               "Create Your Personal Watchlist"}
            </div>

            {/* Description */}
            <div style={{ fontSize: 13, color: "#8b949e", lineHeight: 1.7, marginBottom: 24, maxWidth: 420, margin: "0 auto 24px" }}>
              {locale === "tr"
                ? "İzlemek istediğiniz hisseleri kendi listenize ekleyin. En az 5 hisse eklediğinizde kişisel izleme listeniz ana sayfada görünür hale gelir."
                : locale === "es"
                ? "Agrega las acciones que deseas seguir a tu lista personal. Cuando agregues al menos 5 acciones, tu lista aparecerá en la página de inicio."
                : locale === "fr"
                ? "Ajoutez les actions que vous souhaitez suivre à votre liste personnelle. Lorsque vous ajoutez au moins 5 actions, votre liste apparaît sur la page d'accueil."
                : locale === "pt"
                ? "Adicione as ações que deseja acompanhar à sua lista pessoal. Quando adicionar pelo menos 5 ações, sua lista aparecerá na página inicial."
                : "Add the stocks you want to track to your personal list. Once you add at least 5 stocks, your personal watchlist will appear on the home page."}
            </div>

            {/* Steps */}
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
              {[
                { icon: "🔍", label: locale === "tr" ? "Hisse Ara" : locale === "es" ? "Busca" : locale === "fr" ? "Cherche" : locale === "pt" ? "Busque" : "Search" },
                { icon: "➕", label: locale === "tr" ? "Ekle" : locale === "es" ? "Agrega" : locale === "fr" ? "Ajoute" : locale === "pt" ? "Adicione" : "Add" },
                { icon: "⭐", label: locale === "tr" ? "5+ Hisse" : locale === "es" ? "5+ Acciones" : locale === "fr" ? "5+ Actions" : locale === "pt" ? "5+ Ações" : "5+ Stocks" },
                { icon: "🏠", label: locale === "tr" ? "Ana Sayfa" : locale === "es" ? "Inicio" : locale === "fr" ? "Accueil" : locale === "pt" ? "Início" : "Home Page" },
              ].map((step, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{step.icon}</div>
                  <div style={{ fontSize: 10, color: "#58a6ff", fontWeight: 700, letterSpacing: "0.05em" }}>{step.label}</div>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <a
              href={`/global/${locale}/my-watchlist`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "linear-gradient(135deg, #388bfd, #1f6feb)",
                color: "#ffffff", borderRadius: 8, padding: "12px 28px",
                fontSize: 13, fontWeight: 800, textDecoration: "none",
                fontFamily: "monospace", letterSpacing: "0.05em",
                boxShadow: "0 4px 20px rgba(56,139,253,0.35)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(56,139,253,0.5)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(56,139,253,0.35)"; }}
            >
              ✨ {locale === "tr" ? "Listemi Oluştur" : locale === "es" ? "Crear Mi Lista" : locale === "fr" ? "Créer Ma Liste" : locale === "pt" ? "Criar Minha Lista" : "Create My Watchlist"}
            </a>

            {/* Note */}
            <div style={{ marginTop: 16, fontSize: 11, color: "#6e7681" }}>
              {locale === "tr" ? "Ücretsiz · 10 hisseye kadar · Günlük güncelleme — Premium: 50 hisse, saatlik" :
               locale === "es" ? "Gratis · Hasta 10 acciones · Actualización diaria — Premium: 50 acciones, cada hora" :
               locale === "fr" ? "Gratuit · Jusqu'à 10 actions · Mise à jour quotidienne — Premium : 50 actions, toutes les heures" :
               locale === "pt" ? "Gratuito · Até 10 ações · Atualização diária — Premium: 50 ações, a cada hora" :
               "Free · Up to 10 stocks · Daily updates — Premium: 50 stocks, hourly"}
            </div>
          </div>
        </div>
      )}


      {/* TABLE */}
      {activeTab === "table" && composition.length > 0 && (
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 260px)", marginTop: 15 }}>
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
                  { label: "DURUM (Trend)", key: null, align: "right" },
                  { label: "RSI", key: "rsi", align: "right" },
                  { label: "PATERN (Günlük)", key: null, align: "right" },
                  { label: "SİNYAL (Günlük)", key: "signal", align: "right" },
                  { label: "GRAFİK", key: null, align: "center" },
                  { label: "İŞLEM", key: null, align: "right" },
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
                  { label: "STATUS (Trend)", key: null, align: "right" },
                  { label: "RSI", key: "rsi", align: "right" },
                  { label: "PATTERN (Daily)", key: null, align: "right" },
                  { label: "SIGNAL (Daily)", key: "signal", align: "right" },
                  { label: "CHART", key: null, align: "center" },
                  { label: "ACTION", key: null, align: "right" },
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
                        <TickerHoverChart ticker={r.ticker} locale={locale} onDetailClick={() => window.open(`/global/${locale}/graphic/${r.ticker}`, '_blank')} detailLabel={locale === "tr" ? "Grafik Detay ↗" : "Chart Detail ↗"}>
                          <span>{r.ticker}</span>
                        </TickerHoverChart>
                      </td>
                      <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 12, whiteSpace: "nowrap" }} title={translateSector(d?.sector || r.sector, locale)}>{translateSector(d?.sector || r.sector, locale).slice(0, 12)}</td>
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
                      <td style={{ padding: "6px 8px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/global/${locale}/graphic/${r.ticker}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            background: "#1c2333", border: "1px solid #388bfd55",
                            color: "#58a6ff", borderRadius: 4, padding: "3px 8px",
                            fontSize: 10, fontWeight: 700, textDecoration: "none",
                            cursor: "pointer", fontFamily: "monospace",
                            transition: "all 0.15s",
                            whiteSpace: "nowrap",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#388bfd22"; (e.currentTarget as HTMLElement).style.borderColor = "#58a6ff"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1c2333"; (e.currentTarget as HTMLElement).style.borderColor = "#388bfd55"; }}
                          title={locale === "tr" ? "Grafik sayfasını aç" : "Open chart page"}
                        >
                          📊 {locale === "tr" ? "Grafik" : "Chart"} ↗
                        </a>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => removeTicker(r.ticker)}
                          style={{ background: "transparent", border: "1px solid #f8514944", color: "#f85149", borderRadius: 3, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}
                          title={locale === "tr" ? "Sil" : "Remove"}
                        >
                          ✕
                        </button>
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
            {locale === "tr" ? "Gün sonu saatlik Δ% ısı haritası — her hücre o saatin değişimini gösterir" : "End-of-day hourly Δ% heatmap — each cell shows that hour's change"}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, fontFamily: "monospace", minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "#58a6ff", fontSize: 11, letterSpacing: "0.1em" }}>TICKER</th>
                  {HOUR_SLOTS.map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "center", color: "#58a6ff", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  <th style={{ padding: "10px 14px", textAlign: "right", color: "#58a6ff", fontSize: 11 }}>{locale === "tr" ? "GÜN" : "DAY"}</th>
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
                        <TickerHoverChart ticker={r.ticker} locale={locale} onDetailClick={() => window.open(`/global/${locale}/graphic/${r.ticker}`, '_blank')} detailLabel={locale === "tr" ? "Grafik Detay ↗" : "Chart Detail ↗"}>
                          <a href={`/global/${locale}/graphic/${r.ticker}`} target="_blank" rel="noopener noreferrer" style={{ color: "#58a6ff", fontWeight: 900, textDecoration: "none" }}>{r.ticker}</a>
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
        </div>
      )}
      <DeepAnalysisOverlay ticker={analyzeTicker} locale={locale} onClose={() => setAnalyzeTicker(null)} />
    </div>
  );
}
