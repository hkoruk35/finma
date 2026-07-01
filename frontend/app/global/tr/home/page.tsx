import { Metadata } from "next";
import Link from "next/link";
import { getTopSwingByVolume, getTopTrendByVolume, getTopTop100ByVolume, getLastUpdated, getLiveIndices } from "@/lib/homeFeed";
import { getSwingPerformance } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";
import TickerTape from "@/components/TickerTape";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Swing trade adayları, trend hisseleri ve top 100 tracker'ın hızlı özeti.",
  alternates: { canonical: "https://bogastock.com/global/tr/home" },
};

export default async function TrHomePage() {
  const [swingByVolume, trendByVolume, top100ByVolume, lastUpdated, indices, swingStats] = await Promise.all([
    getTopSwingByVolume(5),
    getTopTrendByVolume(5),
    getTopTop100ByVolume(5),
    getLastUpdated(),
    getLiveIndices(),
    getSwingPerformance(),
  ]);

  // Performance sayfasındaki SwingPerformanceDashboard ile AYNI metodolojiyi kullan
  // (duplicate ve PENDING hariç) — böylece rakamlar her zaman uyumlu olur.
  const bannerStats = (() => {
    const history: any[] = swingStats?.history ?? [];
    if (history.length === 0) return swingStats?.stats ?? null;
    const active = history.filter((t: any) => !t.is_duplicate && t.result !== "PENDING" && t.return_pct != null);
    if (active.length === 0) return swingStats?.stats ?? null;
    const wins = active.filter((t: any) => (t.return_pct ?? 0) > 0).length;
    const sumRet = active.reduce((s: number, t: any) => s + (t.return_pct ?? 0), 0);
    const above10 = active.filter((t: any) => (t.return_pct ?? 0) >= 10).length;
    return {
      win_rate: (wins / active.length * 100).toFixed(1),
      avg_return_pct: (sumRet / active.length).toFixed(1),
      above_10pct_rate: (above10 / active.length * 100).toFixed(1),
      total_picks: history.length,
      period_days: swingStats?.stats?.period_days,
    };
  })();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Performance Banner Link */}
        {bannerStats && (
          <Link href="/global/tr/performance" className="block group w-full mb-8">
            <div className="bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#3b82f6]/30 group-hover:border-[#3b82f6]/80 transition-colors rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#3b82f6] blur-[80px] opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>

              <div className="flex-1 z-10 text-center md:text-left">
                 <div className="flex items-center gap-3 mb-3 justify-center md:justify-start">
                    <h3 className="text-[#3b82f6] font-black uppercase tracking-[0.2em] text-sm md:text-base">KANITLANMIŞ PERFORMANS</h3>
                    <span className="px-3 py-1 rounded-full bg-[#3b82f6]/10 text-[10px] md:text-xs font-bold text-[#3b82f6] border border-[#3b82f6]/20 group-hover:bg-[#3b82f6] group-hover:text-white transition-colors">DETAYLI LOGS'U GÖR →</span>
                 </div>
                 <p className="text-white text-xl md:text-2xl font-bold">
                   BOGA AI Swing Motoru: <span className="text-[#10b981]">{bannerStats.win_rate}% Kazanç Oranı</span>{bannerStats.period_days ? ` ${bannerStats.period_days} Gün` : ""}
                 </p>
                 <p className="text-white text-sm mt-2">
                   Yalnızca algoritmik kriterlerle oluşturulan {bannerStats.total_picks} yüksek inançlı ticareye dayanır.
                 </p>
              </div>

              <div className="flex justify-center gap-6 z-10">
                <div className="text-center">
                   <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{bannerStats.avg_return_pct}%</div>
                   <div className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-wider mt-1">Ortalama Max Getiri</div>
                </div>
                <div className="w-px bg-white/10 hidden md:block"></div>
                <div className="text-center">
                   <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{bannerStats.above_10pct_rate}%</div>
                   <div className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-wider mt-1">+10% Kazanç</div>
                </div>
                <div className="w-px bg-white/10 hidden md:block"></div>
                <div className="text-center">
                   <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{bannerStats.total_picks}</div>
                   <div className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-wider mt-1">Toplam Sinyal</div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Üç sütun grid - Swing omurga (2 kolon) + Trend/Top100 destekleyici (1 kolon) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <HomeSimpleCard
            title="Swing Trade"
            accent="#3b82f6"
            stocks={swingByVolume}
            viewAllHref="/global/tr/swing"
            locale="tr"
            sortLabel="Swing skoruna göre sıralandı"
          />

          <HomeSimpleCard
            title="Trend Hisseleri"
            accent="#a78bfa"
            stocks={trendByVolume}
            viewAllHref="/global/tr/trend"
            locale="tr"
            sortLabel="Hacim sırasına göre"
          />

          <HomeSimpleCard
            title="Top 100"
            accent="#f59e0b"
            stocks={top100ByVolume}
            viewAllHref="/global/tr/top100"
            locale="tr"
            sortLabel="En aktif işlem gören hisseler"
          />
        </div>

        {/* Güncelleme bilgisi */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Son güncelleme: <span className="font-mono text-white/60">{lastUpdated}</span> (ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Veriler 15 dakika gecikmeli kaynaklardan analiz edilir. Sayfa, borsanın açık olduğu günlerde saat başı güncellenir.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
