import { NextResponse } from "next/server";
import { buildReplay } from "@/lib/v4/snapshot";
import { createClient } from "@supabase/supabase-js";
import { ASSET_MAP, AssetClass } from "@/lib/v4/types";

// Vercel Cron endpoint
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Cron doğrulaması (Opsiyonel olarak Authorization header kontrol edilebilir)
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      // Geliştirme ortamı için şimdilik bypass edilebilir
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, string> = {};

    // Sadece SPX için loglama yapalım, veya hepsi için
    const asset: AssetClass = "SPX"; 
    
    // Geçmiş seansı yüklemek için buildReplay kullanıyoruz.
    // Tarih belirtmezsek en son kapanmış seansı (availableDates'in sonuncusu) yükler.
    const replay = await buildReplay(asset);
    
    if (!replay.ok || !replay.frames.length) {
      return NextResponse.json({ error: "No replay data found" }, { status: 400 });
    }

    const sessionDate = replay.date;
    const lastFrame = replay.frames[replay.frames.length - 1];
    const decision = lastFrame.decision;
    
    // Veritabanında bu tarihe ait kayıt var mı kontrol et
    const { data: existing } = await supabase
      .from("supertrade_logs")
      .select("id")
      .eq("session_date", sessionDate)
      .single();

    if (existing) {
      results[asset] = `${sessionDate} already archived`;
      return NextResponse.json({ ok: true, message: "Already archived", results });
    }

    // Hedef fiyat hesaplaması
    const target = decision.direction === "SHORT"
      ? lastFrame.spotPrice - Math.max(5, replay.levels.spot.orSize * 2)
      : lastFrame.spotPrice + Math.max(5, replay.levels.spot.orSize * 2);

    // Kayıt oluştur
    const { error: insertError } = await supabase
      .from("supertrade_logs")
      .insert({
        session_date: sessionDate,
        signal_state: lastFrame.state,
        direction: decision.direction,
        entry_price: lastFrame.spotPrice, // Kapanış fiyatını baz alıyoruz
        invalidation_price: decision.triggerLevelValue || 0,
        target_price: target,
        net_score: lastFrame.netScore,
        status: "PENDING", // Ertesi gün kapanışında WON/LOST olarak güncellenebilir
      });

    if (insertError) {
      throw insertError;
    }

    results[asset] = `${sessionDate} archived successfully`;

    return NextResponse.json({ ok: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Archive Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
