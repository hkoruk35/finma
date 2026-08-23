import { NextRequest, NextResponse } from "next/server";
import { getInsiderTransactions } from "@/lib/insider-data";

export const dynamic = "force-dynamic";

// 2026-08-23 kullanıcı talebiyle eklendi: hisse detay sayfasının (graphic/[ticker])
// "koordineli takip" bölümü için, tek bir ticker'a ait içeriden işlemleri
// istemci tarafından (client component) çekebilecek bir route yoktu —
// getInsiderTransactions() sadece server-side lib fonksiyonuydu ve
// supabaseAdmin (service-role key) kullandığı için doğrudan client'tan
// çağrılamaz. /insider sayfası ise tüm ticker'ları tek seferde çekiyordu
// (getRecentInsiderActivity), tek hisseye özel filtre yoktu.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "ticker parametresi zorunlu" }, { status: 400 });
  }
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "180", 10)));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  const transactions = await getInsiderTransactions(ticker.toUpperCase(), days, limit);

  return NextResponse.json(
    { ticker: ticker.toUpperCase(), data: transactions },
    { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=300" } }
  );
}
