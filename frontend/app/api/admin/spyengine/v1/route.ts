import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { getSnapshot, buildReplay } from "@/lib/v4/snapshot";
import { buildForecast } from "@/lib/v4/forecast";
import type { Bar } from "@/lib/v4/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isStaffAuthed(request)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
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
    const structure = (snapshot as any).structure?.spot5m || "RANGE";
    if (structure.includes("UP")) m5 = "Breakout Watch";
    if (structure.includes("DOWN")) m5 = "Support Test";
    
    if (netScore > 3 && lastFrame.spotPrice > (snapshot as any).levels.spot.orh) m5 = "Breakout";
    else if (netScore < -3 && lastFrame.spotPrice < (snapshot as any).levels.spot.orl) m5 = "Reversal";

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

    // Piyasa kapalıysa (hafta sonu / mesai dışı) getSnapshot zaten en son
    // tamamlanmış seansı (örn. Cuma kapanışı) döndürür — burada bunu
    // frontend'e açıkça bildiriyoruz ki grafik/başlık "canlı" gibi
    // görünmesin.
    let isLiveSession = (snapshot as any).isLiveSession ?? false;
    let sessionDate: string | null = (snapshot as any).sessionDate ?? null;

    // Grafik mumlarını da aynı yanıt içinde gönder: ayrı bir supertrade/v4
    // çağrısına bağımlı kalmayı (ve oradaki yanıt şekli farkını) ortadan
    // kaldırır. CompactBar = [time, open, high, low, close, volume].
    const toBars = (compact: number[][]) =>
      (compact || [])
        .filter((b) => Array.isArray(b) && b.length >= 5 && Number.isFinite(b[1]) && Number.isFinite(b[4]))
        .map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
    // Tahmin motoru hacim verisine de ihtiyaç duyuyor (CompactBar[5] = volume).
    const toBarsWithVolume = (compact: number[][]): Bar[] =>
      (compact || [])
        .filter((b) => Array.isArray(b) && b.length >= 5 && Number.isFinite(b[1]) && Number.isFinite(b[4]))
        .map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] || 0 }));

    let compactSpot: number[][] = (snapshot as any).bars?.spot || [];
    let bars = toBars(compactSpot);

    // Pazar akşamı Globex açıldığında sessionDate bir sonraki iş gününe
    // (Pazartesi) devrediyor ama RTH mumları henüz yok — bu durumda grafik
    // boş kalırdı. buildReplay tarihsiz çağrıldığında elde mevcut olan EN
    // SON tamamlanmış seansı (örn. Cuma) getirir; boş mum durumunda buna
    // düşüyoruz ki hafta sonu her zaman Cuma kapanış grafiği görünsün.
    if (!bars.length) {
      try {
        const replay = await buildReplay(asset as any);
        const replayCompact: number[][] = (replay as any).bars?.spot || [];
        const replayBars = toBars(replayCompact);
        if (replayBars.length) {
          bars = replayBars;
          compactSpot = replayCompact;
          isLiveSession = false;
          sessionDate = (replay as any).date ?? sessionDate;
        }
      } catch {
        // yeniden oynatma da başarısız olursa boş grafik ile devam et
      }
    }

    const marketNote = isLiveSession
      ? null
      : `Piyasa kapalı — ${sessionDate ?? "son"} seansının kapanış grafiği gösteriliyor.`;

    // 60 dakikalık tahmin: hacim + fiyat eğilimi projeksiyonu (5m mumlarla).
    // Canlı BUY/HOLD/SELL sinyal motorunu DEĞİŞTİRMEZ — grafikte ek bir
    // kesikli çizgi katmanı olarak gösterilir.
    const forecast = buildForecast(toBarsWithVolume(compactSpot));

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
      isLiveSession,
      sessionDate,
      marketNote,
      bars,
      forecast,
    };

    return NextResponse.json({ ok: true, data: engineData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
