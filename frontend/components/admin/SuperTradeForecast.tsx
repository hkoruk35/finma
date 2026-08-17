import { Panel, Row, Badge, toneClass } from "@/components/admin/supertrade/ui";
import type { SPXSnapshot } from "@/lib/spx/types";

export default function SuperTradeForecast({ snapshot }: { snapshot: SPXSnapshot }) {
  if (!snapshot) return null;

  const { levels, context, spxPrice, esPrice, vixPrice } = snapshot;

  // Basit bir tahmin motoru
  let bias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  let score = 0;

  // 1. VWAP konumu
  if (esPrice > levels.es.vwap) score += 1;
  else if (esPrice < levels.es.vwap) score -= 1;

  // 2. ORH / ORL konumu
  if (spxPrice > levels.spx.orh) score += 2;
  else if (spxPrice < levels.spx.orl) score -= 2;

  // 3. VIX Trendi
  if (context.volatility.trend === "FALLING") score += 1;
  else if (context.volatility.trend === "RISING") score -= 1;

  // 4. Tarihsel Benzerlik
  if (context.analog.bias === "BULLISH") score += 1;
  else if (context.analog.bias === "BEARISH") score -= 1;

  if (score >= 2) bias = "BULLISH";
  else if (score <= -2) bias = "BEARISH";

  let analysisText = "";
  if (bias === "BULLISH") {
    analysisText = "Kapanışın VWAP ve direnç seviyeleri üzerinde olması, alıcıların kontrolü ele aldığını gösteriyor. VIX seviyesindeki gevşeme de bu durumu destekliyor. Ertesi gün için yukarı yönlü (Gap Up) açılış veya yükseliş trendinin devamı beklenebilir.";
  } else if (bias === "BEARISH") {
    analysisText = "Kapanışın kritik seviyelerin ve VWAP'ın altında kalması, zayıflığa işaret ediyor. Artan veya yüksek kalan VIX oynaklığı satıcıların iştahlı olduğunu gösteriyor. Ertesi gün zayıf bir açılış (Gap Down) muhtemeldir.";
  } else {
    analysisText = "Piyasa günü denge arayışı içinde tamamladı. Belirgin bir alıcı veya satıcı baskısı yok. Yarınki açılış yönü büyük ihtimalle gece seansındaki (overnight) gelişmelere bağlı olacaktır.";
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4">
      <Panel title="Ertesi Gün Yön Beklentisi" padding="p-4">
        <div className="flex items-center gap-3">
          <Badge tone={bias === "BULLISH" ? "up" : bias === "BEARISH" ? "down" : "neutral"}>
            {bias === "BULLISH" ? "YÜKSELİŞ BEKLENTİSİ" : bias === "BEARISH" ? "DÜŞÜŞ BEKLENTİSİ" : "YATAY / YÖNSÜZ"}
          </Badge>
          <span className="text-[14px] font-medium text-slate-200">Tahmin Skoru: {score}</span>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-slate-300">
          {analysisText}
        </p>
      </Panel>

      <Panel title="Tahmin Faktörleri" padding="p-4">
        <div className="space-y-2">
          <Row 
            label="Kapanış Seviyesi (SPX)" 
            value={spxPrice.toFixed(2)} 
            valueClass={spxPrice > levels.spx.orh ? "text-[#22c55e]" : spxPrice < levels.spx.orl ? "text-[#ef4444]" : "text-slate-300"}
          />
          <Row 
            label="VWAP Durumu (ES)" 
            value={`ES ${esPrice > levels.es.vwap ? "Üzerinde" : "Altında"}`} 
            valueClass={esPrice > levels.es.vwap ? "text-[#22c55e]" : "text-[#ef4444]"}
          />
          <Row 
            label="Oynaklık (VIX)" 
            value={`${vixPrice.toFixed(2)} - ${context.volatility.trend === "RISING" ? "Yükseliyor" : context.volatility.trend === "FALLING" ? "Düşüyor" : "Yatay"}`} 
            valueClass={context.volatility.trend === "FALLING" ? "text-[#22c55e]" : context.volatility.trend === "RISING" ? "text-[#ef4444]" : "text-slate-300"}
          />
          <Row 
            label="Tarihsel Benzerlik" 
            value={context.analog.bias === "BULLISH" ? "Yükseliş" : context.analog.bias === "BEARISH" ? "Düşüş" : "Nötr"} 
            valueClass={context.analog.bias === "BULLISH" ? "text-[#22c55e]" : context.analog.bias === "BEARISH" ? "text-[#ef4444]" : "text-slate-300"}
          />
        </div>
      </Panel>
    </div>
  );
}
