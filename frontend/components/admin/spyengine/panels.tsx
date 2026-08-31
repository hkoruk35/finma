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
  EVENT_LABEL, EVENT_STYLE, CONTRACT_RULES, CONTRACT_TONE, FORCE_EXIT_MINUTES,
  type PositionState, type EngineEvent, type StreakDir, type Direction,
  type ContractType, type ConfidencePart,
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
                onMouseEnter={(e) => { cancelClose(); setHover({ idx, rect: e.currentTarget.getBoundingClientRect() }); }}
                onMouseLeave={scheduleClose}
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

// ── İki katman okuması (V3: 1m ana sürücü, 5m destek — 15m karara girmez) ──

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

/** Talimat §7 kabul kriteri: güven skoru kara kutu olmamalı, bileşenleri görülebilmeli */
function ConfidenceBreakdown({ parts, total }: { parts: ConfidencePart[]; total: number }) {
  return (
    <div className="border-t border-[#1c2635] px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-400">Güven Skoru Dökümü</span>
        <span className="font-mono text-[12px] font-bold text-slate-200">{total}/100</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-500">{p.label}</span>
            <span className={p.value > 0 ? "text-[#22c55e]" : p.value < 0 ? "text-[#ef4444]" : "text-slate-500"}>
              {p.value >= 0 ? "+" : ""}{p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LayerTable({ m5Rsi, m5RsiDirection, m5Note, m1StreakDir, m1StreakLen, m1Note, action, contractType, state, confidence, confidenceParts }: {
  m5Rsi: number | null; m5RsiDirection: Direction; m5Note: string;
  m1StreakDir: StreakDir; m1StreakLen: number; m1Note: string;
  action: "LONG" | "SHORT" | "BEKLE";
  contractType: ContractType | null;
  state: string;
  confidence: number;
  confidenceParts: ConfidencePart[];
}) {
  const rsiTone = m5RsiDirection === "BULLISH" ? "text-[#22c55e]" : m5RsiDirection === "BEARISH" ? "text-[#ef4444]" : "text-slate-400";
  const streakTone = m1StreakDir === "UP" ? "text-[#22c55e]" : m1StreakDir === "DOWN" ? "text-[#ef4444]" : "text-slate-400";
  const actionTone = action === "LONG"
    ? "bg-green-500/15 text-green-300 border-green-500/30"
    : action === "SHORT"
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : "bg-slate-700/40 text-slate-300 border-slate-600/40";
  const streakValue = m1StreakDir === "NONE" ? "Yok" : `${m1StreakLen} ${m1StreakDir === "UP" ? "▲ yükseliş" : "▼ düşüş"}`;

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">İki Katman Okuması</span>
        <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${actionTone}`}>
          {action}{contractType ? ` · Kontrat ${contractType}` : ""}
        </span>
      </div>
      <LayerRow tf="1m" tag="tetik · ana sürücü" value={streakValue} note={m1Note} t={streakTone} />
      <LayerRow tf="5m" tag="destek (iptal etmez)" value={m5Rsi == null ? "veri yok" : `RSI ${m5Rsi.toFixed(1)}`} note={m5Note} t={rsiTone} />
      <div className="flex items-center justify-between px-3 py-2 text-[10px] text-slate-500">
        <span>Durum: <b className="text-slate-300">{state}</b></span>
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

export function PositionPanel({ position, livePremium, nowSec }: {
  position: PositionState | null; livePremium: number | null; nowSec: number;
}) {
  if (!position) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Açık Pozisyon</div>
        <div className="mt-1 text-[12px] text-slate-500">Açık pozisyon yok — motor seri arıyor.</div>
      </div>
    );
  }

  const prem = livePremium ?? position.lastPremium;
  const pctFromEntry =
    prem != null && position.entryPremium ? ((prem - position.entryPremium) / position.entryPremium) * 100 : null;
  const total = position.realizedPnl + (position.unrealizedPnl ?? 0);
  const rules = CONTRACT_RULES[position.contractType];
  const remainingSec = position.status === "OPEN" && nowSec > 0 ? Math.max(0, position.forceExitTime - nowSec) : null;

  return (
    <div className={SURFACE}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Açık Pozisyon</span>
        <div className="flex items-center gap-1.5">
          <span
            className="rounded border px-2 py-0.5 text-[10px] font-bold"
            style={{ borderColor: `${CONTRACT_TONE[position.contractType]}55`, backgroundColor: `${CONTRACT_TONE[position.contractType]}22`, color: CONTRACT_TONE[position.contractType] }}
          >
            {rules.label}
          </span>
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
      </div>

      <div className="px-3 py-2">
        {position.premiumDataMissing && (
          <div className="mb-2 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-300">
            Bu giriş için 0DTE opsiyon primi verisi Yahoo&apos;dan gelmedi. Stop/hedef seviyeleri
            hesaplanmadı — teorik fiyat üretilmiyor.
          </div>
        )}

        {remainingSec != null && (
          <div className="mb-2 flex items-center justify-between rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[10px]">
            <span className="text-amber-300/80">Süre sınırı ({FORCE_EXIT_MINUTES} dk)</span>
            <span className="font-mono font-semibold text-amber-300">
              {nyClock(position.forceExitTime)} ET · {Math.floor(remainingSec / 60)}dk {remainingSec % 60}sn kaldı
            </span>
          </div>
        )}

        <Stat k="Kontrat" v={position.contract ?? "—"} />
        <Stat k="Strike / Vade" v={position.strike ? `$${position.strike} · ${position.expiry}` : "—"} />
        <Stat k="Giriş saati" v={`${nyClock(position.entryTime)} ET`} />
        <Stat k="Giriş SPY" v={`$${num(position.entrySpot)}`} />
        <Stat k="Giriş primi" v={position.entryPremium == null ? "veri yok" : `$${num(position.entryPremium)}`} />
        <Stat
          k={`Stop (×${rules.stopMult})`}
          v={position.stopLevel == null ? "—" : `$${num(position.stopLevel)}`}
          t="text-[#ef4444]"
        />
        <Stat
          k={`Hedef (×${rules.targetMult})`}
          v={position.targetLevel == null ? "—" : `$${num(position.targetLevel)}`}
          t="text-[#38bdf8]"
        />
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

// ── Strateji şeması (V3: 1m seri → Kontrat A/B → düz SL/TP/süre) ──

export function StrategySchema({ state, contractType }: { state: string; contractType: string | null }) {
  const active = (id: string) => {
    if (id === "watch") return state === "WATCHING";
    if (id === "armed") return state === "ARMED";
    if (id === "trig") return state === "TRIGGERED";
    if (id === "a") return contractType === "A";
    if (id === "b") return contractType === "B";
    return false;
  };
  const box = (id: string) => (active(id) ? "#22c55e" : "#2b3a52");
  const boxFill = (id: string) => (active(id) ? "rgba(34,197,94,0.12)" : "#0f141d");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 980 340" className="h-auto w-full min-w-[760px]" role="img" aria-label="SPY Engine V3 strateji akış şeması">
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

        {/* Sinyal üretimi */}
        <text x="14" y="22" fill="#64748b" fontSize="11" fontWeight="600">1 · SİNYAL ÜRETİMİ — 1m ANA SÜRÜCÜ (non-repainting, 15m karara girmez)</text>

        <rect x="14" y="34" width="220" height="60" rx="6" fill={boxFill("armed")} stroke={box("armed")} />
        <text x="124" y="56" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">1m · ARDIŞIK MUM SERİSİ</text>
        <text x="124" y="72" textAnchor="middle" fill="#64748b" fontSize="9">aynı yönde art arda kapanan mumlar</text>
        <text x="124" y="86" textAnchor="middle" fill="#64748b" fontSize="9">5m RSI/hacim yalnızca güveni ayarlar</text>

        <path d="M234 64 L280 64" fill="none" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="284" y="34" width="190" height="60" rx="6" fill={boxFill("a")} stroke={box("a")} />
        <text x="379" y="56" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="700">▲ KONTRAT A — 2. mum</text>
        <text x="379" y="72" textAnchor="middle" fill="#94a3b8" fontSize="9">SL −%30 · TP +%60</text>
        <text x="379" y="86" textAnchor="middle" fill="#64748b" fontSize="9">hacim teyidi güveni artırır</text>

        <path d="M474 64 L520 64" fill="none" stroke="#475569" strokeWidth="1.5" markerEnd="url(#spyArrow)" />
        <rect x="524" y="34" width="230" height="60" rx="6" fill={boxFill("b")} stroke={box("b")} />
        <text x="639" y="52" textAnchor="middle" fill="#a855f7" fontSize="11" fontWeight="700">▲ KONTRAT B — 4. mum</text>
        <text x="639" y="68" textAnchor="middle" fill="#94a3b8" fontSize="9">+ 5m RSI teyidi + trend kırılmadı</text>
        <text x="639" y="84" textAnchor="middle" fill="#94a3b8" fontSize="9">SL −%40 · TP +%100</text>

        {/* Çıkış */}
        <text x="14" y="128" fill="#64748b" fontSize="11" fontWeight="600">2 · ÇIKIŞ — TAM giriş / TAM çıkış (kısmi kapama yok)</text>

        <rect x="14" y="142" width="180" height="56" rx="6" fill="rgba(239,68,68,0.08)" stroke="#7f1d1d" />
        <text x="104" y="164" textAnchor="middle" fill="#f87171" fontSize="11" fontWeight="700">✕ STOP</text>
        <text x="104" y="180" textAnchor="middle" fill="#94a3b8" fontSize="9">sabit SL seviyesine değdi</text>

        <rect x="210" y="142" width="180" height="56" rx="6" fill="rgba(56,189,248,0.08)" stroke="#0e7490" />
        <text x="300" y="164" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="700">◆ HEDEF</text>
        <text x="300" y="180" textAnchor="middle" fill="#94a3b8" fontSize="9">TP seviyesine ulaştı, tam kapandı</text>

        <rect x="406" y="142" width="180" height="56" rx="6" fill="rgba(245,158,11,0.08)" stroke="#92400e" />
        <text x="496" y="160" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">◷ SÜRE DOLDU</text>
        <text x="496" y="176" textAnchor="middle" fill="#94a3b8" fontSize="9">45 dk taşıma sınırı,</text>
        <text x="496" y="190" textAnchor="middle" fill="#94a3b8" fontSize="9">mevcut fiyattan kapama</text>

        <rect x="602" y="142" width="364" height="56" rx="6" fill="rgba(148,163,184,0.06)" stroke="#334155" strokeDasharray="4 3" />
        <text x="784" y="164" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="700">■ 15:45 ET — MUTLAK GÜN SONU KAPAMA</text>
        <text x="784" y="180" textAnchor="middle" fill="#94a3b8" fontSize="9">diğer tüm kurallardan bağımsız, her zaman öncelikli</text>

        {/* Yeniden giriş */}
        <text x="14" y="234" fill="#64748b" fontSize="11" fontWeight="600">3 · YENİDEN GİRİŞ (re-arm)</text>
        <rect x="14" y="248" width="952" height="56" rx="6" fill="#0f141d" stroke="#2b3a52" />
        <text x="34" y="270" fill="#e2e8f0" fontSize="10.5" fontWeight="600">Pozisyon kapandığında sistem, o pozisyonun TERSİNE kapanan İLK 1m mumu görülene kadar yeni aday üretmez.</text>
        <text x="34" y="288" fill="#64748b" fontSize="9.5">Bu &quot;düzeltme mumu&quot; beklemesi, aynı hareketin ardı ardına art arda sinyal üretmesini engeller — 09:30–15:45 ET boyunca döngü tekrarlar.</text>
      </svg>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500 sm:grid-cols-5">
        {(["ENTRY", "TARGET", "STOP", "TIME_EXIT", "EOD_EXIT"] as const).map((k) => (
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
