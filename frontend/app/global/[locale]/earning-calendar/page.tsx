import { Metadata } from "next";
import EarningsCalendarBoard from "@/components/global/EarningsCalendarBoard";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "Bilanço Takvimi (Earnings Calendar) — BogaStock",
  en: "Earnings Calendar — BogaStock",
  es: "Calendario de Resultados (Earnings Calendar) — BogaStock",
  fr: "Calendrier des Résultats (Earnings Calendar) — BogaStock",
  pt: "Calendário de Resultados (Earnings Calendar) — BogaStock",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "Önümüzdeki günlerde bilanço açıklaması bekelenen şirketlerin tarihleri ve analist EPS/Gelir tahminleri.",
  en: "Upcoming earnings report dates for tracked companies, with analyst EPS and revenue estimates.",
  es: "Próximas fechas de resultados financieros de empresas seguidas, con estimaciones de EPS e ingresos de analistas.",
  fr: "Prochaines dates de résultats financiers des entreprises suivies, avec estimations du BPA et du chiffre d'affaires par les analystes.",
  pt: "Próximas datas de resultados financeiros de empresas monitoradas, com estimativas de LPA e receita dos analistas.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  const canonical = `https://bogastock.com/global/${loc}/earning-calendar`;
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

export default async function EarningCalendarPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }
  return <EarningsCalendarBoard locale={locale as Locale} />;
}
