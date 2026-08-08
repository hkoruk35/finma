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
} from "@/lib/indexSnapshots";
import { getArticleStructuredData, getBreadcrumbStructuredData } from "@/app/structured-data";

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
    narrative?.slice(0, 200) || `${name} ${t.dailyAnalysis} — ${date}`,
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
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
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
          <h1 className="text-2xl md:text-3xl font-normal text-white">
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
            <SnapshotSection snapshot={closingSnapshot} t={t} locale={locale} primary />
            {otherSnapshots.map((s) => (
              <SnapshotSection key={s.session} snapshot={s} t={t} locale={locale} />
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

function sessionLabel(session: IndexDailySnapshot["session"], t: ReturnType<typeof getT>) {
  if (session === "premarket") return t.sessionPremarket;
  if (session === "midday") return t.sessionMidday;
  return t.sessionClosing;
}

function getT(locale: Locale) {
  return copy[locale].indices;
}

function SnapshotSection({
  snapshot,
  t,
  locale,
  primary,
}: {
  snapshot: IndexDailySnapshot;
  t: ReturnType<typeof getT>;
  locale: Locale;
  primary?: boolean;
}) {
  const narrative = resolveNarrative(snapshot.ai_narrative, locale);
  const sectorLeaders =
    snapshot.sector_leaders && Array.isArray(snapshot.sector_leaders)
      ? (snapshot.sector_leaders as { name?: string; ticker?: string; change_pct?: number }[])
      : null;

  return (
    <section
      className={`rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-5 mb-4 ${
        primary ? "border-l-4 border-l-[#3b82f6]" : ""
      }`}
    >
      <h2 className="text-[11px] font-black text-[#3b82f6] uppercase tracking-widest mb-3">
        {t.session}: {sessionLabel(snapshot.session, t)}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label={t.close} value={snapshot.close?.toFixed(2) ?? "—"} />
        <Stat
          label={t.change}
          value={snapshot.change_pct != null ? `${snapshot.change_pct.toFixed(2)}%` : "—"}
          positive={snapshot.change_pct != null ? snapshot.change_pct >= 0 : undefined}
        />
        <Stat
          label={t.change1w}
          value={snapshot.change_pct_1w != null ? `${snapshot.change_pct_1w.toFixed(2)}%` : "—"}
          positive={snapshot.change_pct_1w != null ? snapshot.change_pct_1w >= 0 : undefined}
        />
        <Stat
          label={t.change20d}
          value={snapshot.change_pct_20d != null ? `${snapshot.change_pct_20d.toFixed(2)}%` : "—"}
          positive={snapshot.change_pct_20d != null ? snapshot.change_pct_20d >= 0 : undefined}
        />
        <Stat label="EMA20" value={snapshot.ema20?.toFixed(2) ?? "—"} />
        <Stat label="EMA50" value={snapshot.ema50?.toFixed(2) ?? "—"} />
        <Stat label="EMA200" value={snapshot.ema200?.toFixed(2) ?? "—"} />
        <Stat label={t.rsi} value={snapshot.rsi14?.toFixed(1) ?? "—"} />
        <Stat label={t.atr} value={snapshot.atr14?.toFixed(2) ?? "—"} />
        <Stat label={t.volatility} value={snapshot.volatility_20d != null ? `${snapshot.volatility_20d.toFixed(2)}%` : "—"} />
        <Stat
          label={t.distanceFrom20dHigh}
          value={snapshot.distance_from_20d_high_pct != null ? `${snapshot.distance_from_20d_high_pct.toFixed(2)}%` : "—"}
        />
        <Stat label={t.advancers} value={snapshot.advancers?.toString() ?? "—"} />
        <Stat label={t.decliners} value={snapshot.decliners?.toString() ?? "—"} />
        <Stat label={t.volume} value={snapshot.volume != null ? snapshot.volume.toLocaleString() : "—"} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="VIX" value={snapshot.vix?.toFixed(2) ?? "—"} />
        <Stat label="US10Y" value={snapshot.us10y != null ? `${snapshot.us10y.toFixed(2)}%` : "—"} />
        <Stat label="DXY" value={snapshot.dxy?.toFixed(2) ?? "—"} />
      </div>

      {sectorLeaders && sectorLeaders.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">{t.sectorLeaders}</p>
          <div className="flex flex-wrap gap-2">
            {sectorLeaders.map((leader, i) => (
              <span
                key={`${leader.ticker ?? leader.name ?? i}`}
                className="px-2.5 py-1 rounded-md bg-[#141924] border border-[#1e2a3a] text-xs text-slate-300"
              >
                {leader.name || leader.ticker}
                {leader.change_pct != null ? ` ${leader.change_pct >= 0 ? "+" : ""}${leader.change_pct.toFixed(2)}%` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {narrative && <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{narrative}</p>}
    </section>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? "text-white" : positive ? "text-[#3fb950]" : "text-[#f85149]";
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-mono font-bold ${color}`}>{value}</p>
    </div>
  );
}
