import { Metadata } from "next";
import Link from "next/link";
import { getSwingAllPicks } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Günlük Swing Trade Adayları — BOGA AI",
  description: "Tüm günlük swing trade adayları detaylı analiz ve sinyallerle birlikte.",
  alternates: { canonical: "https://bogastock.com/global/tr/swing" },
};

const SIGNAL_STYLE: Record<string, string> = {
  AL: "bg-green-500/15 border-green-500/50 text-green-400",
  SAT: "bg-red-500/15 border-red-500/50 text-red-400",
  İZLE: "bg-amber-500/15 border-amber-500/50 text-amber-400",
  BEKLE: "bg-white/5 border-white/15 text-white/40",
};

interface SwingRow {
  ticker: string;
  company: string;
  price: string;
  change: string;
  changeNum: number;
  rsi: string;
  signal: string;
  volume?: string;
  avgVolume?: string;
}

export default async function TrSwingPage() {
  const swingPicks = await getSwingAllPicks();

  const swingRows: SwingRow[] = (swingPicks?.picks ?? []).map((pick: any) => ({
    ticker: pick.ticker,
    company: pick.company || pick.ticker,
    price: `$${(pick.price || 0).toFixed(2)}`,
    change: `${pick.change_pct >= 0 ? "+" : ""}${(pick.change_pct || 0).toFixed(2)}%`,
    changeNum: pick.change_pct || 0,
    rsi: (pick.rsi || 0).toFixed(1),
    signal: pick.signal || "İZLE",
    volume: pick.volume ? `${(pick.volume / 1000000).toFixed(1)}M` : "N/A",
    avgVolume: pick.avg_volume_30d ? `${(pick.avg_volume_30d / 1000000).toFixed(1)}M` : "N/A",
  }));

  const generatedAt = swingPicks?.generated_at || swingPicks?.date || new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:py-8">
        {/* Gezinme */}
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">
          <Link href="/global/tr/home" className="hover:text-[#3b82f6] transition-colors">Gösterge Paneli</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Günlük Swing Trade Adayları</span>
        </nav>

        {/* Başlık */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white mb-2">Günlük Swing Trade Adayları</h1>
          <p className="text-white/50">
            Bugün seçilen tüm swing trade adayları
            {generatedAt && <span className=" ml-2 text-[#3b82f6]">— Oluşturuluş: {generatedAt}</span>}
          </p>
        </div>

        {/* Tablo */}
        <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden shadow-2xl shadow-black/50 bg-[#111620]">
          <div className="bg-[#0d1117] px-4 py-3 border-b border-[#1e2a3a]">
            <span className="text-xs font-black text-white/70 uppercase tracking-wider">
              {swingRows.length} Aday
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0d1117] text-white/30 uppercase text-[10px] tracking-wider border-t border-[#1e2a3a]">
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Şirket</th>
                  <th className="px-4 py-3 text-right">Fiyat</th>
                  <th className="px-4 py-3 text-right">Δ%</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">RSI</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">Hacim</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">Ort. Hacim 30g</th>
                  <th className="px-4 py-3 text-center">Sinyal</th>
                </tr>
              </thead>
              <tbody>
                {swingRows.length > 0 ? (
                  swingRows.map((r) => (
                    <tr key={r.ticker} className="border-t border-[#1e2a3a] bg-[#0a0e17] hover:bg-[#0d1117] transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/global/tr/${r.ticker}`}
                          className="font-black text-white hover:text-[#3b82f6] transition-colors"
                        >
                          {r.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-white/50 hidden sm:table-cell text-xs">{r.company}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/90 font-semibold">{r.price}</td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold ${
                          r.changeNum >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {r.change}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white/70 hidden md:table-cell">{r.rsi}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/50 hidden lg:table-cell text-[9px]">{r.volume}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/50 hidden lg:table-cell text-[9px]">{r.avgVolume}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${SIGNAL_STYLE[r.signal] || SIGNAL_STYLE["İZLE"]}`}>
                          {r.signal}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-white/50">
                      Swing adayı bulunmamaktadır
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
