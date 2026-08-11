"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

interface MenuChild {
  label: string;
  href?: string; // yoksa alt başlık (ör. "Stocks") olarak render edilir
  heading?: boolean;
}

interface MenuGroup {
  key: "markets" | "watchlist" | "news" | "analysis";
  label: string;
  href: string;
  children?: MenuChild[];
}

const T: Record<Locale, Record<string, string>> = {
  tr: {
    markets: "Piyasalar", watchlist: "İzleme Listem", news: "Haberler", analysis: "Analizler", brokers: "Aracı Kurumlar",
    indices: "Endeksler", stocksHeading: "Hisseler", top7: "Top 7", top100: "Top 100", gainers: "Yükselenler",
    losers: "Düşenler", trendStocks: "Trend Hisseler", fx: "Döviz", commodity: "Emtia", crypto: "Kripto", futures: "Vadeliler",
    stockAnalyses: "Hisse Analizleri", earnings: "Bilançolar", earningsCalendar: "Bilanço Takvimi", insider: "İçeriden İşlemler",
    marketsAnalysis: "Piyasa Analizleri", sectorAnalysis: "Sektör Analizleri", sectorHeatmap: "Sektör Isı Haritası", stockAnalysis: "Hisse Analizleri",
    futuresAnalysis: "Vadeli Analizleri", stockBrokers: "Hisse Aracı Kurumları", fxBrokers: "FX Aracı Kurumları", cryptoBrokers: "Kripto Aracı Kurumları",
  },
  en: {
    markets: "Markets", watchlist: "My Watchlist", news: "News", analysis: "Analysis", brokers: "Brokers",
    indices: "Indices", stocksHeading: "Stocks", top7: "Top 7", top100: "Top 100", gainers: "Gainers",
    losers: "Losers", trendStocks: "Trending Stocks", fx: "Forex", commodity: "Commodities", crypto: "Crypto", futures: "Futures",
    stockAnalyses: "Stock Analyses", earnings: "Earnings", earningsCalendar: "Earnings Calendar", insider: "Insider Activity",
    marketsAnalysis: "Markets", sectorAnalysis: "Sector Analyses", sectorHeatmap: "Sector Heat Map", stockAnalysis: "Stock Analyses",
    futuresAnalysis: "Futures Analyses", stockBrokers: "Stock Brokers", fxBrokers: "FX Brokers", cryptoBrokers: "Crypto Brokers",
  },
  es: {
    markets: "Markets", watchlist: "Mi Lista", news: "News", analysis: "Análisis", brokers: "Brokers",
    indices: "Índices", stocksHeading: "Acciones", top7: "Top 7", top100: "Top 100", gainers: "Alzas",
    losers: "Bajas", trendStocks: "En Tendencia", fx: "Divisas", commodity: "Materias Primas", crypto: "Cripto", futures: "Futuros",
    stockAnalyses: "Análisis de Acciones", earnings: "Resultados", earningsCalendar: "Calendario de Resultados", insider: "Actividad de Insiders",
    marketsAnalysis: "Markets", sectorAnalysis: "Análisis Sectorial", sectorHeatmap: "Mapa de Calor Sectorial", stockAnalysis: "Análisis de Acciones",
    futuresAnalysis: "Análisis de Futuros", stockBrokers: "Brokers de Acciones", fxBrokers: "Brokers de Divisas", cryptoBrokers: "Brokers de Cripto",
  },
  fr: {
    markets: "Markets", watchlist: "Ma Liste", news: "News", analysis: "Analyses", brokers: "Brokers",
    indices: "Indices", stocksHeading: "Actions", top7: "Top 7", top100: "Top 100", gainers: "Hausses",
    losers: "Baisses", trendStocks: "Actions Tendance", fx: "Forex", commodity: "Matières Premières", crypto: "Crypto", futures: "Futures",
    stockAnalyses: "Analyses d'Actions", earnings: "Résultats", earningsCalendar: "Calendrier des Résultats", insider: "Activité des Initiés",
    marketsAnalysis: "Markets", sectorAnalysis: "Analyses Sectorielles", sectorHeatmap: "Carte Sectorielle", stockAnalysis: "Analyses d'Actions",
    futuresAnalysis: "Analyses de Futures", stockBrokers: "Brokers d'Actions", fxBrokers: "Brokers Forex", cryptoBrokers: "Brokers Crypto",
  },
  pt: {
    markets: "Markets", watchlist: "Minha Lista", news: "News", analysis: "Análises", brokers: "Brokers",
    indices: "Índices", stocksHeading: "Ações", top7: "Top 7", top100: "Top 100", gainers: "Altas",
    losers: "Baixas", trendStocks: "Ações em Tendência", fx: "Câmbio", commodity: "Commodities", crypto: "Cripto", futures: "Futuros",
    stockAnalyses: "Análises de Ações", earnings: "Resultados", earningsCalendar: "Calendário de Resultados", insider: "Atividade de Insiders",
    marketsAnalysis: "Markets", sectorAnalysis: "Análises Setoriais", sectorHeatmap: "Mapa de Calor Setorial", stockAnalysis: "Análises de Ações",
    futuresAnalysis: "Análises de Futuros", stockBrokers: "Brokers de Ações", fxBrokers: "Brokers de Câmbio", cryptoBrokers: "Brokers de Cripto",
  },
};

function buildGroups(locale: Locale): MenuGroup[] {
  const t = T[locale] || T.en;
  const g = (path: string) => `/global/${locale}${path}`;
  return [
    {
      key: "markets",
      label: t.markets,
      href: g("/markets"),
      children: [
        { label: t.indices, href: g("/markets") },
        { label: t.stocksHeading, heading: true },
        { label: t.top7, href: g("/top7") },
        { label: t.top100, href: g("/top100") },
        { label: t.gainers, href: g("/gainers") },
        { label: t.losers, href: g("/losers") },
        { label: t.trendStocks, href: g("/swing") },
        { label: t.fx, href: g("/home") },
        { label: t.commodity, href: g("/home") },
        { label: t.crypto, href: g("/home") },
        { label: t.futures, href: g("/home") },
      ],
    },
    { key: "watchlist", label: t.watchlist, href: g("/my-watchlist") },
    {
      key: "news",
      label: t.news,
      href: g("/newsroom"),
      children: [
        { label: t.stockAnalyses, href: g("/news") },
        { label: t.earnings, href: g("/earning") },
        { label: t.earningsCalendar, href: g("/earning-calendar") },
        { label: t.insider, href: g("/insider") },
      ],
    },
    {
      key: "analysis",
      label: t.analysis,
      href: g("/analysis-hub"),
      children: [
        { label: t.marketsAnalysis, href: g("/markets") },
        { label: t.sectorAnalysis, href: g("/sectors") },
        { label: t.sectorHeatmap, href: g("/sectors") },
        { label: t.stockAnalysis, href: g("/news") },
        { label: t.fx, href: g("/home") },
        { label: t.commodity, href: g("/home") },
        { label: t.crypto, href: g("/home") },
        { label: t.futuresAnalysis, href: g("/home") },
      ],
    },
  ];
}

interface MenuToggle {
  enabled: boolean;
  labelOverride: string | null;
}

// Header'daki üst seviye navigasyon — masaüstünde mouse üzerine gelince
// açılan mega menü, mobilde tıklamayla açılan akordeon. Görünürlük/etiket
// admin "Menü Yönetimi" sayfasından (site_menu_toggles) kontrol edilir.
export default function HeaderMegaMenu({ locale }: { locale: Locale }) {
  const [toggles, setToggles] = useState<Record<string, MenuToggle>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [mobileOpenKey, setMobileOpenKey] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/menu-toggles")
      .then((r) => (r.ok ? r.json() : { toggles: {} }))
      .then((data) => setToggles(data.toggles ?? {}))
      .catch(() => {});
  }, []);

  const groups = buildGroups(locale).filter((g) => toggles[g.key]?.enabled !== false);

  return (
    <>
      {/* Masaüstü: hover ile açılan mega menü */}
      <nav className="hidden sm:flex items-center gap-0.5">
        {groups.map((group) => {
          const label = toggles[group.key]?.labelOverride || group.label;
          return (
            <div key={group.key} className="relative" onMouseEnter={() => setHoveredKey(group.key)} onMouseLeave={() => setHoveredKey(null)}>
              <Link
                href={group.href}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[8px] font-medium tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
              >
                <span>{label.toLocaleUpperCase(locale)}</span>
                {group.children && <span className="text-[8px] text-[#38bdf8]">▾</span>}
              </Link>

              {group.children && hoveredKey === group.key && (
                <div className="absolute left-0 top-full pt-1 z-50">
                  <div className="w-56 bg-[#111826] border border-[#1e2a3a] rounded-lg shadow-xl overflow-hidden py-1">
                    {group.children.map((child, idx) =>
                      child.heading ? (
                        <div key={idx} className="px-3 pt-2 pb-1 text-[9px] font-bold tracking-widest text-[#3b82f6]/80">
                          {child.label.toLocaleUpperCase(locale)}
                        </div>
                      ) : (
                        <Link
                          key={idx}
                          href={child.href!}
                          className="block px-4 py-2 text-[11px] font-medium tracking-wider text-[#94a3b8] hover:text-white hover:bg-[#1e2a3a]/70 transition-colors"
                        >
                          {child.label.toLocaleUpperCase(locale)}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Mobil: hamburger ile açılan akordeon menü */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((v) => !v)}
          aria-label="Menu"
          className="flex items-center justify-center w-8 h-8 rounded-md text-[#64748b] hover:text-white hover:bg-white/10 border border-[#1e2a3a]/60"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {isMobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-50 w-64 max-h-[70vh] overflow-y-auto bg-[#0f172a] border border-[#1e2a3a] rounded-xl shadow-2xl p-2">
              {groups.map((group) => {
                const label = toggles[group.key]?.labelOverride || group.label;
                return (
                  <div key={group.key} className="border-b border-white/5 last:border-b-0">
                    <button
                      type="button"
                      onClick={() =>
                        group.children
                          ? setMobileOpenKey((k) => (k === group.key ? null : group.key))
                          : setIsMobileMenuOpen(false)
                      }
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold tracking-wider text-slate-200"
                    >
                      {group.children ? (
                        <span>{label.toLocaleUpperCase(locale)}</span>
                      ) : (
                        <Link href={group.href} onClick={() => setIsMobileMenuOpen(false)} className="flex-1 text-left">
                          {label.toLocaleUpperCase(locale)}
                        </Link>
                      )}
                      {group.children && <span className="text-[9px] text-[#38bdf8]">{mobileOpenKey === group.key ? "▴" : "▾"}</span>}
                    </button>
                    {group.children && mobileOpenKey === group.key && (
                      <div className="pb-2">
                        {group.children.map((child, idx) =>
                          child.heading ? (
                            <div key={idx} className="px-5 pt-1.5 pb-0.5 text-[9px] font-bold tracking-widest text-[#3b82f6]/80">
                              {child.label.toLocaleUpperCase(locale)}
                            </div>
                          ) : (
                            <Link
                              key={idx}
                              href={child.href!}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="block px-6 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white"
                            >
                              {child.label.toLocaleUpperCase(locale)}
                            </Link>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
