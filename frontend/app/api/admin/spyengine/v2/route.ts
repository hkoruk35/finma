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
import { readOptionDecision } from "@/lib/spyengine/optionDecisionStore";
import { computeExhaustion, computeReversalScore, computeEdgeScore } from "@/lib/spyengine/heuristics";
import { appendDecisionSnapshot } from "@/lib/spyengine/decisionLogStore";
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

/**
 * Karar Sayfası (Faz 4 hazırlığı) anlık görüntüsü, YENİ kapanan bir 5m
 * bardan başka değişmez — ama sayfa saniyede bir yokluyor. Bu bellek-içi
 * koruma olmadan her yoklamada Supabase'e bir okuma+yazma gidip aynı barı
 * tekrar tekrar loglamaya çalışırdı. `decisionLogStore.ts`'in kendi
 * `barTime` eşitlik kontrolü de var (sunucu yeniden başladığında veya
 * birden fazla süreç çalışırken doğru davranış için) — bu sadece HOT
 * PATH'teki gereksiz Supabase trafiğini önlüyor.
 */
let lastLoggedDecisionBarTime: number | null = null;

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
    const [bundle, rvolHistory, optionDecision] = await Promise.all([
      fetchSpyBundle(),
      fetchSpy5mHistory().catch(() => ({ bars: [] as Bar[] })),
      readOptionDecision().catch(() => null),
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

    // Faz 1 ham veri paneli VE Tier 1'in 30dk sütunu AYNI hesabı okumalı --
    // önceden ikisi ayrı tohum/örnek sayısıyla ayrı ayrı simüle ediliyordu,
    // bu da aynı ufuk için iki farklı sayı üretiyordu (bkz. görev listesi
    // #2). Tek bir 30dk Monte Carlo nesnesi kurulup HER İKİSİ de bunu okur.
    const MC_NSIMS = 3000;
    const mc30 = sigmaAdj != null && price != null && lastM5ForSeed
      ? runMonteCarlo({
          spot: price, sigmaPerStep: sigmaAdj, steps: 6, nSims: MC_NSIMS,
          seed: seedFromBar(lastM5ForSeed.time, price),
        })
      : null;

    const monteCarlo = mc30 && sigmaAdj != null && lastM5ForSeed
      ? (() => {
          const center = Math.round(price!);
          const levels = [];
          for (let off = -3; off <= 3; off++) {
            const lvl = center + off;
            levels.push({
              price: lvl,
              touchProbability: r2(mc30.touchProbability(lvl) * 100),
              densityPct: r2(mc30.densityInBand(lvl - 0.5, lvl + 0.5) * 100),
            });
          }
          return {
            sigmaPerBarRaw: sigmaRaw,
            seasonalityMultiplier: r2(seasonality.multiplier),
            seasonalitySampleDays: seasonality.sampleDays,
            sigmaPerBarAdj: sigmaAdj,
            horizonMin: mc30.horizonMin,
            nSims: MC_NSIMS,
            asOfBarTime: lastM5ForSeed.time,
            levels,
          };
        })()
      : null;

    // ── SPY Option Sayfası (Faz 3 + 5, tasks/active/013) ──────────────
    // Tier 1 (fiyat modeli): AYNI sigma/tohumla, TEK bir ufuk yerine
    // birden fazla zaman dilimi (5-30 dk) için ayrı ayrı simülasyon --
    // "fiyatlar VE saat dilimlerinde" tahmin matrisi budur. 30dk sütunu
    // yukarıdaki mc30 nesnesinden okunur (Faz 1 paneliyle birebir aynı
    // kaynak). Tier 2 (piyasa beklentisi): optionDecision'daki GERÇEK
    // delta'lardan, ikinci bir opsiyon isteği YOK. Tier 3 (rejim+skor):
    // Layer 1 + RVOL + BVC tükenme skorundan, VIX/SPX KULLANILMAZ (bkz.
    // heuristics.ts). Tier 4: optionDecision'ın kendisi (tekrar
    // hesaplanmaz). Tier 5: 1-3'ün sürekli birleşimi, hard-gate YOK.
    const decisionPage = sigmaAdj != null && price != null && lastM5ForSeed
      ? (() => {
          const HORIZON_STEPS = [1, 2, 3, 4, 5, 6]; // 5,10,...,30 dk
          const center = Math.round(price);
          const gridOffsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
          const priceGrid = gridOffsets.map((o) => center + o);

          const tier1: Record<string, { price: number; touchProbability: number; densityPct: number }[]> = {};
          for (const steps of HORIZON_STEPS) {
            // 30dk (steps=6) icin mc30'u yeniden kullan -- Faz 1 paneliyle
            // AYNI kaynak, ikinci bir simulasyon calistirilmaz.
            const mc = steps === 6 && mc30
              ? mc30
              : runMonteCarlo({
                  spot: price, sigmaPerStep: sigmaAdj, steps, nSims: MC_NSIMS,
                  seed: seedFromBar(lastM5ForSeed.time, price) + steps, // ufka göre farklı ama deterministik dizi
                });
            tier1[String(steps * 5)] = priceGrid.map((lvl) => ({
              price: lvl,
              touchProbability: r2(mc.touchProbability(lvl) * 100),
              densityPct: r2(mc.densityInBand(lvl - 0.5, lvl + 0.5) * 100),
            }));
          }

          // Tier 2 -- optionDecision'daki gercek delta'lardan piyasa-ortuk olasilik
          const tier2 = (optionDecision?.contracts ?? []).map((c) => ({
            strike: c.strike,
            callImpliedProb: c.call.greeks.delta || null,
            putImpliedProb: c.put.greeks.delta ? Math.abs(c.put.greeks.delta) : null,
          }));
          const impliedProbAt = (level: number): number | null => {
            if (!tier2.length) return null;
            const nearest = tier2.reduce((a, b) => (Math.abs(b.strike - level) < Math.abs(a.strike - level) ? b : a));
            return level >= price ? nearest.callImpliedProb : nearest.putImpliedProb;
          };

          // Tier 3 -- Layer1 + RVOL + BVC tukenme skoru, her iki yon icin ayri ayri
          const exhaustionLong = computeExhaustion(m5ClosedForVol, sigmaRaw, "LONG");
          const exhaustionShort = computeExhaustion(m5ClosedForVol, sigmaRaw, "SHORT");
          const rvolForReversal = gen.read.volumeVeto.rvol;
          const reversalLong = computeReversalScore(gen.read.layer1, rvolForReversal, exhaustionLong, "LONG");
          const reversalShort = computeReversalScore(gen.read.layer1, rvolForReversal, exhaustionShort, "SHORT");

          // Tier 5 -- Tier1(30dk ufku) + Tier2 + Tier3'un surekli birlesimi.
          // LONG ve SHORT ARTIK BAGIMSIZ: her ikisi de ayni seviyeyi degil,
          // spot'tan AYNI MESAFEDEKI KARSIT YONDEKI seviyeyi okur (yukari
          // hareket vs asagi hareket) -- lognormal dagilim simetrik
          // olmadigindan bu ikisi ayni sayiyi vermez (bkz. gorev listesi #1).
          const tier1_30 = tier1["30"] ?? [];
          const touchAt = (lvl: number) => (tier1_30.find((x) => x.price === lvl)?.touchProbability ?? 0) / 100;
          const tier5 = priceGrid.map((lvl) => {
            const absOffset = Math.abs(lvl - center);
            const upLvl = center + absOffset;
            const downLvl = center - absOffset;
            const touchUp = touchAt(upLvl);
            const touchDown = touchAt(downLvl);
            const impliedUp = impliedProbAt(upLvl); // call delta -- yukari hareket
            const impliedDown = impliedProbAt(downLvl); // put delta -- asagi hareket
            const edgeLong = computeEdgeScore({ touchProbability: touchUp, marketImpliedProbability: impliedUp, reversalScore: reversalLong.score });
            const edgeShort = computeEdgeScore({ touchProbability: touchDown, marketImpliedProbability: impliedDown, reversalScore: reversalShort.score });
            return { price: lvl, edgeLong, edgeShort };
          });

          // ── ±2-3 strike hedef bandı (görev listesi #4 + #5) ──────────
          // Asil hedef genis izgara degil, spot'a en yakin +2/+3 ve -2/-3
          // strike'lik bant. "Hedefe ulasma olasiligi" = offset 2'ye
          // erismek (offset 3'e erismek icin path'in zaten 2'den gecmesi
          // gerekir, yani touchProbability(offset 2) bandin tamamini kapsar).
          // "Beklenen getiri" ATM kontratin GERCEK prim egrisinden (Tier 4,
          // optionDecision.premiumCurve) okunur; opsiyon verisi bayatsa/yoksa
          // uydurma sayi uretilmez, sadece ham fiyat hareketi yuzdesi (%) ile
          // yer degistirir ve bu acikca etiketlenir.
          const atmContract = optionDecision?.contracts.length
            ? optionDecision.contracts.reduce((a, b) => (Math.abs(b.strike - price) < Math.abs(a.strike - price) ? b : a))
            : null;
          const premiumAt = (leg: "call" | "put", targetPrice: number): number | null => {
            const point = atmContract?.premiumCurve.find((p) => p.targetPrice === targetPrice);
            if (!point) return null;
            const v = leg === "call" ? point.callPremium : point.putPremium;
            return v > 0 ? v : null;
          };
          const bandOffset = 2;
          const upBandLvl = center + bandOffset;
          const downBandLvl = center - bandOffset;
          const touchUpBand = touchAt(upBandLvl);
          const touchDownBand = touchAt(downBandLvl);

          const buildTargetSide = (level: number, touchProbability: number, leg: "call" | "put") => {
            const atmPremium = atmContract ? premiumAt(leg, center) : null;
            const targetPremium = atmContract ? premiumAt(leg, level) : null;
            const returnFromPremium = atmPremium != null && targetPremium != null
              ? (targetPremium - atmPremium) / atmPremium
              : null;
            const expectedReturnPct = returnFromPremium ?? Math.abs(level - center) / price!; // uydurma degil: gercek prim yoksa ham fiyat hareketi % ile ikame edilir, kaynagi etiketlenir
            return {
              level,
              touchProbability: r2(touchProbability * 100),
              expectedReturnPct: r2(expectedReturnPct * 100),
              expectedReturnSource: returnFromPremium != null ? ("premium" as const) : ("priceMove" as const),
              expectedValuePct: r2(touchProbability * expectedReturnPct * 100),
            };
          };
          const targetBand = {
            horizonMin: 30,
            offsetRange: [2, 3] as [number, number],
            up: buildTargetSide(upBandLvl, touchUpBand, "call"),
            down: buildTargetSide(downBandLvl, touchDownBand, "put"),
            combinedProbability: r2((1 - (1 - touchUpBand) * (1 - touchDownBand)) * 100),
          };

          return {
            generatedAt: nowSec,
            spot: price,
            asOfBarTime: lastM5ForSeed.time,
            horizonsMin: HORIZON_STEPS.map((s) => s * 5),
            priceGrid,
            tier1,
            tier2,
            tier3: {
              long: { reversal: reversalLong, exhaustion: exhaustionLong },
              short: { reversal: reversalShort, exhaustion: exhaustionShort },
            },
            tier5,
            targetBand,
          };
        })()
      : null;

    // ── Faz 4 hazırlığı: yeni kapanan HER 5m barda bir kez, karar sayfası
    // anlık görüntüsünü logla (bkz. decisionLogStore.ts başlığı). Fire-and
    // -forget: yanıtı ASLA bloklamaz/etkilemez, hata olursa sessizce yutulur.
    if (decisionPage && decisionPage.asOfBarTime !== lastLoggedDecisionBarTime) {
      lastLoggedDecisionBarTime = decisionPage.asOfBarTime;
      const nearest2 = decisionPage.tier2.length
        ? decisionPage.tier2.reduce((a, b) => (Math.abs(b.strike - decisionPage.spot) < Math.abs(a.strike - decisionPage.spot) ? b : a))
        : null;
      const atm5 = decisionPage.tier5.find((t) => t.price === Math.round(decisionPage.spot)) ?? null;
      appendDecisionSnapshot(session.date, {
        barTime: decisionPage.asOfBarTime,
        loggedAt: new Date().toISOString(),
        spot: decisionPage.spot,
        tier1_30: (decisionPage.tier1["30"] ?? []).map((l) => ({ price: l.price, touchProbability: l.touchProbability })),
        tier2Nearest: nearest2 ? { strike: nearest2.strike, callImpliedProb: nearest2.callImpliedProb, putImpliedProb: nearest2.putImpliedProb } : null,
        tier3: {
          reversalLong: decisionPage.tier3.long.reversal.score,
          reversalShort: decisionPage.tier3.short.reversal.score,
          exhaustionLong: decisionPage.tier3.long.exhaustion.score,
          exhaustionShort: decisionPage.tier3.short.exhaustion.score,
        },
        tier5Atm: atm5 ? { edgeLong: atm5.edgeLong, edgeShort: atm5.edgeShort } : null,
      }).catch(() => {});
    }

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
        // Faz 2 (tasks/active/013) -- SPY 0DTE Black-Scholes Greeks + prim
        // egrisi (spy_0dte_options_sync.py -> Supabase). opsiyon242.py'den
        // BAGIMSIZ. Script hic calismadiysa/veri bayatsa null.
        optionDecision,
        // Faz 3+5 (tasks/active/013) -- "SPY Option Sayfasi" icin birlesik
        // Tier 1-5 veri seti (bkz. yukaridaki yorum). Chart Faz 1/2'deki
        // ham monteCarlo/optionDecision alanlarini AYRICA kullanmaya devam
        // ediyor -- bu alan onlari GENISLETIR, YERINE GECMEZ.
        decisionPage,
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
