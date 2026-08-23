import { NextRequest, NextResponse } from "next/server";
import { getPublicPostsByTicker } from "@/lib/x/publicPosts";

export const dynamic = "force-dynamic";

// 2026-08-23 kullanıcı talebiyle eklendi: hisse detay sayfasının (graphic/[ticker])
// "koordineli takip" bölümü, o hisseyle ilgili yayınlanmış X analiz
// gönderilerini (mevcut /news akışıyla AYNI kaynak — x_posts) client
// component'ten çekebilsin diye.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  const locale = searchParams.get("locale") || "en";
  if (!ticker) {
    return NextResponse.json({ error: "ticker parametresi zorunlu" }, { status: 400 });
  }
  const limit = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") || "6", 10)));

  const posts = await getPublicPostsByTicker(ticker.toUpperCase(), locale, limit);

  return NextResponse.json(
    { ticker: ticker.toUpperCase(), locale, data: posts },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=59" } }
  );
}
