"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import SwingStrategyStatusCard from "@/components/public/SwingStrategyStatusCard";
import type { Locale } from "@/lib/i18n/copy";

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
  const shortcuts = [
    { label: "SWING", href: `/global/${locale}/swing` },
    { label: "WATCHLIST", href: `/global/${locale}/watchlist` },
    { label: "TOP 100", href: `/global/${locale}/top100` },
  ];

  const [stockData, setStockData] = useState<{ company?: string; sector?: string; industry?: string } | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  // Herkese acik onizleme: giris yapmamis ziyaretcilerin ust kisayol
  // butonlariyla uye-kilitli sayfalara (Top100/Swing/Trend/Analiz)
  // gecmesini engellemek icin oturum durumunu bir kez kontrol ediyoruz.
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/members/me")
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
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
                <span className="text-[#3b82f6]">{stockData.sector}</span>
              </>
            )}
            {stockData?.industry && stockData.industry !== stockData.sector && (
              <>
                <span className="opacity-30">/</span>
                <span className="text-slate-400">{stockData.industry}</span>
              </>
            )}
          </nav>

          <div className="flex items-center gap-1.5">
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={isLoggedIn ? s.href : registerHref}
                className="px-3 py-1.5 rounded-lg bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/50 transition-all"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-4">
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
              <span className="text-[#3b82f6]">{stockData?.sector} ({sectorEtf})</span>
              <span className="text-white font-mono">
                {quotes[sectorEtf]?.price != null ? quotes[sectorEtf].price!.toFixed(2) : "—"}
              </span>
              <span className={(quotes[sectorEtf]?.change_1d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmtChange(quotes[sectorEtf]?.change_1d)}
              </span>
            </div>
          )}
        </div>

        {/* v3.2: Hisse arama geçici olarak kaldırıldı — şimdilik sadece
            BOGA AI Swing Trade havuzuna odaklanıyoruz. */}

        <div className="glass-card overflow-hidden mb-4">
          <BogaChartEngine
            symbol={ticker}
            lang={locale}
            detailMode
            height={600}
            defaultIndicators={["ema20", "ema50", "rsi", "volumeProfile"]}
            defaultTimeframe="D"
          />
        </div>
        {ticker && <SwingStrategyStatusCard ticker={ticker} locale={locale} />}
        <div className="glass-card overflow-hidden">
          <TickerDetailPanel ticker={ticker} locale={locale} hideChart hidePermalink lockTradePlan />
        </div>
      </main>
      <Footer hidePlatform locale={locale} />
    </div>
  );
}
