import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/v4/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const asset = (searchParams.get("symbol") || "SPY").toUpperCase();
    
    // V4 engine verisini al (bunun içinde spot fiyatı, vwap vb var)
    const snapshot = await getSnapshot(asset as any);
    
    if (!snapshot || (snapshot as any).ok === false) {
      return NextResponse.json({ ok: false, error: "Snapshot alınamadı" }, { status: 500 });
    }

    const frames = snapshot.frames;
    const lastFrame = frames[frames.length - 1];
    
    // M15 Yön tahmini
    const netScore = lastFrame?.netScore || 0;
    let m15 = "Neutral";
    if (netScore >= 2) m15 = "Bullish";
    else if (netScore <= -2) m15 = "Bearish";

    // M5 Setup
    let m5 = "Waiting";
    const structure = lastFrame?.structure?.spot5m || "RANGE";
    if (structure.includes("UP")) m5 = "Breakout Watch";
    if (structure.includes("DOWN")) m5 = "Support Test";
    
    if (netScore > 3 && lastFrame.spotPrice > snapshot.levels.spot.orh) m5 = "Breakout";
    else if (netScore < -3 && lastFrame.spotPrice < snapshot.levels.spot.orl) m5 = "Reversal";

    // M1 Tetik ve State hesaplaması
    let m1 = "Waiting";
    let action = "BEKLE";
    let state = "WATCHING";
    let reasoning = `Tracking ${asset} - Score: ${netScore.toFixed(1)}`;
    let confidence = Math.round(Math.min(100, Math.max(0, 50 + (netScore * 5))));

    if (m5 === "Breakout" && netScore >= 4) {
      m1 = "Bullish Rejection";
      state = "TRIGGERED";
      action = "BUY";
      reasoning = "Breakout confirmed, M1 rejection setup active.";
      confidence = Math.round(Math.min(100, 70 + (netScore * 3)));
    } else if (m5 === "Reversal" && netScore <= -4) {
      m1 = "Bearish Rejection";
      state = "TRIGGERED";
      action = "SHORT";
      reasoning = "Reversal confirmed, M1 breakdown setup active.";
      confidence = Math.round(Math.min(100, 70 + (Math.abs(netScore) * 3)));
    } else if (netScore > 1) {
      state = "ARMED";
      reasoning = "Bullish bias building, waiting for trigger.";
    } else if (netScore < -1) {
      state = "ARMED";
      reasoning = "Bearish bias building, waiting for trigger.";
    }

    const engineData = {
      asset,
      m15,
      m5,
      m1,
      state,
      action,
      price: lastFrame?.spotPrice || snapshot.spotPrice,
      confidence,
      reasoning,
    };

    return NextResponse.json({ ok: true, data: engineData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
