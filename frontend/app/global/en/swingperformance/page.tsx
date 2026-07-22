import { Metadata } from "next";
import { getSwingPerformance, getSwingAllPicks } from "@/lib/data";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Interactive Technical Chart Performance Analysis",
  description: "Historical performance tracking of interactive technical chart analysis and indicators.",
  alternates: { canonical: "https://bogastock.com/global/en/swingperformance" },
};

const LAST_N_DAYS = 10;

export default async function EnSwingPerformancePage() {
  const [performanceData, swingPicksData] = await Promise.all([
    getSwingPerformance(),
    getSwingAllPicks(),
  ]);

  if (!performanceData) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white p-8 flex items-center justify-center font-bold text-xl uppercase animate-pulse">
        Loading Performance Data...
      </div>
    );
  }

  const fullHistory: any[] = performanceData.history ?? [];
  const uniqueDates = Array.from(new Set(fullHistory.map((t) => t.date))).sort((a, b) => b.localeCompare(a));
  const recentDates = new Set(uniqueDates.slice(0, LAST_N_DAYS));
  const history = fullHistory.filter((t) => recentDates.has(t.date));

  const todayPicks = swingPicksData?.picks ?? [];
  const picksGeneratedAt: string | undefined = swingPicksData?.generated_at ?? swingPicksData?.date;

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/en/watchlist" className="hover:text-[#3b82f6] transition-colors">Watchlist</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Trending Stocks Performance — Last 10 Days</span>
        </nav>

        <div className="relative z-10">
          <SwingPerformanceDashboard
            initialHistory={history}
            stats={performanceData.stats}
            todayPicks={todayPicks}
            picksGeneratedAt={picksGeneratedAt}
            hideBotLink
            locale="en"
          />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
