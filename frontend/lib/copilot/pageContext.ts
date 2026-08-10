// Kullanıcının o an baktığı /graphic/[ticker] sayfasındaki "BOGA AI Swing
// Strateji Durumu" panelinde GÖRÜNEN gerçek veriyi (SwingStrategyStatusCard.tsx
// ile aynı kaynak: swing_all_picks.json / watchlist_picks.json) system prompt'a
// enjekte eder. Amaç: "grafikteki analizi kim yaptı", "giriş bölgesi neden bu"
// gibi sayfa-özel sorularda model gerçekten sayfada göründüğü şeyi anlatsın,
// genel/belirsiz bir cevap uydurmasın.

import { getSwingPicksBackfilled, getWatchlistPicks } from "@/lib/data";
import { formatNumber } from "@/lib/formatNumber";

const LAYER_LABELS: Record<string, Record<string, string>> = {
  tr: { "1D_Trend": "1D Trend", "4H_Quality": "4H Kalite", "1H_Momentum": "1H Momentum" },
  en: { "1D_Trend": "1D Trend", "4H_Quality": "4H Quality", "1H_Momentum": "1H Momentum" },
  es: { "1D_Trend": "Tendencia 1D", "4H_Quality": "Calidad 4H", "1H_Momentum": "Momentum 1H" },
  fr: { "1D_Trend": "Tendance 1D", "4H_Quality": "Qualité 4H", "1H_Momentum": "Momentum 1H" },
  pt: { "1D_Trend": "Tendência 1D", "4H_Quality": "Qualidade 4H", "1H_Momentum": "Momentum 1H" },
};

export async function getSwingStrategySnapshot(ticker: string, locale: string): Promise<string | null> {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;

  const [swingData, watchData] = await Promise.all([
    getSwingPicksBackfilled(10).catch(() => null),
    getWatchlistPicks().catch(() => null),
  ]);

  const swingPick = (swingData?.picks || []).find((p: any) => p.ticker === t);
  const watchPick = (watchData?.picks || []).find((p: any) => p.ticker === t);
  const labels = LAYER_LABELS[locale] || LAYER_LABELS.en;

  if (swingPick) {
    const lines: string[] = [
      `- Durum: ${swingPick.entry_status === "ENTERED" ? "Giriş Zone (hassas giriş noktası yakalandı)" : "Bekle (henüz hassas giriş tetiklenmedi)"}`,
    ];
    if (swingPick.entry_zone) {
      lines.push(`- Giriş Bölgesi: $${formatNumber(swingPick.entry_zone.low, 2)} – $${formatNumber(swingPick.entry_zone.high, 2)}`);
    }
    if (swingPick.detail_reasoning) lines.push(`- Gerekçe: ${swingPick.detail_reasoning}`);
    if (Array.isArray(swingPick.selection_reasons) && swingPick.selection_reasons.length > 0) {
      const passed = swingPick.selection_reasons
        .filter((k: string) => labels[k])
        .map((k: string) => labels[k]);
      if (passed.length > 0) lines.push(`- Onaylanan Katmanlar: ${passed.join(", ")}`);
    }
    const f = swingPick.factor_scores;
    if (f) {
      lines.push(
        `- Faktör Skorları: Trend ${f.trend_score ?? "—"}, Momentum ${f.momentum_score ?? "—"}, Volatilite/Pullback ${f.volatility_score ?? "—"}, Hacim/RVOL ${f.volume_score ?? "—"}, Sektör ${f.catalyst_score ?? "—"}`
      );
    }
    if (typeof swingPick.score === "number") lines.push(`- BOGA Skoru: ${swingPick.score}/100`);

    return `${t} — Sayfada gösterilen BOGA AI Swing Strateji Durumu paneli (bu, botun swing117_boga.py motorunun gerçek çıktısıdır, tahmini/uydurma değildir):\n${lines.join("\n")}`;
  }

  if (watchPick) {
    return `${t} — Bu hisse şu anda BOGA AI'nin Watchlist havuzunda izleniyor, henüz aktif Swing adayı değil. Havuza eklenme: ${watchPick.date_added || "N/A"}.`;
  }

  return `${t} — Bu hisse şu anda BOGA AI'nin aktif Swing/Watchlist tarama havuzunda değil (kriterleri henüz karşılamıyor).`;
}
