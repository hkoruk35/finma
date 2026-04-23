import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no key" });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "say hi" }] }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const raw = await res.text();
    return NextResponse.json({ status: res.status, body: raw.slice(0, 500), keyPrefix: apiKey.slice(0, 6) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message });
  }
}
