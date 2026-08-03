"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine, { getSymbolDisplayName, INDEX_DISPLAY_NAMES } from "@/components/charts/BogaChartEngine";
import HomeWatchlistSlot from "@/components/global/HomeWatchlistSlot";
import TrendPicksSlot from "@/components/global/TrendPicksSlot";
import TickerSearchBox from "@/components/public/TickerSearchBox";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import CompareCheckbox from "@/components/global/CompareCheckbox";
import PremiumModal from "@/components/global/PremiumModal";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import type { Locale } from "@/lib/i18n/copy";

const FREE_COMPARE_LIMIT = 2;
const MAX_COMPARE = 4;

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
      group: t("US Equity Markets", "ABD HİSSE SENEDİ PİYASALARI", "Mercados de Valores de EE. UU.", "Marchés Boursiers Américains", "Mercados de Ações dos EUA"),
      items: [
        { ticker: "^GSPC", label: "S&P 500", ySymbol: "^GSPC" },
        { ticker: "^IXIC", label: "NASDAQ", ySymbol: "^IXIC" },
        { ticker: "^DJI", label: "Dow Jones", ySymbol: "^DJI" },
        { ticker: "^RUT", label: "Russell 2000", ySymbol: "^RUT" },
        { ticker: "^VIX", label: "VIX", ySymbol: "^VIX" },
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
        { ticker: "NZDUSD", label: "NZD/USD", ySymbol: "NZDUSD=X" },
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
        { ticker: "SOLUSD", label: "Solana", ySymbol: "SOL-USD" },
        { ticker: "XRPUSD", label: "XRP", ySymbol: "XRP-USD" },
      ],
    },
  ];
};

type PriceInfo = { price: number | null; change_1d: number | null };

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v: number) => (v > 0 ? "+" : "");

export default function GlobalLandingPage({ locale, defaultWatchlist }: { locale: Locale, defaultWatchlist: any[] }) {
  const router = useRouter();
  const premiumMemberLabel = locale === 'tr' ? 'Premium Üye' : locale === 'es' ? 'Miembro Premium' : locale === 'fr' ? 'Membre Premium' : locale === 'pt' ? 'Membro Premium' : 'Premium Member';
  const upgradeToPremiumLabel = locale === 'tr' ? "Premium'a Geç" : locale === 'es' ? 'Actualizar a Premium' : locale === 'fr' ? 'Passer à Premium' : locale === 'pt' ? 'Atualizar para Premium' : 'Upgrade to Premium';
  const [selectedTicker, setSelectedTicker] = useState("^GSPC");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const allowTerminal = sessionStorage.getItem("allow_mobile_terminal") === "true";
      if (isMobile && !allowTerminal) {
        router.replace(`/global/${locale}/home`);
      }
    }
  }, [locale, router]);
  const [selectedYSymbol, setSelectedYSymbol] = useState("^GSPC");
  
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentGroup, setCurrentGroup] = useState("");
  
  const groups = useMemo(() => getGroups(locale), [locale]);
  
  const [extendedGroups, setExtendedGroups] = useState<any[]>([]);
  const [selectedList, setSelectedList] = useState<string>("Tüm Liste");

  useEffect(() => {
    const baseGroups = groups;
    setExtendedGroups(baseGroups);

    const fetchAllData = async () => {
      try {
        let personalItems: any[] = [];
        try {
          const r1 = await fetch('/api/watchlist/custom', { cache: 'no-store' });
          if (r1.ok) {
             const d1 = await r1.json();
             const tks = (d1.tickers || []).slice(0, 10);
             if (tks.length > 0) {
                const r1b = await fetch(`/api/watchlist-data?tickers=${tks.join(',')}`);
                if (r1b.ok) {
                   const rows = await r1b.json();
                   personalItems = rows.map((r: any) => ({ ticker: r.ticker, label: r.ticker, ySymbol: r.ticker, price: r.price?.current ?? 0, change_1d: r.tracker_1h?.change_pct_1d ?? r.price?.change_pct ?? 0 }));
                }
             }
          }
        } catch {}

        let trendItems: any[] = [];
        try {
          const r2 = await fetch('/api/swing-picks?min=10', { cache: 'no-store' });
          if (r2.ok) {
            const d2 = await r2.json();
            const picks = (d2.picks || []).slice(0, 7);
            const tks = picks.map((p: any) => p.ticker).filter((tk: string) => !tk.startsWith('LOCKED-'));
            const liveMap: Record<string, any> = {};
            if (tks.length > 0) {
              const r2b = await fetch(`/api/watchlist-data?tickers=${tks.join(',')}`);
              if (r2b.ok) {
                const rows = await r2b.json();
                rows.forEach((r: any) => { if (r.ticker) liveMap[r.ticker] = r; });
              }
            }
            // maskTrendPicks (lib/pickMasking.ts) sadece ticker/company'yi
            // LOCKED-N yapar, fiyat alanları gerçek kalır — bu yüzden fiyat
            // için /api/watchlist-data'ya hiç ihtiyaç yok, doğrudan p.current_price
            // kullanılabilir. Etiket ise artık ham "LOCKED-N" yerine premiumMemberLabel.
            trendItems = picks.map((p: any) => {
              const locked = String(p.ticker).startsWith('LOCKED-');
              const d = liveMap[p.ticker];
              return {
                ticker: p.ticker,
                label: locked ? premiumMemberLabel : p.ticker,
                ySymbol: p.ticker,
                price: d?.price?.current ?? p.current_price ?? 0,
                change_1d: d?.tracker_1h?.change_pct_1d ?? d?.price?.change_pct ?? 0,
                locked,
              };
            });
          }
        } catch {}

        // Top7/Top100/Gainers/Losers/MostActive: /home sayfasıyla AYNI kaynak
        // (/api/home-movers) — tek istek, hazır price/change_pct, maskeleme
        // yok (2026-08-03'ten beri herkese açık). Eskiden burada /api/top100
        // + ayrı bir /api/watchlist-data re-join + client-side sıralama vardı;
        // anonim ziyaretçi için LOCKED-N ticker'lar watchlist-data'da hiç
        // bulunamadığından bu listeler fiilen boş kalıyordu.
        let top7Items: any[] = [];
        let top100Items: any[] = [];
        let gainersItems: any[] = [];
        let losersItems: any[] = [];
        let mostActiveItems: any[] = [];
        try {
          const r4 = await fetch('/api/home-movers?limit=7', { cache: 'no-store' });
          if (r4.ok) {
            const d4 = await r4.json();
            const toItems = (arr: any[]) => (arr || []).map((r: any) => ({
              ticker: r.ticker, label: r.ticker, ySymbol: r.ticker, price: r.price ?? 0, change_1d: r.change_pct ?? 0,
            }));
            top7Items = toItems(d4.top7);
            top100Items = toItems(d4.top100);
            gainersItems = toItems(d4.gainers);
            losersItems = toItems(d4.losers);
            mostActiveItems = toItems(d4.mostActive);
          }
        } catch {}

        // Sıra (2026-08-03 kullanıcı talebiyle): Top7 → Artanlar → Düşenler →
        // İşlem Görenler → Top100 → Trend Hisseleri (Premium, en altta).
        setExtendedGroups([
          ...baseGroups,
          ...(personalItems.length ? [{ group: "İzleme Listem ★ Kişisel (ilk 10)", items: personalItems }] : []),
          ...(top7Items.length ? [{ group: "Top 7", items: top7Items }] : []),
          ...(gainersItems.length ? [{ group: "En Çok Yükselenler (ilk 7)", items: gainersItems }] : []),
          ...(losersItems.length ? [{ group: "En Çok Düşenler (ilk 7)", items: losersItems }] : []),
          ...(mostActiveItems.length ? [{ group: "En Çok İşlem Görenler (ilk 7)", items: mostActiveItems }] : []),
          ...(top100Items.length ? [{ group: "Top 100 (ilk 7)", items: top100Items }] : []),
          ...(trendItems.length ? [{ group: `Trend Hisseleri (Premium, ilk 7)`, items: trendItems }] : []),
        ]);
      } catch (err) {}
    };
    fetchAllData();
  }, [groups, premiumMemberLabel]);
  
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
  // Trend Hisseleri'nde premium-kilitli (LOCKED-N) bir satır seçildiğinde
  // grafik alanı yerine "Premium" göstermek için — diğer her ticker'ın
  // grafiği (indeks/sektör/döviz/emtia/kripto/Top7/Top100/Artanlar/
  // Düşenler/İşlem Görenler) açık kalır.
  const [selectedLocked, setSelectedLocked] = useState(false);

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

  const watchlistTabLabel =
    locale === 'tr' ? 'İzleme Listem'
    : locale === 'es' ? 'Mi Lista'
    : locale === 'fr' ? 'Ma Liste'
    : locale === 'pt' ? 'Minha Lista'
    : 'Watchlist';
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
        <span className="text-white font-medium">{selectedTicker} Chart</span>
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
          ${showLeftSidebar ? 'md:block md:w-60 lg:w-72' : 'md:hidden'}
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

          <div className="md:py-4 px-3 flex flex-col gap-4">
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              className="w-full bg-[#141924] border border-[#1e2a3a] text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-[#3b82f6] transition-colors"
            >
              <option value="Tüm Liste">{locale === 'tr' ? 'Tüm Liste' : 'All List'}</option>
              {extendedGroups.map(g => (
                <option key={g.group} value={g.group}>{g.group}</option>
              ))}
            </select>
          </div>

          <div className="md:pb-4">
            {(selectedList === "Tüm Liste" ? extendedGroups : extendedGroups.filter(g => g.group === selectedList)).map(group => (
              <div key={group.group} className="mb-2">
                {selectedList === "Tüm Liste" && (
                  <h3 className="px-3 mb-1 text-xs font-medium text-slate-500 uppercase tracking-widest">{group.group}</h3>
                )}
                <div className="flex flex-col">
                  {group.items.map((item: any) => {
                    const price = item.price !== undefined ? { price: item.price, change_1d: item.change_1d } : prices[item.ySymbol];
                    const selected = selectedTicker === item.ticker;
                    const chg = price?.change_1d ?? null;
                    return (
                      <div
                        key={item.ticker}
                        onClick={() => {
                          setSelectedTicker(item.ticker);
                          setSelectedYSymbol(item.ySymbol);
                          setSelectedLocked(!!item.locked);
                          setShowMobileSidebar(false);
                        }}
                        title={item.label}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer border-l-2 transition-colors ${
                          selected ? "border-[#3b82f6] bg-[#3b82f6]/10" : "border-transparent hover:bg-white/[0.03]"
                        }`}
                      >
                        <CompareCheckbox
                          checked={compareSelection.includes(item.ticker)}
                          onToggle={() => toggleCompare(item.ticker)}
                          title={compareCheckboxTitle}
                        />
                        <div className="font-medium flex-1 min-w-0 truncate flex items-center gap-1" style={{ fontSize: 12, color: item.locked ? "#f59e0b" : "#e8e8e8" }}>
                          {item.locked && (
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                              <path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>
                            </svg>
                          )}
                          {item.label}
                        </div>
                        <div
                          className="font-mono font-semibold w-14 text-right shrink-0"
                          style={{ fontSize: 12, color: chg == null ? "#94a3b8" : chg > 0 ? "#22c55e" : chg < 0 ? "#ef4444" : "#94a3b8" }}
                        >
                          {chg != null ? `${sgn(chg)}${fmt(chg)}%` : "—"}
                        </div>
                        <div className="font-mono w-20 text-right shrink-0" style={{ fontSize: 12, color: "#e8e8e8" }}>
                          {price?.price != null ? fmt(price.price) : "..."}
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
              <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-widest flex flex-wrap items-center gap-1.5">
                <span>{dashboardLabel}</span>
                <span className="opacity-30">/</span>
                <span className="text-white italic">{getSymbolDisplayName(selectedTicker)}</span>
                {currentCompany && !INDEX_DISPLAY_NAMES[selectedTicker?.toUpperCase()] && (
                  <span className="text-slate-400 normal-case italic font-medium">{currentCompany}</span>
                )}
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
                <TickerSearchBox locale={locale} compact onSelect={(t) => { setSelectedTicker(t); setSelectedYSymbol(t); setSelectedLocked(false); }} />
              </div>
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col gap-6 min-h-min">
            <div className="glass-card flex-1 min-h-[400px] md:min-h-[600px] rounded-xl overflow-hidden border border-[#1e2a3a] shrink-0">
              {selectedLocked ? (
                <div className="w-full h-full min-h-[400px] md:min-h-[600px] flex flex-col items-center justify-center gap-3 text-center px-6">
                  <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" style={{ color: "#f59e0b" }}>
                    <path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>
                  </svg>
                  <span className="text-lg font-medium" style={{ color: "#f59e0b" }}>{premiumMemberLabel}</span>
                  <button
                    type="button"
                    onClick={() => setShowCompareLimitModal(true)}
                    className="px-4 py-2 rounded-lg bg-[#f59e0b] text-black text-sm font-medium hover:bg-[#fbbf24] transition-colors"
                  >
                    {upgradeToPremiumLabel}
                  </button>
                </div>
              ) : (
                <BogaChartEngine
                  symbol={selectedYSymbol}
                  lang={locale}
                  detailMode
                  height={600}
                  defaultTimeframe="D"
                  defaultCandleType="candle"
                  premiumGate
                  externalMultiChartTickers={multiChartRequest}
                  onExternalMultiChartConsumed={() => setMultiChartRequest(null)}
                />
              )}
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

        {compareSelection.length >= 2 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#141924] border border-[#3b82f6]/50 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
            <span className="text-[13px] font-medium text-white">
              {compareLabel} ({compareSelection.length})
            </span>
            <button
              onClick={() => setCompareSelection([])}
              className="text-[13px] font-medium text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <button
              onClick={() => {
                setMultiChartRequest(compareSelection);
                setCompareSelection([]);
              }}
              className="px-3 py-1 rounded-full bg-[#3b82f6] text-[13px] font-medium text-white hover:bg-[#2563eb] transition-colors"
            >
              {compareOpenLabel}
            </button>
          </div>
        )}


      </main>

      {showCompareLimitModal && <PremiumModal locale={locale} onClose={() => setShowCompareLimitModal(false)} />}

      <Footer hidePlatform locale={locale} />
    </div>
  );
}
