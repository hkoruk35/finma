import { getMasterData, getOptionsDates, getOptionsData, getOptionsOutcomes } from "@/lib/data";
import { OptionsData, OptionPick, OptionsOutcomes, OptionPosition } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Options Performance | BOGA AI",
  description: "Live P&L tracking and historical analytics for BOGA AI v6.1 options picks.",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const MODE_META: Record<string, { icon: string; label: string; color: string; barColor: string }> = {
  EMA200_BREAKOUT:          { icon: "⚡", label: "EMA200 Breakout",     color: "text-[#f59e0b]", barColor: "bg-[#f59e0b]" },
  EMA200_BREAKOUT_BELOW200: { icon: "⚡", label: "EMA200 Brk (Below)",  color: "text-[#f59e0b]", barColor: "bg-[#f59e0b]" },
  GOLDEN_CROSS:             { icon: "🌟", label: "Golden Cross",         color: "text-[#a78bfa]", barColor: "bg-[#a78bfa]" },
  GOLDEN_CROSS_BELOW200:    { icon: "🌟", label: "Golden Cross (Below)", color: "text-[#a78bfa]", barColor: "bg-[#a78bfa]" },
  NEAR_GOLDEN:              { icon: "🔜", label: "Near Golden",          color: "text-[#60a5fa]", barColor: "bg-[#60a5fa]" },
  TREND_BIRTH:              { icon: "🌱", label: "Trend Birth",          color: "text-[#34d399]", barColor: "bg-[#34d399]" },
  ESTABLISHED_TREND:        { icon: "🐂", label: "Established Trend",    color: "text-[#10b981]", barColor: "bg-[#10b981]" },
  EMA50_BOUNCE:             { icon: "📉", label: "EMA50 Bounce",         color: "text-[#fb923c]", barColor: "bg-[#fb923c]" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:       { label: "OPEN",       color: "text-[#60a5fa]", bg: "bg-[#60a5fa]/10" },
  tp_hit:     { label: "TP HIT",     color: "text-[#34d399]", bg: "bg-[#34d399]/10" },
  sl_hit:     { label: "SL HIT",     color: "text-[#f87171]", bg: "bg-[#f87171]/10" },
  time_stop:  { label: "TIME STOP",  color: "text-[#fbbf24]", bg: "bg-[#fbbf24]/10" },
  expired:    { label: "EXPIRED",    color: "text-white", bg: "bg-[#94a3b8]/10" },
  manual:     { label: "MANUAL",     color: "text-[#e879f9]", bg: "bg-[#e879f9]/10" },
};

function fmt(n: number | null | undefined, d = 1) {
  return n == null ? "—" : n.toFixed(d);
}
function fmtPct(n: number | null | undefined, plus = true) {
  if (n == null) return "—";
  return (plus && n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}
function pnlColor(n: number | null | undefined) {
  if (n == null) return "text-[#00d2ff]";
  return n > 0 ? "text-[#34d399]" : n < 0 ? "text-[#f87171]" : "text-white";
}

function StatCard({
  label, value, sub, color = "text-white", small = false,
}: { label: string; value: string; sub?: string; color?: string; small?: boolean }) {
  return (
    <div className="glass-card p-4 text-center">
      <div className="text-[10px] text-[#00d2ff] uppercase tracking-wider mb-2">{label}</div>
      <div className={`font-black ${small ? "text-xl" : "text-2xl"} ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-[#00d2ff] mt-1">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color = "bg-[#3b82f6]", right }: {
  label: React.ReactNode; value: number; max: number; color?: string; right?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm">{label}</span>
        {right && <span className="text-xs text-[#00d2ff]">{right}</span>}
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WinRateRing({ rate }: { rate: number | null }) {
  if (rate == null) return <div className="text-[#00d2ff] text-2xl font-black">—</div>;
  const color = rate >= 60 ? "#34d399" : rate >= 40 ? "#fbbf24" : "#f87171";
  const r = 40, circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="text-2xl font-black -mt-16" style={{ color }}>{rate.toFixed(0)}%</div>
      <div className="text-[10px] text-[#00d2ff] mt-8 uppercase tracking-wider">Win Rate</div>
    </div>
  );
}

// ── Aggregate from scan files (fallback when no outcomes yet) ─────────────────

interface ScanStats {
  totalScans: number; totalPicks: number;
  byMode: Record<string, { count: number; avgScore: number; avgIVRank: number }>;
  avgScore: number; avgIVRank: number; avgDTE: number;
  ivDist: { cheap: number; normal: number; rich: number };
  topTickers: Record<string, number>;
}

function aggregateScanStats(scans: OptionsData[]): ScanStats {
  const byMode: ScanStats["byMode"] = {};
  const topTickers: Record<string, number> = {};
  let totalPicks = 0, scoreSum = 0, ivSum = 0, dteSum = 0, ivCount = 0, dteCount = 0;
  const ivDist = { cheap: 0, normal: 0, rich: 0 };

  for (const scan of scans) {
    for (const p of scan.picks) {
      totalPicks++;
      scoreSum += p.score;
      if (p.iv_rank != null) {
        ivSum += p.iv_rank; ivCount++;
        if (p.iv_rank <= 20) ivDist.cheap++;
        else if (p.iv_rank <= 40) ivDist.normal++;
        else ivDist.rich++;
      }
      if (p.dte != null) { dteSum += p.dte; dteCount++; }
      topTickers[p.ticker] = (topTickers[p.ticker] ?? 0) + 1;
      const m = p.entry_mode || "UNKNOWN";
      if (!byMode[m]) byMode[m] = { count: 0, avgScore: 0, avgIVRank: 0 };
      byMode[m].count++;
      byMode[m].avgScore += p.score;
      if (p.iv_rank != null) byMode[m].avgIVRank += p.iv_rank;
    }
  }
  for (const m of Object.keys(byMode)) {
    const n = byMode[m].count;
    byMode[m].avgScore  = Math.round((byMode[m].avgScore / n) * 10) / 10;
    byMode[m].avgIVRank = Math.round(byMode[m].avgIVRank / n);
  }
  return {
    totalScans: scans.length, totalPicks,
    byMode, avgScore: totalPicks ? Math.round((scoreSum / totalPicks) * 10) / 10 : 0,
    avgIVRank: ivCount ? Math.round(ivSum / ivCount) : 0,
    avgDTE: dteCount ? Math.round(dteSum / dteCount) : 0,
    ivDist, topTickers,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function OptionsPerformancePage() {
  const [master, dates, outcomes] = await Promise.all([
    getMasterData(),
    getOptionsDates(),
    getOptionsOutcomes(),
  ]);

  // Scan-level stats (signal quality, always available)
  const loadDates = dates.slice(0, 30);
  const scans = (
    await Promise.all(loadDates.map((d) => getOptionsData(d)))
  ).filter(Boolean) as OptionsData[];
  const latest = await getOptionsData();
  if (latest && !loadDates.includes(latest.date)) scans.unshift(latest);
  const scanStats = aggregateScanStats(scans);

  // P&L data from tracker
  const summary   = outcomes?.summary;
  const positions = outcomes?.positions ?? [];

  const openPositions   = positions.filter((p) => p.status === "open").slice(0, 20);
  const closedPositions = positions.filter((p) => p.status !== "open");
  const topWinners = [...closedPositions]
    .filter((p) => (p.pnl_pct ?? -999) > 0)
    .sort((a, b) => (b.pnl_pct ?? 0) - (a.pnl_pct ?? 0))
    .slice(0, 5);
  const topLosers = [...closedPositions]
    .filter((p) => (p.pnl_pct ?? 1) <= 0)
    .sort((a, b) => (a.pnl_pct ?? 0) - (b.pnl_pct ?? 0))
    .slice(0, 5);

  const sortedModes = Object.entries(scanStats.byMode)
    .sort((a, b) => b[1].count - a[1].count);
  const maxModeCount = sortedModes[0]?.[1].count ?? 1;

  const sortedTickers = Object.entries(scanStats.topTickers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const maxTickerCount = sortedTickers[0]?.[1] ?? 1;

  const hasPnL = summary && (summary.closed ?? 0) > 0;
  const hasOpen = openPositions.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/options" className="hover:text-white transition-colors">Options</Link>
          <span>/</span>
          <span className="text-white">Performance</span>
        </nav>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-1">
              Options Performance
            </h1>
            <p className="text-[#00d2ff] text-sm">
              {summary
                ? `${summary.total} tracked positions · updated ${new Date(outcomes!.updated_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} ET`
                : `${scanStats.totalPicks} picks from ${scanStats.totalScans} scans`}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/options/archive" className="px-4 py-2 bg-[#1e293b] border border-white/10 rounded-lg text-sm text-white hover:text-white transition-colors">
              📅 Archive
            </Link>
            <Link href="/options" className="px-4 py-2 bg-[#1e293b] border border-[#3b82f6]/30 rounded-lg text-sm text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors">
              📡 Today
            </Link>
          </div>
        </div>

        {/* ── SECTION 1: Live P&L ── */}
        {hasPnL ? (
          <>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-bold text-white">Live P&amp;L Dashboard</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#34d399]/10 text-[#34d399]">LIVE</span>
            </div>

            {/* Win rate ring + key metrics */}
            <div className="glass-card p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-5 items-center">
                <div className="col-span-2 md:col-span-1 flex justify-center">
                  <WinRateRing rate={summary!.win_rate} />
                </div>
                <StatCard label="Avg P&L" value={fmtPct(summary!.avg_pnl_pct)}
                  color={pnlColor(summary!.avg_pnl_pct)} />
                <StatCard label="Best Trade" value={fmtPct(summary!.best_trade_pct)}
                  color="text-[#34d399]" />
                <StatCard label="Worst Trade" value={fmtPct(summary!.worst_trade_pct)}
                  color="text-[#f87171]" />
                <StatCard label="Expectancy" value={summary!.expectancy != null ? fmtPct(summary!.expectancy) : "—"}
                  color={pnlColor(summary!.expectancy)}
                  sub="per trade avg" />
                <StatCard label="Avg Winner" value={fmtPct(summary!.avg_winner_pct)} color="text-[#34d399]" />
                <StatCard label="Avg Loser"  value={fmtPct(summary!.avg_loser_pct)}  color="text-[#f87171]" />
              </div>
            </div>

            {/* Status breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              {[
                { label: "Open",      val: summary!.open,       cls: "text-[#60a5fa]" },
                { label: "TP Hit",    val: summary!.tp_hit,     cls: "text-[#34d399]" },
                { label: "SL Hit",    val: summary!.sl_hit,     cls: "text-[#f87171]" },
                { label: "Time Stop", val: summary!.time_stop,  cls: "text-[#fbbf24]" },
                { label: "Expired",   val: summary!.expired,    cls: "text-white" },
                { label: "Total",     val: summary!.total,      cls: "text-white" },
              ].map((m) => (
                <div key={m.label} className="glass-card p-3 text-center">
                  <div className="text-[10px] text-[#00d2ff] uppercase mb-1">{m.label}</div>
                  <div className={`font-black text-xl ${m.cls}`}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Per-mode P&L */}
            {summary!.by_mode && Object.keys(summary!.by_mode).length > 0 && (
              <div className="glass-card p-6 mb-8">
                <h3 className="text-base font-bold text-white mb-5">P&amp;L by Entry Mode</h3>
                <div className="space-y-4">
                  {Object.entries(summary!.by_mode)
                    .sort((a, b) => (b[1].total ?? 0) - (a[1].total ?? 0))
                    .map(([mode, m]) => {
                      const meta = MODE_META[mode] ?? { icon: "📊", label: mode, color: "text-white", barColor: "bg-[#94a3b8]" };
                      const winRateVal = m.win_rate ?? 0;
                      return (
                        <div key={mode} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-semibold ${meta.color}`}>
                                {meta.icon} {meta.label}
                              </span>
                              <div className="flex items-center gap-4 text-xs text-[#00d2ff]">
                                <span>Win: <b className={winRateVal >= 50 ? "text-[#34d399]" : "text-[#f87171]"}>{m.win_rate != null ? m.win_rate + "%" : "—"}</b></span>
                                <span>Avg P&L: <b className={pnlColor(m.avg_pnl)}>{fmtPct(m.avg_pnl)}</b></span>
                                <span className="text-white font-bold">{m.total} trades</span>
                              </div>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${meta.barColor}`}
                                style={{ width: `${winRateVal}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        ) : (
          /* No closed trades yet — show pending notice */
          <div className="glass-card p-5 border-l-4 border-[#60a5fa] mb-8 flex items-start gap-3">
            <span className="text-2xl mt-0.5">⏳</span>
            <div>
              <div className="text-white font-bold mb-1">P&amp;L tracking active — no closed positions yet</div>
              <div className="text-[#00d2ff] text-sm">
                Positions are being tracked in real-time. P&amp;L stats will appear once trades hit TP, SL, or time stop.
                The tracker updates automatically after each daily scan.
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 2: Open Positions ── */}
        {hasOpen && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-white mb-4">
              Open Positions
              <span className="ml-2 text-[#00d2ff] text-sm font-normal">({openPositions.length})</span>
            </h2>
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[#00d2ff] text-[10px] uppercase tracking-wider">
                      <th className="py-3 px-3 text-left">Date</th>
                      <th className="py-3 px-3 text-left">Ticker</th>
                      <th className="py-3 px-3 text-left">Contract</th>
                      <th className="py-3 px-3 text-right">Entry</th>
                      <th className="py-3 px-3 text-right">Current</th>
                      <th className="py-3 px-3 text-right">Unrlzd P&L</th>
                      <th className="py-3 px-3 text-right">TP</th>
                      <th className="py-3 px-3 text-right">SL</th>
                      <th className="py-3 px-3 text-right">Days Held</th>
                      <th className="py-3 px-3 text-right">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPositions.map((p) => {
                      const meta = MODE_META[p.entry_mode] ?? { icon: "📊", label: p.entry_mode, color: "text-white", barColor: "" };
                      const unrlzd = p.unrealized_pnl_pct;
                      const daysLeft = p.time_stop_days != null && p.days_held != null
                        ? p.time_stop_days - p.days_held : null;
                      return (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 text-[#00d2ff] text-xs font-mono">{p.scan_date}</td>
                          <td className="py-3 px-3">
                            <Link href={`/stock/${p.ticker}`}
                              className="text-white font-black hover:text-[#3b82f6] transition-colors">
                              {p.ticker}
                            </Link>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.iv_vs_hv_label?.includes("UCUZ") && <span className="text-[8px] px-1 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 rounded">CHEAP</span>}
                              {p.higher_highs && <span className="text-[8px] px-1 bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 rounded">HH</span>}
                              {p.volume_spike && <span className="text-[8px] px-1 bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 rounded">VOL+</span>}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-white">
                            ${p.strike?.toFixed(0)}C · {p.expiration}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-white">
                            ${p.entry_premium?.toFixed(2) ?? "—"}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {p.current_premium != null
                              ? <span className="text-white">${p.current_premium.toFixed(2)}</span>
                              : <span className="text-[#00d2ff]">—</span>}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            <span className={pnlColor(unrlzd)}>{fmtPct(unrlzd)}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[#34d399] text-xs">
                            ${p.tp_target?.toFixed(2) ?? "—"}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[#f87171] text-xs">
                            ${p.sl_target?.toFixed(2) ?? "—"}
                          </td>
                          <td className="py-3 px-3 text-right text-xs">
                            <span className={`text-white`}>{p.days_held ?? 0}d</span>
                            {daysLeft != null && (
                              <span className={`ml-1 ${daysLeft <= 5 ? "text-[#fbbf24]" : "text-[#00d2ff]"}`}>
                                ({daysLeft}d left)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={`text-[10px] font-bold ${meta.color}`}>
                              {meta.icon} {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 3: Best & Worst trades ── */}
        {(topWinners.length > 0 || topLosers.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {topWinners.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-base font-bold text-[#34d399] mb-4">🏆 Top Winners</h3>
                <div className="space-y-3">
                  {topWinners.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <Link href={`/stock/${p.ticker}`} className="text-white font-black hover:text-[#3b82f6]">
                          {p.ticker}
                        </Link>
                        <div className="text-[10px] text-[#00d2ff]">
                          ${p.strike?.toFixed(0)}C · {p.scan_date} · {p.exit_reason}
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          {p.iv_vs_hv_label && <span className="text-[8px] text-[#f59e0b]">{p.iv_vs_hv_label}</span>}
                          {p.rs_vs_spy_label && <span className="text-[8px] text-[#3b82f6]">{p.rs_vs_spy_label}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#34d399] font-black">{fmtPct(p.pnl_pct)}</div>
                        <div className="text-[10px] text-[#00d2ff]">${p.entry_premium?.toFixed(2)} → ${p.exit_premium?.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {topLosers.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-base font-bold text-[#f87171] mb-4">⚠️ Worst Trades</h3>
                <div className="space-y-3">
                  {topLosers.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <Link href={`/stock/${p.ticker}`} className="text-white font-black hover:text-[#3b82f6]">
                          {p.ticker}
                        </Link>
                        <div className="text-[10px] text-[#00d2ff]">
                          ${p.strike?.toFixed(0)}C · {p.scan_date} · {p.exit_reason}
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          {p.iv_vs_hv_label && <span className="text-[8px] text-[#f59e0b]">{p.iv_vs_hv_label}</span>}
                          {p.rs_vs_spy_label && <span className="text-[8px] text-[#3b82f6]">{p.rs_vs_spy_label}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#f87171] font-black">{fmtPct(p.pnl_pct)}</div>
                        <div className="text-[10px] text-[#00d2ff]">${p.entry_premium?.toFixed(2)} → ${p.exit_premium?.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 4: Signal Quality Analytics ── */}
        <div className="mb-3">
          <h2 className="text-lg font-bold text-white">Signal Quality Analytics</h2>
          <p className="text-[#00d2ff] text-xs mt-1">Entry mode frequency, IV environment, regime distribution across all {scanStats.totalPicks} picks</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Scans" value={String(scanStats.totalScans)} color="text-[#3b82f6]" />
          <StatCard label="Total Picks" value={String(scanStats.totalPicks)} color="text-white" />
          <StatCard label="Avg Score" value={String(scanStats.avgScore)} color={scanStats.avgScore >= 60 ? "text-[#34d399]" : "text-[#fbbf24]"} />
          <StatCard label="Avg DTE" value={scanStats.avgDTE + "d"} color="text-[#a78bfa]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Entry mode breakdown */}
          <div className="glass-card p-6">
            <h3 className="text-base font-bold text-white mb-5">Entry Mode Frequency</h3>
            <div className="space-y-4">
              {sortedModes.map(([mode, m]) => {
                const meta = MODE_META[mode] ?? { icon: "📊", label: mode, color: "text-white", barColor: "bg-[#94a3b8]" };
                const pct = scanStats.totalPicks > 0 ? ((m.count / scanStats.totalPicks) * 100).toFixed(0) : "0";
                return (
                  <BarRow
                    key={mode}
                    label={<span className={`font-semibold ${meta.color}`}>{meta.icon} {meta.label}</span>}
                    value={m.count} max={maxModeCount} color={meta.barColor}
                    right={<>{m.count} <span className="text-[#00d2ff]">({pct}%)</span> · avg score {m.avgScore}</>}
                  />
                );
              })}
            </div>
          </div>

          {/* IV + regime */}
          <div className="space-y-5">
            <div className="glass-card p-6">
              <h3 className="text-base font-bold text-white mb-4">IV Rank Distribution</h3>
              <div className="space-y-3">
                {[
                  { label: "Cheap ≤20", val: scanStats.ivDist.cheap, color: "bg-[#34d399]", text: "text-[#34d399]" },
                  { label: "Normal 21–40", val: scanStats.ivDist.normal, color: "bg-[#fbbf24]", text: "text-[#fbbf24]" },
                  { label: "Rich >40", val: scanStats.ivDist.rich, color: "bg-[#f87171]", text: "text-[#f87171]" },
                ].map((row) => (
                  <BarRow key={row.label}
                    label={<span className={row.text}>{row.label}</span>}
                    value={row.val} max={scanStats.totalPicks} color={row.color}
                    right={row.val} />
                ))}
                <p className="text-[10px] text-[#00d2ff] pt-1">
                  Avg IV Rank: <b className="text-white">{scanStats.avgIVRank}</b> · Ideal buy zone: &lt;40
                </p>
              </div>
            </div>

            {/* Top recurring tickers */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-white mb-3">Most Frequent Tickers</h3>
              <div className="grid grid-cols-4 gap-2">
                {sortedTickers.map(([ticker, count]) => (
                  <Link key={ticker} href={`/stock/${ticker}`}
                    className="bg-[#0d1117] border border-white/10 rounded-lg p-2 text-center hover:border-[#3b82f6]/40 transition-all">
                    <div className="text-white text-xs font-black">{ticker}</div>
                    <div className="h-1 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-[#3b82f6] rounded-full"
                        style={{ width: `${(count / maxTickerCount) * 100}%` }} />
                    </div>
                    <div className="text-[#00d2ff] text-[10px] mt-1">{count}×</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="glass-card p-5 border-l-4 border-[#3b82f6] text-sm text-[#00d2ff]">
          <b className="text-white">P&amp;L Methodology:</b> Positions are opened at entry premium when the bot generates a pick.
          Status is updated by comparing current option mid-price vs TP/SL targets.
          <b className="text-white"> Time Stop</b> = DTE×0.65 days after entry.
          Prices fetched via yfinance · tracker runs automatically after each scan.
        </div>

      </main>
      <Footer />
    </div>
  );
}
