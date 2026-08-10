import { Metadata } from "next";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { copy, type Locale } from "@/lib/i18n/copy";
import { INDEX_LOCALES } from "@/lib/indices";
import { getBreadcrumbStructuredData } from "@/app/structured-data";
import ScheduleClient from "@/components/global/ScheduleClient";

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
  const t = copy[locale].schedule;

  const languages: Record<string, string> = {};
  for (const l of INDEX_LOCALES) {
    languages[l] = `https://bogastock.com/global/${l}/markets/schedule`;
  }

  return {
    title: `${t.pageTitle} | BOGASTOCK`,
    description: t.pageDescription,
    alternates: {
      canonical: `https://bogastock.com/global/${locale}/markets/schedule`,
      languages,
    },
    openGraph: {
      title: `${t.pageTitle} | BOGASTOCK`,
      description: t.pageDescription,
      url: `https://bogastock.com/global/${locale}/markets/schedule`,
      images: [{ url: "https://bogastock.com/logo/boga_stock_icon.png", width: 1200, height: 630 }],
    },
  };
}

export default async function SchedulePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return <div>Invalid locale</div>;
  }
  const t = copy[locale].schedule;
  const m = copy[locale].indices;

  const breadcrumbJsonLd = getBreadcrumbStructuredData([
    { name: "BOGASTOCK", url: "https://bogastock.com" },
    { name: m.breadcrumbMarkets, url: `https://bogastock.com/global/${locale}/markets` },
    { name: t.breadcrumb, url: `https://bogastock.com/global/${locale}/markets/schedule` },
  ]);

  return (
    <div lang={locale} className="min-h-screen flex flex-col bg-[#0a0e17]">
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
          <Link href={`/global/${locale}/markets`} className="hover:text-white transition-colors">
            {m.breadcrumbMarkets}
          </Link>
          <span className="opacity-30">/</span>
          <span className="text-white">{t.breadcrumb}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-2">
          {t.pageTitle}
        </h1>
        <p className="text-sm text-slate-400 mb-8 max-w-2xl">{t.pageDescription}</p>

        {/* Dynamic Interactive Schedule */}
        <ScheduleClient locale={locale} />
      </main>

      <Footer locale={locale} />
    </div>
  );
}
