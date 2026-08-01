import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readPublicJson } from "@/lib/data-server";
import {
  getLastNReportDays,
  readArchiveForDate,
  enrichTrade,
  compressTradeForPrompt,
  computeAggregateStats,
  computeSignalMatrix,
  computeDailyTrend,
  type PerformanceTrade,
  type EnrichedTrade,
} from "@/lib/kriter-helpers";
import {
  getCachedAnalysis,
  setCachedAnalysis,
  type KriterAnalysisResult,
  type BotInsight,
} from "@/lib/kriter-cache";

export const runtime = "nodejs";
export const maxDuration = 120;

const KRITER_SYSTEM = `Sen swing trading sistemlerini optimize eden bir quant araştırma asistanısın.
swing117_boga botunun ürettiği sinyal verilerini ve trade sonuçlarını analiz ediyorsun.
Amaç: swing118 için hangi parametrelerin güncellenmesi gerektiğini somut önerilerle desteklemek.

KURALLAR:
- Sadece verilen datadan çıkarım yap, tahmin yapma
- Her bölümde somut parametre değişiklik önerisi sun
- Türkçe yaz, teknik terimler İngilizce kalabilir
- Terminal formatı: bölüm başlıkları köşeli parantez içinde, altında bullet noktalar
- Maksimum 80 karakter/satır`;

function buildKriterPrompt(trades: EnrichedTrade[]): string {
  const compressed = trades.map(compressTradeForPrompt);
  const dataStr = JSON.stringify(compressed, null, 0);

  return `Aşağıda son rapor dönemindeki ${trades.length} trade'in giriş günü teknik verisi ve sonucu var.

[SİSTEM ANALİZİ]
MOMENTUM vs BREAKOUT vs diğer sistem tiplerinin win rate karşılaştırması.
Hangi sistem kategorisi daha başarılı? Neden?

[EMA ANALİZİ]
EMA stack durumu (FULL/MIXED/BELOW) ile sonuç korelasyonu.
Full stack girişlerin win rate'i mixed/below'a kıyasla nasıl?

[HACİM ANALİZİ]
RVOL seviyeleri ve başarı ilişkisi.
HIGH/NORMAL/LOW rvol kategorilerinde win rate farkı nedir?

[MOMENTUM KALİTESİ]
RSI, ADX, MACD kombinasyonları.
Hangi RSI/ADX aralıklarında işlemler daha başarılı?
is_exhausted ve trend durumunun etkisi?

[STOP-LOSS ANALİZİ]
LOSS olan trades'lerin ortak teknik zayıflıkları.
Stop yiyen trade'lerde EMA, RSI, ADX, RVOL hangi değerlerdeydi?
sl_pct ile LOSS korelasyonu var mı?

[YATAY KALANLAR]
PENDING trades'lerin ortak özellikleri (eğer varsa).
Harekete geçmeyenlerin teknik profilinde ne eksik?

[SEKTÖREL ANALİZ]
Hangi sektör/subsektör ne sonuç verdi?
Sektörel kümeleme — belirli sektörler sürekli kaybettiriyor mu?

[BOT OPTİMİZASYONU]
swing118 için somut parametre değişiklik önerileri.
Format: MEVCUT → ÖNERİ → BEKLENEN ETKİ
En az 3 somut öneri sun.

[SONUÇ ÖZETİ]
3 satır: genel performans değerlendirmesi, en kritik bulgu, acil aksiyon.

TRADE DATA:
${dataStr}`;
}

function parseBotInsights(aiReport: string): BotInsight[] {
  const insights: BotInsight[] = [];
  const optSection = aiReport.match(/\[BOT OPTİMİZASYONU\]([\s\S]*?)(?=\[|$)/i)?.[1] ?? "";
  const lines = optSection.split("\n").filter((l) => l.trim().startsWith("-") || l.includes("→"));

  for (const line of lines.slice(0, 8)) {
    const parts = line.replace(/^[-•*]\s*/, "").split("→").map((s) => s.trim());
    if (parts.length >= 2) {
      insights.push({
        category: "THRESHOLD_CHANGE",
        priority: "MEDIUM",
        current_behavior: parts[0],
        suggested_change: parts[1] ?? "",
        expected_impact: parts[2] ?? "",
        confidence: "DATA_BACKED",
      });
    }
  }

  return insights;
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: KRITER_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  return (msg.content[0] as { text: string }).text ?? "";
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: KRITER_SYSTEM }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const days: number = body.days ?? 10;
    const forceRefresh: boolean = body.force_refresh ?? false;
    const includePending: boolean = body.include_pending ?? true;

    // Performance JSON yükle
    const perfData = readPublicJson("swing_performance.json");
    if (!perfData?.history) {
      return NextResponse.json({ error: "swing_performance.json okunamadı" }, { status: 503 });
    }

    const allHistory: PerformanceTrade[] = perfData.history;
    const reportDays = getLastNReportDays(allHistory, days);
    const filteredTrades = allHistory.filter((t) => reportDays.includes(t.date));
    const lastTradeDate = reportDays[reportDays.length - 1] ?? "";

    // Cache kontrolü
    if (!forceRefresh) {
      const cached = getCachedAnalysis(days, includePending, filteredTrades.length, lastTradeDate);
      if (cached) return NextResponse.json(cached);
    }

    // Archive ile eşleştir
    const archiveByDate: Record<string, ReturnType<typeof readArchiveForDate>> = {};
    for (const date of reportDays) {
      archiveByDate[date] = readArchiveForDate(date);
    }

    const enrichedTrades: EnrichedTrade[] = filteredTrades.map((t) =>
      enrichTrade(t, archiveByDate[t.date] ?? null)
    );

    // İstatistikler
    const stats = computeAggregateStats(enrichedTrades, reportDays);
    const signal_matrix = computeSignalMatrix(enrichedTrades);
    const daily_trend = computeDailyTrend(enrichedTrades, reportDays);

    // AI analizi
    const prompt = buildKriterPrompt(enrichedTrades);
    let ai_report = "";

    try {
      ai_report = await callGemini(prompt);
    } catch (e: any) {
      console.warn("[kriter-analysis] Gemini failed:", e?.message);
      try {
        ai_report = await callClaude(prompt);
      } catch (e2: any) {
        console.error("[kriter-analysis] Claude fallback also failed:", e2?.message);
        ai_report = "[AI ANALİZİ] API bağlantısı kurulamadı. Lütfen tekrar deneyin.";
      }
    }

    const bot_insights = parseBotInsights(ai_report);

    const result: KriterAnalysisResult = {
      trades: enrichedTrades,
      stats,
      signal_matrix,
      daily_trend,
      bot_insights,
      ai_report,
      generated_at: new Date().toISOString(),
      cache_hit: false,
      enrichment_coverage: stats.enrichment_coverage,
      report_days: reportDays,
    };

    setCachedAnalysis(days, includePending, result, filteredTrades.length, lastTradeDate);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[kriter-analysis]", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

// GET: sadece ham veri + istatistikler (AI yok)
export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "10");

    const perfData = readPublicJson("swing_performance.json");
    if (!perfData?.history) {
      return NextResponse.json({ error: "swing_performance.json okunamadı" }, { status: 503 });
    }

    const allHistory: PerformanceTrade[] = perfData.history;
    const reportDays = getLastNReportDays(allHistory, days);
    const filteredTrades = allHistory.filter((t) => reportDays.includes(t.date));

    const archiveByDate: Record<string, ReturnType<typeof readArchiveForDate>> = {};
    for (const date of reportDays) {
      archiveByDate[date] = readArchiveForDate(date);
    }

    const enrichedTrades: EnrichedTrade[] = filteredTrades.map((t) =>
      enrichTrade(t, archiveByDate[t.date] ?? null)
    );

    const stats = computeAggregateStats(enrichedTrades, reportDays);
    const signal_matrix = computeSignalMatrix(enrichedTrades);
    const daily_trend = computeDailyTrend(enrichedTrades, reportDays);

    return NextResponse.json({
      trades: enrichedTrades,
      stats,
      signal_matrix,
      daily_trend,
      report_days: reportDays,
      enrichment_coverage: stats.enrichment_coverage,
      generated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
