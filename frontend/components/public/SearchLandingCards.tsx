"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/copy";

type L = Record<Locale, string>;

const QUESTION_TITLES: L[] = [
  {
    tr: "Bugün dünyada bilmeliyim dediğim başlıca olay nedir?",
    en: "What is the most important thing happening in the world right now?",
    es: "¿Cuál es lo más importante que está sucediendo en el mundo ahora?",
    fr: "Quel est l'événement le plus important qui se produit dans le monde en ce moment ?",
    pt: "Qual é o evento mais importante acontecendo no mundo agora?",
  },
  {
    tr: "Bulunduğum ülkede ve ilgi alanlarımda neler oluyor?",
    en: "What's happening in my interests and around me today?",
    es: "¿Qué está pasando en mis intereses y alrededor hoy?",
    fr: "Que se passe-t-il dans mes centres d'intérêt et autour de moi aujourd'hui ?",
    pt: "O que está acontecendo nos meus interesses e ao meu redor hoje?",
  },
  {
    tr: "Piyasada hangi şirketler/hisseler öne çıkıyor ve neden?",
    en: "Which companies and stocks are leading the market today and why?",
    es: "¿Qué empresas y acciones están liderando el mercado hoy y por qué?",
    fr: "Quelles entreprises et actions mènent le marché aujourd'hui et pourquoi ?",
    pt: "Quais empresas e ações estão liderando o mercado hoje e por quê?",
  },
];

const CARD_LABELS: L[] = [
  {
    tr: "SORGU",
    en: "QUERY",
    es: "CONSULTA",
    fr: "REQUÊTE",
    pt: "CONSULTA",
  },
  {
    tr: "KİŞİSEL",
    en: "PERSONAL",
    es: "PERSONAL",
    fr: "PERSONNEL",
    pt: "PESSOAL",
  },
  {
    tr: "FİNANS",
    en: "FINANCE",
    es: "FINANZAS",
    fr: "FINANCE",
    pt: "FINANÇAS",
  },
];

const CARD_DESCRIPTIONS: L[] = [
  {
    tr: "Dünya gündemini anla",
    en: "Understand global events",
    es: "Comprende los eventos globales",
    fr: "Comprendre les événements mondiaux",
    pt: "Entenda os eventos globais",
  },
  {
    tr: "Kişisel keşif ve ilgi alanları",
    en: "Personal discovery & interests",
    es: "Descubrimiento personal e intereses",
    fr: "Découverte personnelle et intérêts",
    pt: "Descoberta pessoal e interesses",
  },
  {
    tr: "Finans & piyasa haberler",
    en: "Finance & market news",
    es: "Finanzas y noticias de mercado",
    fr: "Finance et actualités du marché",
    pt: "Finanças e notícias de mercado",
  },
];

const RESEARCH_MODES: Record<"fast" | "deep", L> = {
  fast: {
    tr: "Hızlı",
    en: "Fast",
    es: "Rápido",
    fr: "Rapide",
    pt: "Rápido",
  },
  deep: {
    tr: "Derin",
    en: "Deep",
    es: "Profundo",
    fr: "Profond",
    pt: "Profundo",
  },
};

interface Props {
  locale: Locale;
  onAsk: (question: string, mode: "fast" | "deep") => void;
  loading?: boolean;
}

export default function SearchLandingCards({ locale, onAsk, loading = false }: Props) {
  const [selectedMode, setSelectedMode] = useState<"fast" | "deep">("fast");
  const [activeCard, setActiveCard] = useState<number | null>(null);

  return (
    <div className="mt-16 max-w-5xl mx-auto w-full px-4 space-y-8">
      {/* Research Mode Toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setSelectedMode("fast")}
          disabled={loading}
          className={`px-5 py-2 rounded-full font-semibold uppercase tracking-wider transition-all ${
            selectedMode === "fast"
              ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
              : "bg-[#1e2a3a]/40 text-[#94a3b8] hover:text-white border border-[#1e2a3a]"
          }`}
          style={{ fontSize: '12px', fontFamily: 'Inter' }}
        >
          ⚡ {RESEARCH_MODES.fast[locale]} Research
        </button>
        <span className="text-[#475569]" style={{ fontSize: '12px', fontFamily: 'Inter' }}>/</span>
        <button
          onClick={() => setSelectedMode("deep")}
          disabled={loading}
          className={`px-5 py-2 rounded-full font-semibold uppercase tracking-wider transition-all ${
            selectedMode === "deep"
              ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
              : "bg-[#1e2a3a]/40 text-[#94a3b8] hover:text-white border border-[#1e2a3a]"
          }`}
          style={{ fontSize: '12px', fontFamily: 'Inter' }}
        >
          🔍 {RESEARCH_MODES.deep[locale]} Research
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {QUESTION_TITLES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveCard(idx);
              onAsk(QUESTION_TITLES[idx][locale], selectedMode);
            }}
            disabled={loading}
            onMouseEnter={() => !loading && setActiveCard(idx)}
            onMouseLeave={() => setActiveCard(null)}
            className={`group relative p-6 rounded-2xl transition-all duration-300 text-left ${
              loading
                ? "opacity-50 cursor-not-allowed"
                : "hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer"
            }`}
            style={{
              background:
                activeCard === idx
                  ? "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)"
                  : "linear-gradient(135deg, #0a0e17 0%, #0d1117 100%)",
              border: activeCard === idx ? "2px solid #3b82f6" : "2px solid #1e2a3a",
            }}
          >
            {/* Corner accent */}
            <div className="absolute top-0 right-0 w-12 h-12 opacity-5 group-hover:opacity-10 transition-opacity">
              <svg viewBox="0 0 48 48" className="w-full h-full text-[#3b82f6]">
                <path
                  fill="currentColor"
                  d="M0 48V0h48"
                />
              </svg>
            </div>

            <div className="relative z-10 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#3b82f6] group-hover:text-white transition-colors" style={{ fontSize: '12px', fontFamily: 'Inter' }}>
                  {CARD_LABELS[idx][locale]}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-[#64748b] group-hover:text-[#94a3b8] transition-colors" style={{ fontSize: '12px', fontFamily: 'Inter' }}>
                  {CARD_DESCRIPTIONS[idx][locale]}
                </span>
              </div>

              <p className={`font-semibold leading-snug transition-colors ${
                activeCard === idx ? "text-white" : "text-[#cbd5e1]"
              }`} style={{ fontSize: '14px', fontFamily: 'Inter' }}>
                {QUESTION_TITLES[idx][locale]}
              </p>

              {/* Decorative arrow */}
              <div className="pt-2">
                <svg className="w-4 h-4 text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Info text */}
      <div className="text-center text-[#64748b] space-y-1" style={{ fontSize: '12px', fontFamily: 'Inter' }}>
        <p>
          {selectedMode === "fast"
            ? locale === "tr"
              ? "Hızlı cevap — kaynak olmadan net sonuçlar"
              : locale === "es"
              ? "Respuesta rápida — resultados sin fuentes"
              : locale === "fr"
              ? "Réponse rapide — résultats sans sources"
              : locale === "pt"
              ? "Resposta rápida — resultados sem fontes"
              : "Fast answer — results without sources"
            : locale === "tr"
            ? "Derin araştırma — kaynaklı detaylı sonuçlar"
            : locale === "es"
            ? "Investigación profunda — resultados detallados con fuentes"
            : locale === "fr"
            ? "Recherche approfondie — résultats détaillés avec sources"
            : locale === "pt"
            ? "Pesquisa profunda — resultados detalhados com fontes"
            : "Deep Research — detailed results with sources"}
        </p>
      </div>
    </div>
  );
}
