"use client";

/**
 * SPY Engine V9.0 — Tek sayfa, sonuç odaklı (/admin/spyengine/v1)
 *
 * V8.0'ın 7 sekmesi kaldırıldı; tek ekranda şunlar var:
 *   1. Açılış rejimi — 09:30 5m/15m kapanışları VWAP'a göre izlenir,
 *      09:45–10:00 arası YÜKSELİŞ / DÜŞÜŞ / BELİRSİZ kararı verilir.
 *   2. Canlı yön — her kapanan 5m ve 15m mumun VWAP konumundan güncellenir.
 *   3. Motor sinyali (ön uyarı + giriş) — motor kuralları DEĞİŞMEDİ.
 *   4. Tahmin haritası — destek/direnç, yolculuk, kapanış beklentisi.
 *   5. 15m + 5m grafik (ana sayfadaki iki grafik).
 *   6. Kapanan her 5m/15m mumun anında yorumu (VWAP konumu öncelikli).
 * Fiyat şeridi (tickerlar) varsayılan GİZLİ.
 *
 * Kaldırılanlar: sekmeler, Motor Durumu, Pozisyon & Günlük Limit kartı,
 * "5m EMA21 Trend Bilgisi" satırı. Eski sayfa: archive/spyengine_v8/page.v8.tsx.
 *
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur;
 * API uçları da ayrıca satır içi kontrol yapar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SpyChart, { type ChartToggles } from "@/components/admin/spyengine/SpyChart";
import ForecastMap from "@/components/admin/spyengine/ForecastMap";
import {
  TickerStrip, InfoCards, GatePanel, PositionPanel, ExitGatePanel,
  AlertBanner, computeEntryAlert, Disclosure, PhaseBadge, SURFACE, num, signed, tone,
  type StripQuote, type SpotStats,
} from "@/components/admin/spyengine/panels";
import {
  fromCompact, nyClock, nyParts, isRthBar, bucketAggregate,
  type Bar, type SessionInfo, type CompactBar,
} from "@/lib/spyengine/core";
import {
  daySeries, liveVwap, commentAll, commentForming, fmtVol, openingRegime, liveDirection, buildForecastMap,
  type CandleComment, type Tone,
} from "@/lib/spyengine/openingMap";
import type {
  EngineEvent, PositionState, ContractType, EngineState, GateStatus, RegimeState,
} from "@/lib/spyengine/strategy";
import type { LevelRead, CloseForecast } from "@/lib/spyengine/levels";
import type { ReversalState } from "@/lib/spyengine/reversal";

// ── Yanıt tipi (API değişmedi; kullanılan alanlar) ────────────────

interface EngineRead {
  regime: RegimeState;
  action: "LONG" | "SHORT" | "BEKLE";
  contractType: ContractType | null;
  state: EngineState;
  stateLabel: string;
  nextStep: string;
  gateStatus: GateStatus;
}

interface StreamResponse {
  ok: boolean;
  error?: string;
  serverTime: number;
  full: boolean;
  session: SessionInfo;
  dataSource: { primary: string; overnight: string | null; sanitized: number; errors: string[] };
  spot: SpotStats;
  bars: { m1: CompactBar[]; m5: CompactBar[]; m15: CompactBar[] };
  engine: EngineRead;
  lastClosed: { m1: number | null; m5: number | null; m15: number | null };
  openPosition: PositionState | null;
  events: EngineEvent[];
  levels?: LevelRead;
  forecast?: CloseForecast | null;
  reversalCatch?: ReversalState;
}

const POLL_OPTIONS = [1000, 2000, 5000, 15000];

const DEFAULT_TOGGLES: ChartToggles = {
  candleType: "NORMAL",
  bb: false, ema21: false, vwap: true, volume: true,
  rsi: false, macd: false, markers: true, levels: true,
};

function mergeBars(prev: Bar[], incoming: Bar[], full: boolean): Bar[] {
  if (full) return incoming;
  if (!incoming.length) return prev;
  const map = new Map<number, Bar>();
  for (const b of prev) map.set(b.time, b);
  for (const b of incoming) map.set(b.time, b);
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

const TONE_STYLE: Record<Tone, { ring: string; text: string; dot: string }> = {
  bull: { ring: "border-[#22c55e]/35 bg-[#22c55e]/[0.07]", text: "text-[#4ade80]", dot: "bg-[#22c55e]" },
  bear: { ring: "border-[#ef4444]/35 bg-[#ef4444]/[0.07]", text: "text-[#f87171]", dot: "bg-[#ef4444]" },
  neutral: { ring: "border-[#1c2635] bg-[#0f141d]", text: "text-slate-300", dot: "bg-slate-500" },
};

const SIDE_CHIP: Record<string, string> = {
  ABOVE: "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]",
  BELOW: "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#f87171]",
  AT: "border-slate-600 bg-slate-700/20 text-slate-300",
};

function CommentCard({ c, latest }: { c: CandleComment; latest: boolean }) {
  const st = TONE_STYLE[c.tone];
  return (
    <div className={`rounded border px-2 py-1.5 ${st.ring} ${c.forming ? "border-dashed" : ""} ${latest ? "ring-1 ring-[#eab308]/40" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${c.forming ? "animate-pulse" : ""}`} />
          <span className="font-mono text-[11px] font-bold text-slate-200">{c.clock}</span>
          <span className="text-[9px] text-slate-500">{c.tf} {c.forming ? "oluşuyor" : "kapanış"} {num(c.close)}</span>
          {c.forming && <span className="rounded bg-sky-500/15 px-1 text-[8px] font-semibold text-sky-300">CANLI</span>}
          {latest && !c.forming && <span className="rounded bg-[#eab308]/15 px-1 text-[8px] font-semibold text-[#eab308]">SON</span>}
        </span>
        {c.vwapSide && (
          <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold ${SIDE_CHIP[c.vwapSide]}`}>
            {c.vwapSide === "ABOVE" ? "VWAP ÜSTÜ" : c.vwapSide === "BELOW" ? "VWAP ALTI" : "VWAP'TA"} {c.vwap != null && num(c.vwap)}
          </span>
        )}
      </div>
      <div className={`mt-0.5 text-[11px] font-semibold ${st.text}`}>{c.headline}</div>
      <div className="mt-0.5 flex flex-wrap gap-1 font-mono text-[9px] text-slate-400">
        <span className="rounded bg-[#0a0e17] px-1 py-0.5">üst fitil {num(c.upperWick)}</span>
        <span className="rounded bg-[#0a0e17] px-1 py-0.5">alt fitil {num(c.lowerWick)}</span>
        <span className="rounded bg-[#0a0e17] px-1 py-0.5">kapanış konumu %{Math.round(c.closePos * 100)}</span>
        <span className={`rounded bg-[#0a0e17] px-1 py-0.5 ${c.volRatio != null && c.volRatio >= 1.5 ? "text-sky-300" : c.volRatio != null && c.volRatio <= 0.6 ? "text-amber-300" : ""}`}>
          hacim {fmtVol(c.volume)}{c.volRatio != null ? ` · ${c.volRatio.toFixed(1)}×` : ""}
        </span>
      </div>
      <ul className="mt-0.5 flex flex-col gap-0.5 text-[10px] leading-snug text-slate-400">
        {c.lines.map((l, i) => <li key={i}>• {l}</li>)}
      </ul>
    </div>
  );
}

function CommentFeed({ title, items, forming }: { title: string; items: CandleComment[]; forming: CandleComment | null }) {
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">{title}</span>
        <span className="font-mono text-[9px] text-slate-600">{items.length} kapanmış mum · en yeni üstte</span>
      </div>
      <div className="flex max-h-[520px] flex-col gap-1 overflow-y-auto p-1.5">
        {forming && <CommentCard c={forming} latest={false} />}
        {items.length === 0 && !forming && (
          <div className="px-2 py-4 text-center text-[11px] text-slate-600">
            Henüz kapanmış seans mumu yok — 09:30 ET&apos;den sonra ilk kapanışla yorumlar gelir.
          </div>
        )}
        {items.map((c, idx) => <CommentCard key={`${c.tf}-${c.time}`} c={c} latest={idx === 0} />)}
      </div>
    </div>
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────

export default function SpyEngineV9() {
  const [toggles, setToggles] = useState<ChartToggles>(DEFAULT_TOGGLES);
  const [pollMs, setPollMs] = useState(1000);
  const [autoScroll, setAutoScroll] = useState(true);
  /** Tickerlar varsayılan GİZLİ — "göster" deyince görünür */
  const [showTickers, setShowTickers] = useState(false);
  const [alertSound, setAlertSound] = useState(true);
  const [replayDate, setReplayDate] = useState("");

  const [data, setData] = useState<StreamResponse | null>(null);
  const [m1, setM1] = useState<Bar[]>([]);
  const [m5, setM5] = useState<Bar[]>([]);
  const [m15, setM15] = useState<Bar[]>([]);

  const [quotes, setQuotes] = useState<StripQuote[]>([]);
  const [quotesAt, setQuotesAt] = useState<number | null>(null);
  const [forecastAccuracy, setForecastAccuracy] = useState<{ checked: number; hit: number } | null>(null);

  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** 0'dan başlar (hydration uyumu); ilk gerçek değer ilk kalp atışında gelir */
  const [nowSec, setNowSec] = useState(0);

  const sinceRef = useRef<number | null>(null);
  const replayRef = useRef("");
  const inflightRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastAlertKeyRef = useRef<string | null>(null);

  // ── Ana akış ────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const q = new URLSearchParams();
      if (sinceRef.current) q.set("since", String(sinceRef.current));
      if (replayRef.current) q.set("date", replayRef.current);
      const res = await fetch(`/api/admin/spyengine/v2${q.size ? `?${q}` : ""}`, { credentials: "include", cache: "no-store" });
      const json: StreamResponse = await res.json();
      if (!json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        setFailures((f) => f + 1);
        return;
      }
      setData(json);
      setM1((p) => mergeBars(p, fromCompact(json.bars.m1), json.full));
      setM5((p) => mergeBars(p, fromCompact(json.bars.m5), json.full));
      setM15((p) => mergeBars(p, fromCompact(json.bars.m15), json.full));

      const lasts = [json.bars.m1, json.bars.m5, json.bars.m15]
        .map((a) => (a.length ? a[a.length - 1][0] : null))
        .filter((v): v is number => v != null);
      if (lasts.length) sinceRef.current = Math.min(...lasts);

      setLastFetch(json.serverTime);
      setFailures(0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFailures((f) => f + 1);
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    replayRef.current = replayDate;
    sinceRef.current = null;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await poll();
    })();
    const id = setInterval(() => { void poll(); }, pollMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [poll, pollMs, replayDate]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [poll]);

  // Ticker şeridi yalnızca GÖSTERİLİRKEN yüklenir (gizliyken istek atılmaz)
  useEffect(() => {
    if (!showTickers) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/quotes", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (cancelled || !json.ok) return;
        setQuotes(json.quotes || []);
        setQuotesAt(json.serverTime);
      } catch {
        // şerit hatası ana akışı etkilemesin
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [showTickers]);

  // Kapanış tahmini kaydı + isabet oranı (V4 — sunucu 5 dk kovalara yuvarlıyor)
  const forecastKeyRef = useRef<string>("");
  useEffect(() => {
    const f = data?.forecast;
    const date = data?.session.date;
    if (!f || !date || replayDate) return;
    const bucket = Math.floor((lastFetch ?? 0) / 300) * 300;
    const sessionOver = data ? !data.session.isLive || data.session.phase === "POST" || data.session.phase === "CLOSED" : false;
    const actualClose = sessionOver ? data?.spot.price ?? null : null;
    const key = `${date}:${bucket}:${actualClose ?? ""}`;
    if (!bucket || key === forecastKeyRef.current) return;
    forecastKeyRef.current = key;
    void (async () => {
      try {
        await fetch("/api/admin/spyengine/v2/forecast", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            snapshot: f.remainingMin > 0 ? { at: bucket, remainingMin: f.remainingMin, low: f.low, high: f.high, mid: f.mid } : undefined,
            actualClose: actualClose ?? undefined,
          }),
        });
        const res = await fetch("/api/admin/spyengine/v2/forecast", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (json.ok) setForecastAccuracy({ checked: json.checked, hit: json.hit });
      } catch {
        // tahmin kaydı ana akışı etkilemesin
      }
    })();
  }, [data, lastFetch, replayDate]);

  // 1 sn kalp atışı
  useEffect(() => {
    const first = setTimeout(() => setNowSec(Math.floor(Date.now() / 1000)), 0);
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);

  // ── Türetilmiş ──────────────────────────────────────────────────
  const secondsSince = lastFetch && nowSec ? Math.max(0, nowSec - lastFetch) : null;
  const connection: "live" | "lagging" | "down" =
    failures >= 3 ? "down" : secondsSince != null && secondsSince > Math.max(12, (pollMs / 1000) * 4) ? "lagging" : "live";

  const openPosition = data?.openPosition ?? null;
  const events = data?.events ?? [];
  const date = data?.session.date ?? "";
  const m5Bars = useMemo(() => (m5.length ? m5 : bucketAggregate(m1, 5)), [m5, m1]);
  const m15Bars = useMemo(() => (m15.length ? m15 : bucketAggregate(m1, 15)), [m15, m1]);

  /** Değerlendirme "anı": replay'de sunucunun zamanı, canlıda saat */
  const evalNow = replayDate ? (data?.serverTime ?? 0) : (nowSec || data?.serverTime || 0);

  /** Haritanın "şimdi" çizgisi için dakikalık dilim */
  const minuteSlot = evalNow ? Math.floor(evalNow / 60) : 0;

  const lc = data?.lastClosed;
  const analysis = useMemo(() => {
    if (!date || !evalNow) return null;
    const s5 = daySeries(m5Bars, "5m", date, lc?.m5 ?? null, evalNow);
    const s15 = daySeries(m15Bars, "15m", date, lc?.m15 ?? null, evalNow);
    const opening = openingRegime(s5, s15);
    // Açılışta (09:45'ten önce) karar verilmez; sonrası her kapanan 5m/15m mumla güncellenir
    const live = opening.status === "WAITING" ? null : liveDirection(s5, s15);
    return { s5, s15, opening, live, c5: commentAll(s5, "5m"), c15: commentAll(s15, "15m") };
    // her yeni kapanışta (lastClosed) yeniden hesaplanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m5Bars, m15Bars, date, lc?.m5, lc?.m15]);

  /** Oluşmakta olan mumların canlı yorumu (yalnızca canlı modda; karar mumu değil) */
  const forming5 = useMemo(
    () => (analysis && date && !replayDate && nowSec ? commentForming(m5Bars, analysis.s5, "5m", date, nowSec) : null),
    [analysis, m5Bars, date, replayDate, nowSec],
  );
  const forming15 = useMemo(
    () => (analysis && date && !replayDate && nowSec ? commentForming(m15Bars, analysis.s15, "15m", date, nowSec) : null),
    [analysis, m15Bars, date, replayDate, nowSec],
  );

  const price = data?.spot.price ?? null;
  const vwapNow = useMemo(() => (date ? liveVwap(m5Bars, date) : null), [m5Bars, date]);

  const map = useMemo(() => {
    if (!analysis || price == null || !date) return null;
    return buildForecastMap({
      price, vwap: vwapNow, date, nowSec: evalNow,
      opening: analysis.opening, live: analysis.live,
      levels: data?.levels ?? null, forecast: data?.forecast ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, price, vwapNow, date, data?.levels, data?.forecast, minuteSlot]);

  /** Grafik/harita için bugünün RTH 5m mumları (oluşan dahil) + VWAP */
  const todayRth5 = useMemo(() => {
    if (!date) return { bars: [] as Bar[], vwap: [] as (number | null)[] };
    const bars = m5Bars.filter((b) => isRthBar(b) && nyParts(b.time).ymd === date);
    let pv = 0, vol = 0;
    const vwap = bars.map((b) => {
      const v = b.volume || 0;
      pv += ((b.high + b.low + b.close) / 3) * v;
      vol += v;
      return vol > 0 ? pv / vol : null;
    });
    return { bars, vwap };
  }, [m5Bars, date]);

  const m5Trend = useMemo<"UP" | "DOWN" | null>(() => {
    if (m5Bars.length < 6) return null;
    const last = m5Bars[m5Bars.length - 1].close, prev = m5Bars[m5Bars.length - 6].close;
    return last > prev ? "UP" : last < prev ? "DOWN" : null;
  }, [m5Bars]);
  const m15Trend = useMemo<"UP" | "DOWN" | null>(() => {
    if (m15Bars.length < 6) return null;
    const last = m15Bars[m15Bars.length - 1].close, prev = m15Bars[m15Bars.length - 6].close;
    return last > prev ? "UP" : last < prev ? "DOWN" : null;
  }, [m15Bars]);

  const entryAlert = useMemo(
    () => computeEntryAlert(
      data?.engine.gateStatus ?? null,
      data?.engine.regime.side ?? "NONE",
      data?.engine.state ?? "WATCHING",
      data?.engine.action ?? "BEKLE",
    ),
    [data],
  );
  const secondsToClose = nowSec ? 60 - (nowSec % 60) : null;

  // ── Sesli + titreşimli ön uyarı ─────────────────────────────────
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      }
      audioRef.current?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const chime = useCallback((kind: "fired" | "imminent") => {
    const ctx = audioRef.current;
    if (ctx) {
      const t0 = ctx.currentTime;
      const tones = kind === "fired" ? [1318.5, 1975.5] : [660, 880];
      tones.forEach((f, i) => {
        const at = t0 + (kind === "fired" ? 0 : i * 0.16);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === "fired" ? "triangle" : "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(kind === "fired" ? 0.22 : 0.16, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + (kind === "fired" ? 0.55 : 0.15));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.6);
      });
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "fired" ? [90, 60, 90, 60, 90] : [70, 50, 70]);
    }
  }, []);

  useEffect(() => {
    const key = `${entryAlert.level}:${entryAlert.side ?? ""}`;
    const prev = lastAlertKeyRef.current;
    lastAlertKeyRef.current = key;
    if (prev == null || prev === key || !alertSound || openPosition) return;
    if (entryAlert.level === "FIRED") chime("fired");
    else if (entryAlert.level === "IMMINENT") chime("imminent");
  }, [entryAlert.level, entryAlert.side, alertSound, openPosition, chime]);

  // ── Render ──────────────────────────────────────────────────────
  const op = analysis?.opening ?? null;
  const live = analysis?.live ?? null;
  const opColor = op?.side === "UP" ? "#22c55e" : op?.side === "DOWN" ? "#ef4444" : op?.side === "UNCERTAIN" ? "#eab308" : "#64748b";
  const opArrow = op?.side === "UP" ? "▲" : op?.side === "DOWN" ? "▼" : op?.side === "UNCERTAIN" ? "◆" : "…";
  const liveColor = live?.dir === "UP" ? "#22c55e" : live?.dir === "DOWN" ? "#ef4444" : "#eab308";

  return (
    <div className="min-h-screen bg-[#0a0e17] p-2 text-slate-300">
      {/* ── Başlık ── */}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-[#eab308]">SPY Engine V9.0</h1>
            <p className="text-[9px] text-slate-500">
              her kapanan 5m + 15m mum analizi · VWAP odaklı · açılışta 3×5m + 15m sonrası 09:45–10:00 rejim kararı · tahmin haritası
            </p>
          </div>
          {data && (
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[22px] font-bold text-slate-100">
                {data.spot.price == null ? "—" : `$${num(data.spot.price)}`}
              </span>
              <span className={`font-mono text-[12px] font-semibold ${tone(data.spot.changePct)}`}>
                {data.spot.changePct == null ? "" : `${signed(data.spot.change)} (${signed(data.spot.changePct)}%)`}
              </span>
            </div>
          )}
          {data && <PhaseBadge phase={data.session.phase} />}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] ${
              connection === "live" ? "border-green-500/25 bg-green-500/10 text-green-300"
              : connection === "lagging" ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
              : "border-red-500/25 bg-red-500/10 text-red-300"
            }`}
            title={error ?? "Akış sağlıklı"}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connection === "live" ? "animate-pulse bg-green-400" : connection === "lagging" ? "bg-amber-400" : "bg-red-400"}`} />
            {connection === "down" ? `BAĞLANTI YOK (${failures})` : connection === "lagging" ? "GECİKME" : "CANLI"}
            {secondsSince != null && ` · ${secondsSince}sn`}
          </span>
          <span className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 font-mono text-[10px] text-slate-400">
            {nowSec ? `${nyClock(nowSec, true)} ET` : "—"}
          </span>
          <select
            value={pollMs}
            onChange={(e) => setPollMs(Number(e.target.value))}
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 font-mono text-[10px] text-slate-400"
            title="Yoklama aralığı"
          >
            {POLL_OPTIONS.map((ms) => <option key={ms} value={ms}>{ms / 1000} sn</option>)}
          </select>
          <input
            type="date"
            value={replayDate}
            onChange={(e) => setReplayDate(e.target.value)}
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 font-mono text-[10px] text-slate-400"
            title="Geriye dönük seans oynatma (boş = canlı)"
          />
          {replayDate && (
            <button type="button" onClick={() => setReplayDate("")} className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
              canlıya dön
            </button>
          )}
          <button
            type="button"
            onClick={() => setAlertSound((v) => !v)}
            className={`rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${
              alertSound ? "border-orange-500/40 bg-orange-500/15 text-orange-300" : "border-[#1c2635] bg-[#111827] text-slate-500 hover:bg-[#1c2635]"
            }`}
            title="Kurulum yaklaştığında sesli + titreşimli uyarı"
          >
            {alertSound ? "🔔 UYARI AÇIK" : "🔕 UYARI KAPALI"}
          </button>
          <button
            type="button"
            onClick={() => setShowTickers((v) => !v)}
            className={`rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${
              showTickers ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-[#1c2635] bg-[#111827] text-slate-400 hover:bg-[#1c2635]"
            }`}
          >
            Tickerlar: {showTickers ? "gizle" : "göster"}
          </button>
        </div>
      </header>

      {/* Uyarılar */}
      {data && !data.session.isLive && data.session.note && (
        <div className="mb-2 flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300/90">
          <span>🕒</span><span>{data.session.note}</span>
        </div>
      )}
      {error && (
        <div className="mb-2 rounded border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
          Akış hatası: {error}{failures > 1 && ` · ardışık ${failures} deneme başarısız`}
        </div>
      )}
      {data && data.dataSource.errors.length > 0 && (
        <div className="mb-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[9px] text-amber-300/80">
          Veri kaynağı uyarısı: {data.dataSource.errors.join(" · ")} — eksik zaman dilimi için mum çizilmiyor.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {/* Tickerlar — varsayılan gizli */}
        {showTickers && (
          <div className="flex flex-col gap-1 rounded border border-[#1c2635] p-1">
            <TickerStrip quotes={quotes} updatedAt={quotesAt} />
            <InfoCards spot={data?.spot ?? null} lastFetch={lastFetch} phase={data?.session.phase ?? "CLOSED"} />
          </div>
        )}

        {/* ── 1) Açılış rejimi + 3 mum yönü ── */}
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${opColor}55` }}>
            <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
              <span className="text-[11px] font-semibold tracking-wide text-slate-300">
                Açılış Rejimi <span className="text-[9px] font-normal text-slate-600">· 09:30 kapanışları → 09:45–10:00 kararı</span>
              </span>
              {op && (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: opColor, backgroundColor: `${opColor}1f` }}>
                  {op.status === "LOCKED" ? "KİLİTLİ 10:00" : op.status === "FORMING" ? "OLUŞUYOR" : "BEKLİYOR"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="text-center">
                <div className="text-[34px] font-black leading-none" style={{ color: opColor }}>{opArrow}</div>
                <div className="mt-1 text-[18px] font-extrabold tracking-wide" style={{ color: opColor }}>{op?.label ?? "VERİ BEKLENİYOR"}</div>
              </div>
              <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-400">{op?.summary ?? "Mum verisi bekleniyor."}</div>
            </div>
            {op && (op.closes5.length > 0 || op.closes15.length > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#1c2635] px-3 py-1.5 font-mono text-[9px]">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-slate-600">5m</span>
                  {op.closes5.map((c) => (
                    <span key={c.clock} className={`rounded border px-1 py-0.5 ${c.side ? SIDE_CHIP[c.side] : "border-slate-700 text-slate-500"}`}>
                      {c.clock} {c.side === "ABOVE" ? "▲" : c.side === "BELOW" ? "▼" : "•"}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-slate-600">15m</span>
                  {op.closes15.map((c) => (
                    <span key={c.clock} className={`rounded border px-1 py-0.5 ${c.side ? SIDE_CHIP[c.side] : "border-slate-700 text-slate-500"}`}>
                      {c.clock} {c.side === "ABOVE" ? "▲" : c.side === "BELOW" ? "▼" : "•"}
                    </span>
                  ))}
                </div>
                <span className="text-slate-600">▲ VWAP üstü kapanış · ▼ VWAP altı kapanış</span>
              </div>
            )}
          </div>

          <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${live ? liveColor : "#64748b"}55` }}>
            <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
              <span className="text-[11px] font-semibold tracking-wide text-slate-300">
                Canlı Yön <span className="text-[9px] font-normal text-slate-600">· her kapanan 5m ve 15m mumla güncellenir</span>
              </span>
              {live && (
                <span className="font-mono text-[9px] text-slate-500">
                  5m {live.asOf5} · 15m {live.asOf15 ?? "—"} kapanışı
                </span>
              )}
            </div>
            {!live ? (
              <div className="px-4 py-6 text-[11px] text-slate-500">
                Açılış rejimi oluşana kadar (ilk 3×5m + 15m kapanış, 09:45 ET) yön kararı verilmez. Kapanan mumların yorumu aşağıda akıyor.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="text-center">
                    <div className="text-[34px] font-black leading-none" style={{ color: liveColor }}>
                      {live.dir === "UP" ? "▲" : live.dir === "DOWN" ? "▼" : "◆"}
                    </div>
                    <div className="mt-1 text-[18px] font-extrabold tracking-wide" style={{ color: liveColor }}>
                      {live.dir === "UP" ? "YUKARI" : live.dir === "DOWN" ? "AŞAĞI" : "BEKLE"}
                    </div>
                    <div className="text-[9px] text-slate-500">{live.strength}</div>
                  </div>
                  <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-400">{live.text}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t border-[#1c2635] px-3 py-1.5 font-mono text-[9px]">
                  {([["5m", live.side5, live.streak5], ["15m", live.side15, live.streak15]] as const).map(([tf, side, n]) => (
                    <span key={tf} className={`rounded border px-1.5 py-0.5 ${side ? SIDE_CHIP[side] : "border-slate-700 text-slate-500"}`}>
                      {tf} {side === "ABOVE" ? "VWAP ÜSTÜ" : side === "BELOW" ? "VWAP ALTI" : side === "AT" ? "VWAP'TA" : "—"} · {n} mum
                    </span>
                  ))}
                  <span className={`ml-auto rounded border px-1.5 py-0.5 font-semibold ${live.aligned ? SIDE_CHIP.ABOVE : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                    {live.aligned ? "5m + 15m TEYİTLİ" : "teyit yok"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── 2) Motor sinyali (ön uyarı / giriş) ── */}
        <AlertBanner
          alert={entryAlert}
          secondsToClose={secondsToClose}
          stateLabel={data?.engine.stateLabel ?? "VERİ BEKLENİYOR"}
          nextStep={data?.engine.nextStep ?? "Motor verisi bekleniyor."}
          inPosition={!!openPosition}
        />
        {openPosition && (
          <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            <PositionPanel position={openPosition} livePremium={openPosition.lastPremium ?? null} />
            <ExitGatePanel reversal={data?.reversalCatch ?? null} />
          </div>
        )}

        {/* ── 3) Tahmin haritası ── */}
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-slate-300">
              Tahmin Haritası <span className="text-[9px] font-normal text-slate-600">· destek / direnç · yolculuk · kapanış beklentisi</span>
            </span>
            {map && (
              <span className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-slate-500">gün sonu kapanış ≈</span>
                <b className="text-[14px] text-slate-100">${num(map.closeExpect)}</b>
                <span className="text-slate-600">({num(map.closeLow)} – {num(map.closeHigh)})</span>
              </span>
            )}
          </div>
          {!map || !date ? (
            <div className="px-3 py-8 text-center text-[11px] text-slate-500">Harita için fiyat ve seviye verisi bekleniyor.</div>
          ) : (
            <>
              <ForecastMap bars={todayRth5.bars} vwapSeries={todayRth5.vwap} map={map} date={date} nowSec={evalNow} />
              <div className="grid grid-cols-1 gap-2 border-t border-[#1c2635] px-3 py-2 lg:grid-cols-2">
                <div>
                  <div className="mb-0.5 text-[10px] font-semibold" style={{ color: map.bias === "UP" ? "#4ade80" : map.bias === "DOWN" ? "#f87171" : "#facc15" }}>
                    {map.biasText}
                  </div>
                  <ol className="flex list-decimal flex-col gap-0.5 pl-4 text-[10.5px] leading-snug text-slate-300 marker:text-slate-600">
                    {map.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
                <ul className="flex flex-col gap-0.5 text-[10px] leading-snug text-slate-500">
                  {map.alt.map((a, i) => <li key={i}>⚠ {a}</li>)}
                  <li className="mt-0.5 text-slate-600">
                    Bu bir TAHMİNDİR. Seviyeler ölçülmüş veriden, yolculuk süresi ortalama saatlik hareketten, kapanış bandı 20 seanslık
                    dağılımdan gelir{forecastAccuracy && forecastAccuracy.checked > 0 ? ` (gerçekleşen isabet %${Math.round((forecastAccuracy.hit / forecastAccuracy.checked) * 100)}, ${forecastAccuracy.checked} seans)` : ""}.
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* ── 4) 15m + 5m grafik ── */}
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#1c2635] px-2 py-1">
            <span className="text-[10px] font-semibold tracking-wide text-slate-300">15m / 5m Grafikleri</span>
            <div className="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                onClick={() => setToggles((t) => ({ ...t, candleType: t.candleType === "HA" ? "NORMAL" : "HA" }))}
                className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${toggles.candleType === "HA" ? "bg-[#0e7490] text-white" : "bg-[#111827] text-slate-400 hover:bg-[#1c2635]"}`}
              >
                {toggles.candleType === "HA" ? "HA" : "Normal"}
              </button>
              {([["vwap", "VWAP"], ["ema21", "EMA21"], ["bb", "BB"], ["volume", "VOL"], ["markers", "SİN"], ["levels", "SEV"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
                  className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${toggles[key] ? "bg-[#1c2635] text-slate-200" : "bg-[#111827] text-slate-600 hover:text-slate-400"}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAutoScroll((a) => !a)}
                className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${autoScroll ? "bg-[#1c2635] text-slate-200" : "bg-[#111827] text-slate-600"}`}
                title="Yeni mum geldikçe sağa kaydır"
              >
                ⟳
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-0.5 lg:grid-cols-2">
            <div className="border-b border-[#1c2635] bg-[#0a0e17] lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-1.5 border-b border-[#1c2635] px-2 py-1 text-[9px] text-slate-500">
                15m — yön teyidi
                {m15Trend && <span className={`text-[13px] font-bold leading-none ${m15Trend === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{m15Trend === "UP" ? "↑" : "↓"}</span>}
              </div>
              <SpyChart
                bars={m15Bars} timeframe="15m" events={events} position={openPosition} toggles={toggles}
                height={380} autoScroll={autoScroll} defaultWindowMin={480}
                levelLines={data?.levels?.lines} trendDirection={m15Trend}
              />
            </div>
            <div className="bg-[#0a0e17]">
              <div className="flex items-center gap-1.5 border-b border-[#1c2635] px-2 py-1 text-[9px] text-slate-500">
                5m — karar mumu
                {m5Trend && <span className={`text-[13px] font-bold leading-none ${m5Trend === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{m5Trend === "UP" ? "↑" : "↓"}</span>}
              </div>
              <SpyChart
                bars={m5Bars} timeframe="5m" events={events} position={openPosition} toggles={toggles}
                height={380} autoScroll={autoScroll} defaultWindowMin={120}
                levelLines={data?.levels?.lines} trendDirection={m5Trend}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 border-t border-[#1c2635] px-2 py-1 font-mono text-[8px] text-slate-600">
            <span>Kaynak: {data?.dataSource.primary ?? "—"}</span>
            <span>Son kapanan: 5m {data?.lastClosed.m5 ? nyClock(data.lastClosed.m5) : "—"} · 15m {data?.lastClosed.m15 ? nyClock(data.lastClosed.m15) : "—"}</span>
          </div>
        </div>

        {/* ── 5) Anlık mum yorumları ── */}
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          <CommentFeed title="5m Mum Yorumları — fitil · konum · hacim · VWAP" items={analysis?.c5 ?? []} forming={forming5} />
          <CommentFeed title="15m Mum Yorumları — fitil · konum · hacim · VWAP" items={analysis?.c15 ?? []} forming={forming15} />
        </div>

        {/* Motor kapıları — ayrıntı, varsayılan kapalı */}
        <Disclosure title="Motor kapı detayı (LONG / SHORT giriş kapıları)">
          <GatePanel gates={data?.engine.gateStatus ?? null} />
        </Disclosure>
      </div>

      <div className="mt-2 text-center font-mono text-[8px] text-slate-700">
        yoklama {pollMs / 1000}sn · {m1.length} × 1m mum yüklü · son yanıt {lastFetch ? `${nyClock(lastFetch, true)} ET` : "—"}
      </div>
    </div>
  );
}
