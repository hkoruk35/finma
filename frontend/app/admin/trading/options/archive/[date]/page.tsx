import { getMasterData, getOptionsData } from "@/lib/data";
import { OptionPick } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatNumber } from "@/lib/formatNumber";

export const revalidate = 3600;

function fmt(n: number | null | undefined, d = 2) {
  return n == null ? "—" : formatNumber(n, d);
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + formatNumber(n, 1) + "%";
}

const MODE_ICONS: Record<string, string> = {
  EMA200_BREAKOUT: "⚡", EMA200_BREAKOUT_BELOW200: "⚡",
  GOLDEN_CROSS: "🌟", GOLDEN_CROSS_BELOW200: "🌟",
  NEAR_GOLDEN: "🔜", TREND_BIRTH: "🌱",
  ESTABLISHED_TREND: "🐂", EMA50_BOUNCE: "📉",
};

function ArchivePickRow({ pick, index }: { pick: OptionPick; index: number }) {
  const icon = MODE_ICONS[pick.entry_mode] ?? "📊";
  const inst = pick.institutional;
  const asym = pick.asymmetric;
  const isTop3 = index < 3;

  return (
    <div className={`glass-card p-4 border-2 transition-all ${isTop3 ? "border-[#3b82f6]/20" : "border-transparent"}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-black ${isTop3 ? "text-[#3b82f6]" : "text-[#00d2ff]"}`}>#{pick.rank}</span>
          <Link href={`/stock/${pick.ticker}`} className="text-xl font-black text-white hover:text-[#3b82f6] transition-colors">
            {pick.ticker}
          </Link>
          <span className="text-[#00d2ff] font-mono text-sm">${formatNumber(pick.current_price, 2)}</span>
          <span className="text-xs text-[#00d2ff]">{icon} {pick.entry_mode_label}</span>
        </div>
        <div className={`text-white text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r ${
          pick.score >= 75 ? "from-[#f59e0b] to-[#ef4444]" :
          pick.score >= 60 ? "from-[#3b82f6] to-[#6366f1]" : "from-[#10b981] to-[#06b6d4]"
        }`}>{formatNumber(pick.score, 1)}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#00d2ff] mb-3">
        <span>ADX: <b className="text-white">{fmt(pick.adx, 0)}</b></span>
        <span>RSI: <b className="text-white">{fmt(pick.rsi, 0)}</b></span>
        <span>IV Rank: <b className="text-white">{fmt(pick.iv_rank, 0)}</b></span>
        <span>RS/SPY: <b className={`${(pick.rs_vs_spy_60d ?? 0) >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>{fmtPct(pick.rs_vs_spy_60d)}</b></span>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-[#00d2ff]">
        {inst && (
          <span className="text-white">
            🛡️ <b>${formatNumber(inst.strike?, 0)}C</b> · Prem: ${formatNumber(inst.premium?, 2)}
            · TP: ${formatNumber(inst.tp_price?, 2)} · SL: ${formatNumber(inst.sl_price?, 2)}
            · {inst.expiration} ({inst.dte}d)
          </span>
        )}
        {asym && (
          <span className="text-white">
            🚀 <b>${formatNumber(asym.strike?, 0)}C</b> · Prem: ${formatNumber(asym.premium?, 2)}
            · TP: ${formatNumber(asym.tp_price?, 2)} · SL: ${formatNumber(asym.sl_price?, 2)}
          </span>
        )}
        {pick.expected_move != null && (
          <span>Exp Move: <b className="text-[#a78bfa]">±${formatNumber(pick.expected_move, 1)}</b></span>
        )}
      </div>
    </div>
  );
}

export default async function OptionsArchiveDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [master, data] = await Promise.all([getMasterData(), getOptionsData(date)]);
  if (!data) notFound();

  const picks = data.picks ?? [];

  const formatDate = (d: string) => {
    try {
      return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
    } catch { return d; }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/admin/trading/options" className="hover:text-white transition-colors">Options</Link>
          <span>/</span>
          <Link href="/admin/trading/options/archive" className="hover:text-white transition-colors">Archive</Link>
          <span>/</span>
          <span className="text-white">{date}</span>
        </nav>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
              {formatDate(date)}
            </h1>
            <p className="text-[#00d2ff] text-sm">
              {picks.length} candidates · VIX {data.vix} ({data.vix_regime.split(" ")[0]})
              · SPY 60d {fmtPct(data.spy_return_60d)}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/trading/options/archive"
              className="px-4 py-2 bg-[#1e293b] border border-white/10 rounded-lg text-sm text-white hover:text-white transition-colors"
            >
              ← Archive
            </Link>
            <Link
              href="/admin/trading/options"
              className="px-4 py-2 bg-[#1e293b] border border-[#3b82f6]/30 rounded-lg text-sm text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors"
            >
              Today →
            </Link>
          </div>
        </div>

        {/* Summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Trend", val: data.regime_summary.trend, cls: "text-[#34d399]" },
            { label: "Breakout", val: data.regime_summary.breakout, cls: "text-[#f59e0b]" },
            { label: "Total", val: data.total_candidates, cls: "text-white" },
            { label: "Universe", val: data.universe_size, cls: "text-[#00d2ff]" },
          ].map((m) => (
            <div key={m.label} className="glass-card p-3 text-center">
              <div className="text-[10px] text-[#00d2ff] uppercase mb-1">{m.label}</div>
              <div className={`font-mono font-medium text-lg ${m.cls}`}>{m.val}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {picks.map((pick, idx) => (
            <ArchivePickRow key={pick.ticker} pick={pick} index={idx} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
