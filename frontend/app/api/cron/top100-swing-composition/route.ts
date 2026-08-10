import { NextRequest, NextResponse } from "next/server";
import { getSwingAllPicks } from "@/lib/data";

/**
 * GET /api/cron/top100-swing-composition
 *
 * Top 100 Tracker'ın "swing_daily" dilimini (10 hisse) /swing sayfasının en
 * güncel verisinden yeniden belirler — update_top100_swing.py'nin sunucu
 * tarafındaki karşılığı, aynı kaynak (swing_all_picks.json) ve aynı kural
 * (skora göre ilk 10), aynı endpoint (/api/internal/top100-sync).
 *
 * Neden buraya taşındı: o script REVALIDATE_SECRET'ı bu makinenin ortam
 * değişkenlerinden okuyordu, orada tanımlı değildi ve kök .env'deki değer
 * Vercel'dekiyle eşleşmiyordu. Sonuç: BOGA_AI_Top100_Swing10 her çalışmada
 * hata verdi ve kompozisyon 2026-06-26'da dondu — Top 100'ün 10 satırı
 * haftalardır yanlış hisseleri gösteriyordu (2026-08-10'da tespit edildi).
 * Burada, Vercel'in kendi içinde, process.env.REVALIDATE_SECRET tanım gereği
 * doğru; hiçbir sırrın elle eşitlenmesi gerekmiyor.
 *
 * Zamanlama update_top100_swing.py ile aynı bırakıldı: günde bir kez,
 * NY 14:00 (= 18:00 UTC). Fiyat/gösterge tazelemesi ayrı ve saatlik
 * (/api/cron/refresh-top100) — kompozisyon bilerek saatlik değiştirilmiyor.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";
const TOP_N = 10;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "REVALIDATE_SECRET is not configured" }, { status: 500 });
  }

  try {
    const data = await getSwingAllPicks();
    const picks: any[] = data?.picks ?? [];
    if (picks.length === 0) {
      // Boş liste ile sync çağırmak mevcut kompozisyonu silerdi; veri
      // gelmediğinde dokunmadan çıkmak doğru davranış.
      return NextResponse.json({ skipped: "swing_all_picks.json bos", updated: 0 });
    }

    const top10 = [...picks]
      .sort((a, b) => (b?.score ?? b?.boga_score ?? 0) - (a?.score ?? a?.boga_score ?? 0))
      .slice(0, TOP_N)
      .map((p) => p.ticker)
      .filter(Boolean);

    if (top10.length === 0) {
      return NextResponse.json({ skipped: "ticker cikarilamadi", updated: 0 });
    }

    const res = await fetch(`${BASE_URL}/api/internal/top100-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": process.env.REVALIDATE_SECRET,
      },
      body: JSON.stringify({ tickers: top10, source: "swing_daily" }),
      signal: AbortSignal.timeout(120000),
    });

    const result = await res.json().catch(() => ({ error: "gecersiz yanit" }));
    if (!res.ok) {
      console.error("[cron/top100-swing-composition] sync failed:", result);
      return NextResponse.json({ error: "sync failed", details: result }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      sourceDate: data?.date ?? null,
      tickers: top10,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/top100-swing-composition] error:", error);
    return NextResponse.json({ error: "cron failed", message: String(error) }, { status: 500 });
  }
}
