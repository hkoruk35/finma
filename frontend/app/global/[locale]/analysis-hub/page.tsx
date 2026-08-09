import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import type { Locale } from "@/lib/i18n/copy";
import { INDEX_LOCALES } from "@/lib/indices";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  return INDEX_LOCALES.map((locale) => ({ locale }));
}

const T: Record<Locale, { title: string; subtitle: string; cards: { title: string; desc: string; href: string }[] }> = {
  tr: {
    title: "Analizler",
    subtitle: "BogaStock'un tüm piyasa analizi türlerine tek yerden ulaş.",
    cards: [
      { title: "Markets", desc: "Global endeksler ve varlık sınıflarına genel bakış.", href: "/markets" },
      { title: "Sektör Analizleri", desc: "GICS sektörlerine göre performans ve rotasyon.", href: "/sectors" },
      { title: "Sektör Isı Haritası", desc: "Sektörlerin günlük/haftalık ısı haritası görünümü.", href: "/sectors" },
      { title: "Stock Analizleri", desc: "AI destekli, trend ve hacim odaklı hisse analizleri.", href: "/news" },
      { title: "Döviz Analizleri", desc: "Majör döviz paritelerine genel bakış.", href: "/home" },
      { title: "Emtia Analizleri", desc: "Altın, gümüş, ham petrol ve doğal gaz görünümü.", href: "/home" },
      { title: "Kripto Analizleri", desc: "Bitcoin, Ethereum ve diğer kripto varlıklar.", href: "/home" },
      { title: "Vadeliler Analizleri", desc: "Vadeli işlem piyasası görünümü.", href: "/home" },
    ],
  },
  en: {
    title: "Analysis",
    subtitle: "Access all of BogaStock's market analysis types in one place.",
    cards: [
      { title: "Markets", desc: "Overview of global indices and asset classes.", href: "/markets" },
      { title: "Sector Analyses", desc: "Performance and rotation across GICS sectors.", href: "/sectors" },
      { title: "Sector Heat Map", desc: "Daily/weekly sector heat map view.", href: "/sectors" },
      { title: "Stock Analyses", desc: "AI-driven stock analyses focused on trend and volume.", href: "/news" },
      { title: "Forex Analyses", desc: "Overview of major currency pairs.", href: "/home" },
      { title: "Commodity Analyses", desc: "Gold, silver, crude oil and natural gas outlook.", href: "/home" },
      { title: "Crypto Analyses", desc: "Bitcoin, Ethereum and other crypto assets.", href: "/home" },
      { title: "Futures Analyses", desc: "Futures market outlook.", href: "/home" },
    ],
  },
  es: {
    title: "Análisis",
    subtitle: "Accede a todos los tipos de análisis de mercado de BogaStock en un solo lugar.",
    cards: [
      { title: "Markets", desc: "Panorama de índices globales y clases de activos.", href: "/markets" },
      { title: "Análisis Sectorial", desc: "Rendimiento y rotación por sectores GICS.", href: "/sectors" },
      { title: "Mapa de Calor Sectorial", desc: "Vista de mapa de calor diario/semanal por sector.", href: "/sectors" },
      { title: "Análisis de Acciones", desc: "Análisis de acciones impulsados por IA con foco en tendencia y volumen.", href: "/news" },
      { title: "Análisis de Divisas", desc: "Panorama de los principales pares de divisas.", href: "/home" },
      { title: "Análisis de Materias Primas", desc: "Panorama de oro, plata, petróleo y gas natural.", href: "/home" },
      { title: "Análisis de Cripto", desc: "Bitcoin, Ethereum y otros activos cripto.", href: "/home" },
      { title: "Análisis de Futuros", desc: "Panorama del mercado de futuros.", href: "/home" },
    ],
  },
  fr: {
    title: "Analyses",
    subtitle: "Accédez à tous les types d'analyses de marché de BogaStock au même endroit.",
    cards: [
      { title: "Markets", desc: "Aperçu des indices mondiaux et des classes d'actifs.", href: "/markets" },
      { title: "Analyses Sectorielles", desc: "Performance et rotation par secteurs GICS.", href: "/sectors" },
      { title: "Carte Sectorielle", desc: "Vue de la carte thermique sectorielle quotidienne/hebdomadaire.", href: "/sectors" },
      { title: "Analyses d'Actions", desc: "Analyses d'actions assistées par IA axées sur la tendance et le volume.", href: "/news" },
      { title: "Analyses Forex", desc: "Aperçu des principales paires de devises.", href: "/home" },
      { title: "Analyses de Matières Premières", desc: "Aperçu de l'or, l'argent, le pétrole et le gaz naturel.", href: "/home" },
      { title: "Analyses Crypto", desc: "Bitcoin, Ethereum et autres actifs crypto.", href: "/home" },
      { title: "Analyses de Futures", desc: "Aperçu du marché des futures.", href: "/home" },
    ],
  },
  pt: {
    title: "Análises",
    subtitle: "Acesse todos os tipos de análise de mercado da BogaStock em um só lugar.",
    cards: [
      { title: "Markets", desc: "Visão geral dos índices globais e classes de ativos.", href: "/markets" },
      { title: "Análises Setoriais", desc: "Desempenho e rotação entre setores GICS.", href: "/sectors" },
      { title: "Mapa de Calor Setorial", desc: "Visão do mapa de calor setorial diário/semanal.", href: "/sectors" },
      { title: "Análises de Ações", desc: "Análises de ações com IA focadas em tendência e volume.", href: "/news" },
      { title: "Análises de Câmbio", desc: "Visão geral dos principais pares de moedas.", href: "/home" },
      { title: "Análises de Commodities", desc: "Visão geral de ouro, prata, petróleo e gás natural.", href: "/home" },
      { title: "Análises de Cripto", desc: "Bitcoin, Ethereum e outros ativos cripto.", href: "/home" },
      { title: "Análises de Futuros", desc: "Visão geral do mercado de futuros.", href: "/home" },
    ],
  },
};

export default async function AnalysisHubPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = T[locale];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-6xl mx-auto w-full py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-slate-400">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {t.cards.map((card, idx) => (
            <Link
              key={idx}
              href={`/global/${locale}${card.href}`}
              className="block p-5 rounded-xl border border-[#1e2a3a] bg-[#0f172a] hover:border-[#3b82f6]/60 hover:bg-[#131c2e] transition-all"
            >
              <h2 className="text-base font-semibold text-white mb-1.5">{card.title}</h2>
              <p className="text-xs text-slate-400">{card.desc}</p>
            </Link>
          ))}
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
