import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  let body: { message: string; history?: { role: string; text: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const contents = [
    {
      role: "user",
      parts: [{ text: SYSTEM_PROMPT }],
    },
    {
      role: "model",
      parts: [{ text: "Understood. I'm BOGA AI, ready to assist with stock analysis." }],
    },
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.text }],
    })),
    {
      role: "user",
      parts: [{ text: message }],
    },
  ];

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini error:", err);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from AI.";

    return NextResponse.json({ text });
  } catch (e: any) {
    if (e?.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
