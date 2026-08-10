import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { copy, type Locale } from "@/lib/i18n/copy";
import { getIndexBySlug, INDEX_LIST, INDEX_LOCALES } from "@/lib/indices";
import {
  getWeeklyArchiveList,
  getWeeklySnapshotByLabel,
  resolveNarrative,
} from "@/lib/indexSnapshots";
import { getArticleStructuredData, getBreadcrumbStructuredData } from "@/app/structured-data";
import { IndexStatTable } from "@/components/public/IndexStatTable";
import { formatNumber } from "@/lib/formatNumber";

export const revalidate = 900;

type Props = {
  params: Promise<{ locale: string; indexSlug: string; week: string }>;
};

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  const params: { locale: string; indexSlug: string; week: string }[] = [];
  for (const idx of INDEX_LIST) {
    const weeks = await getWeeklyArchiveList(idx.symbol, 26);
    for (const locale of INDEX_LOCALES) {
      for (const w of weeks) {
        params.push({ locale, indexSlug: idx.slug, week: w.week_label.toLowerCase() });
      }
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, indexSlug, week } = await params;
  const indexDef = getIndexBySlug(indexSlug);
  if (!isLocale(locale) || !indexDef) return {};
  const t = copy[locale].indices;
  const name = indexDef.names[locale];

  const languages: Record<string, string> = {};
  for (const l of INDEX_LOCALES) {
    languages[l] = `https://bogastock.com/global/${l}/${indexSlug}/weekly/${week}`;
  }

  return {
    title: `${name} ${t.weeklyAnalysis} — ${week} | BOGASTOCK`,
    description: `${name} ${t.weeklyAnalysis} — ${week}`,
    alternates: {
      canonical: `https://bogastock.com/global/${locale}/${indexSlug}/weekly/${week}`,
      languages,
    },
    openGraph: {
      title: `${name} ${t.weeklyAnalysis} — ${week}`,
      description: `${name} ${t.weeklyAnalysis} — ${week}`,
      url: `https://bogastock.com/global/${locale}/${indexSlug}/weekly/${week}`,
      images: [{ url: "https://bogastock.com/logo/boga_stock_icon.png", width: 1200, height: 630 }],
    },
  };
}

export default async function IndexWeeklyDetailPage({ params }: Props) {
  const { locale, indexSlug, week } = await params;
  const indexDef = getIndexBySlug(indexSlug);
  if (!isLocale(locale) || !indexDef) notFound();

  const t = copy[locale].indices;
  const name = indexDef.names[locale];

  const [snapshot, allWeeks] = await Promise.all([
    getWeeklySnapshotByLabel(indexDef.symbol, week),
    getWeeklyArchiveList(indexDef.symbol, 400),
  ]);

  const weekIdx = allWeeks.findIndex((w) => w.week_label.toLowerCase() === week.toLowerCase());
  const nextWeek = weekIdx > 0 ? allWeeks[weekIdx - 1] : null;
  const prevWeek = weekIdx >= 0 && weekIdx < allWeeks.length - 1 ? allWeeks[weekIdx + 1] : null;

  const narrative = snapshot ? resolveNarrative(snapshot.ai_narrative, locale) : null;

  const articleJsonLd = getArticleStructuredData(
    `${name} ${t.weeklyAnalysis} — ${week}`,
    narrative?.summary?.slice(0, 200) || `${name} ${t.weeklyAnalysis} — ${week}`,
    snapshot?.week_start || week
  );
  const breadcrumbJsonLd = getBreadcrumbStructuredData([
    { name: "BOGASTOCK", url: "https://bogastock.com" },
    { name: t.breadcrumbMarkets, url: `https://bogastock.com/global/${locale}/markets` },
    { name, url: `https://bogastock.com/global/${locale}/${indexSlug}` },
    { name: t.weeklyArchive, url: `https://bogastock.com/global/${locale}/${indexSlug}/weekly` },
    { name: week, url: `https://bogastock.com/global/${locale}/${indexSlug}/weekly/${week}` },
  ]);

  const scenarios = narrative
    ? {
        bullish: narrative.bullish_scenario,
        neutral: narrative.neutral_scenario,
        risk: narrative.risk_scenario,
      }
    : null;
  const keyLevels =
    snapshot?.key_levels && Array.isArray(snapshot.key_levels)
      ? (snapshot.key_levels as { label?: string; level?: number }[])
      : null;
  const macroCalendar =
    snapshot?.macro_calendar && Array.isArray(snapshot.macro_calendar)
      ? (snapshot.macro_calendar as { date?: string; event?: string }[])
      : null;

  return (
    <div lang={locale} className="min-h-screen flex flex-col bg-[#0a0e17]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-4 flex-wrap">
          <Link href={`/global/${locale}/home`} className="hover:text-[#3b82f6] transition-colors">
            BOGASTOCK
          </Link>
          <span className="opacity-30">/</span>
          <Link href={`/global/${locale}/markets`} className="hover:text-[#3b82f6] transition-colors">
            {t.breadcrumbMarkets}
          </Link>
          <span className="opacity-30">/</span>
          <Link href={`/global/${locale}/${indexSlug}`} className="hover:text-[#3b82f6] transition-colors">
            {name}
          </Link>
          <span className="opacity-30">/</span>
          <Link href={`/global/${locale}/${indexSlug}/weekly`} className="hover:text-[#3b82f6] transition-colors">
            {t.weeklyArchive}
          </Link>
          <span className="opacity-30">/</span>
          <span className="text-white">{week}</span>
        </nav>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold !text-[#3b82f6] tracking-tight">
            {name} {t.weeklyAnalysis} — {t.weekOf} {week}
          </h1>
          <div className="flex gap-2">
            {prevWeek ? (
              <Link
                href={`/global/${locale}/${indexSlug}/weekly/${prevWeek.week_label.toLowerCase()}`}
                className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 transition-all"
              >
                ← {t.prevWeek}
              </Link>
            ) : null}
            {nextWeek ? (
              <Link
                href={`/global/${locale}/${indexSlug}/weekly/${nextWeek.week_label.toLowerCase()}`}
                className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 transition-all"
              >
                {t.nextWeek} →
              </Link>
            ) : null}
          </div>
        </div>

        {!snapshot ? (
          <p className="text-sm text-slate-500">{t.noAnalysisYet}</p>
        ) : (
          <>
            <section className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-5 mb-4 border-l-4 border-l-[#3b82f6]">
              <IndexStatTable
                columns={2}
                items={[
                  { label: t.close, value: formatNumber(snapshot.close, 2) ?? "—" },
                  {
                    label: t.change,
                    value: snapshot.change_pct_week != null ? `${formatNumber(snapshot.change_pct_week, 2)}%` : "—",
                    positive: snapshot.change_pct_week != null ? snapshot.change_pct_week >= 0 : undefined,
                  },
                  { label: t.trendStrength, value: snapshot.trend_strength ?? "—" },
                  { label: t.volatilityRegime, value: snapshot.volatility_regime ?? "—" },
                  {
                    label: t.breadthChange,
                    value: snapshot.breadth_change != null ? formatNumber(snapshot.breadth_change, 2) : "—",
                    positive: snapshot.breadth_change != null ? snapshot.breadth_change >= 0 : undefined,
                  },
                  { label: t.priorWeekAccuracy, value: snapshot.prior_week_outlook_accuracy ?? "—" },
                ]}
              />

              {narrative && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300 leading-relaxed">{narrative.summary}</p>
                  {narrative.market_drivers && (
                    <div>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">{t.narrativeMarketDrivers}</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{narrative.market_drivers}</p>
                    </div>
                  )}
                  {narrative.trend_interpretation && (
                    <div>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">{t.narrativeTrendInterpretation}</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{narrative.trend_interpretation}</p>
                    </div>
                  )}
                  {narrative.risk_factors && (
                    <div>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">{t.narrativeRiskFactors}</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{narrative.risk_factors}</p>
                    </div>
                  )}
                  {narrative.prior_week_accuracy && (
                    <div>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">{t.priorWeekAccuracy}</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{narrative.prior_week_accuracy}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {scenarios && (scenarios.bullish || scenarios.neutral || scenarios.risk) && (
              <section className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-5 mb-4">
                <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-wide mb-3">
                  {t.scenarios}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {scenarios.bullish && (
                    <div>
                      <p className="text-[11px] text-[#3fb950] uppercase tracking-wide mb-1">{t.scenarioBullish}</p>
                      <p className="text-sm text-slate-300">{scenarios.bullish}</p>
                    </div>
                  )}
                  {scenarios.neutral && (
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">{t.scenarioNeutral}</p>
                      <p className="text-sm text-slate-300">{scenarios.neutral}</p>
                    </div>
                  )}
                  {scenarios.risk && (
                    <div>
                      <p className="text-[11px] text-[#f85149] uppercase tracking-wide mb-1">{t.scenarioRisk}</p>
                      <p className="text-sm text-slate-300">{scenarios.risk}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {keyLevels && keyLevels.length > 0 && (
              <section className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-5 mb-4">
                <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-wide mb-3">
                  {t.keyLevels}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {keyLevels.map((kl, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-md bg-[#141924] border border-[#1e2a3a] text-xs text-slate-300"
                    >
                      {kl.label}: {kl.level}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {macroCalendar && macroCalendar.length > 0 && (
              <section className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-5 mb-4">
                <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-wide mb-3">
                  {t.macroCalendar}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {macroCalendar.map((ev, i) => (
                    <p key={i} className="text-sm text-slate-300">
                      <span className="text-slate-500">{ev.date}</span> — {ev.event}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-[#1e2a3a]/60 pt-6">
          <Link
            href={`/global/${locale}/${indexSlug}`}
            className="text-xs font-semibold text-[#00d2ff] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span aria-hidden="true">←</span> {t.backToIndex}
          </Link>
          <Link
            href={`/global/${locale}/markets/schedule`}
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {(copy[locale as Locale].schedule as any).viewSchedule || "View Analysis Schedule"}
          </Link>
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
