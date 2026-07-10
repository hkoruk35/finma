import Anthropic from "@anthropic-ai/sdk";

export const LOCALES = ["en", "es", "fr", "pt", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

function tryParseJSON(raw: string): Record<string, string> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export interface GenerateStockInput {
  contentType: "stock";
  ticker: string;
  company?: string | null;
  sector?: string | null;
  theme?: string | null;
  signal?: string;
  trend?: string;
  entryLow?: number;
  entryHigh?: number;
}

export interface GeneratePromoInput {
  contentType: "promo";
}

export async function generateLocalizedTexts(
  input: GenerateStockInput | GeneratePromoInput
): Promise<Record<Locale, string>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const prompt =
    input.contentType === "promo"
      ? `Write a short, exciting promotional sentence (max 220 chars) inviting people to subscribe to BogaStock for AI-powered stock analysis, mini charts and trend tracking. Return a JSON object with keys: ${LOCALES.join(", ")}.`
      : `Write a short, engaging one-sentence mini analysis (max 220 chars) for stock ${input.ticker} (${input.company ?? ""}, sector: ${input.sector ?? "N/A"}${input.theme ? `, theme: ${input.theme}` : ""}). Context: trend=${input.trend ?? "N/A"}, signal=${input.signal ?? "N/A"}${
          input.entryLow != null && input.entryHigh != null
            ? `, estimated entry zone=$${input.entryLow.toFixed(2)}-$${input.entryHigh.toFixed(2)}`
            : ""
        }. Frame it explicitly as a swing-trade or investment OPPORTUNITY worth watching — mention the entry zone naturally if provided, and make clear why this setup could be interesting right now (momentum, trend, or valuation angle). Avoid generic filler like "worth a look"; be specific and actionable. Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system:
      "You are the social media voice of BogaStock, a stock analysis platform. Return ONLY a valid JSON object mapping each requested locale code to a single short, punchy sentence (max 220 characters) written in that locale's language. No explanation, no markdown, no preamble. The first character must be { and the last character must be }.",
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = (msg.content[0] as any).text || "";
  const parsed = tryParseJSON(rawText);
  if (!parsed) throw new Error("AI response was not valid JSON");
  return parsed as Record<Locale, string>;
}
