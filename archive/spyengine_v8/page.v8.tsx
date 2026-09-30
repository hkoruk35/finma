"use client";

/**
 * SPY Engine V3.1 — Kumanda Merkezi (/admin/spyengine/v1)
 *
 * Talimat §1'in kök sorunu: sayfa piyasa açıkken donuyordu. Çözüm burada
 * üç parçalı:
 *   1. Yoklama aralığı 60 sn → 1 sn (delta modu sayesinde yük artmıyor).
 *   2. `lastFetch` her BAŞARILI yanıtta güncellenir — yeni mum gelmese bile
 *      saat ilerler, böylece "akış duruyor mu" sorusu tek bakışta yanıtlanır.
 *   3. Ayrı bir 1 sn'lik kalp atışı, "X sn önce" sayacını ve bağlantı
 *      durumunu (ARDIŞIK HATA sayısı) sürekli günceller; sekme arka plana
 *      alınıp geri gelince (visibilitychange) anında yeniden yoklar.
 *
 * V3.3 düzeni: en üstte ÖN UYARI çubuğu (kurulum oluşmadan haber verir),
 * altında küçültülmüş grafik + LONG/SHORT kapılarını AYNI ANDA gösteren
 * kapı tablosu. Dar ekranda (tablet) kapı tablosu grafiğin üstüne geçer.
 * Ticker şeridi + bilgi kartları artık grafiğin ÜSTÜNDE ayrı yer kaplamıyor;
 * sağ sütun (Kapı Durumu + Motor Durumu) grafikten uzun olduğu için grid
 * grafik panelini aynı yüksekliğe geriyordu — o boşa giden alan artık
 * grafiğin ALTINDA bu kartlarla dolduruluyor (bkz. flex flex-col + flex-1
 * dolgu bölümü, aşağıda "command" sekmesinde). Giriş/çıkış kurallarına
 * DOKUNULMADI — bunlar yalnızca sunum katmanı.
 *
 * Manuel grafik incelemesi (zoom/pan) 90 sn otomatik takibi durdurur, sonra
 * kendiliğinden devam eder (bkz. MANUAL_PAUSE_MS).
 *
 * 1m mum TTL'i piyasa saatine göre değişir: RTH içinde 1200ms, dışında
 * (pre/post/kapalı) 4000ms (bkz. lib/spyengine/market.ts TTL.m1Extended) —
 * fiyat zaten seyrek değiştiği saatlerde Yahoo'ya gereksiz istek gitmesin.
 *
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur;
 * API uçları da ayrıca satır içi kontrol yapar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SpyChart, { type ChartToggles } from "@/components/admin/spyengine/SpyChart";
import { useSpySignalSocket, type SpySignalMessage } from "@/lib/spyengine/useSpySignalSocket";
import SignalsArchive from "@/components/admin/spyengine/SignalsArchive";
import DailyForecast from "@/components/admin/spyengine/DailyForecast";
import OptionCalculator from "@/components/admin/spyengine/OptionCalculator";
import {
  TickerStrip, InfoCards, LayerTable, GatePanel, PositionPanel, EventList, StrategySchema,
  AlertBanner, computeEntryAlert,
  RegimeBanner, RegimePanel, M15Strip, PositionSizeCard, type RegimeBlock,
  LevelPanel, ForecastPanel,
  ExitGatePanel,
  Panel, Disclosure, PhaseBadge, OHLCTable, SURFACE, num, signed, tone,
  type StripQuote, type SpotStats, type OHLCRow,
} from "@/components/admin/spyengine/panels";
import {
  fromCompact, nyClock, nyParts, bucketAggregate, bollinger, rsi, macd, ema, lastNum,
  type Bar, type SessionInfo, type CompactBar,
} from "@/lib/spyengine/core";
import type {
  EngineEvent, PositionState, ContractType, ConfidencePart, EngineState, GateStatus,
  RegimeState, M15VetoRead, VolumeVetoRead, Layer1Read, Layer3Read,
} from "@/lib/spyengine/strategy";
import type { LevelRead, CloseForecast } from "@/lib/spyengine/levels";
import type { ReversalState } from "@/lib/spyengine/reversal";

// ── Yanıt tipi ────────────────────────────────────────────────────

interface EngineRead {
  veto: M15VetoRead;
  volumeVeto: VolumeVetoRead;
  layer1: Layer1Read;
  regime: RegimeState;
  layer3: Layer3Read;
  action: "LONG" | "SHORT" | "BEKLE";
  contractType: ContractType | null;
  state: EngineState;
  stateLabel: string;
  nextStep: string;
  confidence: number;
  confidenceParts: ConfidencePart[];
  reasoning: string;
  gateStatus: GateStatus;
  refinement5m: { readyToEnter: boolean; note: string };
  stopSpy: number | null;
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
  /** V4 -- rejim etiketi, kriter dokumu, gecisler, gun ozeti */
  regime?: RegimeBlock;
  /** V4 -- seviye takibi (spec 3) */
  levels?: LevelRead;
  /** V4 -- gun kapanis tahmini (spec 4) */
  forecast?: CloseForecast | null;
  /** V4.1 -- bugun ayni kontrata (strike+yon) ikinci kez girmek isteyip reddedilen adaylar */
  contractReuseBlocked?: { time: number; side: "LONG" | "SHORT"; strike: number }[];
  /** Tier 3 -- Dönüş Yakalama: puanlama tabanlı Kapı Durumu ve Çıkış Takip için */
  reversalCatch?: ReversalState;
  /** Faz 1 (tasks/active/013) -- 5m Monte Carlo, deneysel dogrulama alani */
  monteCarlo?: {
    sigmaPerBarRaw: number | null;
    seasonalityMultiplier: number;
    seasonalitySampleDays: number;
    sigmaPerBarAdj: number;
    horizonMin: number;
    nSims: number;
    asOfBarTime: number;
    levels: { price: number; touchProbability: number; densityPct: number }[];
  } | null;
  /** Faz 2 (tasks/active/013) -- SPY 0DTE Black-Scholes Greeks + prim egrisi, deneysel */
  optionDecision?: {
    generatedAt: string;
    spot: number;
    expiry: string;
    isZeroDte: boolean;
    yearsToExpiry: number;
    riskFreeRate: number;
    contracts: {
      strike: number;
      call: { lastPrice: number | null; bid: number | null; ask: number | null; impliedVolatility: number | null; greeks: { delta: number; gamma: number; theta: number; vega: number } };
      put: { lastPrice: number | null; bid: number | null; ask: number | null; impliedVolatility: number | null; greeks: { delta: number; gamma: number; theta: number; vega: number } };
      premiumCurve: { targetPrice: number; callPremium: number; putPremium: number }[];
    }[];
  } | null;
  /** Faz 3+5 (tasks/active/013) -- "SPY Option Sayfası" için Tier 1-5 birleşik veri seti */
  decisionPage?: {
    generatedAt: number;
    spot: number;
    asOfBarTime: number;
    horizonsMin: number[];
    priceGrid: number[];
    tier1: Record<string, { price: number; touchProbability: number; densityPct: number }[]>;
    tier2: { strike: number; callImpliedProb: number | null; putImpliedProb: number | null }[];
    tier3: {
      long: {
        reversal: { side: "LONG" | "SHORT"; score: number; parts: { label: string; value: number }[]; note: string };
        exhaustion: { side: "LONG" | "SHORT"; score: number; recentOpposingVolume: number; priorOpposingVolume: number; note: string };
      };
      short: {
        reversal: { side: "LONG" | "SHORT"; score: number; parts: { label: string; value: number }[]; note: string };
        exhaustion: { side: "LONG" | "SHORT"; score: number; recentOpposingVolume: number; priorOpposingVolume: number; note: string };
      };
    };
    tier5: { price: number; edgeLong: number; edgeShort: number }[];
    targetBand: {
      horizonMin: number;
      offsetRange: [number, number];
      up: { level: number; touchProbability: number; expectedReturnPct: number; expectedReturnSource: "premium" | "priceMove"; expectedValuePct: number };
      down: { level: number; touchProbability: number; expectedReturnPct: number; expectedReturnSource: "premium" | "priceMove"; expectedValuePct: number };
      combinedProbability: number;
    };
  } | null;
}

type Tab = "command" | "spyoption" | "signals" | "context" | "ohlc" | "compare" | "forecast";

// ═══ SPY Option tab — real-time 15m trigger + 5m timing signal panel (tasks/active/014) ═══
// Backed by the standalone spy_signal_engine/ service (repo root, Python),
// reached via an nginx-only route (wss://<host>/admin/spyengine/live/ws +
// GET .../history) that sits OUTSIDE proxy.ts's boga_auth check — see the
// known-gap note in tasks/active/014-spy-signal-engine-realtime.md.

const SPY_DECISION_TONE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  "CALL SETUP": { bg: "bg-[#22c55e]/10", border: "border-[#22c55e]/40", text: "text-[#22c55e]", label: "🟢 CALL SETUP" },
  "PUT SETUP": { bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/40", text: "text-[#ef4444]", label: "🔴 PUT SETUP" },
  "NO TRADE": { bg: "bg-[#1c2635]/40", border: "border-[#1c2635]", text: "text-slate-400", label: "⚪ NO TRADE" },
};

const MARKET_STATUS_LABEL: Record<string, string> = {
  open: "Piyasa açık",
  pre: "Piyasa öncesi (pre-market)",
  post: "Piyasa sonrası (after-hours)",
  closed: "Piyasa kapalı",
};

/** Web Audio API ile kısa bir bip — harici mp3 dosyası kullanılmıyor. */
function playAlertBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    // sessizce yut — ses opsiyonel bir yardımcı, akışı bozmamalı
  }
}

function requestBrowserNotification(msg: SpySignalMessage) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "denied") return;
  const fire = () => {
    try {
      new Notification(`SPY ${msg.decision}`, {
        body: `Rejim ${msg.regime_30m ?? "?"} · Entry ${msg.entry_zone ?? "—"} · ${msg.time_utc ?? ""}`,
      });
    } catch {
      // no-op
    }
  };
  if (Notification.permission === "granted") {
    fire();
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") fire();
    });
  }
}

function SpySignalHistoryTable({ rows }: { rows: SpySignalMessage[] }) {
  if (!rows.length) {
    return <div className="text-[11px] text-slate-500">Henüz geçmiş sinyal yok.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-[#1c2635] text-slate-500">
            <th className="py-1 text-left font-semibold">Saat (UTC)</th>
            <th className="py-1 text-left font-semibold">Karar</th>
            <th className="py-1 text-left font-semibold">30m Rejim</th>
            <th className="py-1 text-left font-semibold">15m Tetik</th>
            <th className="py-1 text-right font-semibold">5m RSI</th>
            <th className="py-1 text-right font-semibold">15m Hacim</th>
            <th className="py-1 text-left font-semibold">5m Zamanlama</th>
            <th className="py-1 text-right font-semibold">Kapanış</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r, i) => {
            const tone = SPY_DECISION_TONE[r.decision] ?? SPY_DECISION_TONE["NO TRADE"];
            return (
              <tr key={`${r.time_utc ?? i}-${i}`} className="border-b border-[#0f141d]">
                <td className="py-1 text-slate-400">{r.time_utc ?? "—"}</td>
                <td className={`py-1 ${tone.text}`}>{r.decision}</td>
                <td className="py-1 text-slate-300">{r.regime_30m ?? "—"}</td>
                <td className="py-1 text-slate-300">{r.trigger_15m ?? "—"}</td>
                <td className="py-1 text-right text-slate-300">
                  {r.rsi_5m_prev != null && r.rsi_5m_now != null ? `${r.rsi_5m_prev} → ${r.rsi_5m_now}` : "—"}
                </td>
                <td className="py-1 text-right text-slate-300">{r.vol_ratio_15m_pct != null ? `${r.vol_ratio_15m_pct >= 0 ? "+" : ""}${r.vol_ratio_15m_pct}%` : "—"}</td>
                <td className="py-1 text-slate-300">{r.refinement_5m ?? "—"}</td>
                <td className="py-1 text-right text-slate-300">{r.last_close != null ? `$${r.last_close}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpyOptionLiveTab({
  bars5m, events, openPosition, toggles, autoScroll,
}: {
  bars5m: Bar[];
  events: EngineEvent[];
  openPosition: PositionState | null;
  toggles: ChartToggles;
  autoScroll: boolean;
}) {
  const { status, lastMessage } = useSpySignalSocket();
  const [history, setHistory] = useState<SpySignalMessage[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const notifiedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/spyengine/live-history?limit=20", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const rows = Array.isArray(json?.rows) ? (json.rows as SpySignalMessage[]) : [];
        setHistory(rows);
        if (json?.error) setHistoryError(String(json.error));
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : "geçmiş sinyaller alınamadı");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lastMessage || !lastMessage.time_utc) return;
    setHistory((prev) => {
      if (prev.length && prev[0].time_utc === lastMessage.time_utc && prev[0].decision === lastMessage.decision) {
        return prev;
      }
      return [lastMessage, ...prev].slice(0, 20);
    });

    const dedupeKey = `${lastMessage.time_utc}-${lastMessage.decision}`;
    if (
      (lastMessage.decision === "CALL SETUP" || lastMessage.decision === "PUT SETUP") &&
      notifiedKeyRef.current !== dedupeKey
    ) {
      notifiedKeyRef.current = dedupeKey;
      requestBrowserNotification(lastMessage);
      playAlertBeep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  // İlk kullanıcı etkileşiminde bildirim izni iste (tarayıcılar gesture olmadan
  // izin istemini reddedebilir/engelleyebilir).
  useEffect(() => {
    const askOnce = () => {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      window.removeEventListener("click", askOnce);
    };
    window.addEventListener("click", askOnce, { once: true });
    return () => window.removeEventListener("click", askOnce);
  }, []);

  const tone = lastMessage ? (SPY_DECISION_TONE[lastMessage.decision] ?? SPY_DECISION_TONE["NO TRADE"]) : null;
  const statusLabel = status === "connected" ? "🟢 bağlı" : status === "connecting" ? "🟡 bağlanıyor" : "🔴 koptu";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between rounded border border-[#1c2635] bg-[#0f141d] px-3 py-2 text-[10px] leading-snug text-slate-400">
        <span>Gerçek zamanlı SPY 15m tetik + 5m zamanlama sinyal motoru — spy_signal_engine servisinden canlı.</span>
        <span className="font-mono text-[10px]">{statusLabel}</span>
      </div>

      {/* Grafik — kendi grafik motorumuz (SpyChart), seviye çizgisi yok */}
      <div className={`${SURFACE} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#1c2635] px-2 py-1">
          <span className="text-[10px] text-slate-500">5m grafik</span>
        </div>
        <SpyChart
          bars={bars5m}
          timeframe="5m"
          events={events}
          position={openPosition}
          toggles={toggles}
          height={360}
          autoScroll={autoScroll}
          defaultWindowMin={120}
        />
      </div>

      {/* Sinyal durumu kartı */}
      {!lastMessage ? (
        <div className={`${SURFACE} px-3 py-6 text-center text-[12px] text-slate-500`}>
          Henüz sinyal alınmadı — bağlantı kuruluyor.
        </div>
      ) : (
        <div className={`rounded-lg border ${tone!.border} ${tone!.bg} px-3 py-2.5`}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate-300">{lastMessage.symbol ?? "SPY"}</span>
            <span className="font-mono text-[10px] text-slate-500">{lastMessage.time_utc ?? "—"} UTC</span>
            <span className={`text-[13px] font-bold ${tone!.text}`}>{tone!.label}</span>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300 sm:grid-cols-3">
            <div>30m Rejim: <b className="text-slate-100">{lastMessage.regime_30m ?? "—"}</b></div>
            <div>15m Tetik: <b className="text-slate-100">{lastMessage.trigger_15m ?? "—"}</b></div>
            <div>5m Zamanlama: <b className="text-slate-100">{lastMessage.refinement_5m ?? "—"}</b></div>
            <div>5m RSI: <b className="text-slate-100">{lastMessage.rsi_5m_prev ?? "—"} → {lastMessage.rsi_5m_now ?? "—"}</b></div>
            <div>15m Hacim: <b className="text-slate-100">{lastMessage.vol_ratio_15m_pct != null ? `${lastMessage.vol_ratio_15m_pct >= 0 ? "+" : ""}${lastMessage.vol_ratio_15m_pct}%` : "—"} (8 mum ort. {lastMessage.avg_vol_8_15m ?? "—"})</b></div>
            <div>15m ATR: <b className="text-slate-100">{lastMessage.atr_15m ?? "—"}</b></div>
            <div>VWAP: <b className="text-slate-100">{lastMessage.above_vwap == null ? "—" : lastMessage.above_vwap ? "üstünde" : "altında"} ({lastMessage.vwap ?? "—"})</b></div>
            <div>Chop Bandı: <b className="text-slate-100">{lastMessage.chop_band_lo ?? "—"} / {lastMessage.chop_band_hi ?? "—"}</b></div>
            <div>Stop_SPY: <b className="text-slate-100">{lastMessage.stop_spy ?? "—"}</b></div>
            <div>Stop_prem: <b className="text-slate-100">{lastMessage.stop_premium ?? "—"}</b></div>
            <div>Entry zone: <b className="text-slate-100">{lastMessage.entry_zone ?? "—"}</b></div>
            <div>Mum yapısı: <b className="text-slate-100">{lastMessage.candle_shape ?? "—"}</b></div>
          </div>
          {lastMessage.market_status && lastMessage.market_status !== "open" && (
            <div className="mt-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
              {MARKET_STATUS_LABEL[lastMessage.market_status] ?? lastMessage.market_status} — düşük hacim, sinyal güvenilirliği azalmış olabilir.
            </div>
          )}
          {lastMessage.reason && (
            <div className="mt-1.5 text-[10px] text-slate-500">{lastMessage.reason}</div>
          )}
        </div>
      )}

      {/* Geçmiş sinyaller tablosu */}
      <Panel title="Geçmiş sinyaller (son 20)">
        {historyError && <div className="mb-1.5 text-[10px] text-amber-400">Geçmiş yüklenemedi: {historyError}</div>}
        <SpySignalHistoryTable rows={history} />
      </Panel>

      {/* SL/TP hesaplayıcı + canlı opsiyon zinciri (0–5DTE) */}
      <OptionCalculator />
    </div>
  );
}

const POLL_OPTIONS = [1000, 2000, 5000, 15000];

/** Grafiği elle incelerken (zoom/pan) otomatik takibin duraklama süresi */
const MANUAL_PAUSE_MS = 90000;

// V7.0/v2: RSI ve MACD karar mekanizmasından çıkarıldı — grafikte varsayılan
// KAPALI. Önemli olan EMA21, VWAP, mum yapısı ve hacim (kullanıcı talebi).
const DEFAULT_TOGGLES: ChartToggles = {
  candleType: "HA",
  bb: true, ema21: true, vwap: true, volume: true,
  rsi: false, macd: false, markers: true, levels: true,
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
  const [toggles, setToggles] = useState<ChartToggles>(DEFAULT_TOGGLES);
  const [pollMs, setPollMs] = useState(1000);
  const [autoScroll, setAutoScroll] = useState(true);
  /** Fiyat şeridi + bilgi kartları — tam genişlik, gizlenebilir */
  const [showTickerStrip, setShowTickerStrip] = useState(true);
  /** 1m + 5m grafikleri yan yana — gizlenebilir */
  const [showCharts, setShowCharts] = useState(true);
  /** Hangi grafik şu an tam ekranda: ikisi birden, sadece 1m, sadece 5m ya da hiçbiri */
  const [fullscreenTarget, setFullscreenTarget] = useState<"both" | "1m" | "5m" | null>(null);
  const [viewportH, setViewportH] = useState(0);
  /** Kurulum yaklaştığında sesli + titreşimli uyarı */
  const [alertSound, setAlertSound] = useState(true);
  /** Boş = canlı. Dolu = o seansın geriye dönük oynatması (Yahoo 1m geçmişi ~5 gün). */
  const [replayDate, setReplayDate] = useState("");

  const [data, setData] = useState<StreamResponse | null>(null);
  const [m1, setM1] = useState<Bar[]>([]);
  const [m5, setM5] = useState<Bar[]>([]);
  const [m15, setM15] = useState<Bar[]>([]);

  const [quotes, setQuotes] = useState<StripQuote[]>([]);
  const [quotesAt, setQuotesAt] = useState<number | null>(null);

  /** V4 -- kapanis tahmininin GERCEKLESEN isabeti (guven skoruyla ayni sey degil) */
  const [forecastAccuracy, setForecastAccuracy] = useState<{ checked: number; hit: number } | null>(null);
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
  const chart1WrapRef = useRef<HTMLDivElement>(null);
  const chart5WrapRef = useRef<HTMLDivElement>(null);
  const manualInteractTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // ── V4: kapanış tahminini kaydet + isabeti oku ───────────────
  //
  // Sunucu tahmini 5 dakikalık kovalara yuvarlıyor, bu yüzden sık POST
  // zararsız (aynı kovaya ikinci kez yazılmıyor). Seans kapandığında
  // gerçek kapanış bir kez yazılır ve isabet oradan hesaplanır.
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
            snapshot: f.remainingMin > 0
              ? { at: bucket, remainingMin: f.remainingMin, low: f.low, high: f.high, mid: f.mid }
              : undefined,
            actualClose: actualClose ?? undefined,
          }),
        });
        const res = await fetch("/api/admin/spyengine/v2/forecast", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (json.ok) setForecastAccuracy({ checked: json.checked, hit: json.hit });
      } catch {
        // Tahmin kaydı ana akışı etkilemesin — panel yine çalışır.
      }
    })();
  }, [data, lastFetch, replayDate]);

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
      }, MANUAL_PAUSE_MS);
    };

    wrap.addEventListener("wheel", onInteract, { passive: true });
    wrap.addEventListener("mousedown", onInteract);

    return () => {
      wrap.removeEventListener("wheel", onInteract);
      wrap.removeEventListener("mousedown", onInteract);
      if (manualInteractTimeoutRef.current) clearTimeout(manualInteractTimeoutRef.current);
    };
  }, []);

  // ── Ekran yüksekliği (tam ekran grafik hesaplaması için) ─────────
  useEffect(() => {
    const read = () => setViewportH(window.innerHeight);
    const t = setTimeout(read, 0);
    window.addEventListener("resize", read);
    return () => { clearTimeout(t); window.removeEventListener("resize", read); };
  }, []);

  // ── Grafik tam ekran — hangi kutu tam ekranda, DOM'dan takip et ──
  useEffect(() => {
    const onFs = () => {
      const el = document.fullscreenElement;
      if (!el) { setFullscreenTarget(null); return; }
      if (el === chart1WrapRef.current) setFullscreenTarget("1m");
      else if (el === chart5WrapRef.current) setFullscreenTarget("5m");
      else if (el === chartWrapRef.current) setFullscreenTarget("both");
      else setFullscreenTarget(null);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const enterFullscreen = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (document.fullscreenElement === el) { document.exitFullscreen().catch(() => {}); return; }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    el.requestFullscreen().catch(() => {});
  }, []);

  // ── Türetilmiş ──────────────────────────────────────────────────
  const secondsSince = lastFetch && nowSec ? Math.max(0, nowSec - lastFetch) : null;
  const connection: "live" | "lagging" | "down" =
    failures >= 3 ? "down" : secondsSince != null && secondsSince > Math.max(12, (pollMs / 1000) * 4) ? "lagging" : "live";

  const openPosition = data?.openPosition ?? null;
  const positions = data?.positions ?? [];
  const events = data?.events ?? [];

  /** V4.1 — seans kapandığında gerçekleşen SPY kapanışı (ForecastPanel başlığında gösterilir) */
  const sessionOver = data ? !data.session.isLive || data.session.phase === "POST" || data.session.phase === "CLOSED" : false;
  const actualCloseForForecast = sessionOver ? data?.spot.price ?? null : null;

  /** 1m/5m grafik yükseklikleri — tam ekranda viewport'a, normalde sabit 400px'e oturur. */
  const chart1Height =
    fullscreenTarget === "1m" ? Math.max(400, viewportH - 70)
    : fullscreenTarget === "both" ? Math.max(360, viewportH - 90)
    : 400;
  const chart5Height =
    fullscreenTarget === "5m" ? Math.max(400, viewportH - 70)
    : fullscreenTarget === "both" ? Math.max(360, viewportH - 90)
    : 400;

  /**
   * Ön uyarı: kurulum HENÜZ oluşmadan haber verir. Motorun giriş/çıkış
   * kurallarına dokunmaz — aynı kapı verisini okuyup "ne kadar yakınız"
   * sorusunu yanıtlar. Amaç geç girişi önlemek: tetik mumu kapandığında
   * ekrana yeni bakmaya başlamak yerine zaten hazır olunur.
   */
  const entryAlert = useMemo(
    () =>
      computeEntryAlert(
        data?.engine.gateStatus ?? null,
        data?.engine.regime.side ?? "NONE",
        data?.engine.state ?? "WATCHING",
        data?.engine.action ?? "BEKLE",
      ),
    [data],
  );

  /** Değerlendirilen 1m mumun kapanışına kalan saniye (mumlar dakika başında kapanır) */
  const secondsToClose = nowSec ? 60 - (nowSec % 60) : null;

  /** SPY Option sayfası — Tier 1 (30dk erişim olasılığı) + Tier 5 (edge skoru) grafik üzerinde çizgi olarak */
  const decisionLevelLines = useMemo(() => {
    const dp = data?.decisionPage;
    if (!dp) return undefined;
    const tier1_30 = dp.tier1["30"] ?? [];
    return dp.priceGrid.map((lvl) => {
      const t1 = tier1_30.find((x) => x.price === lvl);
      const edge = dp.tier5.find((x) => x.price === lvl);
      const bestEdge = edge ? Math.max(edge.edgeLong, edge.edgeShort) : 0;
      const color = bestEdge >= 65 ? "#22c55e" : bestEdge >= 45 ? "#eab308" : "#64748b";
      return {
        price: lvl,
        label: `$${lvl} · T%${t1?.touchProbability.toFixed(0) ?? "—"} · Edge${bestEdge}`,
        color,
      };
    });
  }, [data?.decisionPage]);

  // 15m bağlam okuması (ikincil sekme)
  const m15Read = useMemo(() => {
    if (m15.length < 30) return null;
    const closes = m15.map((b) => b.close);
    return {
      ema20: lastNum(ema(closes, 20)),
      ema21: lastNum(ema(closes, 21)),
      rsi: lastNum(rsi(closes, 14)),
      rsiPrev: (() => { const r = rsi(closes, 14); return r.length > 1 ? r[r.length - 2] : null; })(),
      greenOf4: (() => {
        const last4 = m15.slice(-4);
        const g = last4.filter((b) => b.close > b.open).length;
        return `Son ${last4.length} mumun ${g} tanesi yesil`;
      })(),
      macdHist: lastNum(macd(closes).hist),
      bb: (() => {
        const b = bollinger(closes, 20, 2);
        return { u: lastNum(b.upper), m: lastNum(b.mid), l: lastNum(b.lower), pctB: lastNum(b.pctB) };
      })(),
      last: closes[closes.length - 1],
    };
  }, [m15]);

  // Son 6 bar kapanış karşılaştırması — grafik başlığı ok işareti için
  const m15Trend = useMemo<"UP" | "DOWN" | null>(() => {
    if (m15.length < 6) return null;
    const last = m15[m15.length - 1].close;
    const prev = m15[m15.length - 6].close;
    return last > prev ? "UP" : last < prev ? "DOWN" : null;
  }, [m15]);
  const m5Trend = useMemo<"UP" | "DOWN" | null>(() => {
    if (m5.length < 6) return null;
    const last = m5[m5.length - 1].close;
    const prev = m5[m5.length - 6].close;
    return last > prev ? "UP" : last < prev ? "DOWN" : null;
  }, [m5]);

  // ── Sesli + titreşimli ön uyarı ─────────────────────────────────
  // AudioContext yalnızca kullanıcı etkileşiminden sonra ses çalabilir;
  // ilk dokunuşta açılır, sekme dönüşünde yeniden devam ettirilir.
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
      if (kind === "fired") {
        // "Para sesi" — motor GERÇEK bir işlem önerisi verdiğinde ("imminent"
        // ön uyarısından bilinçli olarak farklı ve daha çarpıcı): önce kısa
        // sönümlü bir kasa çanı ("cling"), ardından bozuk para şıngırtısını
        // taklit eden art arda kısa tıklamalar.
        for (const f of [1318.5, 1975.5]) { // E6 + B6 — parlak "cling"
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = f;
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.6);
        }
        [3200, 3800, 3000, 4200, 3500].forEach((f, i) => {
          const at = t0 + 0.12 + i * 0.045;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = f;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.06, at + 0.006);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(at);
          osc.stop(at + 0.06);
        });
      } else {
        const notes = [660, 880];
        for (let i = 0; i < notes.length; i++) {
          const at = t0 + i * 0.16;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = notes[i];
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(at);
          osc.stop(at + 0.17);
        }
      }
    }
    // Tablette ses kapalı olsa bile titreşim uyarısı gelsin.
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "fired" ? [90, 60, 90, 60, 90] : [70, 50, 70]);
    }
  }, []);

  // Uyarı seviyesi DEĞİŞTİĞİNDE bir kez çalar; aynı seviyede tekrar etmez.
  useEffect(() => {
    const key = `${entryAlert.level}:${entryAlert.side ?? ""}`;
    const prev = lastAlertKeyRef.current;
    lastAlertKeyRef.current = key;
    if (prev == null || prev === key || !alertSound || openPosition) return;
    if (entryAlert.level === "FIRED") chime("fired");
    else if (entryAlert.level === "IMMINENT") chime("imminent");
  }, [entryAlert.level, entryAlert.side, alertSound, openPosition, chime]);


  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0e17] p-2 text-slate-300">
      {/* ── Başlık ── */}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-[#eab308]">SPY Engine V8.0</h1>
            <p className="text-[9px] text-slate-500">
              5m ana karar (VWAP+mum formasyonu+hacim+RSI) · 15m yön teyidi (zorunlu kapı) · EMA21 sadece trend bilgisi · ATR-bazlı stop · öncelik sıralı çıkış
            </p>
          </div>

          {data && (
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[20px] font-bold text-slate-100">
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

          <button
            type="button"
            onClick={() => setAlertSound((v) => !v)}
            className={`rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${
              alertSound
                ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                : "border-[#1c2635] bg-[#111827] text-slate-500 hover:bg-[#1c2635]"
            }`}
            title="Kurulum yaklaştığında sesli + titreşimli uyarı (tarayıcı sesi ilk dokunuştan sonra açar)"
          >
            {alertSound ? "🔔 UYARI AÇIK" : "🔕 UYARI KAPALI"}
          </button>

          <button
            type="button"
            onClick={() => { setShowTickerStrip((v) => !v); setShowCharts((v) => !v); }}
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 text-[10px] font-semibold text-slate-400 transition-colors hover:bg-[#1c2635]"
            title="Fiyat şeridi ve grafikleri tek tuşla katla/aç"
          >
            ⛶ ODAK
          </button>

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

      {/* ── Sekmeler ── */}
      <nav className="mb-2 flex gap-0.5 overflow-x-auto">
        {([
          ["command", "Kumanda Merkezi"],
          ["spyoption", "SPY Option"],
          ["forecast", "Daily Forecast"],
          ["compare", "15m vs 5m"],
          ["signals", "Sinyaller & Arşiv"],
          ["context", "15m Bağlam & Veri"],
          ["ohlc", "15 Gün OHLC"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 whitespace-nowrap rounded-t border-b-2 px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
              tab === id
                ? "border-[#eab308] bg-[#111827] text-slate-100"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ═══ DAILY FORECAST ═══ */}
      {tab === "forecast" && <DailyForecast />}

      {/* ═══ KUMANDA MERKEZİ ═══ */}
      {tab === "command" && (
        <div className="flex flex-col gap-1">
          {/* ── Rejim (TREND/SIKIŞMA) + Gün Kapanış Tahmini yan yana — tahmin daha belirgin ── */}
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2 lg:items-stretch">
            <RegimeBanner block={data?.regime ?? null} nowSec={nowSec} />
            <ForecastPanel forecast={data?.forecast ?? null} accuracy={forecastAccuracy} actualClose={actualCloseForForecast} />
          </div>

          <AlertBanner
            alert={entryAlert}
            secondsToClose={secondsToClose}
            stateLabel={data?.engine.stateLabel ?? "VERİ BEKLENİYOR"}
            nextStep={data?.engine.nextStep ?? "Motor verisi bekleniyor."}
            inPosition={!!openPosition}
          />


          {data?.engine.veto && <M15Strip veto={data.engine.veto} />}

          {/* ── Fiyat Şeridi + Bilgi Kartları — tam genişlik, gizlenebilir ── */}
          <div className="overflow-hidden rounded border border-[#1c2635]">
            <button
              type="button"
              onClick={() => setShowTickerStrip((v) => !v)}
              className="flex w-full items-center justify-between bg-[#111827] px-2 py-1 text-left"
            >
              <span className="text-[9px] font-medium text-slate-500">Piyasa Şeridi &amp; Bilgi Kartları</span>
              <span className="text-[9px] text-slate-500">{showTickerStrip ? "▲ gizle" : "▼ göster"}</span>
            </button>
            {showTickerStrip && (
              <div className="flex flex-col gap-1 p-1">
                <TickerStrip quotes={quotes} updatedAt={quotesAt} />
                <InfoCards spot={data?.spot ?? null} lastFetch={lastFetch} phase={data?.session.phase ?? "CLOSED"} />
              </div>
            )}
          </div>

          {/* ── 1m + 5m grafikleri yan yana — gizlenebilir ── */}
          <div className={`${SURFACE} overflow-hidden`} ref={chartWrapRef}>
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#1c2635] px-2 py-1">
              <button
                type="button"
                onClick={() => setShowCharts((v) => !v)}
                className="text-[10px] font-semibold tracking-wide text-slate-300"
              >
                15m / 5m Grafikleri {showCharts ? "▲ gizle" : "▼ göster"}
              </button>
              <div className="flex flex-wrap items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setToggles((t) => ({ ...t, candleType: t.candleType === "HA" ? "NORMAL" : "HA" }))}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                    toggles.candleType === "HA" ? "bg-[#0e7490] text-white" : "bg-[#111827] text-slate-400 hover:bg-[#1c2635]"
                  }`}
                >
                  {toggles.candleType === "HA" ? "HA" : "Normal"}
                </button>
                {([
                  ["bb", "BB"], ["ema21", "EMA21"], ["vwap", "VWAP"], ["volume", "VOL"],
                  ["rsi", "RSI"], ["macd", "MACD"], ["markers", "SİN"], ["levels", "SEV"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
                    className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${
                      toggles[key] ? "bg-[#1c2635] text-slate-200" : "bg-[#111827] text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAutoScroll((a) => !a)}
                  className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${
                    autoScroll ? "bg-[#1c2635] text-slate-200" : "bg-[#111827] text-slate-600"
                  }`}
                  title="Yeni mum geldikçe sağa kaydır"
                >
                  ⟳
                </button>
                {manualModeSince != null && nowSec > 0 && (
                  <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] text-amber-300">
                    manuel · {Math.max(0, 90 - (nowSec - manualModeSince))}sn
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => enterFullscreen(chartWrapRef.current)}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                    fullscreenTarget === "both" ? "bg-[#eab308]/20 text-[#eab308]" : "bg-[#111827] text-slate-400 hover:bg-[#1c2635]"
                  }`}
                  title="1m ve 5m grafiklerini birlikte tam ekran göster"
                >
                  {fullscreenTarget === "both" ? "⤡ ÇIK" : "⤢ İKİSİ"}
                </button>
              </div>
            </div>

            {showCharts && (
              <div className="grid grid-cols-1 gap-0.5 lg:grid-cols-2">
                <div ref={chart1WrapRef} className="border-b border-[#1c2635] bg-[#0a0e17] lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between border-b border-[#1c2635] px-2 py-1">
                    <span className="flex items-center gap-1.5 text-[9px] text-slate-500">
                      15m — mum teyit
                      {m15Trend && (
                        <span className={`text-[13px] font-bold leading-none ${m15Trend === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                          {m15Trend === "UP" ? "↑" : "↓"}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => enterFullscreen(chart1WrapRef.current)}
                      className="rounded bg-[#111827] px-1.5 py-0.5 text-[9px] text-slate-400 transition-colors hover:bg-[#1c2635]"
                      title="Yalnızca 15m grafiğini tam ekran göster"
                    >
                      {fullscreenTarget === "1m" ? "⤡ ÇIK" : "⤢"}
                    </button>
                  </div>
                  <SpyChart
                    bars={m15}
                    timeframe="15m"
                    events={events}
                    position={openPosition}
                    toggles={toggles}
                    height={chart1Height}
                    autoScroll={autoScroll}
                    defaultWindowMin={480}
                    levelLines={data?.levels?.lines}
                    trendDirection={m15Trend}
                  />
                </div>
                <div ref={chart5WrapRef} className="bg-[#0a0e17]">
                  <div className="flex items-center justify-between border-b border-[#1c2635] px-2 py-1">
                    <span className="flex items-center gap-1.5 text-[9px] text-slate-500">
                      5m — kurulum motoru
                      {m5Trend && (
                        <span className={`text-[13px] font-bold leading-none ${m5Trend === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                          {m5Trend === "UP" ? "↑" : "↓"}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => enterFullscreen(chart5WrapRef.current)}
                      className="rounded bg-[#111827] px-1.5 py-0.5 text-[9px] text-slate-400 transition-colors hover:bg-[#1c2635]"
                      title="Yalnızca 5m grafiğini tam ekran göster"
                    >
                      {fullscreenTarget === "5m" ? "⤡ ÇIK" : "⤢"}
                    </button>
                  </div>
                  <SpyChart
                    bars={m5.length ? m5 : bucketAggregate(m1, 5)}
                    timeframe="5m"
                    events={events}
                    position={openPosition}
                    toggles={toggles}
                    height={chart5Height}
                    autoScroll={autoScroll}
                    levelLines={data?.levels?.lines}
                    defaultWindowMin={120}
                    trendDirection={m5Trend}
                  />
                </div>
              </div>
            )}

            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-[#1c2635] px-2 py-1 font-mono text-[8px] text-slate-600">
              <span>Kaynak: {data?.dataSource.primary ?? "—"}</span>
              {data?.dataSource.overnight && <span className="text-sky-400">+ overnight</span>}
              {!!data?.dataSource.sanitized && (
                <span className="text-amber-400/80" title="Bozuk print atıldı">
                  {data.dataSource.sanitized} bozuk
                </span>
              )}
              <span>Kapalı: 1m:{data?.lastClosed.m1 ? nyClock(data.lastClosed.m1) : "—"} 5m:{data?.lastClosed.m5 ? nyClock(data.lastClosed.m5) : "—"}</span>
            </div>
          </div>

          {/* ── Kapı Durumu — V8.0 giriş kapısı: 5m ana karar skoru + 15m yön teyidi + hacim vetosu ── */}
          <GatePanel gates={data?.engine.gateStatus ?? null} />

          {/* ── Çıkış Takibi — her zaman gösterilir, pozisyon yoksa placeholder ── */}
          <ExitGatePanel reversal={data?.reversalCatch ?? null} />

          {/* ── Motor Durumu + Pozisyon (sol) + Rejim Kriterleri/Seviye/Motor Açıklaması/Sinyaller (sağ) ── */}
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
            <div className="flex flex-col gap-1">
              {data && (
                <LayerTable
                  veto={data.engine.veto} volumeVeto={data.engine.volumeVeto}
                  layer1={data.engine.layer1}
                  layer3={data.engine.layer3}
                  regime={data.engine.regime}
                  action={data.engine.action} contractType={data.engine.contractType}
                  state={data.engine.state} stateLabel={data.engine.stateLabel} nextStep={data.engine.nextStep}
                  confidence={data.engine.confidence} confidenceParts={data.engine.confidenceParts}
                />
              )}
              <PositionPanel position={openPosition} livePremium={openPosition?.lastPremium ?? null} />
              <PositionSizeCard
                positions={positions}
                spot={data?.spot.price ?? null}
                stopSpy={data?.engine.stopSpy ?? null}
                nowMinutesEt={nowSec ? nyParts(nowSec).minutes : null}
              />
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
            <div className="flex flex-col gap-1">
              <RegimePanel block={data?.regime ?? null} />
              <LevelPanel levels={data?.levels ?? null} price={data?.spot.price ?? null} />
              <Panel title="Motor Açıklaması">
                <div className="rounded border border-[#1c2635] bg-[#0a0e17] p-1 font-mono text-[9px] leading-relaxed text-slate-400">
                  <span className="text-[#3b82f6]">{lastFetch ? nyClock(lastFetch, true) : "—"}</span> — {data?.engine.reasoning ?? "Motor verisi bekleniyor."}
                </div>
              </Panel>
              <Panel title="Oturum Sinyal Geçmişi" right={<span className="font-mono text-[9px] text-slate-600">{events.length}</span>}>
                <EventList events={events} emptyText="Sinyal yok." />
              </Panel>
            </div>
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

          {/* Kabul Kriterleri (V8.0) — sayfanın en altı, varsayılan kapalı */}
          <Disclosure title="Kabul Kriterleri (V8.0)">
            <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-[10px] leading-relaxed text-slate-400 marker:text-slate-600">
              <li>5m ANA KARAR: VWAP konumu (birincil, 35 puan) + mum formasyonu (yutan mum/çekiç/yıldız/iç mum/kırılım+retest/başarısız kırılım/hacim doruğu/düşük-hacim-kırılımı, en güçlüsü 30 puan) + hacim anomalisi (son 10×5m ortalamasına göre, 20 puan) + RSI(14) yönü (15 puan) = 100 taban; EMA21 aynı yöndeyse +10 bilgi bonusu.</li>
              <li>Skor ≥ 60 (SETUP_FIRE_THRESHOLD) olunca giriş adayı üretilir — 30m yok, tek bir katı VE-kapısı yok; ağırlıklı puanlama, eski modelden çok daha sık tetiklenir.</li>
              <li>15m YÖN + TEYİT zorunlu bir kapıdır, tetik değil: 15m VWAP (birincil) + EMA21 (ikincil) konumu 5m sinyalle AYNI yönde olmalı — aksi halde skor eşiği geçse bile giriş üretilmez.</li>
              <li>EMA21(5m) tek başına karar vermez/engellemez — sadece skora +10 bonus verir (kullanıcı kuralı).</li>
              <li>Hacim vetosu (çok-günlü RVOL &lt; 0.8) iki yönü de engelleyen ayrı bir ikili bloktur — 5m ana karar skorundan bağımsız, ek bir güvenlik katmanı. RVOL verisi yetersizse (&lt;5 gün geçmiş) veto hiç tetiklenmez.</li>
              <li>Stop her zaman 15m yapısından: Stop_SPY = son geçerli 15m dip/tepe ∓ (çarpan)×ATR_15m. Çarpan dinamik: normal 0,25 · yüksek oynaklık (VIX≥25 veya ATR ort. 1,5x üstü) 0,40 · veri/FOMC günü 0,50. Her kapanan 15m barda yeniden hesaplanır (trailing yapı stopu) — giriş mantığından bağımsız bir risk kuralı, değişmedi.</li>
              <li>Hedef (Take-Profit) = 1,5R: Hedef_SPY = giriş ± 1,5×risk mesafesi; Hedef_prim delta ile çevrilir. Hedef gelince (hızlı geldiyse bile) hemen kapatılır; 15:45 zorunlu kapama mutlaktır.</li>
              <li>Risk yönetimi: işlem başı %3–4 ($150–200), günlük tavan %8 (~$400 = 2 stop), günde max 1–2 işlem. VIX filtresi ve haber/veri günü filtresi işlem öncesi bir kez kontrol edilir.</li>
              <li>SL/TP Hesaplayıcı (SPY Option sekmesi altı): vade + strike seçilince canlı SPY, 15m/5m ATR(14), Black-Scholes delta ve prim ile Stop_SPY, Stop_prem (+0,10), Hedef (1,5R), R:R ve kontrat sayısını hesaplar; 0–5DTE opsiyon zinciri her 15m kapanışında yenilenir.</li>
              <li>Giriş penceresi 09:45–15:00 ET; 15:45 ET zorunlu 0DTE kapaması diğer tüm çıkış kurallarından ÖNCELİKLİDİR ve mutlaktır.</li>
              <li>Çıkış önceliği (hızdan yavaşa): 5m EMA21 zıt kesişim (anlık) → 5m RSI dönüşü + 1m ters mum (kapalı bar) → 15m yapı stopu (anlık, mum içi en kötü seviye; swing/ATR verisi henüz yoksa sabit −%28 prim güvenlik ağı) → trailing kilit (kapalı bar).</li>
              <li>Trailing kilit +%40 kârda tabanı breakeven&apos;e, +%50 kârda daha yükseğe çeker; taban asla geri inmez.</li>
              <li>Strike seçimi artık 5m ana karar skoruna göre: skor ≥85 → Süper Güçlü (Kontrat S, ATM+2); ≥70 → Güçlü (Kontrat A, ATM+1); ≥60 (eşik) → Orta (Kontrat B, ATM). Hepsi 0DTE.</li>
              <li>Aynı anda tek pozisyon; kapanıştan sonra düzeltme mumu beklenir; saatte en fazla 3 giriş; aynı kontrata (strike+yön) aynı gün ikinci giriş engellenir.</li>
              <li>3 ardışık kayıp sonrası 15 dakika sinyal durdurma çalışıyor (spot PnL&apos;e dayalı, prim verisinden bağımsız).</li>
              <li>Kapı Durumu paneli LONG/SHORT için: 15m yön teyidi, hacim vetosu, 5m ana karar skorunun bileşenleri (VWAP/formasyon/hacim/RSI/EMA21) ve acil çıkış çakışması kontrolünü tek listede gösteriyor.</li>
              <li>Motor Durumu paneli 5m ana karar ve 15m yön teyidini ayrı satırlarda, gerçek rolleriyle etiketliyor (30m yok).</li>
              <li>Hiçbir karar oluşmakta olan (kapanmamış) muma dayanmıyor — non-repainting, tüm fonksiyonlar saf.</li>
            </ol>
            <div className="mt-2 border-t border-[#1c2635] pt-2 text-[9px] text-slate-600">
              V7.0 → V8.0 (22 Eyl 2026): mimari yeniden tersine döndü — 30m açılış rejimi 2 gün boyunca hiç işlem üretmeyen aşırı katı bir kapı olduğu için TAMAMEN KALDIRILDI. 5m yeniden ANA KARAR (VWAP+mum formasyonu+hacim+RSI, ağırlıklı puanlama), 15m ZORUNLU YÖN TEYİDİ (VWAP birincil, EMA21 ikincil/bilgi). Stop mekaniği (Stop_SPY, 15m yapı) değişmedi.
            </div>
          </Disclosure>
        </div>
      )}

      {/* ═══ SPY OPTION SAYFASI (gerçek zamanlı 15m tetik + 5m zamanlama sinyal motoru, tasks/active/014) ═══ */}
      {tab === "spyoption" && (
        <SpyOptionLiveTab
          bars5m={m5.length ? m5 : bucketAggregate(m1, 5)}
          events={events}
          openPosition={openPosition}
          toggles={toggles}
          autoScroll={autoScroll}
        />
      )}

      {/* ═══ SİNYALLER & ARŞİV ═══ */}
      {tab === "signals" && (
        <SignalsArchive positions={positions} sessionDate={data?.session.date ?? null} />
      )}

      {/* ═══ 15m BAĞLAM ═══ */}
      {tab === "context" && (
        <div className="flex flex-col gap-1">
          <div className={`${SURFACE} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-[#1c2635] px-2 py-1">
              <span className="text-[10px] font-semibold tracking-wide text-slate-300">15m Grafik — yön/rejim (ikincil)</span>
              <span className="text-[9px] text-slate-600">Karar mekanizmasının parçası değil</span>
            </div>
            <SpyChart
              bars={m15}
              timeframe="15m"
              events={events}
              position={openPosition}
              toggles={{ ...toggles, markers: false, levels: false }}
              height={380}
              autoScroll={autoScroll}
              defaultWindowMin={480}
            />
          </div>

          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
            <Panel title="15m Gösterge Okuması">
              {!m15Read ? (
                <div className="text-[11px] text-slate-600">15m verisi yetersiz.</div>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px]">
                  {[
                    ["Son kapanış", num(m15Read.last)],
                    ["EMA20", num(m15Read.ema20)],
                    ["EMA21", num(m15Read.ema21)],
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
              <div className="flex flex-col gap-1 text-[10px] text-slate-400">
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

      {/* ═══ 15m vs 5m KARŞILAŞTIRMA ═══ */}
      {tab === "compare" && (
        <div className="flex flex-col gap-1">
          <RegimeBanner block={data?.regime ?? null} nowSec={nowSec} />
          <AlertBanner
            alert={entryAlert}
            secondsToClose={secondsToClose}
            stateLabel={data?.engine.stateLabel ?? "VERİ BEKLENİYOR"}
            nextStep={data?.engine.nextStep ?? "Motor verisi bekleniyor."}
            inPosition={!!openPosition}
          />
          <div className="grid grid-cols-2 gap-1">
            <div className={`${SURFACE} overflow-hidden`}>
              <div className="border-b border-[#1c2635] px-2 py-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300">
                  15m — Mum Teyit
                  {m15Trend && (
                    <span className={`text-[14px] font-bold leading-none ${m15Trend === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {m15Trend === "UP" ? "↑" : "↓"}
                    </span>
                  )}
                </span>
              </div>
              <SpyChart
                bars={m15}
                timeframe="15m"
                events={events}
                position={openPosition}
                toggles={toggles}
                height={420}
                autoScroll={autoScroll}
                defaultWindowMin={480}
                levelLines={data?.levels?.lines}
                trendDirection={m15Trend}
              />
            </div>
            <div className={`${SURFACE} overflow-hidden`}>
              <div className="border-b border-[#1c2635] px-2 py-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300">
                  5m — Kurulum Motoru
                  {m5Trend && (
                    <span className={`text-[14px] font-bold leading-none ${m5Trend === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {m5Trend === "UP" ? "↑" : "↓"}
                    </span>
                  )}
                </span>
              </div>
              <SpyChart
                bars={m5.length ? m5 : bucketAggregate(m1, 5)}
                timeframe="5m"
                events={events}
                position={openPosition}
                toggles={toggles}
                height={420}
                autoScroll={autoScroll}
                levelLines={data?.levels?.lines}
                defaultWindowMin={120}
                trendDirection={m5Trend}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══ 15 GÜN OHLC ═══ */}
      {tab === "ohlc" && (
        <div className="flex flex-col gap-1">
          <OHLCTable data={ohlcData} loading={ohlcLoading} />
        </div>
      )}

      <div className="mt-2 text-center font-mono text-[8px] text-slate-700">
        yoklama {pollMs / 1000}sn · {m1.length} × 1m mum yüklü · son yanıt{" "}
        {lastFetch ? `${nyClock(lastFetch, true)} ET` : "—"}
      </div>
    </div>
  );
}
