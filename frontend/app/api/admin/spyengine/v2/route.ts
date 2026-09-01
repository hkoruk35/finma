/**
 * SPY Engine V2 — canlı akış uç noktası.
 *
 * `/api/admin/spyengine/v2`            → tam anlık görüntü (ilk yükleme)
 * `/api/admin/spyengine/v2?since=<ts>` → yalnızca `ts` ve sonrasındaki mumlar
 *
 * Delta modu bilinçli: sayfa 2 saniyede bir yokluyor; her seferinde 800+ mum
 * göndermek saatte yüz megabaytlara çıkardı. Delta modda yanıt tipik olarak
 * birkaç yüz bayt kalır, "Son güncelleme" saati ise kesintisiz ilerler.
 *
 * Kimlik: /api/* proxy.ts matcher'ının dışında kaldığı için (bkz.
 * frontend/AGENTS.md §3, tasks/active/001) boga_auth kontrolü burada satır
 * içinde yapılır.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import {
  detectSession,
  barsOfSessionDay,
  bucketAggregate,
  toCompact,
  nyDateTimeToEpoch,
  nyParts,
  sessionVwap,
  atr,
  lastNum,
  isRthBar,
  r2,
  PRE_OPEN_MIN,
  RTH_OPEN_MIN,
  RTH_CLOSE_MIN,
  type Bar,
} from "@/lib/spyengine/core";
import {
  generateCandidates,
  findExitSignal,
  runLifecycle,
  filterOverlapping,
  buildOptionSymbol,
  atmStrike,
  type PositionState,
  type EngineEvent,
} from "@/lib/spyengine/strategy";
import { fetchSpyBundle, fetchOptionSeries, fetchAtmContract } from "@/lib/spyengine/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/**
 * Aynı seansta prim serisi çekilecek azami aday sayısı. V3'te giriş artık
 * 1m seri tabanlı (V2'nin 5m-kapı sınırlaması yok) — tam bir RTH günü, her
 * pozisyon kapanışının ardından bir düzeltme mumu beklense bile 8'den çok
 * daha fazla Kontrat A/B tetiklenebilir. 8 ile sınırlı kalınsaydı sabahki
 * sinyaller `.slice(-N)` yüzünden öğleden sonra sessizce ekrandan düşerdi.
 */
const MAX_TRACKED_POSITIONS = 40;

/**
 * Kapanmış bir pozisyonun sonucu ASLA değişmez (deterministik, non-repainting).
 * Bu önbellek olmadan MAX_TRACKED_POSITIONS=40 ile her 2 sn'lik yoklamada
 * 40 ayrı opsiyon kontratının prim serisi yeniden çekilirdi — çoğu saatler
 * önce kapanmış, sonucu hiç değişmeyecek pozisyonlar için. Süreç sıcak
 * kaldığı sürece (bkz. lib/spyengine/market.ts'teki aynı desendeki TTL
 * önbelleği) kapanmış pozisyonlar bir daha hiç Yahoo'ya sorulmaz.
 */
const resolvedPositionCache = new Map<string, PositionState>();

function spotStats(sessionBars: Bar[], date: string) {
  const rth = sessionBars.filter(isRthBar);
  const pre = sessionBars.filter((b) => {
    const p = nyParts(b.time);
    return p.minutes >= PRE_OPEN_MIN && p.minutes < RTH_OPEN_MIN;
  });

  const hi = (arr: Bar[]) => (arr.length ? Math.max(...arr.map((b) => b.high)) : null);
  const lo = (arr: Bar[]) => (arr.length ? Math.min(...arr.map((b) => b.low)) : null);

  const vwapSeries = sessionVwap(sessionBars);
  const atrSeries = atr(sessionBars, 14);
  const volume = sessionBars.reduce((s, b) => s + (b.volume || 0), 0);
  const rthVolume = rth.reduce((s, b) => s + (b.volume || 0), 0);

  const sessionHigh = hi(sessionBars);
  const sessionLow = lo(sessionBars);
  const lastClose = sessionBars.length ? sessionBars[sessionBars.length - 1].close : null;

  return {
    date,
    rthHigh: hi(rth),
    rthLow: lo(rth),
    preHigh: hi(pre),
    preLow: lo(pre),
    sessionHigh,
    sessionLow,
    /** Fiyatın gün aralığı içindeki konumu (%0 = dip, %100 = zirve) */
    rangePct:
      sessionHigh != null && sessionLow != null && lastClose != null && sessionHigh > sessionLow
        ? r2(((lastClose - sessionLow) / (sessionHigh - sessionLow)) * 100)
        : null,
    vwap: (() => { const v = lastNum(vwapSeries); return v == null ? null : r2(v); })(),
    atr14: (() => { const v = lastNum(atrSeries); return v == null ? null : Math.round(v * 1000) / 1000; })(),
    volume,
    rthVolume,
    barCount: sessionBars.length,
    firstBarTime: sessionBars.length ? sessionBars[0].time : null,
    lastBarTime: sessionBars.length ? sessionBars[sessionBars.length - 1].time : null,
  };
}

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const params = new URL(req.url).searchParams;
  const sinceParam = Number(params.get("since"));
  const since = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : null;
  // Geçmiş seans oynatma (geriye dönük test): ?date=YYYY-MM-DD
  // Yahoo'nun 1m geçmişi ~5 gün olduğu için bu pencerenin dışındaki bir
  // tarih istenirse mum bulunamaz ve boş grafik döner — veri uydurulmaz.
  const dateParam = params.get("date");
  const replayDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

  try {
    const bundle = await fetchSpyBundle();
    const liveSession = detectSession(bundle.m1, nowSec);
    const session: typeof liveSession = replayDate && replayDate !== liveSession.date
      ? {
          date: replayDate,
          phase: "CLOSED",
          isLive: false,
          note: `Geriye dönük oynatma — ${replayDate} seansı. Canlı akış duraklatıldı.`,
          rthOpen: nyDateTimeToEpoch(replayDate, RTH_OPEN_MIN),
          rthClose: nyDateTimeToEpoch(replayDate, RTH_CLOSE_MIN),
        }
      : liveSession;
    // Oynatmada "şimdi" seansın sonudur; aksi hâlde 1m/5m mumların hepsi
    // "henüz kapanmadı" sayılıp motor hiç sinyal üretmezdi.
    const evalNow = session.isLive ? nowSec : Math.min(nowSec, session.rthClose + 4 * 60 * 60);

    // Seans günü mumları (04:00–20:00 ET, pre + RTH + post)
    const sessionM1 = barsOfSessionDay(bundle.m1, session.date);
    // 5m/15m: Yahoo'nun kendi mumları (aynı epoch hizası → kayma yok).
    // 1m'den türetilmiş 5m ile karşılaştırıldığında sınırlar birebir örtüşür.
    const m5All = bundle.m5;
    const m15All = bundle.m15;
    const sessionM5 = barsOfSessionDay(m5All, session.date);

    // ── Motor ──────────────────────────────────────────────────────
    const gen = generateCandidates({
      m1: sessionM1,
      m5: m5All,
      m15: m15All,
      session,
      nowSec: evalNow,
    });

    // ── Pozisyon yaşam döngüleri (gerçek 0DTE prim mumlarıyla) ──────
    //
    // V3.1: çıkış kararı artık GİRİŞLE AYNI VERİDEN (SPY 1m/5m) üretiliyor;
    // opsiyon primi yalnızca $ kâr/zararı fiyatlıyor. Bu yüzden çıkış
    // taraması prim isteğinden BAĞIMSIZ ve önce yapılır.
    const tracked = gen.candidates.slice(-MAX_TRACKED_POSITIONS);
    const candKey = (c: { time: number; side: string; contractType: string }) =>
      `${session.date}:${c.time}:${c.side}:${c.contractType}`;
    const positions: PositionState[] = await Promise.all(
      tracked.map(async (c) => {
        const cached = resolvedPositionCache.get(candKey(c));
        if (cached) return cached;

        const exit = findExitSignal({
          m1: sessionM1,
          m5: m5All,
          entryTime: c.time,
          side: c.side,
          entrySpot: c.spot,
          session,
          nowSec: evalNow,
        });

        const isCall = c.side === "LONG";
        const strike = atmStrike(c.spot);
        const contract = buildOptionSymbol("SPY", session.date, isCall, strike);
        const series = await fetchOptionSeries(contract);
        const pos = runLifecycle({
          candidate: c,
          exit,
          premiumBars: series.bars,
          contract: series.bars.length ? contract : null,
          strike: series.bars.length ? strike : null,
          expiry: session.date,
          livePremium: series.livePremium,
        });
        if (pos.status === "CLOSED") {
          if (resolvedPositionCache.size > 2000) resolvedPositionCache.clear();
          resolvedPositionCache.set(candKey(c), pos);
        }
        return pos;
      })
    );

    // Aynı anda tek pozisyon + talimat §5 yeniden giriş (düzeltme mumu) kuralı
    const accepted = new Set(
      filterOverlapping(tracked, positions, sessionM1).map((c) => `${c.time}:${c.side}:${c.contractType}`)
    );
    const activePositions = positions.filter((p) => accepted.has(`${p.entryTime}:${p.side}:${p.contractType}`));
    const openPosition = activePositions.find((p) => p.status !== "CLOSED") ?? null;

    // Motor okuması pozisyonlardan ÖNCE üretiliyor (adaylar oradan çıkıyor);
    // açık pozisyon varsa durumu burada "POZİSYONDA"ya çekiyoruz ki panel
    // "hazırlanıyor" derken aslında pozisyon taşıdığımızı gizlemesin.
    if (openPosition) {
      gen.read.state = "IN_POSITION";
      gen.read.stateLabel = openPosition.side === "LONG" ? "LONG POZİSYONDA" : "SHORT POZİSYONDA";
      gen.read.action = openPosition.side;
      gen.read.contractType = openPosition.contractType;
      gen.read.nextStep = openPosition.progress.note;
      gen.read.reasoning = `Pozisyon açık (${nyParts(openPosition.entryTime).hhmm} ET girişi) — trend devam ettiği sürece taşınıyor.`;
    }

    // Olayların spot değerleri artık SPY mumlarından geliyor (giriş adayın
    // kapanışı, çıkış sinyalin kendi mumu) — geriye doldurmaya gerek yok.
    const events: EngineEvent[] = activePositions.flatMap((p) => p.events).sort((a, b) => a.time - b.time);

    // ── Açık pozisyon için canlı ATM zincir kotasyonu (gerçek bid/ask) ──
    let liveChain = null;
    if (openPosition && openPosition.strike != null) {
      // Yahoo, vadeyi UTC gece yarısı epoch'u olarak bekler.
      const [ey, em, ed] = session.date.split("-").map(Number);
      const expiryEpoch = Date.UTC(ey, em - 1, ed) / 1000;
      liveChain = await fetchAtmContract(
        "SPY",
        expiryEpoch,
        openPosition.side === "LONG",
        openPosition.entrySpot
      ).catch(() => null);
    }

    // ── Mum yükü: tam veya delta ───────────────────────────────────
    const cut = (bars: Bar[]) => (since ? bars.filter((b) => b.time >= since) : bars);
    const full = !since;

    const m5Out = cut(sessionM5.length ? sessionM5 : bucketAggregate(sessionM1, 5));
    const m15Out = cut(m15All.slice(-260));

    const stats = spotStats(sessionM1, session.date);
    const lastBar = sessionM1.length ? sessionM1[sessionM1.length - 1] : null;

    // Anlık fiyat: Yahoo meta ile son mumdan hangisi daha yeniyse o.
    // İkisi de yoksa null — yaklaşık değer üretilmez.
    let price: number | null = null;
    let priceTime: number | null = null;
    if (lastBar && bundle.marketTime != null) {
      if (lastBar.time >= bundle.marketTime) { price = lastBar.close; priceTime = lastBar.time; }
      else { price = bundle.marketPrice; priceTime = bundle.marketTime; }
    } else if (lastBar) { price = lastBar.close; priceTime = lastBar.time; }
    else if (bundle.marketPrice != null) { price = bundle.marketPrice; priceTime = bundle.marketTime; }

    const prevClose = bundle.previousClose;

    return NextResponse.json(
      {
        ok: true,
        serverTime: nowSec,
        full,
        session,
        dataSource: {
          primary: "Yahoo Finance v8 (includePrePost)",
          overnight: bundle.overnightSource,
          sanitized: bundle.sanitized,
          errors: bundle.errors,
        },
        spot: {
          price,
          priceTime,
          prevClose,
          change: price != null && prevClose != null ? r2(price - prevClose) : null,
          changePct:
            price != null && prevClose != null && prevClose !== 0
              ? r2(((price - prevClose) / prevClose) * 100)
              : null,
          ...stats,
        },
        bars: {
          m1: toCompact(cut(sessionM1)),
          m5: toCompact(m5Out),
          m15: toCompact(m15Out),
        },
        engine: gen.read,
        lastClosed: gen.lastClosed,
        positions: activePositions,
        openPosition,
        liveChain,
        events,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message, serverTime: nowSec }, { status: 500 });
  }
}
