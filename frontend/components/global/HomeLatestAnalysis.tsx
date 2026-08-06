import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { getPublicPosts } from "@/lib/x/publicPosts";

const STRINGS: Record<Locale, { title: string; subtitle: string; all: string; empty: string }> = {
  tr: { title: "Son Analizler", subtitle: "BOGA AI'nin son hisse analizleri", all: "TÜMÜ", empty: "Henüz analiz yok." },
  en: { title: "Latest Analysis", subtitle: "BOGA AI's most recent stock analyses", all: "ALL", empty: "No analysis yet." },
  es: { title: "Últimos Análisis", subtitle: "Los análisis bursátiles más recientes de BOGA AI", all: "TODO", empty: "Aún no hay análisis." },
  fr: { title: "Dernières Analyses", subtitle: "Les analyses boursières les plus récentes de BOGA AI", all: "TOUT", empty: "Pas encore d'analyse." },
  pt: { title: "Últimas Análises", subtitle: "As análises de ações mais recentes da BOGA AI", all: "TODOS", empty: "Ainda sem análises." },
};

function formatDate(iso: string, locale: Locale): string {
  const langMap: Record<Locale, string> = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-PT", tr: "tr-TR" };
  const formatted = new Intl.DateTimeFormat(langMap[locale] ?? "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(iso));
  return `${formatted} NY`;
}

export default async function HomeLatestAnalysis({ locale }: { locale: Locale }) {
  const t = STRINGS[locale] ?? STRINGS.en;
  const posts = await getPublicPosts(locale, 4);
  const newsHref = `/global/${locale}/news`;

  if (posts.length === 0) return null;

  return (
    <div className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-4 rounded-full shrink-0 bg-[#3b82f6]" />
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold uppercase tracking-tight text-[#3b82f6] truncate">{t.title}</h3>
            <p className="text-[11px] text-slate-500 truncate">{t.subtitle}</p>
          </div>
        </div>
        <Link
          href={newsHref}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] bg-[#1e293b] border border-[#3b82f6]/30 text-[#3b82f6] rounded-full font-bold uppercase tracking-wider transition-all duration-200 hover:bg-white/5 shrink-0"
        >
          {t.all}
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={newsHref}
            className="flex flex-col gap-2 rounded-lg border border-[#1e2a3a]/60 bg-white/[0.02] p-3 hover:bg-white/[0.04] hover:border-[#3b82f6]/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide">
              <span className="text-[#3b82f6]">{post.ticker ?? "BOGASTOCK"}</span>
            </div>
            {post.content_text && (
              <p className="text-white text-[13px] leading-snug font-medium line-clamp-2">{post.content_text}</p>
            )}
            {post.image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={post.image_url}
                alt={`${post.ticker ?? "BOGASTOCK"} chart`}
                loading="lazy"
                className="w-full rounded-lg border border-white/10 mt-1"
              />
            )}
            <time dateTime={post.posted_at} className="text-[10px] text-slate-500 mt-1">
              {formatDate(post.posted_at, locale)}
            </time>
          </Link>
        ))}
      </div>
    </div>
  );
}
