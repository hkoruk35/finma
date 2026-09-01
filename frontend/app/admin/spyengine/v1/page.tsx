"use client";

/**
 * SPY Engine V3.1 — Kumanda Merkezi (/admin/spyengine/v1)
 *
 * Talimat §1'in kök sorunu: sayfa piyasa açıkken donuyordu. Çözüm burada
 * üç parçalı:
 *   1. Yoklama aralığı 60 sn → 2 sn (delta modu sayesinde yük artmıyor).
 *   2. `lastFetch` her BAŞARILI yanıtta güncellenir — yeni mum gelmese bile
 *      saat ilerler, böylece "akış duruyor mu" sorusu tek bakışta yanıtlanır.
 *   3. Ayrı bir 1 sn'lik kalp atışı, "X sn önce" sayacını ve bağlantı
 *      durumunu (ARDIŞIK HATA sayısı) sürekli günceller; sekme arka plana
 *      alınıp geri gelince (visibilitychange) anında yeniden yoklar.
 *
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur;
 * API uçları da ayrıca satır içi kontrol yapar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SpyChart, { type ChartToggles } from "@/components/admin/spyengine/SpyChart";
import SignalsArchive from "@/components/admin/spyengine/SignalsArchive";
import {
  TickerStrip, InfoCards, LayerTable, PositionPanel, EventList, StrategySchema,
  Panel, Disclosure, PhaseBadge, OHLCTable, SURFACE, num, signed, tone,
  type StripQuote, type SpotStats, type OHLCRow,
} from "@/components/admin/spyengine/panels";
import {
  fromCompact, nyClock, bucketAggregate, bollinger, rsi, macd, ema, lastNum,
  type Bar, type SessionInfo, type CompactBar,
} from "@/lib/spyengine/core";
import type {
  EngineEvent, PositionState, StreakDir, ContractType, ConfidencePart, Direction, EngineState,
} from "@/lib/spyengine/strategy";

// ── Yanıt tipi ────────────────────────────────────────────────────

interface EngineRead {
  m15Direction: Direction; m15Note: string;
  m5Rsi: number | null; m5RsiDirection: Direction; m5Note: string;
  m1StreakDir: StreakDir; m1StreakLen: number; m1Note: string;
  action: "LONG" | "SHORT" | "BEKLE";
  contractType: ContractType | null;
  state: EngineState;
  stateLabel: string;
  nextStep: string;
  confidence: number;
  confidenceParts: ConfidencePart[];
  reasoning: string;
}

interface ChainQuote {
  contractSymbol: string; strike: number;
  bid: number | null; ask: number | null; last: number | null; mid: number | null;
  openInterest: number | null; volume: number | null; impliedVolatility: number | null;
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
  positions: PositionState[];
  openPosition: PositionState | null;
  liveChain: ChainQuote | null;
  events: EngineEvent[];
}

type Tab = "command" | "signals" | "context" | "ohlc";

const POLL_OPTIONS = [1000, 2000, 5000, 15000];

const DEFAULT_TOGGLES: ChartToggles = {
  candleType: "HA",
  bb: true, ema50: true, vwap: true, volume: true,
  rsi: true, macd: true, markers: true, levels: true,
};

// ── Yardımcı: mumları birleştir (delta) ───────────────────────────

function mergeBars(prev: Bar[], incoming: Bar[], full: boolean): Bar[] {
  if (full) return incoming;
  if (!incoming.length) return prev;
  const map = new Map<number, Bar>();
  for (const b of prev) map.set(b.time, b);
  for (const b of incoming) map.set(b.time, b);
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

// ── Sayfa ─────────────────────────────────────────────────────────

export default function SpyEngineCommandCenter() {
  const [tab, setTab] = useState<Tab>("command");
  const [timeframe, setTimeframe] = useState<"1m" | "5m">("1m");
  const [toggles, setToggles] = useState<ChartToggles>(DEFAULT_TOGGLES);
  const [pollMs, setPollMs] = useState(2000);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  /** Boş = canlı. Dolu = o seansın geriye dönük oynatması (Yahoo 1m geçmişi ~5 gün). */
  const [replayDate, setReplayDate] = useState("");

  const [data, setData] = useState<StreamResponse | null>(null);
  const [m1, setM1] = useState<Bar[]>([]);
  const [m5, setM5] = useState<Bar[]>([]);
  const [m15, setM15] = useState<Bar[]>([]);

  const [quotes, setQuotes] = useState<StripQuote[]>([]);
  const [quotesAt, setQuotesAt] = useState<number | null>(null);

  const [ohlcData, setOhlcData] = useState<OHLCRow[] | null>(null);
  const [ohlcLoading, setOhlcLoading] = useState(false);

  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** 1 sn'lik kalp atışı — canlı saat ve "X sn önce" sayacı bunun üzerinden akar.
   *  0'dan başlar: sunucuda üretilen HTML ile istemcinin ilk render'ı aynı
   *  olsun (aksi hâlde saat bir saniye kaysa bile hydration uyuşmazlığı verir).
   *  İlk gerçek değer mount'tan sonraki ilk kalp atışında gelir. */
  const [nowSec, setNowSec] = useState(0);
  const [manualModeSince, setManualModeSince] = useState<number | null>(null);

  const sinceRef = useRef<number | null>(null);
  const replayRef = useRef("");
  const inflightRef = useRef(false);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const manualInteractTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Ana akış ────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const q = new URLSearchParams();
      if (sinceRef.current) q.set("since", String(sinceRef.current));
      if (replayRef.current) q.set("date", replayRef.current);
      const url = `/api/admin/spyengine/v2${q.size ? `?${q}` : ""}`;
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
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

      // Bir sonraki istekte yalnızca son mumdan itibaren gönderilsin
      // (son mum hâlâ oluşuyor olabileceği için onu da dahil ediyoruz).
      const lastM1 = json.bars.m1.length ? json.bars.m1[json.bars.m1.length - 1][0] : null;
      const lastM5 = json.bars.m5.length ? json.bars.m5[json.bars.m5.length - 1][0] : null;
      const lastM15 = json.bars.m15.length ? json.bars.m15[json.bars.m15.length - 1][0] : null;
      const candidates = [lastM1, lastM5, lastM15].filter((v): v is number => v != null);
      if (candidates.length) sinceRef.current = Math.min(...candidates);

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

  // Yoklama döngüsü. Seans değişince (canlı ↔ geriye dönük oynatma) delta
  // imleci sıfırlanır; sunucu `full: true` ile tam anlık görüntü gönderir ve
  // mergeBars eski günün mumlarının yerine yenilerini koyar.
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

  // Sekme geri geldiğinde anında yenile — arka planda tarayıcı timer'ları
  // kısıtladığı için dönüşte "donmuş" görünmesin.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [poll]);

  // ── Ticker şeridi (daha seyrek) ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/quotes", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (cancelled || !json.ok) return;
        setQuotes(json.quotes || []);
        setQuotesAt(json.serverTime);
      } catch {
        // Şerit hatası ana akışı etkilemesin — kartlar "veri yok" gösterir.
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // ── 15 günlük OHLC (sekme tıklanırsa yükle) ─────────────────────
  useEffect(() => {
    if (tab !== "ohlc" || ohlcData) return;
    let cancelled = false;
    const load = async () => {
      setOhlcLoading(true);
      try {
        const res = await fetch("/api/admin/spyengine/v2/ohlc", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (json.ok) setOhlcData(json.bars || []);
      } catch {
        // OHLC hatası, ana akışı etkilemesin
      } finally {
        setOhlcLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tab, ohlcData]);

  // ── 1 sn kalp atışı (canlı saat + "X sn önce") ──────────────────
  useEffect(() => {
    // İlk gerçek saati bir sonraki makro-göreve bırakıyoruz: effect gövdesinde
    // doğrudan setState çağırmak zincirleme render tetikler (React kuralı).
    const first = setTimeout(() => setNowSec(Math.floor(Date.now() / 1000)), 0);
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);

  // ── Tam ekran ───────────────────────────────────────────────────
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── Grafik zoom/pan sırasında autoScroll pause ─────────────────
  useEffect(() => {
    const wrap = chartWrapRef.current;
    if (!wrap) return;

    const onInteract = () => {
      const now = Math.floor(Date.now() / 1000);
      setManualModeSince(now);
      setAutoScroll(false);

      if (manualInteractTimeoutRef.current) clearTimeout(manualInteractTimeoutRef.current);
      manualInteractTimeoutRef.current = setTimeout(() => {
        setAutoScroll(true);
        setManualModeSince(null);
      }, 30000);
    };

    wrap.addEventListener("wheel", onInteract, { passive: true });
    wrap.addEventListener("mousedown", onInteract);

    return () => {
      wrap.removeEventListener("wheel", onInteract);
      wrap.removeEventListener("mousedown", onInteract);
      if (manualInteractTimeoutRef.current) clearTimeout(manualInteractTimeoutRef.current);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  }, []);

  // ── Türetilmiş ──────────────────────────────────────────────────
  const chartBars = timeframe === "1m" ? m1 : m5.length ? m5 : bucketAggregate(m1, 5);

  const secondsSince = lastFetch && nowSec ? Math.max(0, nowSec - lastFetch) : null;
  const connection: "live" | "lagging" | "down" =
    failures >= 3 ? "down" : secondsSince != null && secondsSince > Math.max(12, (pollMs / 1000) * 4) ? "lagging" : "live";

  const openPosition = data?.openPosition ?? null;
  const positions = data?.positions ?? [];
  const events = data?.events ?? [];

  // 15m bağlam okuması (ikincil sekme)
  const m15Read = useMemo(() => {
    if (m15.length < 30) return null;
    const closes = m15.map((b) => b.close);
    return {
      ema20: lastNum(ema(closes, 20)),
      ema50: lastNum(ema(closes, 50)),
      rsi: lastNum(rsi(closes, 14)),
      macdHist: lastNum(macd(closes).hist),
      bb: (() => {
        const b = bollinger(closes, 20, 2);
        return { u: lastNum(b.upper), m: lastNum(b.mid), l: lastNum(b.lower), pctB: lastNum(b.pctB) };
      })(),
      last: closes[closes.length - 1],
    };
  }, [m15]);

  const chartHeight = fullscreen ? Math.max(420, (typeof window !== "undefined" ? window.innerHeight : 900) - 96) : 560;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0e17] p-3 text-slate-300">
      {/* ── Başlık ── */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2635] pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-[16px] font-semibold tracking-tight text-[#eab308]">SPY Engine V3.1</h1>
            <p className="text-[10px] text-slate-500">
              1m ardışık mum serisi → LONG/SHORT giriş · sinyal tabanlı çıkış · sabit hedef/stop yok
            </p>
          </div>

          {data && (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[22px] font-bold text-slate-100">
                {data.spot.price == null ? "—" : `$${num(data.spot.price)}`}
              </span>
              <span className={`font-mono text-[13px] font-semibold ${tone(data.spot.changePct)}`}>
                {data.spot.changePct == null ? "" : `${signed(data.spot.change)} (${signed(data.spot.changePct)}%)`}
              </span>
            </div>
          )}

          {data && <PhaseBadge phase={data.session.phase} />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bağlantı durumu */}
          <span
            className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] ${
              connection === "live"
                ? "border-green-500/25 bg-green-500/10 text-green-300"
                : connection === "lagging"
                ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
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
            {POLL_OPTIONS.map((ms) => (
              <option key={ms} value={ms}>{ms / 1000} sn</option>
            ))}
          </select>

          <input
            type="date"
            value={replayDate}
            onChange={(e) => setReplayDate(e.target.value)}
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 font-mono text-[10px] text-slate-400"
            title="Geriye dönük seans oynatma (boş = canlı)"
          />
          {replayDate && (
            <button
              type="button"
              onClick={() => setReplayDate("")}
              className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300"
            >
              canlıya dön
            </button>
          )}

          <Link
            href="/admin/supertrade/v4"
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-[#1c2635]"
          >
            SuperTrade V4
          </Link>
        </div>
      </header>

      {/* Uyarılar */}
      {data && !data.session.isLive && data.session.note && (
        <div className="mb-3 flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300/90">
          <span>🕒</span><span>{data.session.note}</span>
        </div>
      )}
      {error && (
        <div className="mb-3 rounded border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          Akış hatası: {error}{failures > 1 && ` · ardışık ${failures} deneme başarısız`}
        </div>
      )}
      {data && data.dataSource.errors.length > 0 && (
        <div className="mb-3 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-300/80">
          Veri kaynağı uyarısı: {data.dataSource.errors.join(" · ")} — eksik zaman dilimi için mum çizilmiyor.
        </div>
      )}

      {/* ── Sekmeler ── */}
      <nav className="mb-3 flex gap-1">
        {([
          ["command", "Kumanda Merkezi"],
          ["signals", "Sinyaller & Arşiv"],
          ["context", "15m Bağlam & Veri"],
          ["ohlc", "15 Gün OHLC"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-t border-b-2 px-3 py-1.5 text-[11px] font-medium transition-colors ${
              tab === id
                ? "border-[#eab308] bg-[#111827] text-slate-100"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ═══ KUMANDA MERKEZİ ═══ */}
      {tab === "command" && (
        <div className="flex flex-col gap-3">
          <TickerStrip quotes={quotes} updatedAt={quotesAt} />
          <InfoCards spot={data?.spot ?? null} lastFetch={lastFetch} phase={data?.session.phase ?? "CLOSED"} />

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_320px]">
            {/* Grafik */}
            <div ref={chartWrapRef} className={`${SURFACE} overflow-hidden ${fullscreen ? "flex flex-col" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-2">
                <div className="flex items-center gap-1">
                  {(["1m", "5m"] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                        timeframe === tf ? "bg-[#1d4ed8] text-white" : "bg-[#111827] text-slate-400 hover:bg-[#1c2635]"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                  <span className="ml-1 text-[10px] text-slate-600">
                    {timeframe === "1m" ? "hassas tetik" : "kurulum motoru"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setToggles((t) => ({ ...t, candleType: t.candleType === "HA" ? "NORMAL" : "HA" }))}
                    className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                      toggles.candleType === "HA" ? "bg-[#0e7490] text-white" : "bg-[#111827] text-slate-400 hover:bg-[#1c2635]"
                    }`}
                  >
                    {toggles.candleType === "HA" ? "Heikin Ashi" : "Normal Mum"}
                  </button>
                  {([
                    ["bb", "BB"], ["ema50", "EMA50"], ["vwap", "VWAP"], ["volume", "HACİM"],
                    ["rsi", "RSI"], ["macd", "MACD"], ["markers", "SİNYAL"], ["levels", "SEVİYE"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
                      className={`rounded px-1.5 py-1 text-[10px] transition-colors ${
                        toggles[key] ? "bg-[#1c2635] text-slate-200" : "bg-[#111827] text-slate-600 hover:text-slate-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAutoScroll((a) => !a)}
                    className={`rounded px-1.5 py-1 text-[10px] transition-colors ${
                      autoScroll ? "bg-[#1c2635] text-slate-200" : "bg-[#111827] text-slate-600"
                    }`}
                    title="Yeni mum geldikçe sağa kaydır"
                  >
                    ⟳ TAKİP
                  </button>
                  {manualModeSince != null && nowSec > 0 && (
                    <span
                      className="rounded bg-amber-500/15 px-1.5 py-1 text-[10px] text-amber-300"
                      title="Grafiği kaydırdın/yakınlaştırdın — 30 sn dokunmazsan otomatik takibe döner"
                    >
                      manuel inceleme · {Math.max(0, 30 - (nowSec - manualModeSince))}sn
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="rounded bg-[#111827] px-1.5 py-1 text-[10px] text-slate-400 transition-colors hover:bg-[#1c2635]"
                  >
                    {fullscreen ? "⤡ ÇIK" : "⤢ TAM EKRAN"}
                  </button>
                </div>
              </div>

              <div className={fullscreen ? "flex-1" : ""}>
                <SpyChart
                  bars={chartBars}
                  timeframe={timeframe}
                  events={events}
                  position={openPosition}
                  toggles={toggles}
                  height={chartHeight}
                  autoScroll={autoScroll}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#1c2635] px-3 py-1.5 font-mono text-[9px] text-slate-600">
                <span>Kaynak: {data?.dataSource.primary ?? "—"}</span>
                {data?.dataSource.overnight && <span className="text-sky-400">+ overnight: Robinhood köprüsü</span>}
                {!!data?.dataSource.sanitized && (
                  <span className="text-amber-400/80" title="Hacmi 0 olan ve hem önceki hem sonraki mumdan %0,2'den fazla kopuk Yahoo kayıtları atıldı — yerine mum uydurulmadı">
                    {data.dataSource.sanitized} bozuk print atıldı
                  </span>
                )}
                <span>Son kapalı mum — 1m: {data?.lastClosed.m1 ? nyClock(data.lastClosed.m1) : "—"} · 5m: {data?.lastClosed.m5 ? nyClock(data.lastClosed.m5) : "—"} · 15m: {data?.lastClosed.m15 ? nyClock(data.lastClosed.m15) : "—"}</span>
              </div>
            </div>

            {/* Sağ sütun */}
            <div className="flex flex-col gap-3">
              {data && (
                <LayerTable
                  m5Rsi={data.engine.m5Rsi} m5RsiDirection={data.engine.m5RsiDirection} m5Note={data.engine.m5Note}
                  m1StreakDir={data.engine.m1StreakDir} m1StreakLen={data.engine.m1StreakLen} m1Note={data.engine.m1Note}
                  action={data.engine.action} contractType={data.engine.contractType}
                  state={data.engine.state} stateLabel={data.engine.stateLabel} nextStep={data.engine.nextStep}
                  confidence={data.engine.confidence} confidenceParts={data.engine.confidenceParts}
                />
              )}
              <PositionPanel position={openPosition} livePremium={openPosition?.lastPremium ?? null} />

              {data?.liveChain && (
                <Panel title="Canlı 0DTE Kotasyonu">
                  <div className="flex flex-col gap-1 font-mono text-[11px]">
                    <div className="flex justify-between"><span className="text-slate-500">Kontrat</span><span className="text-slate-300">{data.liveChain.contractSymbol}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Bid / Ask</span><span className="text-slate-300">{num(data.liveChain.bid)} / {num(data.liveChain.ask)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Orta</span><span className="text-slate-300">{num(data.liveChain.mid)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Son</span><span className="text-slate-300">{num(data.liveChain.last)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">IV</span><span className="text-slate-300">{data.liveChain.impliedVolatility == null ? "—" : `%${num(data.liveChain.impliedVolatility * 100, 1)}`}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Hacim / OI</span><span className="text-slate-300">{data.liveChain.volume ?? "—"} / {data.liveChain.openInterest ?? "—"}</span></div>
                  </div>
                </Panel>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel title="Motor Açıklaması">
              <div className="rounded border border-[#1c2635] bg-[#0a0e17] p-3 font-mono text-[11px] leading-relaxed text-slate-400">
                <span className="text-[#3b82f6]">{lastFetch ? nyClock(lastFetch, true) : "—"}</span>{" "}
                — {data?.engine.reasoning ?? "Motor verisi bekleniyor."}
              </div>
              <div className="mt-2 flex flex-col gap-1 text-[10px] text-slate-500">
                <div>· Kararlar SADECE kapanmış mumlarla verilir; çizilmiş bir işaret asla yerinden oynamaz.</div>
                <div>· Giriş 1m mum serisinden üretilir; 15m kararın hiçbir yerinde kullanılmaz, 5m sadece güveni ayarlar, sinyali iptal etmez.</div>
                <div>· Sabit yüzde hedef/stop ve süre sınırı YOK — pozisyon trend devam ettiği sürece taşınır.</div>
                <div>· Çıkış da girişle aynı veriden üretilen bir SİNYALDİR: 3 ardışık ters 1m mum · 5m RSI dönüşü · hacim tükenmesi · 15:45 ET.</div>
                <div>· $ kâr/zarar GERÇEK 0DTE opsiyon primiyle hesaplanır; prim verisi gelmezse giriş/çıkış yine doğrudur, sadece tutar üretilmez.</div>
              </div>
            </Panel>

            <Panel
              title="Oturum Sinyal Geçmişi"
              right={<span className="font-mono text-[10px] text-slate-600">{events.length} olay</span>}
            >
              <EventList events={events} emptyText="Bu seansta henüz sinyal olayı yok." />
            </Panel>
          </div>

          {/* Strateji şeması — sayfanın en altı, varsayılan kapalı */}
          <Disclosure
            title="Strateji Şeması — giriş, taşıma ve çıkış kuralları"
            badge={
              data && (
                <span className="rounded bg-[#1c2635] px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                  {data.engine.stateLabel}
                </span>
              )
            }
          >
            <StrategySchema state={data?.engine.state ?? "WATCHING"} contractType={data?.engine.contractType ?? null} />
          </Disclosure>
        </div>
      )}

      {/* ═══ SİNYALLER & ARŞİV ═══ */}
      {tab === "signals" && (
        <SignalsArchive positions={positions} sessionDate={data?.session.date ?? null} />
      )}

      {/* ═══ 15m BAĞLAM ═══ */}
      {tab === "context" && (
        <div className="flex flex-col gap-3">
          <div className={`${SURFACE} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
              <span className="text-[11px] font-semibold tracking-wide text-slate-300">15m Grafik — yön/rejim (ikincil)</span>
              <span className="text-[10px] text-slate-600">Karar mekanizmasının parçası değil (talimat §3)</span>
            </div>
            <SpyChart
              bars={m15}
              timeframe="15m"
              events={events}
              position={openPosition}
              toggles={{ ...toggles, markers: false, levels: false }}
              height={420}
              autoScroll={autoScroll}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel title="15m Gösterge Okuması">
              {!m15Read ? (
                <div className="text-[12px] text-slate-600">15m verisi yetersiz.</div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                  {[
                    ["Son kapanış", num(m15Read.last)],
                    ["EMA20", num(m15Read.ema20)],
                    ["EMA50", num(m15Read.ema50)],
                    ["RSI(14)", num(m15Read.rsi, 1)],
                    ["MACD hist", num(m15Read.macdHist, 3)],
                    ["BB üst", num(m15Read.bb.u)],
                    ["BB orta", num(m15Read.bb.m)],
                    ["BB alt", num(m15Read.bb.l)],
                    ["%B", m15Read.bb.pctB == null ? "—" : `%${num(m15Read.bb.pctB * 100, 0)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[#151c28] py-1">
                      <span className="text-slate-500">{k}</span>
                      <span className="text-slate-200">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Veri Kaynağı & Şeffaflık">
              <div className="flex flex-col gap-1.5 text-[11px] text-slate-400">
                <div>Birincil: <b className="text-slate-200">{data?.dataSource.primary ?? "—"}</b></div>
                <div>
                  Overnight (20:00–04:00 ET):{" "}
                  <b className={data?.dataSource.overnight ? "text-sky-300" : "text-slate-500"}>
                    {data?.dataSource.overnight ? "Robinhood köprüsü aktif" : "kaynak yok — mum çizilmiyor"}
                  </b>
                </div>
                <div>Premarket / afterhours: <b className="text-slate-200">Yahoo includePrePost=true (gerçek veri)</b></div>
                <div>
                  Atılan bozuk print:{" "}
                  <b className={data?.dataSource.sanitized ? "text-amber-300" : "text-slate-500"}>
                    {data?.dataSource.sanitized ?? 0} mum
                  </b>{" "}
                  <span className="text-[10px] text-slate-600">
                    (yalnızca hacmi 0 olan ve hem önceki hem sonraki mumun kapanışından %0,2&apos;den fazla kopan mumlar;
                    hacimli hiçbir mum ellenmez, atılan mumun yerine mum uydurulmaz)
                  </span>
                </div>
                <div>Yüklü mum sayısı: <b className="text-slate-200">1m {m1.length} · 5m {m5.length} · 15m {m15.length}</b></div>
                <div>Sunucu saati: <b className="text-slate-200">{data ? nyClock(data.serverTime, true) : "—"} ET</b></div>
                <div className="mt-1 border-t border-[#1c2635] pt-2 text-[10px] leading-relaxed text-slate-500">
                  Yahoo bir alan döndürmediğinde bu ekranda &quot;veri yok&quot; yazar. Hiçbir fiyat, prim veya
                  gösterge değeri modelden/interpolasyondan üretilmez.
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* ═══ 15 GÜN OHLC ═══ */}
      {tab === "ohlc" && (
        <div className="flex flex-col gap-3">
          <OHLCTable data={ohlcData} loading={ohlcLoading} />
        </div>
      )}

      <div className="mt-3 text-center font-mono text-[9px] text-slate-700">
        yoklama {pollMs / 1000}sn · {m1.length} × 1m mum yüklü · son yanıt{" "}
        {lastFetch ? `${nyClock(lastFetch, true)} ET` : "—"}
      </div>
    </div>
  );
}
