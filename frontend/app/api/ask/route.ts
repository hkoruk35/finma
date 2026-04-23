import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash";
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ text: "Service temporarily unavailable. Please try again later." });
  }

  let body: { message: string; history?: { role: string; text: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ text: "Invalid request." });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) {
    return NextResponse.json({ text: "Please enter a message." });
  }

  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  try {
    const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.status === 429) {
      return NextResponse.json({
        text: "Our systems are experiencing high demand right now. Please try again in a moment.",
      });
    }

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[ask] HTTP ${res.status}:`, errBody.slice(0, 200));
      return NextResponse.json({
        text: "Our systems are experiencing high demand right now. Please try again in a moment.",
      });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.warn("[ask] Empty candidate:", JSON.stringify(data).slice(0, 200));
      return NextResponse.json({
        text: "Our systems are experiencing high demand right now. Please try again in a moment.",
      });
    }

    return NextResponse.json({ text });
  } catch (e: any) {
    console.error("[ask] fetch error:", e?.message);
    return NextResponse.json({
      text: "Our systems are experiencing high demand right now. Please try again in a moment.",
    });
  }
}
