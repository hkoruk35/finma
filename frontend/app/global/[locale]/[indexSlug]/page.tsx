import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { copy, type Locale } from "@/lib/i18n/copy";
import { getIndexBySlug, getIndicesByRegion, INDEX_LIST, INDEX_LOCALES } from "@/lib/indices";
import { getBreadcrumbStructuredData } from "@/app/structured-data";
import {
  getLatestDailySnapshots,
  getLatestWeeklySnapshot,
  resolveNarrative,
} from "@/lib/indexSnapshots";
import { getMultiQuote } from "@/lib/homeFeed";
import { IndexStatTable } from "@/components/public/IndexStatTable";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import { IndexDailySnapshotSection } from "@/components/global/IndexDailySnapshotSection";
import { formatNumber } from "@/lib/formatNumber";
import { ClientTime } from "@/components/global/ClientTime";

export const revalidate = 900;

type Props = {
  params: Promise<{ locale: string; indexSlug: string }>;
};

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  const params: { locale: string; indexSlug: string }[] = [];
  for (const locale of INDEX_LOCALES) {
    for (const idx of INDEX_LIST) {
      params.push({ locale, indexSlug: idx.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, indexSlug } = await params;
  const indexDef = getIndexBySlug(indexSlug);
  if (!isLocale(locale) || !indexDef) return {};

  const name = indexDef.names[locale];
  const t = copy[locale].indices;

  const languages: Record<string, string> = {};
  for (const l of INDEX_LOCALES) {
    languages[l] = `https://bogastock.com/global/${l}/${indexSlug}`;
  }

  return {
    title: `${name} | ${t.dailyAnalysis} & ${t.weeklyAnalysis} | BOGASTOCK`,
    description: `${name} — ${t.pageDescription}`,
    alternates: {
      canonical: `https://bogastock.com/global/${locale}/${indexSlug}`,
      languages,
    },
    openGraph: {
      title: `${name} | BOGASTOCK`,
      description: `${name} — ${t.pageDescription}`,
      url: `https://bogastock.com/global/${locale}/${indexSlug}`,
      images: [{ url: "https://bogastock.com/logo/boga_stock_icon.png", width: 1200, height: 630 }],
    },
  };
}

export default async function IndexPage({ params }: Props) {
  const { locale, indexSlug } = await params;
  const indexDef = getIndexBySlug(indexSlug);
  if (!isLocale(locale) || !indexDef) notFound();

  const t = copy[locale].indices;
  const name = indexDef.names[locale];

  const [dailySnapshots, weeklySnapshot, quotes] = await Promise.all([
    getLatestDailySnapshots(indexDef.symbol),
    getLatestWeeklySnapshot(indexDef.symbol),
    getMultiQuote([indexDef.symbol]),
  ]);

  // Gelen veriler session sırasına (premarket -> midday -> closing) göre eskiden yeniye doğru sıralıdır.
  // Kullanıcı geçmişe yönelik (en yeni en üstte) görmek istediği için ters çeviriyoruz.
  const sortedSnapshots = [...dailySnapshots].reverse();
  const latestSnapshot = sortedSnapshots[0] ?? null;

  const liveQuote = quotes[indexDef.symbol];
  const relatedIndices = getIndicesByRegion(indexDef.region).filter((i) => i.symbol !== indexDef.symbol);

  const breadcrumbJsonLd = getBreadcrumbStructuredData([
    { name: "BOGASTOCK", url: "https://bogastock.com" },
    { name: t.breadcrumbMarkets, url: `https://bogastock.com/global/${locale}/markets` },
    { name, url: `https://bogastock.com/global/${locale}/${indexSlug}` },
  ]);

  const regionLabelMap = {
    us: t.regionUS,
    europe: t.regionEurope,
    asia: t.regionAsia,
    latam: t.regionLatam,
  } as const;
  const breadcrumbRegionLabelMap = {
    us: t.breadcrumbUS,
    europe: t.breadcrumbEurope,
    asia: t.breadcrumbAsia,
    latam: t.breadcrumbLatam,
  } as const;
  const regionLabel = regionLabelMap[indexDef.region];
  const breadcrumbRegionLabel = breadcrumbRegionLabelMap[indexDef.region];

  return (
    <div lang={locale} className="min-h-screen flex flex-col bg-[#0a0e17]">
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
          <span className="text-white">{breadcrumbRegionLabel}</span>
          <span className="opacity-30">/</span>
          <span className="text-white">{name}</span>
        </nav>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold text-white mb-1 tracking-tight">{name}</h1>
            <p className="text-xs text-slate-500">{regionLabel}</p>
          </div>
          {liveQuote && (
            <div className="text-right">
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">{t.currentPrice}</p>
              <p className="text-2xl font-mono font-bold text-white">{formatNumber(liveQuote.value, 2)}</p>
              <p
                className={`text-sm font-semibold font-mono ${
                  liveQuote.change_pct >= 0 ? "text-[#3fb950]" : "text-[#f85149]"
                }`}
              >
                {liveQuote.change_pct >= 0 ? "+" : ""}
                {formatNumber(liveQuote.change_pct, 2)}%
              </p>
            </div>
          )}
        </div>

        {/* 1D interaktif fiyat grafigi — /graphic/[ticker] sayfalarindaki ile
            ayni BogaChartEngine bileseni, ayni sembol (indexDef.symbol) ile
            dogrudan yeniden kullanilir; gorsel tutarlilik boylece garanti. */}
        <section className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-3 sm:p-4 mb-6 md:col-span-2">
          <div className="glass-card overflow-hidden" style={{ minHeight: 340 }}>
            <BogaChartEngine
              symbol={indexDef.symbol}
              lang={locale}
              height={340}
              defaultTimeframe="D"
              defaultCandleType="line"
            />
          </div>
        </section>

        {/* Daily analysis summary */}
        <section className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-wide">
              {t.dailyAnalysis}
            </h2>
            <Link
              href={`/global/${locale}/${indexSlug}/daily`}
              className="text-xs font-semibold text-[#00d2ff] hover:text-white transition-colors"
            >
              {t.dailyArchive} →
            </Link>
          </div>
          {sortedSnapshots.length > 0 ? (
            <>
              {sortedSnapshots.map((s) => (
                <IndexDailySnapshotSection
                  key={s.session}
                  snapshot={s}
                  locale={locale as Locale}
                  primary={s === latestSnapshot}
                />
              ))}
              
              <Link
                href={`/global/${locale}/${indexSlug}/daily/${latestSnapshot?.trade_date}`}
                className="inline-block mt-3 text-xs font-semibold text-[#00d2ff] hover:text-white transition-colors"
              >
                {t.viewFullDaily} ({latestSnapshot?.trade_date}) →
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">{t.noAnalysisYet}</p>
          )}
        </section>

        {/* Weekly analysis summary */}
        <section className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-wide">
              {t.weeklyAnalysis}
            </h2>
            <Link
              href={`/global/${locale}/${indexSlug}/weekly`}
              className="text-xs font-semibold text-[#00d2ff] hover:text-white transition-colors"
            >
              {t.weeklyArchive} →
            </Link>
          </div>
          {weeklySnapshot ? (
            <>
              <div className="mb-4 border-b border-[#1e2a3a] pb-3">
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-medium">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-[#00d2ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>NY: {new Intl.DateTimeFormat(locale, { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(weeklySnapshot.created_at))}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-[#38bdf8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>Local: <ClientTime timestamp={weeklySnapshot.created_at} lang={locale} /></span>
                  </div>
                </div>
              </div>
              <IndexStatTable
                columns={2}
                items={[
                  { label: t.close, value: formatNumber(weeklySnapshot.close, 2) ?? "—" },
                  {
                    label: t.change,
                    value:
                      weeklySnapshot.change_pct_week != null ? `${formatNumber(weeklySnapshot.change_pct_week, 2)}%` : "—",
                    positive: weeklySnapshot.change_pct_week != null ? weeklySnapshot.change_pct_week >= 0 : undefined,
                  },
                  { label: t.trendStrength, value: weeklySnapshot.trend_strength ?? "—" },
                  { label: t.volatilityRegime, value: weeklySnapshot.volatility_regime ?? "—" },
                ]}
              />
              {resolveNarrative(weeklySnapshot.ai_narrative, locale) && (
                <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">
                  {resolveNarrative(weeklySnapshot.ai_narrative, locale)?.summary}
                </p>
              )}
              <Link
                href={`/global/${locale}/${indexSlug}/weekly/${weeklySnapshot.week_label.toLowerCase()}`}
                className="inline-block mt-3 text-xs font-semibold text-[#00d2ff] hover:text-white transition-colors"
              >
                {t.viewFullWeekly} ({weeklySnapshot.week_label}) →
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">{t.noAnalysisYet}</p>
          )}
        </section>

        {relatedIndices.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-[#3b82f6] uppercase tracking-wide mb-3">
              {t.relatedMarkets}
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedIndices.map((idx) => (
                <Link
                  key={idx.symbol}
                  href={`/global/${locale}/${idx.slug}`}
                  className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 transition-all"
                >
                  {idx.names[locale]}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer locale={locale} />
    </div>
  );
}
