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
  POST_CLOSE_MIN,
  type Bar,
} from "@/lib/spyengine/core";
import { detectRegimeSeries } from "@/lib/spyengine/regime";
import { readLevels, forecastClose } from "@/lib/spyengine/levels";
import {
  closedBars,
  generateCandidates,
  findExitSignal,
  runLifecycle,
  filterOverlapping,
  buildOptionSymbol,
  strikeFor,
  type PositionState,
  type EngineEvent,
} from "@/lib/spyengine/strategy";
import { fetchSpyBundle, fetchSpy5mHistory, fetchOptionSeries, fetchAtmContract } from "@/lib/spyengine/market";
import { realizedVolPerBar, buildSeasonalityProfile, seasonalityMultiplierAt, EMPTY_SEASONALITY } from "@/lib/spyengine/volatility";
import { runMonteCarlo, seedFromBar } from "@/lib/spyengine/monteCarlo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/**
 * Prim serisi çekilecek azami pozisyon sayısı — artık ADAYLARA değil, zincir
 * çözüldükten sonra KABUL EDİLEN pozisyonlara uygulanır. Tipik bir seansta
 * ~20 pozisyon kabul ediliyor, dolayısıyla bu sınır pratikte devreye girmez;
 * yalnızca patolojik bir günde Yahoo'ya sınırsız istek gitmesini önler.
 */
const MAX_TRACKED_POSITIONS = 80;

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
    const [bundle, rvolHistory] = await Promise.all([
      fetchSpyBundle(),
      fetchSpy5mHistory().catch(() => ({ bars: [] as Bar[] })),
    ]);
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

    // ── Motor ──────────────────────────────────────────────────────
    const gen = generateCandidates({
      m1: sessionM1,
      m5: m5All,
      m15: m15All,
      session,
      nowSec: evalNow,
      m5History: rvolHistory.bars,
    });

    // ── V6.0: rejim (TREND/SIKIŞMA) motoru artık karar mekanizmasının
    // parçası DEĞİL — yalnızca Gün Kapanış Tahmini panelinin bant genişliği
    // notunda kozmetik amaçla kullanılıyor (bkz. levels.ts forecastClose).
    // Giriş/çıkış kararları artık generateCandidates/findExitSignal
    // içindeki 15m veto + 5m Layer1/2 rejimi + 1m tetik zincirinden gelir.
    const regimeM1 = closedBars(sessionM1, 1, evalNow);
    const regimeSeries = detectRegimeSeries(regimeM1);

    // ── Pozisyon yaşam döngüleri (gerçek 0DTE prim mumlarıyla) ──────
    //
    // Çıkış kararı GİRİŞLE AYNI VERİDEN (SPY 1m/5m) üretiliyor; opsiyon
    // primi yalnızca $ kâr/zararı fiyatlıyor. Bunun önemli bir sonucu var:
    // tek-pozisyon/yeniden-giriş zinciri HİÇ ağ isteği olmadan, tüm adaylar
    // üzerinde çözülebiliyor. Önce zincir çözülür (ücretsiz), sonra yalnızca
    // KABUL EDİLEN pozisyonlar için prim çekilir.
    const scans = gen.candidates.map((c) =>
      findExitSignal({
        m1: sessionM1,
        m5: m5All,
        entryTime: c.time,
        side: c.side,
        entrySpot: c.spot,
        session,
        nowSec: evalNow,
      })
    );
    const shells = gen.candidates.map((c, i) => ({
      entryTime: c.time,
      side: c.side,
      contractType: c.contractType,
      exitTime: scans[i].signal?.time ?? null,
      // V4.1 (B.3): saf/senkron hesap — ağ isteği gerektirmez, filterOverlapping
      // her adayın kendi "kontrat başına tek deneme" kontrolünü buradan yapar.
      strike: strikeFor(c.spot, c.side, c.contractType),
    }));
    const scanByTime = new Map(gen.candidates.map((c, i) => [`${c.time}:${c.side}:${c.contractType}`, scans[i]]));

    const { accepted: acceptedAll, contractReuseBlocked } = filterOverlapping(gen.candidates, shells, sessionM1);
    const accepted = acceptedAll.slice(-MAX_TRACKED_POSITIONS);

    const candKey = (c: { time: number; side: string; contractType: string }) =>
      `${session.date}:${c.time}:${c.side}:${c.contractType}`;
    const activePositions: PositionState[] = await Promise.all(
      accepted.map(async (c) => {
        const cached = resolvedPositionCache.get(candKey(c));
        if (cached) return cached;

        const exit = scanByTime.get(`${c.time}:${c.side}:${c.contractType}`)!;
        const isCall = c.side === "LONG";
        const strike = strikeFor(c.spot, c.side, c.contractType);
        const contract = buildOptionSymbol("SPY", session.date, isCall, strike);
        const series = await fetchOptionSeries(contract);
        // V4 ikinci gecis: sikisma rejiminin hedef/stop kurallari PRIM
        // yuzdesi uzerinden tanimli, ama prim ancak aday kabul edildikten
        // sonra cekiliyor (aglayi ~20 istekte tutan bilincli sira). Bu
        // yuzden cikis, prim elde edildikten sonra bir kez daha taranir.
        const exitWithPremium = series.bars.length
          ? findExitSignal({
              m1: sessionM1,
              m5: m5All,
              entryTime: c.time,
              side: c.side,
              entrySpot: c.spot,
              session,
              nowSec: evalNow,
              premiumBars: series.bars,
            })
          : exit;
        const pos = runLifecycle({
          candidate: c,
          exit: exitWithPremium,
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

    // ── V4: 3 ardisik kayip -> 15 dk sinyal durdurma (spec 7.2) ────
    //
    // "Kayip" burada SPOT sonucuyla tanimli, prim ile degil: prim her
    // pozisyonda gelmeyebiliyor ve tanimin deterministik kalmasi gerek.
    // 2 Eylul'de motor tam bu tuzaga dusmustu (11:39, 12:24, 14:03).
    const COOLDOWN_AFTER_LOSSES = 3;
    const COOLDOWN_MINUTES = 15;
    let cooldownUntil: number | null = null;
    {
      let streak = 0;
      const kept: PositionState[] = [];
      for (const pos of activePositions) {
        if (cooldownUntil != null && pos.entryTime < cooldownUntil) continue;
        kept.push(pos);
        if (pos.status !== "CLOSED" || pos.exitSpot == null) continue;
        const spotPnl = (pos.exitSpot - pos.entrySpot) * (pos.side === "LONG" ? 1 : -1);
        if (spotPnl < 0) streak++;
        else streak = 0;
        if (streak >= COOLDOWN_AFTER_LOSSES) {
          cooldownUntil = (pos.exitTime ?? pos.entryTime) + COOLDOWN_MINUTES * 60;
          streak = 0;
        }
      }
      activePositions.length = 0;
      activePositions.push(...kept);
    }
    const cooldownActive = cooldownUntil != null && evalNow < cooldownUntil;

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

    const prevClose = bundle.previousClose;

    // ── Faz 1 (tasks/active/013): Monte Carlo 5m fiyat yolu ──────────
    // Girdi SADECE gerçek ölçümden gelir: gerçekleşen volatilite (VIX
    // DEĞİL — bkz. volatility.ts başlığı) × gün-içi mevsimsellik (RVOL
    // baseline'ıyla AYNI çok günlü 5m veri seti, ek istek yok). Sigma
    // hesaplanamıyorsa (yetersiz geçmiş) `monteCarlo: null` döner —
    // uydurma olasılık üretilmez.
    const m5ClosedForVol = closedBars(m5All, 5, evalNow);
    const sigmaRaw = realizedVolPerBar(m5ClosedForVol);
    const seasonalityProfile = rvolHistory.bars.length
      ? buildSeasonalityProfile(rvolHistory.bars, session.date)
      : EMPTY_SEASONALITY;
    const seasonality = seasonalityMultiplierAt(seasonalityProfile, evalNow);
    const sigmaAdj = sigmaRaw != null ? sigmaRaw * seasonality.multiplier : null;
    const lastM5ForSeed = m5ClosedForVol.length ? m5ClosedForVol[m5ClosedForVol.length - 1] : null;

    const monteCarlo = sigmaAdj != null && price != null && lastM5ForSeed
      ? (() => {
          const steps = 6; // 6 × 5m = 30 dakika ufuk
          const nSims = 3000;
          const seed = seedFromBar(lastM5ForSeed.time, price);
          const mc = runMonteCarlo({ spot: price, sigmaPerStep: sigmaAdj, steps, nSims, seed });
          const center = Math.round(price);
          const levels = [];
          for (let off = -3; off <= 3; off++) {
            const lvl = center + off;
            levels.push({
              price: lvl,
              touchProbability: r2(mc.touchProbability(lvl) * 100),
              densityPct: r2(mc.densityInBand(lvl - 0.5, lvl + 0.5) * 100),
            });
          }
          return {
            sigmaPerBarRaw: sigmaRaw,
            seasonalityMultiplier: r2(seasonality.multiplier),
            seasonalitySampleDays: seasonality.sampleDays,
            sigmaPerBarAdj: sigmaAdj,
            horizonMin: mc.horizonMin,
            nSims,
            asOfBarTime: lastM5ForSeed.time,
            levels,
          };
        })()
      : null;

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
          m1: toCompact(m1Out),
          m5: toCompact(m5Out),
          m15: toCompact(m15Out),
        },
        engine: gen.read,
        // V4 seviye paneli (spec 3) -- hepsi olculen veriden, uydurma yok
        levels: readLevels({
          sessionM1,
          allM1: bundle.m1,
          date: session.date,
          prevClose,
          nowSec: evalNow,
        }),
        // Faz 1 (tasks/active/013) -- 5m Monte Carlo (erisim + yogunluk
        // olasiliklari ayri ayri, birbirine donusturulemez). Deneysel --
        // Karar Sayfasi sekmesi henuz yok, bu alan sadece dogrulama icin.
        monteCarlo,
        // V4 gun kapanis tahmini (spec 4) -- bant genisligi olculmus
        // kantilden geliyor, guven o bandin tanim geregi isabet orani
        forecast: forecastClose({
          sessionM1,
          date: session.date,
          nowSec: evalNow,
          prevClose,
          regime: regimeSeries.current.regime,
        }),
        // V6.0 rejim bloku: 15m veto + hacim vetosu + 5m Layer1 + kayip
        // sonrasi soguma -- karar mekanizmasinin GERCEK durumu (gen.read
        // icinden). Layer2 (3'te 2 oylama) V6.0'da kaldirildi.
        regime: {
          veto: gen.read.veto,
          volumeVeto: gen.read.volumeVeto,
          layer1: gen.read.layer1,
          current: gen.read.regime,
          cooldownUntil,
          cooldownActive,
        },
        lastClosed: gen.lastClosed,
        positions: activePositions,
        openPosition,
        liveChain,
        events,
        // V4.1 (B.3): bugun ayni kontrata (strike+yon) ikinci kez girmek
        // isteyip reddedilen adaylar -- rejimden bagimsiz, aday cozumleme
        // asamasina ait, o yuzden regime blokunun disinda.
        contractReuseBlocked,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message, serverTime: nowSec }, { status: 500 });
  }
}
