// Tek noktadan DeepSeek → Gemini → Claude Haiku metin üretimi. ask/route.ts,
// deep-analysis/route.ts, ai-briefing/route.ts ve kriter-analysis/route.ts
// ayrı ayrı aynı fetch/Anthropic SDK boilerplate'ini tekrarlıyordu — bu dosya
// onu tek, test edilebilir bir yere topluyor. copilot/chat ve ask-copilot bu
// modülü KULLANMAZ (onlar Vercel AI SDK'nın streamText/generateText + tools
// akışını kullanıyor, buradaki ham fetch/SDK deseniyle uyumsuz).
import Anthropic from "@anthropic-ai/sdk";

export type FallbackProvider = "deepseek" | "gemini" | "claude";

export interface FallbackChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateWithFallbackOptions {
  systemPrompt?: string;
  history?: FallbackChatTurn[];
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Çağıranın JSON.parse() edeceği durumlarda true — her 3 sağlayıcıda da
   *  yapılandırılmış JSON çıktısı ister. */
  jsonMode?: boolean;
  /** Varsayılan sıra: deepseek → gemini → claude (ekonomik mimari). */
  order?: FallbackProvider[];
  timeoutMs?: number;
}

export interface FallbackTextResult {
  text: string;
  source: FallbackProvider;
}

const DEEPSEEK_MODEL = "deepseek-v4-flash";
const GEMINI_MODEL = "gemini-2.5-flash";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_ORDER: FallbackProvider[] = ["deepseek", "gemini", "claude"];

async function callDeepSeek(opts: GenerateWithFallbackOptions): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

  const messages = [
    ...(opts.systemPrompt ? [{ role: "system", content: opts.systemPrompt }] : []),
    ...(opts.history || []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: opts.userPrompt },
  ];

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 2048,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
  });
  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek: empty response");
  return text;
}

async function callGemini(opts: GenerateWithFallbackOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const contents = [
    ...(opts.history || []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: opts.userPrompt }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(opts.systemPrompt ? { systemInstruction: { parts: [{ text: opts.systemPrompt }] } } : {}),
        contents,
        generationConfig: {
          temperature: opts.temperature ?? 0.6,
          maxOutputTokens: opts.maxTokens ?? 2048,
          ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini: empty response");
  return text;
}

async function callClaude(opts: GenerateWithFallbackOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const anthropic = new Anthropic({ apiKey });
  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.systemPrompt,
    messages: [
      ...(opts.history || []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: opts.userPrompt },
    ],
  });
  const block = msg.content[0];
  const text = block?.type === "text" ? block.text : "";
  if (!text) throw new Error("Claude: empty response");
  return text;
}

const CALLERS: Record<FallbackProvider, (opts: GenerateWithFallbackOptions) => Promise<string>> = {
  deepseek: callDeepSeek,
  gemini: callGemini,
  claude: callClaude,
};

/**
 * DeepSeek → Gemini → Claude Haiku sırasıyla dener, ilk başarılıyı döner.
 * Hepsi başarısız olursa null döner — çağıran kendi hata mesajını seçer.
 */
export async function generateWithFallback(
  opts: GenerateWithFallbackOptions
): Promise<FallbackTextResult | null> {
  const order = opts.order && opts.order.length > 0 ? opts.order : DEFAULT_ORDER;
  for (const provider of order) {
    try {
      const text = await CALLERS[provider](opts);
      return { text, source: provider };
    } catch (e) {
      console.error(`[aiFallback] ${provider} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
