import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { copy, type Locale } from "@/lib/i18n/copy";
import { getIndexBySlug, INDEX_LIST, INDEX_LOCALES } from "@/lib/indices";
import {
  getDailyArchiveDates,
  getDailySnapshotsForDate,
  resolveNarrative,
  type IndexDailySnapshot,
  type IndexNarrativeFields,
} from "@/lib/indexSnapshots";
import { getArticleStructuredData, getBreadcrumbStructuredData } from "@/app/structured-data";
import { IndexStatTable } from "@/components/public/IndexStatTable";
import TickerHoverChart from "@/components/TickerHoverChart";
import { IndexDailySnapshotSection } from "@/components/global/IndexDailySnapshotSection";

export const revalidate = 900;

type Props = {
  params: Promise<{ locale: string; indexSlug: string; date: string }>;
};

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  const params: { locale: string; indexSlug: string; date: string }[] = [];
  for (const idx of INDEX_LIST) {
    const dates = await getDailyArchiveDates(idx.symbol, 60);
    for (const locale of INDEX_LOCALES) {
      for (const date of dates) {
        params.push({ locale, indexSlug: idx.slug, date });
      }
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, indexSlug, date } = await params;
  const indexDef = getIndexBySlug(indexSlug);
  if (!isLocale(locale) || !indexDef) return {};
  const t = copy[locale].indices;
  const name = indexDef.names[locale];

  const languages: Record<string, string> = {};
  for (const l of INDEX_LOCALES) {
    languages[l] = `https://bogastock.com/global/${l}/${indexSlug}/daily/${date}`;
  }

  return {
    title: `${name} ${t.dailyAnalysis} — ${date} | BOGASTOCK`,
    description: `${name} ${t.dailyAnalysis} — ${date}`,
    alternates: {
      canonical: `https://bogastock.com/global/${locale}/${indexSlug}/daily/${date}`,
      languages,
    },
    openGraph: {
      title: `${name} ${t.dailyAnalysis} — ${date}`,
      description: `${name} ${t.dailyAnalysis} — ${date}`,
      url: `https://bogastock.com/global/${locale}/${indexSlug}/daily/${date}`,
      images: [{ url: "https://bogastock.com/logo/boga_stock_icon.png", width: 1200, height: 630 }],
    },
  };
}

export default async function IndexDailyDetailPage({ params }: Props) {
  const { locale, indexSlug, date } = await params;
  const indexDef = getIndexBySlug(indexSlug);
  if (!isLocale(locale) || !indexDef) notFound();

  const t = copy[locale].indices;
  const name = indexDef.names[locale];

  const [snapshots, allDates] = await Promise.all([
    getDailySnapshotsForDate(indexDef.symbol, date),
    getDailyArchiveDates(indexDef.symbol, 400),
  ]);

  const dateIdx = allDates.indexOf(date);
  // allDates en yeniden eskiye siralanmis: bir onceki index -> daha yeni tarih (next), bir sonraki -> daha eski (prev)
  const nextDate = dateIdx > 0 ? allDates[dateIdx - 1] : null;
  const prevDate = dateIdx >= 0 && dateIdx < allDates.length - 1 ? allDates[dateIdx + 1] : null;

  const closingSnapshot =
    snapshots.find((s) => s.session === "closing") ?? snapshots[snapshots.length - 1] ?? null;
  const otherSnapshots = snapshots.filter((s) => s !== closingSnapshot);

  const narrative = closingSnapshot ? resolveNarrative(closingSnapshot.ai_narrative, locale) : null;

  const articleJsonLd = getArticleStructuredData(
    `${name} ${t.dailyAnalysis} — ${date}`,
    narrative?.summary?.slice(0, 200) || `${name} ${t.dailyAnalysis} — ${date}`,
    date
  );
  const breadcrumbJsonLd = getBreadcrumbStructuredData([
    { name: "BOGASTOCK", url: "https://bogastock.com" },
    { name: t.breadcrumbMarkets, url: `https://bogastock.com/global/${locale}/markets` },
    { name, url: `https://bogastock.com/global/${locale}/${indexSlug}` },
    { name: t.dailyArchive, url: `https://bogastock.com/global/${locale}/${indexSlug}/daily` },
    { name: date, url: `https://bogastock.com/global/${locale}/${indexSlug}/daily/${date}` },
  ]);

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
          <Link href={`/global/${locale}/${indexSlug}/daily`} className="hover:text-[#3b82f6] transition-colors">
            {t.dailyArchive}
          </Link>
          <span className="opacity-30">/</span>
          <span className="text-white">{date}</span>
        </nav>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold !text-[#3b82f6] tracking-tight">
            {name} {t.dailyAnalysis} — {date}
          </h1>
          <div className="flex gap-2">
            {prevDate ? (
              <Link
                href={`/global/${locale}/${indexSlug}/daily/${prevDate}`}
                className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 transition-all"
              >
                ← {t.prevDay}
              </Link>
            ) : null}
            {nextDate ? (
              <Link
                href={`/global/${locale}/${indexSlug}/daily/${nextDate}`}
                className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 transition-all"
              >
                {t.nextDay} →
              </Link>
            ) : null}
          </div>
        </div>

        {!closingSnapshot ? (
          <p className="text-sm text-slate-500">{t.noAnalysisYet}</p>
        ) : (
          <>
            <IndexDailySnapshotSection snapshot={closingSnapshot} locale={locale as Locale} primary />
            {otherSnapshots.map((s) => (
              <IndexDailySnapshotSection key={s.session} snapshot={s} locale={locale as Locale} />
            ))}
          </>
        )}

        <Link
          href={`/global/${locale}/${indexSlug}`}
          className="inline-block mt-8 text-xs font-semibold text-[#00d2ff] hover:text-white transition-colors"
        >
          ← {t.backToIndex}
        </Link>
      </main>

      <Footer locale={locale} />
    </div>
  );
}


