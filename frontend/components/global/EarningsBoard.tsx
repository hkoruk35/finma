"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import type { Locale } from "@/lib/i18n/copy";

type Range = "daily" | "weekly" | "monthly" | "all";

interface EarningsAi {
  summary: string;
  revenue_status: string;
  eps_status: string;
  key_takeaways: string[];
  bullish_signals: string[];
  bearish_signals: string[];
  ai_score: number;
}

interface EarningsItem {
  id: string;
  ticker: string;
  companyName: string;
  period: string;
  reportDate: string;
  formType: string;
  ai: EarningsAi | null;
}

const LABELS: Record<Locale, {
  title: string;
  subtitle: string;
  empty: string;
  loading: string;
  revenue: string;
  eps: string;
  score: string;
  keyTakeaways: string;
  bullish: string;
  bearish: string;
  source: string;
  viewCalendar: string;
  loadMore: string;
  filterTicker: string;
  daily: string;
  weekly: string;
  monthly: string;
  all: string;
}> = {
  tr: {
    title: "Kurumsal Kazanç Analizleri",
    subtitle: "SEC EDGAR verilerine dayalı, yapay zekâ destekli kurumsal finansal tablo analizi.",
    viewCalendar: "Bilanço Takvimini Gör →",
    empty: "Bu kriterlere uygun henüz işlenmiş bir bilanço bulunmuyor.",
    loading: "Yükleniyor...",
    revenue: "Gelir", eps: "Hisse Başı Kâr", score: "BOGA AI Skoru",
    keyTakeaways: "Öne Çıkanlar", bullish: "Boğa Sinyalleri", bearish: "Ayı Sinyalleri",
    source: "Kaynak: SEC EDGAR",
    loadMore: "Daha Fazla Yükle",
    filterTicker: "Hisse Ara (Örn: AAPL)",
    daily: "Gün", weekly: "Hafta", monthly: "Ay", all: "Dönem",
  },
  en: {
    title: "Corporate Earnings Analysis",
    subtitle: "AI-powered corporate financial statement analysis based on SEC EDGAR data.",
    viewCalendar: "View Earnings Calendar →",
    empty: "No processed earnings reports match these criteria.",
    loading: "Loading...",
    revenue: "Revenue", eps: "EPS", score: "BOGA AI Score",
    keyTakeaways: "Key Takeaways", bullish: "Bullish Signals", bearish: "Bearish Signals",
    source: "Source: SEC EDGAR",
    loadMore: "Load More",
    filterTicker: "Search Ticker (e.g., AAPL)",
    daily: "Day", weekly: "Week", monthly: "Month", all: "Period",
  },
  es: {
    title: "Análisis de Resultados Corporativos",
    subtitle: "Análisis de estados financieros corporativos impulsado por IA, basado en datos de SEC EDGAR.",
    viewCalendar: "Ver Calendario de Resultados →",
    empty: "Aún no hay resultados procesados con estos criterios.",
    loading: "Cargando...",
    revenue: "Ingresos", eps: "BPA", score: "Puntuación BOGA AI",
    keyTakeaways: "Puntos Clave", bullish: "Señales Alcistas", bearish: "Señales Bajistas",
    source: "Fuente: SEC EDGAR",
    loadMore: "Cargar Más",
    filterTicker: "Buscar Ticker (ej: AAPL)",
    daily: "Diario", weekly: "Semanal", monthly: "Mensual", all: "Período",
  },
  fr: {
    title: "Analyse des Résultats d'Entreprise",
    subtitle: "Analyse des états financiers d'entreprise assistée par IA, basée sur les données de la SEC EDGAR.",
    viewCalendar: "Voir le Calendrier des Résultats →",
    empty: "Aucun résultat traité ne correspond à ces critères.",
    loading: "Chargement...",
    revenue: "Chiffre d'Affaires", eps: "BPA", score: "Score BOGA AI",
    keyTakeaways: "Points Clés", bullish: "Signaux Haussiers", bearish: "Signaux Baissiers",
    source: "Source : SEC EDGAR",
    loadMore: "Charger Plus",
    filterTicker: "Rechercher Ticker (ex: AAPL)",
    daily: "Jour", weekly: "Semaine", monthly: "Mois", all: "Période",
  },
  pt: {
    title: "Análise de Resultados Corporativos",
    subtitle: "Análise de demonstrações financeiras corporativas com IA, baseada em dados da SEC EDGAR.",
    viewCalendar: "Ver Calendário de Resultados →",
    empty: "Ainda não há resultados processados com estes critérios.",
    loading: "Carregando...",
    revenue: "Receita", eps: "LPA", score: "Pontuação BOGA AI",
    keyTakeaways: "Principais Pontos", bullish: "Sinais de Alta", bearish: "Sinais de Baixa",
    source: "Fonte: SEC EDGAR",
    loadMore: "Carregar Mais",
    filterTicker: "Pesquisar Ticker (ex: AAPL)",
    daily: "Diário", weekly: "Semanal", monthly: "Mensal", all: "Período",
  },
  id: {
    title: "Analisis Laba Perusahaan",
    subtitle: "Analisis laporan keuangan perusahaan bertenaga AI, berdasarkan data SEC EDGAR.",
    viewCalendar: "Lihat Kalender Laba →",
    empty: "Belum ada laporan laba yang diproses sesuai kriteria ini.",
    loading: "Memuat...",
    revenue: "Pendapatan", eps: "EPS", score: "Skor BOGA AI",
    keyTakeaways: "Poin Utama", bullish: "Sinyal Bullish", bearish: "Sinyal Bearish",
    source: "Sumber: SEC EDGAR",
    loadMore: "Muat Lebih Banyak",
    filterTicker: "Cari Ticker (cth: AAPL)",
    daily: "Hari", weekly: "Minggu", monthly: "Bulan", all: "Periode",
  },
};

export default function EarningsBoard({ locale }: { locale: Locale }) {
  const t = LABELS[locale] ?? LABELS.en;
  
  const [items, setItems] = useState<EarningsItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  
  // Filters
  const [tickerFilter, setTickerFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState<Range>("all");
  const [debouncedTicker, setDebouncedTicker] = useState("");
  
  // Smart Search (Autocomplete)
  const [availableTickers, setAvailableTickers] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch available tickers on mount
  useEffect(() => {
    fetch("/api/earnings/tickers")
      .then(res => res.json())
      .then(data => {
        if (data.tickers) setAvailableTickers(data.tickers);
      })
      .catch(() => {});
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce ticker input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTicker(tickerFilter);
    }, 500);
    return () => clearTimeout(handler);
  }, [tickerFilter]);

  const fetchEarnings = useCallback(async (pageNum: number, tck: string, rng: Range, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        locale,
        page: pageNum.toString(),
        limit: "5",
        range: rng
      });
      if (tck) params.set("ticker", tck);
      
      const res = await fetch(`/api/earnings?${params.toString()}`);
      if (!res.ok) throw new Error("Fetch failed");
      
      const json = await res.json();
      const newItems = json.data || [];

      setItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore(newItems.length === 5);
    } catch (err) {
      console.error(err);
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  // Initial load and filter change
  useEffect(() => {
    setPage(1);
    fetchEarnings(1, debouncedTicker, rangeFilter, false);
  }, [debouncedTicker, rangeFilter, fetchEarnings]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEarnings(nextPage, debouncedTicker, rangeFilter, true);
  };

  const filteredDropdownTickers = availableTickers.filter(tck => 
    tck.toLowerCase().includes(tickerFilter.toLowerCase())
  ).slice(0, 10); // Limit dropdown to 10 suggestions

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-8 lg:py-12">
        <div className="mb-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">{t.title}</h1>
            <p className="text-sm md:text-base text-white/50">{t.subtitle}</p>
          </div>
          <Link
            href={`/global/${locale}/earning-calendar`}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/30 hover:bg-[#3b82f6] hover:text-white transition-all shadow-lg shadow-[#3b82f6]/5"
          >
            {t.viewCalendar}
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 bg-[#0f1117] p-4 rounded-2xl border border-[#1e2a3a]/60 shadow-lg relative z-10">
          {/* Smart Search */}
          <div className="relative w-full sm:w-64" ref={searchRef}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t.filterTicker}
              value={tickerFilter}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setTickerFilter(e.target.value.toUpperCase());
                setShowDropdown(true);
              }}
              className="w-full bg-[#0a0e17] border border-[#1e2a3a] rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] transition-colors uppercase"
            />
            {showDropdown && tickerFilter && filteredDropdownTickers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f1117] border border-[#1e2a3a] rounded-xl overflow-hidden shadow-2xl z-20">
                {filteredDropdownTickers.map((tck) => (
                  <button
                    key={tck}
                    onClick={() => {
                      setTickerFilter(tck);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#1e2a3a]/50 transition-colors"
                  >
                    {tck}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Range Buttons */}
          <div className="w-full sm:w-auto flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {(["daily", "weekly", "monthly", "all"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRangeFilter(r)}
                className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-bold uppercase tracking-wide transition-all ${
                  rangeFilter === r
                    ? "bg-[#3b82f6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                    : "bg-[#0a0e17] text-[#64748b] border border-[#1e2a3a] hover:text-white hover:border-[#3b82f6]/40"
                }`}
              >
                {t[r]}
              </button>
            ))}
          </div>
        </div>

        {loading && items.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <span className="text-[#3b82f6] font-mono text-sm animate-pulse">{t.loading}</span>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex items-center justify-center py-24 bg-[#0f1117] rounded-2xl border border-[#1e2a3a]/40">
            <p className="text-white/40 text-base">{t.empty}</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex flex-col gap-6">
            {items.map((item) => {
              const ai = item.ai;
              const revenuePositive = ai?.revenue_status && !/below|altı|bajas?|baisse|baixo/i.test(ai.revenue_status);
              
              return (
                <div
                  key={item.id}
                  className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-2xl overflow-hidden hover:border-[#3b82f6]/30 transition-all shadow-xl shadow-black/20 flex flex-col lg:flex-row"
                >
                  {/* Left: AI Analysis */}
                  <div className="flex-1 p-6 lg:p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <Link href={`/global/${locale}/graphic/${item.ticker}`} className="text-2xl md:text-3xl font-black text-white hover:text-[#3b82f6] transition-colors">
                              {item.ticker}
                            </Link>
                            <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 uppercase">
                              {item.formType}
                            </span>
                          </div>
                          <div className="text-sm text-white/50 font-medium">{item.companyName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-[#3b82f6] uppercase tracking-wider mb-1">{item.period}</div>
                          <div className="text-xs text-white/40 font-mono">{item.reportDate}</div>
                        </div>
                      </div>

                      {ai && (
                        <>
                          <p className="text-sm md:text-base text-white/80 leading-relaxed mb-6 font-medium">
                            {ai.summary}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 mb-8">
                            <span
                              className="text-xs font-bold px-3 py-1.5 rounded-lg border"
                              style={{
                                color: revenuePositive ? "#22c55e" : "#ef4444",
                                backgroundColor: revenuePositive ? "#22c55e10" : "#ef444410",
                                borderColor: revenuePositive ? "#22c55e30" : "#ef444430",
                              }}
                            >
                              {t.revenue}: {ai.revenue_status}
                            </span>
                            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/5 text-white/80 border border-white/10">
                              {t.eps}: {ai.eps_status}
                            </span>
                            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                              {t.score}: {ai.ai_score}/10
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {ai.key_takeaways?.length > 0 && (
                              <div className="md:col-span-2">
                                <div className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">{t.keyTakeaways}</div>
                                <ul className="space-y-1.5">
                                  {ai.key_takeaways.map((k, i) => (
                                    <li key={i} className="text-sm text-white/70 flex gap-2">
                                      <span className="text-[#3b82f6] mt-0.5">•</span>
                                      <span>{k}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {ai.bullish_signals?.length > 0 && (
                              <div className="bg-[#22c55e]/5 border border-[#22c55e]/10 p-4 rounded-xl">
                                <div className="text-[11px] font-bold text-[#22c55e] uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                  {t.bullish}
                                </div>
                                <ul className="space-y-1">
                                  {ai.bullish_signals.map((s, i) => (
                                    <li key={i} className="text-xs text-[#22c55e]/80 font-medium">{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {ai.bearish_signals?.length > 0 && (
                              <div className="bg-[#ef4444]/5 border border-[#ef4444]/10 p-4 rounded-xl">
                                <div className="text-[11px] font-bold text-[#ef4444] uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                  {t.bearish}
                                </div>
                                <ul className="space-y-1">
                                  {ai.bearish_signals.map((s, i) => (
                                    <li key={i} className="text-xs text-[#ef4444]/80 font-medium">{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#1e2a3a]/40 flex items-center justify-between">
                      <div className="text-[10px] text-white/30 uppercase tracking-widest">{t.source}</div>
                      <Link href={`/global/${locale}/graphic/${item.ticker}`} className="text-xs font-bold text-[#3b82f6] hover:underline">
                        Analiz Detayı →
                      </Link>
                    </div>
                  </div>

                  {/* Right: 1W Chart */}
                  <div className="w-full lg:w-[450px] xl:w-[600px] h-[320px] border-t lg:border-t-0 lg:border-l border-[#1e2a3a]/60 bg-black/20 shrink-0 relative overflow-hidden flex items-center justify-center p-4">
                    <div className="w-full h-full relative">
                      <BogaChartEngine
                        symbol={item.ticker}
                        lang={locale}
                        height={288}
                        defaultTimeframe="W"
                        defaultCandleType="line"
                        compact={true}
                        showToolbar={false}
                        hideIndicatorToggles={true}
                        indicators={[]}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && items.length > 0 && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="px-8 py-3 rounded-full text-sm font-bold uppercase tracking-wider bg-[#1e293b] border border-[#3b82f6]/40 text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]"
            >
              {loading ? t.loading : t.loadMore}
            </button>
          </div>
        )}
      </main>

      <Footer hidePlatform={true} locale={locale} />
    </div>
  );
}
