import type { PublicPost } from "@/lib/x/publicPosts";

const STRINGS: Record<string, { viewOnX: string; empty: string }> = {
  en: { viewOnX: "View on X ↗", empty: "No posts yet — check back soon." },
  es: { viewOnX: "Ver en X ↗", empty: "Aún no hay publicaciones — vuelve pronto." },
  fr: { viewOnX: "Voir sur X ↗", empty: "Pas encore de publications — revenez bientôt." },
  pt: { viewOnX: "Ver no X ↗", empty: "Ainda sem publicações — volte em breve." },
  tr: { viewOnX: "X'te Gör ↗", empty: "Henüz gönderi yok — yakında tekrar bakın." },
};

function formatDate(iso: string, locale: string): string {
  const langMap: Record<string, string> = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-PT", tr: "tr-TR" };
  return new Intl.DateTimeFormat(langMap[locale] ?? "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function NewsFeed({ posts, locale }: { posts: PublicPost[]; locale: string }) {
  const t = STRINGS[locale] ?? STRINGS.en;

  if (posts.length === 0) {
    return <p className="text-center text-slate-400 py-16">{t.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <article
          key={post.id}
          className="glass-card p-6 flex flex-col gap-2"
          itemScope
          itemType="https://schema.org/SocialMediaPosting"
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
            <span className="text-[#3b82f6]">
              {post.ticker ?? "BOGASTOCK"}
              {post.sector ? <span className="text-slate-500 normal-case font-normal ml-2">{post.sector}</span> : null}
            </span>
            <span className="text-slate-500">{post.locale.toUpperCase()}</span>
          </div>
          <p className="text-white leading-relaxed" itemProp="text">
            {post.content_text}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
            <time dateTime={post.posted_at} itemProp="datePublished">
              {formatDate(post.posted_at, locale)}
            </time>
            {post.tweet_id && (
              <a
                href={`https://x.com/bogastock/status/${post.tweet_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:text-white transition-colors font-bold"
              >
                {t.viewOnX}
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
