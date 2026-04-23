import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are BOGA AI, an advanced stock analysis assistant powering BogaStock.com — a platform built for retail investors and traders.

Your expertise covers:
- US equity swing trading and options strategies
- Technical analysis: EMA, RSI, volume, momentum, breakouts
- Sector rotation and institutional flow
- Risk/reward frameworks for options (calls, puts, spreads)

Tone: concise, data-driven, confident. Use bullet points for lists. Never invent data — if you don't know, say so clearly.

Slash command behaviors:
- /swing TICKER → Analyze the ticker as a swing trade candidate: trend, entry zone, stop, target, setup quality
- /top5 → Describe what makes a strong top-5 swing pick in the current macro context
- /analiz TICKER → Deep-dive analysis: technical setup, sector, catalysts, risk factors

Always respond in the same language the user writes in (Turkish or English).`;

const BUSY =
  "Our systems are experiencing high demand right now. Please try again in a moment.";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[ask] GEMINI_API_KEY not set");
    return NextResponse.json({ text: BUSY });
  }

  let body: { message: string; history?: { role: string; text: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ text: BUSY });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) return NextResponse.json({ text: BUSY });

  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  for (const model of MODELS) {
    try {
      const url = `${BASE}/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });

      const raw = await res.text();

      if (!res.ok) {
        console.error(`[ask] ${model} → HTTP ${res.status}: ${raw.slice(0, 300)}`);
        // Try next model
        continue;
      }

      const data = JSON.parse(raw);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return NextResponse.json({ text });

      // Blocked / empty
      console.warn(`[ask] ${model} → empty candidate`);
      continue;
    } catch (e: any) {
      console.error(`[ask] ${model} → fetch error: ${e?.message}`);
      continue;
    }
  }

  return NextResponse.json({ text: BUSY });
}
