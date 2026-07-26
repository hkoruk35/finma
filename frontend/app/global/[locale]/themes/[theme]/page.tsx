import { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { getHotTheme, HOT_THEMES_2026, localizedThemeTitle } from "@/lib/hotThemes2026";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import ListsNavigation from "@/components/global/ListsNavigation";
import { getRealStockCardData } from "@/lib/copilot/stockData";
import { getAllTickers } from "@/lib/data";

export const revalidate = 300;

type Props = {
  params: Promise<{ locale: string; theme: string }>;
};

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

const THEME_DESCRIPTIONS: Record<string, Record<string, string>> = {
  "memory-producers-ai-storage": {
    tr: "AI ve veri merkezi boom'unun kilit altyapısı. HBM, NAND, bağlantı çipleri ve üretim ekipmanı liderleri.",
    en: "Critical infrastructure for AI and data center boom. Leaders in HBM, NAND, interconnect chips, and manufacturing equipment.",
    es: "Infraestructura crítica para el auge de IA y centros de datos. Líderes en HBM, NAND, chips de interconexión y equipo de fabricación.",
    fr: "Infrastructure critique pour le boom de l'IA et des centres de données. Chefs de file en HBM, NAND, puces d'interconnexion et équipement de fabrication.",
    pt: "Infraestrutura crítica para o boom de IA e data center. Líderes em HBM, NAND, chips de interconexão e equipamento de fabricação.",
  },
  "space": {
    tr: "Ticari uzay operasyonları, uydu haberleşme ve ay ekonomisinin yükselişi.",
    en: "Commercial space operations, satellite communications, and the rise of the lunar economy.",
    es: "Operaciones espaciales comerciales, comunicaciones satelitales y el auge de la economía lunar.",
    fr: "Opérations spatiales commerciales, communications par satellite et l'essor de l'économie lunaire.",
    pt: "Operações espaciais comerciais, comunicações por satélite e o surgimento da economia lunar.",
  },
  "physical-ai-humanoid-robots": {
    tr: "Optimus, endüstriyel robotlar, cerrahlar ve agentic otomasyon. Fiziksel dünyayı dönüştüren AI.",
    en: "Optimus, industrial robots, surgical systems, and agentic automation. AI transforming the physical world.",
    es: "Optimus, robots industriales, sistemas quirúrgicos y automatización agéntica. IA transformando el mundo físico.",
    fr: "Optimus, robots industriels, systèmes chirurgicaux et automatisation agentique. L'IA transformant le monde physique.",
    pt: "Optimus, robôs industriais, sistemas cirúrgicos e automação agêntica. IA transformando o mundo físico.",
  },
  "ai-defense-drones-autonomous": {
    tr: "ONDS, Palantir, drone sistemleri ve otonom savunma. Pentagon'un teknoloji seçimi.",
    en: "ONDS, Palantir, drone systems, and autonomous defense. Pentagon's technology choices.",
    es: "ONDS, Palantir, sistemas de drones y defensa autónoma. Las opciones tecnológicas del Pentágono.",
    fr: "ONDS, Palantir, systèmes de drones et défense autonome. Les choix technologiques du Pentagone.",
    pt: "ONDS, Palantir, sistemas de drones e defesa autônoma. As escolhas tecnológicas do Pentágono.",
  },
  "critical-minerals-rare-earth": {
    tr: "Nadir toprak, lityum, kritik madenler. Savunma ve EV batarya tedarik zincirinin omurgası.",
    en: "Rare earths, lithium, critical minerals. Backbone of defense and EV battery supply chains.",
    es: "Tierras raras, litio, minerales críticos. Columna vertebral de las cadenas de suministro de defensa y baterías de vehículos eléctricos.",
    fr: "Terres rares, lithium, minéraux critiques. Colonne vertébrale des chaînes d'approvisionnement de défense et de batterie de véhicules électriques.",
    pt: "Terras raras, lítio, minerais críticos. Espinha dorsal das cadeias de suprimento de defesa e bateria de veículos elétricos.",
  },
  "nuclear-energy-ai-power": {
    tr: "CEG, VST, NuScale. AI veri merkezlerinin elektrik ihtiyacını karşılayan nükleer.",
    en: "CEG, VST, NuScale. Nuclear meeting the power demands of AI data centers.",
    es: "CEG, VST, NuScale. Nuclear satisfaciendo las demandas de energía de los centros de datos de IA.",
    fr: "CEG, VST, NuScale. L'énergie nucléaire satisfaisant les demandes énergétiques des data centers IA.",
    pt: "CEG, VST, NuScale. Nuclear atendendo às demandas de energia dos data centers de IA.",
  },
  "quantum-computing": {
    tr: "IonQ, Rigetti, D-Wave. Kuantum bilişim pazarının erken öncüleri.",
    en: "IonQ, Rigetti, D-Wave. Early leaders in quantum computing market.",
    es: "IonQ, Rigetti, D-Wave. Primeros líderes en el mercado de computación cuántica.",
    fr: "IonQ, Rigetti, D-Wave. Premiers leaders du marché de l'informatique quantique.",
    pt: "IonQ, Rigetti, D-Wave. Primeiros líderes do mercado de computação quântica.",
  },
  "ai-agents-enterprise-software": {
    tr: "CoreWeave, Palantir, Microsoft, Oracle. Kurumsal yazılımı AI ajanlarıyla dönüştüren.",
    en: "CoreWeave, Palantir, Microsoft, Oracle. Transforming enterprise software with AI agents.",
    es: "CoreWeave, Palantir, Microsoft, Oracle. Transformando el software empresarial con agentes de IA.",
    fr: "CoreWeave, Palantir, Microsoft, Oracle. Transformation des logiciels d'entreprise avec des agents d'IA.",
    pt: "CoreWeave, Palantir, Microsoft, Oracle. Transformando software empresarial com agentes de IA.",
  },
  "ai-datacenter-cooling": {
    tr: "Vertiv, Arista, Broadcom, Equinix, SMCI. Hyperscale veri merkezlerinin altyapısı.",
    en: "Vertiv, Arista, Broadcom, Equinix, SMCI. Infrastructure of hyperscale data centers.",
    es: "Vertiv, Arista, Broadcom, Equinix, SMCI. Infraestructura de centros de datos de hiperescala.",
    fr: "Vertiv, Arista, Broadcom, Equinix, SMCI. Infrastructure des data centers hyperscale.",
    pt: "Vertiv, Arista, Broadcom, Equinix, SMCI. Infraestrutura de data centers em hiperescala.",
  },
  "post-quantum-cybersecurity": {
    tr: "CrowdStrike, Palo Alto, SentinelOne. Post-kuantum çağı için siber güvenlik.",
    en: "CrowdStrike, Palo Alto, SentinelOne. Cybersecurity for the post-quantum era.",
    es: "CrowdStrike, Palo Alto, SentinelOne. Ciberseguridad para la era post-cuántica.",
    fr: "CrowdStrike, Palo Alto, SentinelOne. Cybersécurité pour l'ère post-quantique.",
    pt: "CrowdStrike, Palo Alto, SentinelOne. Cibersegurança para a era pós-quântica.",
  },
  "physical-ai-semiconductor-ecosystem": {
    tr: "NVDA, AMD, Broadcom, Marvell, AEHR. Fiziksel AI'nin yarı iletken omurgası.",
    en: "NVDA, AMD, Broadcom, Marvell, AEHR. Semiconductor backbone of Physical AI.",
    es: "NVDA, AMD, Broadcom, Marvell, AEHR. Columna vertebral de semiconductores del IA Física.",
    fr: "NVDA, AMD, Broadcom, Marvell, AEHR. Épine dorsale des semiconducteurs de l'IA Physique.",
    pt: "NVDA, AMD, Broadcom, Marvell, AEHR. Espinha dorsal de semicondutores da IA Física.",
  },
  biotech: {
    tr: "Genomik, gen terapi, mRNA, hassas tıp. Biyoteknoloji yeni çağın gıdasıdır.",
    en: "Genomics, gene therapy, mRNA, precision medicine. Biotech is the food of the new age.",
    es: "Genómica, terapia génica, ARNm, medicina de precisión. La biotecnología es el alimento de la nueva era.",
    fr: "Génomique, thérapie génique, ARNm, médecine de précision. La biotechnologie est la nourriture de la nouvelle ère.",
    pt: "Genômica, terapia gênica, mRNA, medicina de precisão. A biotecnologia é o alimento da nova era.",
  },
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale, theme } = await params;
  const hotTheme = getHotTheme(theme);

  if (!hotTheme || !LOCALES.includes(locale as Locale)) {
    return { title: "Theme Not Found" };
  }

  const themeTitle = localizedThemeTitle(hotTheme.title, locale) || hotTheme.title;
  const canonical = `https://bogastock.com/global/${locale}/themes/${theme}`;

  return {
    title: `${themeTitle} | BOGA AI`,
    description: THEME_DESCRIPTIONS[theme]?.[locale as Locale] || "Theme stocks analysis",
    alternates: { canonical },
  };
}

export async function generateStaticParams() {
  const params: { locale: string; theme: string }[] = [];
  LOCALES.forEach((locale) => {
    HOT_THEMES_2026.forEach((theme) => {
      params.push({ locale, theme: theme.slug });
    });
  });
  return params;
}

export default async function ThemePage({ params }: Props) {
  const { locale, theme } = await params;

  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }

  const hotTheme = getHotTheme(theme);
  if (!hotTheme) {
    return <div>Theme not found</div>;
  }

  const themeTitle = localizedThemeTitle(hotTheme.title, locale) || hotTheme.title;
  const themeDescription = THEME_DESCRIPTIONS[theme]?.[locale as Locale] || "";

  // Fetch card data for all stocks in the theme
  const stockCards = await Promise.all(
    hotTheme.stocks.map(async (stock) => {
      try {
        const card = await getRealStockCardData(stock.ticker, locale as Locale);
        return { ...stock, card };
      } catch {
        return { ...stock, card: null };
      }
    })
  );

  // Fetch ticker data for live prices
  let allTickers: any = [];
  try {
    allTickers = await getAllTickers();
  } catch {
    allTickers = [];
  }

  // Labels for different locales
  const labels: Record<Locale, { stocks: string; price: string; change: string; description: string; action: string }> = {
    tr: {
      stocks: "HİSSE",
      price: "FİYAT",
      change: "DEĞİŞİM",
      description: "AÇIKLAMA",
      action: "GRAFİK DETAY",
    },
    en: {
      stocks: "TICKER",
      price: "PRICE",
      change: "CHANGE",
      description: "DESCRIPTION",
      action: "CHART DETAIL",
    },
    es: {
      stocks: "TICKER",
      price: "PRECIO",
      change: "CAMBIO",
      description: "DESCRIPCIÓN",
      action: "DETALLE DEL GRÁFICO",
    },
    fr: {
      stocks: "TICKER",
      price: "PRIX",
      change: "CHANGEMENT",
      description: "DESCRIPTION",
      action: "DÉTAILS DU GRAPHIQUE",
    },
    pt: {
      stocks: "TICKER",
      price: "PREÇO",
      change: "MUDANÇA",
      description: "DESCRIÇÃO",
      action: "DETALHE DO GRÁFICO",
    },
  };

  const l = labels[locale as Locale];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale as Locale} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href={`/global/${locale}/home`} className="hover:text-[#3b82f6] transition-colors">
            {locale === "tr" ? "Gösterge Paneli" : locale === "en" ? "Dashboard" : locale === "es" ? "Panel" : locale === "fr" ? "Tableau de Bord" : "Painel"}
          </Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{themeTitle}</span>
        </nav>

        {/* Lists Navigation */}
        <ListsNavigation locale={locale as Locale} activePath="watchlist" />

        {/* Theme Header */}
        <div className="mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{themeTitle}</h2>
          <p className="text-slate-400 text-xs md:text-sm">{themeDescription}</p>
        </div>

        {/* Stocks Grid/Table */}
        <div className="bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#30363d] bg-[#161b22]">
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">{l.stocks}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">{l.price}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">{l.change}</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">{l.description}</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase">{l.action}</th>
                </tr>
              </thead>
              <tbody>
                {stockCards.map((stock, idx) => {
                  const card = stock.card;
                  const tickerData = allTickers?.find((t: any) => t.ticker === stock.ticker);
                  const changePct = tickerData?.change_pct ?? 0;
                  const price = tickerData?.price ?? 0;
                  const isPositive = changePct >= 0;

                  return (
                    <tr key={stock.ticker} className={idx % 2 === 0 ? "bg-[#0d1117]" : "bg-[#161b22]"}>
                      <td className="px-6 py-3">
                        <Link
                          href={`/global/${locale}/graphic/${stock.ticker}`}
                          className="font-bold text-[#58a6ff] hover:underline"
                        >
                          {stock.ticker}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-white font-semibold">
                        ${price > 0 ? price.toFixed(2) : "N/A"}
                      </td>
                      <td className={`px-6 py-3 font-semibold ${isPositive ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                        {isPositive ? "+" : ""}{changePct.toFixed(2)}%
                      </td>
                      <td className="px-6 py-3 text-slate-400 text-xs">
                        {stock.blurb}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <Link
                          href={`/global/${locale}/graphic/${stock.ticker}`}
                          className="inline-block px-3 py-1 bg-[#58a6ff] text-[#0d1117] font-bold text-xs rounded hover:bg-[#79c0ff] transition-colors"
                        >
                          {l.action}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer hidePlatform={true} locale={locale as Locale} />
    </div>
  );
}
