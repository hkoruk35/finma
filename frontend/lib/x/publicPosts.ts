import { supabaseAdmin } from "@/lib/supabase-admin";
import { isProductionBuild } from "@/lib/buildPhase";

export interface PublicPost {
  id: string;
  ticker: string | null;
  sector: string | null;
  theme: string | null;
  locale: string;
  content_text: string | null;
  tweet_id: string | null;
  image_url: string | null;
  posted_at: string;
}

// Herkese acik /news akisi icin, SADECE istenen dildeki yayinlanmis X
// gonderilerini en yeniden en eskiye dogru dondurur. Her locale sayfasi
// (app/global/{locale}/news/page.tsx) kendi dilini gecirir — /global/tr/news
// sadece locale='tr' postlari gorur, /global/en/news sadece 'en' vb.
export async function getPublicPosts(locale: string, limit = 60): Promise<PublicPost[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("x_posts")
      .select("id, ticker, sector, theme, locale, content_text, tweet_id, image_url, posted_at")
      .eq("status", "posted")
      .eq("locale", locale)
      .not("posted_at", "is", null)
      .order("posted_at", { ascending: false })
      .limit(limit)
      .abortSignal(AbortSignal.timeout(20000)); // Build sirasinda (Vercel) timeout olmamasi icin 20s verildi

    if (error) {
      console.error("[x/publicPosts] fetch failed:", error.message);
      throw error;
    }
    return data ?? [];
  } catch (err) {
    console.error("[x/publicPosts] exception:", err);
    // Calisma aninda firlatmak ISR'in onceki basarili sayfayi korumasini
    // saglar; build sirasinda ise geri donulecek cache yoktur ve ayni throw
    // tum deploy'u patlatir (bkz. lib/buildPhase.ts).
    if (isProductionBuild()) return [];
    throw err;
  }
}
