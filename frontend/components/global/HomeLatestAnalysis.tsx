import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { getPublicPosts } from "@/lib/x/publicPosts";
import { getMultiQuote } from "@/lib/homeFeed";
import { formatNumber } from "@/lib/formatNumber";
import TickerHoverChart from "@/components/TickerHoverChart";

const STRINGS: Record<Locale, { title: string; all: string; empty: string }> = {
  tr: { title: "Hisse Analizleri", all: "Tümü", empty: "Henüz analiz yok." },
  en: { title: "Stock Analysis", all: "All", empty: "No analysis yet." },
  es: { title: "Análisis de Acciones", all: "Todo", empty: "Aún no hay análisis." },
  fr: { title: "Analyses d'Actions", all: "Tout", empty: "Pas encore d'analyse." },
  pt: { title: "Análises de Ações", all: "Todos", empty: "Ainda sem análises." },
  id: { title: "Analisis Saham", all: "Semua", empty: "Belum ada analisis." },
};

// Ana sayfada 4 farklı tarih formatı karışıyordu (2026-08-23 kullanıcı geri
// bildirimi) — bu artık site genelindeki DD.MM.YYYY HH:MM formatına
// (bkz. HomeIndexHighlights.tsx "NY:" satırı) hizalandı; önceden
// dateStyle:"medium" kullanıyordu ("21 Ağu 2026 22:30" gibi ayrı bir stil).
function formatDate(iso: string, locale: Locale): string {
  const langMap: Record<Locale, string> = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-PT", tr: "tr-TR", id: "id-ID" };
  const formatted = new Intl.DateTimeFormat(langMap[locale] ?? "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(iso));
  return `${formatted} NY`;
}

export default async function HomeLatestAnalysis({ locale }: { locale: Locale }) {
  const t = STRINGS[locale] ?? STRINGS.en;
  // 2026-08-23 kullanıcı talebi: 4 kart yerine 3, ve metin /news sayfasındaki
  // gibi TAM (kesilmemiş) gösterilsin — aşağıda line-clamp-2 kaldırıldı.
  const posts = await getPublicPosts(locale, 3);
  const newsHref = `/global/${locale}/news`;

  if (posts.length === 0) return null;

  const tickers = [...new Set(posts.map((p) => p.ticker).filter((t): t is string => !!t))];
  const quotes = tickers.length ? await getMultiQuote(tickers) : {};

  return (
    <div className="bg-[#202327] border border-[#30343A]/60 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30343A]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0 bg-[#FFFFFF]" />
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold tracking-tight text-[#FFFFFF] truncate">{t.title}</h3>
          </div>
        </div>
        <Link
          href={newsHref}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] bg-[#1e293b] border border-[#FFFFFF]/30 text-[#FFFFFF] rounded-full font-bold tracking-wide transition-all duration-200 hover:bg-white/5 shrink-0"
        >
          {t.all}
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex-none w-[85%] sm:w-auto snap-center flex flex-col gap-2 rounded-lg border border-[#30343A]/60 bg-white/[0.02] p-3 hover:bg-white/[0.04] hover:border-[#FFFFFF]/40 transition-colors"
          >
            {post.ticker && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TickerHoverChart ticker={post.ticker} locale={locale}>
                    <Link href={newsHref} className="text-[11px] font-bold text-[#FFFFFF] tracking-wide hover:underline shrink-0">
                      ${post.ticker}
                    </Link>
                  </TickerHoverChart>
                  {post.company && <span className="text-[11px] text-white/50 truncate">{post.company}</span>}
                </div>
                {quotes[post.ticker] && (
                  <span className="text-[11px] font-mono font-semibold shrink-0">
                    {formatNumber(quotes[post.ticker].value, 2)}{" "}
                    <span className={quotes[post.ticker].change_pct >= 0 ? "text-[#4CAF7D]" : "text-[#E2726B]"}>
                      {quotes[post.ticker].change_pct >= 0 ? "+" : ""}
                      {formatNumber(quotes[post.ticker].change_pct, 2)}%
                    </span>
                  </span>
                )}
              </div>
            )}
            <Link href={newsHref} className="contents">
              {post.content_text && (
                <p className="text-white text-[13px] leading-snug font-medium">{post.content_text}</p>
              )}
              <time dateTime={post.posted_at} className="text-[9px] text-slate-500 mt-1">
                {formatDate(post.posted_at, locale)}
              </time>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
