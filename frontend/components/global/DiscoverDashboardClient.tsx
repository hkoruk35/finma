"use client";

import { useState, useEffect } from "react";
import SearchLandingHeader from "@/components/public/SearchLandingHeader";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

const ALL_TOPICS = ["Soccer", "Science", "Art", "Cinema"] as const;
type Topic = (typeof ALL_TOPICS)[number];

const TOPIC_LABELS: Record<Topic, Record<Locale, string>> = {
  Soccer: {
    tr: "Futbol",
    en: "Soccer",
    es: "Fútbol",
    fr: "Football",
    pt: "Futebol",
    id: "Sepak Bola",
  },
  Science: {
    tr: "Bilim",
    en: "Science",
    es: "Ciencia",
    fr: "Science",
    pt: "Ciência",
    id: "Sains",
  },
  Art: {
    tr: "Sanat",
    en: "Art",
    es: "Arte",
    fr: "Art",
    pt: "Arte",
    id: "Seni",
  },
  Cinema: {
    tr: "Sinema",
    en: "Cinema",
    es: "Cine",
    fr: "Cinéma",
    pt: "Cinema",
    id: "Sinema",
  },
};

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
  id: {
    title: "Discover Cerdas",
    subtitle: "Rekomendasi AI dan topik pencarian yang dipersonalisasi sesuai minat Anda.",
    myInterests: "Minat Saya",
    suggestedQueries: "Saran Pencarian",
    saveTopics: "Simpan Minat",
    clickPrompt: "Klik Prompt untuk Melanjutkan Obrolan",
    allTopics: "Semua Topik",
  },
};

const SUGGESTIONS: Record<Topic, Record<Locale, string[]>> = {
  Soccer: {
    tr: [
      "Real Madrid ve Barcelona'nın yeni sezon transfer stratejileri ve finansal analizleri",
      "Şampiyonlar Ligi format değişikliğinin kulüp gelirlerine ve rekabete etkisi",
      "Premier Lig şampiyonluk yarışında öne çıkan takımlar ve taktiksel analiz",
      "Dünya Kupası hazırlıkları kapsamında ülke milli takımlarının güncel durumları"
    ],
    en: [
      "New season transfer strategies and financial analysis of Real Madrid and Barcelona",
      "Impact of the Champions League format change on club revenues and competition",
      "Key contenders and tactical analysis in the Premier League title race",
      "Current status of national football teams ahead of the World Cup preparations"
    ],
    es: [
      "Estrategias de transferencia y análisis financiero del Real Madrid y Barcelona",
      "Impacto del cambio de formato de la Champions League en los ingresos y la competencia",
      "Equipos destacados y análisis táctico en la lucha por el título de la Premier League",
      "Estado actual de las selecciones nacionales en su preparación para la Copa del Mundo"
    ],
    fr: [
      "Stratégies de transfert et analyse financière du Real Madrid et du FC Barcelone",
      "Impact du changement de format de la Ligue des Champions sur les revenus",
      "Principaux prétendants et analyse tactique dans la course au titre en Premier League",
      "État actuel des équipes nationales de football en vue de la Coupe du Monde"
    ],
    pt: [
      "Estratégias de transferência e análise financeira do Real Madrid e Barcelona",
      "Impacto da mudança de formato da Champions League nas receitas dos clubes",
      "Principais candidatos e análise tática na corrida pelo título da Premier League",
      "Status atual das seleções nacionais de futebol na preparação para a Copa do Mundo"
    ],
    id: [
      "Strategi transfer musim baru dan analisis keuangan Real Madrid dan Barcelona",
      "Dampak perubahan format Liga Champions terhadap pendapatan klub dan persaingan",
      "Kandidat utama dan analisis taktik dalam perebutan gelar Premier League",
      "Status terkini tim nasional sepak bola menjelang persiapan Piala Dunia"
    ],
  },
  Science: {
    tr: [
      "James Webb Uzay Teleskobu'nun son keşifleri ve evrenin kökeni teorileri",
      "Kanser tedavisinde kullanılan yeni nesil immünoterapi yöntemleri ve başarı oranları",
      "Nükleer füzyon enerjisi araştırmalarındaki son gelişmeler ve ticari kullanım hedefleri",
      "Yapay zeka modellerinin bilimsel araştırmaları ve veri analizini hızlandırmadaki rolü"
    ],
    en: [
      "James Webb Space Telescope's latest discoveries and theories on the origin of the universe",
      "Next-generation immunotherapy methods in cancer treatment and success rates",
      "Recent milestones in nuclear fusion energy research and commercialization goals",
      "The role of artificial intelligence models in accelerating scientific research and analysis"
    ],
    es: [
      "Últimos descubrimientos del Telescopio Espacial James Webb y origen del universo",
      "Métodos de inmunoterapia de próxima generación en el tratamiento del cáncer",
      "Hitos recientes en la investigación de la energía de fusión nuclear y metas comerciales",
      "El papel de los modelos de inteligencia artificial en la aceleración de la investigación científica"
    ],
    fr: [
      "Dernières découvertes du télescope spatial James Webb et origine de l'univers",
      "Méthodes d'immunothérapie de nouvelle génération pour le traitement du cancer",
      "Progrès récents dans la recherche sur la fusion nucléaire et objectifs commerciaux",
      "Le rôle de l'intelligence artificielle pour accélérer la recherche scientifique"
    ],
    pt: [
      "Últimas descobertas do Telescópio Espacial James Webb e origem do universo",
      "Métodos de imunoterapia de próxima geração no tratamento do câncer",
      "Marcos recentes na pesquisa de fusão nuclear e metas comerciais",
      "O papel dos modelos de imagem artificial na aceleração da pesquisa científica"
    ],
    id: [
      "Penemuan terbaru Teleskop Luar Angkasa James Webb dan teori asal-usul alam semesta",
      "Metode imunoterapi generasi baru dalam pengobatan kanker dan tingkat keberhasilannya",
      "Pencapaian terbaru dalam riset energi fusi nuklir dan target komersialisasinya",
      "Peran model kecerdasan buatan dalam mempercepat riset dan analisis ilmiah"
    ],
  },
  Art: {
    tr: [
      "Modern dijital sanatın ve üretken yapay zekanın geleneksel sanat piyasasına etkisi",
      "Rönesans döneminin ünlü başyapıtlarının restorasyon süreçleri ve kullanılan teknolojiler",
      "Küresel sanat bienalleri ve çağdaş sanat akımlarında öne çıkan temalar",
      "Sokak sanatının toplumsal hareketlerdeki rolü ve kentsel dönüşüme etkisi"
    ],
    en: [
      "Impact of modern digital art and generative AI on the traditional art market",
      "Restoration processes and technologies used for famous Renaissance masterpieces",
      "Key themes in global art biennials and contemporary art movements",
      "The role of street art in social movements and its impact on urban transformation"
    ],
    es: [
      "Impacto del arte digital moderno y la IA generativa en el mercado del arte tradicional",
      "Procesos y tecnologías de restauración en obras maestras del Renacimiento",
      "Temas clave en bienales de arte globales y movimientos de arte contemporáneo",
      "El papel del arte callejero en los movimientos sociales y la transformación urbana"
    ],
    fr: [
      "Impact de l'art numérique moderne et de l'IA générative sur le marché de l'art",
      "Processus et technologies de restauration des chefs-d'œuvre de la Renaissance",
      "Thèmes clés des biennales d'art mondiales et des mouvements d'art contemporain",
      "Le rôle du street art dans les mouvements sociaux et son impact sur la ville"
    ],
    pt: [
      "Impacto da arte digital moderna e da IA generativa no mercado de arte tradicional",
      "Processos de restauração e tecnologias usadas em obras-primas do Renascimento",
      "Temas centrais nas bienais globais de arte e movimentos de arte contemporânea",
      "O papel da arte de rua nos movimentos sociais e seu impacto na transformação urbana"
    ],
    id: [
      "Dampak seni digital modern dan AI generatif terhadap pasar seni tradisional",
      "Proses restorasi dan teknologi yang digunakan untuk mahakarya Renaisans terkenal",
      "Tema utama dalam biennale seni global dan gerakan seni kontemporer",
      "Peran seni jalanan dalam gerakan sosial dan dampaknya pada transformasi perkotaan"
    ],
  },
  Cinema: {
    tr: [
      "Uluslararası film festivallerinde (Cannes, Venedik) öne çıkan yapımlar ve yönetmenler",
      "Dijital yayın platformlarının bağımsız sinema üretimi ve dağıtımı üzerindeki etkisi",
      "Hollywood sinemasında görsel efekt (VFX) teknolojilerinin gelişimi ve geleceği",
      "Sinema tarihinde çığır açan kült filmlerin yapım süreçleri ve analizleri"
    ],
    en: [
      "Award-winning films and directors at international film festivals (Cannes, Venice)",
      "Impact of streaming platforms on independent cinema production and distribution",
      "Evolution and future of visual effects (VFX) technologies in Hollywood cinema",
      "Behind-the-scenes production stories and analysis of cult films in cinema history"
    ],
    es: [
      "Películas y directores destacados en festivales internacionales (Cannes, Venecia)",
      "Impacto de las plataformas de streaming en el cine independiente",
      "Evolución y futuro de los efectos visuales (VFX) en el cine de Hollywood",
      "Procesos de producción e historias detrás de las películas de culto de la historia"
    ],
    fr: [
      "Films et réalisateurs primés dans les festivals internationaux (Cannes, Venise)",
      "Impact des plateformes de streaming sur la production cinématographique indépendante",
      "Évolution et avenir des effets visuels (VFX) dans le cinéma hollywoodien",
      "Analyse et coulisses de la production des films cultes de l'histoire du cinéma"
    ],
    pt: [
      "Filmes e diretores premiados em festivais internacionais (Cannes, Veneza)",
      "Impacto das plataformas de streaming na produção e distribuição de cinema independente",
      "Evolução e futuro dos efeitos visuais (VFX) no cinema hollywoodiano",
      "Histórias de bastidores e análises de filmes cult na história do cinema"
    ],
    id: [
      "Film dan sutradara pemenang penghargaan di festival film internasional (Cannes, Venesia)",
      "Dampak platform streaming pada produksi dan distribusi sinema independen",
      "Evolusi dan masa depan teknologi efek visual (VFX) dalam sinema Hollywood",
      "Kisah di balik layar produksi dan analisis film kultus dalam sejarah sinema"
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
          <h1 className="text-xl md:text-2xl font-medium text-white tracking-tight">{t.title}</h1>
          <p className="text-[14px] text-slate-400 mt-1 max-w-2xl">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: Interest selection */}
          <div className="lg:col-span-4 bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-4 shadow-xl">
            <h2 className="text-[13px] font-medium text-[#64748b] uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-[#1e2a3a]/30 pb-2">
              <span>💖</span> {t.myInterests}
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
                    <span>{TOPIC_LABELS[topic][locale]}</span>
                    <span>{isActive ? "✓" : "+"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right panel: Suggested queries */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2a3a]/40 pb-2">
              <span className="text-[13px] font-medium text-[#64748b] uppercase tracking-widest flex items-center gap-1.5">
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
                    <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {TOPIC_LABELS[topic][locale]}
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

        {/* Standard Footer Copyright */}
        <div className="text-center mt-12 pt-4 border-t border-[#1e2a3a]/40 opacity-60">
          <p className="text-slate-500/60" style={{ fontSize: "11px", fontFamily: "Inter", fontWeight: 400 }}>
            {locale === "tr" ? "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Tüm Hakları Saklıdır." :
             locale === "en" ? "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS All Rights Reserved." :
             locale === "es" ? "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Todos los Derechos Reservados." :
             locale === "fr" ? "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Tous Droits Réservés." :
             "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Todos os Direitos Reservados."}
          </p>
        </div>
      </main>
    </div>
  );
}

