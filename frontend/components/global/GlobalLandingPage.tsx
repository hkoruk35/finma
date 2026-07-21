"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import HomeWatchlistSlot from "@/components/global/HomeWatchlistSlot";
import TickerSearchBox from "@/components/public/TickerSearchBox";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
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
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentGroup, setCurrentGroup] = useState("");
  
  // Sidebar states
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    // Fetch prices for all markets
    const allSymbols = GROUPS.flatMap(g => g.items.map(i => i.ySymbol)).join(",");
    fetch(`/api/quote?tickers=${allSymbols}`)
      .then(r => r.json())
      .then(d => setPrices(d))
      .catch(() => {});
  }, []);

  const aiText = locale === 'tr' ? 'BOGA AI, tüm ABD borsasında anlık genel kontrol yapabilir.' 
               : locale === 'es' ? 'BOGA AI puede realizar comprobaciones generales instantáneas en todo el mercado estadounidense.'
               : locale === 'fr' ? 'BOGA AI peut effectuer des contrôles généraux instantanés sur l\'ensemble du marché américain.'
               : locale === 'pt' ? 'A BOGA AI pode realizar verificações gerais instantâneas em todo o mercado dos EUA.'
               : 'BOGA AI can perform instant general checks across the entire US market.';

  // Determine current company/sector name based on selection
  useEffect(() => {
    let found = false;
    for (const g of GROUPS) {
      const item = g.items.find(i => i.ticker === selectedTicker);
      if (item) {
        setCurrentGroup(g.group);
        setCurrentCompany(item.label);
        found = true;
        break;
      }
    }
    if (!found) {
      setCurrentGroup("");
      setCurrentCompany("");
      fetch(`/api/watchlist-data?tickers=${selectedTicker}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.length > 0) {
            const match = data[0];
            if (match) {
              setCurrentCompany(match.company || "");
              setCurrentGroup(match.sector || "");
            }
          }
        }).catch(() => {});
    }
  }, [selectedTicker]);

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

      <main className="flex-1 flex flex-col md:flex-row max-w-[1600px] w-full mx-auto relative overflow-hidden">
        
        {/* LEFT COLUMN: MARKETS */}
        <div className={`
          ${showMobileSidebar ? 'block fixed inset-0 z-40 bg-[#0a0e17] overflow-y-auto pt-16 pb-20 px-4' : 'hidden'}
          ${showLeftSidebar ? 'md:block md:w-48 lg:w-56' : 'md:hidden'}
          md:static md:border-r border-[#1e2a3a] md:overflow-y-auto md:h-[calc(100vh-64px)]
          shrink-0 bg-[#0a0e17] transition-all duration-300
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
                <h3 className="px-3 mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest">{group.group}</h3>
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
                        <div className="min-w-0 pr-2">
                          <div className="text-[12px] font-medium text-white truncate">{item.ticker}</div>
                          <div className="text-[10px] text-slate-500 truncate">{item.label}</div>
                        </div>
                        <div className="text-right shrink-0">
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
          flex-1 min-w-0 flex flex-col md:overflow-y-auto md:h-[calc(100vh-64px)]
          ${showMobileSidebar ? 'hidden md:flex' : 'flex'}
        `}>
          
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a] bg-[#0a0e17] shrink-0">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                className="hidden md:flex p-1.5 text-slate-400 hover:text-white bg-[#141924] border border-[#1e2a3a] rounded transition-colors"
                title="Toggle Markets"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showLeftSidebar ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />}
                </svg>
              </button>
              <div className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest flex flex-wrap items-center gap-1.5">
                <span>GÖSTERGE PANELİ</span>
                <span className="opacity-30">/</span>
                <span className="text-white italic">{selectedTicker}</span>
                {currentCompany && <span className="text-slate-400 normal-case italic font-medium">{currentCompany}</span>}
                {currentGroup && (
                  <>
                    <span className="opacity-30">/</span>
                    <span className="text-[#3b82f6]">{currentGroup}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              
              <button 
                onClick={() => setShowRightSidebar(!showRightSidebar)}
                className="hidden md:flex p-1.5 text-slate-400 hover:text-white bg-[#141924] border border-[#1e2a3a] rounded transition-colors"
                title="Toggle Watchlist"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showRightSidebar ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />}
                </svg>
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col min-h-min">
            <div className="mb-4">
              <TickerSearchBox locale={locale} onSelect={(t) => { setSelectedTicker(t); setSelectedYSymbol(t); }} />
              
            </div>

            <div className="glass-card flex-1 min-h-[400px] md:min-h-[600px] rounded-xl overflow-hidden border border-[#1e2a3a] mb-6 shrink-0">
              <BogaChartEngine
                symbol={selectedYSymbol}
                lang={locale}
                detailMode
                height={600}
                defaultIndicators={["ema20", "bb", "rsi", "volumeProfile"]}
                defaultTimeframe="D"
              />
            </div>

            {/* Technical Analysis Panel */}
            <div className="shrink-0 mb-8">
              <TickerDetailPanel 
                ticker={selectedTicker} 
                locale={locale} 
                hideChart 
                hidePermalink 
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WATCHLIST */}
        <div className={`
          ${showMobileSidebar ? 'block pb-24 px-4' : 'hidden'}
          ${showRightSidebar ? 'md:block md:w-64 lg:w-80' : 'md:hidden'}
          md:border-l border-[#1e2a3a] md:overflow-y-auto md:h-[calc(100vh-64px)]
          shrink-0 bg-[#0a0e17] p-2 md:p-4 transition-all duration-300
        `}>
          <HomeWatchlistSlot 
            locale={locale} 
            defaultStocks={defaultWatchlist} 
            defaultViewAllHref={`/global/${locale}/watchlist`} 
            compactMode={true}
            disableHoverChart={true}
            onTickerSelect={(t) => { setSelectedTicker(t); setSelectedYSymbol(t); }}
          />
        </div>

      </main>

      <Footer hidePlatform locale={locale} />
    </div>
  );
}
