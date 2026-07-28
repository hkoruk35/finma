"use client";

import { RefObject, KeyboardEvent } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

type L = Record<Locale, string>;

const BADGE: L = { tr: "✦ AI ARAŞTIRMA PLATFORMU", en: "✦ AI RESEARCH PLATFORM", es: "✦ PLATAFORMA DE INVESTIGACIÓN IA", fr: "✦ PLATEFORME DE RECHERCHE IA", pt: "✦ PLATAFORMA DE PESQUISA IA" };
const HEADLINE: L = { tr: "Ne öğrenmek istersiniz?", en: "What do you want to know?", es: "¿Qué quieres saber?", fr: "Que voulez-vous savoir ?", pt: "O que você quer saber?" };
const SUBHEADLINE: L = {
  tr: "Ne sorarsanız sorun. Gerçek zamanlı piyasa istihbaratıyla desteklenen AI destekli içgörüler alın.",
  en: "Ask anything. Get AI-powered insights backed by real-time market intelligence.",
  es: "Pregunta lo que quieras. Obtén información impulsada por IA respaldada por inteligencia de mercado en tiempo real.",
  fr: "Posez n'importe quelle question. Obtenez des analyses alimentées par l'IA, soutenues par des données de marché en temps réel.",
  pt: "Pergunte qualquer coisa. Obtenha insights baseados em IA apoiados por inteligência de mercado em tempo real.",
};
const PLACEHOLDER: L = {
  tr: "Piyasalar, şirketler veya küresel trendler hakkında bir soru sorun...",
  en: "Ask a question about markets, companies, or global trends...",
  es: "Haz una pregunta sobre mercados, empresas o tendencias globales...",
  fr: "Posez une question sur les marchés, les entreprises ou les tendances mondiales...",
  pt: "Faça uma pergunta sobre mercados, empresas ou tendências globais...",
};
// "Smart Search" yerine gerçek davranışı anlatan sabit bir etiket — bu sayfadan
// yapılan her arama zaten isGlobal nedeniyle doğrudan Derin Analiz'e gidiyor
// (bkz. AIContainer.tsx effectiveAutoDeep), yani burada var olmayan bir "mod
// seçici" uydurmuyoruz.
const MODE_LABEL: L = { tr: "Derin Analiz Modu", en: "Deep Analysis Mode", es: "Modo de Análisis Profundo", fr: "Mode Analyse Approfondie", pt: "Modo de Análise Profunda" };
const POPULAR_LABEL: L = { tr: "POPÜLER KONULARI KEŞFEDİN", en: "EXPLORE POPULAR TOPICS", es: "EXPLORA TEMAS POPULARES", fr: "EXPLOREZ LES SUJETS POPULAIRES", pt: "EXPLORE TÓPICOS POPULARES" };

const ASK_TITLE: L = { tr: "Sor", en: "Ask", es: "Preguntar", fr: "Demander", pt: "Perguntar" };
const ASK_DESC: L = { tr: "AI destekli sorular ve sohbet.", en: "AI-powered questions and chat.", es: "Preguntas y chat impulsados por IA.", fr: "Questions et discussion alimentées par l'IA.", pt: "Perguntas e chat com IA." };
const ASK_BODY: L = {
  tr: "Anında cevaplar, derin içgörüler ve takip analizi alın.", en: "Get instant answers, deep insights, and follow-up analysis.",
  es: "Obtén respuestas instantáneas, información profunda y análisis de seguimiento.", fr: "Obtenez des réponses instantanées, des analyses approfondies et un suivi.",
  pt: "Obtenha respostas instantâneas, insights profundos e análises de acompanhamento.",
};
const ASK_CTA: L = { tr: "Sormaya Başla", en: "Start Asking", es: "Empezar a Preguntar", fr: "Commencer à Demander", pt: "Começar a Perguntar" };

const TERMINAL_TITLE: L = { tr: "Terminal", en: "Terminal", es: "Terminal", fr: "Terminal", pt: "Terminal" };
const TERMINAL_DESC: L = { tr: "Hisseler, analiz ve piyasa istihbaratı.", en: "Stocks, analysis, and market intelligence.", es: "Acciones, análisis e inteligencia de mercado.", fr: "Actions, analyse et intelligence de marché.", pt: "Ações, análise e inteligência de mercado." };
const TERMINAL_BODY: L = {
  tr: "Derinlemesine veri, gelişmiş araçlar ve uygulanabilir piyasa içgörüleri.", en: "In-depth data, advanced tools, and actionable market insights.",
  es: "Datos detallados, herramientas avanzadas e información de mercado procesable.", fr: "Données approfondies, outils avancés et informations de marché exploitables.",
  pt: "Dados aprofundados, ferramentas avançadas e insights de mercado acionáveis.",
};
const TERMINAL_CTA: L = { tr: "Terminali Aç", en: "Open Terminal", es: "Abrir Terminal", fr: "Ouvrir le Terminal", pt: "Abrir Terminal" };
const TERMINAL_BADGE: L = { tr: "GÜÇLÜ YÖN", en: "STRONG SUITE", es: "PUNTO FUERTE", fr: "POINT FORT", pt: "PONTO FORTE" };

const LISTS_TITLE: L = { tr: "Listeler", en: "Lists", es: "Listas", fr: "Listes", pt: "Listas" };
const LISTS_DESC: L = { tr: "Küratörlü hisse listeleri ve temalar.", en: "Curated stock lists and themes.", es: "Listas de acciones curadas y temas.", fr: "Listes d'actions organisées et thèmes.", pt: "Listas de ações selecionadas e temas." };
const LISTS_BODY: L = {
  tr: "Trend hisseler, temalar ve takip listeleriyle bir adım önde kalın.", en: "Stay ahead with trending stocks, themes, and watchlists.",
  es: "Mantente a la vanguardia con acciones en tendencia, temas y listas de seguimiento.", fr: "Gardez une longueur d'avance avec les actions tendance, les thèmes et les listes de suivi.",
  pt: "Fique à frente com ações em alta, temas e listas de acompanhamento.",
};
const LISTS_CTA: L = { tr: "Listelere Göz At", en: "Explore Lists", es: "Explorar Listas", fr: "Explorer les Listes", pt: "Explorar Listas" };

// Referans tasarımdaki "Explore Popular Topics" bölümü — ham ticker listesi
// DEĞİL, tıklanınca gerçek /api/ask genel sohbetine (artık herkese açık,
// bkz. route.ts) doğal dilde bir soru gönderen konu kartları. Platformu
// "hisse ağırlıklı" tek boyuta indirgemeden, tasarımdaki konu-kartı yapısını
// birebir koruyoruz.
interface Topic { icon: string; label: L; subtitle: L; prompt: L }

const TOPICS: Topic[] = [
  {
    icon: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
    label: { tr: "AI & Teknoloji", en: "AI & Technology", es: "IA y Tecnología", fr: "IA et Technologie", pt: "IA e Tecnologia" },
    subtitle: { tr: "Trendler, modeller, çipler", en: "Trends, models, chips", es: "Tendencias, modelos, chips", fr: "Tendances, modèles, puces", pt: "Tendências, modelos, chips" },
    prompt: {
      tr: "Yapay zeka ve teknoloji sektöründe öne çıkan hisseler hangileri?", en: "Which stocks are leading in the AI and technology sector?",
      es: "¿Qué acciones lideran el sector de IA y tecnología?", fr: "Quelles actions dominent le secteur de l'IA et de la technologie ?",
      pt: "Quais ações lideram o setor de IA e tecnologia?",
    },
  },
  {
    icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 014 9 14.5 14.5 0 01-4 9 14.5 14.5 0 01-4-9 14.5 14.5 0 014-9z",
    label: { tr: "Küresel Ekonomi", en: "Global Economy", es: "Economía Global", fr: "Économie Mondiale", pt: "Economia Global" },
    subtitle: { tr: "Makro, politika, görünüm", en: "Macro, policy, outlook", es: "Macro, política, perspectivas", fr: "Macro, politique, perspectives", pt: "Macro, política, perspectivas" },
    prompt: {
      tr: "Bu hafta küresel ekonomiyi ve piyasaları neler etkiliyor?", en: "What's driving the global economy and markets this week?",
      es: "¿Qué está impulsando la economía global y los mercados esta semana?", fr: "Qu'est-ce qui influence l'économie mondiale et les marchés cette semaine ?",
      pt: "O que está impulsionando a economia global e os mercados esta semana?",
    },
  },
  {
    icon: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
    label: { tr: "Sektör Rotasyonu", en: "Sector Rotation", es: "Rotación Sectorial", fr: "Rotation Sectorielle", pt: "Rotação Setorial" },
    subtitle: { tr: "Kazananlar, kaybedenler, akış", en: "Winners, laggards, flows", es: "Ganadores, rezagados, flujos", fr: "Gagnants, retardataires, flux", pt: "Vencedores, atrasados, fluxos" },
    prompt: {
      tr: "Şu anda hangi sektörler güçlü, hangileri zayıf?", en: "Which sectors are strong right now, and which are lagging?",
      es: "¿Qué sectores están fuertes ahora mismo y cuáles se están quedando atrás?", fr: "Quels secteurs sont forts en ce moment et lesquels sont à la traîne ?",
      pt: "Quais setores estão fortes agora e quais estão ficando para trás?",
    },
  },
  {
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
    label: { tr: "Hisse Analizi", en: "Stock Analysis", es: "Análisis de Acciones", fr: "Analyse d'Actions", pt: "Análise de Ações" },
    subtitle: { tr: "Skorlar, grafikler, teknikler", en: "Scores, charts, technicals", es: "Puntuaciones, gráficos, técnicos", fr: "Scores, graphiques, indicateurs", pt: "Pontuações, gráficos, técnicos" },
    prompt: {
      tr: "En yüksek BOGA skoruna sahip hisseler hangileri?", en: "Which stocks currently have the highest BOGA score?",
      es: "¿Qué acciones tienen actualmente la puntuación BOGA más alta?", fr: "Quelles actions ont actuellement le score BOGA le plus élevé ?",
      pt: "Quais ações têm atualmente a maior pontuação BOGA?",
    },
  },
  {
    icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    label: { tr: "Emtialar", en: "Commodities", es: "Materias Primas", fr: "Matières Premières", pt: "Commodities" },
    subtitle: { tr: "Enerji, metaller, tarım", en: "Energy, metals, agri", es: "Energía, metales, agrícola", fr: "Énergie, métaux, agriculture", pt: "Energia, metais, agrícola" },
    prompt: {
      tr: "Altın, petrol ve emtia piyasalarında son durum ne?", en: "What's the latest on gold, oil, and commodity markets?",
      es: "¿Cuál es la última novedad en los mercados de oro, petróleo y materias primas?", fr: "Quelles sont les dernières nouvelles sur l'or, le pétrole et les matières premières ?",
      pt: "Qual é a última novidade nos mercados de ouro, petróleo e commodities?",
    },
  },
  {
    icon: "M9 12h3.75M9 15h3.75M9 18h3.75M3.75 3v18a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V3m-16.5 0h16.5m-16.5 0v3h16.5V3",
    label: { tr: "Kazanç Sezonu", en: "Earnings Season", es: "Temporada de Resultados", fr: "Saison des Résultats", pt: "Temporada de Resultados" },
    subtitle: { tr: "Raporlar, tahminler, sürprizler", en: "Reports, estimates, beats", es: "Informes, estimaciones, sorpresas", fr: "Rapports, estimations, surprises", pt: "Relatórios, estimativas, surpresas" },
    prompt: {
      tr: "Bu çeyrekte hangi şirketlerin kazanç raporları takip edilmeli?", en: "Which companies' earnings reports should I watch this quarter?",
      es: "¿Qué informes de resultados de empresas debo seguir este trimestre?", fr: "Quels rapports de résultats d'entreprises dois-je suivre ce trimestre ?",
      pt: "Quais relatórios de resultados de empresas devo acompanhar este trimestre?",
    },
  },
];

interface Props {
  locale: Locale;
  lang: string;
  input: string;
  setInput: (v: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  loading: boolean;
  onSend: (text?: string) => void;
}

export default function SearchLandingEmptyState({ locale, input, setInput, inputRef, loading, onSend }: Props) {
  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const cardClass = "flex-1 rounded-2xl border border-[#1e2a3a] bg-[#0d1117]/60 p-6 flex flex-col hover:border-[#3b82f6]/40 transition-all";

  return (
    <div className="space-y-10 mt-10 md:mt-14 animate-fade-in max-w-6xl mx-auto w-full px-4 md:px-8">
      <div className="text-center space-y-5">
        <span className="inline-block px-3 py-1 rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6] text-[10px] font-black uppercase tracking-widest">
          {BADGE[locale]}
        </span>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">{HEADLINE[locale]}</h1>
        <p className="text-base md:text-lg text-[#94a3b8] max-w-2xl mx-auto">{SUBHEADLINE[locale]}</p>
      </div>

      {/* Flex satırı — önceki sürümde ikon/etiket absolute + textarea'da sabit
          pl-* ile hizalanıyordu; "Derin Analiz Modu" etiketinin genişliği
          placeholder metniyle çakışıyordu. Flexbox'ta her öğe kendi alanını
          doğal olarak paylaştığı için bu çakışma yapısal olarak imkansız. */}
      <div className="max-w-4xl mx-auto w-full flex items-center gap-2 md:gap-3 bg-[#0d1117] border border-[#1e2a3a] rounded-2xl pl-4 md:pl-5 pr-2 py-2 md:py-3 shadow-2xl shadow-blue-500/10 focus-within:border-[#3b82f6] transition-all">
        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#475569]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </span>
        <span className="hidden md:inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-full border border-[#1e2a3a] text-[#64748b] text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
          {MODE_LABEL[locale]}
        </span>
        <textarea
          id="search-landing-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={PLACEHOLDER[locale]}
          rows={1}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none resize-none text-base py-2"
        />
        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#475569]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
        </span>
        <button onClick={() => onSend()} disabled={loading || !input.trim()} className="shrink-0 p-3 rounded-xl bg-[#1d4ed8] text-white hover:bg-[#2563eb] disabled:opacity-50 disabled:bg-[#1e2a3a] transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={cardClass}>
          <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/15 text-[#3b82f6] flex items-center justify-center mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-6l-4 4v-4z" /></svg>
          </div>
          <div className="text-base font-black text-white">{ASK_TITLE[locale]}</div>
          <div className="text-sm text-[#94a3b8] mt-1">{ASK_DESC[locale]}</div>
          <p className="text-sm text-[#64748b] mt-3 flex-1">{ASK_BODY[locale]}</p>
          <button onClick={() => inputRef.current?.focus()} className="text-left text-sm font-black text-[#3b82f6] mt-4 hover:underline">
            {ASK_CTA[locale]} →
          </button>
        </div>

        <Link href={`/global/${locale}/home`} className={cardClass}>
          <div className="w-10 h-10 rounded-lg bg-[#06b6d4]/15 text-[#06b6d4] flex items-center justify-center mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          </div>
          <div className="text-base font-black text-white">{LISTS_TITLE[locale]}</div>
          <div className="text-sm text-[#94a3b8] mt-1">{LISTS_DESC[locale]}</div>
          <p className="text-sm text-[#64748b] mt-3 flex-1">{LISTS_BODY[locale]}</p>
          <span className="text-sm font-black text-[#06b6d4] mt-4 hover:underline">{LISTS_CTA[locale]} →</span>
        </Link>

        <Link href={`/global/${locale}`} className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#8b5cf6]/15 text-[#8b5cf6] flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] text-[9px] font-black uppercase tracking-wider">{TERMINAL_BADGE[locale]}</span>
          </div>
          <div className="text-base font-black text-white">{TERMINAL_TITLE[locale]}</div>
          <div className="text-sm text-[#94a3b8] mt-1">{TERMINAL_DESC[locale]}</div>
          <p className="text-sm text-[#64748b] mt-3 flex-1">{TERMINAL_BODY[locale]}</p>
          <span className="text-sm font-black text-[#8b5cf6] mt-4 hover:underline">{TERMINAL_CTA[locale]} →</span>
        </Link>
      </div>

      <div className="space-y-4 pb-8">
        <div className="text-[10px] font-black text-[#475569] uppercase tracking-widest text-center">{POPULAR_LABEL[locale]}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => onSend(topic.prompt[locale])}
              className="flex items-start gap-3 p-4 rounded-xl border border-[#1e2a3a] bg-[#0a0e17]/60 hover:bg-[#0d1117] hover:border-[#3b82f6]/50 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#1e2a3a]/60 text-[#94a3b8] flex items-center justify-center shrink-0 group-hover:text-[#3b82f6] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={topic.icon} /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-white group-hover:text-[#3b82f6] transition-colors">{topic.label[locale]}</div>
                <div className="text-xs text-[#64748b] mt-0.5 truncate">{topic.subtitle[locale]}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
