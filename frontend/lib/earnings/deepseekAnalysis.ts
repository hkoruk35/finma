// DeepSeek ile bilanço (earnings) yapılandırılmış JSON analiz üretimi.
// Maliyet disiplinini korumak için: (1) ham SEC belgesi DEĞİL, sadece
// çıkarılmış temel rakamlar gönderilir, (2) 6 dilin TAMAMI TEK bir çağrıda
// üretilir (X Studio içerik üretimindeki desenle aynı, bkz. lib/x/generateContent.ts).

export const EARNINGS_LOCALES = ["en", "tr", "es", "fr", "pt", "id"] as const;
export type EarningsLocale = (typeof EARNINGS_LOCALES)[number];

export interface EarningsAiSummary {
  summary: string;
  revenue_status: string; // "Beklenti Üstü" | "Beklenti Altı" | "Nötr" (locale'e göre çevrilmiş)
  eps_status: string; // "Pozitif" | "Negatif" | "Nötr"
  key_takeaways: string[];
  bullish_signals: string[];
  bearish_signals: string[];
  ai_score: number; // 0-10
}

export type MultiLocaleEarningsSummary = Record<EarningsLocale, EarningsAiSummary>;

function tryParseJSON(raw: string): any | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildPrompt(ticker: string, companyName: string, formType: string, metrics: Record<string, number | null>): string {
  return `Sen BogaStock platformu için çalışan kıdemli bir finansal analiz sistemisin.
Aşağıda ${companyName} (${ticker}) şirketinin SEC bildiriminden (${formType}) alınan temel finansal rakamlar bulunmaktadır:
${JSON.stringify(metrics)}

Bu verilere dayanarak 6 dilin (en, tr, es, fr, pt, id) HER BİRİ için ayrı ayrı analiz üret. Sadece geçerli bir JSON objesi olarak yanıt ver, başka hiçbir açıklama, markdown veya preamble ekleme. İlk karakter { son karakter } olmalı.

Format (her locale kodu için aynı şema, o dilde yazılmış içerikle):
{
  "en": { "summary": "1-2 sentence overall assessment", "revenue_status": "Above Expectations|Below Expectations|Neutral", "eps_status": "Positive|Negative|Neutral", "key_takeaways": ["3 critical points"], "bullish_signals": ["bullish signals"], "bearish_signals": ["bearish signals"], "ai_score": 8.5 },
  "tr": { ... same fields, in Turkish ... },
  "es": { ... same fields, in Spanish ... },
  "fr": { ... same fields, in French ... },
  "pt": { ... same fields, in Portuguese ... },
  "id": { ... same fields, in Indonesian (Bahasa Indonesia) ... }
}

Kurallar: Sadece verilen rakamlara dayan, uydurma katalizör/haber ekleme. ai_score 0-10 arası, aynı sayısal değer tüm locale'lerde AYNI olmalı (sadece metin çevrilir, skor değişmez). key_takeaways/bullish_signals/bearish_signals her biri 2-4 madde içersin.`;
}

/** DeepSeek'e OpenAI-uyumlu chat/completions endpoint'i üzerinden ham fetch. */
async function callDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a precise financial analysis engine. You only output valid JSON. Never invent numbers beyond what is given.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek: empty response");
  return text;
}

export async function analyzeEarningsWithDeepSeek(
  ticker: string,
  companyName: string,
  formType: string,
  metrics: Record<string, number | null>
): Promise<MultiLocaleEarningsSummary> {
  const prompt = buildPrompt(ticker, companyName, formType, metrics);
  const raw = await callDeepSeek(prompt);
  const parsed = tryParseJSON(raw);
  if (!parsed) throw new Error("DeepSeek response was not valid JSON");

  const out = {} as MultiLocaleEarningsSummary;
  for (const locale of EARNINGS_LOCALES) {
    const entry = parsed[locale];
    out[locale] = entry && typeof entry === "object"
      ? {
          summary: String(entry.summary ?? ""),
          revenue_status: String(entry.revenue_status ?? "Neutral"),
          eps_status: String(entry.eps_status ?? "Neutral"),
          key_takeaways: Array.isArray(entry.key_takeaways) ? entry.key_takeaways.map(String) : [],
          bullish_signals: Array.isArray(entry.bullish_signals) ? entry.bullish_signals.map(String) : [],
          bearish_signals: Array.isArray(entry.bearish_signals) ? entry.bearish_signals.map(String) : [],
          ai_score: typeof entry.ai_score === "number" ? entry.ai_score : 5,
        }
      : {
          summary: "",
          revenue_status: "Neutral",
          eps_status: "Neutral",
          key_takeaways: [],
          bullish_signals: [],
          bearish_signals: [],
          ai_score: 5,
        };
  }
  return out;
}
