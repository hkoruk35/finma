"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/copy";

type L = Record<Locale, string>;

const QUESTION_TITLES: L[] = [
  {
    tr: "Dünyada öne çıkan gelişmeler neler ?",
    en: "What are the key developments in the world?",
    es: "¿Cuáles son los acontecimientos clave en el mundo?",
    fr: "Quels sont les développements clés dans le monde ?",
    pt: "Quais são os principais acontecimentos no mundo?",
  },
  {
    tr: "İlgi alanlarımda bugün neler oluyor?",
    en: "What is happening in my interests today?",
    es: "¿Qué está pasando hoy en mis intereses?",
    fr: "Que se passe-t-il dans mes centres d'intérêt aujourd'hui ?",
    pt: "O que está acontecendo nos meus interesses hoje?",
  },
  {
    tr: "Bugün piyasalarda durum nasıl?",
    en: "How is the situation in the markets today?",
    es: "¿Cómo está la situación en los mercados hoy?",
    fr: "Comment est la situation sur les marchés aujourd'hui ?",
    pt: "Como está a situação nos mercados hoje?",
  },
];

const CARD_LABELS: L[] = [
  {
    tr: "GÜNDEM",
    en: "AGENDA",
    es: "AGENDA",
    fr: "AGENDA",
    pt: "AGENDA",
  },
  {
    tr: "BANA ÖZEL",
    en: "PERSONALIZED",
    es: "PERSONALIZADO",
    fr: "PERSONNALISÉ",
    pt: "PERSONALIZADO",
  },
  {
    tr: "PİYASALAR",
    en: "MARKETS",
    es: "MERCADOS",
    fr: "MARCHÉS",
    pt: "MERCADOS",
  },
];

const CARD_DESCRIPTIONS: L[] = [
  {
    tr: "Dünyada öne çıkan gelişmeler",
    en: "Key global developments",
    es: "Acontecimientos mundiales clave",
    fr: "Développements mondiaux clés",
    pt: "Acontecimentos mundiais importantes",
  },
  {
    tr: "Konumuma ve ilgi alanlarıma göre",
    en: "Based on my location & interests",
    es: "Basado en mi ubicación e intereses",
    fr: "Selon ma position et mes intérêts",
    pt: "Com base na minha localização e interesses",
  },
  {
    tr: "Şirketler, sektörler ve piyasa hareketleri",
    en: "Companies, sectors & market moves",
    es: "Empresas, sectores y movimientos de mercado",
    fr: "Entreprises, secteurs et mouvements du marché",
    pt: "Empresas, setores e movimentos do mercado",
  },
];

const RESEARCH_MODES: Record<"fast" | "deep", L> = {
  fast: {
    tr: "Hızlı Yanıt",
    en: "Fast Answer",
    es: "Respuesta Rápida",
    fr: "Réponse Rapide",
    pt: "Resposta Rápida",
  },
  deep: {
    tr: "Derin Araştırma",
    en: "Deep Research",
    es: "Investigación Profunda",
    fr: "Recherche Approfondie",
    pt: "Pesquisa Profunda",
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
    <div className="mt-6 md:mt-8 max-w-5xl mx-auto w-full px-4 space-y-6 md:space-y-8">
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
          ⚡ {RESEARCH_MODES.fast[locale]}
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
          🔍 {RESEARCH_MODES.deep[locale]}
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
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-2">
                <span className="text-xs font-medium uppercase tracking-widest text-[#3b82f6] group-hover:text-white transition-colors" style={{ fontSize: '12px', fontFamily: 'Inter' }}>
                  {CARD_LABELS[idx][locale]}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-[#64748b] group-hover:text-[#94a3b8] transition-colors" style={{ fontSize: '11px', fontFamily: 'Inter' }}>
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
