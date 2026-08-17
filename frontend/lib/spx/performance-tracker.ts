import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SPXSnapshot } from "./types";

export async function evaluatePendingLogs(snapshot: SPXSnapshot) {
  if (!snapshot.isLiveSession) return;

  const spxPrice = snapshot.spxPrice;
  
  // Sadece bugünün açık işlemlerini al
  const { data: pendingLogs, error } = await supabaseAdmin
    .from("supertrade_logs")
    .select("*")
    .eq("session_date", snapshot.sessionDate)
    .eq("status", "PENDING");

  if (error || !pendingLogs || pendingLogs.length === 0) return;

  for (const log of pendingLogs) {
    let newStatus: string | null = null;
    let analysisText: string | null = null;
    
    // Basit bir değerlendirme mantığı (Örnek)
    if (log.direction === "SHORT") {
      // Short işlemde fiyat iptal seviyesine (veya VWAP'ın üzerine) çıktıysa
      if (spxPrice >= log.invalidation_price) {
        newStatus = "LOST";
        analysisText = `SPX spot fiyatı iptal seviyesini (${log.invalidation_price.toFixed(2)}) yukarı yönlü kırdı ve işlem stop oldu.`;
      } 
      // Fiyat girişin en az 10 puan altındaysa başarılı kabul et
      else if (spxPrice <= log.entry_price - 10) {
        newStatus = "WON";
        analysisText = `Düşüş momentumu yakalandı. Girişten (${log.entry_price}) itibaren 10 puanlık hedef başarıyla alındı.`;
      }
    } else if (log.direction === "LONG") {
      if (spxPrice <= log.invalidation_price) {
        newStatus = "LOST";
        analysisText = `SPX spot fiyatı iptal seviyesini (${log.invalidation_price.toFixed(2)}) aşağı yönlü kırdı ve işlem stop oldu.`;
      } else if (spxPrice >= log.entry_price + 10) {
        newStatus = "WON";
        analysisText = `Yükseliş momentumu yakalandı. Girişten (${log.entry_price}) itibaren 10 puanlık hedef başarıyla alındı.`;
      }
    }

    if (newStatus) {
      await supabaseAdmin
        .from("supertrade_logs")
        .update({
          status: newStatus,
          exit_price: spxPrice,
          exit_time: new Date().toISOString(),
          analysis: analysisText
        })
        .eq("id", log.id);
    }
  }
}
