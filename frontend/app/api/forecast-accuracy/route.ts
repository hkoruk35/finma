import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Saatlik yön tahmininin GERÇEK isabet oranını takip eder — 2026-08-20
// kullanıcı geri bildirimi: "isabet oranı satırı asıl farklılaştırıcı,
// sahte bir sayı basmak yerine gerçek bir mekanizma kur." Ayrı bir cron
// YOK — ziyaretçi trafiğinin kendisi "resolve-on-visit" ile hem ufku
// dolmuş eski tahminleri çözüyor hem de yeni bir anlık görüntü kaydediyor
// (bkz. components/global/LiveAssetTable.tsx forecast-polling döngüsü,
// her 5 dk'da bir POST). Nötr (displayDirection==='neutral') tahminler
// hiç loglanmaz — "tuttu/tutmadı" kavramı yönsüz bir tahmin için tanımsız.
//
// Supabase tablosu (bir kere elle oluşturulmalı):
//
//   create table if not exists hourly_forecast_log (
//     id bigint generated always as identity primary key,
//     ticker text not null,
//     direction text not null check (direction in ('bullish','bearish')),
//     strength smallint,
//     price_at_snapshot double precision not null,
//     created_at timestamptz not null default now(),
//     resolved_at timestamptz,
//     price_at_resolve double precision,
//     hit boolean
//   );
//   create index if not exists hourly_forecast_log_ticker_created_idx
//     on hourly_forecast_log (ticker, created_at desc);
//   create index if not exists hourly_forecast_log_resolved_idx
//     on hourly_forecast_log (resolved_at);

const HORIZON_MS = 60 * 60 * 1000; // "saatlik tahmin" ufku — bkz. lib/hourlyForecast.ts nextHourBoundaryLabel
const DEDUPE_MS = 55 * 60 * 1000; // enstrüman başına ~1 kayıt/saat — sık trafikte tabloyu şişirmesin
const WINDOW_HOURS = 30; // "son 30 saatlik tahmin" — kullanıcının mockup'ta istediği pencere

// Public — herkes okuyabilir, satır tabloların altında gösterilir.
export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" };
  const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("hourly_forecast_log")
    .select("hit")
    .not("resolved_at", "is", null)
    .gte("created_at", cutoff);

  if (error || !data || data.length === 0) {
    return NextResponse.json({ hitRate: null, sampleSize: 0 }, { headers });
  }

  const sampleSize = data.length;
  const hits = data.filter((row) => row.hit === true).length;
  return NextResponse.json({ hitRate: hits / sampleSize, sampleSize }, { headers });
}

// Public, auth gerektirmez (quote/chart-data route'larıyla aynı desen) —
// ama gerçek bir kullanıcı eylemi tetiklemediğinden (sayfa ziyaretinin
// arka planında otomatik ateşleniyor), kötüye kullanımı yavaşlatmak için
// hafif bir IP rate-limit uygulanıyor.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`forecast-accuracy:${ip}`, 60, 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { ticker, direction, strength, price } = body as {
    ticker?: string;
    direction?: string;
    strength?: number;
    price?: number;
  };

  if (
    !ticker ||
    (direction !== "bullish" && direction !== "bearish") ||
    typeof price !== "number" ||
    !Number.isFinite(price)
  ) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const now = Date.now();

  // 1) Ufku dolmuş (created_at >= 1 saat önce), hâlâ çözülmemiş kayıtları çöz.
  const resolveCutoff = new Date(now - HORIZON_MS).toISOString();
  const { data: due } = await supabaseAdmin
    .from("hourly_forecast_log")
    .select("id, direction, price_at_snapshot")
    .eq("ticker", ticker)
    .is("resolved_at", null)
    .lte("created_at", resolveCutoff)
    .limit(5);

  if (due && due.length) {
    const resolvedAt = new Date().toISOString();
    for (const row of due) {
      const hit =
        row.direction === "bullish" ? price > row.price_at_snapshot : price < row.price_at_snapshot;
      await supabaseAdmin
        .from("hourly_forecast_log")
        .update({ resolved_at: resolvedAt, price_at_resolve: price, hit })
        .eq("id", row.id);
    }
  }

  // 2) Enstrüman başına ~saatte bir yeni anlık görüntü — sık ziyaretçi
  // trafiğinde tabloyu şişirmemek için dedupe.
  const dedupeCutoff = new Date(now - DEDUPE_MS).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("hourly_forecast_log")
    .select("id")
    .eq("ticker", ticker)
    .gte("created_at", dedupeCutoff)
    .limit(1);

  if (!recent || recent.length === 0) {
    await supabaseAdmin.from("hourly_forecast_log").insert({
      ticker,
      direction,
      strength: typeof strength === "number" ? Math.round(strength) : null,
      price_at_snapshot: price,
    });
  }

  return NextResponse.json({ ok: true });
}
