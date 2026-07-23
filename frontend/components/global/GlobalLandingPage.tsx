"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import HomeWatchlistSlot from "@/components/global/HomeWatchlistSlot";
import TrendPicksSlot from "@/components/global/TrendPicksSlot";
import TickerSearchBox from "@/components/public/TickerSearchBox";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import CompareCheckbox from "@/components/global/CompareCheckbox";
import PremiumModal from "@/components/global/PremiumModal";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import type { Locale } from "@/lib/i18n/copy";

const FREE_COMPARE_LIMIT = 2;
const MAX_COMPARE = 9;

const getGroups = (locale: Locale) => {
  const t = (en: string, tr: string, es: string, fr: string, pt: string) => {
    if (locale === 'tr') return tr;
    if (locale === 'es') return es;
    if (locale === 'fr') return fr;
    if (locale === 'pt') return pt;
    return en;
  };

  return [
    {
      group: t("US Equity Markets", "ABD Hisse Senedi Piyasaları", "Mercados de Valores de EE. UU.", "Marchés Boursiers Américains", "Mercados de Ações dos EUA"),
      items: [
        { ticker: "SPY", label: "S&P 500 ETF", ySymbol: "SPY" },
        { ticker: "QQQ", label: "Nasdaq 100", ySymbol: "QQQ" },
        { ticker: "DIA", label: "Dow Jones", ySymbol: "DIA" },
        { ticker: "IWM", label: "Russell 2000", ySymbol: "IWM" },
        { ticker: "VIX", label: t("Volatility Index", "Volatilite Endeksi", "Índice de Volatilidad", "Indice de Volatilité", "Índice de Volatilidade"), ySymbol: "^VIX" },
      ],
    },
    {
      group: t("US Sectors", "ABD Sektörleri", "Sectores de EE. UU.", "Secteurs Américains", "Setores dos EUA"),
      items: [
        { ticker: "XLK", label: t("Technology", "Teknoloji", "Tecnología", "Technologie", "Tecnologia"), ySymbol: "XLK" },
        { ticker: "XLF", label: t("Financials", "Finans", "Finanzas", "Finance", "Finanças"), ySymbol: "XLF" },
        { ticker: "XLE", label: t("Energy", "Enerji", "Energía", "Énergie", "Energia"), ySymbol: "XLE" },
        { ticker: "XLV", label: t("Health Care", "Sağlık", "Salud", "Santé", "Saúde"), ySymbol: "XLV" },
        { ticker: "XLY", label: t("Cons. Discretionary", "Tüketim (İsteğe Bağlı)", "Consumo Discrecional", "Consommation Discrétionnaire", "Consumo Discricionário"), ySymbol: "XLY" },
        { ticker: "XLP", label: t("Cons. Staples", "Temel Tüketim", "Consumo Básico", "Biens de Consommation Essentiels", "Bens de Consumo Essenciais"), ySymbol: "XLP" },
        { ticker: "XLI", label: t("Industrials", "Sanayi", "Industriales", "Industriels", "Bens Industriais"), ySymbol: "XLI" },
        { ticker: "XLB", label: t("Materials", "Materyaller", "Materiales", "Matériaux", "Materiais"), ySymbol: "XLB" },
        { ticker: "XLRE", label: t("Real Estate", "Gayrimenkul", "Bienes Raíces", "Immobilier", "Setor Imobiliário"), ySymbol: "XLRE" },
        { ticker: "XLU", label: t("Utilities", "Altyapı", "Servicios Públicos", "Services Publics", "Serviços Públicos"), ySymbol: "XLU" },
        { ticker: "XLC", label: t("Comm. Services", "İletişim Hizmetleri", "Servicios de Com.", "Services de Com.", "Serviços de Com."), ySymbol: "XLC" },
      ],
    },
    {
      group: t("Currencies", "Döviz", "Divisas", "Devises", "Moedas"),
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
      group: t("Commodities", "Emtia", "Materias Primas", "Matières Premières", "Commodities"),
      items: [
        { ticker: "GOLD", label: t("Gold", "Altın", "Oro", "Or", "Ouro"), ySymbol: "GC=F" },
        { ticker: "SILVER", label: t("Silver", "Gümüş", "Plata", "Argent", "Prata"), ySymbol: "SI=F" },
        { ticker: "USOIL", label: t("Crude Oil WTI", "Ham Petrol WTI", "Petróleo Crudo WTI", "Pétrole Brut WTI", "Petróleo Bruto WTI"), ySymbol: "CL=F" },
        { ticker: "NATGAS", label: t("Natural Gas", "Doğal Gaz", "Gas Natural", "Gaz Naturel", "Gás Natural"), ySymbol: "NG=F" },
      ],
    },
    {
      group: t("Crypto", "Kripto", "Criptomonedas", "Crypto", "Criptomoedas"),
      items: [
        { ticker: "BTCUSD", label: "Bitcoin", ySymbol: "BTC-USD" },
        { ticker: "ETHUSD", label: "Ethereum", ySymbol: "ETH-USD" },
      ],
    },
  ];
};

type PriceInfo = { price: number | null; change_1d: number | null };

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pColor = (v: number | null) => v == null ? "text-slate-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-400";
const sgn = (v: number) => (v > 0 ? "+" : "");

export default function GlobalLandingPage({ locale, defaultWatchlist }: { locale: Locale, defaultWatchlist: any[] }) {
  const router = useRouter();
  const [selectedTicker, setSelectedTicker] = useState("SPY");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const allowTerminal = sessionStorage.getItem("allow_mobile_terminal") === "true";
      if (isMobile && !allowTerminal) {
        router.replace(`/global/${locale}/home`);
      }
    }
  }, [locale, router]);
  const [selectedYSymbol, setSelectedYSymbol] = useState("SPY");
  
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentGroup, setCurrentGroup] = useState("");
  
  // Personal Watchlist
  const [personalStocks, setPersonalStocks] = useState<any[]>([]);
  const [usePersonal, setUsePersonal] = useState(false);

  useEffect(() => {
    fetch('/api/watchlist/custom', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { tickers: [] })
      .then(data => {
        const tickers: string[] = data.tickers || [];
        if (tickers.length >= 5) {
          const top = tickers.slice(0, 50);
          return fetch(`/api/watchlist-data?tickers=${top.join(',')}`)
            .then(r => r.ok ? r.json() : [])
            .then((rows: any[]) => {
              const stocks = rows.map(r => ({
                ticker: r.ticker,
                sector: r.sector && r.sector !== 'Unknown' ? r.sector : 'Technology',
                price: r.price?.current ?? 0,
                change_pct: r.tracker_1h?.change_pct_1d ?? r.price?.change_pct ?? 0,
              }));
              setPersonalStocks(stocks);
              setUsePersonal(true);
            });
        }
      })
      .catch(() => {});
  }, []);
  
  // Sidebar states
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [rightTab, setRightTab] = useState<"watchlist" | "trend">("watchlist");

  const { isPremium } = useMemberPlan();
  // Sol Markets + sağ Watchlist/Trend Hisseleri satırlarındaki onay
  // kutucuklarıyla toplanan, "Çoklu Grafik Ekranı"na gönderilecek ticker
  // seçimi. Üye olmayanlar aynı anda en fazla FREE_COMPARE_LIMIT kadar
  // işaretleyebilir; fazlasını denerse PremiumModal açılır.
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showCompareLimitModal, setShowCompareLimitModal] = useState(false);
  const [multiChartRequest, setMultiChartRequest] = useState<string[] | null>(null);

  const groups = useMemo(() => getGroups(locale), [locale]);

  const toggleCompare = (ticker: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (!isPremium && prev.length >= FREE_COMPARE_LIMIT) {
        setShowCompareLimitModal(true);
        return prev;
      }
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, ticker];
    });
  };

  // "İşlem Kurgusu Gerekçesi" kartı sadece bu sabit ticker kümesi için
  // üye olmayanlara da açık — sol Markets listesindeki her şey + sağdaki
  // varsayılan 7 hisselik watchlist. Aranan/başka herhangi bir ticker için
  // kilitli kalır (bkz. TickerDetailPanel'deki unlockRationale).
  // kilitli kalır (bkz. TickerDetailPanel'deki unlockRationale).
  const eligibleForRationale = useMemo(() => {
    const set = new Set<string>(groups.flatMap((g) => g.items.map((i) => i.ticker)));
    defaultWatchlist.forEach((s) => { if (s?.ticker) set.add(s.ticker); });
    return set;
  }, [defaultWatchlist, groups]);

  useEffect(() => {
    // Fetch prices for all markets
    const allSymbols = groups.flatMap(g => g.items.map(i => i.ySymbol)).join(",");
    fetch(`/api/quote?tickers=${allSymbols}`)
      .then(r => r.json())
      .then(d => setPrices(d))
      .catch(() => {});
  }, [groups]);

  const watchlistTabLabel = 'TOP7';
  const trendTabLabel = locale === 'tr' ? 'Trend Hisseleri' : locale === 'es' ? 'Acciones en Tendencia' : locale === 'fr' ? 'Actions Tendance' : locale === 'pt' ? 'Ações em Tendência' : 'Trending Stocks';
  const compareLabel = locale === 'tr' ? 'Karşılaştır' : locale === 'es' ? 'Comparar' : locale === 'fr' ? 'Comparer' : locale === 'pt' ? 'Comparar' : 'Compare';
  const compareOpenLabel = locale === 'tr' ? 'Aç' : locale === 'es' ? 'Abrir' : locale === 'fr' ? 'Ouvrir' : locale === 'pt' ? 'Abrir' : 'Open';
  const compareCheckboxTitle = locale === 'tr' ? 'Çoklu grafik için seç' : locale === 'es' ? 'Seleccionar para comparar' : locale === 'fr' ? 'Sélectionner pour comparer' : locale === 'pt' ? 'Selecionar para comparar' : 'Select to compare';
  const dashboardLabel = locale === 'tr' ? 'GÖSTERGE PANELİ' : locale === 'es' ? 'PANEL DE CONTROL' : locale === 'fr' ? 'TABLEAU DE BORD' : locale === 'pt' ? 'PAINEL DE CONTROLE' : 'DASHBOARD';

  const aiText = locale === 'tr' ? 'BOGA AI, tüm ABD borsasında anlık genel kontrol yapabilir.'
               : locale === 'es' ? 'BOGA AI puede realizar comprobaciones generales instantáneas en todo el mercado estadounidense.'
               : locale === 'fr' ? 'BOGA AI peut effectuer des contrôles généraux instantanés sur l\'ensemble du marché américain.'
               : locale === 'pt' ? 'A BOGA AI pode realizar verificações gerais instantâneas em todo o mercado dos EUA.'
               : 'BOGA AI can perform instant general checks across the entire US market.';

  // Determine current company/sector name based on selection
  useEffect(() => {
    let found = false;
    for (const g of groups) {
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
            {groups.map(group => (
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
                        className={`flex items-center gap-2 justify-between px-3 py-2 cursor-pointer border-l-2 transition-colors ${
                          selected ? "border-[#3b82f6] bg-[#3b82f6]/10" : "border-transparent hover:bg-white/[0.03]"
                        }`}
                      >
                        <CompareCheckbox
                          checked={compareSelection.includes(item.ticker)}
                          onToggle={() => toggleCompare(item.ticker)}
                          title={compareCheckboxTitle}
                        />
                        <div className="min-w-0 pr-2 flex-1">
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
                <span>{dashboardLabel}</span>
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
              
              <div className="hidden md:block w-64 mr-2">
                <TickerSearchBox locale={locale} compact onSelect={(t) => { setSelectedTicker(t); setSelectedYSymbol(t); }} />
              </div>
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

          <div className="p-4 flex-1 flex flex-col gap-6 min-h-min">
            <div className="glass-card flex-1 min-h-[400px] md:min-h-[600px] rounded-xl overflow-hidden border border-[#1e2a3a] shrink-0">
              <BogaChartEngine
                symbol={selectedYSymbol}
                lang={locale}
                detailMode
                height={600}
                defaultIndicators={["ema50", "rsi"]}
                defaultTimeframe="D"
                defaultCandleType="candle"
                premiumGate
                externalMultiChartTickers={multiChartRequest}
                onExternalMultiChartConsumed={() => setMultiChartRequest(null)}
              />
            </div>

            {/* Technical Analysis Panel */}
            <div className="shrink-0">
              <TickerDetailPanel
                ticker={selectedTicker}
                locale={locale}
                hideChart
                hidePermalink
                lockTradePlanCard
                unlockRationale={eligibleForRationale.has(selectedTicker)}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WATCHLIST / TREND HİSSELERİ */}
        <div className={`
          ${showMobileSidebar ? 'flex flex-col pb-24 px-4' : 'hidden'}
          ${showRightSidebar ? 'md:flex md:flex-col md:w-48 lg:w-56' : 'md:hidden'}
          md:border-l border-[#1e2a3a] md:overflow-y-auto md:h-[calc(100vh-64px)]
          shrink-0 bg-[#0a0e17] p-2 md:p-3 transition-all duration-300
        `}>
          <div className="flex items-center gap-1.5 mb-2 shrink-0">
            <button
              onClick={() => setRightTab("watchlist")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                rightTab === "watchlist" ? "bg-[#3b82f6] text-white" : "bg-[#141924] border border-[#1e2a3a] text-slate-400 hover:text-white"
              }`}
            >
              {watchlistTabLabel}
            </button>
            <button
              onClick={() => setRightTab("trend")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                rightTab === "trend" ? "bg-[#f59e0b] text-white" : "bg-[#141924] border border-[#1e2a3a] text-slate-400 hover:text-white"
              }`}
            >
              {trendTabLabel}
            </button>
          </div>

          {compareSelection.length > 0 && (
            <div className="mb-2 shrink-0 rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-2.5 py-2 flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-bold text-[#3b82f6] uppercase tracking-wider shrink-0">
                {compareLabel} ({compareSelection.length}{!isPremium ? `/${FREE_COMPARE_LIMIT}` : ""})
              </span>
              <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                {compareSelection.map((tkr) => (
                  <span key={tkr} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#141924] border border-[#1e2a3a] text-[9px] font-bold text-white">
                    {tkr}
                    <button onClick={() => toggleCompare(tkr)} className="text-slate-500 hover:text-white leading-none">×</button>
                  </span>
                ))}
              </div>
              <button
                disabled={compareSelection.length < 2}
                onClick={() => setMultiChartRequest([...compareSelection])}
                className="shrink-0 px-2 py-1 rounded bg-[#3b82f6] text-white text-[9px] font-black uppercase disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2563eb] transition-colors"
              >
                {compareOpenLabel} →
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">
            {rightTab === "watchlist" ? (
              <div className="flex flex-col">
                {(usePersonal ? personalStocks : defaultWatchlist).map(stock => {
                  const selected = selectedTicker === stock.ticker;
                  return (
                    <div 
                      key={stock.ticker}
                      onClick={() => {
                        setSelectedTicker(stock.ticker);
                        setSelectedYSymbol(stock.ticker);
                        setShowMobileSidebar(false);
                      }}
                      className={`flex items-center gap-2 justify-between px-3 py-2 cursor-pointer border-r-2 transition-colors ${
                        selected ? "border-[#3b82f6] bg-[#3b82f6]/10" : "border-transparent hover:bg-white/[0.03]"
                      }`}
                    >
                      <CompareCheckbox
                        checked={compareSelection.includes(stock.ticker)}
                        onToggle={() => toggleCompare(stock.ticker)}
                        title={compareCheckboxTitle}
                      />
                      <div className="min-w-0 pr-2 flex-1">
                        <div className="text-[12px] font-medium text-white truncate">{stock.ticker}</div>
                        <div className="text-[10px] text-slate-500 truncate">{stock.sector}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-mono text-white">
                          {stock.price > 0 ? fmt(stock.price) : "..."}
                        </div>
                        <div className={`text-[10px] font-mono ${pColor(stock.change_pct)}`}>
                          {sgn(stock.change_pct)}{fmt(stock.change_pct)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <TrendPicksSlot
                locale={locale}
                compactMode={true}
                disableHoverChart={true}
                onTickerSelect={(t) => { setSelectedTicker(t); setSelectedYSymbol(t); }}
                selectable
                selectedTickers={compareSelection}
                onToggleSelect={toggleCompare}
              />
            )}
          </div>
        </div>

      </main>

      {showCompareLimitModal && <PremiumModal locale={locale} onClose={() => setShowCompareLimitModal(false)} />}

      <Footer hidePlatform locale={locale} />
    </div>
  );
}
