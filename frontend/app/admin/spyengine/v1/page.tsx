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
import SignalsArchive from "@/components/admin/spyengine/SignalsArchive";
import {
  TickerStrip, InfoCards, LayerTable, GatePanel, PositionPanel, EventList, StrategySchema,
  AlertBanner, computeEntryAlert,
  RegimeBanner, RegimePanel, M15Strip, type RegimeBlock,
  LevelPanel, ForecastPanel,
  Panel, Disclosure, PhaseBadge, OHLCTable, SURFACE, num, signed, tone,
  type StripQuote, type SpotStats, type OHLCRow,
} from "@/components/admin/spyengine/panels";
import {
  fromCompact, nyClock, bucketAggregate, bollinger, rsi, macd, ema, lastNum,
  type Bar, type SessionInfo, type CompactBar,
} from "@/lib/spyengine/core";
import type {
  EngineEvent, PositionState, StreakDir, ContractType, ConfidencePart, Direction, EngineState, GateStatus,
} from "@/lib/spyengine/strategy";
import type { LevelRead, CloseForecast } from "@/lib/spyengine/levels";

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
  gateStatus: GateStatus;
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
}

type Tab = "command" | "signals" | "context" | "ohlc" | "compare";

const POLL_OPTIONS = [1000, 2000, 5000, 15000];

/** Grafiği elle incelerken (zoom/pan) otomatik takibin duraklama süresi */
const MANUAL_PAUSE_MS = 90000;

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

  /** 1m/5m grafik yükseklikleri — tam ekranda viewport'a, normalde sabit 320px'e oturur. */
  const chart1Height =
    fullscreenTarget === "1m" ? Math.max(400, viewportH - 70)
    : fullscreenTarget === "both" ? Math.max(360, viewportH - 90)
    : 320;
  const chart5Height =
    fullscreenTarget === "5m" ? Math.max(400, viewportH - 70)
    : fullscreenTarget === "both" ? Math.max(360, viewportH - 90)
    : 320;

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
        data?.engine.m1StreakDir ?? "NONE",
        data?.engine.m1StreakLen ?? 0,
        data?.engine.state ?? "WATCHING",
        data?.engine.action ?? "BEKLE",
      ),
    [data],
  );

  /** V4 -- RSI yon oklari icin son iki deger (istemcide, ayni core fonksiyonuyla) */
  const rsiPair = useMemo(() => {
    const r1 = rsi(m1.map((b) => b.close), 14);
    const r5 = rsi(m5.map((b) => b.close), 14);
    return {
      m1: r1.length ? r1[r1.length - 1] : null,
      m1Prev: r1.length > 1 ? r1[r1.length - 2] : null,
      m5Prev: r5.length > 1 ? r5[r5.length - 2] : null,
    };
  }, [m1, m5]);

  /** Değerlendirilen 1m mumun kapanışına kalan saniye (mumlar dakika başında kapanır) */
  const secondsToClose = nowSec ? 60 - (nowSec % 60) : null;

  // 15m bağlam okuması (ikincil sekme)
  const m15Read = useMemo(() => {
    if (m15.length < 30) return null;
    const closes = m15.map((b) => b.close);
    return {
      ema20: lastNum(ema(closes, 20)),
      ema50: lastNum(ema(closes, 50)),
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
      const notes = kind === "fired" ? [880, 1175, 1568] : [660, 880];
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
            <h1 className="text-[15px] font-semibold tracking-tight text-[#eab308]">SPY Engine V4</h1>
            <p className="text-[9px] text-slate-500">
              Rejim farkında: giriş V3.3 kapısı (değişmedi) · çıkış rejime göre uyarlanır
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
          ["compare", "1m vs 5m"],
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

      {/* ═══ KUMANDA MERKEZİ ═══ */}
      {tab === "command" && (
        <div className="flex flex-col gap-1">
          <RegimeBanner block={data?.regime ?? null} nowSec={nowSec} />

          <AlertBanner
            alert={entryAlert}
            secondsToClose={secondsToClose}
            stateLabel={data?.engine.stateLabel ?? "VERİ BEKLENİYOR"}
            nextStep={data?.engine.nextStep ?? "Motor verisi bekleniyor."}
            inPosition={!!openPosition}
          />

          {m15Read && (
            <M15Strip
              direction={data?.engine.m15Direction ?? "NEUTRAL"}
              note={data?.engine.m15Note ?? ""}
              rsi={m15Read.rsi}
              rsiPrev={m15Read.rsiPrev}
              greenOf4={m15Read.greenOf4}
            />
          )}

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
              <div className="grid grid-cols-1 gap-1 p-1 lg:grid-cols-2 lg:items-stretch">
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
                1m / 5m Grafikleri {showCharts ? "▲ gizle" : "▼ göster"}
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
                  ["bb", "BB"], ["ema50", "EMA50"], ["vwap", "VWAP"], ["volume", "VOL"],
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
                    <span className="text-[9px] text-slate-500">1m — hassas tetik</span>
                    <button
                      type="button"
                      onClick={() => enterFullscreen(chart1WrapRef.current)}
                      className="rounded bg-[#111827] px-1.5 py-0.5 text-[9px] text-slate-400 transition-colors hover:bg-[#1c2635]"
                      title="Yalnızca 1m grafiğini tam ekran göster"
                    >
                      {fullscreenTarget === "1m" ? "⤡ ÇIK" : "⤢"}
                    </button>
                  </div>
                  <SpyChart
                    bars={m1}
                    timeframe="1m"
                    events={events}
                    position={openPosition}
                    toggles={toggles}
                    height={chart1Height}
                    autoScroll={autoScroll}
                    levelLines={data?.levels?.lines}
                  />
                </div>
                <div ref={chart5WrapRef} className="bg-[#0a0e17]">
                  <div className="flex items-center justify-between border-b border-[#1c2635] px-2 py-1">
                    <span className="text-[9px] text-slate-500">5m — kurulum motoru</span>
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

          {/* ── Kapı Durumu (sol) + Rejim Kriterleri (sağ) ── */}
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
            <GatePanel
              gates={data?.engine.gateStatus ?? null}
              streakDir={data?.engine.m1StreakDir ?? "NONE"}
              streakLen={data?.engine.m1StreakLen ?? 0}
            />
            <RegimePanel block={data?.regime ?? null} />
          </div>

          {/* ── Teknik veri (sol) + Seviye/Tahmin (sağ) ── */}
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
            <div className="flex flex-col gap-1">
              {data && (
                <LayerTable
                  m5Rsi={data.engine.m5Rsi} m5RsiDirection={data.engine.m5RsiDirection} m5Note={data.engine.m5Note}
                  m1StreakDir={data.engine.m1StreakDir} m1StreakLen={data.engine.m1StreakLen} m1Note={data.engine.m1Note}
                  action={data.engine.action} contractType={data.engine.contractType}
                  state={data.engine.state} stateLabel={data.engine.stateLabel} nextStep={data.engine.nextStep}
                  confidence={data.engine.confidence} confidenceParts={data.engine.confidenceParts}
                  m1Rsi={rsiPair.m1} m1RsiPrev={rsiPair.m1Prev} m5RsiPrev={rsiPair.m5Prev}
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
            <div className="flex flex-col gap-1">
              <LevelPanel levels={data?.levels ?? null} price={data?.spot.price ?? null} />
              <ForecastPanel forecast={data?.forecast ?? null} accuracy={forecastAccuracy} />
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
        </div>
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

      {/* ═══ 1m vs 5m KARŞILAŞTIRMA ═══ */}
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
                <span className="text-[10px] font-semibold text-slate-300">1m — Hassas Tetik</span>
              </div>
              <SpyChart
                bars={m1}
                timeframe="1m"
                events={events}
                position={openPosition}
                toggles={toggles}
                height={420}
                autoScroll={autoScroll}
                levelLines={data?.levels?.lines}
              />
            </div>
            <div className={`${SURFACE} overflow-hidden`}>
              <div className="border-b border-[#1c2635] px-2 py-1">
                <span className="text-[10px] font-semibold text-slate-300">5m — Kurulum Motoru</span>
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
