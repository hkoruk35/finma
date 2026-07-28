"use client";

import { RefObject, KeyboardEvent } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { POPULAR_TICKERS } from "@/components/AIContainer";

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
const POPULAR_LABEL: L = { tr: "POPÜLER HİSSELER", en: "POPULAR STOCKS", es: "ACCIONES POPULARES", fr: "ACTIONS POPULAIRES", pt: "AÇÕES POPULARES" };

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

  const cardClass = "flex-1 rounded-2xl border border-[#1e2a3a] bg-[#0d1117]/60 p-5 flex flex-col hover:border-[#3b82f6]/40 transition-all";

  return (
    <div className="space-y-10 mt-10 md:mt-16 animate-fade-in max-w-3xl mx-auto w-full">
      <div className="text-center space-y-4">
        <span className="inline-block px-3 py-1 rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6] text-[10px] font-black uppercase tracking-widest">
          {BADGE[locale]}
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">{HEADLINE[locale]}</h1>
        <p className="text-sm md:text-base text-[#94a3b8] max-w-xl mx-auto">{SUBHEADLINE[locale]}</p>
      </div>

      <div className="relative group">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={PLACEHOLDER[locale]}
          rows={1}
          className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-2xl pl-12 pr-28 py-5 text-sm focus:outline-none focus:border-[#3b82f6] transition-all resize-none group-hover:border-[#3b82f6]/40 shadow-2xl shadow-blue-500/5"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-[#475569] pointer-events-none">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </span>
        <span className="hidden md:inline-flex absolute right-16 top-1/2 -translate-y-1/2 items-center gap-1 px-2.5 py-1 rounded-full border border-[#1e2a3a] text-[#64748b] text-[10px] font-black uppercase tracking-wider">
          {MODE_LABEL[locale]}
        </span>
        <button onClick={() => onSend()} disabled={loading || !input.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-[#1d4ed8] text-white hover:bg-[#2563eb] disabled:opacity-50 disabled:bg-[#1e2a3a] transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={cardClass}>
          <div className="w-9 h-9 rounded-lg bg-[#3b82f6]/15 text-[#3b82f6] flex items-center justify-center mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-6l-4 4v-4z" /></svg>
          </div>
          <div className="text-sm font-black text-white">{ASK_TITLE[locale]}</div>
          <div className="text-xs text-[#94a3b8] mt-1">{ASK_DESC[locale]}</div>
          <p className="text-xs text-[#64748b] mt-3 flex-1">{ASK_BODY[locale]}</p>
          <button onClick={() => inputRef.current?.focus()} className="text-left text-xs font-black text-[#3b82f6] mt-3 hover:underline">
            {ASK_CTA[locale]} →
          </button>
        </div>

        <Link href={`/global/${locale}/home`} className={cardClass}>
          <div className="w-9 h-9 rounded-lg bg-[#a78bfa]/15 text-[#a78bfa] flex items-center justify-center mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          </div>
          <div className="text-sm font-black text-white">{LISTS_TITLE[locale]}</div>
          <div className="text-xs text-[#94a3b8] mt-1">{LISTS_DESC[locale]}</div>
          <p className="text-xs text-[#64748b] mt-3 flex-1">{LISTS_BODY[locale]}</p>
          <span className="text-xs font-black text-[#a78bfa] mt-3 hover:underline">{LISTS_CTA[locale]} →</span>
        </Link>

        <Link href={`/global/${locale}`} className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#06b6d4]/15 text-[#06b6d4] flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#06b6d4]/10 text-[#06b6d4] text-[9px] font-black uppercase tracking-wider">{TERMINAL_BADGE[locale]}</span>
          </div>
          <div className="text-sm font-black text-white">{TERMINAL_TITLE[locale]}</div>
          <div className="text-xs text-[#94a3b8] mt-1">{TERMINAL_DESC[locale]}</div>
          <p className="text-xs text-[#64748b] mt-3 flex-1">{TERMINAL_BODY[locale]}</p>
          <span className="text-xs font-black text-[#06b6d4] mt-3 hover:underline">{TERMINAL_CTA[locale]} →</span>
        </Link>
      </div>

      <div className="space-y-3 pb-6">
        <div className="text-[10px] font-black text-[#475569] uppercase tracking-widest text-center">{POPULAR_LABEL[locale]}</div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {POPULAR_TICKERS.map((item) => (
            <button
              key={item.ticker}
              onClick={() => onSend(item.ticker)}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#1e2a3a] bg-[#0a0e17]/60 hover:bg-[#0d1117] hover:border-[#3b82f6]/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all text-center group"
            >
              <span className="text-xs font-black text-white tracking-wider group-hover:text-[#3b82f6] transition-colors">{item.ticker}</span>
              <span className="text-[9px] text-[#64748b] font-bold mt-0.5 truncate max-w-full">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
