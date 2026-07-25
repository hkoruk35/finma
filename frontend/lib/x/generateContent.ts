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
  // Haftalık mod: kısa günlük tek cümle yerine sektör/rakip/tema analizi
  // yapan, yön belirten, uzun format bir gönderi üretir (bkz. weeklyStockPrompt).
  weekly?: boolean;
  changePct?: number;
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
  // Haftalık mod — kategoriye göre farklı gerçek veriyle desteklenir:
  weekly?: boolean;
  sectorStandouts?: { ticker: string; changePct: number }[]; // sadece category="sector" + weekly
  sectorRotation?: { label: string; changePct: number }[]; // sadece category="index" + weekly
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

  const MARKET_ASSET_CATEGORY_DRIVERS: Record<MarketAssetCategory, string> = {
    sector: "sector-wide earnings tone, rotation flows, group leadership",
    index: "breadth, rotation, macro data, rate expectations",
    commodity: "supply/demand balance, dollar strength, macro/geopolitical backdrop",
    fx: "rate differentials, central bank tone, relative macro strength between the two economies",
    crypto: "risk appetite, market structure/liquidity, on-chain or macro-driven sentiment shifts",
  };

  const marketAssetPrompt = (input: GenerateMarketAssetInput) => {
    const noun = MARKET_ASSET_CATEGORY_NOUN[input.category] ?? "asset";
    const changeLine = input.changePct != null ? `Change: ${input.changePct >= 0 ? "+" : ""}${input.changePct.toFixed(2)}%.` : "";
    const customLine = input.customInstruction ? ` Additional instruction from the analyst (follow this closely): ${input.customInstruction}` : "";

    if (!input.weekly) {
      return `Write a short, engaging one-sentence market update (max 220 chars) about ${input.label} (a ${noun}) on BogaStock, an AI stock analysis platform. Today's ${changeLine} Give brief context on what's driving or notable about today's move — stay factual and qualitative, do not invent specific price levels, catalysts, or news beyond what's given.${customLine} Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
    }

    if (input.category === "sector" && input.sectorStandouts?.length) {
      const standoutsLine = input.sectorStandouts.map((s) => `${s.ticker} ${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%`).join(", ");
      return `Write an in-depth WEEKLY analysis (roughly 600-1100 characters — there's no strict length limit, so use the space to say something genuinely useful, don't pad it) of the ${input.label} SECTOR as a whole on BogaStock. This week's ${changeLine} Real standout names from this sector, sorted by performance: ${standoutsLine}.

IMPORTANT — this is a sector-level report, NOT a single-company deep-dive. The bulk of the analysis must stay about the sector as a whole (group tone, breadth, rotation, what's driving the group). The standout tickers are supporting evidence, not the subject: name 2-3 of them in a single clause each (e.g. "led by X and Y") — do not analyze any one company's earnings, guidance, product news, or fundamentals in detail, and do not switch into a stock-picking tone for a single name.

Write it as natural flowing prose (not a bullet list), covering: the sector's overall tone/momentum this week; a brief mention of 2-3 standout tickers above as evidence of that tone; any broader theme or narrative behind the sector's move (only if genuinely relevant, don't force one); and a clear directional read for the sector heading into next week.

Use ONLY the tickers and numbers given above — do not invent additional tickers, numbers, or news.${customLine} Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
    }

    if (input.category === "index" && input.sectorRotation?.length) {
      const rotationLine = input.sectorRotation.map((s) => `${s.label} ${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%`).join(", ");
      return `Write an in-depth WEEKLY analysis (roughly 600-1100 characters — there's no strict length limit, so use the space to say something genuinely useful, don't pad it) of ${input.label} on BogaStock, focused on money flow and sector rotation. This week's ${changeLine} Real sector ETF performance, sorted best to worst: ${rotationLine}.

Write it as natural flowing prose (not a bullet list), covering: ${input.label}'s overall weekly tone; where money appears to be rotating INTO based on the leading sectors above; where it's rotating OUT OF based on the laggards; what that rotation pattern typically signals (risk-on vs risk-off, defensive positioning, growth vs value, etc.); and a clear directional read for the index heading into next week.

Use ONLY the sector data given above — do not invent additional sectors, numbers, or news.${customLine} Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
    }

    const drivers = MARKET_ASSET_CATEGORY_DRIVERS[input.category] ?? "the relevant macro backdrop";
    return `Write an in-depth WEEKLY analysis (roughly 500-900 characters — there's no strict length limit, so use the space to say something genuinely useful, don't pad it) of ${input.label} (a ${noun}) on BogaStock. This week's ${changeLine}

Write it as natural flowing prose (not a bullet list), covering: what's likely been driving ${input.label} this week (relevant context for this asset class: ${drivers}); the broader weekly trend/momentum; and a clear directional read for the week ahead.

Stay qualitative — do not invent specific price levels, events, or news beyond what's given.${customLine} Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
  };

  const weeklyStockPrompt = (input: GenerateStockInput) => {
    const changeLine = input.changePct != null ? `This week's change: ${input.changePct >= 0 ? "+" : ""}${input.changePct.toFixed(2)}%.` : "";
    return `Write an in-depth WEEKLY analysis (roughly 600-1100 characters — there's no strict length limit, so use the space to say something genuinely useful, don't pad it) for stock ${input.ticker} (${input.company ?? ""}, sector: ${input.sector ?? "N/A"}). This is a longer-form weekly post, not a quick daily update.

Write it as natural flowing prose (not a bullet list), covering: how ${input.ticker} is positioned within its sector this week (sector-wide tone/momentum); how it compares to its main competitors/peers in that sector — who's leading, who's lagging, and where ${input.ticker} fits; any relevant sector theme or narrative currently driving the group (only if genuinely relevant — e.g. AI capex, rate-sensitivity, a restocking cycle, regulatory overhang, whatever actually fits this sector, don't force one); and a clear directional read for the week ahead (bullish, bearish, or range-bound) with brief reasoning.

${changeLine}
Competitor and theme commentary should draw on well-known, general market knowledge and stay qualitative — do not invent specific financial figures, price levels, or news beyond what's given.${
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
      : input.weekly
      ? weeklyStockPrompt(input)
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
      systemInstruction: `You are the social media voice of BogaStock, a stock analysis platform. Return ONLY a valid JSON object mapping each requested locale code to the requested text, written naturally in that locale's language, matching the length the prompt asks for. No explanation, no markdown, no preamble. The first character must be { and the last character must be }.

Write like a real market analyst posting casually to followers, not like an AI. Be direct and specific. AVOID AI-sounding filler and corporate-speak: phrases like "in today's dynamic market", "it's worth noting that", "navigating the landscape", "in the ever-evolving world of", "as we move forward", "this underscores the importance of", excessive hedging, or generic summary sentences that repeat what was already said. Use plain, confident, natural phrasing a sharp trader would actually type — contractions are fine, vary sentence length, get to the point.`,
      temperature: 0.8,
    },
  });

  const rawText = response.text || "";
  const parsed = tryParseJSON(rawText);
  if (!parsed) throw new Error("AI response was not valid JSON");
  return parsed as Record<Locale, string>;
}
