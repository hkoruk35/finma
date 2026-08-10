import { Metadata } from "next";
import EarningsBoard from "@/components/global/EarningsBoard";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "Bilançolar (Earnings) — BogaStock",
  en: "Earnings — BogaStock",
  es: "Resultados Financieros (Earnings) — BogaStock",
  fr: "Résultats Financiers (Earnings) — BogaStock",
  pt: "Resultados Financeiros (Earnings) — BogaStock",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "SEC EDGAR verilerine dayalı, yapay zekâ destekli kurumsal finansal tablo analizi.",
  en: "AI-powered corporate financial statement analysis based on SEC EDGAR data.",
  es: "Análisis de estados financieros corporativos impulsado por IA, basado en datos de SEC EDGAR.",
  fr: "Analyse des états financiers d'entreprise assistée par IA, basée sur les données de la SEC EDGAR.",
  pt: "Análise de demonstrações financeiras corporativas com IA, baseada em dados da SEC EDGAR.",
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
