"use client";

/**
 * SPY Engine V3.1 — kumanda merkezi panelleri.
 * Ticker şeridi, bilgi kartları, pozisyon kutusu ve strateji şeması.
 *
 * Ortak kural: bir değer null ise "—" veya "veri yok" yazılır; hiçbir
 * kartta tahmini/son-bilinen değer gerçek veri gibi gösterilmez.
 */

import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { nyClock, type SessionPhase } from "@/lib/spyengine/core";
import {
  REGIME_LABEL, regimeColor,
  type Regime, type RegimeDirection, type RegimeCheck,
} from "@/lib/spyengine/regime";
import {
  EVENT_LABEL, EVENT_STYLE, CONTRACT_RULES, CONTRACT_TONE,
  EXIT_REVERSAL_BARS, ENTRY_STREAK, MAX_ENTRIES_PER_HOUR,
  type PositionState, type EngineEvent, type StreakDir, type Direction,
  type ContractType, type ConfidencePart, type EngineState, type GateStatus,
  type GateCheck, type Side,
} from "@/lib/spyengine/strategy";

// ── Ortak küçük parçalar ──────────────────────────────────────────

export const SURFACE = "bg-[#0f141d] border border-[#1c2635] rounded-lg";

export function num(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function signed(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${num(v, d)}`;
}

export function tone(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-[#22c55e]";
  if (v < 0) return "text-[#ef4444]";
  return "text-slate-400";
}

export function Panel({ title, right, children, className = "" }: {
  title: string; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`${SURFACE} ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-2">
        <h2 className="text-[11px] font-semibold tracking-wide text-slate-300">{title}</h2>
        {right}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** Açılır/kapanır bölüm — talimattaki "okunaklı açılır gizlenir" gereksinimi */
export function Disclosure({ title, badge, defaultOpen = false, children }: {
  title: string; badge?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={SURFACE}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[#141b26]"
      >
        <span className="flex items-center gap-2">
          <span className={`text-[10px] text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          <span className="text-[11px] font-semibold tracking-wide text-slate-300">{title}</span>
          {badge}
        </span>
        <span className="text-[10px] text-slate-600">{open ? "gizle" : "aç"}</span>
      </button>
      {open && <div className="border-t border-[#1c2635] p-3">{children}</div>}
    </section>
  );
}

// ── Ticker şeridi ─────────────────────────────────────────────────

export interface StripQuote {
  label: string; symbol: string; name: string;
  price: number | null; prevClose: number | null;
  change: number | null; changePct: number | null;
  time: number | null; extended: boolean; error: string | null;
}

export function TickerStrip({ quotes, updatedAt }: { quotes: StripQuote[]; updatedAt: number | null }) {
  // Şerit kabı overflow-hidden/overflow-x-auto olduğu için popup absolute
  // konumlandırılırsa kırpılıyor. Bu yüzden popup fixed konumlandırılır ve
  // hedef hücrenin ekran koordinatından hesaplanır.
  const [hover, setHover] = useState<{ idx: number; rect: DOMRect } | null>(null);
  const [chartData, setChartData] = useState<Record<string, MiniBar[]>>({});
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Fare hücreden popup'a geçerken aradaki boşlukta popup kapanmasın diye
  // kapanış geciktirilir; popup'ın üstüne girilince iptal edilir.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHover(null), 160);
  };
  useEffect(() => cancelClose, []);

  const hoverSymbol = hover ? quotes[hover.idx]?.symbol ?? null : null;

  useEffect(() => {
    if (!hoverSymbol || chartData[hoverSymbol]) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/spyengine/v2/ticker-sparkline?symbol=${encodeURIComponent(hoverSymbol)}`);
        const json = await res.json();
        if (cancelled) return;
        setChartData((prev) => ({ ...prev, [hoverSymbol]: json.ok ? json.bars ?? [] : [] }));
      } catch {
        if (!cancelled) setChartData((prev) => ({ ...prev, [hoverSymbol]: [] }));
      }
    })();
    return () => { cancelled = true; };
  }, [hoverSymbol, chartData]);

  // Popup ölçülüp ekran içine sığdırılır — hiçbir kenarı dışarı taşmaz.
  useLayoutEffect(() => {
    if (!hover || !popRef.current) { setPos(null); return; }
    const el = popRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 8;

    let left = hover.rect.left;
    if (left + w + M > vw) left = hover.rect.right - w;
    left = Math.min(Math.max(M, left), Math.max(M, vw - w - M));

    let top = hover.rect.bottom + M;
    if (top + h + M > vh) top = hover.rect.top - h - M;
    top = Math.min(Math.max(M, top), Math.max(M, vh - h - M));

    setPos({ top, left });
  }, [hover, chartData]);

  const hq = hover ? quotes[hover.idx] : null;

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Canlı Piyasa Şeridi</span>
        <span className="font-mono text-[10px] text-slate-600">
          {updatedAt ? `${nyClock(updatedAt, true)} ET` : "veri bekleniyor"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-px bg-[#1c2635] [grid-template-columns:repeat(auto-fit,minmax(104px,1fr))]">
          {quotes.map((q, idx) => {
            const up = (q.changePct ?? 0) > 0;
            const down = (q.changePct ?? 0) < 0;
            return (
              <div
                key={q.symbol}
                className="cursor-pointer bg-[#0f141d] px-2.5 py-1.5 transition-colors hover:bg-[#1c2635]"
                onMouseEnter={(e) => { cancelClose(); setHover({ idx, rect: e.currentTarget.getBoundingClientRect() }); }}
                onMouseLeave={scheduleClose}
              >
                <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
                  <span className="truncate text-[10px] font-semibold text-slate-300">{q.label}</span>
                  {q.extended && <span className="shrink-0 text-[8px] text-amber-400/80">EXT</span>}
                </div>
                {q.error || q.price == null ? (
                  <div className="font-mono text-[10px] text-slate-600">veri yok</div>
                ) : (
                  <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
                    <span className="font-mono text-[11px] tabular-nums text-slate-100">{num(q.price, q.price > 1000 ? 0 : 2)}</span>
                    <span className={`shrink-0 font-mono text-[9.5px] tabular-nums ${tone(q.changePct)}`}>
                      {up ? "▲" : down ? "▼" : "▬"}{signed(q.changePct, 2)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover popup — şerit kabının dışında, fixed; kırpılmaz */}
      {hq && (
        <div
          ref={popRef}
          className="fixed z-[9999] w-[320px] rounded-lg border border-[#2d3748] bg-[#0a0e17] p-3 shadow-2xl"
          style={{
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? "visible" : "hidden",
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="mb-2 flex items-start justify-between gap-3 border-b border-[#1c2635] pb-2">
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold text-slate-200">{hq.name}</div>
              <div className="text-[10px] text-slate-500">{hq.symbol}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-[13px] font-bold text-slate-100">
                {num(hq.price, hq.price != null && hq.price > 1000 ? 0 : 2)}
              </div>
              <div className={`font-mono text-[11px] font-semibold ${tone(hq.changePct)}`}>
                {signed(hq.change, 2)} ({signed(hq.changePct, 2)}%)
              </div>
            </div>
          </div>

          <MiniCandles bars={chartData[hq.symbol]} />

          <div className="mb-3 mt-2 grid grid-cols-2 gap-2 text-[9px]">
            <div>
              <div className="text-slate-500">Önceki Kapanış</div>
              <div className="font-mono text-slate-300">{hq.prevClose != null ? num(hq.prevClose) : "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">Seans Tipi</div>
              <div className="text-slate-300">{hq.extended ? "Seans Dışı" : "Düzenli"}</div>
            </div>
          </div>

          <a
            href={`/global/tr/graphic/${encodeURIComponent(hq.symbol)}`}
            className="block rounded bg-[#1d4ed8] px-3 py-2 text-center text-[10px] font-semibold text-white transition-colors hover:bg-[#1e40af]"
          >
            Detay Grafik
          </a>
        </div>
      )}
    </div>
  );
}

// ── Bilgi kartları ────────────────────────────────────────────────

export interface SpotStats {
  price: number | null; priceTime: number | null;
  prevClose: number | null; change: number | null; changePct: number | null;
  rthHigh: number | null; rthLow: number | null;
  preHigh: number | null; preLow: number | null;
  sessionHigh: number | null; sessionLow: number | null;
  rangePct: number | null; vwap: number | null; atr14: number | null;
  volume: number; rthVolume: number; barCount: number;
  lastBarTime: number | null; date: string;
}

const PHASE_LABEL: Record<SessionPhase, string> = {
  PRE: "Premarket (04:00–09:30 ET)",
  RTH: "Düzenli Seans (09:30–16:00 ET)",
  POST: "Afterhours (16:00–20:00 ET)",
  CLOSED: "Piyasa Kapalı",
};

const PHASE_TONE: Record<SessionPhase, string> = {
  PRE: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  RTH: "bg-green-500/15 text-green-300 border-green-500/25",
  POST: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  CLOSED: "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

export function PhaseBadge({ phase }: { phase: SessionPhase }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${PHASE_TONE[phase]}`}>
      {PHASE_LABEL[phase]}
    </span>
  );
}

function Card({ label, value, sub, tone: t }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="bg-[#0f141d] px-2.5 py-1.5">
      <div className="text-[9px] font-semibold tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono text-[13px] font-semibold leading-tight ${t ?? "text-slate-100"}`}>{value}</div>
      {sub != null && <div className="truncate font-mono text-[9.5px] leading-tight text-slate-500">{sub}</div>}
    </div>
  );
}

export function InfoCards({ spot, lastFetch, phase }: {
  spot: SpotStats | null; lastFetch: number | null; phase: SessionPhase;
}) {
  if (!spot) {
    return (
      <div className={`${SURFACE} px-3 py-4 text-[12px] text-slate-500`}>SPY verisi bekleniyor…</div>
    );
  }
  const dir =
    spot.changePct == null ? "—" : spot.changePct > 0 ? "YUKARI ▲" : spot.changePct < 0 ? "AŞAĞI ▼" : "YATAY ▬";

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="grid grid-cols-2 gap-px bg-[#1c2635] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Card
          label="SPY FİYAT"
          value={spot.price == null ? "veri yok" : `$${num(spot.price)}`}
          sub={spot.priceTime ? `${nyClock(spot.priceTime, true)} ET` : "zaman yok"}
        />
        <Card
          label="GÜNLÜK DEĞİŞİM"
          value={spot.changePct == null ? "—" : `${signed(spot.changePct)}%`}
          sub={spot.change == null ? "önceki kapanış yok" : `${signed(spot.change)} $ · önc. ${num(spot.prevClose)}`}
          tone={tone(spot.changePct)}
        />
        <Card label="YÖN" value={dir} sub={PHASE_LABEL[phase]} tone={tone(spot.changePct)} />
        <Card
          label="ZİRVE / DİP (SEANS)"
          value={`${num(spot.sessionHigh)} / ${num(spot.sessionLow)}`}
          sub={spot.rangePct == null ? "aralık yok" : `aralıkta %${num(spot.rangePct, 0)} konumda`}
        />
        <Card
          label="RTH ZİRVE / DİP"
          value={`${num(spot.rthHigh)} / ${num(spot.rthLow)}`}
          sub={
            spot.preHigh == null
              ? "premarket verisi yok"
              : `pre ${num(spot.preHigh)} / ${num(spot.preLow)}`
          }
        />
        <Card
          label="SON GÜNCELLEME"
          value={lastFetch ? nyClock(lastFetch, true) : "—"}
          sub={`${spot.barCount} mum · ${spot.lastBarTime ? nyClock(spot.lastBarTime) : "—"} son mum`}
        />
        <Card label="VWAP" value={spot.vwap == null ? "veri yok" : num(spot.vwap)} sub="seans içi kümülatif" />
        <Card label="ATR(14) 1m" value={spot.atr14 == null ? "veri yok" : num(spot.atr14, 3)} sub="ortalama gerçek aralık" />
        <Card
          label="HACİM (SEANS)"
          value={spot.volume ? Math.round(spot.volume).toLocaleString("tr-TR") : "—"}
          sub={`RTH ${spot.rthVolume ? Math.round(spot.rthVolume).toLocaleString("tr-TR") : "—"}`}
        />
        <Card
          label="AÇILIŞA GÖRE"
          value={
            spot.rthLow == null || spot.rthHigh == null || spot.price == null
              ? "—"
              : `${num(spot.price - (spot.rthLow + spot.rthHigh) / 2)}`
          }
          sub="RTH orta noktaya uzaklık"
        />
        <Card label="SEANS TARİHİ" value={spot.date} sub="New York takvimi" />
        <Card
          label="ÖNCEKİ KAPANIŞ"
          value={spot.prevClose == null ? "veri yok" : num(spot.prevClose)}
          sub="Yahoo chartPreviousClose"
        />
      </div>
    </div>
  );
}

// ── İki katman okuması (V3: 1m ana sürücü, 5m destek — 15m karara girmez) ──

function LayerRow({ tf, tag, value, note, t, arrow }: {
  tf: string; tag: string; value: string; note: string; t: string; arrow?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[58px_1fr] items-start gap-2 border-b border-[#1c2635] px-3 py-1.5 last:border-0">
      <div>
        <div className="text-[11px] font-semibold text-slate-200">{tf}</div>
        <div className="text-[9px] text-slate-600">{tag}</div>
      </div>
      <div>
        <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${t}`}>
          <span>{value}</span>
          {arrow}
        </div>
        <div className="text-[9.5px] leading-snug text-slate-500">{note}</div>
      </div>
    </div>
  );
}

/** Talimat §7 kabul kriteri: güven skoru kara kutu olmamalı, bileşenleri görülebilmeli */
function ConfidenceBreakdown({ parts, total }: { parts: ConfidencePart[]; total: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[#1c2635] px-3 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left transition-colors hover:opacity-80"
      >
        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
          <span className={`text-[8px] text-slate-600 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          Güven Skoru Dökümü
        </span>
        <span className="font-mono text-[12px] font-bold text-slate-200">{total}/100</span>
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-0.5">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-slate-500">{p.label}</span>
              <span className={p.value > 0 ? "text-[#22c55e]" : p.value < 0 ? "text-[#ef4444]" : "text-slate-500"}>
                {p.value >= 0 ? "+" : ""}{p.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Durumun görsel kimliği — teknik kod yerine insan diliyle */
const STATE_STYLE: Record<EngineState, { dot: string; ring: string; text: string; icon: string }> = {
  WATCHING:    { dot: "bg-slate-500",  ring: "border-slate-600/40 bg-slate-700/25",   text: "text-slate-300",  icon: "👁" },
  ARMED:       { dot: "bg-amber-400",  ring: "border-amber-500/30 bg-amber-500/10",   text: "text-amber-300",  icon: "⏳" },
  TRIGGERED:   { dot: "bg-green-400",  ring: "border-green-500/35 bg-green-500/15",   text: "text-green-300",  icon: "🎯" },
  IN_POSITION: { dot: "bg-sky-400",    ring: "border-sky-500/35 bg-sky-500/15",       text: "text-sky-300",    icon: "📈" },
};

/**
 * KAPI DURUMU — el ile işlem açarken veto listesi.
 * Motor kendi sinyalini üretmese bile "şu an LONG/SHORT açsam hangi kapı
 * geçer, hangisi geçmez" burada tek bakışta görülür.
 */
/**
 * Kapı sırasına birebir denk kısa etiketler. Sıra `gateChecksFor` ile
 * aynıdır (gövde, kapanış yeri, hacim, 1m RSI, 5m mum, 5m RSI); iki sütun
 * yan yana sığsın diye kısaltıldı, tam metin `title` olarak durur.
 */
export const GATE_SHORT = ["Gövde", "Kapanış yeri", "Hacim", "1m RSI", "5m mum", "5m RSI"];

/** Bir yönün o anki duruşu — hem sütun başlığı hem ön uyarı bunu kullanır. */
export interface SideStanding {
  side: Side;
  /** Geçen kapı sayısı (mum serisi dahil) */
  passed: number;
  /** Toplam kapı sayısı (mum serisi dahil) */
  total: number;
  /** Bu yön için daha kaç aynı yönlü 1m mum kapanışı gerekiyor */
  barsNeeded: number;
  /** Şu an bu yönde biriken seri uzunluğu */
  streakHave: number;
  /** Kapalı kapıların kısa adları */
  missing: string[];
}

export function standingFor(
  list: GateCheck[], side: Side, streakDir: StreakDir, streakLen: number
): SideStanding {
  const matched = side === "LONG" ? streakDir === "UP" : streakDir === "DOWN";
  const streakHave = matched ? Math.min(streakLen, ENTRY_STREAK) : 0;
  const barsNeeded = Math.max(0, ENTRY_STREAK - streakHave);
  const missing = list
    .map((g, i) => ({ g, i }))
    .filter((x) => !x.g.ok)
    .map((x) => GATE_SHORT[x.i] ?? x.g.label);
  return {
    side,
    passed: list.length - missing.length + (barsNeeded === 0 ? 1 : 0),
    total: list.length + 1,
    barsNeeded,
    streakHave,
    missing,
  };
}

// ── Ön uyarı (kurulum oluşmadan haber ver) ────────────────────────

export type AlertLevel = "FIRED" | "IMMINENT" | "NEAR" | "IDLE";

export interface EntryAlert {
  level: AlertLevel;
  side: Side | null;
  standing: SideStanding | null;
}

/**
 * Kurulum HENÜZ oluşmadan haber veren ön uyarı. Motorun giriş/çıkış
 * kurallarına dokunmaz — yalnızca aynı kapı verisini okuyup "ne kadar
 * yakınız" sorusunu yanıtlar, böylece tetik mumu kapandığında hazır
 * olunur (geç giriş insan tepkisinden doğar, kuraldan değil).
 *
 *   FIRED    = motor sinyali verdi (tüm kapılar + seri tamam)
 *   IMMINENT = en fazla 1 mum ve en fazla 1 kapı eksik
 *   NEAR     = en fazla 1 mum eksik ve en fazla 3 kapı kapalı
 */
export function computeEntryAlert(
  gates: GateStatus | null,
  streakDir: StreakDir,
  streakLen: number,
  state: EngineState,
  action: "LONG" | "SHORT" | "BEKLE"
): EntryAlert {
  if (!gates || !gates.long.length) return { level: "IDLE", side: null, standing: null };

  if (state === "TRIGGERED" && action !== "BEKLE") {
    const list = action === "LONG" ? gates.long : gates.short;
    return { level: "FIRED", side: action, standing: standingFor(list, action, streakDir, streakLen) };
  }

  const cands = (["LONG", "SHORT"] as const).map((s) =>
    standingFor(s === "LONG" ? gates.long : gates.short, s, streakDir, streakLen)
  );
  cands.sort((a, b) => b.passed - a.passed || a.barsNeeded - b.barsNeeded);
  const best = cands[0];

  if (best.barsNeeded <= 1 && best.missing.length <= 1) return { level: "IMMINENT", side: best.side, standing: best };
  if (best.barsNeeded <= 1 && best.missing.length <= 3) return { level: "NEAR", side: best.side, standing: best };
  return { level: "IDLE", side: null, standing: best };
}

const ALERT_STYLE: Record<AlertLevel, { ring: string; text: string; icon: string }> = {
  FIRED: { ring: "border-[#eab308]/60 bg-[#eab308]/15", text: "text-[#facc15]", icon: "🎯" },
  IMMINENT: { ring: "border-orange-500/50 bg-orange-500/12", text: "text-orange-300", icon: "⚡" },
  NEAR: { ring: "border-sky-500/35 bg-sky-500/8", text: "text-sky-300", icon: "👀" },
  IDLE: { ring: "border-[#1c2635] bg-[#0f141d]", text: "text-slate-400", icon: "○" },
};

/**
 * Sayfanın en üstündeki durum çubuğu: ne olduğu, ne eksik ve bir sonraki
 * 1m kapanışa kaç saniye kaldığı. Tablette de tek bakışta okunur boyutta.
 */
export function AlertBanner({
  alert, secondsToClose, stateLabel, nextStep, inPosition,
}: {
  alert: EntryAlert;
  secondsToClose: number | null;
  stateLabel: string;
  nextStep: string;
  inPosition: boolean;
}) {
  const st = inPosition
    ? { ring: "border-[#3b82f6]/45 bg-[#3b82f6]/10", text: "text-sky-300", icon: "◆" }
    : ALERT_STYLE[alert.level];
  const s = alert.standing;
  const sideTone =
    alert.side === "LONG" ? "text-[#22c55e]" : alert.side === "SHORT" ? "text-[#ef4444]" : "text-slate-400";

  let headline: string;
  if (inPosition) headline = "POZİSYON AÇIK — çıkış kuralı bekleniyor";
  else if (alert.level === "FIRED") headline = `${alert.side} GİRİŞ SİNYALİ — tüm kapılar açık`;
  else if (alert.level === "IMMINENT")
    headline = `${alert.side} KURULUMU ÇOK YAKIN${
      s && s.barsNeeded > 0 ? ` — 1 mum kaldı` : " — son kapı bekleniyor"
    }`;
  else if (alert.level === "NEAR") headline = `${alert.side} kurulumu yaklaşıyor`;
  else headline = stateLabel;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 ${st.ring}`}>
      <span
        className={`flex items-center gap-2 text-[13px] font-bold tracking-wide sm:text-[15px] ${
          inPosition || alert.level === "IDLE" ? st.text : sideTone
        } ${alert.level === "FIRED" || alert.level === "IMMINENT" ? "animate-pulse" : ""}`}
      >
        <span>{st.icon}</span>
        <span>{headline}</span>
      </span>

      {s && !inPosition && (
        <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
          <span className="rounded bg-[#111827] px-1.5 py-0.5">
            kapı {s.passed}/{s.total}
          </span>
          {s.missing.length > 0 && (
            <span className="text-[#ef4444]/85" title="Kapalı kapılar">
              eksik: {s.missing.join(", ")}
            </span>
          )}
        </span>
      )}

      {secondsToClose != null && (
        <span
          className={`ml-auto rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
            secondsToClose <= 10 ? "bg-orange-500/20 text-orange-300" : "bg-[#111827] text-slate-400"
          }`}
          title="Değerlendirilen 1m mumun kapanışına kalan süre — karar sadece kapalı mumla verilir"
        >
          1m kapanış · {secondsToClose}sn
        </span>
      )}

      <div className="w-full text-[10.5px] leading-snug text-slate-500">{nextStep}</div>
    </div>
  );
}

// ── Kapı tablosu — LONG ve SHORT AYNI ANDA ────────────────────────

function GateColumn({
  side, list, streakDir, streakLen,
}: {
  side: Side; list: GateCheck[]; streakDir: StreakDir; streakLen: number;
}) {
  const st = standingFor(list, side, streakDir, streakLen);
  const allOk = st.passed === st.total;
  const isLong = side === "LONG";
  const accent = isLong ? "#22c55e" : "#ef4444";
  const rows: { label: string; full: string; ok: boolean; detail: string }[] = [
    {
      label: `${ENTRY_STREAK} ardışık mum`,
      full: `${ENTRY_STREAK} ardışık ${isLong ? "yükseliş" : "düşüş"} 1m mumu`,
      ok: st.barsNeeded === 0,
      detail: `${st.streakHave}/${ENTRY_STREAK}`,
    },
    ...list.map((g, i) => ({ label: GATE_SHORT[i] ?? g.label, full: g.label, ok: g.ok, detail: g.detail })),
  ];

  return (
    <div className="min-w-0 flex-1">
      <div
        className="flex items-center justify-between gap-2 px-2.5 py-1.5"
        style={{ backgroundColor: allOk ? `${accent}22` : "transparent" }}
      >
        <span className="text-[12px] font-bold tracking-wide" style={{ color: accent }}>
          {side}
        </span>
        <span className="font-mono text-[11px] font-semibold" style={{ color: allOk ? accent : "#64748b" }}>
          {st.passed}/{st.total}
        </span>
      </div>

      <div className="flex gap-0.5 px-2.5 pb-1">
        {rows.map((r, i) => (
          <span key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: r.ok ? accent : "#1c2635" }} />
        ))}
      </div>

      <div className="px-2.5 pb-1 text-[9.5px] font-semibold" style={{ color: allOk ? accent : "#64748b" }}>
        {allOk ? "tüm kapılar açık" : `${st.total - st.passed} kapı kapalı`}
      </div>

      <div className="px-2.5 pb-2">
        {rows.map((r, i) => (
          <div
            key={i}
            title={r.full}
            className="flex items-center justify-between gap-1.5 border-b border-[#151c28] py-[3px] last:border-0"
          >
            <span className="flex min-w-0 items-center gap-1">
              <span className={r.ok ? "text-[#22c55e]" : "text-[#ef4444]"}>{r.ok ? "✓" : "✕"}</span>
              <span className={`truncate text-[10px] ${r.ok ? "text-slate-300" : "text-slate-500"}`}>{r.label}</span>
            </span>
            <span className={`shrink-0 font-mono text-[10px] ${r.ok ? "text-slate-300" : "text-[#ef4444]"}`}>
              {r.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Kapı Durumu — LONG ve SHORT sütunları YAN YANA. Sekme yok: hangi yönün
 * öne çıktığı sütun başlığındaki sayaçtan (ör. 5/7) tek bakışta görünür,
 * ikisi aynı anda izlenir.
 */
export function GatePanel({
  gates, streakDir = "NONE", streakLen = 0,
}: {
  gates: GateStatus | null; streakDir?: StreakDir; streakLen?: number;
}) {
  if (!gates || !gates.long.length) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Kapı Durumu</div>
        <div className="mt-1 text-[12px] text-slate-500">Mum verisi bekleniyor.</div>
      </div>
    );
  }

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">
          Kapı Durumu{" "}
          <span className="text-[9px] font-normal text-slate-600">· son kapalı 1m mum · iki yön birlikte</span>
        </span>
      </div>
      <div className="flex divide-x divide-[#1c2635]">
        <GateColumn side="LONG" list={gates.long} streakDir={streakDir} streakLen={streakLen} />
        <GateColumn side="SHORT" list={gates.short} streakDir={streakDir} streakLen={streakLen} />
      </div>
    </div>
  );
}

export function LayerTable({
  m5Rsi, m5RsiDirection, m5Note, m1StreakDir, m1StreakLen, m1Note,
  action, contractType, state, stateLabel, nextStep, confidence, confidenceParts,
  m1Rsi, m1RsiPrev, m5RsiPrev,
}: {
  m5Rsi: number | null; m5RsiDirection: Direction; m5Note: string;
  m1StreakDir: StreakDir; m1StreakLen: number; m1Note: string;
  action: "LONG" | "SHORT" | "BEKLE";
  contractType: ContractType | null;
  state: EngineState;
  stateLabel: string;
  nextStep: string;
  confidence: number;
  confidenceParts: ConfidencePart[];
  /** V4 -- RSI yon oklari icin onceki degerler */
  m1Rsi?: number | null;
  m1RsiPrev?: number | null;
  m5RsiPrev?: number | null;
}) {
  const rsiTone = m5RsiDirection === "BULLISH" ? "text-[#22c55e]" : m5RsiDirection === "BEARISH" ? "text-[#ef4444]" : "text-slate-400";
  const streakTone = m1StreakDir === "UP" ? "text-[#22c55e]" : m1StreakDir === "DOWN" ? "text-[#ef4444]" : "text-slate-400";
  const st = STATE_STYLE[state];
  // Kabul kriteri 8: iki RSI'nin yonu celistiginde ayrica vurgula
  const slope = (v?: number | null, p?: number | null) =>
    v == null || p == null ? 0 : v > p + 0.15 ? 1 : v < p - 0.15 ? -1 : 0;
  const s1 = slope(m1Rsi, m1RsiPrev);
  const s5 = slope(m5Rsi, m5RsiPrev);
  const rsiConflict = s1 !== 0 && s5 !== 0 && s1 !== s5;
  const streakValue = m1StreakDir === "NONE" ? "Yok" : `${m1StreakLen} ${m1StreakDir === "UP" ? "▲ yükseliş" : "▼ düşüş"}`;

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Motor Durumu</span>
        {contractType && (
          <span
            className="rounded border px-2 py-0.5 text-[10px] font-bold"
            style={{
              borderColor: `${CONTRACT_TONE[contractType]}55`,
              backgroundColor: `${CONTRACT_TONE[contractType]}22`,
              color: CONTRACT_TONE[contractType],
            }}
          >
            Kontrat {contractType}
          </span>
        )}
      </div>

      {/* Büyük, tek bakışta okunan durum satırı — "ARMED" gibi kod yazmıyoruz */}
      <div className={`m-2 rounded border px-2.5 py-2 ${st.ring}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot} ${state === "TRIGGERED" || state === "IN_POSITION" ? "animate-pulse" : ""}`} />
          <span className={`text-[12px] font-bold tracking-wide ${st.text}`}>
            {st.icon} {stateLabel}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] leading-snug text-slate-300">{nextStep}</div>
      </div>

      <LayerRow
        tf="1m"
        tag="TETİK — girişi bu belirler"
        value={streakValue}
        note={m1Rsi == null ? m1Note : `RSI ${m1Rsi.toFixed(0)} · ${rsiNote(m1Rsi, m1RsiPrev ?? null)}`}
        t={streakTone}
        arrow={<RsiArrow value={m1Rsi ?? null} prev={m1RsiPrev ?? null} />}
      />
      <LayerRow
        tf="5m"
        tag="DESTEK — sinyali iptal edemez"
        value={m5Rsi == null ? "veri yok" : `RSI ${m5Rsi.toFixed(1)}`}
        note={m5Rsi == null ? m5Note : `${rsiNote(m5Rsi, m5RsiPrev ?? null)} · ${m5Note}`}
        t={rsiTone}
        arrow={<RsiArrow value={m5Rsi ?? null} prev={m5RsiPrev ?? null} />}
      />
      {rsiConflict && (
        <div className="mx-2 mb-2 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-300">
          ⚠ 1m ve 5m RSI ters yönde — sahte sinyalin en sık görüldüğü koşul.
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-slate-500">
        <span>Yön: <b className={action === "LONG" ? "text-[#22c55e]" : action === "SHORT" ? "text-[#ef4444]" : "text-slate-300"}>
          {action === "BEKLE" ? "Henüz yok" : action === "LONG" ? "LONG (Call)" : "SHORT (Put)"}
        </b></span>
        <span>Güven: <b className="text-slate-300">{confidence}/100</b></span>
      </div>
      <ConfidenceBreakdown parts={confidenceParts} total={confidence} />
    </div>
  );
}

// ── Pozisyon paneli (talimat §6) ──────────────────────────────────

function Stat({ k, v, t }: { k: string; v: ReactNode; t?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#151c28] py-1 last:border-0">
      <span className="text-[10px] text-slate-500">{k}</span>
      <span className={`font-mono text-[11px] ${t ?? "text-slate-200"}`}>{v}</span>
    </div>
  );
}

export function PositionPanel({ position, livePremium }: {
  position: PositionState | null; livePremium: number | null;
}) {
  if (!position) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Açık Pozisyon</div>
        <div className="mt-1 text-[12px] text-slate-500">Açık pozisyon yok — motor giriş serisi arıyor.</div>
      </div>
    );
  }

  const prem = livePremium ?? position.lastPremium;
  const pctFromEntry =
    prem != null && position.entryPremium ? ((prem - position.entryPremium) / position.entryPremium) * 100 : null;
  const total = position.realizedPnl + (position.unrealizedPnl ?? 0);
  const rules = CONTRACT_RULES[position.contractType];
  const pg = position.progress;
  const isLong = position.side === "LONG";

  return (
    <div className={SURFACE}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
        <span className="shrink-0 text-[11px] font-semibold tracking-wide text-slate-300">
          {position.status === "OPEN" ? "Açık Pozisyon" : "Son Pozisyon"}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="rounded border px-2 py-0.5 text-[10px] font-bold"
            style={{ borderColor: `${CONTRACT_TONE[position.contractType]}55`, backgroundColor: `${CONTRACT_TONE[position.contractType]}22`, color: CONTRACT_TONE[position.contractType] }}
          >
            {rules.label}
          </span>
          <span
            className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
              isLong
                ? "border-green-500/30 bg-green-500/15 text-green-300"
                : "border-red-500/30 bg-red-500/15 text-red-300"
            }`}
          >
            {isLong ? "LONG GİRİŞ · CALL" : "SHORT GİRİŞ · PUT"}
          </span>
        </div>
      </div>

      <div className="px-3 py-2">
        {position.premiumDataMissing && (
          <div className="mb-2 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-300">
            Bu giriş için 0DTE opsiyon primi verisi Yahoo&apos;dan gelmedi. Giriş/çıkış zamanı ve gerekçesi
            doğru, ama $ kâr/zarar hesaplanamıyor — teorik fiyat üretilmiyor.
          </div>
        )}

        {/* Çıkışa yakınlık — canlı takip için en önemli kutu */}
        {position.status === "OPEN" ? (
          <div className="mb-2 rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-400">Çıkışa yakınlık</span>
              <span className="font-mono text-slate-500">{pg.barsHeld} mum taşındı</span>
            </div>
            <div className="mb-1.5 flex items-center gap-1">
              {Array.from({ length: pg.reversalNeeded }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded ${i < pg.againstBars ? "bg-[#ef4444]" : "bg-[#1c2635]"}`}
                />
              ))}
              <span className="ml-1 font-mono text-[10px] text-slate-400">
                {pg.againstBars}/{pg.reversalNeeded} ters mum
              </span>
            </div>
            <div className="text-[10px] leading-snug text-slate-500">{pg.note}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-600">
              <span>
                5m RSI:{" "}
                <b className={pg.rsiSupportive === true ? "text-[#22c55e]" : pg.rsiSupportive === false ? "text-[#ef4444]" : "text-slate-500"}>
                  {pg.rsiSupportive == null ? "veri yok" : pg.rsiSupportive ? "destekliyor" : "karşı"}
                </b>
                {pg.rsiArmed ? " · dönüş kuralı aktif" : " · dönüş kuralı henüz silahlanmadı"}
              </span>
              {pg.bestSpot != null && (
                <span>En iyi seviye: <b className="text-slate-400">${num(pg.bestSpot)}</b></span>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-2 rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-2">
            <div className="text-[10px] font-semibold text-slate-400">Çıkış gerekçesi</div>
            <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{position.exitNote ?? "—"}</div>
          </div>
        )}

        <Stat k="Kontrat" v={position.contract ?? "—"} />
        <Stat k="Strike / Vade" v={position.strike ? `$${position.strike} · ${position.expiry}` : "—"} />
        <Stat k="Giriş saati" v={`${nyClock(position.entryTime)} ET`} />
        <Stat k="Giriş SPY" v={`$${num(position.entrySpot)}`} />
        <Stat k="Giriş primi" v={position.entryPremium == null ? "veri yok" : `$${num(position.entryPremium)}`} />
        {position.exitTime != null && (
          <>
            <Stat k="Çıkış saati" v={`${nyClock(position.exitTime)} ET`} />
            <Stat k="Çıkış SPY" v={position.exitSpot == null ? "—" : `$${num(position.exitSpot)}`} />
            <Stat k="Çıkış primi" v={position.exitPremium == null ? "veri yok" : `$${num(position.exitPremium)}`} />
          </>
        )}
        <Stat
          k="Anlık prim"
          v={prem == null ? "veri yok" : `$${num(prem)}${pctFromEntry != null ? ` (${signed(pctFromEntry, 1)}%)` : ""}`}
          t={tone(pctFromEntry)}
        />
        <Stat k="Gerçekleşen K/Z" v={`$${signed(position.realizedPnl)}`} t={tone(position.realizedPnl)} />
        <Stat
          k="Açık K/Z"
          v={position.unrealizedPnl == null ? "veri yok" : `$${signed(position.unrealizedPnl)}`}
          t={tone(position.unrealizedPnl)}
        />
        <Stat k="Toplam (kontrat başına)" v={`$${signed(total)}`} t={tone(total)} />
      </div>
    </div>
  );
}

// ── Olay listesi ──────────────────────────────────────────────────

export function EventList({ events, emptyText }: { events: EngineEvent[]; emptyText: string }) {
  if (!events.length) {
    return <div className="text-[12px] italic text-slate-600">{emptyText}</div>;
  }
  return (
    <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
      {[...events].reverse().map((ev) => {
        const st = EVENT_STYLE[ev.kind];
        return (
          <div key={ev.id} className="flex items-start gap-2 rounded bg-[#0a0e17] px-2 py-1.5 font-mono text-[11px]">
            <span className="w-11 shrink-0 text-slate-600">{nyClock(ev.time)}</span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: `${st.color}22`, color: st.color }}
            >
              {st.glyph} {EVENT_LABEL[ev.kind]}
            </span>
            <span className="shrink-0 text-slate-300">
              {ev.premium != null ? `$${num(ev.premium)}` : "prim yok"}
            </span>
            {ev.pnl != null && (
              <span className={`shrink-0 ${tone(ev.pnl)}`}>{signed(ev.pnl)}$</span>
            )}
            <span className="min-w-0 flex-1 truncate text-slate-500" title={ev.note}>{ev.note}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Strateji şeması (V3.1: 1m seri → giriş, sinyal tabanlı çıkış) ──

export function StrategySchema({ state, contractType }: { state: EngineState; contractType: string | null }) {
  const active = (id: string) => {
    if (id === "streak") return state === "ARMED" || state === "TRIGGERED";
    if (id === "a") return contractType === "A";
    if (id === "b") return contractType === "B";
    if (id === "hold") return state === "IN_POSITION";
    return false;
  };
  const box = (id: string) => (active(id) ? "#22c55e" : "#2b3a52");
  const boxFill = (id: string) => (active(id) ? "rgba(34,197,94,0.12)" : "#0f141d");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 980 420" className="h-auto w-full min-w-[780px]" role="img" aria-label="SPY Engine V3.1 strateji akış şeması">
        <defs>
          <marker id="spyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#475569" />
          </marker>
        </defs>

        {/* 1 — Giriş */}
        <text x="14" y="22" fill="#64748b" fontSize="11" fontWeight="600">1 · GİRİŞ KAPISI — hepsi ZORUNLU (biri sağlanmazsa giriş yok)</text>

        <rect x="14" y="34" width="186" height="60" rx="6" fill={boxFill("streak")} stroke={box("streak")} />
        <text x="107" y="55" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">1m · {ENTRY_STREAK}. MUM KAPANIŞI</text>
        <text x="107" y="71" textAnchor="middle" fill="#64748b" fontSize="9">+ MUM PATERNİ: gövde ≥ %50,</text>
        <text x="107" y="85" textAnchor="middle" fill="#64748b" fontSize="9">kapanış yön tarafında ≥ %60</text>

        <path d="M200 64 L222 64" fill="none" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="226" y="34" width="168" height="60" rx="6" fill={boxFill("a")} stroke={box("a")} />
        <text x="310" y="55" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">HACİM</text>
        <text x="310" y="71" textAnchor="middle" fill="#64748b" fontSize="9">tetik mumu &gt; son 15 mum</text>
        <text x="310" y="85" textAnchor="middle" fill="#64748b" fontSize="9">ortalaması</text>

        <path d="M394 64 L416 64" fill="none" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="420" y="34" width="168" height="60" rx="6" fill={boxFill("a")} stroke={box("a")} />
        <text x="504" y="55" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">1m RSI YÖNÜ</text>
        <text x="504" y="71" textAnchor="middle" fill="#64748b" fontSize="9">o yönde hareket ediyor</text>
        <text x="504" y="85" textAnchor="middle" fill="#64748b" fontSize="9">(50 seviyesi ŞARTI YOK)</text>

        <path d="M588 64 L610 64" fill="none" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="614" y="34" width="168" height="60" rx="6" fill={boxFill("a")} stroke={box("a")} />
        <text x="698" y="55" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">5m MUM YÖNÜ</text>
        <text x="698" y="71" textAnchor="middle" fill="#64748b" fontSize="9">son kapalı 5m mum</text>
        <text x="698" y="85" textAnchor="middle" fill="#64748b" fontSize="9">aynı yönde</text>

        <path d="M782 64 L804 64" fill="none" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="808" y="34" width="158" height="60" rx="6" fill={boxFill("a")} stroke={box("a")} />
        <text x="887" y="55" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="700">5m RSI YÖNÜ</text>
        <text x="887" y="71" textAnchor="middle" fill="#94a3b8" fontSize="9">→ LONG / SHORT GİRİŞ</text>
        <text x="887" y="85" textAnchor="middle" fill="#64748b" fontSize="9">saatte en fazla {MAX_ENTRIES_PER_HOUR}</text>

        {/* 2 — Taşıma */}
        <text x="14" y="132" fill="#64748b" fontSize="11" fontWeight="600">2 · TAŞIMA — sabit hedef/stop/süre YOK</text>
        <rect x="14" y="144" width="952" height="46" rx="6" fill={boxFill("hold")} stroke={box("hold")} />
        <text x="34" y="166" fill="#e2e8f0" fontSize="10.5" fontWeight="600">Pozisyon, trend devam ettiği sürece taşınır. Yüzde hedefi, yüzde stopu, süre sınırı ve prim trailing yoktur.</text>
        <text x="34" y="182" fill="#64748b" fontSize="9.5">Hepsi 5 seans üzerinde ölçüldü; her biri net beklentiyi düşürdüğü için eklenmedi.</text>

        {/* 3 — Çıkış */}
        <text x="14" y="220" fill="#64748b" fontSize="11" fontWeight="600">3 · ÇIKIŞ — girişle SİMETRİK yöntem (ilk oluşan kazanır)</text>

        <rect x="14" y="232" width="470" height="72" rx="6" fill="rgba(239,68,68,0.08)" stroke="#7f1d1d" />
        <text x="249" y="252" textAnchor="middle" fill="#f87171" fontSize="11" fontWeight="700">▼ TERS YÖNLÜ ONAY SETİ</text>
        <text x="249" y="270" textAnchor="middle" fill="#94a3b8" fontSize="9.5">{EXIT_REVERSAL_BARS} ardışık TERS 1m mum + GİRİŞİN AYNI KAPI SETİ ters yönde</text>
        <text x="249" y="286" textAnchor="middle" fill="#64748b" fontSize="9">mum paterni · hacim · 1m RSI yönü · 5m mum yönü · 5m RSI yönü</text>
        <text x="249" y="298" textAnchor="middle" fill="#64748b" fontSize="9">çıkış, girişin tam aynasıdır — simetrik yöntem</text>

        <rect x="496" y="232" width="470" height="72" rx="6" fill="rgba(148,163,184,0.06)" stroke="#334155" strokeDasharray="4 3" />
        <text x="731" y="252" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="700">■ 15:45 ET — MUTLAK GÜN SONU KAPAMA</text>
        <text x="731" y="270" textAnchor="middle" fill="#94a3b8" fontSize="9.5">0DTE · diğer tüm kurallardan bağımsız, her zaman öncelikli</text>
        <text x="731" y="288" textAnchor="middle" fill="#64748b" fontSize="9">o saatte açık ne varsa kapatılır</text>

        {/* 4 — Yeniden giriş */}
        <text x="14" y="336" fill="#64748b" fontSize="11" fontWeight="600">4 · YENİDEN GİRİŞ (re-arm)</text>
        <rect x="14" y="348" width="952" height="56" rx="6" fill="#0f141d" stroke="#2b3a52" />
        <text x="34" y="370" fill="#e2e8f0" fontSize="10.5" fontWeight="600">Pozisyon kapandığında sistem, o pozisyonun TERSİNE kapanan İLK 1m mumu görülene kadar yeni aday üretmez.</text>
        <text x="34" y="388" fill="#64748b" fontSize="9.5">Bu &quot;düzeltme mumu&quot; beklemesi + saatlik kota, aynı hareketin ardı ardına sinyal üretmesini engeller — 09:35–15:40 ET boyunca döngü tekrarlar.</text>
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
        {(["ENTRY", "REVERSAL_EXIT", "EOD_EXIT"] as const).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <span style={{ color: EVENT_STYLE[k].color }}>{EVENT_STYLE[k].glyph}</span>
            <span>{EVENT_LABEL[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mini Sparkline Grafik ───────────────────────────────────────

interface MiniBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  ema: number | null;
}

const MINI_W = 296;
const MINI_H = 118;

/** Son 20 günlük 1d mum + EMA50. bars undefined = yükleniyor, [] = veri yok. */
function MiniCandles({ bars }: { bars: MiniBar[] | undefined }) {
  const box = "flex items-center justify-center rounded border border-[#1c2635] bg-[#0b0f18] text-[9px] text-slate-600";

  if (bars === undefined) {
    return <div className={box} style={{ width: MINI_W, height: MINI_H }}>Grafik yükleniyor…</div>;
  }
  if (!bars.length) {
    return <div className={box} style={{ width: MINI_W, height: MINI_H }}>Mum verisi yok</div>;
  }

  const pad = 5;
  const emas = bars.map((b) => b.ema).filter((v): v is number => v != null);
  const min = Math.min(...bars.map((b) => b.low), ...emas);
  const max = Math.max(...bars.map((b) => b.high), ...emas);
  const range = max - min || 1;
  const innerH = MINI_H - pad * 2;
  const y = (v: number) => pad + (1 - (v - min) / range) * innerH;

  const slot = MINI_W / bars.length;
  const bw = Math.max(2, slot * 0.62);

  // EMA50 çizgisi — sadece hesaplanabilmiş noktalar
  const emaPts = bars
    .map((b, i) => (b.ema == null ? null : `${slot * (i + 0.5)},${y(b.ema)}`))
    .filter((p): p is string => p != null)
    .join(" ");

  return (
    <div className="rounded border border-[#1c2635] bg-[#0b0f18]">
      <svg width={MINI_W} height={MINI_H} viewBox={`0 0 ${MINI_W} ${MINI_H}`} className="block">
        {bars.map((b, i) => {
          const cx = slot * (i + 0.5);
          const rise = b.close >= b.open;
          const color = rise ? "#22c55e" : "#ef4444";
          const top = y(Math.max(b.open, b.close));
          const bot = y(Math.min(b.open, b.close));
          return (
            <g key={b.time}>
              <line x1={cx} x2={cx} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth={1} />
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={Math.max(1, bot - top)}
                fill={color}
              />
            </g>
          );
        })}
        {emaPts && (
          <polyline points={emaPts} fill="none" stroke="#eab308" strokeWidth={1.4} strokeLinejoin="round" />
        )}
      </svg>
      <div className="flex items-center justify-between border-t border-[#1c2635] px-2 py-1 text-[8px] text-slate-500">
        <span>son {bars.length} gün · 1d</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-3 bg-[#eab308]" />
          EMA50 {emas.length ? num(emas[emas.length - 1]) : "—"}
        </span>
      </div>
    </div>
  );
}

// ── 15 Günlük OHLC Tablosu ──────────────────────────────────────

export interface OHLCRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function OHLCTable({ data, loading }: { data: OHLCRow[] | null; loading: boolean }) {
  if (loading) {
    return (
      <div className={SURFACE}>
        <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-300">Son 15 Gün OHLC</span>
        </div>
        <div className="p-3 text-center text-[11px] text-slate-600">Yükleniyor...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={SURFACE}>
        <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-300">Son 15 Gün OHLC</span>
        </div>
        <div className="p-3 text-center text-[11px] text-slate-600">Veri yok</div>
      </div>
    );
  }

  return (
    <div className={SURFACE}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Son 15 Gün OHLC</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-[#1c2635]">
              <th className="px-2 py-1.5 text-left font-semibold text-slate-400">Tarih</th>
              <th className="px-2 py-1.5 text-right font-semibold text-slate-400">Açılış</th>
              <th className="px-2 py-1.5 text-right font-semibold text-slate-400">Zirve</th>
              <th className="px-2 py-1.5 text-right font-semibold text-slate-400">Dip</th>
              <th className="px-2 py-1.5 text-right font-semibold text-slate-400">Kapanış</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const change = row.close - row.open;
              const changeTone = change > 0 ? "text-[#22c55e]" : change < 0 ? "text-[#ef4444]" : "text-slate-400";
              return (
                <tr key={i} className="border-b border-[#0f141d] hover:bg-[#0f141d]">
                  <td className="px-2 py-1.5 text-slate-400">{row.date}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-300">{num(row.open)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#22c55e]">{num(row.high)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[#ef4444]">{num(row.low)}</td>
                  <td className={`px-2 py-1.5 text-right font-mono font-semibold ${changeTone}`}>{num(row.close)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── V4: REJİM PANELLERİ ───────────────────────────────────────────

/** RSI yön oku — spec §5: değer tek başına yön anlatmıyor */
export function RsiArrow({ value, prev }: { value: number | null; prev: number | null }) {
  if (value == null || prev == null) return <span className="text-slate-600">—</span>;
  const up = value > prev + 0.15;
  const down = value < prev - 0.15;
  const glyph = up ? "▲" : down ? "▼" : "►";
  const color = up ? "text-[#22c55e]" : down ? "text-[#ef4444]" : "text-slate-500";
  return <span className={`font-mono ${color}`}>{glyph}</span>;
}

/** RSI'ın bölgesel yorumu — "73 ▲ · aşırı alım bölgesine yaklaşıyor" */
export function rsiNote(v: number | null, prev: number | null): string {
  if (v == null) return "veri yok";
  const dir = prev == null ? "" : v > prev + 0.15 ? "yükseliyor" : v < prev - 0.15 ? "zayıflıyor" : "yatay";
  const zone =
    v >= 70 ? "aşırı alım bölgesinde"
    : v >= 60 ? "aşırı alıma yaklaşıyor"
    : v <= 30 ? "aşırı satım bölgesinde"
    : v <= 40 ? "aşırı satıma yaklaşıyor"
    : "nötr bant";
  return `${zone}${dir ? ` · ${dir}` : ""}`;
}

export interface RegimeBlock {
  current: {
    regime: Regime;
    direction: RegimeDirection;
    confidence: number;
    trendChecks: RegimeCheck[];
    chopChecks: RegimeCheck[];
    timePrior: number;
    timePriorNote: string;
    note: string;
  };
  transitions: { time: number; from: Regime; to: Regime; confidence: number }[];
  distribution: Record<Regime, number>;
  cooldownUntil: number | null;
  cooldownActive: boolean;
}

/**
 * Rejim bandı — spec §1: "büyük, renkli, tartışmasız görünür".
 * Ayrıca §7.4'ün strateji hatırlatması ve §7.2'nin soğuma uyarısı burada.
 */
export function RegimeBanner({ block, nowSec }: { block: RegimeBlock | null; nowSec: number }) {
  if (!block) {
    return (
      <div className={`${SURFACE} px-3 py-2 text-[12px] text-slate-500`}>Rejim verisi bekleniyor…</div>
    );
  }
  const { regime, direction, confidence, note } = block.current;
  const color = regimeColor(regime, direction);
  const label = REGIME_LABEL[regime];
  const arrow = regime === "TREND" ? (direction === "DOWN" ? "▼" : "▲") : regime === "CHOP" ? "≈" : "?";

  const reminder =
    regime === "TREND"
      ? "Trend modu — pozisyonu erken kapatma, kırılım sinyalini bekle"
      : regime === "CHOP"
      ? "Sıkışma modu — hızlı al-sat, 15 dk üstü taşıma yok"
      : "Belirsiz — yeni giriş üretilmiyor, sistem sadece izliyor";

  const lastTransition = block.transitions[block.transitions.length - 1] ?? null;
  const fresh = lastTransition != null && nowSec > 0 && nowSec - lastTransition.time < 300;

  const cooldownLeft =
    block.cooldownActive && block.cooldownUntil != null && nowSec > 0
      ? Math.max(0, Math.ceil((block.cooldownUntil - nowSec) / 60))
      : null;

  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{ borderColor: `${color}66`, backgroundColor: `${color}14` }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-2 text-[18px] font-bold tracking-wide sm:text-[22px]" style={{ color }}>
          <span>{arrow}</span>
          <span>
            {label}
            {regime === "TREND" && ` ${direction === "DOWN" ? "AŞAĞI" : "YUKARI"}`}
          </span>
        </span>

        <span className="rounded px-2 py-0.5 font-mono text-[11px] font-semibold" style={{ backgroundColor: `${color}22`, color }}>
          güven %{confidence}
        </span>

        {fresh && lastTransition && (
          <span className="animate-pulse rounded border border-[#eab308]/50 bg-[#eab308]/15 px-2 py-0.5 text-[11px] font-bold text-[#facc15]">
            ⚡ REJİM DEĞİŞTİ: {REGIME_LABEL[lastTransition.from]} → {REGIME_LABEL[lastTransition.to]} ·{" "}
            {regime === "CHOP" ? "çıkış modu hızlandırıldı" : "çıkış modu gevşetildi"}
          </span>
        )}

        {cooldownLeft != null && (
          <span className="rounded border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300">
            ⛔ 3 ardışık kayıp — {cooldownLeft} dk sinyal durduruldu
          </span>
        )}

        <span className="ml-auto text-[10.5px] text-slate-400">{reminder}</span>
      </div>
      <div className="mt-1 text-[10.5px] leading-snug text-slate-500">{note}</div>
    </div>
  );
}

function RegimeColumn({ title, checks, passed, accent }: {
  title: string; checks: RegimeCheck[]; passed: number; accent: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <span className="text-[11px] font-bold tracking-wide" style={{ color: accent }}>{title}</span>
        <span className="font-mono text-[11px] font-semibold" style={{ color: accent }}>
          {passed}/{checks.length}
        </span>
      </div>
      <div className="flex gap-0.5 px-2.5 pb-1">
        {checks.map((c, i) => (
          <span key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: c.ok ? accent : "#1c2635" }} />
        ))}
      </div>
      <div className="px-2.5 pb-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center justify-between gap-1.5 border-b border-[#151c28] py-[3px] last:border-0">
            <span className="flex min-w-0 items-center gap-1">
              <span className={c.ok ? "text-[#22c55e]" : "text-[#ef4444]"}>{c.ok ? "✓" : "✕"}</span>
              <span className={`truncate text-[10px] ${c.ok ? "text-slate-300" : "text-slate-500"}`} title={c.label}>{c.label}</span>
            </span>
            <span className={`shrink-0 font-mono text-[10px] ${c.ok ? "text-slate-300" : "text-[#ef4444]"}`}>{c.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rejim kriter dökümü — spec §1.3: rejim kara kutu olmamalı */
export function RegimePanel({ block }: { block: RegimeBlock | null }) {
  if (!block || !block.current.trendChecks.length) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Rejim Kriterleri</div>
        <div className="mt-1 text-[12px] text-slate-500">Yeterli mum yok (en az 35 kapalı 1m mum).</div>
      </div>
    );
  }
  const { trendChecks, chopChecks, timePrior, timePriorNote } = block.current;
  const tp = trendChecks.filter((c) => c.ok).length;
  const cp = chopChecks.filter((c) => c.ok).length;
  const total = block.distribution.TREND + block.distribution.CHOP + block.distribution.UNCERTAIN || 1;

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">
          Rejim Kriterleri <span className="text-[9px] font-normal text-slate-600">· son 25 mum · iki hipotez birlikte</span>
        </span>
      </div>
      <div className="flex divide-x divide-[#1c2635]">
        <RegimeColumn title="TREND" checks={trendChecks} passed={tp} accent="#22c55e" />
        <RegimeColumn title="SIKIŞMA" checks={chopChecks} passed={cp} accent="#f59e0b" />
      </div>

      <div className="border-t border-[#1c2635] px-3 py-1.5 text-[9.5px] text-slate-500">
        Saat dilimi önseli: <b className={timePrior > 0 ? "text-[#22c55e]" : timePrior < 0 ? "text-[#ef4444]" : "text-slate-400"}>
          {timePrior > 0 ? `+${timePrior}` : timePrior}
        </b>{" "}
        · {timePriorNote}
      </div>

      {/* Gün özeti — spec §7.3 */}
      <div className="border-t border-[#1c2635] px-3 py-1.5">
        <div className="mb-1 text-[9.5px] font-semibold text-slate-500">Bugünkü rejim dağılımı</div>
        <div className="flex h-2 overflow-hidden rounded">
          <span style={{ width: `${(block.distribution.TREND / total) * 100}%`, backgroundColor: "#22c55e" }} />
          <span style={{ width: `${(block.distribution.CHOP / total) * 100}%`, backgroundColor: "#f59e0b" }} />
          <span style={{ width: `${(block.distribution.UNCERTAIN / total) * 100}%`, backgroundColor: "#475569" }} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[9.5px] text-slate-500">
          <span className="text-[#22c55e]">TREND %{((block.distribution.TREND / total) * 100).toFixed(0)}</span>
          <span className="text-[#f59e0b]">SIKIŞMA %{((block.distribution.CHOP / total) * 100).toFixed(0)}</span>
          <span>BELİRSİZ %{((block.distribution.UNCERTAIN / total) * 100).toFixed(0)}</span>
          <span className="text-slate-600">{total} mum</span>
        </div>
      </div>

      {block.transitions.length > 0 && (
        <div className="border-t border-[#1c2635] px-3 py-1.5">
          <div className="mb-1 text-[9.5px] font-semibold text-slate-500">Son rejim geçişleri</div>
          <div className="flex flex-col gap-0.5">
            {block.transitions.slice(-5).reverse().map((t) => (
              <div key={t.time} className="flex items-center gap-2 font-mono text-[9.5px] text-slate-500">
                <span className="w-10 shrink-0 text-slate-600">{nyClock(t.time)}</span>
                <span>{REGIME_LABEL[t.from]} → <b className="text-slate-300">{REGIME_LABEL[t.to]}</b></span>
                <span className="text-slate-600">güven %{t.confidence}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 15m bağlam şeridi — spec §6: SADECE BİLGİ.
 * Motor mantığına girmez; V3'te 15m'nin kapı olarak kullanılması fırsatları
 * geciktirmişti, o hata tekrarlanmıyor.
 */
export function M15Strip({ direction, note, rsi, rsiPrev, greenOf4 }: {
  direction: Direction; note: string; rsi: number | null; rsiPrev: number | null; greenOf4: string;
}) {
  const tone15 = direction === "BULLISH" ? "#22c55e" : direction === "BEARISH" ? "#ef4444" : "#94a3b8";
  const word = direction === "BULLISH" ? "▲ YUKARI" : direction === "BEARISH" ? "▼ AŞAĞI" : "▬ YATAY";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[#1c2635] bg-[#0f141d] px-3 py-1.5 text-[10.5px]">
      <span className="font-semibold text-slate-500">15m GENEL TREND</span>
      <span className="font-bold" style={{ color: tone15 }}>{word}</span>
      <span className="font-mono text-slate-400">
        RSI {rsi == null ? "—" : rsi.toFixed(0)} <RsiArrow value={rsi} prev={rsiPrev} />
      </span>
      <span className="text-slate-500">{greenOf4}</span>
      <span className="text-slate-600">{note}</span>
      <span className="ml-auto text-[9px] text-slate-600">karar mekanizmasına girmez — yalnızca bağlam</span>
    </div>
  );
}
