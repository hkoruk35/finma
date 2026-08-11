import { Metadata } from "next";
import AIContainer from "@/components/AIContainer";

const LOCALES = ["tr", "en", "es", "fr", "pt", "id"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "BogaSmart — Akıllı Arama",
  en: "BogaSmart — Smart Search",
  es: "BogaSmart — Búsqueda Inteligente",
  fr: "BogaSmart — Recherche Intelligente",
  pt: "BogaSmart — Busca Inteligente",
  id: "BogaSmart — Pencarian Cerdas",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "BogaSmart'a piyasalar, şirketler veya hisseler hakkında soru sorun; gerçek zamanlı verilerle desteklenen anında derin analiz alın.",
  en: "Ask BogaSmart about markets, companies, or stocks and get instant deep analysis backed by real-time data.",
  es: "Pregunta a BogaSmart sobre mercados, empresas o acciones y obtén un análisis profundo instantáneo respaldado por datos en tiempo real.",
  fr: "Posez vos questions à BogaSmart sur les marchés, les entreprises ou les actions et obtenez une analyse approfondie instantanée basée sur des données en temps réel.",
  pt: "Pergunte a BogaSmart sobre mercados, empresas ou ações e obtenha uma análise profunda instantânea com dados em tempo real.",
  id: "Tanyakan pada BogaSmart tentang pasar, perusahaan, atau saham dan dapatkan analisis mendalam instan yang didukung data real-time.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  return {
    title: TITLES[loc],
    description: DESCRIPTIONS[loc],
    alternates: { canonical: `https://bogasmart.com/global/${loc}/search` },
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
