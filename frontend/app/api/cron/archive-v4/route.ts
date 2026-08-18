import { NextResponse } from "next/server";
import { buildReplay } from "@/lib/v4/snapshot";
import { createClient } from "@supabase/supabase-js";
import { ASSET_MAP, AssetClass } from "@/lib/v4/types";
import { priceOption, impliedVolFor, minutesToClose } from "@/lib/v4/options";

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
          } else if (lost) {
            newStatus = "LOST";
          } else {
            // Seans sonuna kadar hedef veya stop görülmedi
            const lastFrame = replay.frames[replay.frames.length - 1];
            exitPrice = tradeAsset === "SPX" || tradeAsset === "NDX" ? lastFrame.spotPrice : lastFrame.futuresPrice;
            newStatus = "PENDING_EOD"; // Temporary status until premium is checked
          }

          const scale = ASSET_MAP[tradeAsset].scale;
          const step = 5 * scale;
          const strike = Math.round(trade.entry_price / step) * step;
          
          let entryPremium = 0;
          let exitPremium = 0;

          // Bulabildiğimiz ilk uygun kareyi giriş karesi olarak alıyoruz
          const entryFrame = replay.frames.find(f => f.time >= tradeTime) || replay.frames[0];
          const exitFrame = replay.frames.find(f => f.spotPrice === exitPrice || f.futuresPrice === exitPrice) || replay.frames[replay.frames.length - 1];

          if (entryFrame && exitFrame) {
            const isCall = trade.direction === "LONG";
            
            const [eH, eM] = entryFrame.timeLabel.split(":").map(Number);
            const eMinLeft = minutesToClose(eH * 60 + eM);
            const eIv = impliedVolFor(replay.context.volatility.vix, trade.entry_price, strike);
            entryPremium = priceOption(trade.entry_price, strike, eMinLeft, eIv, isCall).price;

            const [xH, xM] = exitFrame.timeLabel.split(":").map(Number);
            const xMinLeft = minutesToClose(xH * 60 + xM);
            const xIv = impliedVolFor(replay.context.volatility.vix, exitPrice, strike);
            exitPremium = priceOption(exitPrice, strike, xMinLeft, xIv, isCall).price;
          }

          // Nihai Karar: Opsiyon Primine Göre (KAZANÇ / KAYIP)
          if (exitPremium > entryPremium) {
            newStatus = "WON";
            analysis = "Net Sonuç: KAZANÇ (Hedef Göründü veya Gün Sonu Kâr)";
          } else {
            newStatus = "LOST";
            analysis = "Net Sonuç: KAYIP (Stop veya Süre Sonu Zarar)";
          }

          const strategyObj = trade.strategy_json || {};
          strategyObj.entryPremium = entryPremium;
          strategyObj.exitPremium = exitPremium;

          await supabase
            .from("supertrade_logs")
            .update({
              status: newStatus,
              exit_price: exitPrice,
              exit_time: new Date().toISOString(),
              analysis: analysis,
              strategy_json: strategyObj
            })
            .eq("id", trade.id);
            
        } catch(e) {
          console.error("Evaluation error for trade", trade.id, e);
        }
      }
    }
    // Gün sonu işlemleri (PENDING temizliği) tamamlandı.
    // Yeni tahmin (pre-market forecast) sistemi farklı bir akışta yönetilmektedir.
    results["cleanup"] = "Pending trades evaluated successfully.";

    return NextResponse.json({ ok: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Archive Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
