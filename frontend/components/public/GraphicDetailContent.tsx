"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import SwingStrategyStatusCard from "@/components/public/SwingStrategyStatusCard";
import TickerSearchBox from "@/components/public/TickerSearchBox";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";

// Tum /global/{locale}/graphic/[ticker] sayfalarinin ORTAK govdesi —
// dil sayfalari sadece locale prop'u gecen ince sarmalayicilardir, boylece
// grafik sistemi hicbir dilde digerlerinden farkli davranamaz.

const PAGE_LABELS: Record<Locale, { dashboard: string; loading: string }> = {
  en: { dashboard: "Dashboard", loading: "Loading..." },
  tr: { dashboard: "Gösterge Paneli", loading: "Yükleniyor..." },
  es: { dashboard: "Panel", loading: "Cargando..." },
  fr: { dashboard: "Tableau de bord", loading: "Chargement..." },
  pt: { dashboard: "Painel", loading: "Carregando..." },
};

const SHORTCUT_LABELS: Record<Locale, { trend: string; candidates: string; top7: string; top100: string; myWatchlist: string }> = {
  en: { trend: "TREND", candidates: "WATCHLIST", top7: "TOP 7", top100: "TOP 100", myWatchlist: "MY WATCHLIST" },
  tr: { trend: "TREND", candidates: "TREND ADAYLARI", top7: "TOP 7", top100: "TOP 100", myWatchlist: "İZLEME LİSTEM" },
  es: { trend: "TENDENCIA", candidates: "CANDIDATAS", top7: "TOP 7", top100: "TOP 100", myWatchlist: "MI LISTA" },
  fr: { trend: "TENDANCE", candidates: "CANDIDATES", top7: "TOP 7", top100: "TOP 100", myWatchlist: "MA LISTE" },
  pt: { trend: "TENDÊNCIA", candidates: "CANDIDATAS", top7: "TOP 7", top100: "TOP 100", myWatchlist: "MINHA LISTA" },
};

const SECTOR_TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {},
  tr: {
    "us equity markets": "ABD HİSSE SENEDİ PİYASALARI",
    "technology": "TEKNOLOJİ",
    "energy": "ENERJİ",
    "financials": "FİNANS",
    "financial services": "FİNANSAL HİZMETLER",
    "healthcare": "SAĞLIK",
    "consumer discretionary": "TÜKETİCİ ÜRÜNLERİ",
    "consumer cyclical": "DÖNGÜSEL TÜKETİM",
    "consumer staples": "TEMEL TÜKETİM",
    "consumer defensive": "DEFANSİF TÜKETİM",
    "industrials": "ENDÜSTRİ",
    "materials": "MATERYALLER",
    "basic materials": "TEMEL MATERYALLER",
    "real estate": "GAYRİMENKUL",
    "utilities": "ALTYAPI",
    "communication services": "İLETİŞİM HİZMETLERİ",
    "etf": "ETF",
    "equity": "HİSSE SENEDİ"
  },
  es: {
    "us equity markets": "MERCADOS DE RENTA VARIABLE DE EE. UU.",
    "technology": "TECNOLOGÍA",
    "energy": "ENERGÍA",
    "financials": "FINANZAS",
    "financial services": "SERVICIOS FINANCIEROS",
    "healthcare": "CUIDADO DE LA SALUD",
    "consumer discretionary": "CONSUMO DISCRECIONAL",
    "consumer cyclical": "CONSUMO CÍCLICO",
    "consumer staples": "PRODUCTOS BÁSICOS",
    "consumer defensive": "CONSUMO DEFENSIVO",
    "industrials": "INDUSTRIALES",
    "materials": "MATERIALES",
    "basic materials": "MATERIALES BÁSICOS",
    "real estate": "BIENES RAÍCES",
    "utilities": "SERVICIOS PÚBLICOS",
    "communication services": "SERVICIOS DE COMUNICACIÓN"
  },
  fr: {
    "us equity markets": "MARCHÉS ACTIONS US",
    "technology": "TECHNOLOGIE",
    "energy": "ÉNERGIE",
    "financials": "FINANCE",
    "financial services": "SERVICES FINANCIERS",
    "healthcare": "SANTÉ",
    "consumer discretionary": "CONSOMMATION DISCRÉTIONNAIRE",
    "consumer cyclical": "CONSOMMATION CYCLIQUE",
    "consumer staples": "BIENS DE CONSOMMATION COURANTE",
    "consumer defensive": "CONSOMMATION DÉFENSIVE",
    "industrials": "INDUSTRIE",
    "materials": "MATÉRIAUX",
    "basic materials": "MATÉRIAUX DE BASE",
    "real estate": "IMMOBILIER",
    "utilities": "SERVICES PUBLICS",
    "communication services": "SERVICES DE COMMUNICATION"
  },
  pt: {
    "us equity markets": "MERCADOS DE AÇÕES DOS EUA",
    "technology": "TECNOLOGIA",
    "energy": "ENERGIA",
    "financials": "FINANÇAS",
    "financial services": "SERVIÇOS FINANCEIROS",
    "healthcare": "SAÚDE",
    "consumer discretionary": "CONSUMO DISCRICIONÁRIO",
    "consumer cyclical": "CONSUMO CÍCLICO",
    "consumer staples": "BENS DE CONSUMO BÁSICO",
    "consumer defensive": "CONSUMO DEFENSIVO",
    "industrials": "INDUSTRIAIS",
    "materials": "MATERIAIS",
    "basic materials": "MATERIAIS BÁSICOS",
    "real estate": "MERCADO IMOBILIÁRIO",
    "utilities": "SERVIÇOS PÚBLICOS",
    "communication services": "SERVIÇOS DE COMUNICAÇÃO"
  }
};

function translateSector(sector: string, locale: Locale): string {
  if (!sector) return "";
  const lower = sector.toLowerCase();
  return SECTOR_TRANSLATIONS[locale]?.[lower] || sector;
}

// Index tickers shown in the header strip: S&P 500, Nasdaq, Dow, Russell 2000, VIX.
const INDICES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^DJI", label: "DOW" },
  { symbol: "^RUT", label: "RUSSELL" },
  { symbol: "^VIX", label: "VIX" },
];

const SECTOR_ETF_MAP: Record<string, string> = {
  technology: "XLK", energy: "XLE", financials: "XLF", "financial services": "XLF",
  healthcare: "XLV", "consumer discretionary": "XLY", "consumer cyclical": "XLY",
  "consumer staples": "XLP", "consumer defensive": "XLP", industrials: "XLI",
  materials: "XLB", "basic materials": "XLB", "real estate": "XLRE",
  utilities: "XLU", "communication services": "XLC",
};

type Quote = { price: number | null; change_1d: number | null };

function fmtChange(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function GraphicDetailContent({ locale }: { locale: Locale }) {
  const params = useParams();
  const ticker = (params?.ticker as string)?.toUpperCase() ?? "";
  const labels = PAGE_LABELS[locale];
  const registerHref = locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;

  const [stockData, setStockData] = useState<{ company?: string; sector?: string; industry?: string } | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  // Herkese acik onizleme: giris yapmamis ziyaretcilerin ust kisayol
  // butonlariyla uye-kilitli sayfalara (Top100/Swing/Trend/Analiz)
  // gecmesini engellemek icin oturum durumunu bir kez kontrol ediyoruz.
  const { isPremium, loading } = useMemberPlan();
  const TOP7_TICKERS = ["AAPL", "GOOG", "MSFT", "AMZN", "NVDA", "META", "TSLA"];
  const isTop7 = TOP7_TICKERS.includes(ticker);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  // null = henuz bilinmiyor (SSR/ilk render) — BogaChartEngine, defaultIndicators
  // prop'unu SADECE mount aninda ilk state'i tohumlamak icin kullaniyor, bu
  // yuzden grafik mobil/masaustu bilgisi netlesmeden onceden yanlis (masaustu)
  // varsayilanlarla mount olursa sonradan prop degisse bile duzelmez —
  // bu deger belli olana kadar grafigi hic render etmiyoruz.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/members/me")
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!ticker) return;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: ticker, history: [], lang: locale }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.stockData) setStockData(d.stockData);
      })
      .catch(() => {});
  }, [ticker, locale]);

  // Index quotes — fetched once, independent of the stock's sector.
  useEffect(() => {
    fetch(`/api/quote?tickers=${INDICES.map((i) => i.symbol).join(",")}`)
      .then((r) => r.json())
      .then((d) => setQuotes((prev) => ({ ...prev, ...d })))
      .catch(() => {});
  }, []);

  // Sector ETF quote — fetched once the stock's sector is known.
  const sectorEtf = stockData?.sector ? SECTOR_ETF_MAP[stockData.sector.toLowerCase()] : undefined;
  useEffect(() => {
    if (!sectorEtf) return;
    fetch(`/api/quote?tickers=${sectorEtf}`)
      .then((r) => r.json())
      .then((d) => setQuotes((prev) => ({ ...prev, ...d })))
      .catch(() => {});
  }, [sectorEtf]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
          <nav className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Link href={`/global/${locale}/home`} className="hover:text-[#3b82f6] transition-colors">{labels.dashboard}</Link>
            <span className="opacity-30">/</span>
            <span className="text-white italic">{ticker}</span>
            {stockData?.company && (
              <span className="text-slate-400 normal-case italic font-medium">{stockData.company}</span>
            )}
            {stockData?.sector && (
              <>
                <span className="opacity-30">/</span>
                <span className="text-[#3b82f6]">{translateSector(stockData.sector, locale)}</span>
              </>
            )}
            {stockData?.industry && stockData.industry !== stockData.sector && (
              <>
                <span className="opacity-30">/</span>
                <span className="text-slate-400">{translateSector(stockData.industry, locale)}</span>
              </>
            )}
          </nav>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const sl = SHORTCUT_LABELS[locale] || SHORTCUT_LABELS.en;
              const shortcutsItems = [
                { label: sl.trend, href: `/global/${locale}/swing` },
                { label: sl.candidates, href: `/global/${locale}/watchlist` },
                { label: sl.top7, href: `/global/${locale}/top7` },
                { label: sl.top100, href: `/global/${locale}/top100` },
                { label: sl.myWatchlist, href: `/global/${locale}/my-watchlist` },
              ];
              return shortcutsItems.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="px-3 py-1.5 rounded-lg bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/50 transition-all uppercase"
                >
                  {s.label}
                </Link>
              ));
            })()}
          </div>
        </div>

        <TickerSearchBox locale={locale} />

        {/* Endeks şeridi — masaüstünde sabit satır, mobilde yer kaplamasın
            diye tek satır halinde yavaşça kayan (marquee) şerit. */}
        <div className="hidden md:flex flex-wrap items-center gap-1.5 mb-4">
          {INDICES.map((idx) => {
            const q = quotes[idx.symbol];
            const positive = (q?.change_1d ?? 0) >= 0;
            return (
              <div
                key={idx.symbol}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#1e2a3a] text-[10px] font-bold"
              >
                <span className="text-slate-400">{idx.label}</span>
                <span className="text-white font-mono">{q?.price != null ? q.price.toFixed(2) : "—"}</span>
                <span className={positive ? "text-emerald-400" : "text-red-400"}>{fmtChange(q?.change_1d)}</span>
              </div>
            );
          })}
          {sectorEtf && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#3b82f6]/30 text-[10px] font-bold">
              <span className="text-[#3b82f6]">{translateSector(stockData?.sector || "", locale)} ({sectorEtf})</span>
              <span className="text-white font-mono">
                {quotes[sectorEtf]?.price != null ? quotes[sectorEtf].price!.toFixed(2) : "—"}
              </span>
              <span className={(quotes[sectorEtf]?.change_1d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmtChange(quotes[sectorEtf]?.change_1d)}
              </span>
            </div>
          )}
        </div>

        <div className="md:hidden w-full overflow-hidden mb-4 rounded-lg border border-[#1e2a3a] bg-[#141924]">
          <div className="ticker-tape flex items-center gap-4 py-1.5 px-3 whitespace-nowrap w-max">
            {[...Array(2)].flatMap((_, dup) => [
              ...INDICES.map((idx) => {
                const q = quotes[idx.symbol];
                const positive = (q?.change_1d ?? 0) >= 0;
                return (
                  <div key={`${idx.symbol}-${dup}`} className="flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                    <span className="text-slate-400">{idx.label}</span>
                    <span className="text-white font-mono">{q?.price != null ? q.price.toFixed(2) : "—"}</span>
                    <span className={positive ? "text-emerald-400" : "text-red-400"}>{fmtChange(q?.change_1d)}</span>
                  </div>
                );
              }),
              ...(sectorEtf
                ? [
                    <div key={`${sectorEtf}-${dup}`} className="flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                      <span className="text-[#3b82f6]">{translateSector(stockData?.sector || "", locale)} ({sectorEtf})</span>
                      <span className="text-white font-mono">
                        {quotes[sectorEtf]?.price != null ? quotes[sectorEtf].price!.toFixed(2) : "—"}
                      </span>
                      <span className={(quotes[sectorEtf]?.change_1d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {fmtChange(quotes[sectorEtf]?.change_1d)}
                      </span>
                    </div>,
                  ]
                : []),
            ])}
          </div>
        </div>

        {/* v3.2: Hisse arama geçici olarak kaldırıldı — şimdilik sadece
            BOGA AI Swing Trade havuzuna odaklanıyoruz. */}

        <div className="glass-card overflow-hidden mb-4" style={{ minHeight: isMobile === null ? 420 : undefined }}>
          {isMobile !== null && (
            <BogaChartEngine
              symbol={ticker}
              lang={locale}
              detailMode
              height={isMobile ? 420 : 600}
              defaultIndicators={
                isMobile
                  ? ["ema50", "volume"]
                  : isPremium
                  ? ["ema20", "ema50", "rsi", "volumeProfile"]
                  : ["ema50", "rsi", "volume"]
              }
              defaultTimeframe="D"
              premiumGate={!isTop7 && !isPremium && !loading}
            />
          )}
        </div>
        {ticker && <SwingStrategyStatusCard ticker={ticker} locale={locale} />}
        <div className="glass-card overflow-hidden">
          <TickerDetailPanel ticker={ticker} locale={locale} hideChart hidePermalink lockTradePlanCard />
        </div>
      </main>
      <Footer hidePlatform locale={locale} />
    </div>
  );
}
