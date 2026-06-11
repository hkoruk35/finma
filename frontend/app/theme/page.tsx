import { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MARKET_THEMES } from "@/lib/themeData";
import ThemeCountBadge from "@/components/ThemeCountBadge";
import CSPWatchlistSection from "@/components/CSPWatchlistSection";

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

export default async function ThemesIndexPage() {
  // Sort themes by sector
  const themesBySector = MARKET_THEMES.reduce((acc, theme) => {
    if (!acc[theme.sector]) acc[theme.sector] = [];
    acc[theme.sector].push(theme);
    return acc;
  }, {} as Record<string, typeof MARKET_THEMES>);

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-6">

        {/* Page Header */}
        <div className="mb-10 border-b border-white/10 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">BOGA AI · MARKET THEMES</span>
          </div>
          <h1 className="text-2xl font-black uppercase text-white leading-tight">
            Market Themes & Tools
          </h1>
          <p className="text-[11px] text-white/50 uppercase tracking-widest mt-2">
            AI-powered stock selection, portfolio tracking, and strategy tools
          </p>
        </div>

        <CSPWatchlistSection />

        {/* Market Themes by Sector */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex items-center gap-2 mb-5 border-b border-white/10 pb-3">
            <h2 className="text-xs font-black text-[#10b981] uppercase tracking-[0.2em]">
              MARKET THEMES
            </h2>
            <span className="text-[10px] text-white/40 uppercase">{Object.keys(themesBySector).length} sectors · {MARKET_THEMES.length} themes</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(themesBySector).map(([sector, themes]) => (
              <div key={sector} className="bg-[#080c14] border border-white/10 rounded-lg p-4 hover:border-white/20 transition-all">
                <h3 className="text-xs font-black text-[#3b82f6] uppercase tracking-[0.2em] mb-3 pb-2 border-b border-white/10">
                  {sector}
                </h3>
                <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                  {themes.map(theme => (
                    <li key={theme.name}>
                      <Link
                        href={`/theme/${slugify(theme.name)}`}
                        className="group flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 transition-all text-[10px] font-bold text-slate-400 hover:text-white"
                      >
                        <span className="truncate group-hover:translate-x-0.5 transition-transform">
                          {theme.name}
                        </span>
                        <span className="text-[9px] text-slate-500 bg-white/5 px-1 py-0.5 rounded font-black group-hover:bg-[#3b82f6]/20 group-hover:text-[#3b82f6] transition-colors flex-shrink-0 ml-1">
                          <ThemeCountBadge themeName={theme.name} staticCount={theme.tickers.length} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        
      </main>
      <Footer />
    </div>
  );
}
