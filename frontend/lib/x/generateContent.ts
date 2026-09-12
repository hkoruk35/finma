import { GoogleGenAI } from "@google/genai";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { formatNumber } from "@/lib/formatNumber";

export const LOCALES = ["en", "es", "fr", "pt", "tr", "id"] as const;
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

export type MarketPictureMode = "intraday" | "day_close" | "week_close";

export interface GenerateMarketPictureInput {
  contentType: "market_picture";
  mode: MarketPictureMode;
  // Gerçek endeks değişimleri (SPX/NDX/DJI/RUT/VIX) — AI sadece bunları kullanır.
  indices: { label: string; changePct: number }[];
  // Gerçek sektör ETF değişimleri (11 sektör).
  sectors: { label: string; changePct: number }[];
  advancers?: number | null;
  decliners?: number | null;
  topGainers?: { ticker: string; changePct: number }[];
  topLosers?: { ticker: string; changePct: number }[];
  // Sadece mode="week_close" için: haftalık SPX değişimi + sektör rotasyonu.
  weekChangePct?: number | null;
  weekSectorRotation?: { label: string; changePct: number }[];
}

export async function generateLocalizedTexts(
  input:
    | GenerateStockInput
    | GeneratePromoInput
    | GenerateListInput
    | GenerateTranslationInput
    | GenerateMarketAssetInput
    | GenerateMarketPictureInput
): Promise<Record<Locale, string>> {
  const listPrompt = (input: GenerateListInput) => {
    const tickerLine = input.items
      .map((i) => `${i.ticker} ${i.changePct >= 0 ? "+" : ""}${formatNumber(i.changePct, 1)}%`)
      .join(", ");
    return `Write a short, engaging one-sentence roundup (max 220 chars) of today's "${input.listTitle}" list on BogaStock, an AI stock analysis platform. Today's top movers: ${tickerLine}. Mention 2-3 of the standout tickers by name and tie them to the list's theme (e.g. swing-trade candidates, trending stocks, most-active names, or sector rotation, depending on what "${input.listTitle}" implies). Do not invent numbers beyond what's given. Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
  };

  const translatePrompt = (input: GenerateTranslationInput) => {
    return `Translate the following text into ${LOCALES.length} languages naturally.
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
    const changeLine = input.changePct != null ? `Change: ${input.changePct >= 0 ? "+" : ""}${formatNumber(input.changePct, 2)}%.` : "";
    const customLine = input.customInstruction ? ` Additional instruction from the analyst (follow this closely): ${input.customInstruction}` : "";

    if (!input.weekly) {
      return `Write a short, engaging one-sentence market update (max 220 chars) about ${input.label} (a ${noun}) on BogaStock, an AI stock analysis platform. Today's ${changeLine} Give brief context on what's driving or notable about today's move — stay factual and qualitative, do not invent specific price levels, catalysts, or news beyond what's given.${customLine} Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
    }

    if (input.category === "sector" && input.sectorStandouts?.length) {
      const standoutsLine = input.sectorStandouts.map((s) => `${s.ticker} ${s.changePct >= 0 ? "+" : ""}${formatNumber(s.changePct, 1)}%`).join(", ");
      return `Write an in-depth WEEKLY analysis (roughly 600-1100 characters — there's no strict length limit, so use the space to say something genuinely useful, don't pad it) of the ${input.label} SECTOR as a whole on BogaStock. This week's ${changeLine} Real standout names from this sector, sorted by performance: ${standoutsLine}.

IMPORTANT — this is a sector-level report, NOT a single-company deep-dive. The bulk of the analysis must stay about the sector as a whole (group tone, breadth, rotation, what's driving the group). The standout tickers are supporting evidence, not the subject: name 2-3 of them in a single clause each (e.g. "led by X and Y") — do not analyze any one company's earnings, guidance, product news, or fundamentals in detail, and do not switch into a stock-picking tone for a single name.

Write it as natural flowing prose (not a bullet list), covering: the sector's overall tone/momentum this week; a brief mention of 2-3 standout tickers above as evidence of that tone; any broader theme or narrative behind the sector's move (only if genuinely relevant, don't force one); and a clear directional read for the sector heading into next week.

Use ONLY the tickers and numbers given above — do not invent additional tickers, numbers, or news.${customLine} Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
    }

    if (input.category === "index" && input.sectorRotation?.length) {
      const rotationLine = input.sectorRotation.map((s) => `${s.label} ${s.changePct >= 0 ? "+" : ""}${formatNumber(s.changePct, 1)}%`).join(", ");
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
    const changeLine = input.changePct != null ? `This week's change: ${input.changePct >= 0 ? "+" : ""}${formatNumber(input.changePct, 2)}%.` : "";
    return `Write an in-depth WEEKLY analysis (roughly 600-1100 characters — there's no strict length limit, so use the space to say something genuinely useful, don't pad it) for stock ${input.ticker} (${input.company ?? ""}, sector: ${input.sector ?? "N/A"}). This is a longer-form weekly post, not a quick daily update.

Write it as natural flowing prose (not a bullet list), covering: how ${input.ticker} is positioned within its sector this week (sector-wide tone/momentum); how it compares to its main competitors/peers in that sector — who's leading, who's lagging, and where ${input.ticker} fits; any relevant sector theme or narrative currently driving the group (only if genuinely relevant — e.g. AI capex, rate-sensitivity, a restocking cycle, regulatory overhang, whatever actually fits this sector, don't force one); and a clear directional read for the week ahead (bullish, bearish, or range-bound) with brief reasoning.

${changeLine}
Competitor and theme commentary should draw on well-known, general market knowledge and stay qualitative — do not invent specific financial figures, price levels, or news beyond what's given.${
      input.customInstruction ? ` Additional instruction from the analyst (follow this closely): ${input.customInstruction}` : ""
    } Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;
  };

  const marketPicturePrompt = (input: GenerateMarketPictureInput) => {
    const fmtPct = (p: number) => `${p >= 0 ? "+" : ""}${formatNumber(p, 2)}%`;
    const indexLine = input.indices.map((i) => `${i.label} ${fmtPct(i.changePct)}`).join(", ");
    const sectorLine = input.sectors.map((s) => `${s.label} ${fmtPct(s.changePct)}`).join(", ");
    const breadthLine =
      input.advancers != null && input.decliners != null
        ? `Market breadth: ${input.advancers} advancing vs ${input.decliners} declining stocks (S&P 500).`
        : "";
    const gainersLine = input.topGainers?.length
      ? `Top gainers today: ${input.topGainers.map((g) => `${g.ticker} ${fmtPct(g.changePct)}`).join(", ")}.`
      : "";
    const losersLine = input.topLosers?.length
      ? `Top losers today: ${input.topLosers.map((l) => `${l.ticker} ${fmtPct(l.changePct)}`).join(", ")}.`
      : "";

    const modeInstruction =
      input.mode === "intraday"
        ? `This is a LIVE, mid-session update — write in the present tense, describing what's happening in the market RIGHT NOW. Do not reference "today's close" or "tomorrow" since the session is still open.`
        : input.mode === "day_close"
        ? `The US market has just closed for the day. Write this as an end-of-day recap: summarize how the session went, then close with a brief, qualitative expectation for tomorrow's session based on today's momentum/tone — do not invent a specific catalyst or event, just a reasonable qualitative read (e.g. "watch for follow-through" or "eyes on whether today's rotation persists").`
        : `It's Friday and the US market has just closed for the week. Write this as a WEEKLY WRAP-UP: summarize how the week went overall (use the weekly change/rotation data given below), then close with a brief, qualitative expectation for next week's open based on this week's tone — do not invent a specific catalyst, just a reasonable qualitative read.`;

    const weekLine =
      input.mode === "week_close" && input.weekChangePct != null
        ? `This week's S&P 500 change: ${fmtPct(input.weekChangePct)}.`
        : "";
    const weekRotationLine =
      input.mode === "week_close" && input.weekSectorRotation?.length
        ? `This week's sector performance, best to worst: ${input.weekSectorRotation.map((s) => `${s.label} ${fmtPct(s.changePct)}`).join(", ")}.`
        : "";

    return `Write the "Today's market picture" card for BogaStock's homepage — a RELATIONAL analysis of the overall US market, not a numbers recap. The reader already sees every raw number (index levels, % changes, sector list) elsewhere on the same page in cards next to this one. Your job is to supply the meaning those numbers don't speak for themselves: why the move happened, how the signals connect to each other, and what that combination implies. If you just restate "X rose Y%, Z fell W%" you have failed the assignment — a plain recap is explicitly NOT what's wanted here.

STRICT LENGTH REQUIREMENT: 120 to 140 words. Not shorter, not longer — this is a hard constraint, count carefully. Use the extra room to actually explain the reasoning in each of the 3 paragraphs below, not to pad with filler — every added sentence should carry real information.

${modeInstruction}

Real data (use ONLY this — never invent a number, ticker, or event not listed here):
Major indices: ${indexLine}.
Sector ETF performance: ${sectorLine}.
${breadthLine}
${gainersLine}
${losersLine}
${weekLine}
${weekRotationLine}

Structure it as flowing prose in 3 short paragraphs (no headers, no bullet list, no bold labels — just natural paragraph breaks), covering in order:
1. Mood + driver in one beat: state the overall tone in a single sentence, then immediately name what's actually carrying it — which sector or stock is doing the work, referencing at least one standout sector and one standout ticker from the data above.
2. The relationship: this is the core of the analysis — explicitly connect at least two of {index direction, VIX move, breadth (advancers vs decliners), sector leadership} to each other and say what that combination signals together (e.g. "falling volatility alongside broad participation, not just a couple of large names, points to X" — reason about them jointly, don't list them separately).
3. What to watch next: a short, concrete forward statement — what would confirm this move continuing, and what would be the first sign it's fading. Stay qualitative, don't invent a specific event or date.

Do NOT include any kind of overall verdict, score, confidence number, or bias label (like "bullish" or "risk-on" as a standalone tag) — that judgment is rendered separately by the app, not by you. Just explain the mechanics and relationships. Write like a sharp market analyst thinking out loud, not an AI — direct, specific, no filler like "it's worth noting" or "in today's dynamic market". Return a JSON object with keys: ${LOCALES.join(", ")}, each value independently written (not a literal translation of each other) in that language, each hitting the same 120-140 word target.`;
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
      : input.contentType === "market_picture"
      ? marketPicturePrompt(input)
      : input.weekly
      ? weeklyStockPrompt(input)
      : `Write an in-depth DAILY mini analysis (at least 60-70 words, roughly 420-600 characters — do not go shorter than that, use the space to say something genuinely useful) for stock ${input.ticker} (${input.company ?? ""}, sector: ${input.sector ?? "N/A"}${input.theme ? `, theme: ${input.theme}` : ""}). Context: trend=${input.trend ?? "N/A"}, signal=${input.signal ?? "N/A"}, relative volume=${input.rvol != null ? `${formatNumber(input.rvol, 1)}x average` : "N/A"}.

This is the "why was this stock picked today" analysis shown to readers on the homepage and news page — it needs to earn its place, not read like a one-liner. Cover, in natural flowing prose (not a bullet list): (1) WHY this ticker stood out today specifically — tie it directly to the trend/signal/volume context given above, don't just restate the labels; (2) how it sits within its sector right now — is the sector itself hot, rotating, or lagging, and does that support or complicate the setup; (3) the volume story in more depth (e.g. above-average volume confirming institutional interest, or thin volume meaning the move needs more confirmation before it's trustworthy); and (4) a clear, strategic medium-to-long-term read on what this means for someone watching the name. Sector/market context should draw on general, well-known market knowledge and stay qualitative — do not invent specific sector data, competitor names, or numbers beyond what's given.

Take a strategic, medium-to-long-term view throughout. ${
          input.opportunity
            ? "Volume and trend both support this — explicitly call it out as a swing-trade or investment opportunity worth watching, and explain why (momentum + volume confirmation + sector backdrop)."
            : "Don't force an opportunity framing if the setup doesn't clearly support it — a neutral \"worth watching\" or \"stay on radar\" tone is fine here, but still explain the reasoning in full rather than hedging in one line."
        } Do NOT mention or imply any specific price level, entry range, or dollar figure — keep it qualitative and strategic, not tactical. Avoid generic filler like "worth a look"; be specific and analytical, and avoid padding — every sentence should add real information.${
          input.customInstruction ? ` Additional instruction from the analyst (follow this closely): ${input.customInstruction}` : ""
        } Return a JSON object with keys: ${LOCALES.join(", ")}, each value translated/localized naturally (not literal translation) into that language.`;

  const systemInstruction = `You are the social media voice of BogaStock, a stock analysis platform. Return ONLY a valid JSON object mapping each requested locale code to the requested text, written naturally in that locale's language, matching the length the prompt asks for. No explanation, no markdown, no preamble. The first character must be { and the last character must be }.

Write like a real market analyst posting casually to followers, not like an AI. Be direct and specific. AVOID AI-sounding filler and corporate-speak: phrases like "in today's dynamic market", "it's worth noting that", "navigating the landscape", "in the ever-evolving world of", "as we move forward", "this underscores the importance of", excessive hedging, or generic summary sentences that repeat what was already said. Use plain, confident, natural phrasing a sharp trader would actually type — contractions are fine, vary sentence length, get to the point.`;

  // DeepSeek her zaman birinci öncelik (kullanıcı talimatı, bkz. Copilot chat
  // route'undaki aynı kural) — Gemini yalnızca DeepSeek başarısız olursa
  // (kota, geçici hata, geçersiz key) devreye giren otomatik fallback'tir.
  async function tryDeepSeek(): Promise<string> {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) throw new Error("DEEPSEEK_API_KEY not configured");
    const deepseekProvider = createOpenAI({ apiKey: deepseekApiKey, baseURL: "https://api.deepseek.com" });
    const { text } = await generateText({
      model: deepseekProvider("deepseek-v4-flash"),
      system: systemInstruction,
      prompt,
      temperature: 0.8,
    });
    return text || "";
  }

  async function tryGemini(): Promise<string> {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
      config: { systemInstruction, temperature: 0.8 },
    });
    return response.text || "";
  }

  let rawText = "";
  try {
    rawText = await tryDeepSeek();
  } catch (deepseekErr: any) {
    console.error("[x/generateContent] DeepSeek failed, falling back to Gemini:", deepseekErr?.message || deepseekErr);
    rawText = await tryGemini();
  }

  const parsed = tryParseJSON(rawText);
  if (!parsed) throw new Error("AI response was not valid JSON");

  // Model sicakligi (0.8) 6 dilin HEPSINI garanti etmiyor — bazen JSON'da
  // bir locale (genelde en yeni eklenen, orn. "id") sessizce eksik kaliyor.
  // Bu, admin panelinde "5 dilde paylasti, 6.si atlandi" gibi sessiz veri
  // kaybina yol aciyordu (bkz. 2026-08-11 Endonezce X Studio hatasi — tek
  // denemelik tamir de yetersiz kaldi, TGT'de yine ayni sekilde atlandi).
  // Simdi eksik kaldigi surece (en fazla 3 deneme) daralan bir kapsamla
  // tekrar tekrar tamir dener — her denemede sadece HALA eksik olan
  // dil(ler) istenir, bu da modelin tek seferde daha az anahtar unutma
  // ihtimalini artirir. Hala basarisizsa ustteki cagiran (route.ts) hatayi
  // istemciye dondurur; publishAll() de artik bunu sessizce atlamak yerine
  // paylasimi TAMAMEN engelliyor (bkz. x-studio/page.tsx).
  const REPAIR_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= REPAIR_ATTEMPTS; attempt++) {
    const missing = LOCALES.filter((l) => typeof parsed[l] !== "string" || !parsed[l].trim());
    if (missing.length === 0) break;

    console.warn(`[x/generateContent] repair attempt ${attempt}/${REPAIR_ATTEMPTS} — missing: ${missing.join(", ")}`);
    const referenceLocale = LOCALES.find((l) => typeof parsed[l] === "string" && parsed[l].trim());
    const referenceText = referenceLocale ? parsed[referenceLocale] : null;
    if (!referenceText) break; // hicbir dil basarili olmadiysa tamir edecek kaynak yok

    const repairPrompt = `Translate the following text (already in ${referenceLocale}) naturally into ${missing.join(", ")}. Preserve any cashtags (e.g. $AAPL) exactly as-is.

Text:
"${referenceText}"

Return a JSON object with keys: ${missing.join(", ")}, mapping each to the translated text. No explanation, no markdown — first character must be { and last must be }.`;

    try {
      let repairRaw = "";
      try {
        const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
        if (!deepseekApiKey) throw new Error("DEEPSEEK_API_KEY not configured");
        const deepseekProvider = createOpenAI({ apiKey: deepseekApiKey, baseURL: "https://api.deepseek.com" });
        const { text } = await generateText({
          model: deepseekProvider("deepseek-v4-flash"),
          system: systemInstruction,
          prompt: repairPrompt,
          temperature: 0.6,
        });
        repairRaw = text || "";
      } catch {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          contents: repairPrompt,
          config: { systemInstruction, temperature: 0.6 },
        });
        repairRaw = response.text || "";
      }

      const repaired = tryParseJSON(repairRaw);
      if (repaired) {
        for (const locale of missing) {
          if (typeof repaired[locale] === "string" && repaired[locale].trim()) {
            parsed[locale] = repaired[locale];
          }
        }
      }
    } catch (repairErr: any) {
      console.error(`[x/generateContent] repair attempt ${attempt} failed:`, repairErr?.message || repairErr);
    }
  }

  const stillMissing = LOCALES.filter((l) => typeof parsed[l] !== "string" || !parsed[l].trim());
  if (stillMissing.length > 0) {
    throw new Error(`AI response missing text for: ${stillMissing.join(", ")} (${REPAIR_ATTEMPTS} repair attempts also failed)`);
  }

  return parsed as Record<Locale, string>;
}
