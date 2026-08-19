import { getMasterData, getSwingPerformance, getSwingAllPicks } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import Link from "next/link";
import { Metadata } from "next";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskPerformanceHistory, maskTrendPicks } from "@/lib/pickMasking";

export const revalidate = 86400; // Updated once a day to save Vercel Execution

export const metadata: Metadata = {
  title: "Performance",
  alternates: { canonical: "https://bogastock.com/global/id/performance", languages: {
      en: "https://bogastock.com/global/en/performance",
      es: "https://bogastock.com/global/es/performance",
      fr: "https://bogastock.com/global/fr/performance",
      id: "https://bogastock.com/global/id/performance",
      pt: "https://bogastock.com/global/pt/performance",
      tr: "https://bogastock.com/global/tr/performance",
      "x-default": "https://bogastock.com/global/en/performance",
    } }
};


export default async function IdPerformancePage() {
  const [master, performanceData, swingPicksData, access] = await Promise.all([
    getMasterData(),
    getSwingPerformance(),
    getSwingAllPicks(),
    getMemberAccess(),
  ]);
  const tier = resolveMemberTierFromAccess(access);

  if (!performanceData) {
    return <div className="min-h-screen bg-[#0d1117] text-white p-8 flex items-center justify-center font-medium text-xl uppercase animate-pulse">Memuat Data Performa...</div>;
  }

  const fullHistory: any[] = performanceData.history ?? [];
  // Gunakan seluruh history, tanpa slice — metodologi yang sama dengan home banner:
  // seluruh riwayat (736 transaksi selesai), cap SL -%7, tanpa duplikat dan PENDING.
  const sortedHistory: any[] = [...fullHistory]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  // Identitas ticker di sini dimasking di server component — initialHistory
  // diteruskan ke client sebagai prop dan Next.js menyematkannya ke dalam
  // RSC payload/HTML, masking client-only bisa dilewati lewat view-source
  // (lihat Faz 0B).
  const history = maskPerformanceHistory(sortedHistory, tier, { anonymousMaskCount: 100, freeMaskCount: 20 });

  const todayPicks = maskTrendPicks(swingPicksData?.picks ?? [], tier, { stripTradePlan: true });
  const picksGeneratedAt: string | undefined = swingPicksData?.generated_at ?? swingPicksData?.date;

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="id" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/id/home" className="hover:text-[#3b82f6] transition-colors">Beranda</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Performa Sistem</span>
        </nav>

        {/* Dashboard Client Component */}
        <div className="relative z-10">
          <SwingPerformanceDashboard initialHistory={history} stats={performanceData.stats} todayPicks={todayPicks} picksGeneratedAt={picksGeneratedAt} locale="id" disableTickerLink hideBotLink hideExportButtons applySlPct={-10} />
        </div>
      </main>

      <Footer hidePlatform={true} locale="id" />
    </div>
  );
}
