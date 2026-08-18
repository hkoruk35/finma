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

    const assetsToArchive = Object.keys(ASSET_MAP) as AssetClass[];

    // --- PENDING İŞLEMLERİN OTONOM DEĞERLENDİRİLMESİ ---
    const { data: pendingTrades } = await supabase
      .from("supertrade_logs")
      .select("*")
      .eq("status", "PENDING");

    if (pendingTrades && pendingTrades.length > 0) {
      for (const trade of pendingTrades) {
        try {
          const tradeAsset = (trade.asset || "SPX") as AssetClass;
          const replay = await buildReplay(tradeAsset, trade.session_date);
          if (!replay.ok || !replay.frames.length) continue;

          // Trade created time in seconds
          const tradeTime = new Date(trade.created_at).getTime() / 1000;
          let won = false;
          let lost = false;
          let exitPrice = trade.entry_price;

          const target = trade.target_price;
          const stop = trade.invalidation_price;

          for (const frame of replay.frames) {
            // İşlemden önceki barları atla (küçük bir güvenlik marjı: 1 saat)
            if (frame.time < tradeTime - 3600) continue;
            
            const price = tradeAsset === "SPX" || tradeAsset === "NDX" ? frame.spotPrice : frame.futuresPrice;

            if (trade.direction === "SHORT") {
              if (stop && price >= stop) {
                lost = true;
                exitPrice = stop;
                break;
              }
              if (target && price <= target) {
                won = true;
                exitPrice = target;
                break;
              }
            } else {
              // LONG
              if (stop && price <= stop) {
                lost = true;
                exitPrice = stop;
                break;
              }
              if (target && price >= target) {
                won = true;
                exitPrice = target;
                break;
              }
            }
          }

          let newStatus = "PENDING";
          let analysis = "";
          
          if (won) {
            newStatus = "WON";
            analysis = "Hedef fiyata başarıyla ulaşıldı.";
          } else if (lost) {
            newStatus = "LOST";
            analysis = "Stop (İptal) seviyesi kırılarak işlem zararla kapandı.";
          } else {
            // Seans sonuna kadar hedef veya stop görülmedi
            const lastFrame = replay.frames[replay.frames.length - 1];
            exitPrice = tradeAsset === "SPX" || tradeAsset === "NDX" ? lastFrame.spotPrice : lastFrame.futuresPrice;
            const pnl = trade.direction === "SHORT" ? trade.entry_price - exitPrice : exitPrice - trade.entry_price;
            
            if (pnl > 0) {
              newStatus = "CHOP"; 
              analysis = `Seans sonuna kadar hedef veya stop görülmedi, günü kârla kapattı (PnL: ${pnl.toFixed(2)}).`;
            } else {
              newStatus = "LOST";
              analysis = `Seans sonuna kadar hedef veya stop görülmedi, günü zararla kapattı (PnL: ${pnl.toFixed(2)}).`;
            }
          }

          await supabase
            .from("supertrade_logs")
            .update({
              status: newStatus,
              exit_price: exitPrice,
              exit_time: new Date().toISOString(),
              analysis: analysis
            })
            .eq("id", trade.id);
            
        } catch(e) {
          console.error("Evaluation error for trade", trade.id, e);
        }
      }
    }
    // ---------------------------------------------------

    for (const asset of assetsToArchive) {
      try {
        const replay = await buildReplay(asset);
        
        if (!replay.ok || !replay.frames.length) {
          results[asset] = "No replay data found";
          continue;
        }

        const sessionDate = replay.date;
        const lastFrame = replay.frames[replay.frames.length - 1];
        const decision = lastFrame.decision;
        
        const { data: existing } = await supabase
          .from("supertrade_logs")
          .select("id")
          .eq("session_date", sessionDate)
          .eq("asset", asset)
          .single();

        if (existing) {
          results[asset] = `${sessionDate} already archived`;
          continue;
        }

        const target = decision.direction === "SHORT"
          ? lastFrame.spotPrice - Math.max(5, replay.levels.spot.orSize * 2)
          : lastFrame.spotPrice + Math.max(5, replay.levels.spot.orSize * 2);

        const { error: insertError } = await supabase
          .from("supertrade_logs")
          .insert({
            asset: asset,
            session_date: sessionDate,
            signal_state: lastFrame.state,
            direction: decision.direction,
            entry_price: lastFrame.spotPrice,
            invalidation_price: decision.triggerLevelValue || 0,
            target_price: target,
            net_score: lastFrame.netScore,
            status: "PENDING",
          });

        if (insertError) {
          results[asset] = `Error: ${insertError.message}`;
          continue;
        }

        results[asset] = `${sessionDate} archived successfully`;
      } catch (err: any) {
        results[asset] = `Error: ${err.message}`;
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Archive Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
