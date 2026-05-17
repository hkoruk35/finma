import { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MARKET_THEMES } from "@/lib/themeData";

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
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-8">
        
        <div className="mb-8 border-b border-white/10 pb-4">
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
             <span className="w-3 h-3 rounded-full bg-[#3b82f6] animate-pulse"></span>
             ACTIVE MARKET THEMES
          </h1>
          <p className="text-slate-400 text-xs mt-2 uppercase tracking-widest">
            Based on system configuration and AI Analysis
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
           {/* BOGA System Lists */}
           <div className="bg-[#0c121d] border border-white/10 rounded-xl p-5 hover:border-[#3b82f6]/50 transition-colors group">
             <h2 className="text-lg font-black text-white uppercase mb-2 group-hover:text-[#3b82f6] transition-colors">Swing Picks</h2>
             <p className="text-xs text-slate-400 mb-4 h-8">Latest swing trade signals from the BOGA Engine.</p>
             <Link href="/theme/boga-swing" className="inline-block bg-white/5 border border-white/10 rounded px-4 py-2 text-xs font-bold text-white uppercase hover:bg-white/10 transition-colors">
               View List →
             </Link>
           </div>
           <div className="bg-[#0c121d] border border-white/10 rounded-xl p-5 hover:border-[#a78bfa]/50 transition-colors group">
             <h2 className="text-lg font-black text-white uppercase mb-2 group-hover:text-[#a78bfa] transition-colors">Options Scanner</h2>
             <p className="text-xs text-slate-400 mb-4 h-8">Institutional flow and gamma squeezes.</p>
             <Link href="/theme/boga-options" className="inline-block bg-white/5 border border-white/10 rounded px-4 py-2 text-xs font-bold text-white uppercase hover:bg-white/10 transition-colors">
               View List →
             </Link>
           </div>
        </div>

        <div className="space-y-10">
          {Object.entries(themesBySector).map(([sector, themes]) => (
            <div key={sector}>
               <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-4 border-b border-white/5 pb-2">
                 {sector}
               </h3>
               <div className="flex flex-wrap gap-3">
                 {themes.map(theme => (
                   <Link 
                     key={theme.name} 
                     href={`/theme/${slugify(theme.name)}`}
                     className="px-4 py-2 rounded-full border border-white/10 bg-[#0c121d] text-slate-300 text-xs font-bold hover:bg-[#3b82f6] hover:text-white hover:border-[#3b82f6] transition-all whitespace-nowrap shadow-md flex items-center gap-2"
                   >
                     {theme.name}
                     <span className="bg-white/10 text-[10px] px-1.5 rounded">{theme.tickers.length}</span>
                   </Link>
                 ))}
               </div>
            </div>
          ))}
        </div>
        
      </main>
      <Footer />
    </div>
  );
}
