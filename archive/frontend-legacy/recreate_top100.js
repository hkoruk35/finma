const fs = require('fs');
const path = require('path');
const locales = ['en', 'es', 'fr', 'pt', 'tr'];

const pageTitles = {
  en: "Top 100 Stocks - BOGA AI",
  es: "Las 100 Mejores Acciones - BOGA AI",
  fr: "Les 100 Meilleures Actions - BOGA AI",
  pt: "As 100 Melhores Ações - BOGA AI",
  tr: "Top 100 Hisse - BOGA AI"
};

const pageDescriptions = {
  en: "Live tracking of Top 100 stocks.",
  es: "Seguimiento en vivo de las 100 principales acciones.",
  fr: "Suivi en direct des 100 meilleures actions.",
  pt: "Acompanhamento ao vivo das 100 melhores ações.",
  tr: "Top 100 hissenin canlı takibi."
};

const breadcrumbs = {
  en: "Top 100 Stocks",
  es: "Top 100 Acciones",
  fr: "Top 100 Actions",
  pt: "Top 100 Ações",
  tr: "Top 100 Hisse"
};

const dashboardText = {
  en: "Dashboard",
  es: "Panel",
  fr: "Tableau de Bord",
  pt: "Painel",
  tr: "Gösterge Paneli"
};

locales.forEach(loc => {
  // 1. Create top100/page.tsx
  const top100Dir = path.join('app', 'global', loc, 'top100');
  if (!fs.existsSync(top100Dir)) {
    fs.mkdirSync(top100Dir, { recursive: true });
  }

  const top100Code = `import { Metadata } from "next";
import Link from "next/link";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "${pageTitles[loc]}",
  description: "${pageDescriptions[loc]}",
  alternates: { canonical: "https://bogastock.com/global/${loc}/top100" },
};

export default function ${loc.charAt(0).toUpperCase() + loc.slice(1)}Top100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="${loc}" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/${loc}/home" className="hover:text-[#3b82f6] transition-colors">${dashboardText[loc]}</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">${breadcrumbs[loc]}</span>
        </nav>

        <div className="flex gap-2 mb-4">
          <Link href="/global/${loc}/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">SWING</Link>
          <Link href="/global/${loc}/watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">WATCHLIST</Link>
          <Link href="/global/${loc}/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">TOP 100</Link>
        </div>

        <Top100Tracker locale="${loc}" />
      </main>

      <Footer hidePlatform={true} locale="${loc}" />
    </div>
  );
}
`;

  fs.writeFileSync(path.join(top100Dir, 'page.tsx'), top100Code);

  // 2. Update swing/page.tsx
  const swingFile = path.join('app', 'global', loc, 'swing', 'page.tsx');
  if (fs.existsSync(swingFile)) {
    let swingContent = fs.readFileSync(swingFile, 'utf8');
    const swingNav = `<div className="flex gap-2 mb-4">
          <Link href="/global/${loc}/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">SWING</Link>
          <Link href="/global/${loc}/watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">WATCHLIST</Link>
          <Link href="/global/${loc}/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TOP 100</Link>
        </div>`;
    swingContent = swingContent.replace(/<div className="flex gap-2 mb-4">[\s\S]*?<\/div>/, swingNav);
    fs.writeFileSync(swingFile, swingContent);
  }

  // 3. Update watchlist/page.tsx
  const watchlistFile = path.join('app', 'global', loc, 'watchlist', 'page.tsx');
  if (fs.existsSync(watchlistFile)) {
    let watchContent = fs.readFileSync(watchlistFile, 'utf8');
    const watchNav = `<div className="flex gap-2 mb-4">
          <Link href="/global/${loc}/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">SWING</Link>
          <Link href="/global/${loc}/watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">WATCHLIST</Link>
          <Link href="/global/${loc}/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TOP 100</Link>
        </div>`;
    watchContent = watchContent.replace(/<div className="flex gap-2 mb-4">[\s\S]*?<\/div>/, watchNav);
    fs.writeFileSync(watchlistFile, watchContent);
  }
});
console.log('Done creating and linking Top 100 pages.');
