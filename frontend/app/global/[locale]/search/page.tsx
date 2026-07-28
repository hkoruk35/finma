import { Metadata } from "next";
import AIContainer from "@/components/AIContainer";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "BOGA AI — Akıllı Arama",
  en: "BOGA AI — Smart Search",
  es: "BOGA AI — Búsqueda Inteligente",
  fr: "BOGA AI — Recherche Intelligente",
  pt: "BOGA AI — Busca Inteligente",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "BOGA AI'ya piyasalar, şirketler veya hisseler hakkında soru sorun; gerçek zamanlı verilerle desteklenen anında derin analiz alın.",
  en: "Ask BOGA AI about markets, companies, or stocks and get instant deep analysis backed by real-time data.",
  es: "Pregunta a BOGA AI sobre mercados, empresas o acciones y obtén un análisis profundo instantáneo respaldado por datos en tiempo real.",
  fr: "Posez vos questions à BOGA AI sur les marchés, les entreprises ou les actions et obtenez une analyse approfondie instantanée basée sur des données en temps réel.",
  pt: "Pergunte à BOGA AI sobre mercados, empresas ou ações e obtenha uma análise profunda instantânea com dados em tempo real.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  return {
    title: TITLES[loc],
    description: DESCRIPTIONS[loc],
    alternates: { canonical: `https://bogastock.com/global/${loc}/search` },
  };
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function SearchPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }
  const loc = locale as Locale;
  return <AIContainer lang={loc} locale={loc} variant="landing" />;
}
