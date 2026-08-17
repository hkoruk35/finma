// DeepSeek ile teknik + analist konsensüsünün GERÇEK rakamlarını 6 dilde
// kısa bir yorum metnine döken sentez. lib/earnings/deepseekAnalysis.ts ile
// AYNI desen ve AYNI disiplin: yalnızca verilen sayılara dayan, yeni bir
// rakam/katalizör uydurma — DeepSeek burada veri KAYNAĞI değil, GERÇEK
// verinin anlatıcısıdır.

export const CONSENSUS_LOCALES = ["en", "tr", "es", "fr", "pt", "id"] as const;
export type ConsensusLocale = (typeof CONSENSUS_LOCALES)[number];

export interface ConsensusSummary {
  summary: string; // 1-2 cümlelik genel değerlendirme
}
export type MultiLocaleConsensusSummary = Record<ConsensusLocale, ConsensusSummary>;

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

function buildPrompt(ticker: string, input: {
  oscPos: number; oscNeu: number; oscNeg: number;
  maPos: number; maNeu: number; maNeg: number;
  hasAnalystCoverage: boolean;
  analystStrongBuy: number; analystBuy: number; analystHold: number; analystSell: number; analystStrongSell: number;
  targetMean: number | null; currentPrice: number;
}): string {
  const analystBlock = input.hasAnalystCoverage
    ? `Analist görüşleri: ${input.analystStrongBuy} güçlü al, ${input.analystBuy} al, ${input.analystHold} tut, ${input.analystSell} sat, ${input.analystStrongSell} güçlü sat. Ortalama hedef fiyat: $${input.targetMean?.toFixed(2) ?? "?"} (güncel fiyat: $${input.currentPrice.toFixed(2)}).`
    : "Bu hisse için Yahoo Finance'te analist kapsamı bulunmuyor — analist görüşünden BAHSETME.";

  return `Sen BogaStock platformu için çalışan kıdemli bir teknik analiz sistemisin.
${ticker} hissesi için GERÇEK, önceden hesaplanmış şu verilere sahipsin:

Teknik göstergeler (26 gösterge — 11 osilatör + 15 hareketli ortalama): ${input.oscPos + input.maPos} pozitif, ${input.oscNeu + input.maNeu} nötr, ${input.oscNeg + input.maNeg} negatif (osilatörler: ${input.oscPos} pozitif/${input.oscNeu} nötr/${input.oscNeg} negatif, hareketli ortalamalar: ${input.maPos} pozitif/${input.maNeu} nötr/${input.maNeg} negatif).
${analystBlock}

Bu verilere dayanarak 6 dilin (en, tr, es, fr, pt, id) HER BİRİ için 1-2 cümlelik KISA bir genel değerlendirme üret. Sadece geçerli bir JSON objesi olarak yanıt ver, başka hiçbir açıklama, markdown veya preamble ekleme. İlk karakter { son karakter } olmalı.

Format:
{
  "en": { "summary": "1-2 sentence overall assessment in English" },
  "tr": { "summary": "Türkçe 1-2 cümlelik değerlendirme" },
  "es": { "summary": "..." },
  "fr": { "summary": "..." },
  "pt": { "summary": "..." },
  "id": { "summary": "..." }
}

Kurallar: SADECE verilen rakamlara dayan, uydurma haber/katalizör/rakam ekleme. Analist kapsamı yoksa bunu belirtme, sadece teknik görünümden bahset. Aynı anlam tüm locale'lerde korunmalı (sadece metin çevrilir).`;
}

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
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek: empty response");
  return text;
}

export async function synthesizeConsensusWithDeepSeek(
  ticker: string,
  input: Parameters<typeof buildPrompt>[1]
): Promise<MultiLocaleConsensusSummary | null> {
  try {
    const prompt = buildPrompt(ticker, input);
    const raw = await callDeepSeek(prompt);
    const parsed = tryParseJSON(raw);
    if (!parsed) return null;

    const out = {} as MultiLocaleConsensusSummary;
    for (const locale of CONSENSUS_LOCALES) {
      const entry = parsed[locale];
      out[locale] = { summary: entry && typeof entry === "object" ? String(entry.summary ?? "") : "" };
    }
    return out;
  } catch {
    // DeepSeek başarısız olursa panel yine de GERÇEK sayısal verilerle çalışmaya
    // devam eder — sadece anlatı metni eksik kalır, hiçbir sayı etkilenmez.
    return null;
  }
}
