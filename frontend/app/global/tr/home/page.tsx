import { Metadata } from "next";
import Link from "next/link";
import { getMasterData, getSwingAllPicks, getAllTickers } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGA AI Gösterge Paneli",
  description: "Swing trade adayları, trend hisseleri ve top 100 tracker'ın hızlı özeti.",
  alternates: { canonical: "https://bogastock.com/global/tr/home" },
};

const SIGNAL_STYLE: Record<string, string> = {
  AL: "bg-green-500/15 border-green-500/50 text-green-400",
  SAT: "bg-red-500/15 border-red-500/50 text-red-400",
  İZLE: "bg-amber-500/15 border-amber-500/50 text-amber-400",
  BEKLE: "bg-white/5 border-white/15 text-white/40",
};

interface HomeRow {
  ticker: string;
  company: string;
  price: string;
  change: string;
  changeNum: number;
  rsi: string;
  signal: string;
}

export default async function TrHomePage() {
  const [masterData, swingPicks, allTickers] = await Promise.all([
    getMasterData(),
    getSwingAllPicks(),
    getAllTickers(),
  ]);

  // Swing trade adaylarını çıkar (ilk 5)
  const swingRows: HomeRow[] = (swingPicks?.picks ?? []).slice(0, 5).map((pick: any) => ({
    ticker: pick.ticker,
    company: pick.company || pick.ticker,
    price: `$${(pick.price || 0).toFixed(2)}`,
    change: `${pick.change_pct >= 0 ? "+" : ""}${(pick.change_pct || 0).toFixed(2)}%`,
    changeNum: pick.change_pct || 0,
    rsi: (pick.rsi || 0).toFixed(1),
    signal: pick.signal || "İZLE",
  }));

  // Trend hisseleri - trend tema türüne göre filtrele (ilk 5)
  const trendRows: HomeRow[] = (allTickers || [])
    .filter((t: any) => t.score_type === "TREND" || t.score_type?.includes("TREND"))
    .slice(0, 5)
    .map((t: any) => ({
      ticker: t.ticker,
      company: t.company,
      price: `$${(t.price || 0).toFixed(2)}`,
      change: `${t.change_pct >= 0 ? "+" : ""}${(t.change_pct || 0).toFixed(2)}%`,
      changeNum: t.change_pct || 0,
      rsi: (t.technical?.rsi || 0).toFixed(1),
      signal: t.score_type || "İZLE",
    }));

  // Top 100 hisselerini çıkar (ilk 5)
  const top100Rows: HomeRow[] = (allTickers || [])
    .slice(0, 5)
    .map((t: any) => ({
      ticker: t.ticker,
      company: t.company,
      price: `$${(t.price || 0).toFixed(2)}`,
      change: `${t.change_pct >= 0 ? "+" : ""}${(t.change_pct || 0).toFixed(2)}%`,
      changeNum: t.change_pct || 0,
      rsi: (t.technical?.rsi || 0).toFixed(1),
      signal: t.score_type || "İZLE",
    }));

  const renderTable = (rows: HomeRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-[#0d1117] text-white/30 uppercase text-[10px] tracking-wider">
            <th className="px-4 py-3">Ticker</th>
            <th className="px-4 py-3 hidden sm:table-cell">Şirket</th>
            <th className="px-4 py-3 text-right">Fiyat</th>
            <th className="px-4 py-3 text-right">Δ%</th>
            <th className="px-4 py-3 text-right">RSI</th>
            <th className="px-4 py-3 text-center">Sinyal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker} className="border-t border-[#1e2a3a] bg-[#0a0e17]">
              <td className="px-4 py-3">
                <Link
                  href={`/global/tr/${r.ticker}`}
                  className="font-black text-white hover:text-[#3b82f6] transition-colors"
                >
                  {r.ticker}
                </Link>
              </td>
              <td className="px-4 py-3 text-white/50 hidden sm:table-cell">{r.company}</td>
              <td className="px-4 py-3 text-right font-mono text-white/90">{r.price}</td>
              <td
                className={`px-4 py-3 text-right font-mono font-semibold ${
                  r.changeNum >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {r.change}
              </td>
              <td className="px-4 py-3 text-right font-mono text-white/70">{r.rsi}</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${SIGNAL_STYLE[r.signal] || SIGNAL_STYLE["İZLE"]}`}>
                  {r.signal}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 md:py-8">
        {/* Sayfa başlığı */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Gösterge Paneli</h1>
          <p className="text-white/50">Swing adayları, trend hisseleri ve top performer'ların hızlı özeti</p>
        </div>

        {/* Üç bölüm */}
        <div className="space-y-8">
          {/* Bölüm 1: Günlük Swing Trade Adayları */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white">Günlük Swing Trade Adayları</h2>
              <Link
                href="/global/tr/swing"
                className="text-xs font-bold text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
              >
                Hepsini Gör →
              </Link>
            </div>
            <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden shadow-2xl shadow-black/50 bg-[#111620]">
              {swingRows.length > 0 ? renderTable(swingRows) : <div className="p-4 text-center text-white/50">Swing adayı bulunmamaktadır</div>}
            </div>
          </section>

          {/* Bölüm 2: 2026 Trend Hisseleri */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white">2026 Trend Hisseleri</h2>
              <Link
                href="/global/tr/trend"
                className="text-xs font-bold text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
              >
                Hepsini Gör →
              </Link>
            </div>
            <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden shadow-2xl shadow-black/50 bg-[#111620]">
              {trendRows.length > 0 ? renderTable(trendRows) : <div className="p-4 text-center text-white/50">Trend hissesi bulunmamaktadır</div>}
            </div>
          </section>

          {/* Bölüm 3: Top 100 Tracker */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white">Top 100 Tracker</h2>
              <Link
                href="/global/tr/top100"
                className="text-xs font-bold text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
              >
                Hepsini Gör →
              </Link>
            </div>
            <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden shadow-2xl shadow-black/50 bg-[#111620]">
              {top100Rows.length > 0 ? renderTable(top100Rows) : <div className="p-4 text-center text-white/50">Hisse bulunmamaktadır</div>}
            </div>
          </section>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
