import { getMasterData, getOptionsData, getOptionsDates } from "@/lib/data";
import { OptionsData, OptionPick } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import OptionsTableClient from "@/components/OptionsTableClient";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Option Scanner | BOGA AI — v241 Terminal",
  description: "BOGA AI v241 Options Scanner. Institutional Flow & Winner Formula terminal.",
  alternates: { canonical: "https://bogastock.com/options" },
};

function n(v: any, d = 2): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return Number(v).toFixed(d);
}
function pct(v: any, d = 1): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  const x = Number(v);
  return (x >= 0 ? "+" : "") + x.toFixed(d) + "%";
}
function dollar(v: any, d = 2): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return "$" + Number(v).toFixed(d);
}
function num(v: any, d = 0): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default async function OptionsPage() {
  const [master, allDates] = await Promise.all([
    getMasterData(),
    getOptionsDates(),
  ]);

  const recentDates = allDates.slice(0, 3);
  const results = await Promise.all(recentDates.map((d) => getOptionsData(d)));
  const allPicks: OptionPick[] = results.flatMap((r) => r?.picks ?? []);
  const latestData = results[0];

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " ET";
    } catch { return iso; }
  };

  const TH = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
    <th className={`px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap border-b border-white/10 ${right ? "text-right" : center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );

  const TD = ({ children, center, right, cls }: { children: React.ReactNode; center?: boolean; right?: boolean; cls?: string }) => (
    <td className={`px-2 py-1.5 text-[11px] font-medium whitespace-nowrap border-b border-white/[0.03] ${center ? "text-center" : right ? "text-right" : "text-left"} ${cls || "text-slate-300"}`}>
      {children}
    </td>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-4">
        
        <OptionsTableClient allPicks={allPicks} latestData={latestData} />

        {/* ── Footer Stats ──────────────────────────────────── */}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-[#0d1420] border border-white/10 p-3 rounded">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Exit Policy</div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between"><span>Target</span><span className="text-emerald-400">+40%</span></div>
                <div className="flex justify-between"><span>Stop</span><span className="text-red-400">-30%</span></div>
              </div>
           </div>
           <div className="bg-[#0d1420] border border-white/10 p-3 rounded">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Winner Formula</div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between"><span>Gamma/Theta</span><span className="text-white">≥ 0.50</span></div>
                <div className="flex justify-between"><span>Earnings</span><span className="text-white">Block &lt; 14d</span></div>
              </div>
           </div>
           <div className="bg-[#0d1420] border border-white/10 p-3 rounded flex flex-col justify-center items-center">
              <Link href="/options/performance" className="text-[#3b82f6] text-[11px] font-black uppercase hover:underline">View Performance Dashboard →</Link>
           </div>
           <div className="bg-[#0d1420] border border-white/10 p-3 rounded flex flex-col justify-center items-center">
              <Link href="/options/archive" className="text-slate-400 text-[11px] font-black uppercase hover:underline">Historical Archive →</Link>
           </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
