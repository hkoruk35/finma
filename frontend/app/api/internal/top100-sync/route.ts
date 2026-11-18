import { NextRequest, NextResponse } from "next/server";
import { syncTop100Composition } from "@/lib/top100Sync";

/**
 * Bot pipeline -> canli site internal sync.
 * Kompozisyon kaynaklari (Faz 6):
 *  - source='fixed'      <- /tracker'daki admin listesinden hacme gore Top 90 (haftalik, Cuma 23:59 NY)
 *  - source='swing_daily' <- /swing'in en guncel Top 10'u (gunluk, 14:00 NY)
 * Ayni endpoint, kompozisyon degismeden tekrar cagrildiginda (hourly job) snapshot'lari da tazeler —
 * tek merkezi hesaplama (lib/top100Sync.ts), paralel mekanizma yok. Sunucu ici zamanlayici
 * (lib/top100Scheduler.ts) da ayni fonksiyonu dogrudan cagirir.
 */

function requireBotSecret(req: NextRequest): boolean {
  // Mevcut bot-pipeline kimlik dogrulamasi (swing117_boga.py -> /api/revalidate-swing ile ayni desen)
  const secret = req.headers.get("x-revalidate-secret");
  return !!secret && secret === process.env.REVALIDATE_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireBotSecret(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { tickers?: string[]; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const source = body.source === "swing_daily" ? "swing_daily" : body.source === "fixed" ? "fixed" : null;
  const tickers = (body.tickers ?? []).map((t) => t.toUpperCase().trim()).filter(Boolean);
  if (!source || tickers.length === 0) {
    return NextResponse.json({ error: "source ('fixed'|'swing_daily') and a non-empty tickers[] are required." }, { status: 400 });
  }

  const result = await syncTop100Composition(source, tickers);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
