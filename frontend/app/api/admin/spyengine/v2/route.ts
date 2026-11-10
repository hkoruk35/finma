/**
 * SPY Engine V2 — canlı akış uç noktası.
 *
 * `/api/admin/spyengine/v2`            → tam anlık görüntü (ilk yükleme)
 * `/api/admin/spyengine/v2?since=<ts>` → yalnızca `ts` ve sonrasındaki mumlar
 *
 * Delta modu bilinçli: sayfa 1 saniyede bir yokluyor; her seferinde 800+ mum
 * göndermek saatte yüz megabaytlara çıkardı. Delta modda yanıt tipik olarak
 * birkaç yüz bayt kalır, "Son güncelleme" saati ise kesintisiz ilerler.
 *
 * Eski strateji motoru bu akıştan çıkarıldı: Takip Sistemi kararları tarayıcıda lib/spyengine/tracker.ts ile hesaplanır.
 *
 * Kimlik: /api/* proxy.ts matcher'ının dışında kaldığı için (bkz.
 * frontend/AGENTS.md §3, tasks/active/001) boga_auth kontrolü burada satır
 * içinde yapılır.
 */

import { NextRequest, NextResponse } from "next/server";
import { isEngineAuthed } from "@/lib/apiAuth";
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
  POST_CLOSE_MIN,
  type Bar,
} from "@/lib/spyengine/core";
import { detectRegimeSeries } from "@/lib/spyengine/regime";
import { readLevels, forecastClose } from "@/lib/spyengine/levels";
import { closedBars } from "@/lib/spyengine/strategy";
import { fetchSpyBundle, fetchSpy5mHistory } from "@/lib/spyengine/market";
import { overlayLiveTick } from "@/lib/spyengine/liveTicks";
import { rvolBaseline } from "@/lib/spyengine/ladder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/** RVOL tabanı gün içinde değişmez — 60 günlük geçmiş değişmedikçe yeniden hesaplanmaz */
let rvolCache: { key: string; value: { slot: number[]; cum: number[]; days: number } | null } | null = null;

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
  if (!isEngineAuthed(req)) {
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
    const [rawBundle, rvolHistory] = await Promise.all([
      fetchSpyBundle(),
      fetchSpy5mHistory().catch(() => ({ bars: [] as Bar[] })),
    ]);
    // canlı akış (Yahoo streamer, ~1 sn): anlık fiyat + oluşan mum; geçmiş gün oynatmada kullanılmaz
    const bundle = replayDate ? { ...rawBundle, liveTick: null } : overlayLiveTick("SPY", rawBundle, nowSec);
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

    // Seans günü mumları (04:00–20:00 ET, pre + RTH + post) — MOTOR bu
    // pencereyle çalışır, tarihi hiç değişmez.
    const sessionM1 = barsOfSessionDay(bundle.m1, session.date);
    // 5m/15m: Yahoo'nun kendi mumları (aynı epoch hizası → kayma yok).
    // 1m'den türetilmiş 5m ile karşılaştırıldığında sınırlar birebir örtüşür.
    const m5All = bundle.m5;
    const m15All = bundle.m15;

    // ── GRAFİK için ayrı, GENİŞ pencere ──────────────────────────────
    // Sadece bugünün seansıyla sınırlı (sessionM1) grafiğe verilirse
    // EMA21/BB20/RSI14/MACD gibi göstergeler her yeni seansın İLK 20-35
    // barı boyunca "—" görünür — ısınma verisi yok demektir. `bundle.m1`/
    // `m5All` zaten ~5 günlük geçmiş taşıyor; grafik bu geçmişi ISINMA için
    // kullanır, sadece hedef günün (session.date) SONRASINI (oynatma
    // modunda gelecek günleri) keser. Motor kararına (gen/regimeM1/levels/
    // forecast) DOKUNMAZ — onlar hâlâ sessionM1 kullanır.
    const chartCutoff = nyDateTimeToEpoch(session.date, POST_CLOSE_MIN);
    const chartM1 = bundle.m1.filter((b) => b.time <= chartCutoff);
    const chartM5 = m5All.filter((b) => b.time <= chartCutoff);

    // Rejim yalnızca Gün Kapanış Tahmini panelinin bant notunda kullanılır.
    const regimeM1 = closedBars(sessionM1, 1, evalNow);
    const regimeSeries = detectRegimeSeries(regimeM1);

    // ── Mum yükü: tam veya delta ───────────────────────────────────
    const cut = (bars: Bar[]) => (since ? bars.filter((b) => b.time >= since) : bars);
    const full = !since;

    const m1Out = cut(chartM1);
    const m5Out = cut(chartM5.length ? chartM5 : bucketAggregate(chartM1, 5));
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

    const isReplay = !!replayDate && replayDate !== liveSession.date;
    const replayPrev = isReplay ? rvolHistory.bars.filter((b) => isRthBar(b) && nyParts(b.time).ymd < session.date).at(-1)?.close ?? null : null;
    const prevClose = isReplay ? replayPrev : bundle.previousClose;
    if (isReplay && lastBar) { price = lastBar.close; priceTime = lastBar.time; }

    return NextResponse.json(
      {
        ok: true,
        serverTime: nowSec,
        full,
        session,
        dataSource: {
          primary: "canlı piyasa verisi (premarket + aftermarket dahil)",
          overnight: bundle.overnightSource,
          live: bundle.liveTick ? { price: bundle.liveTick.price, time: bundle.liveTick.time } : null,
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
          m1: toCompact(m1Out),
          m5: toCompact(m5Out),
          m15: toCompact(m15Out),
        },
        // V4 seviye paneli (spec 3) -- hepsi olculen veriden, uydurma yok
        levels: readLevels({
          sessionM1,
          allM1: bundle.m1,
          date: session.date,
          prevClose,
          nowSec: evalNow,
        }),
        // V4 gun kapanis tahmini (spec 4) -- bant genisligi olculmus
        // kantilden geliyor, guven o bandin tanim geregi isabet orani
        forecast: forecastClose({
          sessionM1,
          date: session.date,
          nowSec: evalNow,
          prevClose,
          regime: regimeSeries.current.regime,
        }),
        // Karar merdiveni RVOL tabanı: son 20 seansta AYNI SAATTEKİ 5m mumların ortalama hacmi
        // (78 dilim) + aynı saate kadar ortalama toplam hacim. Yalnızca seans tarihinden ÖNCEKİ günler.
        rvolBase: (() => {
          const key = `${session.date}:${rvolHistory.bars.length}:${rvolHistory.bars[rvolHistory.bars.length - 1]?.time ?? 0}`;
          if (rvolCache?.key === key) return rvolCache.value;
          const b = rvolBaseline(rvolHistory.bars, session.date);
          // med: aynı saatin medyan hacmi — Takip Sistemi RVOL'u (merdiven slot/cum kullanır, değişmedi)
          const value = b ? { slot: b.slot.map(Math.round), cum: b.cum.map(Math.round), days: b.days, med: (b.med ?? []).map(Math.round) } : null;
          rvolCache = { key, value };
          return value;
        })(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message, serverTime: nowSec }, { status: 500 });
  }
}
