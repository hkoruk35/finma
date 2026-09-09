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
import type { LevelRead, LevelRange, CloseForecast } from "@/lib/spyengine/levels";
import {
  EVENT_LABEL, EVENT_STYLE, CONTRACT_RULES, CONTRACT_TONE,
  MAX_ENTRIES_PER_HOUR, EXIT_STOP_PCT,
  type PositionState, type EngineEvent,
  type ContractType, type ConfidencePart, type EngineState, type GateStatus,
  type GateCheck, type Side, type RegimeSide, type RegimeState,
  type M15VetoRead, type VolumeVetoRead, type Layer1Read, type Layer2Read, type Layer3Read,
} from "@/lib/spyengine/strategy";

/** Rejim (5m Layer1+2) etiket ve rengi — eski TREND/SIKIŞMA/BELİRSİZ yerine */
export const REGIME_LABEL: Record<RegimeSide, string> = {
  LONG: "LONG REJİMİ",
  SHORT: "SHORT REJİMİ",
  NONE: "REJİM YOK",
};

export function regimeColor(side: RegimeSide): string {
  if (side === "LONG") return "#22c55e";
  if (side === "SHORT") return "#ef4444";
  return "#64748b";
}

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
  /** Son ~60 dakikaya göre yüzde değişim */
  changePctHour?: number | null;
  time: number | null; extended: boolean; error: string | null;
}

export function TickerStrip({ quotes, updatedAt }: { quotes: StripQuote[]; updatedAt: number | null }) {
  // Popup, konum hesabı VİEWPORT'a göre olan `position: fixed` yerine,
  // burada sahip olduğumuz `wrapRef` (position: relative, transform'suz,
  // overflow'suz) sarmalayıcıya göre `position: absolute` kullanır. Neden:
  // `fixed`, sayfadaki ÜST bir elemanda transform/filter/backdrop-filter
  // varsa (CSS'in "containing block" kuralı gereği) viewport'a değil o
  // elemana göre konumlanır -- bu, popup'ın beklenmedik yerlerde (örn.
  // ekranın en tepesinde) açılmasına yol açabilir. `wrapRef` bizim
  // kontrolümüzde, kesinlikle transform'suz bir kutu olduğu için bu sorunu
  // kökten ortadan kaldırır. Popup yine de bu kutunun DIŞINDA, ayrı bir
  // sibling olarak render edilir ki şeridin overflow-x-auto'su onu kırpmasın.
  const [hover, setHover] = useState<{ idx: number; rect: DOMRect } | null>(null);
  const [chartData, setChartData] = useState<Record<string, MiniBar[]>>({});
  const popRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Fare hücreden ayrılınca popup HEMEN kapanmaz -- 18 sn açık kalır (rahat
  // okumak için) ya da kullanıcı herhangi bir yere tıklayınca hemen kapanır.
  // Popup'ın üstüne tekrar girilirse (fare hücreden popup'a taşınırken)
  // kapanma iptal edilir.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHover(null), 18000);
  };
  useEffect(() => cancelClose, []);

  // Herhangi bir yere tıklayınca popup'ı hemen kapat.
  useEffect(() => {
    if (!hover) return;
    const onClick = () => { cancelClose(); setHover(null); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover != null]);

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

  // Popup, hücrenin HEMEN YANINDA açılır (üstte/altta değil) — böylece
  // fare hücreden popup'a düz bir çizgide taşınabilir. Konum, wrapRef'in
  // (yukarıdaki not) sol-üst köşesine göre hesaplanır; viewport sınırları
  // için hâlâ window.innerWidth/innerHeight kullanılır, sadece sonuç
  // wrapRef'in orijinine göre wrapRef içinde `absolute` konumlanacak
  // şekilde ofsetlenir.
  useLayoutEffect(() => {
    if (!hover || !popRef.current || !wrapRef.current) { setPos(null); return; }
    const el = popRef.current;
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 8;

    let leftAbs = hover.rect.right + M;
    if (leftAbs + w + M > vw) leftAbs = hover.rect.left - w - M;
    leftAbs = Math.min(Math.max(M, leftAbs), Math.max(M, vw - w - M));

    // Hücrenin DİKEY ORTASINA hizala (üst kenarına değil) -- böylece
    // viewport'a sığdırmak için kırpma gerektiğinde bile popup, hangi
    // hücrenin üzerinde durduğuna en yakın konumda kalır, ekranın rastgele
    // bir köşesine "zıplamaz".
    let topAbs = hover.rect.top + hover.rect.height / 2 - h / 2;
    topAbs = Math.min(Math.max(M, topAbs), Math.max(M, vh - h - M));

    setPos({ top: topAbs - wrapRect.top, left: leftAbs - wrapRect.left });
  }, [hover, chartData]);

  const hq = hover ? quotes[hover.idx] : null;

  return (
    <div ref={wrapRef} className="relative">
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Canlı Piyasa Şeridi</span>
        <span className="font-mono text-[10px] text-slate-600">
          {updatedAt ? `${nyClock(updatedAt, true)} ET` : "veri bekleniyor"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-px bg-[#1c2635] [grid-template-columns:repeat(auto-fit,minmax(136px,1fr))]">
          {quotes.map((q, idx) => {
            const up = (q.changePct ?? 0) > 0;
            const down = (q.changePct ?? 0) < 0;
            const hourUp = (q.changePctHour ?? 0) > 0;
            const hourDown = (q.changePctHour ?? 0) < 0;
            return (
              <div
                key={q.symbol}
                className="cursor-pointer bg-[#0f141d] px-2.5 py-1.5 transition-colors hover:bg-[#1c2635]"
                onMouseEnter={(e) => { cancelClose(); setHover({ idx, rect: e.currentTarget.getBoundingClientRect() }); }}
                onMouseLeave={scheduleClose}
              >
                <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
                  <span className="truncate text-[10px] font-semibold text-sky-300">{q.label}</span>
                  {q.extended && <span className="shrink-0 text-[8px] text-amber-400/80">EXT</span>}
                </div>
                {q.error || q.price == null ? (
                  <div className="font-mono text-[10px] text-slate-600">veri yok</div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
                      <span className="font-mono text-[11px] tabular-nums text-slate-100">{num(q.price, q.price > 1000 ? 0 : 2)}</span>
                      <span className={`shrink-0 font-mono text-[9.5px] tabular-nums ${tone(q.changePct)}`}>
                        {up ? "▲" : down ? "▼" : "▬"}{signed(q.changePct, 2)}%
                      </span>
                    </div>
                    {q.changePctHour != null && (
                      <div className="mt-0.5 flex items-baseline justify-between gap-1.5 whitespace-nowrap border-t border-white/5 pt-0.5">
                        <span className="text-[8px] font-medium text-slate-500">1sa</span>
                        <span className={`shrink-0 font-mono text-[9.5px] tabular-nums ${tone(q.changePctHour)}`}>
                          {hourUp ? "▲" : hourDown ? "▼" : "▬"}{signed(q.changePctHour, 2)}%
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>

      {/* Hover popup — wrapRef'e göre absolute, ticker kutusunun DIŞINDA
          bir sibling; şeridin overflow-x-auto'sundan asla kırpılmaz. */}
      {hq && (
        <div
          ref={popRef}
          className="absolute z-[9999] max-h-[80vh] w-[320px] overflow-y-auto rounded-lg border border-[#2d3748] bg-[#0a0e17] p-3 shadow-2xl"
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
    <div className="rounded-md border border-[#1c4753]/50 bg-[#0f2e37] px-2.5 py-2 transition-colors hover:border-[#1c4753]">
      <div className="text-[9px] font-semibold tracking-wider text-sky-300">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold leading-tight ${t ?? "text-slate-100"}`}>{value}</div>
      {sub != null && <div className="mt-0.5 font-mono text-[9.5px] leading-snug text-slate-400">{sub}</div>}
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
    <div className={`${SURFACE} overflow-hidden p-1.5`}>
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(148px,1fr))]">
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
 * geçer, hangisi geçmez" burada tek bakışta görülür. Liste artık dört
 * katmanı birlikte gösterir: 15m veto, 5m trend, 5m filtre, 5m rejim
 * durumu, 1m yapı kırılımı + konfirmasyon (bkz. strategy.ts gateChecksFor).
 */

/** Bir yönün o anki duruşu — hem sütun başlığı hem ön uyarı bunu kullanır. */
export interface SideStanding {
  side: Side;
  passed: number;
  total: number;
  missing: string[];
}

export function standingFor(list: GateCheck[], side: Side): SideStanding {
  const missing = list.filter((g) => !g.ok).map((g) => g.label);
  return { side, passed: list.length - missing.length, total: list.length, missing };
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
 * yakınız" sorusunu yanıtlar.
 *
 *   FIRED    = motor sinyali verdi (1m tetik ateşlendi)
 *   IMMINENT = 5m rejim bu yönde AKTİF — 1m tetik herhangi bir kapalı barda
 *              ateşlenebilir (bekleme yok, sadece zamanlama meselesi)
 *   NEAR     = rejim henüz yok ama bir yönün kapıları çoğunlukla geçti
 */
export function computeEntryAlert(
  gates: GateStatus | null,
  regimeSide: RegimeSide,
  state: EngineState,
  action: "LONG" | "SHORT" | "BEKLE"
): EntryAlert {
  if (!gates || !gates.long.length) return { level: "IDLE", side: null, standing: null };

  if (state === "TRIGGERED" && action !== "BEKLE") {
    const list = action === "LONG" ? gates.long : gates.short;
    return { level: "FIRED", side: action, standing: standingFor(list, action) };
  }

  if (regimeSide !== "NONE") {
    const list = regimeSide === "LONG" ? gates.long : gates.short;
    return { level: "IMMINENT", side: regimeSide, standing: standingFor(list, regimeSide) };
  }

  const cands = (["LONG", "SHORT"] as const).map((s) => standingFor(s === "LONG" ? gates.long : gates.short, s));
  cands.sort((a, b) => b.passed - a.passed);
  const best = cands[0];
  if (best.total > 0 && best.passed / best.total >= 0.6) return { level: "NEAR", side: best.side, standing: best };
  return { level: "IDLE", side: null, standing: best };
}

const ALERT_STYLE: Record<AlertLevel, { ring: string; text: string; icon: string }> = {
  FIRED: { ring: "border-[#eab308]/60 bg-[#eab308]/15", text: "text-[#facc15]", icon: "🎯" },
  IMMINENT: { ring: "border-blue-500/55 bg-blue-600/16", text: "text-blue-300", icon: "⚡" },
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
  else if (alert.level === "FIRED") headline = `${alert.side} GİRİŞ SİNYALİ — 1m tetik ateşlendi`;
  else if (alert.level === "IMMINENT") headline = `${alert.side} REJİMİ AKTİF — 1m tetik herhangi bir barda ateşlenebilir`;
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

      <div className="w-full text-[11px] leading-snug text-slate-300">{nextStep}</div>
    </div>
  );
}

// ── Kapı tablosu — LONG ve SHORT AYNI ANDA ────────────────────────

function GateColumn({
  side, list,
}: {
  side: Side; list: GateCheck[];
}) {
  const st = standingFor(list, side);
  const allOk = st.passed === st.total;
  const isLong = side === "LONG";
  const accent = isLong ? "#22c55e" : "#ef4444";
  const rows: { label: string; full: string; ok: boolean; detail: string }[] = list.map((g) => ({
    label: g.label, full: g.label, ok: g.ok, detail: g.detail,
  }));

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
export function GatePanel({ gates }: { gates: GateStatus | null }) {
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
          <span className="text-[9px] font-normal text-slate-600">
            · 15m veto + 5m trend/filtre + 5m rejim + 1m yapı/konfirmasyon · iki yön birlikte
          </span>
        </span>
      </div>
      <div className="flex divide-x divide-[#1c2635]">
        <GateColumn side="LONG" list={gates.long} />
        <GateColumn side="SHORT" list={gates.short} />
      </div>
    </div>
  );
}

export function LayerTable({
  veto, volumeVeto, layer1, layer2, regime, layer3,
  action, contractType, state, stateLabel, nextStep, confidence, confidenceParts,
}: {
  veto: M15VetoRead;
  volumeVeto: VolumeVetoRead;
  layer1: Layer1Read;
  layer2: Layer2Read;
  regime: RegimeState;
  layer3: Layer3Read;
  action: "LONG" | "SHORT" | "BEKLE";
  contractType: ContractType | null;
  state: EngineState;
  stateLabel: string;
  nextStep: string;
  confidence: number;
  confidenceParts: ConfidencePart[];
}) {
  const st = STATE_STYLE[state];
  const vetoTone = veto.direction === "LONG" ? "text-[#22c55e]" : veto.direction === "SHORT" ? "text-[#ef4444]" : "text-slate-400";
  const regimeTone = regime.side === "LONG" ? "text-[#22c55e]" : regime.side === "SHORT" ? "text-[#ef4444]" : "text-slate-400";
  const l2Best = Math.max(layer2.longPassed, layer2.shortPassed);

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
        tf="15m"
        tag="VETO — yön izni, karar üretmez"
        value={veto.direction === "NEUTRAL" ? "NÖTR" : `${veto.direction} serbest`}
        note={veto.note}
        t={vetoTone}
      />
      <LayerRow
        tf="RVOL"
        tag="HACİM VETOSU — ikisini de engelleyebilir"
        value={volumeVeto.active ? "VETO AKTİF" : volumeVeto.rvol == null ? "veri yok" : `RVOL ${volumeVeto.rvol.toFixed(2)}×`}
        note={volumeVeto.note}
        t={volumeVeto.active ? "text-[#ef4444]" : volumeVeto.rvol == null ? "text-slate-500" : "text-slate-300"}
      />
      <LayerRow
        tf="5m"
        tag="ANA KARAR — trend + filtre (2/3 oy)"
        value={regime.side === "NONE" ? "Rejim yok" : `${regime.side} rejimi aktif`}
        note={`${layer1.note} · ${layer2.note}`}
        t={regimeTone}
      />
      <LayerRow
        tf="1m"
        tag="ZAMANLAMA — sadece rejim aktifken bakılır"
        value={layer3.fired ? "Tetik ateşlendi" : layer3.structureOk ? "Yapı kırıldı, konfirmasyon bekliyor" : "Yapı kırılımı bekleniyor"}
        note={layer3.note}
        t={layer3.fired ? "text-[#22c55e]" : "text-slate-400"}
      />

      {regime.side !== "NONE" && veto.direction !== "NEUTRAL" && veto.direction !== regime.side && (
        <div className="mx-2 mb-2 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-300">
          ⚠ 5m rejim {regime.side} aktif ama 15m veto bu yönü engelliyor — giriş üretilmiyor.
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-slate-500">
        <span>Yön: <b className={action === "LONG" ? "text-[#22c55e]" : action === "SHORT" ? "text-[#ef4444]" : "text-slate-300"}>
          {action === "BEKLE" ? "Henüz yok" : action === "LONG" ? "LONG (Call)" : "SHORT (Put)"}
        </b></span>
        <span>5m filtre: <b className="text-slate-300">{l2Best}/3</b></span>
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

        {/* Çıkışa yakınlık — canlı takip için en önemli kutu (öncelik sırası: EOD > EMA kesişimi > RSI dönüşü > stop > trailing) */}
        {position.status === "OPEN" ? (
          <div className="mb-2 rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-400">Çıkışa yakınlık</span>
              <span className="font-mono text-slate-500">{pg.barsHeld} mum taşındı</span>
            </div>
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
              <span>
                5m EMA21 (ACİL):{" "}
                <b className={pg.emaFavor === true ? "text-[#22c55e]" : pg.emaFavor === false ? "text-[#ef4444]" : "text-slate-500"}>
                  {pg.emaFavor == null ? "veri yok" : pg.emaFavor ? "lehte" : "ALEYHTE — çıkış tetiklenmek üzere"}
                </b>
                {pg.emaGapPct != null && <span className="ml-1 font-mono text-slate-600">({signed(pg.emaGapPct, 2)}%)</span>}
              </span>
              <span>
                5m RSI (NORMAL):{" "}
                <b className={pg.rsiSupportive === true ? "text-[#22c55e]" : pg.rsiSupportive === false ? "text-[#ef4444]" : "text-slate-500"}>
                  {pg.rsiSupportive == null ? "veri yok" : pg.rsiSupportive ? "destekliyor" : "aleyhte"}
                </b>
                {pg.rsi5 != null && <span className="ml-1 font-mono text-slate-600">({pg.rsi5.toFixed(0)})</span>}
              </span>
            </div>
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
              <span>
                Stop eşiği (%{EXIT_STOP_PCT * 100}) — anlık:{" "}
                <b className={tone(pg.premiumPct)}>{pg.premiumPct == null ? "veri yok" : `${signed(pg.premiumPct * 100, 0)}%`}</b>
              </span>
              {pg.trailFloorPct != null && (
                <span>Trailing taban: <b className="text-sky-300">+{(pg.trailFloorPct * 100).toFixed(0)}%</b></span>
              )}
            </div>
            <div className="text-[10px] leading-snug text-slate-500">{pg.note}</div>
            {pg.bestSpot != null && (
              <div className="mt-1 text-[9px] text-slate-600">En iyi seviye: <b className="text-slate-400">${num(pg.bestSpot)}</b></div>
            )}
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

// ── Strateji şeması (V5.0: 15m veto → 5m rejim → 1m zamanlama → çıkış) ──

export function StrategySchema({ state, contractType }: { state: EngineState; contractType: string | null }) {
  const active = (id: string) => {
    if (id === "regime") return state === "ARMED" || state === "TRIGGERED";
    if (id === "a") return contractType === "A";
    if (id === "b") return contractType === "B";
    if (id === "hold") return state === "IN_POSITION";
    return false;
  };
  const box = (id: string) => (active(id) ? "#22c55e" : "#2b3a52");
  const boxFill = (id: string) => (active(id) ? "rgba(34,197,94,0.12)" : "#0f141d");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 980 460" className="h-auto w-full min-w-[780px]" role="img" aria-label="SPY Engine V5.0 strateji akış şeması">
        <defs>
          <marker id="spyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#475569" />
          </marker>
        </defs>

        {/* 0 — 15m Veto + RVOL Vetosu */}
        <text x="14" y="22" fill="#64748b" fontSize="11" fontWeight="600">0 · VETOLAR — yön izni / katılım izni, karar üretmez</text>
        <rect x="14" y="34" width="466" height="40" rx="6" fill="#0f141d" stroke="#2b3a52" />
        <text x="247" y="58" textAnchor="middle" fill="#e2e8f0" fontSize="10.5" fontWeight="600">15m: LONG yasak &lt; EMA21 · SHORT yasak &gt; EMA21</text>
        <rect x="500" y="34" width="466" height="40" rx="6" fill="rgba(239,68,68,0.06)" stroke="#7f1d1d" />
        <text x="733" y="58" textAnchor="middle" fill="#e2e8f0" fontSize="10.5" fontWeight="600">RVOL &lt; 0.8: İKİ YÖNÜ DE engelleyen ikili veto (oylamaya girmez)</text>

        {/* 1 — 5m Rejim (ana karar) */}
        <text x="14" y="94" fill="#64748b" fontSize="11" fontWeight="600">1 · 5m REJİM (ana karar katmanı) — Layer 1 + Layer 2 birlikte gerekli</text>

        <rect x="14" y="106" width="466" height="72" rx="6" fill={boxFill("regime")} stroke={box("regime")} />
        <text x="247" y="126" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">LAYER 1 — TREND</text>
        <text x="247" y="144" textAnchor="middle" fill="#94a3b8" fontSize="9.5">Close(5m) vs EMA21 + (RSI14 yönlü VEYA MACD_hist yönlü)</text>
        <text x="247" y="160" textAnchor="middle" fill="#64748b" fontSize="9">kapanmış 5m mum, non-repainting</text>
        <text x="247" y="174" textAnchor="middle" fill="#64748b" fontSize="9">RSI+MACD ikisi de + RVOL&gt;2.0 → Süper (S) · ikisi de → Güçlü (A)</text>

        <rect x="500" y="106" width="466" height="72" rx="6" fill={boxFill("regime")} stroke={box("regime")} />
        <text x="733" y="126" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">LAYER 2 — FİLTRE (3&apos;te 2 oylama)</text>
        <text x="733" y="144" textAnchor="middle" fill="#94a3b8" fontSize="9.5">RVOL ≥ 1.2 (aynı saat dilimi ort.) · Gövde &gt; ATR×0.40 · Karşı gölge &lt; Gövde×0.40</text>
        <text x="733" y="160" textAnchor="middle" fill="#64748b" fontSize="9">en az 2/3 sağlanmalı</text>
        <text x="733" y="174" textAnchor="middle" fill="#64748b" fontSize="9">Layer 1+2 geçerli kaldığı sürece REJİM AKTİF kalır</text>

        {/* 2 — 1m Tetik (zamanlama) */}
        <text x="14" y="204" fill="#64748b" fontSize="11" fontWeight="600">2 · 1m TETİK (zamanlama) — SADECE rejim aktifken, her kapalı barda bağımsız kontrol</text>

        <rect x="14" y="216" width="466" height="68" rx="6" fill="#0f141d" stroke="#2b3a52" />
        <text x="247" y="236" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">STRUCTURE (zorunlu)</text>
        <text x="247" y="254" textAnchor="middle" fill="#94a3b8" fontSize="9.5">Close(1m) vs EMA21(1m) + önceki 2 KAPALI mumun zirve/dip kırılımı</text>
        <text x="247" y="270" textAnchor="middle" fill="#64748b" fontSize="9">structure olmadan sadece RSI/hacimle giriş açılmaz</text>

        <path d="M480 250 L500 250" fill="none" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="500" y="216" width="466" height="68" rx="6" fill="#0f141d" stroke="#2b3a52" />
        <text x="733" y="236" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="700">CONFIRMATION (en az biri) → GİRİŞ</text>
        <text x="733" y="254" textAnchor="middle" fill="#94a3b8" fontSize="9.5">1m RSI7 yönlü VEYA Hacim &gt; ort.×1.3</text>
        <text x="733" y="270" textAnchor="middle" fill="#64748b" fontSize="9">saatte en fazla {MAX_ENTRIES_PER_HOUR} giriş</text>

        {/* 3 — Çıkış */}
        <text x="14" y="312" fill="#64748b" fontSize="11" fontWeight="600">3 · ÇIKIŞ — öncelik sıralı, asimetrik hız (giriş yavaş/konfirmasyonlu, çıkış hızlı)</text>

        <rect x="14" y="324" width="230" height="60" rx="6" fill="rgba(239,68,68,0.1)" stroke="#7f1d1d" />
        <text x="129" y="343" textAnchor="middle" fill="#f87171" fontSize="10.5" fontWeight="700">1 · ACİL</text>
        <text x="129" y="360" textAnchor="middle" fill="#94a3b8" fontSize="9">5m EMA21 zıt yönde kesilirse</text>
        <text x="129" y="374" textAnchor="middle" fill="#64748b" fontSize="8.5">anlık (1m granülerlikte)</text>

        <rect x="252" y="324" width="230" height="60" rx="6" fill="rgba(249,115,22,0.08)" stroke="#7c2d12" />
        <text x="367" y="343" textAnchor="middle" fill="#fb923c" fontSize="10.5" fontWeight="700">2 · NORMAL</text>
        <text x="367" y="360" textAnchor="middle" fill="#94a3b8" fontSize="9">5m RSI yön değiştirirse</text>
        <text x="367" y="374" textAnchor="middle" fill="#64748b" fontSize="8.5">kapanmış 5m bar</text>

        <rect x="490" y="324" width="230" height="60" rx="6" fill="rgba(249,115,22,0.08)" stroke="#7c2d12" />
        <text x="605" y="343" textAnchor="middle" fill="#fb923c" fontSize="10.5" fontWeight="700">3 · STOP</text>
        <text x="605" y="360" textAnchor="middle" fill="#94a3b8" fontSize="9">Prim %{Math.round(-28)} eşiğinde (−%25/−%30)</text>
        <text x="605" y="374" textAnchor="middle" fill="#64748b" fontSize="8.5">anlık, mum içi en kötü seviye</text>

        <rect x="728" y="324" width="238" height="60" rx="6" fill="rgba(56,189,248,0.08)" stroke="#0e5a76" />
        <text x="847" y="343" textAnchor="middle" fill="#38bdf8" fontSize="10.5" fontWeight="700">4 · TRAILING</text>
        <text x="847" y="360" textAnchor="middle" fill="#94a3b8" fontSize="9">Kâr +%40/+%50 sonrası taban yükselir</text>
        <text x="847" y="374" textAnchor="middle" fill="#64748b" fontSize="8.5">kapanmış 5m bar</text>

        <rect x="14" y="396" width="952" height="40" rx="6" fill="rgba(148,163,184,0.06)" stroke="#334155" strokeDasharray="4 3" />
        <text x="490" y="420" textAnchor="middle" fill="#cbd5e1" fontSize="10.5" fontWeight="700">0 (MUTLAK) · 15:45 ET zorunlu 0DTE kapaması — diğer tüm kurallardan önceliklidir</text>
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
        {(["ENTRY", "EMA_CROSS_EXIT", "EOD_EXIT"] as const).map((k) => (
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

/** Son 20 günlük 1d mum + EMA21. bars undefined = yükleniyor, [] = veri yok. */
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

  // EMA21 çizgisi — sadece hesaplanabilmiş noktalar
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
          EMA21 {emas.length ? num(emas[emas.length - 1]) : "—"}
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
  veto: M15VetoRead;
  volumeVeto: VolumeVetoRead;
  layer1: Layer1Read;
  layer2: Layer2Read;
  current: RegimeState;
  cooldownUntil: number | null;
  cooldownActive: boolean;
}

/**
 * Rejim bandı — V5.0 mimarisinin merkezi kutusu: 15m veto + 5m Layer1/2'nin
 * ürettiği REJİM DURUMU (LONG/SHORT/YOK), "büyük, renkli, tartışmasız
 * görünür" (eski TREND/SIKIŞMA piyasa-geneli rejim artık karar üretmiyor —
 * bkz. strategy.ts başlığı).
 */
export function RegimeBanner({ block, nowSec }: { block: RegimeBlock | null; nowSec: number }) {
  if (!block) {
    return (
      <div className={`${SURFACE} px-3 py-2 text-[12px] text-slate-500`}>Rejim verisi bekleniyor…</div>
    );
  }
  const { current, veto, volumeVeto } = block;
  const color = regimeColor(current.side);
  const label = REGIME_LABEL[current.side];
  const arrow = current.side === "LONG" ? "▲" : current.side === "SHORT" ? "▼" : "?";
  const vetoBlocks = current.side !== "NONE" && veto.direction !== "NEUTRAL" && veto.direction !== current.side;

  const reminder =
    volumeVeto.active
      ? `Hacim vetosu aktif — ${volumeVeto.note}`
      : current.side === "NONE"
      ? "Rejim yok — 5m Layer 1 (trend) + Layer 2 (filtre) ikisi de geçmeden yeni giriş üretilmez"
      : vetoBlocks
      ? "15m veto bu yönü engelliyor — rejim aktif ama giriş üretilmiyor"
      : "Rejim aktif — 1m tetik (yapı kırılımı + konfirmasyon) her kapalı barda bağımsız kontrol ediliyor";

  const cooldownLeft =
    block.cooldownActive && block.cooldownUntil != null && nowSec > 0
      ? Math.max(0, Math.ceil((block.cooldownUntil - nowSec) / 60))
      : null;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border px-3 py-2.5 text-center"
      style={{ borderColor: `${color}66`, backgroundColor: `${color}14` }}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-2 text-[18px] font-bold tracking-wide sm:text-[22px]" style={{ color }}>
          <span>{arrow}</span>
          <span>{label}</span>
        </span>

        {vetoBlocks && (
          <span className="rounded px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300" style={{ backgroundColor: "#eab30822" }}>
            15m veto engelliyor
          </span>
        )}

        {volumeVeto.active && (
          <span className="rounded px-2 py-0.5 font-mono text-[11px] font-semibold text-red-300" style={{ backgroundColor: "#ef444422" }}>
            ⛔ Hacim vetosu (RVOL {volumeVeto.rvol?.toFixed(2)}×)
          </span>
        )}

        {cooldownLeft != null && (
          <span className="rounded border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300">
            ⛔ 3 ardışık kayıp — {cooldownLeft} dk sinyal durduruldu
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-slate-300">{reminder}</div>
      <div className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{current.note} · {veto.note}</div>
    </div>
  );
}

function RegimeColumn({ title, checks, passed, accent }: {
  title: string; checks: GateCheck[]; passed: number; accent: string;
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

/** 5m rejim kriter dökümü (Layer 1 + Layer 2) — rejim kara kutu olmamalı */
export function RegimePanel({ block }: { block: RegimeBlock | null }) {
  if (!block || !block.layer2.longVotes.length) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">5m Rejim Kriterleri</div>
        <div className="mt-1 text-[12px] text-slate-500">Yeterli 5m mum yok.</div>
      </div>
    );
  }
  const { layer1, layer2, current } = block;
  const l1Checks: GateCheck[] = [
    { label: "Fiyat EMA21 üstünde (LONG)", ok: layer1.closeAboveEma, detail: layer1.closeAboveEma ? "evet" : "hayır" },
    { label: "RSI14 > 50 ve yükseliyor (LONG)", ok: !!(layer1.rsi != null && layer1.rsi > 50 && layer1.rsiRising), detail: layer1.rsi == null ? "veri yok" : layer1.rsi.toFixed(0) },
    { label: "MACD_hist > 0 ve yükseliyor (LONG)", ok: layer1.macdRising, detail: layer1.macdHist == null ? "veri yok" : layer1.macdHist.toFixed(3) },
  ];
  const l1ChecksShort: GateCheck[] = [
    { label: "Fiyat EMA21 altında (SHORT)", ok: layer1.closeBelowEma, detail: layer1.closeBelowEma ? "evet" : "hayır" },
    { label: "RSI14 < 50 ve düşüyor (SHORT)", ok: !!(layer1.rsi != null && layer1.rsi < 50 && layer1.rsiFalling), detail: layer1.rsi == null ? "veri yok" : layer1.rsi.toFixed(0) },
    { label: "MACD_hist < 0 ve düşüyor (SHORT)", ok: layer1.macdFalling, detail: layer1.macdHist == null ? "veri yok" : layer1.macdHist.toFixed(3) },
  ];
  const tpL = l1Checks.filter((c) => c.ok).length;
  const tpS = l1ChecksShort.filter((c) => c.ok).length;

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">
          5m Rejim Kriterleri <span className="text-[9px] font-normal text-slate-600">· Layer 1 (trend) + Layer 2 (filtre, 2/3 oy)</span>
        </span>
      </div>
      <div className="border-b border-[#1c2635] px-3 py-1.5 text-[9.5px] text-slate-500">
        Rejim durumu: <b className={current.side === "LONG" ? "text-[#22c55e]" : current.side === "SHORT" ? "text-[#ef4444]" : "text-slate-400"}>
          {REGIME_LABEL[current.side]}
        </b>{" "}
        · {current.note}
      </div>
      <div className="flex divide-x divide-[#1c2635]">
        <RegimeColumn title="LAYER 1 · LONG" checks={l1Checks} passed={tpL} accent="#22c55e" />
        <RegimeColumn title="LAYER 1 · SHORT" checks={l1ChecksShort} passed={tpS} accent="#ef4444" />
      </div>
      <div className="flex divide-x divide-[#1c2635] border-t border-[#1c2635]">
        <RegimeColumn title="LAYER 2 · LONG (2/3 yeter)" checks={layer2.longVotes} passed={layer2.longPassed} accent="#22c55e" />
        <RegimeColumn title="LAYER 2 · SHORT (2/3 yeter)" checks={layer2.shortVotes} passed={layer2.shortPassed} accent="#ef4444" />
      </div>
    </div>
  );
}

/**
 * 15m veto şeridi — sadece yön İZNİ, karar üretmez. Eskiden "bilgi amaçlı,
 * motor mantığına girmez" idi; V5.0'da veto GERÇEKTEN karar mekanizmasının
 * parçası (Katman 0) ama yine de kendi başına giriş üretmiyor.
 */
export function M15Strip({ veto }: { veto: M15VetoRead }) {
  const tone15 = veto.direction === "LONG" ? "#22c55e" : veto.direction === "SHORT" ? "#ef4444" : "#94a3b8";
  const word = veto.direction === "LONG" ? "▲ LONG SERBEST" : veto.direction === "SHORT" ? "▼ SHORT SERBEST" : "▬ NÖTR";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[#1c2635] bg-[#0f141d] px-3 py-1.5 text-[10.5px]">
      <span className="font-semibold text-slate-500">15m VETO (Katman 0)</span>
      <span className="font-bold" style={{ color: tone15 }}>{word}</span>
      <span className="font-mono text-slate-400">
        Kapanış {veto.close == null ? "—" : num(veto.close)} / EMA21 {veto.ema21 == null ? "—" : num(veto.ema21)}
      </span>
      <span className="text-slate-600">{veto.note}</span>
      <span className="ml-auto text-[9px] text-slate-600">yalnızca yön izni verir/engeller — kendi başına karar üretmez</span>
    </div>
  );
}

// ── V4: SEVİYE PANELİ ve GÜN KAPANIŞ TAHMİNİ ──────────────────────

function LevelRow({ k, v, sub, tone: t }: { k: string; v: string; sub?: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#151c28] py-1 last:border-0">
      <span className="shrink-0 text-[10px] text-slate-500">{k}</span>
      <span className="min-w-0 text-right">
        <span className={`font-mono text-[11px] ${t ?? "text-slate-200"}`}>{v}</span>
        {sub && <span className="ml-1.5 font-mono text-[9px] text-slate-600">{sub}</span>}
      </span>
    </div>
  );
}

const rng = (r: LevelRange) =>
  r.high == null || r.low == null ? "veri yok" : `${num(r.high)} / ${num(r.low)}`;

/** Seviye Takip Paneli — spec §3. Seviyeler ayrıca grafikte çizgi olarak da var. */
export function LevelPanel({ levels, price }: { levels: LevelRead | null; price: number | null }) {
  if (!levels) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Seviye Takibi</div>
        <div className="mt-1 text-[12px] text-slate-500">Seans verisi bekleniyor.</div>
      </div>
    );
  }
  const s = levels.support, r = levels.resistance;
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">
          Seviye Takibi <span className="text-[9px] font-normal text-slate-600">· grafikte çizgi olarak da var</span>
        </span>
      </div>

      {/* Aktif destek/direnç — panelin en önemli iki satırı */}
      <div className="grid grid-cols-2 gap-px bg-[#1c2635]">
        <div className="bg-[#0f141d] px-2.5 py-1.5">
          <div className="text-[9px] font-semibold tracking-wider text-slate-500">AKTİF DİRENÇ</div>
          <div className="font-mono text-[13px] font-semibold text-[#ef4444]">
            {r ? num(r.price) : "yok"}
          </div>
          <div className="truncate font-mono text-[9px] text-slate-500">
            {r ? `${r.source} · +${num(r.distance)}` : "fiyatın üstünde aday yok"}
          </div>
        </div>
        <div className="bg-[#0f141d] px-2.5 py-1.5">
          <div className="text-[9px] font-semibold tracking-wider text-slate-500">AKTİF DESTEK</div>
          <div className="font-mono text-[13px] font-semibold text-[#22c55e]">
            {s ? num(s.price) : "yok"}
          </div>
          <div className="truncate font-mono text-[9px] text-slate-500">
            {s ? `${s.source} · −${num(s.distance)}` : "fiyatın altında aday yok"}
          </div>
        </div>
      </div>

      <div className="px-3 py-1.5">
        <LevelRow k="Dünkü kapanış" v={levels.prevClose == null ? "veri yok" : num(levels.prevClose)} />
        <LevelRow k="Gece zirve / dip" v={rng(levels.overnight)} sub="post + premarket" />
        <LevelRow k="Premarket zirve / dip" v={rng(levels.premarket)} sub="04:00–09:30" />
        <LevelRow k="RTH zirve / dip" v={rng(levels.rth)} sub="09:30–16:00" />
        <LevelRow k="Seans zirve / dip" v={rng(levels.session)} sub="04:00–20:00" />
        <LevelRow
          k="Olası gün zirve / dip"
          v={
            levels.projectedHigh == null || levels.projectedLow == null
              ? "veri yok"
              : `${num(levels.projectedHigh)} / ${num(levels.projectedLow)}`
          }
          sub={levels.hourlyRange == null ? undefined : `ATR · saatlik ~${num(levels.hourlyRange)}`}
          tone="text-slate-400"
        />
        {price != null && (
          <LevelRow k="Şu anki fiyat" v={num(price)} tone="text-slate-100" />
        )}
      </div>

      <div className="border-t border-[#1c2635] px-3 py-1.5 text-[9px] leading-snug text-slate-600">
        Olası gün zirve/dip bir TAHMİN değil, ATR&apos;nin kalan süreye ölçeklenmiş aralığıdır
        (1m ATR × √kalan dakika). Fiyatın oraya gideceğini söylemez.
      </div>
    </div>
  );
}

/** Gün Kapanış Tahmini — spec §4 */
export function ForecastPanel({
  forecast, accuracy, actualClose,
}: {
  forecast: CloseForecast | null;
  accuracy: { checked: number; hit: number } | null;
  /** V4.1 -- seans kapandığında gerçekleşen SPY kapanışı (yoksa null/undefined) */
  actualClose?: number | null;
}) {
  if (!forecast) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Gün Kapanış Tahmini</div>
        <div className="mt-1 text-[12px] text-slate-500">Seans verisi bekleniyor.</div>
      </div>
    );
  }
  const hours = Math.floor(forecast.remainingMin / 60);
  const mins = forecast.remainingMin % 60;
  const hitRate = accuracy && accuracy.checked > 0
    ? Math.round((accuracy.hit / accuracy.checked) * 100) : null;

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">
          Gün Kapanış Tahmini
          {actualClose != null && (
            <span
              className={`ml-1.5 font-mono text-[10.5px] font-bold ${
                actualClose >= forecast.low && actualClose <= forecast.high ? "text-[#2dd4bf]" : "text-rose-400"
              }`}
            >
              (gerçekleşen: {num(actualClose)})
            </span>
          )}
        </span>
        <span className="font-mono text-[9.5px] text-slate-600">
          kalan {hours}s {mins}dk
        </span>
      </div>

      <div className="px-3 py-2">
        <div className="font-mono text-[15px] font-bold text-slate-100">
          {num(forecast.low)} – {num(forecast.high)}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 font-mono text-[10px] text-slate-500">
          <span>orta nokta <b className="text-slate-300">{num(forecast.mid)}</b></span>
          <span>güven <b className="text-slate-300">%{forecast.confidence}</b></span>
          {hitRate != null && (
            <span title={`${accuracy!.hit}/${accuracy!.checked} tahmin bandın içinde kapandı`}>
              gerçekleşen isabet{" "}
              <b className={hitRate >= forecast.confidence ? "text-[#22c55e]" : "text-amber-300"}>
                %{hitRate}
              </b>{" "}
              <span className="text-slate-600">({accuracy!.checked} seans)</span>
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9.5px] text-slate-500">
          <span>
            Gap:{" "}
            <b className={forecast.gap == null ? "text-slate-500" : tone(forecast.gap)}>
              {forecast.gap == null ? "veri yok" : signed(forecast.gap)}
            </b>
          </span>
          <span>
            Premarket kapanışı:{" "}
            <b className="text-slate-400">
              {forecast.premarketClosePos == null
                ? "veri yok"
                : forecast.premarketClosePos >= 0.66 ? "üst bantta"
                : forecast.premarketClosePos <= 0.33 ? "alt bantta" : "orta bantta"}
            </b>
          </span>
        </div>
      </div>

      <div className="border-t border-[#1c2635] px-3 py-1.5 text-[9px] leading-snug text-slate-600">
        {forecast.note}
      </div>
    </div>
  );
}
