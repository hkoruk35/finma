"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicPost } from "@/lib/x/publicPosts";
import type { Locale } from "@/lib/i18n/copy";
import ShareButton from "@/components/ShareButton";

const SECTORS: Record<string, Record<string, string>> = {
  en: {
    "Consumer Discretionary": "Consumer Discretionary",
    "Consumer Cyclical": "Consumer Cyclical",
    "Consumer Defensive": "Consumer Defensive",
    "Financials": "Financials",
    "Financial Services": "Financial Services",
    "Industrials": "Industrials",
    "Technology": "Technology",
    "Real Estate": "Real Estate",
    "Energy": "Energy",
    "Communication Services": "Communication Services",
    "Utilities": "Utilities",
    "Basic Materials": "Basic Materials",
    "Healthcare": "Healthcare",
    "Other": "Other",
  },
  tr: {
    "Consumer Discretionary": "Tüketici İsteğine Bağlı",
    "Consumer Cyclical": "Tüketici Döngüseli",
    "Consumer Defensive": "Tüketici Savunma",
    "Financials": "Finansal",
    "Financial Services": "Finans Hizmetleri",
    "Industrials": "Sanayi",
    "Technology": "Teknoloji",
    "Real Estate": "Gayrimenkul",
    "Energy": "Enerji",
    "Communication Services": "İletişim Hizmetleri",
    "Utilities": "Kamu Hizmetleri",
    "Basic Materials": "Temel Malzemeler",
    "Healthcare": "Sağlık",
    "Other": "Diğer",
  },
  es: {
    "Consumer Discretionary": "Consumo Discrecional",
    "Consumer Cyclical": "Consumo Cíclico",
    "Consumer Defensive": "Consumo Defensivo",
    "Financials": "Financiero",
    "Financial Services": "Servicios Financieros",
    "Industrials": "Industrial",
    "Technology": "Tecnología",
    "Real Estate": "Bienes Raíces",
    "Energy": "Energía",
    "Communication Services": "Servicios de Comunicación",
    "Utilities": "Servicios Públicos",
    "Basic Materials": "Materiales Básicos",
    "Healthcare": "Sanitario",
    "Other": "Otro",
  },
  pt: {
    "Consumer Discretionary": "Consumo Discricionário",
    "Consumer Cyclical": "Consumo Cíclico",
    "Consumer Defensive": "Consumo Defensivo",
    "Financials": "Financeiro",
    "Financial Services": "Serviços Financeiros",
    "Industrials": "Industrial",
    "Technology": "Tecnologia",
    "Real Estate": "Imóvel",
    "Energy": "Energia",
    "Communication Services": "Serviços de Comunicação",
    "Utilities": "Serviços Públicos",
    "Basic Materials": "Materiais Básicos",
    "Healthcare": "Saúde",
    "Other": "Outro",
  },
  fr: {
    "Consumer Discretionary": "Consommation Discrétionnaire",
    "Consumer Cyclical": "Consommation Cyclique",
    "Consumer Defensive": "Consommation Défensive",
    "Financials": "Finance",
    "Financial Services": "Services Financiers",
    "Industrials": "Industrie",
    "Technology": "Technologie",
    "Real Estate": "Immobilier",
    "Energy": "Énergie",
    "Communication Services": "Services de Communication",
    "Utilities": "Services Publics",
    "Basic Materials": "Matériaux de Base",
    "Healthcare": "Santé",
    "Other": "Autre",
  },
};

const STRINGS: Record<string, { viewOnX: string; empty: string; loadMore: string }> = {
  en: { viewOnX: "View on X ↗", empty: "No posts yet — check back soon.", loadMore: "Load More" },
  es: { viewOnX: "Ver en X ↗", empty: "Aún no hay publicaciones — vuelve pronto.", loadMore: "Cargar Más" },
  fr: { viewOnX: "Voir sur X ↗", empty: "Pas encore de publications — revenez bientôt.", loadMore: "Charger Plus" },
  pt: { viewOnX: "Ver no X ↗", empty: "Ainda sem publicações — volte em breve.", loadMore: "Carregar Mais" },
  tr: { viewOnX: "X'te Gör ↗", empty: "Henüz gönderi yok — yakında tekrar bakın.", loadMore: "Daha Fazla Yükle" },
};

function formatDate(iso: string, locale: string): string {
  const langMap: Record<string, string> = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-PT", tr: "tr-TR" };
  const formatted = new Intl.DateTimeFormat(langMap[locale] ?? "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(iso));
  return `${formatted} NY`;
}

const VALID_LOCALES: Locale[] = ["en", "tr", "es", "fr", "pt", "id"];

const PAGE_SIZE = 6;

export default function NewsFeed({ posts, locale }: { posts: PublicPost[]; locale: string }) {
  const t = STRINGS[locale] ?? STRINGS.en;
  const sectors = SECTORS[locale] ?? SECTORS.en;
  const shareLocale = VALID_LOCALES.includes(locale as Locale) ? (locale as Locale) : "en";
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (posts.length === 0) {
    return <p className="text-center text-slate-400 py-16">{t.empty}</p>;
  }

  const visiblePosts = posts.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visiblePosts.map((post) => (
          <article
            key={post.id}
            className="glass-card p-5 flex flex-col gap-3 hover:bg-white/[0.02] transition-colors"
            itemScope
            itemType="https://schema.org/SocialMediaPosting"
          >
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-widest border-b border-white/5 pb-3">
              <span className="text-[#3b82f6] flex items-center gap-2 min-w-0">
                {post.ticker ? (
                  <Link href={`/global/${locale}/graphic/${post.ticker}`} className="hover:underline">
                    {post.ticker}
                  </Link>
                ) : (
                  "BOGASTOCK"
                )}
                {post.sector ? <span className="text-slate-500 normal-case font-normal border-l border-slate-700 pl-2 truncate">{sectors[post.sector] ?? post.sector}</span> : null}
              </span>
              <span className="bg-[#3b82f6]/10 text-[#3b82f6] px-2 py-1 rounded-sm text-[10px] shrink-0">{post.locale.toUpperCase()}</span>
            </div>
            <p className="text-white text-sm leading-relaxed font-medium line-clamp-4" itemProp="text">
              {post.content_text}
            </p>
            {post.image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={post.image_url}
                alt={`${post.ticker ?? "BOGASTOCK"} chart`}
                loading="lazy"
                className="w-full rounded-xl border border-white/10 mt-1 hover:border-white/20 transition-colors shadow-lg"
                itemProp="image"
              />
            )}
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-3 border-t border-white/5">
              <time dateTime={post.posted_at} itemProp="datePublished">
                {formatDate(post.posted_at, locale)}
              </time>
              <div className="flex items-center gap-3">
                {post.tweet_id && (
                  <a
                    href={`https://x.com/bogastock/status/${post.tweet_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3b82f6] hover:text-[#58a6ff] transition-colors font-medium"
                  >
                    {t.viewOnX}
                  </a>
                )}
                <ShareButton
                  locale={shareLocale}
                  shareText={post.content_text ?? `${post.ticker ?? "BOGASTOCK"} — BOGA AI`}
                  url={post.tweet_id ? `https://x.com/bogastock/status/${post.tweet_id}` : `https://bogastock.com/global/${locale}/news`}
                />
              </div>
            </div>
          </article>
        ))}
      </div>

      {visibleCount < posts.length && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
            className="px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider bg-[#1e293b] border border-[#3b82f6]/40 text-[#3b82f6] hover:bg-white/5 transition-colors"
          >
            {t.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
