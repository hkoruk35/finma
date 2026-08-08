import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { copy, type Locale } from "@/lib/i18n/copy";
import { getIndexBySlug, INDEX_LIST, INDEX_LOCALES } from "@/lib/indices";
import { getWeeklyArchiveList } from "@/lib/indexSnapshots";

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
  const t = copy[locale].indices;
  const name = indexDef.names[locale];

  const languages: Record<string, string> = {};
  for (const l of INDEX_LOCALES) {
    languages[l] = `https://bogastock.com/global/${l}/${indexSlug}/weekly`;
  }

  return {
    title: `${name} — ${t.weeklyArchive} | BOGASTOCK`,
    description: `${name} ${t.weeklyArchive}`,
    alternates: {
      canonical: `https://bogastock.com/global/${locale}/${indexSlug}/weekly`,
      languages,
    },
  };
}

export default async function IndexWeeklyArchivePage({ params }: Props) {
  const { locale, indexSlug } = await params;
  const indexDef = getIndexBySlug(indexSlug);
  if (!isLocale(locale) || !indexDef) notFound();

  const t = copy[locale].indices;
  const name = indexDef.names[locale];
  const weeks = await getWeeklyArchiveList(indexDef.symbol, 26);

  return (
    <div lang={locale} className="min-h-screen flex flex-col bg-[#0a0e17]">
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
          <span className="text-white">{t.weeklyArchive}</span>
        </nav>

        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight mb-1">
          {name} — {t.weeklyArchive}
        </h1>
        <p className="text-xs text-slate-500 mb-6">{t.showingRecent}</p>

        {weeks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {weeks.map((w) => (
              <Link
                key={w.week_label}
                href={`/global/${locale}/${indexSlug}/weekly/${w.week_label.toLowerCase()}`}
                className="px-3 py-1.5 rounded-lg border border-[#1e2a3a] text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 transition-all"
              >
                {w.week_label}
                {w.change_pct_week != null && (
                  <span className={w.change_pct_week >= 0 ? "text-[#3fb950] ml-1" : "text-[#f85149] ml-1"}>
                    {w.change_pct_week >= 0 ? "+" : ""}
                    {w.change_pct_week.toFixed(2)}%
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t.noArchiveYet}</p>
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
