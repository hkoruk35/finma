import { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MARKET_THEMES } from "@/lib/themeData";
import ThemeCountBadge from "@/components/ThemeCountBadge";
import CSPWatchlistSection from "@/components/CSPWatchlistSection";
import HotThemes2026Section from "@/components/HotThemes2026Section";
import ThemePageTabs from "@/components/ThemePageTabs";

export const metadata: Metadata = {
  title: "Active Market Themes | BOGA AI",
  description: "Browse active market themes, swing picks, and options scanner picks.",
};

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Sector display order — Sectors card comes first
const SECTOR_ORDER = [
  "Sectors",
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Healthcare",
  "Financials",
  "Energy",
  "Materials",
  "Industrials",
  "Real Estate",
  "Utilities",
];

export default async function ThemesIndexPage() {
  const themesBySector = MARKET_THEMES.reduce((acc, theme) => {
    if (!acc[theme.sector]) acc[theme.sector] = [];
    acc[theme.sector].push(theme);
    return acc;
  }, {} as Record<string, typeof MARKET_THEMES>);

  // Sort sectors: Sectors first, then defined order, then rest alphabetically
  const sortedSectors = Object.keys(themesBySector).sort((a, b) => {
    const ia = SECTOR_ORDER.indexOf(a);
    const ib = SECTOR_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-6">

        {/* Page Header */}
        <div className="mb-8 border-b border-white/10 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#22d3ee]">BOGA AI · MARKET THEMES</span>
          </div>
          <h1 className="text-2xl font-black uppercase text-white leading-tight">
            Market Themes & Tools
          </h1>
          <p className="text-[11px] text-white/50 uppercase tracking-widest mt-2">
            AI-powered stock selection, portfolio tracking, and strategy tools
          </p>
        </div>

        <ThemePageTabs
          hot={<HotThemes2026Section />}
          sectors={
            <div>
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <span className="text-[10px] text-white/40 uppercase tracking-wide">
                  {sortedSectors.length} sektör · {MARKET_THEMES.length} tema
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedSectors.map((sector) => {
                  const themes = themesBySector[sector];
                  const isSectors = sector === "Sectors";
                  return (
                    <div
                      key={sector}
                      className="bg-[#080c14] border rounded-lg p-4 hover:border-opacity-40 transition-all"
                      style={{
                        borderColor: isSectors ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.08)",
                        background: isSectors ? "rgba(34,211,238,0.04)" : "#080c14",
                      }}
                    >
                      <h3
                        className="text-xs font-black uppercase tracking-[0.2em] mb-3 pb-2 border-b"
                        style={{
                          color: isSectors ? "#22d3ee" : "#38bdf8",
                          borderColor: isSectors ? "rgba(34,211,238,0.25)" : "rgba(56,189,248,0.15)",
                        }}
                      >
                        {isSectors ? "📊 " : ""}{sector}
                      </h3>
                      <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                        {themes.map(theme => (
                          <li key={theme.name}>
                            <Link
                              href={`/theme/${slugify(theme.name)}`}
                              className="group flex items-center justify-between py-1 px-2 rounded transition-all text-[10px] font-medium text-slate-400 hover:text-white hover:bg-sky-400/[0.07]"
                            >
                              <span className="truncate">{theme.name}</span>
                              <span className="text-[9px] text-slate-500 bg-white/5 px-1 py-0.5 rounded font-black flex-shrink-0 ml-1"
                                style={{ minWidth: 18, textAlign: "center" }}>
                                <ThemeCountBadge themeName={theme.name} staticCount={theme.tickers.length} />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          }
          csp={<CSPWatchlistSection />}
        />

      </main>
      <Footer />
    </div>
  );
}
