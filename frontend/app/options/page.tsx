import { getMasterData, getOptionsData } from "@/lib/data";
import { OptionsData, OptionPick } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Options Picks | BOGA AI — Daily Call Opportunities",
  description:
    "Daily algorithmic options call opportunities from BOGA AI v6.1. EMA trend entries with greeks, expected move, and exit levels.",
  alternates: { canonical: "https://bogastock.com/options" },
};

const ENTRY_MODE_COLORS: Record<string, string> = {
  EMA200_BREAKOUT:          "text-[#f59e0b] border-[#f59e0b]/40 bg-[#f59e0b]/10",
  EMA200_BREAKOUT_BELOW200: "text-[#f59e0b] border-[#f59e0b]/40 bg-[#f59e0b]/10",
  GOLDEN_CROSS:             "text-[#a78bfa] border-[#a78bfa]/40 bg-[#a78bfa]/10",
  GOLDEN_CROSS_BELOW200:    "text-[#a78bfa] border-[#a78bfa]/40 bg-[#a78bfa]/10",
  NEAR_GOLDEN:              "text-[#60a5fa] border-[#60a5fa]/40 bg-[#60a5fa]/10",
  TREND_BIRTH:              "text-[#34d399] border-[#34d399]/40 bg-[#34d399]/10",
  ESTABLISHED_TREND:        "text-[#10b981] border-[#10b981]/40 bg-[#10b981]/10",
  EMA50_BOUNCE:             "text-[#fb923c] border-[#fb923c]/40 bg-[#fb923c]/10",
};

const MODE_ICONS: Record<string, string> = {
  EMA200_BREAKOUT: "⚡",
  EMA200_BREAKOUT_BELOW200: "⚡",
  GOLDEN_CROSS: "🌟",
  GOLDEN_CROSS_BELOW200: "🌟",
  NEAR_GOLDEN: "🔜",
  TREND_BIRTH: "🌱",
  ESTABLISHED_TREND: "🐂",
  EMA50_BOUNCE: "📉",
};

function fmt(n: number | null | undefined, decimals = 2, prefix = "") {
  if (n == null) return "—";
  return prefix + n.toFixed(decimals);
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function IVBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="text-[#64748b]">—</span>;
  const color = rank <= 20
    ? "text-[#34d399] bg-[#34d399]/10"
    : rank <= 40
    ? "text-[#fbbf24] bg-[#fbbf24]/10"
    : "text-[#f87171] bg-[#f87171]/10";
  const label = rank <= 20 ? "CHEAP" : rank <= 40 ? "NORMAL" : "RICH";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {rank} · {label}
    </span>
  );
}

function RegimeBadge({ regime }: { regime: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    trend:    { label: "TREND",    cls: "text-[#34d399] bg-[#34d399]/10" },
    breakout: { label: "BREAKOUT", cls: "text-[#f59e0b] bg-[#f59e0b]/10" },
    neutral:  { label: "NEUTRAL",  cls: "text-[#94a3b8] bg-[#94a3b8]/10" },
  };
  const m = map[regime] ?? map.neutral;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${m.cls}`}>
      {m.label}
    </span>
  );
}

function OptionCard({ opt, label }: { opt: OptionPick["institutional"]; label: string }) {
  if (!opt) return null;
  const tpPct = opt.tp_price && opt.premium
    ? ((opt.tp_price - opt.premium) / opt.premium * 100).toFixed(0)
    : null;
  const slPct = opt.sl_price && opt.premium
    ? ((opt.sl_price - opt.premium) / opt.premium * 100).toFixed(0)
    : null;

  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-xl p-4">
      <div className="text-[10px] text-[#64748b] uppercase font-bold mb-3 tracking-wider">{label}</div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-black text-white">${opt.strike?.toFixed(0)} CALL</span>
        <span className="text-[#64748b] text-xs">{opt.expiration} · {opt.dte}d</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <div className="text-[10px] text-[#64748b] uppercase mb-1">Premium</div>
          <div className="text-white font-mono font-bold">${opt.premium?.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#64748b] uppercase mb-1">Delta</div>
          <div className="text-white font-mono font-bold">{opt.delta?.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#64748b] uppercase mb-1">Cost/Cont.</div>
          <div className="text-white font-mono font-bold">${opt.contract_cost?.toFixed(0)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <div className="text-[10px] text-[#10b981] uppercase mb-1">TP</div>
          <div className="text-[#10b981] font-mono font-bold text-sm">
            ${opt.tp_price?.toFixed(2)}
            {tpPct && <span className="text-[10px] ml-1">(+{tpPct}%)</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#ef4444] uppercase mb-1">SL</div>
          <div className="text-[#ef4444] font-mono font-bold text-sm">
            ${opt.sl_price?.toFixed(2)}
            {slPct && <span className="text-[10px] ml-1">({slPct}%)</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#64748b] uppercase mb-1">Time Stop</div>
          <div className="text-[#94a3b8] font-mono text-sm">{opt.time_stop_days}d left</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-[#64748b]">
        <span>Breakeven: <b className="text-[#94a3b8]">${opt.breakeven?.toFixed(2)}</b></span>
        <span>OI: <b className="text-[#94a3b8]">{opt.oi?.toLocaleString()}</b></span>
        <span>Theta/day: <b className="text-[#94a3b8]">{opt.daily_decay_pct?.toFixed(1)}%</b></span>
        <span>Sim gain: <b className={`${(opt.sim_gain_pct ?? 0) >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
          {opt.sim_gain_pct != null ? (opt.sim_gain_pct >= 0 ? "+" : "") + opt.sim_gain_pct.toFixed(0) + "%" : "—"}
        </b></span>
      </div>
    </div>
  );
}

function PickRow({ pick, index }: { pick: OptionPick; index: number }) {
  const modeColor = ENTRY_MODE_COLORS[pick.entry_mode] ?? "text-[#94a3b8] border-white/10 bg-white/5";
  const modeIcon  = MODE_ICONS[pick.entry_mode] ?? "📊";
  const isTop3    = index < 3;

  return (
    <div className={`glass-card p-5 md:p-6 border-2 transition-all hover:border-[#3b82f6]/40 ${
      isTop3 ? "border-[#3b82f6]/30" : "border-transparent"
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-black ${isTop3 ? "text-[#3b82f6]" : "text-[#64748b]"}`}>
            #{pick.rank}
          </span>
          <Link href={`/stock/${pick.ticker}`} className="hover:text-[#3b82f6] transition-colors">
            <span className="text-2xl font-black text-white tracking-tight">{pick.ticker}</span>
          </Link>
          <RegimeBadge regime={pick.regime} />
          {pick.earnings_warning && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-[#f87171] bg-[#f87171]/10">
              ⚠️ EARN
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold px-2 py-1 rounded border ${modeColor}`}>
            {modeIcon} {pick.entry_mode_label}
          </span>
          <div className={`text-white text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r ${
            pick.score >= 75 ? "from-[#f59e0b] to-[#ef4444]" :
            pick.score >= 60 ? "from-[#3b82f6] to-[#6366f1]" :
            "from-[#10b981] to-[#06b6d4]"
          }`}>
            {pick.score.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Price + key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5 text-center">
        <div className="bg-[#0d1117] rounded-lg p-2.5">
          <div className="text-[10px] text-[#64748b] uppercase mb-1">Price</div>
          <div className="text-white font-mono font-bold">${pick.current_price.toFixed(2)}</div>
        </div>
        <div className="bg-[#0d1117] rounded-lg p-2.5">
          <div className="text-[10px] text-[#64748b] uppercase mb-1">Exp Move</div>
          <div className="text-[#a78bfa] font-mono font-bold">±${pick.expected_move?.toFixed(1)}</div>
        </div>
        <div className="bg-[#0d1117] rounded-lg p-2.5">
          <div className="text-[10px] text-[#64748b] uppercase mb-1">IV Rank</div>
          <IVBadge rank={pick.iv_rank ?? null} />
        </div>
        <div className="bg-[#0d1117] rounded-lg p-2.5">
          <div className="text-[10px] text-[#64748b] uppercase mb-1">ADX</div>
          <div className={`font-mono font-bold text-sm ${(pick.adx ?? 0) >= 25 ? "text-[#34d399]" : "text-[#94a3b8]"}`}>
            {pick.adx?.toFixed(0) ?? "—"}
          </div>
        </div>
        <div className="bg-[#0d1117] rounded-lg p-2.5">
          <div className="text-[10px] text-[#64748b] uppercase mb-1">RSI</div>
          <div className={`font-mono font-bold text-sm ${
            (pick.rsi ?? 50) > 70 ? "text-[#f87171]" :
            (pick.rsi ?? 50) < 40 ? "text-[#60a5fa]" : "text-[#94a3b8]"
          }`}>{pick.rsi?.toFixed(0) ?? "—"}</div>
        </div>
        <div className="bg-[#0d1117] rounded-lg p-2.5">
          <div className="text-[10px] text-[#64748b] uppercase mb-1">RS vs SPY</div>
          <div className={`font-mono font-bold text-sm ${(pick.rs_vs_spy_60d ?? 0) >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
            {fmtPct(pick.rs_vs_spy_60d)}
          </div>
        </div>
        <div className="bg-[#0d1117] rounded-lg p-2.5">
          <div className="text-[10px] text-[#64748b] uppercase mb-1">HV30</div>
          <div className="text-[#94a3b8] font-mono font-bold text-sm">{pick.hv30?.toFixed(0) ?? "—"}%</div>
        </div>
      </div>

      {/* EMA info */}
      <div className="text-xs text-[#64748b] mb-4 font-mono">
        <span className="text-[#94a3b8]">{pick.ema_pattern}</span>
        <span className="ml-3">EMA200: <b className="text-white">${pick.ema200?.toFixed(2)}</b></span>
        <span className="ml-3">EMA50: <b className="text-white">${pick.ema50?.toFixed(2)}</b></span>
        <span className="ml-3">VWAP: <b className={pick.vwap_ok ? "text-[#34d399]" : "text-[#f87171]"}>
          ${pick.vwap?.toFixed(2)}{!pick.vwap_ok && " ⚠️"}
        </b></span>
        {pick.uoa_score > 30 && (
          <span className="ml-3 text-[#f59e0b] font-bold">🔥 UOA: {pick.uoa_signal}</span>
        )}
      </div>

      {/* Option contracts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pick.institutional && (
          <OptionCard opt={pick.institutional} label="🛡️ Institutional (Mid Delta)" />
        )}
        {pick.asymmetric && (
          <OptionCard opt={pick.asymmetric} label="🚀 Asymmetric (OTM)" />
        )}
      </div>
    </div>
  );
}

export default async function OptionsPage() {
  const [master, data] = await Promise.all([getMasterData(), getOptionsData()]);
  const picks = data?.picks ?? [];

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }) + " ET";
    } catch { return iso; }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#64748b] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#94a3b8]">Options Picks</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
                Options Picks
                {data && <span className="ml-3 text-[#3b82f6]">— {data.date}</span>}
              </h1>
              <p className="text-[#94a3b8] text-base">
                BOGA AI v6.1 daily call opportunities · EMA trend entries with full Greeks &amp; exit levels
                {data && (
                  <span className="ml-2 text-[#64748b]">· Updated {formatTime(data.generated_at)}</span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/options/archive"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e293b] border border-white/10 rounded-xl text-sm font-semibold text-[#94a3b8] hover:text-white hover:border-white/20 transition-all"
              >
                📅 Archive
              </Link>
              <Link
                href="/options/performance"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e293b] border border-[#3b82f6]/30 rounded-xl text-sm font-semibold text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all"
              >
                📊 Performance
              </Link>
            </div>
          </div>
        </div>

        {/* Market summary bar */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            {[
              { label: "VIX", val: `${data.vix} (${data.vix_regime.split(" ")[0]})`,
                cls: data.vix < 18 ? "text-[#34d399]" : data.vix < 25 ? "text-[#fbbf24]" : "text-[#f87171]" },
              { label: "SPY 60d", val: fmtPct(data.spy_return_60d),
                cls: data.spy_return_60d >= 0 ? "text-[#34d399]" : "text-[#f87171]" },
              { label: "Trend", val: String(data.regime_summary.trend), cls: "text-[#34d399]" },
              { label: "Breakout", val: String(data.regime_summary.breakout), cls: "text-[#f59e0b]" },
              { label: "Candidates", val: String(data.total_candidates), cls: "text-white" },
              { label: "Universe", val: `${data.universe_size} stocks`, cls: "text-[#64748b]" },
            ].map((m) => (
              <div key={m.label} className="glass-card p-3 text-center">
                <div className="text-[10px] text-[#64748b] uppercase mb-1 tracking-wider">{m.label}</div>
                <div className={`font-mono font-bold text-sm ${m.cls}`}>{m.val}</div>
              </div>
            ))}
          </div>
        )}

        {picks.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <div className="text-5xl mb-4">🦅</div>
            <h2 className="text-xl font-bold text-white mb-2">No Options Data Yet</h2>
            <p className="text-[#94a3b8] text-sm max-w-md mx-auto">
              The BOGA AI options scanner runs at 13:00 NY time on weekdays.
              It scans 500+ stocks for high-conviction call setups (DTE 60–150, IV Rank &lt;40).
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {picks.map((pick, idx) => (
              <PickRow key={pick.ticker} pick={pick} index={idx} />
            ))}
          </div>
        )}

        {/* Legend */}
        {picks.length > 0 && (
          <div className="mt-8 glass-card p-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[#64748b]">
            <span>🛡️ <b className="text-[#94a3b8]">Institutional</b> = ATM/near-ATM, mid-delta (Δ0.4–0.6)</span>
            <span>🚀 <b className="text-[#94a3b8]">Asymmetric</b> = OTM within expected move, high sim gain</span>
            <span>⚡ <b className="text-[#94a3b8]">E200</b> = EMA200 Breakout · 🌟 <b className="text-[#94a3b8]">GX</b> = Golden Cross</span>
            <span>🌱 <b className="text-[#94a3b8]">TRD</b> = Trend Birth · 🐂 <b className="text-[#94a3b8]">EST</b> = Established Trend</span>
            <span>Exit: <b className="text-[#94a3b8]">TP +40% · SL -25% · Time Stop = DTE×0.65</b></span>
            <span className="ml-auto">
              <Link href="/" className="text-[#3b82f6] hover:underline">← Dashboard</Link>
            </span>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
