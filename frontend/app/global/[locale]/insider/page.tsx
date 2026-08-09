import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import InsiderTransactionGrid from "@/components/public/InsiderTransactionGrid";
import { getTopInsiderBuyers } from "@/lib/insider-data";
import { copy, type Locale } from "@/lib/i18n/copy";
import { INDEX_LOCALES } from "@/lib/indices";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  return INDEX_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = copy[locale].insider;
  const languages: Record<string, string> = {};
  for (const l of INDEX_LOCALES) languages[l] = `https://bogastock.com/global/${l}/insider`;
  return {
    title: `${t.title} | BogaStock`,
    description: t.subtitle,
    alternates: { canonical: `https://bogastock.com/global/${locale}/insider`, languages },
  };
}

export default async function InsiderPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = copy[locale].insider;

  // Sitede en son 30 gunde raporlanmis, tum ticker'lardaki INSIDER ALIM
  // (BUY) islemleri — SEC Form 4 verisinden (bkz. lib/insider-data.ts).
  const transactions = await getTopInsiderBuyers(30, 150);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-7xl mx-auto w-full py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-slate-400">{t.subtitle}</p>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-8 text-center">
            <p className="text-slate-400">{t.noData}</p>
          </div>
        ) : (
          <InsiderTransactionGrid data={transactions} locale={locale} />
        )}

        <div className="mt-10 pt-6 border-t border-slate-800/50 text-xs text-slate-500 space-y-1.5">
          <p>{t.dataSource}</p>
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
