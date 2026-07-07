"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";

const SHORTCUTS = [
  { label: "TOP 100", href: "/global/en/top100" },
  { label: "SWING", href: "/global/en/swing" },
  { label: "TREND", href: "/global/en/trend" },
];

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

export default function GraphicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticker = (params?.ticker as string)?.toUpperCase() ?? "";
  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState<{ company?: string; sector?: string; industry?: string } | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .catch(() => router.push("/global/en/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!ticker) return;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: ticker, history: [], lang: "en" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.stockData) setStockData(d.stockData);
      })
      .catch(() => {});
  }, [ticker]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] text-white/50 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
          <nav className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
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
            {SHORTCUTS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
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

        <div className="glass-card overflow-hidden mb-4">
          <BogaChartEngine
            symbol={ticker}
            lang="en"
            detailMode
            height={600}
            defaultIndicators={["ema20", "ema50", "rsi", "volumeProfile"]}
            defaultTimeframe="D"
          />
        </div>
        <div className="glass-card overflow-hidden">
          <TickerDetailPanel ticker={ticker} locale="en" hideChart hidePermalink />
        </div>
      </main>
      <Footer hidePlatform locale="en" />
    </div>
  );
}
