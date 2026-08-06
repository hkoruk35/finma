import { Metadata } from "next";
import EarningsBoard from "@/components/global/EarningsBoard";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "Bilançolar (Earnings) — BogaStock AI",
  en: "Earnings — BogaStock AI",
  es: "Resultados Financieros (Earnings) — BogaStock AI",
  fr: "Résultats Financiers (Earnings) — BogaStock AI",
  pt: "Resultados Financeiros (Earnings) — BogaStock AI",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "SEC EDGAR bildirimlerine dayalı, yapay zekâ destekli günlük/haftalık/aylık bilanço analizleri.",
  en: "AI-powered daily, weekly, and monthly earnings analysis sourced directly from SEC EDGAR filings.",
  es: "Análisis de resultados financieros diarios, semanales y mensuales impulsados por IA, basados en presentaciones de SEC EDGAR.",
  fr: "Analyses de résultats financiers quotidiennes, hebdomadaires et mensuelles alimentées par l'IA, basées sur les dépôts SEC EDGAR.",
  pt: "Análises de resultados financeiros diários, semanais e mensais com IA, baseadas em registros da SEC EDGAR.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  const canonical = `https://bogastock.com/global/${loc}/earning`;
  return {
    title: TITLES[loc],
    description: DESCRIPTIONS[loc],
    alternates: { canonical },
    openGraph: {
      title: TITLES[loc],
      description: DESCRIPTIONS[loc],
      url: canonical,
      siteName: "BOGASTOCK Terminal",
      locale: loc,
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function EarningPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }
  return <EarningsBoard locale={locale as Locale} />;
}
