import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";
import { resolveNarrative, type IndexDailySnapshot, type IndexNarrativeFields } from "@/lib/indexSnapshots";
import { IndexStatTable } from "@/components/public/IndexStatTable";
import TickerHoverChart from "@/components/TickerHoverChart";
import { formatNumber } from "@/lib/formatNumber";

function getT(locale: Locale) {
  return copy[locale].indices;
}

function sessionLabel(session: IndexDailySnapshot["session"], t: ReturnType<typeof getT>) {
  if (session === "premarket") return t.sessionPremarket;
  if (session === "midday") return t.sessionMidday;
  return t.sessionClosing;
}

export function IndexDailySnapshotSection({
  snapshot,
  locale,
  primary,
}: {
  snapshot: IndexDailySnapshot;
  locale: Locale;
  primary?: boolean;
}) {
  const t = getT(locale);
  const narrative = resolveNarrative(snapshot.ai_narrative, locale);
  const sectorLeaders =
    snapshot.sector_leaders && Array.isArray(snapshot.sector_leaders)
      ? (snapshot.sector_leaders as { sector?: string; name?: string; ticker?: string; change_pct?: number }[])
      : null;

  type Mover = { ticker: string; name?: string; price?: number; change_pct?: number };
  const qs = snapshot.quant_snapshot as Record<string, unknown> | null;
  const topGainers = Array.isArray(qs?.top_gainers) ? (qs!.top_gainers as Mover[]) : [];
  const topLosers = Array.isArray(qs?.top_losers) ? (qs!.top_losers as Mover[]) : [];

  return (
    <section
      className={`rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-5 mb-4 ${
        primary ? "border-l-4 border-l-[#3b82f6]" : ""
      }`}
    >
      <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-wide mb-3">
        {t.session}: {sessionLabel(snapshot.session, t)}
      </h2>

      <IndexStatTable
        columns={2}
        items={[
          { label: t.close, value: formatNumber(snapshot.close, 2) ?? "—" },
          {
            label: t.change,
            value: snapshot.change_pct != null ? `${formatNumber(snapshot.change_pct, 2)}%` : "—",
            positive: snapshot.change_pct != null ? snapshot.change_pct >= 0 : undefined,
          },
          {
            label: t.change1w,
            value: snapshot.change_pct_1w != null ? `${formatNumber(snapshot.change_pct_1w, 2)}%` : "—",
            positive: snapshot.change_pct_1w != null ? snapshot.change_pct_1w >= 0 : undefined,
          },
          {
            label: t.change20d,
            value: snapshot.change_pct_20d != null ? `${formatNumber(snapshot.change_pct_20d, 2)}%` : "—",
            positive: snapshot.change_pct_20d != null ? snapshot.change_pct_20d >= 0 : undefined,
          },
          { label: "EMA20", value: formatNumber(snapshot.ema20, 2) ?? "—" },
          { label: "EMA50", value: formatNumber(snapshot.ema50, 2) ?? "—" },
          { label: "EMA200", value: formatNumber(snapshot.ema200, 2) ?? "—" },
          { label: t.rsi, value: formatNumber(snapshot.rsi14, 1) ?? "—" },
          { label: t.atr, value: formatNumber(snapshot.atr14, 2) ?? "—" },
          {
            label: t.volatility,
            value: snapshot.volatility_20d != null ? `${formatNumber(snapshot.volatility_20d, 2)}%` : "—",
          },
          {
            label: t.distanceFrom20dHigh,
            value:
              snapshot.distance_from_20d_high_pct != null
                ? `${formatNumber(snapshot.distance_from_20d_high_pct, 2)}%`
                : "—",
            positive:
              snapshot.distance_from_20d_high_pct != null ? snapshot.distance_from_20d_high_pct >= 0 : undefined,
          },
          { label: t.advancers, value: snapshot.advancers?.toString() ?? "—" },
          { label: t.decliners, value: snapshot.decliners?.toString() ?? "—" },
          { label: t.volume, value: snapshot.volume != null ? snapshot.volume.toLocaleString() : "—" },
        ]}
      />

      <IndexStatTable
        columns={3}
        items={[
          { label: "VIX", value: formatNumber(snapshot.vix, 2) ?? "—" },
          { label: "US10Y", value: snapshot.us10y != null ? `${formatNumber(snapshot.us10y, 2)}%` : "—" },
          { label: "DXY", value: formatNumber(snapshot.dxy, 2) ?? "—" },
        ]}
      />

      {sectorLeaders && sectorLeaders.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-2">{t.sectorLeaders}</p>
          <div className="flex flex-wrap gap-2">
            {sectorLeaders.map((leader, i) => (
              <span
                key={`${leader.sector ?? leader.ticker ?? leader.name ?? i}`}
                className="px-2.5 py-1 rounded-md bg-[#141924] border border-[#1e2a3a] text-xs text-slate-300"
              >
                {leader.ticker ? (
                  <TickerHoverChart ticker={leader.ticker} locale={locale}>
                    <Link
                      href={`/global/${locale}/analysis/${leader.ticker}`}
                      className="hover:text-[#00d2ff] transition-colors"
                    >
                      {leader.sector || leader.name || leader.ticker}
                    </Link>
                  </TickerHoverChart>
                ) : (
                  leader.sector || leader.name || leader.ticker
                )}
                {leader.change_pct != null ? (
                  <span className={leader.change_pct >= 0 ? "!text-[#3fb950]" : "!text-[#f85149]"}>
                    {" "}
                    {leader.change_pct >= 0 ? "+" : ""}
                    {formatNumber(leader.change_pct, 2)}%
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      )}

      {(topGainers.length > 0 || topLosers.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          {topGainers.length > 0 && (
            <MoverList title={t.topGainers} movers={topGainers} locale={locale} />
          )}
          {topLosers.length > 0 && (
            <MoverList title={t.topLosers} movers={topLosers} locale={locale} />
          )}
        </div>
      )}

      {narrative && <NarrativeBlock narrative={narrative} t={t} />}
    </section>
  );
}

function MoverList({ title, movers, locale }: { title: string; movers: { ticker: string; name?: string; price?: number; change_pct?: number }[]; locale: Locale }) {
  return (
    <div className="rounded-lg bg-[#141924] border border-[#1e2a3a] p-3">
      <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="divide-y divide-[#1e2a3a]">
        {movers.map((m) => (
          <div key={m.ticker} className="flex items-center justify-between py-1.5 text-sm">
            <span className="font-semibold text-slate-200">
              <TickerHoverChart ticker={m.ticker} locale={locale}>
                <Link
                  href={`/global/${locale}/analysis/${m.ticker}`}
                  className="hover:text-[#3b82f6] transition-colors"
                >
                  {m.name || m.ticker}
                </Link>
              </TickerHoverChart>
            </span>
            <span className="flex items-center gap-2 font-mono">
              {m.price != null ? <span className="text-slate-400">{formatNumber(m.price, 2)}</span> : null}
              {m.change_pct != null ? (
                <span className={m.change_pct >= 0 ? "!text-[#3fb950]" : "!text-[#f85149]"}>
                  {m.change_pct >= 0 ? "+" : ""}
                  {formatNumber(m.change_pct, 2)}%
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NarrativeBlock({ narrative, t }: { narrative: IndexNarrativeFields; t: ReturnType<typeof getT> }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300 leading-relaxed">{narrative.summary}</p>
      <NarrativeRow label={t.narrativeMarketDrivers} text={narrative.market_drivers} />
      <NarrativeRow label={t.narrativeTrendInterpretation} text={narrative.trend_interpretation} />
      <NarrativeRow label={t.narrativeRiskFactors} text={narrative.risk_factors} />
      <div className="grid sm:grid-cols-3 gap-3 pt-1">
        <ScenarioCard label={t.scenarioBullish} text={narrative.bullish_scenario} tone="bullish" />
        <ScenarioCard label={t.scenarioNeutral} text={narrative.neutral_scenario} tone="neutral" />
        <ScenarioCard label={t.scenarioRisk} text={narrative.risk_scenario} tone="risk" />
      </div>
    </div>
  );
}

function NarrativeRow({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
    </div>
  );
}

function ScenarioCard({ label, text, tone }: { label: string; text?: string; tone: "bullish" | "neutral" | "risk" }) {
  if (!text) return null;
  const toneClass =
    tone === "bullish" ? "border-l-[#3fb950]" : tone === "risk" ? "border-l-[#f85149]" : "border-l-slate-500";
  return (
    <div className={`rounded-lg bg-[#141924] border border-[#1e2a3a] border-l-4 ${toneClass} p-3`}>
      <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xs text-slate-300 leading-relaxed">{text}</p>
    </div>
  );
}
