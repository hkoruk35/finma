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

        {/* ── Performance Dashboard Banner (blinking, prominent) */}
        <Link
          href="/options/performance"
          className="mt-4 mb-2 flex items-center justify-between gap-4 bg-gradient-to-r from-[#0d1a2a] to-[#0a1520] border border-[#34d399]/30 hover:border-[#34d399]/70 p-4 rounded transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
            <div>
              <div className="text-white font-black text-sm flex items-center gap-2">
                View Performance Dashboard →
              </div>
              <div className="text-[#00d2ff] text-[10px] mt-0.5">
                Tüm öneri opsiyonların anlık P&amp;L, kontrat bitiş ve kâr/zarar durumu — CANLI
              </div>
            </div>
          </div>
          <span className="text-[#34d399] text-xs font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">P&amp;L DASHBOARD ↗</span>
        </Link>

        {/* ── Footer Stats ──────────────────────────────────── */}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Link href="/options/archive" className="text-slate-400 text-[11px] font-black uppercase hover:underline">Historical Archive →</Link>
           </div>
           <div className="bg-[#0d1420] border border-[#3b82f6]/20 p-3 rounded flex flex-col justify-center items-center hover:border-[#3b82f6]/50 transition-colors">
              <Link href="/options/monitor" className="text-[#3b82f6] text-[11px] font-black uppercase hover:underline flex items-center gap-1">Web Monitor ⚡</Link>
           </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
