"use client";

import { useState, useEffect } from "react";
import SearchLandingHeader from "@/components/public/SearchLandingHeader";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

interface SportsNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const ALL_TEAMS = ["Fenerbahçe", "Galatasaray", "Beşiktaş", "Real Madrid", "Barcelona", "Lakers", "Celtics"] as const;
type Team = (typeof ALL_TEAMS)[number];

const I18N = {
  tr: {
    title: "Akıllı Spor Portalı",
    subtitle: "Takip ettiğiniz spor kulüpleri, güncel haberler ve AI spor analizleri.",
    myTeams: "Takip Ettiğim Takımlar",
    sportsNews: "Güncel Spor Haberleri",
    suggestedQueries: "Önerilen Spor Analizleri",
    clickPrompt: "Sohbet Başlatmak İçin Bir Soruyu Tıklayın",
    loading: "Haberler yükleniyor...",
    noNews: "Spor haberi bulunamadı.",
  },
  en: {
    title: "Smart Sports Portal",
    subtitle: "Your followed sports clubs, live sports news, and AI sports insights.",
    myTeams: "My Followed Teams",
    sportsNews: "Latest Sports News",
    suggestedQueries: "Suggested Sports Queries",
    clickPrompt: "Click a Question to Start Chat",
    loading: "Loading news...",
    noNews: "No sports news found.",
  },
  es: {
    title: "Portal de Deportes Inteligente",
    subtitle: "Sus clubes deportivos seguidos, noticias en vivo y análisis de IA.",
    myTeams: "Mis Equipos Seguidos",
    sportsNews: "Últimas Noticias de Deportes",
    suggestedQueries: "Consultas Deportivas Sugeridas",
    clickPrompt: "Haga clic en una pregunta para iniciar el chat",
    loading: "Cargando noticias...",
    noNews: "No se encontraron noticias de deportes.",
  },
  fr: {
    title: "Portail des Sports Intelligent",
    subtitle: "Vos clubs préférés, actualités en direct et analyses de match par IA.",
    myTeams: "Mes Équipes Préférées",
    sportsNews: "Actualités Sportives Récents",
    suggestedQueries: "Requêtes Sportives Suggérées",
    clickPrompt: "Cliquez sur une question pour démarrer le chat",
    loading: "Chargement des actualités...",
    noNews: "Aucune actualité sportive trouvée.",
  },
  pt: {
    title: "Portal de Esportes Inteligente",
    subtitle: "Seus clubes esportivos seguidos, notícias de esportes ao vivo e análises de IA.",
    myTeams: "Meus Times Seguidos",
    sportsNews: "Últimas Notícias Esportivas",
    suggestedQueries: "Consultas Esportivas Sugeridas",
    clickPrompt: "Clique em uma pergunta para iniciar o chat",
    loading: "Carregando notícias...",
    noNews: "Nenhuma notícia esportiva encontrada.",
  },
};

const SUGGESTIONS: Record<Team, Record<Locale, string[]>> = {
  "Fenerbahçe": {
    tr: ["Fenerbahçe'nin güncel transfer dedikoduları ve kadro durumu", "Fenerbahçe'nin son maçındaki taktik analiz raporu"],
    en: ["Fenerbahce's latest transfer rumors and squad depth", "Tactical analysis of Fenerbahce's recent match"],
    es: ["Rumores de transferencia más recientes y profundidad del equipo de Fenerbahce", "Análisis táctico del partido reciente de Fenerbahce"],
    fr: ["Dernières rumeurs de transfert et profondeur de l'effectif de Fenerbahce", "Analyse tactique du dernier match de Fenerbahce"],
    pt: ["Últimos rumores de transferência e elenco do Fenerbahce", "Análise tática da partida recente do Fenerbahce"],
  },
  "Galatasaray": {
    tr: ["Galatasaray'ın sakatlık raporu ve gelecek maç kadro planı", "Galatasaray'ın mali borç yapısı ve sponsorluk gelirleri"],
    en: ["Galatasaray's injury updates and next match lineup plans", "Galatasaray's financial debt structure and sponsorship revenues"],
    es: ["Actualizaciones de lesiones de Galatasaray y alineación para el próximo partido", "Estructura de deuda financiera e ingresos por patrocinio de Galatasaray"],
    fr: ["Mises à jour sur les blessures de Galatasaray et composition du prochain match", "Structure financière de la dette de Galatasaray et revenus de sponsoring"],
    pt: ["Atualizações de lesões do Galatasaray e escalação para o próximo jogo", "Estrutura financeira da dívida do Galatasaray e receitas de patrocínio"],
  },
  "Beşiktaş": {
    tr: ["Beşiktaş'ın yeni sezondaki genç oyuncu yapılanması", "Beşiktaş'ın stadyum gelirleri ve bütçe analizi"],
    en: ["Besiktas's youth academy integration strategy for the new season", "Besiktas's stadium revenues and budget analysis"],
    es: ["Estrategia de integración de la academia juvenil de Besiktas para la nueva temporada", "Análisis del presupuesto e ingresos del estadio de Besiktas"],
    fr: ["Stratégie d'intégration des jeunes du centre de formation de Besiktas", "Revenus du stade de Besiktas et analyse budgétaire"],
    pt: ["Estratégia de integração da academia de juniores do Besiktas para a nova temporada", "Receitas do estádio do Besiktas e análise orçamentária"],
  },
  "Real Madrid": {
    tr: ["Real Madrid'in Şampiyonlar Ligi'ndeki şampiyonluk olasılık analizi", "Kylian Mbappe'nin Real Madrid'e taktiksel uyum raporu"],
    en: ["Real Madrid's Champions League championship probability analysis", "Kylian Mbappe's tactical fit report at Real Madrid"],
    es: ["Análisis de la probabilidad de campeonato de Champions League de Real Madrid", "Informe del encaje táctico de Kylian Mbappé en el Real Madrid"],
    fr: ["Analyse de probabilité de titre du Real Madrid en Ligue des Champions", "Rapport d'intégration tactique de Kylian Mbappé au Real Madrid"],
    pt: ["Análise da probabilidade de título do Real Madrid na Champions League", "Relatório de adaptação tática de Kylian Mbappé no Real Madrid"],
  },
  "Barcelona": {
    tr: ["Barcelona'nın La Masia akademisindeki yeni yetenekler", "Barcelona'nın finansal Fair Play limiti ve transfer engeli durumu"],
    en: ["Barcelona's rising talents in the La Masia academy", "Barcelona's financial Fair Play limit status and transfer restrictions"],
    es: ["Nuevos talentos emergentes en la academia La Masia del Barcelona", "Límites del juego limpio financiero de Barcelona y restricciones de transferencia"],
    fr: ["Les talents émergents de l'académie La Masia du FC Barcelone", "Statut du fair-play financier de Barcelone et restrictions de transfert"],
    pt: ["Novos talentos em ascensão na academia La Masia do Barcelona", "Situação do fair play financeiro do Barcelona e restrições de transferência"],
  },
  "Lakers": {
    tr: ["LA Lakers'ın güncel sakatlık durumu ve NBA playoff analizi", "Lakers'ın yeni sezon draft ve serbest oyuncu stratejisi"],
    en: ["LA Lakers' injury updates and NBA playoff run analysis", "Lakers' next draft plans and free agent targets"],
    es: ["Actualizaciones de lesiones de LA Lakers y análisis de la postemporada de la NBA", "Próximos planes de draft y objetivos de agentes libres de los Lakers"],
    fr: ["Point sur les blessures des LA Lakers et analyse pour les playoffs NBA", "Prochains plans de draft des Lakers et cibles d'agents libres"],
    pt: ["Atualizações de lesões do LA Lakers e análise dos playoffs da NBA", "Próximos planos de draft dos Lakers e alvos de agentes livres"],
  },
  "Celtics": {
    tr: ["Boston Celtics'in savunma verimliliği ve hücum şemaları", "Celtics kadro derinliği ve maaş bütçesi sınırları"],
    en: ["Boston Celtics' defense efficiency rating and offensive schemes", "Celtics roster depth and salary cap structure"],
    es: ["Calificación de eficiencia defensiva de Boston Celtics y esquemas ofensivos", "Profundidad del roster de los Celtics y límites del tope salarial"],
    fr: ["Efficacité défensive des Boston Celtics et systèmes offensifs", "Profondeur de l'effectif des Celtics et structure du plafond salarial"],
    pt: ["Classificação de eficiência defensiva e esquemas ofensivos do Boston Celtics", "Profundidade do elenco do Celtics e estrutura do teto salarial"],
  },
};

export default function SportsDashboardClient({ locale }: { locale: Locale }) {
  const t = I18N[locale];
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [news, setNews] = useState<SportsNewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);

  // Load followed teams
  useEffect(() => {
    const stored = localStorage.getItem("boga-sports-teams");
    if (stored) {
      try {
        setSelectedTeams(JSON.parse(stored));
      } catch (err) {
        setSelectedTeams(["Fenerbahçe"]);
      }
    } else {
      setSelectedTeams(["Fenerbahçe"]);
    }
  }, []);

  // Fetch sports news from backend API
  useEffect(() => {
    setLoadingNews(true);
    fetch(`/api/copilot/sports?q=sports&lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.status === "success" && Array.isArray(data.events)) {
          setNews(data.events);
        }
      })
      .catch((err) => console.error("Sports page fetch error:", err))
      .finally(() => setLoadingNews(false));
  }, [locale]);

  const handleToggleTeam = (team: Team) => {
    let updated: Team[];
    if (selectedTeams.includes(team)) {
      updated = selectedTeams.filter((t) => t !== team);
    } else {
      updated = [...selectedTeams, team];
    }
    setSelectedTeams(updated);
    localStorage.setItem("boga-sports-teams", JSON.stringify(updated));
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
          
          {/* Left Panel: Teams Select */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-4 shadow-xl">
              <h2 className="text-[13px] font-medium text-[#64748b] uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-[#1e2a3a]/30 pb-2">
                <span>⚽</span> {t.myTeams}
              </h2>
              <div className="space-y-2">
                {ALL_TEAMS.map((team) => {
                  const isActive = selectedTeams.includes(team);
                  return (
                    <button
                      key={team}
                      onClick={() => handleToggleTeam(team)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                        isActive
                          ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                          : "bg-[#141b2b]/30 border-[#1e2a3a]/60 text-slate-400 hover:text-white hover:bg-[#1e2a3a]/40"
                      }`}
                    >
                      <span>{team}</span>
                      <span>{isActive ? "✓" : "+"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Suggested Queries */}
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-4 shadow-xl space-y-3">
              <h2 className="text-[13px] font-medium text-[#64748b] uppercase tracking-widest flex items-center gap-1.5 border-b border-[#1e2a3a]/30 pb-2">
                <span>💡</span> {t.suggestedQueries}
              </h2>
              <p className="text-[11px] text-slate-500">{t.clickPrompt}</p>

              <div className="space-y-2.5">
                {selectedTeams.map((team) => (
                  <div key={team} className="space-y-1.5 pt-1">
                    <span className="text-xs font-medium text-blue-400">{team} Prompts</span>
                    {SUGGESTIONS[team][locale].map((prompt, idx) => (
                      <Link
                        key={idx}
                        href={`/global/${locale}/search?q=${encodeURIComponent(prompt)}`}
                        className="block text-left text-xs bg-[#141b2b]/30 hover:bg-[#1e2a3a] border border-[#1e2a3a]/60 hover:border-blue-500/40 rounded-lg p-2.5 text-slate-300 hover:text-blue-400 transition-all leading-snug cursor-pointer"
                      >
                        {prompt}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: News */}
          <div className="lg:col-span-8 space-y-4">
            <h2 className="text-[13px] font-medium text-[#64748b] uppercase tracking-widest flex items-center gap-1.5 border-b border-[#1e2a3a]/40 pb-2">
              <span>📰</span> {t.sportsNews}
            </h2>

            {loadingNews ? (
              <div className="py-24 text-center text-slate-500 text-sm font-medium">{t.loading}</div>
            ) : news.length === 0 ? (
              <div className="py-24 text-center text-slate-500 text-sm italic">{t.noNews}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {news.map((item, idx) => (
                  <Link
                    key={idx}
                    href={`/global/${locale}/search?q=${encodeURIComponent(item.title)}`}
                    className="group bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-3.5 backdrop-blur-md shadow-xl flex flex-col justify-between hover:border-[#3b82f6]/40 transition-all duration-300 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[13px] text-[#64748b] font-medium mb-2">
                        <span className="text-[#3b82f6] uppercase tracking-widest">{item.source}</span>
                        <span>{new Date(item.pubDate).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                      <h3 className="text-[14px] font-normal text-slate-200 group-hover:text-[#3b82f6] transition-colors leading-snug line-clamp-3">
                        {item.title}
                      </h3>
                    </div>

                    <div className="mt-2.5 pt-1.5 border-t border-[#1e2a3a]/20 flex items-center text-[13px] text-slate-500 group-hover:text-slate-300 transition-colors">
                      <span>Ask AI & Discuss →</span>
                    </div>
                  </Link>
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

