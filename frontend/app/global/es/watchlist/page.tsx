import { Metadata } from "next";
import Link from "next/link";
import WatchlistTracker from "@/components/public/WatchlistTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { copy } from "@/lib/i18n/copy";

export const revalidate = 60;

const t = copy.es.watchlist;

export const metadata: Metadata = {
  title: t.pageTitle,
  description: t.pageDescription,
  alternates: { canonical: "https://bogastock.com/global/es/watchlist" },
};

export default function EsWatchlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/home" className="hover:text-[#3b82f6] transition-colors">Panel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{t.breadcrumb}</span>
        </nav>

        <div className="flex gap-2 mb-4">
          <Link href="/global/es/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">SWING</Link>
          <Link href="/global/es/watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">WATCHLIST</Link>
        </div>

        <div className="relative z-10">
          <WatchlistTracker locale="es" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
