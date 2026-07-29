"use client";

import { useState, useEffect } from "react";
import SearchLandingHeader from "@/components/public/SearchLandingHeader";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

const ALL_TOPICS = ["AI", "US Markets", "Technology", "Crypto", "Global Politics", "Biotech"] as const;
type Topic = (typeof ALL_TOPICS)[number];

const I18N = {
  tr: {
    title: "Akıllı Keşif",
    subtitle: "Yapay zeka önerileri ve ilgi alanlarınıza göre özelleştirilmiş arama konuları.",
    myInterests: "İlgi Alanlarım",
    suggestedQueries: "Önerilen Arama Başlıkları",
    saveTopics: "İlgi Alanlarını Kaydet",
    clickPrompt: "Sohbet Başlatmak İçin Bir Başlığa Tıklayın",
    allTopics: "Tüm Konular",
  },
  en: {
    title: "Smart Discover",
    subtitle: "AI recommendations and search topics personalized to your interests.",
    myInterests: "My Interests",
    suggestedQueries: "Suggested Search Queries",
    saveTopics: "Save Interests",
    clickPrompt: "Click a Prompt to Continue Chat",
    allTopics: "All Topics",
  },
  es: {
    title: "Descubrimiento Inteligente",
    subtitle: "Recomendaciones de IA y temas de búsqueda personalizados según sus intereses.",
    myInterests: "Mis Intereses",
    suggestedQueries: "Consultas de Búsqueda Sugeridas",
    saveTopics: "Guardar Intereses",
    clickPrompt: "Haga clic en un tema para continuar chateando",
    allTopics: "Todos los Temas",
  },
  fr: {
    title: "Découverte Intellegente",
    subtitle: "Recommandations IA et sujets de recherche personnalisés selon vos intérêts.",
    myInterests: "Mes Intérêts",
    suggestedQueries: "Suggestions de recherche",
    saveTopics: "Enregistrer mes intérêts",
    clickPrompt: "Cliquez sur une question pour démarrer le chat",
    allTopics: "Tous les Sujets",
  },
  pt: {
    title: "Descoberta Inteligente",
    subtitle: "Recomendações de IA e temas de pesquisa personalizados com base em seus interesses.",
    myInterests: "Meus Interesses",
    suggestedQueries: "Consultas de Busca Sugeridas",
    saveTopics: "Salvar Interesses",
    clickPrompt: "Clique em uma pergunta para iniciar o chat",
    allTopics: "Todos os Temas",
  },
};

const SUGGESTIONS: Record<Topic, Record<Locale, string[]>> = {
  AI: {
    tr: [
      "Nvidia Blackwell çiplerindeki son durum ve tedarik zinciri analizi",
      "Google Gemini 1.5 Pro multimodal arama özellikleri",
      "Yapay zeka ajanlarının (AI Agents) iş dünyasındaki verimlilik analizi",
      "Üretken yapay zeka telif hakkı davalarında son gelişmeler"
    ],
    en: [
      "Latest status of Nvidia Blackwell chips and supply chain analysis",
      "Google Gemini 1.5 Pro multimodal search capabilities",
      "Impact of AI Agents on business process automation",
      "Recent developments in generative AI copyright lawsuits"
    ],
    es: [
      "Estado de los chips Nvidia Blackwell y análisis de la cadena de suministro",
      "Capacidades de búsqueda multimodal de Google Gemini 1.5 Pro",
      "Impacto de los agentes de IA en la automatización empresarial",
      "Demandas recientes por derechos de autor de IA generativa"
    ],
    fr: [
      "Statut des puces Nvidia Blackwell et analyse de la chaîne d'approvisionnement",
      "Capacités de recherche multimodale de Google Gemini 1.5 Pro",
      "Impact des agents d'IA sur l'automatisation des entreprises",
      "Procès récents liés aux droits d'auteur dans l'IA générative"
    ],
    pt: [
      "Status dos chips Nvidia Blackwell e análise da cadeia de suprimentos",
      "Capacidades de busca multimodal do Google Gemini 1.5 Pro",
      "Impacto de agentes de IA na automação de processos de negócios",
      "Processos recentes de direitos autorais de IA generativa"
    ],
  },
  "US Markets": {
    tr: [
      "S&P 500 endeksindeki düzeltme beklentileri ve teknik seviyeler",
      "Fed faiz indirimi takvimi ve enflasyon hedefleri",
      "Hisse senedi geri alımlarının (stock buyback) piyasalara etkisi",
      "Büyük teknoloji hisselerinin bilanço beklentileri"
    ],
    en: [
      "S&P 500 index correction expectations and technical support levels",
      "Fed interest rate cut schedule and inflation targets",
      "Impact of stock buybacks on market momentum",
      "Earnings season expectations for big tech stocks"
    ],
    es: [
      "Expectativas de corrección del índice S&P 500 y niveles técnicos de soporte",
      "Calendario de reducción de tasas de la Fed y objetivos de inflación",
      "Impacto de la recompra de acciones en el impulso del mercado",
      "Expectativas de ganancias corporativas de las grandes tecnológicas"
    ],
    fr: [
      "Attentes de correction de l'indice S&P 500 et niveaux de support technique",
      "Calendrier de baisse des taux de la Fed et objectifs d'inflation",
      "Impact des rachats d'actions sur la dynamique du marché",
      "Attentes de résultats pour les grandes valeurs technologiques"
    ],
    pt: [
      "Expectativas de correção do índice S&P 500 e níveis de suporte técnico",
      "Cronograma de corte de juros do Fed e metas de inflação",
      "Impacto das recompras de ações no momento do mercado",
      "Expectativas de resultados trimestrais para as grandes empresas de tecnologia"
    ],
  },
  Technology: {
    tr: [
      "Apple Vision Pro yeni nesil modeller ve pazar payı beklentileri",
      "Kuantum bilgisayarların ticari kullanımı ve lider şirketler",
      "Yarı iletken çip arz-talep dengesi ve TSMC yatırımları",
      "Avrupa Birliği yapay zeka yasasının (AI Act) teknoloji şirketlerine etkisi"
    ],
    en: [
      "Apple Vision Pro next-generation models and market share expectations",
      "Commercial use of quantum computing and leading companies",
      "Semiconductor supply-demand balance and TSMC investments",
      "Impact of the EU AI Act on multinational tech companies"
    ],
    es: [
      "Modelos de próxima generación de Apple Vision Pro y expectativas de cuota de mercado",
      "Uso comercial de la computación cuántica y empresas líderes",
      "Equilibrio entre oferta y demanda de semiconductores e inversiones de TSMC",
      "Impacto de la Ley de IA de la UE en las empresas tecnológicas multinacionales"
    ],
    fr: [
      "Modèles de nouvelle génération Apple Vision Pro et parts de marché",
      "Utilisation commerciale de l'informatique quantique et entreprises leaders",
      "Équilibre offre-demande de semi-conducteurs et investissements de TSMC",
      "Impact de la loi européenne sur l'IA (AI Act) sur les entreprises technologiques"
    ],
    pt: [
      "Modelos de próxima geração do Apple Vision Pro e expectativas de participação",
      "Uso comercial de computação quântica e empresas líderes no setor",
      "Equilíbrio de oferta e demanda de semicondutores e investimentos da TSMC",
      "Impacto da Lei de IA da UE sobre as multinacionais de tecnologia"
    ],
  },
  Crypto: {
    tr: [
      "Bitcoin halving sonrası madencilik maliyetleri ve fiyat grafiği",
      "Ethereum layer 2 ölçekleme çözümleri ve gaz ücretleri",
      "DeFi protokollerindeki güncel güvenlik açıkları ve çözümleri",
      "Kripto para düzenlemelerinde SEC'in yeni duruşu"
    ],
    en: [
      "Bitcoin mining costs and price chart trends after halving",
      "Ethereum layer 2 scaling solutions and gas fees",
      "Current security vulnerabilities in DeFi protocols and solutions",
      "The SEC's latest stance on cryptocurrency regulations"
    ],
    es: [
      "Costos de minería de Bitcoin y tendencias del gráfico después del halving",
      "Soluciones de escala de capa 2 de Ethereum y tarifas de gas",
      "Vulnerabilidades actuales de seguridad en protocolos DeFi y soluciones",
      "Última postura de la SEC sobre las regulaciones de criptomonedas"
    ],
    fr: [
      "Coûts de minage du Bitcoin et tendances des prix après le halving",
      "Solutions de mise à l'échelle de couche 2 d'Ethereum et frais de gaz",
      "Vulnérabilités de sécurité actuelles dans les protocoles DeFi",
      "Dernière position de la SEC sur la réglementation des crypto-monnaies"
    ],
    pt: [
      "Custos de mineração de Bitcoin e tendências de preço pós-halving",
      "Soluções de escalabilidade de camada 2 do Ethereum e taxas de gás",
      "Vulnerabilidades atuais de segurança em protocolos DeFi",
      "A posição mais recente da SEC sobre as regulamentações de criptoativos"
    ],
  },
  "Global Politics": {
    tr: [
      "ABD başkanlık kararlarının küresel serbest ticarete etkisi",
      "Asya çip üretim merkezlerindeki jeopolitik riskler",
      "Yeşil enerji geçişi politikaları ve madencilik sektörü",
      "Teknoloji şirketlerinin lobicilik faaliyetleri ve yasal davalar"
    ],
    en: [
      "Impact of US presidential executive orders on global free trade",
      "Geopolitical risks in Asian semiconductor manufacturing hubs",
      "Green energy transition policies and the mining sector",
      "Lobbying activities of tech giants and regulatory lawsuits"
    ],
    es: [
      "Impacto de las órdenes ejecutivas presidenciales de EE. UU. en el libre comercio global",
      "Riesgos geopolíticos en los centros de fabricación de semiconductores en Asia",
      "Políticas de transición hacia energías limpias y el sector minero",
      "Actividades de cabildeo de los gigantes tecnológicos y demandas regulatorias"
    ],
    fr: [
      "Impact des décrets présidentiels américains sur le libre-échange mondial",
      "Risques géopolitiques dans les hubs asiatiques de fabrication de semi-conducteurs",
      "Politiques de transition énergétique et secteur minier",
      "Activités de lobbying des géants de la tech et procès réglementaires"
    ],
    pt: [
      "Impacto de decretos presidenciais dos EUA sobre o livre comércio global",
      "Riscos geopolíticos nos centros de fabricação de semicondutores na Ásia",
      "Políticas de transição para energia limpa e o setor de mineração",
      "Atividades de lobby de gigantes da tecnologia e processos regulatórios"
    ],
  },
  Biotech: {
    tr: [
      "CRISPR gen düzenleme tedavisinde son FDA onayları",
      "Yapay zeka ile ilaç keşfi yapan öncü biyoteknoloji şirketleri",
      "mRNA tabanlı kanser aşılarında klinik deney sonuçları",
      "Biyoteknoloji sektöründeki satın alma ve birleşme dalgaları"
    ],
    en: [
      "Recent FDA approvals in CRISPR gene-editing therapies",
      "Leading biotech companies using AI for drug discovery",
      "Clinical trial results for mRNA-based cancer vaccines",
      "Acquisitions and merger waves in the biotechnology sector"
    ],
    es: [
      "Aprobaciones recientes de la FDA en terapias de edición genética CRISPR",
      "Empresas líderes en biotecnología que utilizan IA para el descubrimiento de fármacos",
      "Resultados de ensayos clínicos para vacunas contra el cáncer basadas en ARNm",
      "Olas de adquisiciones y fusiones en el sector de la biotecnología"
    ],
    fr: [
      "Autorisations récentes de la FDA pour les thérapies d'édition génique CRISPR",
      "Principales entreprises de biotechnologie utilisant l'IA pour la découverte de médicaments",
      "Résultats d'essais cliniques pour les vaccins contre le cancer basés sur l'ARNm",
      "Vagues d'acquisitions et de fusions dans le secteur de la biotechnologie"
    ],
    pt: [
      "Aprovações recentes do FDA em terapias de edição genética CRISPR",
      "Empresas líderes em biotecnologia usando IA para descoberta de medicamentos",
      "Resultados de ensaios clínicos para vacinas contra o câncer baseadas em mRNA",
      "Ondas de fusões e aquisições no setor de biotecnologia"
    ],
  },
};

export default function DiscoverDashboardClient({ locale }: { locale: Locale }) {
  const t = I18N[locale];
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);

  // Load selected topics from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("boga-discover-topics");
    if (stored) {
      try {
        setSelectedTopics(JSON.parse(stored));
      } catch (err) {
        setSelectedTopics([...ALL_TOPICS]);
      }
    } else {
      setSelectedTopics([...ALL_TOPICS]);
    }
  }, []);

  const handleToggleTopic = (topic: Topic) => {
    let updated: Topic[];
    if (selectedTopics.includes(topic)) {
      updated = selectedTopics.filter((t) => t !== topic);
    } else {
      updated = [...selectedTopics, topic];
    }
    setSelectedTopics(updated);
    localStorage.setItem("boga-discover-topics", JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 font-sans pb-12">
      <SearchLandingHeader locale={locale} onLogoClick={() => window.location.href = `/global/${locale}/search`} />
      
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 mt-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-900/25 to-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">{t.title}</h1>
          <p className="text-[14px] text-slate-400 mt-1 max-w-2xl">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Interest selection */}
          <div className="lg:col-span-4 bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-4 shadow-xl">
            <h2 className="text-[13px] font-semibold text-[#64748b] uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-[#1e2a3a]/30 pb-2">
              <span>🎯</span> {t.myInterests}
            </h2>
            <div className="space-y-2">
              {ALL_TOPICS.map((topic) => {
                const isActive = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => handleToggleTopic(topic)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                      isActive
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.05)]"
                        : "bg-[#141b2b]/30 border-[#1e2a3a]/60 text-slate-400 hover:text-white hover:bg-[#1e2a3a]/40"
                    }`}
                  >
                    <span>{topic}</span>
                    <span>{isActive ? "✓" : "+"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right panel: Suggested queries */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2a3a]/40 pb-2">
              <span className="text-[13px] font-semibold text-[#64748b] uppercase tracking-widest flex items-center gap-1.5">
                <span>✨</span> {t.suggestedQueries}
              </span>
              <span className="text-[11px] text-slate-500">{t.clickPrompt}</span>
            </div>

            {selectedTopics.length === 0 ? (
              <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-8 text-center text-slate-500 text-sm italic">
                {locale === "tr" ? "Lütfen en az bir ilgi alanı seçin." : "Please select at least one interest."}
              </div>
            ) : (
              <div className="space-y-6">
                {ALL_TOPICS.filter((topic) => selectedTopics.includes(topic)).map((topic) => (
                  <div key={topic} className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {topic}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {SUGGESTIONS[topic][locale].map((prompt, idx) => (
                        <Link
                          key={idx}
                          href={`/global/${locale}/search?q=${encodeURIComponent(prompt)}`}
                          className="block text-left bg-[#0b101b]/70 hover:bg-[#141b2b] border border-[#1e2a3a]/60 hover:border-blue-500/40 rounded-xl p-3.5 shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer"
                        >
                          <p className="text-[13px] font-normal text-slate-200 group-hover:text-blue-400 transition-colors leading-snug">
                            {prompt}
                          </p>
                          <span className="inline-block text-[11px] text-blue-500/60 group-hover:text-blue-400 transition-colors mt-2">
                            Ask AI →
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
