import { GoogleGenAI } from "@google/genai";

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
  rvol?: number;
  opportunity?: boolean;
  customInstruction?: string;
}

export interface GeneratePromoInput {
  contentType: "promo";
}

export type ListType = "swing" | "trend" | "top100" | "sector_heatmap";

export interface GenerateListInput {
  contentType: "list";
  listType: ListType;
  listTitle: string; // e.g. "Swing Trade" — matches the Home page card title
  items: { ticker: string; changePct: number }[]; // top movers, already sorted
  pageUrl: string; // where the "View all" would point (locale-specific)
}

export interface GenerateTranslationInput {
  contentType: "translate";
  manualBaseText: string;
}

export type MarketAssetCategory = "sector" | "index" | "commodity" | "fx" | "crypto";

export interface GenerateMarketAssetInput {
  contentType: "market_asset";
  ticker: string;
  label: string; // "Altın", "S&P 500", "Bitcoin", "EUR/USD", "Teknoloji" gibi kullanıcıya gösterilecek ad
  category: MarketAssetCategory;
  changePct?: number;
  customInstruction?: string;
}

export async function generateLocalizedTexts(
  input: GenerateStockInput | GeneratePromoInput | GenerateListInput | GenerateTranslationInput | GenerateMarketAssetInput
): Promise<Record<Locale, string>> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const listPrompt = (input: GenerateListInput) => {
    const tickerLine = input.items
      .map((i) => `${i.ticker} ${i.changePct >= 0 ? "+" : ""}${i.changePct.toFixed(1)}%`)
      .join(", ");
    return `Write a short, engaging one-sentence roundup (max 220 chars) of today's "${input.listTitle}" list on BogaStock, an AI stock analysis platform. Today's top movers: ${tickerLine}. Mention 2-3 of the standout tickers by name and tie them to the list's theme (e.g. swing-trade candidates, trending stocks, most-active names, or sector rotation, depending on what "${input.listTitle}" implies). Do not invent numbers beyond what's given. Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
  };

  const translatePrompt = (input: GenerateTranslationInput) => {
    return `Translate the following text into 5 languages naturally.
CRITICAL RULE: NEVER translate, alter, or remove cashtags (e.g. $AAPL, $TSLA) or any financial tickers. They MUST remain exactly as they appear in the original text.

Text to translate:
"${input.manualBaseText}"

Return a JSON object with keys: ${LOCALES.join(", ")}, mapping each locale code to the translated text.`;
  };

  const MARKET_ASSET_CATEGORY_NOUN: Record<MarketAssetCategory, string> = {
    sector: "sector ETF",
    index: "market index",
    commodity: "commodity",
    fx: "currency pair",
    crypto: "cryptocurrency",
  };

  const marketAssetPrompt = (input: GenerateMarketAssetInput) => {
    const noun = MARKET_ASSET_CATEGORY_NOUN[input.category] ?? "asset";
    const changeLine = input.changePct != null ? `Today's move: ${input.changePct >= 0 ? "+" : ""}${input.changePct.toFixed(2)}%.` : "";
    return `Write a short, engaging one-sentence market update (max 220 chars) about ${input.label} (a ${noun}) on BogaStock, an AI stock analysis platform. ${changeLine} Give brief context on what's driving or notable about today's move — stay factual and qualitative, do not invent specific price levels, catalysts, or news beyond what's given.${
      input.customInstruction ? ` Additional instruction from the analyst (follow this closely): ${input.customInstruction}` : ""
    } Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
  };

  const prompt =
    input.contentType === "promo"
      ? `Write a short, exciting promotional sentence (max 220 chars) inviting people to subscribe to BogaStock for AI-powered stock analysis, mini charts and trend tracking. Return a JSON object with keys: ${LOCALES.join(", ")}.`
      : input.contentType === "list"
      ? listPrompt(input)
      : input.contentType === "translate"
      ? translatePrompt(input)
      : input.contentType === "market_asset"
      ? marketAssetPrompt(input)
      : `Write a short, engaging one-sentence mini analysis (max 220 chars) for stock ${input.ticker} (${input.company ?? ""}, sector: ${input.sector ?? "N/A"}${input.theme ? `, theme: ${input.theme}` : ""}). Context: trend=${input.trend ?? "N/A"}, signal=${input.signal ?? "N/A"}, relative volume=${input.rvol != null ? `${input.rvol.toFixed(1)}x average` : "N/A"}.

Take a strategic, medium-to-long-term view. Weave in the volume story (e.g. above-average volume confirming the move, or thin volume suggesting caution) rather than just repeating the trend. ${
          input.opportunity
            ? "Volume and trend both support this — explicitly call it out as a swing-trade or investment opportunity worth watching, and briefly say why (momentum + volume confirmation)."
            : "Don't force an opportunity framing if the setup doesn't clearly support it — a neutral \"worth watching\" or \"stay on radar\" tone is fine here."
        } Do NOT mention or imply any specific price level, entry range, or dollar figure — keep it qualitative and strategic, not tactical. Avoid generic filler like "worth a look"; be specific and analytical.${
          input.customInstruction ? ` Additional instruction from the analyst (follow this closely): ${input.customInstruction}` : ""
        } Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are the social media voice of BogaStock, a stock analysis platform. Return ONLY a valid JSON object mapping each requested locale code to a single short, punchy sentence (max 220 characters) written in that locale's language. No explanation, no markdown, no preamble. The first character must be { and the last character must be }.",
      temperature: 0.7,
    },
  });

  const rawText = response.text || "";
  const parsed = tryParseJSON(rawText);
  if (!parsed) throw new Error("AI response was not valid JSON");
  return parsed as Record<Locale, string>;
}
