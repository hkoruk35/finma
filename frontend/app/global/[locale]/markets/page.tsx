import { Metadata } from "next";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { copy, type Locale } from "@/lib/i18n/copy";
import { getIndicesByRegion, INDEX_LOCALES } from "@/lib/indices";
import { getBreadcrumbStructuredData } from "@/app/structured-data";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  return INDEX_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = copy[locale].indices;

  const languages: Record<string, string> = {};
  for (const l of INDEX_LOCALES) {
    languages[l] = `https://bogastock.com/global/${l}/markets`;
  }

  return {
    title: `${t.pageTitle} | BOGASTOCK`,
    description: t.pageDescription,
    alternates: {
      canonical: `https://bogastock.com/global/${locale}/markets`,
      languages,
    },
    openGraph: {
      title: `${t.pageTitle} | BOGASTOCK`,
      description: t.pageDescription,
      url: `https://bogastock.com/global/${locale}/markets`,
      images: [{ url: "https://bogastock.com/logo/boga_stock_icon.png", width: 1200, height: 630 }],
    },
  };
}

export default async function IndexLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return <div>Invalid locale</div>;
  }
  const t = copy[locale].indices;

  const usIndices = getIndicesByRegion("us");
  const europeIndices = getIndicesByRegion("europe");

  const breadcrumbJsonLd = getBreadcrumbStructuredData([
    { name: "BOGASTOCK", url: "https://bogastock.com" },
    { name: t.breadcrumbMarkets, url: `https://bogastock.com/global/${locale}/markets` },
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-4">
          <Link href={`/global/${locale}/home`} className="hover:text-[#3b82f6] transition-colors">
            BOGASTOCK
          </Link>
          <span className="opacity-30">/</span>
          <span className="text-white">{t.breadcrumbMarkets}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-normal text-white mb-2">{t.pageTitle}</h1>
        <p className="text-sm text-slate-400 mb-8 max-w-2xl">{t.pageDescription}</p>

        <section className="mb-10">
          <h2 className="text-[11px] font-black text-[#3b82f6] uppercase tracking-widest mb-3">
            {t.regionUS}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {usIndices.map((idx) => (
              <Link
                key={idx.symbol}
                href={`/global/${locale}/${idx.slug}`}
                className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-4 hover:border-[#3b82f6]/50 hover:bg-[#141b2a] transition-all"
              >
                <span className="text-sm font-bold text-white">{idx.names[locale]}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-black text-[#3b82f6] uppercase tracking-widest mb-3">
            {t.regionEurope}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {europeIndices.map((idx) => (
              <Link
                key={idx.symbol}
                href={`/global/${locale}/${idx.slug}`}
                className="rounded-xl bg-[#0d131f]/80 border border-[#1e2a3a] p-4 hover:border-[#3b82f6]/50 hover:bg-[#141b2a] transition-all"
              >
                <span className="text-sm font-bold text-white">{idx.names[locale]}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
