"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Locale, academyIndex } from "@/lib/academy-i18n";

interface ArticleSection {
  h2: string;
  body: string;
  link?: { label: string; href: string };
  cta?: boolean;
}

interface ArticleContent {
  h1: string;
  intro: string;
  sections: ArticleSection[];
  cta_text: string;
  cta_btn: string;
}

type ContentMap = Record<Locale, ArticleContent>;

interface Props {
  articleKey: string;
  content: ContentMap;
  metaTitle?: string;
  breadcrumb?: { label: string; href: string };
  relatedArticles?: { title: string; href: string; tag: string }[];
}

const CTA_GRADIENT =
  "bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#2563eb] hover:to-[#7c3aed] text-white font-black tracking-wide shadow-xl shadow-blue-500/20";

export default function AcademyArticleClient({
  articleKey,
  content,
  breadcrumb,
  relatedArticles = [],
}: Props) {
  const [locale, setLocale] = useState<Locale>("en");
  
  useEffect(() => {
    const saved = localStorage.getItem("boga_academy_lang") as Locale | null;
    if (saved && content[saved]) setLocale(saved);
  }, [content]);

  const handleLocale = (l: Locale) => {
    setLocale(l);
    localStorage.setItem("boga_academy_lang", l);
  };

  const t = content[locale];
  const idx = academyIndex;

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Top bar */}
      <div className="border-b border-[#1e2a3a] bg-[#0d1117]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-[#00d2ff]" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/admin/education/academy" className="hover:text-white transition-colors">Academy</Link>
            {breadcrumb && (
              <>
                <span>/</span>
                <span className="text-white">{breadcrumb.label}</span>
              </>
            )}
          </nav>
          <LanguageSwitcher currentLocale={locale} onChange={handleLocale} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Article Header */}
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="px-3 py-1 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[10px] font-black text-[#3b82f6] uppercase tracking-[0.2em]">
              BOGA AI Academy
            </div>
            <div className="px-3 py-1 rounded-full bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[10px] font-black text-[#8b5cf6] uppercase tracking-[0.2em]">
              Free Guide
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-6">
            {t.h1}
          </h1>
          <p className="text-lg text-white leading-relaxed border-l-4 border-[#3b82f6] pl-5 mt-4">
            {t.intro}
          </p>
        </header>

        {/* Article Body */}
        <article className="space-y-12" itemScope itemType="https://schema.org/Article">
          {t.sections.map((section, i) => (
            <section key={i} className="scroll-mt-20">
              <h2 className="text-xl md:text-2xl font-black text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6] text-sm font-mono font-black shrink-0">
                  {i + 1}
                </span>
                {section.h2}
              </h2>

              <div className="glass-card p-6">
                <p className="text-white leading-relaxed whitespace-pre-line text-sm md:text-base">
                  {section.body}
                </p>

                {section.link && (
                  <Link
                    href={section.link.href}
                    className="inline-flex items-center gap-2 mt-4 text-[#3b82f6] text-sm font-semibold hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    {section.link.label}
                  </Link>
                )}

                {section.cta && (
                  <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-[#3b82f6]/10 to-[#8b5cf6]/10 border border-[#3b82f6]/20">
                    <p className="text-white font-medium mb-3 text-sm">
                      🔥 {t.cta_text}
                    </p>
                    <Link
                      href="/admin/account/register"
                      className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm transition-all ${CTA_GRADIENT}`}
                    >
                      {t.cta_btn}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                )}
              </div>
            </section>
          ))}
        </article>

        {/* Final CTA */}
        <div className="mt-16 glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/5 to-[#8b5cf6]/5 pointer-events-none" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]" />
          <div className="relative z-10">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-2xl font-black text-white mb-3">{t.cta_text}</h3>
            <p className="text-white mb-8 max-w-md mx-auto text-sm leading-relaxed">
              Join thousands of investors already using BOGA AI to analyze 560 US stocks daily.
            </p>
            <Link
              href="/admin/account/register"
              className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base transition-all ${CTA_GRADIENT}`}
            >
              {t.cta_btn}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-16">
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-wider">
              Continue Learning
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedArticles.map((article, i) => (
                <Link
                  key={i}
                  href={article.href}
                  className="glass-card p-5 flex items-center gap-4 group hover:border-[#3b82f6]/30 hover:bg-[#141924] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] shrink-0 text-lg">
                    📖
                  </div>
                  <div>
                    <div className="text-[10px] text-[#3b82f6] font-black uppercase tracking-widest mb-1">
                      {article.tag}
                    </div>
                    <div className="text-sm font-medium text-white group-hover:text-[#3b82f6] transition-colors">
                      {article.title}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-[#2c3e50] group-hover:text-[#3b82f6] ml-auto transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Back to Academy */}
        <div className="mt-12 text-center">
          <Link
            href="/admin/education/academy"
            className="inline-flex items-center gap-2 text-sm text-[#00d2ff] hover:text-[#3b82f6] transition-colors font-semibold"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Academy
          </Link>
        </div>
      </div>
    </div>
  );
}
