"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Locale, LOCALES, academyIndex } from "@/lib/academy-i18n";

const ARTICLES = [
  {
    href: "/academy/how-to-start-investing",
    icon: "📈",
    level: "Beginner",
    color: "#22c55e",
    en: { title: "How to Start Investing in US Stocks", desc: "Step-by-step guide for absolute beginners. Learn exchanges, strategies, and risk rules." },
    es: { title: "Cómo Empezar a Invertir en Acciones de EE.UU.", desc: "Guía paso a paso para principiantes absolutos." },
    pt: { title: "Como Começar a Investir em Ações dos EUA", desc: "Guia passo a passo para iniciantes absolutos." },
    fr: { title: "Comment Commencer à Investir en Bourse Américaine", desc: "Guide étape par étape pour les débutants absolus." },
    tr: { title: "ABD Borsasında Yatırıma Nasıl Başlanır?", desc: "Mutlak yeni başlayanlar için adım adım rehber." },
    id: { title: "Cara Mulai Berinvestasi di Saham AS", desc: "Panduan langkah demi langkah untuk pemula mutlak." },
  },
  {
    href: "/academy/rsi-indicator",
    icon: "📊",
    level: "Intermediate",
    color: "#f59e0b",
    en: { title: "RSI Indicator Explained", desc: "Master RSI: spot overbought & oversold levels and time better entries." },
    es: { title: "Indicador RSI Explicado", desc: "Domina el RSI: detecta niveles sobrecomprados y sobrevendidos." },
    pt: { title: "Indicador RSI Explicado", desc: "Domine o RSI: detecte níveis de sobrecompra e sobrevenda." },
    fr: { title: "L'Indicateur RSI Expliqué", desc: "Maîtrisez le RSI : repérez les niveaux de surachat et de survente." },
    tr: { title: "RSI Göstergesi Açıklandı", desc: "RSI'da ustalaşın: aşırı alım ve satım seviyelerini tespit edin." },
    id: { title: "Indikator RSI Dijelaskan", desc: "Kuasai RSI: deteksi level overbought dan oversold." },
  },
  {
    href: "/academy/momentum-trading",
    icon: "⚡",
    level: "Intermediate",
    color: "#f59e0b",
    en: { title: "Momentum Trading Explained", desc: "How fast-moving stocks work and how to catch the move before everyone else." },
    es: { title: "Momentum Trading Explicado", desc: "Cómo funcionan las acciones de rápido movimiento y cómo entrar antes que todos." },
    pt: { title: "Momentum Trading Explicado", desc: "Como ações de movimento rápido funcionam e como entrar antes de todos." },
    fr: { title: "Le Momentum Trading Expliqué", desc: "Comment les actions à mouvement rapide fonctionnent et comment entrer avant tout le monde." },
    tr: { title: "Momentum Trading Açıklandı", desc: "Hızlı hareket eden hisseler nasıl çalışır ve hamleyi herkesten önce nasıl yakalanır." },
    id: { title: "Momentum Trading Dijelaskan", desc: "Bagaimana saham bergerak cepat bekerja dan cara masuk sebelum semua orang." },
  },
  {
    href: "/academy/ai-stock-picking",
    icon: "🤖",
    level: "BOGA AI Edge",
    color: "#3b82f6",
    en: { title: "AI Stock Picking Explained", desc: "How algorithms find winning stocks faster, better, and without human emotion." },
    es: { title: "Selección de Acciones con IA Explicada", desc: "Cómo los algoritmos encuentran acciones ganadoras más rápido y sin emoción humana." },
    pt: { title: "Seleção de Ações por IA Explicada", desc: "Como algoritmos encontram ações vencedoras mais rapidamente, sem emoção humana." },
    fr: { title: "La Sélection d'Actions par IA Expliquée", desc: "Comment les algorithmes trouvent les actions gagnantes plus vite, sans émotion humaine." },
    tr: { title: "Yapay Zeka Hisse Seçimi Açıklandı", desc: "Algoritmalar kazanan hisseleri daha hızlı, daha iyi ve insan duygusuz nasıl bulur." },
    id: { title: "Pemilihan Saham AI Dijelaskan", desc: "Bagaimana algoritma menemukan saham pemenang lebih cepat, tanpa emosi manusia." },
  },
];

const LEVELS_CONFIG = [
  { key: "Beginner", icon: "🌱", labelMap: { en: "Level 1 – Beginner", es: "Nivel 1 – Principiante", pt: "Nível 1 – Iniciante", fr: "Niveau 1 – Débutant", tr: "Seviye 1 – Başlangıç", id: "Tingkat 1 – Pemula" }, color: "#22c55e" },
  { key: "Intermediate", icon: "📊", labelMap: { en: "Level 2 – Intermediate", es: "Nivel 2 – Intermedio", pt: "Nível 2 – Intermediário", fr: "Niveau 2 – Intermédiaire", tr: "Seviye 2 – Orta Düzey", id: "Tingkat 2 – Menengah" }, color: "#f59e0b" },
  { key: "BOGA AI Edge", icon: "🤖", labelMap: { en: "Level 3 – BOGA AI Edge", es: "Nivel 3 – Ventaja BOGA AI", pt: "Nível 3 – Vantagem BOGA AI", fr: "Niveau 3 – Avantage BOGA AI", tr: "Seviye 3 – BOGA AI Avantajı", id: "Tingkat 3 – Keunggulan BOGA AI" }, color: "#3b82f6" },
];

const UI_STRINGS = {
  read_guide: { en: "Read Guide", es: "Leer Guía", pt: "Leia o Guia", fr: "Lire le Guide", tr: "Rehberi Oku", id: "Baca Panduan" },
  start_cta: { en: "Start Free AI Stock Analysis", es: "Inicia el Análisis Gratuito con IA", pt: "Iniciar Análise Gratuita de IA", fr: "Démarrer l'Analyse IA Gratuite", tr: "Ücretsiz Yapay Zeka Analizini Başlat", id: "Mulai Analisis Saham AI Gratis" },
  view_live: { en: "View Live AI Analysis →", es: "Ver Análisis de IA en Vivo →", pt: "Ver Análise IA ao Vivo →", fr: "Voir l'Analyse IA en Direct →", tr: "Canlı Yapay Zeka Analizini Gör →", id: "Lihat Analisis AI Langsung →" },
  all_articles: { en: "All Academy Articles", es: "Todos los Artículos de la Academia", pt: "Todos os Artigos da Academia", fr: "Tous les Articles de l'Académie", tr: "Tüm Akademi Makaleleri", id: "Semua Artikel Akademi" },
};

export default function AcademyIndexClient() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("boga_academy_lang") as Locale | null;
    if (saved) setLocale(saved);
  }, []);

  const handleLocale = (l: Locale) => {
    setLocale(l);
    localStorage.setItem("boga_academy_lang", l);
  };

  const hero = academyIndex.hero[locale];

  return (
    <div className="min-h-screen bg-[#000036]">
      {/* Sticky nav */}
      <div className="border-b border-[#1e2a3a] bg-[#0d1117]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-xs text-[#00d2ff]">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span className="text-white font-semibold">Academy</span>
          </nav>
          <LanguageSwitcher currentLocale={locale} onChange={handleLocale} />
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[#1e2a3a]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/10 via-transparent to-[#8b5cf6]/10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[11px] font-black text-[#3b82f6] uppercase tracking-[0.25em] mb-8">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse"></span>
              BOGA AI Academy
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-6">
              {hero.h1}
            </h1>
            <p className="text-xl text-white leading-relaxed mb-10 max-w-2xl mx-auto">
              {hero.sub}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/admin/account/register"
                id="academy-hero-cta"
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] text-white font-black text-lg shadow-xl shadow-blue-500/20 transition-all"
              >
                {hero.cta}
              </Link>
              <Link
                href="/"
                className="px-8 py-4 rounded-2xl bg-[#141924] border border-[#1e2a3a] text-white font-bold hover:bg-[#1a2030] hover:border-[#3b82f6]/30 transition-all"
              >
                {UI_STRINGS.view_live[locale]}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Articles by Level */}
      <div className="max-w-7xl mx-auto px-4 py-20 space-y-20">
        {LEVELS_CONFIG.map((level) => {
          const articles = ARTICLES.filter((a) => a.level === level.key);
          return (
            <section key={level.key} id={`level-${level.key.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="flex items-center gap-4 mb-8">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
                  style={{ background: `${level.color}20`, border: `1px solid ${level.color}40` }}
                >
                  {level.icon}
                </div>
                <div>
                  <div
                    className="text-[10px] font-black uppercase tracking-[0.25em] mb-1"
                    style={{ color: level.color }}
                  >
                    {level.labelMap[locale]}
                  </div>
                  <div className="w-20 h-1 rounded-full" style={{ background: level.color }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {articles.map((article) => {
                  const t = article[locale] as { title: string; desc: string };
                  return (
                    <Link
                      key={article.href}
                      href={article.href}
                      className="glass-card p-7 group hover:border-[#3b82f6]/40 hover:bg-[#141924] transition-all relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#3b82f6]/3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="flex items-start gap-4 mb-5">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                          style={{ background: `${article.color}15`, border: `1px solid ${article.color}30` }}
                        >
                          {article.icon}
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-[9px] font-black uppercase tracking-[0.2em] mb-2"
                            style={{ color: article.color }}
                          >
                            {article.level}
                          </div>
                          <h3 className="text-lg font-black text-white leading-snug group-hover:text-[#3b82f6] transition-colors">
                            {t.title}
                          </h3>
                        </div>
                      </div>
                      <p className="text-sm text-white leading-relaxed mb-5">{t.desc}</p>
                      <div className="flex items-center gap-2 text-[#3b82f6] text-sm font-bold">
                        <span>{UI_STRINGS.read_guide[locale]}</span>
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Final CTA Banner */}
        <div className="glass-card p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/8 to-[#8b5cf6]/8 pointer-events-none" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]" />
          <div className="relative z-10">
            <div className="text-5xl mb-6">🚀</div>
            <h2 className="text-3xl font-black text-white mb-4">{hero.cta}</h2>
            <p className="text-white mb-10 max-w-xl mx-auto leading-relaxed">
              Join thousands of investors already using BOGA AI to analyze 560 US stocks daily and find the highest-conviction opportunities before the market does.
            </p>
            <Link
              href="/admin/account/register"
              id="academy-cta-final"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] text-white font-black text-lg shadow-2xl shadow-blue-500/30 transition-all"
            >
              {hero.cta}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
