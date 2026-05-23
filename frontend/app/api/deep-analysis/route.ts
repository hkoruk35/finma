import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 90;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { ticker, stockData } = await req.json();
    if (!ticker || !stockData) {
      return NextResponse.json({ error: "Missing ticker or stockData" }, { status: 400 });
    }

    const s = stockData;
    const pr = s.price || {};
    const tech = s.technical || {};
    const sc = s.scores || {};
    const sd = s.scores_detail || s.strategy || {};
    const forecast: any[] = Array.isArray(s.forecast) ? s.forecast : (Array.isArray(s.forecast?.days) ? s.forecast.days : []);

    const currentPrice = pr.current || 0;
    const rsi = tech.rsi_14 || 50;
    const iv = tech.iv || tech.impliedVolatility || 40;
    const atr = tech.atr || currentPrice * 0.025;
    const ema20 = tech.ema_20 || currentPrice * 0.98;
    const ema50 = tech.ema_50 || currentPrice * 0.97;
    const ema200 = tech.ema_200 || currentPrice * 0.93;
    const masterScore = sc.master_score || 50;
    const support1 = sd.stop_loss || currentPrice * 0.95;
    const resistance1 = sd.target_price || currentPrice * 1.08;
    const sector = s.sector || "N/A";
    const industry = s.industry || "N/A";
    const companyName = s.company || ticker;
    const marketCap = s.marketCap || s.market_cap || 0;

    // Build 15-day forecast summary from Monte Carlo data
    const forecast15 = forecast.slice(0, 15).map((d: any, i: number) => ({
      day: i + 1,
      bear: d.bear ?? d.low ?? (currentPrice * (1 - 0.015 * (i + 1))),
      base: d.base ?? d.median ?? (currentPrice * (1 + 0.003 * (i + 1))),
      bull: d.bull ?? d.high ?? (currentPrice * (1 + 0.02 * (i + 1))),
    }));

    const prompt = `Sen BOGA AI - profesyonel bir opsiyon stratejisti ve teknik analistsin.
Aşağıdaki hisse verilerini kullanarak kapsamlı bir DERİN ANALİZ raporu üret.
Raporun tüm metin kısımları Türkçe olacak. Sadece ticker sembolleri ve finansal terimler İngilizce kalabilir.

HISSE: ${ticker.toUpperCase()} — ${companyName}
Sektör: ${sector} | Endüstri: ${industry}
Güncel Fiyat: $${currentPrice.toFixed(2)}
BOGA Skor: ${masterScore}/100
RSI (14): ${rsi.toFixed(1)}
EMA 20: $${ema20.toFixed(2)} | EMA 50: $${ema50.toFixed(2)} | EMA 200: $${ema200.toFixed(2)}
ATR: $${atr.toFixed(2)} (fiyatın %${((atr / currentPrice) * 100).toFixed(1)}'i)
Destek: $${support1.toFixed(2)} | Direnç: $${resistance1.toFixed(2)}
IV (tahmini): %${iv}
Piyasa Değeri: ${marketCap > 1e9 ? "$" + (marketCap / 1e9).toFixed(1) + "B" : "$" + (marketCap / 1e6).toFixed(0) + "M"}
15 Günlük Forecast (Monte Carlo):
${forecast15.map(d => `Gün ${d.day}: Bear $${d.bear.toFixed(2)} | Base $${d.base.toFixed(2)} | Bull $${d.bull.toFixed(2)}`).join("\n")}

Lütfen aşağıdaki JSON formatında yanıt ver (başka metin yok, sadece geçerli JSON):

{
  "dna": {
    "hisseTipi": "1-2 cümle: hisse tipi ve karakteristiği",
    "yukselisKarakteri": "Yükseliş davranışı",
    "dususKarakteri": "Düşüş davranışı",
    "hacimTepkisi": "Hacim tepkisi",
    "haberEtkisi": "Haber etkisi"
  },
  "teknikYorum": {
    "trendDurumu": "Genel trend yorumu (2-3 cümle)",
    "kritikSeviyeler": "Kritik destek/direnç yorumu",
    "momentumYorumu": "RSI + EMA momentum değerlendirmesi",
    "volatilite": "ATR ve volatilite yorumu"
  },
  "forecast15": [
    ${forecast15.map(d => `{"gun": ${d.day}, "bear": ${d.bear.toFixed(2)}, "base": ${d.base.toFixed(2)}, "bull": ${d.bull.toFixed(2)}, "teknikSinyal": "kısa sinyal", "eylemOnerisi": "CSP/CC/Bekle"}`).join(",\n    ")}
  ],
  "opsiyonAnaliz": {
    "ivDurumu": "IV durumu ve yorumu",
    "ivRank": ${Math.min(100, Math.max(0, (iv - 20) / 80 * 100)).toFixed(0)},
    "cspStrateji": "CSP stratejisi önerisi",
    "ccStrateji": "CC stratejisi önerisi",
    "optimalCSPStrike": ${(support1 * 0.98).toFixed(2)},
    "optimalCCStrike": ${(resistance1 * 1.01).toFixed(2)},
    "haftalikPrimTahmin": "Haftalık prim getiri tahmini (%)",
    "yillikGetiriTahmin": "Yıllık getiri tahmini (%)"
  },
  "scenarioOzeti": {
    "bear": {"hedef": ${(currentPrice * 0.88).toFixed(2)}, "olasilik": 25, "tetikleyici": "negatif katalizör"},
    "base": {"hedef": ${forecast15[14]?.base.toFixed(2) ?? (currentPrice * 1.05).toFixed(2)}, "olasilik": 55, "tetikleyici": "mevcut momentum devamı"},
    "bull": {"hedef": ${forecast15[14]?.bull.toFixed(2) ?? (currentPrice * 1.15).toFixed(2)}, "olasilik": 20, "tetikleyici": "güçlü katalizör / short squeeze"}
  },
  "ceklistSkorlar": {
    "trendYapisi": ${masterScore >= 65 ? 1 : masterScore >= 50 ? 0 : -1},
    "ivUygun": ${iv > 30 ? 1 : iv > 20 ? 0 : -1},
    "destekGucu": ${masterScore >= 60 ? 1 : 0},
    "momentumGuclu": ${rsi >= 45 && rsi <= 70 ? 1 : -1}
  },
  "sonucKarar": {
    "genelPuan": ${(masterScore / 10).toFixed(1)},
    "cspUygunlugu": "${masterScore >= 65 ? "GÜÇLÜ" : masterScore >= 50 ? "ORTA" : "ZAYIF"}",
    "ccUygunlugu": "${masterScore >= 60 ? "GÜÇLÜ" : masterScore >= 45 ? "ORTA" : "ZAYIF"}",
    "oneri": "Net eylem önerisi (1-2 cümle)",
    "kritikRisk": "En kritik risk faktörü"
  }
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = (message.content[0] as any).text || "";
    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      companyName,
      currentPrice,
      sector,
      industry,
      generatedAt: new Date().toISOString(),
      analysis,
      rawData: {
        masterScore,
        rsi,
        iv,
        atr,
        ema20,
        ema50,
        ema200,
        support1,
        resistance1,
        forecast15,
      },
    });
  } catch (err: any) {
    console.error("[deep-analysis]", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
