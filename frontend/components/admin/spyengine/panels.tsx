"use client";

/**
 * SPY Engine V2 — kumanda merkezi panelleri.
 * Ticker şeridi, bilgi kartları, pozisyon kutusu ve strateji şeması.
 *
 * Ortak kural: bir değer null ise "—" veya "veri yok" yazılır; hiçbir
 * kartta tahmini/son-bilinen değer gerçek veri gibi gösterilmez.
 */

import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { nyClock, type SessionPhase } from "@/lib/spyengine/core";
import {
  EVENT_LABEL, EVENT_STYLE, SETUP_LABEL, TRIGGER_LABEL,
  STOP_MULT, TARGET_MULT, TRAIL_MULT,
  type PositionState, type EngineEvent, type SetupKind, type TriggerKind, type Direction,
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
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Canlı Piyasa Şeridi</span>
        <span className="font-mono text-[10px] text-slate-600">
          {updatedAt ? `${nyClock(updatedAt, true)} ET` : "veri bekleniyor"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-11 gap-px bg-[#1c2635]">
          {quotes.map((q, idx) => {
            const up = (q.changePct ?? 0) > 0;
            const down = (q.changePct ?? 0) < 0;
            return (
              <div
                key={q.symbol}
                className="bg-[#0f141d] px-2 py-1.5 cursor-pointer transition-colors hover:bg-[#1c2635]"
                onMouseEnter={(e) => setHover({ idx, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHover(null)}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] font-semibold text-slate-300">{q.label}</span>
                  {q.extended && <span className="text-[8px] text-amber-400/80">EXT</span>}
                </div>
                {q.error || q.price == null ? (
                  <div className="font-mono text-[10px] text-slate-600">veri yok</div>
                ) : (
                  <>
                    <div className="font-mono text-[11px] text-slate-100">{num(q.price, q.price > 1000 ? 0 : 2)}</div>
                    <div className={`font-mono text-[10px] ${tone(q.changePct)}`}>
                      {up ? "▲" : down ? "▼" : "▬"} {signed(q.changePct, 2)}%
                    </div>
                  </>
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
          className="pointer-events-none fixed z-[9999] w-[320px] rounded-lg border border-[#2d3748] bg-[#0a0e17] p-3 shadow-2xl"
          style={{
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? "visible" : "hidden",
          }}
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
            href={`/global/tr/graphic/${hq.symbol}`}
            className="pointer-events-auto block rounded bg-[#1d4ed8] px-3 py-2 text-center text-[10px] font-semibold text-white transition-colors hover:bg-[#1e40af]"
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
    <div className="bg-[#0f141d] px-3 py-2">
      <div className="text-[9px] font-semibold tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono text-[14px] font-semibold ${t ?? "text-slate-100"}`}>{value}</div>
      {sub != null && <div className="font-mono text-[10px] text-slate-500">{sub}</div>}
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
      <div className="grid grid-cols-2 gap-px bg-[#1c2635] sm:grid-cols-3 lg:grid-cols-6">
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

// ── Üç katman okuması ─────────────────────────────────────────────

function LayerRow({ tf, tag, value, note, t }: { tf: string; tag: string; value: string; note: string; t: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-start gap-2 border-b border-[#1c2635] px-3 py-2 last:border-0">
      <div>
        <div className="text-[11px] font-semibold text-slate-200">{tf}</div>
        <div className="text-[9px] text-slate-600">{tag}</div>
      </div>
      <div>
        <div className={`text-[12px] font-semibold ${t}`}>{value}</div>
        <div className="text-[10px] leading-snug text-slate-500">{note}</div>
      </div>
    </div>
  );
}

export function LayerTable({ m15, m15Note, m5, m5Note, m1, m1Note, action, state, confidence }: {
  m15: Direction; m15Note: string;
  m5: SetupKind; m5Note: string;
  m1: TriggerKind; m1Note: string;
  action: "LONG" | "SHORT" | "BEKLE";
  state: string;
  confidence: number;
}) {
  const dirTone = m15 === "BULLISH" ? "text-[#22c55e]" : m15 === "BEARISH" ? "text-[#ef4444]" : "text-slate-400";
  const setupTone = m5.includes("LONG") || m5 === "BREAKOUT" ? "text-[#22c55e]"
    : m5.includes("SHORT") || m5 === "BREAKDOWN" ? "text-[#ef4444]" : "text-slate-400";
  const trigTone = m1.startsWith("BULL") ? "text-[#22c55e]" : m1.startsWith("BEAR") ? "text-[#ef4444]" : "text-slate-400";
  const actionTone = action === "LONG"
    ? "bg-green-500/15 text-green-300 border-green-500/30"
    : action === "SHORT"
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : "bg-slate-700/40 text-slate-300 border-slate-600/40";

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Üç Katman Okuması</span>
        <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${actionTone}`}>{action}</span>
      </div>
      <LayerRow tf="15m" tag="yön · bilgi" value={m15 === "BULLISH" ? "Yükseliş" : m15 === "BEARISH" ? "Düşüş" : "Nötr"} note={m15Note} t={dirTone} />
      <LayerRow tf="5m" tag="kurulum" value={SETUP_LABEL[m5]} note={m5Note} t={setupTone} />
      <LayerRow tf="1m" tag="tetik" value={TRIGGER_LABEL[m1]} note={m1Note} t={trigTone} />
      <div className="flex items-center justify-between px-3 py-2 text-[10px] text-slate-500">
        <span>Durum: <b className="text-slate-300">{state}</b></span>
        <span>Güven: <b className="text-slate-300">{confidence}/100</b></span>
      </div>
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

export function PositionPanel({ position, livePremium }: { position: PositionState | null; livePremium: number | null }) {
  if (!position) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Açık Pozisyon</div>
        <div className="mt-1 text-[12px] text-slate-500">Açık pozisyon yok — motor kurulum arıyor.</div>
      </div>
    );
  }

  const prem = livePremium ?? position.lastPremium;
  const pctFromEntry =
    prem != null && position.entryPremium ? ((prem - position.entryPremium) / position.entryPremium) * 100 : null;
  const total = position.realizedPnl + (position.unrealizedPnl ?? 0);

  return (
    <div className={SURFACE}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Açık Pozisyon</span>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
            position.side === "LONG"
              ? "border-green-500/30 bg-green-500/15 text-green-300"
              : "border-red-500/30 bg-red-500/15 text-red-300"
          }`}
        >
          {position.side === "LONG" ? "LONG · CALL" : "SHORT · PUT"}
        </span>
      </div>

      <div className="px-3 py-2">
        {position.premiumDataMissing && (
          <div className="mb-2 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-300">
            Bu giriş için 0DTE opsiyon primi verisi Yahoo&apos;dan gelmedi. Stop/hedef/trailing seviyeleri
            hesaplanmadı — teorik fiyat üretilmiyor.
          </div>
        )}

        {/* Kapatılan yüzde göstergesi */}
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
            <span>Kapatılan</span>
            <span className="font-mono text-slate-300">%{position.closedPct} / %100</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-[#1c2635]">
            <div
              className="h-full rounded bg-gradient-to-r from-sky-500 to-emerald-500 transition-all"
              style={{ width: `${position.closedPct}%` }}
            />
          </div>
        </div>

        <Stat k="Kontrat" v={position.contract ?? "—"} />
        <Stat k="Strike / Vade" v={position.strike ? `$${position.strike} · ${position.expiry}` : "—"} />
        <Stat k="Giriş saati" v={`${nyClock(position.entryTime)} ET`} />
        <Stat k="Giriş SPY" v={`$${num(position.entrySpot)}`} />
        <Stat k="Giriş primi" v={position.entryPremium == null ? "veri yok" : `$${num(position.entryPremium)}`} />
        <Stat
          k={`Sabit stop (×${STOP_MULT})`}
          v={position.stopLevel == null ? "—" : `$${num(position.stopLevel)}`}
          t="text-[#ef4444]"
        />
        <Stat
          k={`Hedef (×${TARGET_MULT})`}
          v={position.targetLevel == null ? "—" : `$${num(position.targetLevel)}`}
          t="text-[#38bdf8]"
        />
        <Stat
          k={`Trailing (peak ×${TRAIL_MULT})`}
          v={position.trailLevel == null ? "kısmi kapama sonrası aktifleşir" : `$${num(position.trailLevel)}`}
          t={position.trailLevel == null ? "text-slate-500" : "text-[#a855f7]"}
        />
        <Stat k="Zirve prim" v={position.peakPremium == null ? "—" : `$${num(position.peakPremium)}`} />
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

      {position.trailPath.length > 0 && (
        <div className="border-t border-[#1c2635] px-3 py-2">
          <div className="mb-1 text-[10px] font-semibold text-slate-400">Trailing seviye geçmişi</div>
          <div className="flex flex-wrap gap-1">
            {position.trailPath.map((s, i) => (
              <span key={`${s.time}-${i}`} className="rounded bg-[#1c2635] px-1.5 py-0.5 font-mono text-[10px] text-[#a855f7]">
                {nyClock(s.time)} → ${num(s.level)}
              </span>
            ))}
          </div>
        </div>
      )}
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

// ── Strateji şeması (talimat §4.5 durum makinesi) ─────────────────

export function StrategySchema({ state, closedPct }: { state: string; closedPct: number | null }) {
  const active = (id: string) => {
    if (id === "watch") return state === "WATCHING";
    if (id === "armed") return state === "ARMED";
    if (id === "trig") return state === "TRIGGERED";
    if (id === "pos") return closedPct === 0;
    if (id === "half") return closedPct === 50;
    if (id === "done") return closedPct === 100;
    return false;
  };
  const box = (id: string) => (active(id) ? "#22c55e" : "#2b3a52");
  const boxFill = (id: string) => (active(id) ? "rgba(34,197,94,0.12)" : "#0f141d");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 980 380" className="h-auto w-full min-w-[760px]" role="img" aria-label="SPY Engine strateji akış şeması">
        <defs>
          <marker id="spyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#475569" />
          </marker>
          <marker id="spyArrowRed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
          </marker>
          <marker id="spyArrowGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#22c55e" />
          </marker>
        </defs>

        {/* Sinyal üretim zinciri */}
        <text x="14" y="22" fill="#64748b" fontSize="11" fontWeight="600">1 · SİNYAL ÜRETİMİ (non-repainting — sadece kapalı mum)</text>

        <rect x="14" y="34" width="150" height="52" rx="6" fill="#0f141d" stroke="#2b3a52" />
        <text x="89" y="54" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">15m · YÖN</text>
        <text x="89" y="70" textAnchor="middle" fill="#64748b" fontSize="9">bilgi amaçlı, filtre değil</text>

        <rect x="196" y="34" width="170" height="52" rx="6" fill={boxFill("armed")} stroke={box("armed")} />
        <text x="281" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">5m · KURULUM</text>
        <text x="281" y="70" textAnchor="middle" fill="#64748b" fontSize="9">breakout / breakdown / pullback</text>

        <rect x="398" y="34" width="170" height="52" rx="6" fill={boxFill("trig")} stroke={box("trig")} />
        <text x="483" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">1m · HASSAS TETİK</text>
        <text x="483" y="70" textAnchor="middle" fill="#64748b" fontSize="9">confirmation / rejection</text>

        <rect x="600" y="34" width="180" height="52" rx="6" fill={boxFill("pos")} stroke={box("pos")} />
        <text x="690" y="54" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="700">▲ GİRİŞ</text>
        <text x="690" y="70" textAnchor="middle" fill="#64748b" fontSize="9">Long Buy / Short Sell · 0DTE ATM</text>

        <line x1="166" y1="60" x2="192" y2="60" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <line x1="368" y1="60" x2="394" y2="60" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <line x1="570" y1="60" x2="596" y2="60" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />

        {/* Pozisyon yönetimi */}
        <text x="14" y="126" fill="#64748b" fontSize="11" fontWeight="600">2 · POZİSYON YÖNETİMİ (opsiyon primi üzerinden)</text>

        <rect x="14" y="140" width="200" height="60" rx="6" fill={boxFill("pos")} stroke={box("pos")} />
        <text x="114" y="162" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">AÇIK POZİSYON %100</text>
        <text x="114" y="178" textAnchor="middle" fill="#94a3b8" fontSize="9">stop = giriş × 0,70 (SABİT)</text>
        <text x="114" y="192" textAnchor="middle" fill="#94a3b8" fontSize="9">hedef = giriş × 1,60</text>

        {/* Stop dalı */}
        <path d="M114 200 L114 250 L262 250" fill="none" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#spyArrowRed)" />
        <rect x="266" y="228" width="188" height="44" rx="6" fill="rgba(239,68,68,0.08)" stroke="#7f1d1d" />
        <text x="360" y="248" textAnchor="middle" fill="#f87171" fontSize="11" fontWeight="700">✕ STOP — TAM KAPAMA</text>
        <text x="360" y="263" textAnchor="middle" fill="#94a3b8" fontSize="9">prim −%30&apos;a değdi · %100 kapanır</text>

        {/* Hedef dalı */}
        <path d="M214 170 L262 170" fill="none" stroke="#22c55e" strokeWidth="1.5" markerEnd="url(#spyArrowGreen)" />
        <rect x="266" y="140" width="188" height="60" rx="6" fill={boxFill("half")} stroke={active("half") ? "#22c55e" : "#0e7490"} />
        <text x="360" y="162" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="700">◐ KISMİ KAPAMA %50</text>
        <text x="360" y="178" textAnchor="middle" fill="#94a3b8" fontSize="9">prim +%60 · yarısı satılır</text>
        <text x="360" y="192" textAnchor="middle" fill="#94a3b8" fontSize="9">kalan %50 trailing&apos;e geçer</text>

        <path d="M454 170 L500 170" fill="none" stroke="#a855f7" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="504" y="132" width="212" height="76" rx="6" fill="rgba(168,85,247,0.08)" stroke="#6b21a8" />
        <text x="610" y="152" textAnchor="middle" fill="#c084fc" fontSize="11" fontWeight="700">GENİŞ BANTLI TRAILING</text>
        <text x="610" y="168" textAnchor="middle" fill="#94a3b8" fontSize="9">peak sürekli güncellenir</text>
        <text x="610" y="182" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="600">trailing = peak × 0,50</text>
        <text x="610" y="198" textAnchor="middle" fill="#94a3b8" fontSize="9">sadece YUKARI · asla aşağı çekilmez</text>

        <path d="M610 208 L610 250 L748 250" fill="none" stroke="#a855f7" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="752" y="228" width="214" height="44" rx="6" fill="rgba(168,85,247,0.08)" stroke="#6b21a8" />
        <text x="859" y="248" textAnchor="middle" fill="#c084fc" fontSize="11" fontWeight="700">▼ TRAILING KAPAMA</text>
        <text x="859" y="263" textAnchor="middle" fill="#94a3b8" fontSize="9">kalan %50 kapanır</text>

        {/* EOD — mutlak kural */}
        <rect x="14" y="300" width="952" height="60" rx="6" fill="rgba(148,163,184,0.06)" stroke="#334155" strokeDasharray="4 3" />
        <text x="34" y="324" fill="#cbd5e1" fontSize="11" fontWeight="700">■ 15:45 ET — GÜN SONU ZORUNLU KAPAMA (0DTE)</text>
        <text x="34" y="342" fill="#94a3b8" fontSize="9.5">
          Trailing / stop mantığından BAĞIMSIZ, mutlak öncelikli kural: bu saatte açık ne varsa (tam pozisyon veya kalan %50) kapatılır.
        </text>

        {/* Aktif durum rozeti */}
        <rect x="752" y="34" width="214" height="52" rx="6" fill="#0a0e17" stroke="#1c2635" opacity="0" />
      </svg>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500 sm:grid-cols-5">
        {(["ENTRY", "PARTIAL", "STOP", "TRAIL_EXIT", "EOD_EXIT"] as const).map((k) => (
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
