import { supabaseAdmin } from "@/lib/supabase-admin";

export interface PublicPost {
  id: string;
  ticker: string | null;
  sector: string | null;
  theme: string | null;
  locale: string;
  content_text: string | null;
  tweet_id: string | null;
  posted_at: string;
}

// Herkese acik /news akisi icin, hangi dilde uretilmis olursa olsun tum
// yayinlanmis X gonderilerini en yeniden en eskiye dogru dondurur.
export async function getPublicPosts(limit = 60): Promise<PublicPost[]> {
  const { data, error } = await supabaseAdmin
    .from("x_posts")
    .select("id, ticker, sector, theme, locale, content_text, tweet_id, posted_at")
    .eq("status", "posted")
    .not("posted_at", "is", null)
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[x/publicPosts] fetch failed:", error.message);
    return [];
  }
  return data ?? [];
}
