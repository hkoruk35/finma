"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/copy";

type L = Record<Locale, string>;

const QUESTION_TITLES: L[] = [
  {
    tr: "Bugün anlaması gereken en önemli gelişme ne?",
    en: "What is the most important development I should understand today?",
    es: "¿Cuál es el desarrollo más importante que debo entender hoy?",
    fr: "Quel est le développement le plus important que je dois comprendre aujourd'hui ?",
    pt: "Qual é o desenvolvimento mais importante que devo entender hoje?",
  },
  {
    tr: "Bugün ilgi alanlarıma uygun hangi haberler ve trendler ortaya çıkıyor?",
    en: "What important news and emerging trends match my interests today?",
    es: "¿Qué noticias importantes y tendencias emergentes coinciden con mis intereses hoy?",
    fr: "Quelles nouvelles importantes et tendances émergentes correspondent à mes intérêts aujourd'hui ?",
    pt: "Quais notícias importantes e tendências emergentes correspondem aos meus interesses hoje?",
  },
  {
    tr: "Bugün en yüksek sıralamadaki hisseler hangileri ve neyi yönlendiriyor?",
    en: "Which stocks rank highest on BogaSmart today—and what is driving them?",
    es: "¿Qué acciones se clasifican más alto en BogaSmart hoy y qué las impulsa?",
    fr: "Quelles actions se classent les plus hautes sur BogaSmart aujourd'hui et qu'est-ce qui les anime ?",
    pt: "Quais ações são classificadas mais altas em BogaSmart hoje e o que as impulsiona?",
  },
];

const CARD_LABELS: L[] = [
  {
    tr: "Sor",
    en: "Ask",
    es: "Preguntar",
    fr: "Demander",
    pt: "Perguntar",
  },
  {
    tr: "Keşfet",
    en: "Discover",
    es: "Descubrir",
    fr: "Découvrir",
    pt: "Descobrir",
  },
  {
    tr: "Piyasalar",
    en: "Markets",
    es: "Mercados",
    fr: "Marchés",
    pt: "Mercados",
  },
];

const CARD_DESCRIPTIONS: L[] = [
  {
    tr: "Kaynaklı AI araştırması",
    en: "Sourced AI research",
    es: "Investigación de IA con fuentes",
    fr: "Recherche IA sourçée",
    pt: "Pesquisa de IA com fontes",
  },
  {
    tr: "Haber ve kişisel akış",
    en: "News and personal feed",
    es: "Noticias y feed personal",
    fr: "Actualités et flux personnel",
    pt: "Notícias e feed pessoal",
  },
  {
    tr: "BogaSmart'ın güçlü altyapısı",
    en: "BogaSmart's powerful infrastructure",
    es: "Infraestructura poderosa de BogaSmart",
    fr: "Infrastructure puissante de BogaSmart",
    pt: "Infraestrutura poderosa do BogaSmart",
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
          className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
            selectedMode === "fast"
              ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
              : "bg-[#1e2a3a]/40 text-[#94a3b8] hover:text-white border border-[#1e2a3a]"
          }`}
        >
          ⚡ {RESEARCH_MODES.fast[locale]} Research
        </button>
        <span className="text-[#475569] text-xs">/</span>
        <button
          onClick={() => setSelectedMode("deep")}
          disabled={loading}
          className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
            selectedMode === "deep"
              ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
              : "bg-[#1e2a3a]/40 text-[#94a3b8] hover:text-white border border-[#1e2a3a]"
          }`}
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
                <span className="text-sm font-black uppercase tracking-widest text-[#3b82f6] group-hover:text-white transition-colors">
                  {CARD_LABELS[idx][locale]}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748b] group-hover:text-[#94a3b8] transition-colors">
                  {CARD_DESCRIPTIONS[idx][locale]}
                </span>
              </div>

              <p className={`text-sm font-bold leading-snug transition-colors ${
                activeCard === idx ? "text-white" : "text-[#cbd5e1]"
              }`}>
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
      <div className="text-center text-xs text-[#64748b] space-y-1">
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
