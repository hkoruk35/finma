import { getMasterData, getOptionsDates } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
};

export default async function OptionsArchivePage() {
  const [master, dates] = await Promise.all([getMasterData(), getOptionsDates()]);

  const formatDate = (d: string) => {
    try {
      return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });
    } catch { return d; }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/admin/trading/options" className="hover:text-white transition-colors">Options</Link>
          <span>/</span>
          <span className="text-white">Archive</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg md:text-xl font-black text-white tracking-tighter mb-1 uppercase italic">
              Options Archive
            </h1>
            <p className="text-[#00d2ff] text-sm">{dates.length} scan{dates.length !== 1 ? "s" : ""} available</p>
          </div>
          <Link
            href="/admin/trading/options"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e293b] border border-[#3b82f6]/30 rounded-xl text-sm font-semibold text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all"
          >
            📡 Today&apos;s Picks
          </Link>
        </div>

        {dates.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="text-4xl mb-4">📅</div>
            <h2 className="text-lg font-medium text-white mb-2">No Archive Yet</h2>
            <p className="text-[#00d2ff] text-sm">Historical data will appear here after the first scan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dates.map((d, i) => (
              <Link
                key={d}
                href={`/options/archive/${d}`}
                className="glass-card p-5 flex items-center justify-between hover:border-[#3b82f6]/40 border-2 border-transparent transition-all"
              >
                <div>
                  <div className="text-white font-medium">{formatDate(d)}</div>
                  <div className="text-[#00d2ff] text-xs font-mono mt-0.5">{d}</div>
                </div>
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="text-[10px] font-medium px-2 py-1 rounded bg-[#3b82f6]/20 text-[#3b82f6]">
                      LATEST
                    </span>
                  )}
                  <span className="text-[#00d2ff]">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
