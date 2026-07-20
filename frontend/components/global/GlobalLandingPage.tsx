"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import HomeWatchlistSlot from "@/components/global/HomeWatchlistSlot";
import type { Locale } from "@/lib/i18n/copy";

const GROUPS = [
  {
    group: "US Equity Markets",
    items: [
      { ticker: "SPY", label: "S&P 500 ETF", ySymbol: "SPY" },
      { ticker: "QQQ", label: "Nasdaq 100", ySymbol: "QQQ" },
      { ticker: "DIA", label: "Dow Jones", ySymbol: "DIA" },
      { ticker: "IWM", label: "Russell 2000", ySymbol: "IWM" },
      { ticker: "VIX", label: "Volatility Index", ySymbol: "^VIX" },
    ],
  },
  {
    group: "US Sectors",
    items: [
      { ticker: "XLK", label: "Technology", ySymbol: "XLK" },
      { ticker: "XLF", label: "Financials", ySymbol: "XLF" },
      { ticker: "XLE", label: "Energy", ySymbol: "XLE" },
      { ticker: "XLV", label: "Health Care", ySymbol: "XLV" },
      { ticker: "XLY", label: "Cons. Discretionary", ySymbol: "XLY" },
      { ticker: "XLP", label: "Cons. Staples", ySymbol: "XLP" },
      { ticker: "XLI", label: "Industrials", ySymbol: "XLI" },
      { ticker: "XLB", label: "Materials", ySymbol: "XLB" },
      { ticker: "XLRE", label: "Real Estate", ySymbol: "XLRE" },
      { ticker: "XLU", label: "Utilities", ySymbol: "XLU" },
      { ticker: "XLC", label: "Comm. Services", ySymbol: "XLC" },
    ],
  },
  {
    group: "Currencies",
    items: [
      { ticker: "EURUSD", label: "EUR/USD", ySymbol: "EURUSD=X" },
      { ticker: "GBPUSD", label: "GBP/USD", ySymbol: "GBPUSD=X" },
      { ticker: "USDJPY", label: "USD/JPY", ySymbol: "JPY=X" },
      { ticker: "USDCHF", label: "USD/CHF", ySymbol: "CHF=X" },
      { ticker: "AUDUSD", label: "AUD/USD", ySymbol: "AUDUSD=X" },
      { ticker: "USDCAD", label: "USD/CAD", ySymbol: "CAD=X" },
    ],
  },
  {
    group: "Commodities",
    items: [
      { ticker: "GOLD", label: "Gold", ySymbol: "GC=F" },
      { ticker: "SILVER", label: "Silver", ySymbol: "SI=F" },
      { ticker: "USOIL", label: "Crude Oil WTI", ySymbol: "CL=F" },
      { ticker: "NATGAS", label: "Natural Gas", ySymbol: "NG=F" },
    ],
  },
  {
    group: "Crypto",
    items: [
      { ticker: "BTCUSD", label: "Bitcoin", ySymbol: "BTC-USD" },
      { ticker: "ETHUSD", label: "Ethereum", ySymbol: "ETH-USD" },
    ],
  },
];

type PriceInfo = { price: number | null; change_1d: number | null };

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pColor = (v: number | null) => v == null ? "text-slate-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-400";
const sgn = (v: number) => (v > 0 ? "+" : "");

export default function GlobalLandingPage({ locale, defaultWatchlist }: { locale: Locale, defaultWatchlist: any[] }) {
  const [selectedTicker, setSelectedTicker] = useState("SPY");
  const [selectedYSymbol, setSelectedYSymbol] = useState("SPY");
  
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    // Fetch prices for all markets
    const allSymbols = GROUPS.flatMap(g => g.items.map(i => i.ySymbol)).join(",");
    fetch(`/api/quote?tickers=${allSymbols}`)
      .then(r => r.json())
      .then(d => setPrices(d))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />
      
      {/* Mobile Hamburger Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a] bg-[#0a0e17]">
        <span className="text-white font-bold">{selectedTicker} Chart</span>
        <button 
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          className="p-2 bg-[#141924] border border-[#1e2a3a] rounded-lg text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <main className="flex-1 flex flex-col md:flex-row max-w-[1600px] w-full mx-auto relative">
        
        {/* LEFT COLUMN: MARKETS */}
        <div className={`
          ${showMobileSidebar ? 'block fixed inset-0 z-40 bg-[#0a0e17] overflow-y-auto pt-16 pb-20 px-4' : 'hidden'}
          md:block md:static md:w-64 lg:w-72 md:border-r border-[#1e2a3a] md:overflow-y-auto md:h-[calc(100vh-64px)]
          shrink-0 bg-[#0a0e17]
        `}>
          {showMobileSidebar && (
            <button onClick={() => setShowMobileSidebar(false)} className="md:hidden absolute top-4 right-4 p-2 bg-[#1e2a3a] rounded-lg text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <div className="md:py-4">
            {GROUPS.map(group => (
              <div key={group.group} className="mb-6">
                <h3 className="px-3 mb-2 text-xs font-black text-slate-500 uppercase tracking-widest">{group.group}</h3>
                <div className="flex flex-col">
                  {group.items.map(item => {
                    const price = prices[item.ySymbol];
                    const selected = selectedTicker === item.ticker;
                    const chg = price?.change_1d ?? null;
                    return (
                      <div 
                        key={item.ticker}
                        onClick={() => {
                          setSelectedTicker(item.ticker);
                          setSelectedYSymbol(item.ySymbol);
                          setShowMobileSidebar(false);
                        }}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer border-l-2 transition-colors ${
                          selected ? "border-[#3b82f6] bg-[#3b82f6]/10" : "border-transparent hover:bg-white/[0.03]"
                        }`}
                      >
                        <div>
                          <div className="text-[12px] font-black text-white">{item.ticker}</div>
                          <div className="text-[10px] text-slate-500">{item.label}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-mono text-white">
                            {price?.price != null ? fmt(price.price) : "..."}
                          </div>
                          {chg != null && (
                            <div className={`text-[10px] font-mono ${pColor(chg)}`}>
                              {sgn(chg)}{fmt(chg)}%
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE COLUMN: CHART */}
        <div className={`
          flex-1 p-2 md:p-4 min-w-0 flex flex-col
          ${showMobileSidebar ? 'hidden md:flex' : 'flex'}
        `}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-black text-white tracking-tight">{selectedTicker} <span className="text-slate-500 font-medium">Terminal</span></h1>
          </div>
          <div className="glass-card flex-1 min-h-[400px] md:min-h-[600px] rounded-xl overflow-hidden border border-[#1e2a3a]">
            <BogaChartEngine
              symbol={selectedYSymbol}
              lang={locale}
              detailMode
              height={600}
              defaultIndicators={["ema20", "bb", "rsi", "volumeProfile"]}
              defaultTimeframe="D"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: WATCHLIST */}
        <div className={`
          ${showMobileSidebar ? 'block pb-24 px-4' : 'hidden'}
          md:block md:w-80 lg:w-96 md:border-l border-[#1e2a3a] md:overflow-y-auto md:h-[calc(100vh-64px)]
          shrink-0 bg-[#0a0e17] p-4
        `}>
          <HomeWatchlistSlot 
            locale={locale} 
            defaultStocks={defaultWatchlist} 
            defaultViewAllHref={`/global/${locale}/watchlist`} 
          />
        </div>

      </main>

      <Footer hidePlatform locale={locale} />
    </div>
  );
}
