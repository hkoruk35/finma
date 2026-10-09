"use client";

/**
 * SPY Engine V10 (Senaryo Takibi) — Tek sayfa, sonuç odaklı (/admin/spyengine/v1)
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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { prevDayPivots, pivotRead, PIVOT_ORDER, type PivotKey, type PivotRead } from "@/lib/spyengine/pivots";
import SpyChart, { type ChartToggles } from "@/components/admin/spyengine/SpyChart";
import ForecastMap from "@/components/admin/spyengine/ForecastMap";
import ForecastTabs from "@/components/admin/spyengine/ForecastTabs";
import { factsOf, type ForecastModel, type ForecastStats } from "@/lib/spyengine/forecastModel";
import {
  TickerStrip, InfoCards, GatePanel, PositionPanel, ExitGatePanel,
  AlertBanner, computeEntryAlert, Disclosure, PhaseBadge, SURFACE, num, signed, tone,
  type StripQuote, type SpotStats,
} from "@/components/admin/spyengine/panels";
import {
  fromCompact, nyClock, nyParts, isRthBar, bucketAggregate, atr, lastNum, nyDateTimeToEpoch,
  type Bar, type SessionInfo, type CompactBar,
} from "@/lib/spyengine/core";
import {
  daySeries, liveVwap, commentAll, commentForming, fmtVol, stopZones, openingRegime, liveDirection, buildForecastMap,
  emaByTime, decisionRead, FACTOR_MAX, CLOSE_TREND_START, sessionModeOf, tfRead, multiDaySeries,
  type CandleComment, type Tone, type DecisionRead, type TfRead, type PlanSide,
  type DaySeries, type EmaMap, type OpeningRegime, type VwapSide, type LiveDirection,
} from "@/lib/spyengine/openingMap";
import type {
  EngineEvent, PositionState, ContractType, EngineState, GateStatus, RegimeState,
} from "@/lib/spyengine/strategy";
import type { LevelRead, CloseForecast } from "@/lib/spyengine/levels";
import { flowRead, type FlowRead } from "@/lib/spyengine/flow";
import { optionLevelList, type OptionLevels } from "@/lib/spyengine/optionLevels";
import type { OpenForecastRead } from "@/lib/spyengine/openForecastFetch";
import type { JournalDay, JournalStats } from "@/lib/spyengine/journal";
import { buildScenario, type Scenario, type Leg } from "@/lib/spyengine/scenario";
import { dayTypeLive, vixExpectation, type DayTypeLive } from "@/lib/spyengine/dayType";
import { buildLegChain, pickTargets, optionFor, realizedIV, type Anchor, type LegChain, type TrackState, type TrackStatus } from "@/lib/spyengine/scenarioTrack";
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
  bb: false, ema20: true, ema21: false, vwap: true, volume: true,
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
          <span className="font-mono text-[12px] font-bold text-slate-200">{c.clock}</span>
          <span className="text-[10.5px] text-slate-500">{c.tf} {c.forming ? "oluşuyor" : "kapanış"} {num(c.close)}</span>
          {c.forming && <span className="rounded bg-sky-500/15 px-1 text-[9.5px] font-semibold text-sky-300">CANLI</span>}
          {latest && !c.forming && <span className="rounded bg-[#eab308]/15 px-1 text-[9.5px] font-semibold text-[#eab308]">SON</span>}
        </span>
        {c.vwapSide && (
          <span className={`rounded border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${SIDE_CHIP[c.vwapSide]}`}>
            {c.vwapSide === "ABOVE" ? "VWAP ÜSTÜ" : c.vwapSide === "BELOW" ? "VWAP ALTI" : "VWAP'TA"} {c.vwap != null && num(c.vwap)}
          </span>
        )}
      </div>
      <div className={`mt-0.5 text-[12px] font-semibold ${st.text}`}>{c.headline}</div>
      <div className="mt-0.5 flex flex-wrap gap-1 font-mono text-[10.5px] text-slate-400">
        <span className="rounded bg-[#0a0e17] px-1 py-0.5">üst fitil {num(c.upperWick)}</span>
        <span className="rounded bg-[#0a0e17] px-1 py-0.5">alt fitil {num(c.lowerWick)}</span>
        <span className="rounded bg-[#0a0e17] px-1 py-0.5">kapanış konumu %{Math.round(c.closePos * 100)}</span>
        <span className={`rounded bg-[#0a0e17] px-1 py-0.5 ${c.volRatio != null && c.volRatio >= 1.5 ? "text-sky-300" : c.volRatio != null && c.volRatio <= 0.6 ? "text-amber-300" : ""}`}>
          hacim {fmtVol(c.volume)}{c.volRatio != null ? ` · ${c.volRatio.toFixed(1)}×` : ""}
        </span>
      </div>
      <ul className="mt-0.5 flex flex-col gap-0.5 text-[11px] leading-snug text-slate-400">
        {c.lines.map((l, i) => <li key={i}>• {l}</li>)}
      </ul>
    </div>
  );
}

function CommentFeed({ title, items, forming }: { title: string; items: CandleComment[]; forming: CandleComment | null }) {
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[12px] font-semibold tracking-wide text-slate-300">{title}</span>
        <span className="font-mono text-[10.5px] text-slate-500">{items.length} kapanmış mum · en yeni üstte</span>
      </div>
      <div className="flex max-h-[520px] flex-col gap-1 overflow-y-auto p-1.5">
        {forming && <CommentCard c={forming} latest={false} />}
        {items.length === 0 && !forming && (
          <div className="px-2 py-4 text-center text-[12px] text-slate-500">
            Henüz kapanmış seans mumu yok — 09:30 ET&apos;den sonra ilk kapanışla yorumlar gelir.
          </div>
        )}
        {items.map((c, idx) => <CommentCard key={`${c.tf}-${c.time}`} c={c} latest={idx === 0} />)}
      </div>
    </div>
  );
}

// ── Karar desteği paneli ──────────────────────────────────────────

const DIR_COLOR = { UP: "#22c55e", DOWN: "#ef4444", FLAT: "#eab308" } as const;
const scoreTxt = (x: number) => `${x > 0 ? "+" : ""}${x}`;

function TfColumn({ title, sub, r }: { title: string; sub: string; r: TfRead | null }) {
  if (!r) {
    return (
      <div className="bg-[#0f141d] px-3 py-2">
        <div className="text-[12px] font-semibold text-slate-300">{title}</div>
        <div className="mt-2 text-[11px] text-slate-500">Henüz kapanmış mum yok.</div>
      </div>
    );
  }
  const col = DIR_COLOR[r.dir];
  return (
    <div className="bg-[#0f141d] px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold text-slate-300">
          {title} <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· {sub}</span>
        </span>
        <span className="font-mono text-[10.5px] text-slate-500">{r.clock} kapanış {num(r.close)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[16px] font-extrabold tracking-wide" style={{ color: col }}>
          {r.dir === "UP" ? "▲" : r.dir === "DOWN" ? "▼" : "◆"} {r.label}
        </span>
        <span className="ml-auto rounded px-1.5 py-0.5 font-mono text-[11px] font-bold" style={{ color: col, backgroundColor: `${col}1f` }}>
          {scoreTxt(r.score)}/{FACTOR_MAX}
        </span>
      </div>
      {/* skor çubuğu: −6 … +6 */}
      <div className="relative mt-1 h-1.5 rounded bg-[#1c2635]">
        <span className="absolute left-1/2 top-[-2px] h-[10px] w-px bg-slate-600" />
        <span
          className="absolute top-0 h-1.5 rounded"
          style={{
            backgroundColor: col,
            left: r.score >= 0 ? "50%" : `${50 - (Math.abs(r.score) / FACTOR_MAX) * 50}%`,
            width: `${(Math.abs(r.score) / FACTOR_MAX) * 50}%`,
          }}
        />
      </div>
      <div className="mt-1.5 flex flex-col">
        {r.factors.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-2 border-b border-[#151c28] py-[3px] text-[11px] last:border-0">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className={`w-3 text-center font-bold ${f.vote > 0 ? "text-[#22c55e]" : f.vote < 0 ? "text-[#ef4444]" : "text-slate-500"}`}>
                {f.vote > 0 ? "▲" : f.vote < 0 ? "▼" : "•"}
              </span>
              {f.label}
            </span>
            <span className={`text-right font-mono ${f.vote > 0 ? "text-[#4ade80]" : f.vote < 0 ? "text-[#f87171]" : "text-slate-400"}`}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanCell({ side, p, active, price }: { side: "LONG" | "SHORT"; p: PlanSide; active: boolean; price: number | null }) {
  const isLong = side === "LONG";
  const col = isLong ? "#22c55e" : "#ef4444";
  const dist = price != null ? (isLong ? p.trigger - price : price - p.trigger) : null;
  return (
    <div className={`bg-[#0f141d] px-3 py-2 ${active ? "" : "opacity-50"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold" style={{ color: col }}>
          {side} planı
          {active && <span className="ml-1.5 rounded px-1 text-[9.5px] font-semibold" style={{ backgroundColor: `${col}22` }}>ÖNCELİKLİ</span>}
        </span>
        {dist != null && (
          <span className="font-mono text-[10.5px] text-slate-500">
            {dist <= 0 ? <b style={{ color: col }}>fiyat tetiğin ötesinde — 5m kapanışı bekle</b> : `tetiğe ${num(dist)} puan`}
          </span>
        )}
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1 font-mono text-[11px]">
        <div><div className="text-[10px] text-slate-500">5m kapanış {isLong ? "≥" : "≤"}</div><b className="text-[13px]" style={{ color: col }}>{num(p.trigger)}</b></div>
        <div><div className="text-[10px] text-slate-500">stop (15m yapı)</div><b className="text-[12px] text-slate-200">{p.stop != null ? num(p.stop) : "—"}</b></div>
        <div title={p.targetLabel ?? ""}><div className="text-[10px] text-slate-500">hedef 1</div><b className="text-[12px] text-slate-200">{p.target != null ? num(p.target) : "—"}</b></div>
        <div><div className="text-[10px] text-slate-500">risk/ödül</div><b className={`text-[12px] ${p.rr == null ? "text-slate-500" : p.rr >= 1.5 ? "text-[#4ade80]" : p.rr >= 1 ? "text-amber-300" : "text-[#f87171]"}`}>{p.rr != null ? `${p.rr.toFixed(1)}R` : "—"}</b></div>
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-slate-500">
        sıkı stop (son 2×5m {isLong ? "dip" : "tepe"}): <b className="text-slate-300">{num(p.tightStop)}</b>
        {p.rrTight != null && <> → <b className={p.rrTight >= 1.5 ? "text-[#4ade80]" : p.rrTight >= 1 ? "text-amber-300" : "text-[#f87171]"}>{p.rrTight.toFixed(1)}R</b></>}
      </div>
      {p.targetLabel && (
        <div className="mt-0.5 truncate text-[10.5px] text-slate-500">
          hedef: {p.targetLabel}{p.etaMin != null && <> · tetikten <b className="text-slate-400">~{p.etaMin} dk</b> (ort. saatlik harekete göre)</>}
        </div>
      )}
    </div>
  );
}

function DecisionPanel({ d, price, secTo5, forming, waiting, r1h, r4h }: {
  d: DecisionRead | null;
  /** 1h / 4h genel yapı (bilgi; karar mantığına girmez) */
  r1h?: TfRead | null;
  r4h?: TfRead | null;
  price: number | null;
  secTo5: number | null;
  forming: CandleComment | null;
  waiting: boolean;
}) {
  if (!d) {
    return (
      <div className={`${SURFACE} px-3 py-3 text-[12px] text-slate-500`}>
        <span className="font-semibold text-slate-300">Karar Desteği</span> —{" "}
        {waiting ? "09:35 ET ilk 5m kapanışıyla okuma başlar." : "mum verisi bekleniyor."}
      </div>
    );
  }
  const col = d.action === "LONG" ? "#22c55e" : d.action === "SHORT" ? "#ef4444" : "#eab308";
  const prio = d.action !== "BEKLE" ? d.action : d.lean;
  return (
    <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${col}66` }}>
      {/* başlık + karar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[12px] font-semibold tracking-wide text-slate-300">
          Karar Desteği <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· her 5m kapanışında fiyat + hacim · 30m gidişat · 15m karar · 5m tetik (giriş/çıkış) · erken uyarı</span>
        </span>
        <span className="font-mono text-[10.5px] text-slate-500">
          son 5m {d.r5?.clock ?? "—"} · 15m {d.r15?.clock ?? "—"} · 30m {d.r30?.clock ?? "—"} · sonraki 5m kapanış {secTo5 != null ? `${Math.floor(secTo5 / 60)}:${String(secTo5 % 60).padStart(2, "0")}` : "—"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1c2635] bg-[#0b1220] px-3 py-1 text-[11px]">
        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-sky-300">{d.modeLabel}</span>
        <span className="text-slate-400">{d.modeText}</span>
      </div>
      <div className="px-3 py-2" style={{ backgroundColor: `${col}10` }}>
        <div className="text-[15px] font-extrabold tracking-wide sm:text-[17px]" style={{ color: col }}>
          {d.action === "LONG" ? "▲" : d.action === "SHORT" ? "▼" : "◆"} {d.title}
        </div>
        <ul className="mt-1 flex flex-col gap-0.5 text-[12px] leading-snug text-slate-300">
          {d.why.map((w, i) => <li key={`w${i}`}>• {w}</li>)}
          {d.watch.map((w, i) => <li key={`a${i}`} className="text-sky-300">→ {w}</li>)}
        </ul>
      </div>

      {/* 4h · 1h (genel yapı) · 30m · 15m · 5m */}
      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <TfColumn title="4h" sub="ana yapı (çok günlük)" r={r4h ?? null} />
        <TfColumn title="1h" sub="genel yapı (çok günlük)" r={r1h ?? null} />
        <TfColumn title="30m" sub="genel gidişat" r={d.r30} />
        <TfColumn title="15m" sub="karar" r={d.r15} />
        <TfColumn title="5m" sub="tetik · giriş/çıkış zamanlaması" r={d.r5} />
      </div>
      {/* 5m skor geçmişi (gün geneli kartı yukarıya, VWAP/EMA20 konumunun yanına taşındı) */}
      <div className="flex flex-wrap items-center gap-1 border-t border-[#1c2635] px-3 py-1.5">
        <span className="mr-1 text-[10.5px] text-slate-500">5m skor geçmişi (eski → yeni)</span>
            {d.history5.map((h) => {
              const c = h.score >= 3 ? "#22c55e" : h.score <= -3 ? "#ef4444" : "#64748b";
              return (
                <span key={h.clock} title={h.clock} className="rounded px-1 py-0.5 font-mono text-[10px] font-semibold" style={{ color: c, backgroundColor: `${c}1f` }}>
                  {h.clock.slice(-5)} {scoreTxt(h.score)}
                </span>
              );
            })}
      </div>

      {/* oluşan 5m mum — bilgi, karar mumu değil */}
      {forming && (
        <div className="border-t border-[#1c2635] px-3 py-1.5 text-[11px] text-slate-400">
          <span className="mr-1 rounded bg-sky-500/15 px-1 text-[9.5px] font-semibold text-sky-300">CANLI</span>
          Oluşan 5m mum ({forming.clock}): fiyat <b className="text-slate-200">{num(price ?? forming.close)}</b> ·{" "}
          {forming.vwapSide === "ABOVE" ? "VWAP üstünde" : forming.vwapSide === "BELOW" ? "VWAP altında" : "VWAP'ta"} ·{" "}
          {price != null && price >= d.long.trigger ? <b className="text-[#4ade80]">LONG tetiği üstünde — kapanışta orada kalırsa teyit</b>
            : price != null && price <= d.short.trigger ? <b className="text-[#f87171]">SHORT tetiği altında — kapanışta orada kalırsa teyit</b>
            : <>tetikler arasında ({num(d.short.trigger)} – {num(d.long.trigger)}) — kapanış belirleyecek</>}
          {forming.volRatio != null && <> · hacim temposu {forming.volRatio.toFixed(1)}×</>}
        </div>
      )}

      {/* plan: senaryo takibi varken YENİ GİRİŞ planı pasif (taşıma modunda kovalama/FOMO riski) */}
      {d.tracking && (
        <div className="border-t border-[#1c2635] bg-[#0b1220] px-3 py-1.5 text-[11.5px] text-sky-300">
          Senaryo taşınıyor — aşağıdaki yeni-giriş tetikleri bilgi amaçlıdır, kullanma (trend içinde yeni giriş = FOMO riski). Taşıma kuralları: Senaryo Takibi.
        </div>
      )}
      <div className={`grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] lg:grid-cols-2 ${d.tracking ? "opacity-40" : ""}`}>
        <PlanCell side="LONG" p={d.long} active={!d.tracking && prio !== "SHORT"} price={price} />
        <PlanCell side="SHORT" p={d.short} active={!d.tracking && prio !== "LONG"} price={price} />
      </div>
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
        Skor: VWAP · EMA20 · EMA20 eğimi · 3 mum yapısı · hacim akışı · son mumun hacim teyidi — her biri ±1, yalnızca KAPANMIŞ mumdan. Tetik = son
        5m tepe/dip, VWAP ve EMA20&apos;nin ötesi; stop = Trend Stop Bölgesi; hedef = tahmin haritasındaki ilk seviye. Alıcı/satıcı hacmi kapanış
        konumundan tahmin edilir (tick verisi değil). Karar desteğidir — motor sinyali ayrıca aşağıda.
      </div>
    </div>
  );
}

// ── Erken uyarı · likidite · akıllı para paneli ───────────────────

const EVENT_TAG: Record<FlowRead["events"][number]["kind"], string> = {
  SWEEP_HIGH: "TEPE SÜPÜRME",
  SWEEP_LOW: "DİP SÜPÜRME",
  ABSORB_BUY: "ALICI EMİLİMİ",
  ABSORB_SELL: "SATICI EMİLİMİ",
  PUSH_UP: "KURUMSAL ALIM",
  PUSH_DOWN: "KURUMSAL SATIŞ",
  DIV_BULL: "+ UYUMSUZLUK",
  DIV_BEAR: "− UYUMSUZLUK",
};

function FlowTile({ title, value, tone: tcol, status, note, children }: { title: string; value?: ReactNode; tone?: string; status?: ReactNode; note?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-[#0f141d] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {value != null && <div className="font-mono text-[16px] font-bold" style={{ color: tcol ?? "#e2e8f0" }}>{value}</div>}
      {status && <div className="text-[12px] leading-snug text-slate-200">{status}</div>}
      {children}
      {note && <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{note}</div>}
    </div>
  );
}

function FlowPanel({ f, price, nowMin, opt, scenarioDir }: { f: FlowRead | null; price: number | null; nowMin: number; opt: OptionLevels | null; scenarioDir: "UP" | "DOWN" | null }) {
  const [optOpen, setOptOpen] = useState(false);
  if (!f) {
    return (
      <div className={`${SURFACE} px-3 py-3 text-[12px] text-slate-500`}>
        <span className="font-semibold text-slate-300">Erken Uyarı · Likidite · Akıllı Para</span> — güncel veri yok; ilk 5m kapanışla başlar.
      </div>
    );
  }
  const w = f.warning;
  const col = w.side === "LONG" ? "#22c55e" : w.side === "SHORT" ? "#ef4444" : f.compression.active ? "#eab308" : "#64748b";
  const tot = Math.max(1, w.bull + w.bear);
  const px = price ?? 0;
  const prof = f.profile;
  const above = f.pools.filter((p) => !p.swept && p.price > px).sort((a, b) => a.price - b.price).slice(0, 3);
  const below = f.pools.filter((p) => !p.swept && p.price < px).sort((a, b) => b.price - a.price).slice(0, 3);
  const fmtD = (v: number) => `${v >= 0 ? "+" : "−"}${fmtVol(Math.abs(v))}`;
  const headline = scenarioDir && w.side && w.level !== "NONE"
    ? ((w.side === "LONG") === (scenarioDir === "UP") ? `${w.headline} — senaryoyu DESTEKLİYOR (yeni giriş değil, taşı)` : `${w.headline} — senaryoya TERS: erken uyarı, trend değişimi koşullarını izle`)
    : w.headline;
  const levelChip = w.level === "STARTED" ? "HAREKET BAŞLADI" : w.level === "NONE" ? "SAKİN" : "HAZIRLIK";
  return (
    <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${col}66` }}>
      {/* başlık */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">
          Erken Uyarı · Likidite · Akıllı Para <span className="hidden text-[11px] font-normal text-slate-500 sm:inline">· süpürme · emilim · kurumsal itki · delta uyumsuzluğu · POC göçü · sıkışma/ivme</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="rounded border px-1.5 py-0.5" style={{ color: col, borderColor: `${col}66`, backgroundColor: `${col}14` }}>{levelChip}</span>
          <span className="rounded border border-[#22c55e]/40 bg-[#22c55e]/10 px-1.5 py-0.5 text-[#4ade80]">alıcı {w.bull}</span>
          <span className="rounded border border-[#ef4444]/40 bg-[#ef4444]/10 px-1.5 py-0.5 text-[#f87171]">satıcı {w.bear}</span>
        </span>
      </div>

      {/* ana mesaj */}
      <div className="px-3 py-2" style={{ backgroundColor: `${col}12` }}>
        <div className={`text-[15px] font-extrabold leading-snug sm:text-[17px] ${w.level === "STARTED" ? "animate-pulse" : ""}`} style={{ color: col }}>{headline}</div>
        <div className="mt-1.5 flex h-2 overflow-hidden rounded bg-[#1c2635]" title={`alıcı ${w.bull} · satıcı ${w.bear}`}>
          <span className="bg-[#22c55e]" style={{ width: `${(w.bull / tot) * 100}%` }} />
          <span className="bg-[#ef4444]" style={{ width: `${(w.bear / tot) * 100}%` }} />
        </div>
        {w.level !== "NONE" && nowMin > 0 && nowMin < CLOSE_TREND_START && (
          <div className="mt-1 text-[11.5px] text-amber-300/90">⚠ Bu saatte (14:00 öncesi) erken uyarı geçmiş ölçümde zayıf (%40 isabet) — kararı Karar Desteği&apos;ndeki seans planı verir; bu uyarı yalnızca bilgi.</div>
        )}
        {(w.targets.length > 0 || w.invalidation != null) && (
          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3">
            {w.targets.map((t, i) => (
              <div key={i} className="rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-1" title={t.label}>
                <div className="text-[10.5px] text-slate-500">{i + 1}. durak · {num(t.dist)} puan</div>
                <div className="font-mono text-[13px] font-bold text-slate-100">{num(t.price)}</div>
                <div className="truncate text-[11px] text-slate-400">{t.label}</div>
              </div>
            ))}
            {w.invalidation != null && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1">
                <div className="text-[10.5px] text-amber-300/80">iptal</div>
                <div className="font-mono text-[13px] font-bold text-amber-300">5m kapanış {w.side === "LONG" ? "<" : ">"} {num(w.invalidation)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* alıcı / satıcı izleri */}
      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2">
        {([["▲ Alıcı izleri", w.bullWhy, "#4ade80"], ["▼ Satıcı izleri", w.bearWhy, "#f87171"]] as const).map(([t, list, c]) => (
          <div key={t} className="bg-[#0f141d] px-3 py-2">
            <div className="mb-1 text-[12px] font-semibold" style={{ color: c }}>{t}</div>
            {list.length === 0 ? <div className="text-[12px] text-slate-500">belirgin iz yok</div> : (
              <ul className="flex flex-col gap-1 text-[12px] leading-snug text-slate-200">
                {list.map((x, i) => <li key={i} className="flex gap-1.5"><span style={{ color: c }}>•</span><span>{x}</span></li>)}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* ölçüm kutucukları */}
      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] sm:grid-cols-2 xl:grid-cols-4">
        <FlowTile
          title="Hacim profili · POC"
          value={prof ? num(prof.poc) : "—"}
          tone="#fb923c"
          status={prof ? (
            px > prof.vah ? <b className="text-[#4ade80]">değer alanı ÜSTÜNDE → yukarıda kabul arıyor</b>
              : px < prof.val ? <b className="text-[#f87171]">değer alanı ALTINDA → aşağıda kabul arıyor</b>
              : <span>değer alanı içinde → POC&apos;a dönüş eğilimi</span>
          ) : "veri yok"}
        >
          {prof && (
            <>
              <div className="font-mono text-[11.5px] text-slate-400">alan {num(prof.val)} – {num(prof.vah)} · 1 saat kayma <b className={prof.pocShift > 0 ? "text-[#4ade80]" : prof.pocShift < 0 ? "text-[#f87171]" : "text-slate-300"}>{signed(prof.pocShift)}</b></div>
              <div className="flex flex-wrap gap-1 font-mono text-[10.5px] text-slate-500">
                {prof.pocPath.map((pp) => <span key={pp.clock} className="rounded bg-[#151c28] px-1">{pp.clock} {num(pp.poc)}</span>)}
              </div>
            </>
          )}
        </FlowTile>
        <FlowTile
          title="Kümülatif delta"
          value={fmtD(f.cumDelta)}
          tone={f.cumDelta >= 0 ? "#4ade80" : "#f87171"}
          status={<>son 30 dk <b className={f.delta30 >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{fmtD(f.delta30)}</b>{f.deltaPct30 != null && <> · %{Math.round(f.deltaPct30 * 100)} {Math.abs(f.deltaPct30) < 0.12 ? "dengede" : f.deltaPct30 > 0 ? "alıcı baskın" : "satıcı baskın"}</>}</>}
          note="Kapanış konumundan tahmin — fiyat yeni dip yaparken delta yükseliyorsa gizli alım (uyumsuzluk) var demektir."
        />
        <FlowTile
          title="Sıkışma · ivme"
          value={f.compression.active ? "SIKIŞMA" : "yok"}
          tone={f.compression.active ? "#fbbf24" : "#94a3b8"}
          status={<>{f.compression.ratio != null && <>mum boyu ortalamanın {f.compression.ratio.toFixed(2)}×</>}{f.compression.boxHigh != null && f.compression.boxLow != null && <> · kutu {num(f.compression.boxLow)} – {num(f.compression.boxHigh)}</>}</>}
        >
          <div className="text-[12px]">{f.accel.text ? <b className={f.accel.dir > 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{f.accel.text}</b> : <span className="text-slate-400">ivme artışı yok</span>}</div>
        </FlowTile>
        <FlowTile title="Likidite havuzları · stop kümeleri" note="Fiyat bu seviyelere çekilir (stoplar orada). Fitille geçip geri dönerse = süpürme → dönüş sinyali.">
          <div className="flex flex-col gap-0.5 font-mono text-[12px]">
            {above.map((p) => <div key={`a${p.price}`} className="flex justify-between gap-2"><span className="text-[#4ade80]">▲ {num(p.price)}</span><span className="truncate text-slate-400">{p.label}</span><span className="text-slate-500">+{num(p.price - px)}</span></div>)}
            {below.map((p) => <div key={`b${p.price}`} className="flex justify-between gap-2"><span className="text-[#f87171]">▼ {num(p.price)}</span><span className="truncate text-slate-400">{p.label}</span><span className="text-slate-500">−{num(px - p.price)}</span></div>)}
            {above.length + below.length === 0 && <span className="font-sans text-slate-500">yakında süpürülmemiş havuz yok</span>}
          </div>
        </FlowTile>
      </div>

      {/* opsiyon seviyeleri — varsayılan gizli */}
      <div className="border-t border-[#1c2635] px-3 py-2">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOptOpen((v) => !v)} className="rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30">{optOpen ? "▴ gizle" : "▾ göster"}</button>
          <span className="text-[12px] font-semibold text-slate-200">Opsiyon seviyeleri</span>
          <span className="text-[11px] text-slate-500">{opt ? (opt.isZeroDte ? "0DTE" : `vade ${opt.expiry} (0DTE yok)`) : "opsiyon zinciri alınamadı"} · yalnız seviye, yön vermez</span>
        </div>
        {optOpen && opt && (
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11.5px]">
            {opt.callWalls.map((cw, i) => (
              <span key={`c${cw.strike}`} className="rounded border border-[#ef4444]/30 bg-[#ef4444]/10 px-1.5 py-0.5 text-[#f87171]" title="Dünkü açık pozisyon (OI) — fiyat yukarıdan bu seviyeye çarpma eğilimi">
                call{i ? " 2" : ""} <b>{num(cw.strike)}</b> <span className="text-slate-500">{Math.round(cw.openInterest / 1000)}K · {num(cw.strike - (price ?? opt.spot))}</span>
              </span>
            ))}
            {opt.putWalls.map((pw, i) => (
              <span key={`p${pw.strike}`} className="rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-1.5 py-0.5 text-[#4ade80]" title="Dünkü açık pozisyon (OI) — fiyat aşağıdan bu seviyeye çarpma eğilimi">
                put{i ? " 2" : ""} <b>{num(pw.strike)}</b> <span className="text-slate-500">{Math.round(pw.openInterest / 1000)}K · {num(pw.strike - (price ?? opt.spot))}</span>
              </span>
            ))}
            {opt.maxPain != null && (
              <span className="rounded border border-slate-600 bg-slate-700/20 px-1.5 py-0.5 text-slate-200" title="Vade sonunda opsiyon yazarlarının kaybını en aza indiren fiyat — gün sonuna doğru mıknatıs etkisi">
                max pain <b>{num(opt.maxPain)}</b> <span className="text-slate-500">{num(opt.maxPain - (price ?? opt.spot))}</span>
              </span>
            )}
            {opt.callPutOi != null && <span className="text-slate-500">C/P {opt.basis} {opt.callPutOi.toFixed(2)}</span>}
            {opt.basis === "hacim" && <span className="text-amber-300/90">· OI henüz yok (açılış öncesi) — son işlem günü hacmiyle</span>}
          </div>
        )}
        {optOpen && <div className="mt-1 text-[10.5px] leading-snug text-slate-500">
          OI dünkü kapanış değeridir (vade günü değişmez); açılış öncesi 0DTE OI henüz yayınlanmadığından son işlem günü hacmi kullanılır. ±%3 pencere; veri gecikmeli olabilir. Duvarlar fiyatı çeker/durdurur — yön vermez.
        </div>}
      </div>

      {/* olaylar */}
      {f.events.length > 0 && (
        <div className="border-t border-[#1c2635] px-3 py-2">
          <div className="mb-1 text-[12px] font-semibold text-slate-200">Akıllı para olayları <span className="font-normal text-slate-500">· en yeni üstte</span></div>
          <div className="flex max-h-[170px] flex-col overflow-y-auto">
            {f.events.slice().reverse().slice(0, 12).map((e) => (
              <div key={`${e.kind}${e.time}`} className="grid grid-cols-[44px_118px_minmax(0,1fr)] items-baseline gap-2 border-b border-[#151c28] py-1 text-[12px] last:border-0">
                <span className="font-mono text-slate-400">{e.clock}</span>
                <span className={`rounded px-1.5 py-[1px] text-center font-mono text-[10.5px] font-semibold ${e.bias > 0 ? "bg-[#22c55e]/15 text-[#4ade80]" : "bg-[#ef4444]/15 text-[#f87171]"}`}>{EVENT_TAG[e.kind]}</span>
                <span className="leading-snug text-slate-300">{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
        Hazırlık: bir tarafın puanı ≥ 3 ve karşı taraftan 1,5 fazla. Hareket başladı: buna ek olarak son 2 mumda kurumsal itki, açılış aralığı ya da 30 dk kutusu hacimle kırıldı.
        Alıcı/satıcı hacmi ve &quot;akıllı para&quot; etiketleri fiyat–hacim davranışından çıkarımdır, emir defteri verisi değildir.
      </div>
    </div>
  );
}

// ── Açılış tahmini paneli (04:00 Londra → 09:30 New York) ─────────

const pctTxt = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const pctCls = (v: number | null) => (v == null ? "text-slate-500" : v > 0.02 ? "text-[#4ade80]" : v < -0.02 ? "text-[#f87171]" : "text-slate-300");

function Hideable({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  if (open) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={onToggle} className="self-end rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30">▴ {title} gizle</button>
        {children}
      </div>
    );
  }
  return (
    <div className={`${SURFACE} flex items-center justify-between px-3 py-1.5`}>
      <span className="text-[12px] font-semibold text-slate-300">{title}</span>
      <button type="button" onClick={onToggle} className="rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30">▾ göster</button>
    </div>
  );
}

function OpenForecastPanel({ r, compact }: { r: OpenForecastRead | null; compact: boolean }) {
  if (!r) {
    return (
      <div className={`${SURFACE} px-4 py-3 text-[12px] text-slate-400`}>
        <span className="font-semibold text-slate-200">Açılış Tahmini</span> — vadeli işlem verisi bekleniyor (ES · NQ · RTY · YM · VIX).
      </div>
    );
  }
  const f = r.now ?? [...r.checkpoints].reverse().find((c) => c.forecast)?.forecast ?? null;

  // Açılıştan sonra: tek satır sonuç
  if (compact) {
    const a = r.actual;
    return (
      <div className={`${SURFACE} flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[12px]`}>
        <span className="font-semibold text-slate-200">Açılış Tahmini · {r.session}</span>
        {a ? (
          <>
            <span className="text-slate-400">son tahmin (09:25) <b className="font-mono text-slate-100">{a.lastForecast != null ? num(a.lastForecast) : "—"}</b></span>
            <span className="text-slate-400">gerçek açılış <b className="font-mono text-slate-100">{num(a.open)}</b></span>
            {a.error != null && (
              <span className={a.inBand ? "text-[#4ade80]" : "text-amber-300"}>
                hata {a.error >= 0 ? "+" : ""}{num(a.error)} puan · {a.inBand ? "%80 aralık içinde ✓" : "aralık dışında"}
              </span>
            )}
          </>
        ) : (
          <span className="text-slate-500">açılış verisi bekleniyor</span>
        )}
      </div>
    );
  }

  const col = f?.dir === "UP" ? "#22c55e" : f?.dir === "DOWN" ? "#ef4444" : "#eab308";
  const confCls =
    f?.confidence === "YÜKSEK" ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]"
    : f?.confidence === "ORTA" ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
    : "border-slate-600 bg-slate-700/20 text-slate-300";

  return (
    <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${col}66` }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-4 py-2">
        <span className="text-[13px] font-semibold text-slate-200">
          Açılış Tahmini <span className="hidden text-[11px] font-normal text-slate-400 sm:inline">· {r.session} seansı · ES fair value (dünkü kapanış {num(r.prevClose)} × ES değişimi)</span>
        </span>
        <span className="flex flex-wrap gap-1 font-mono text-[11px]">
          {r.checkpoints.map((c) => (
            <span
              key={c.label}
              title={c.name}
              className={`rounded border px-1.5 py-0.5 ${c.forecast ? "border-[#1c2635] bg-[#0a0e17] text-slate-200" : "border-[#1c2635] text-slate-600"}`}
            >
              {c.label} {c.forecast ? `${num(c.forecast.center)} ±${num((c.forecast.hi - c.forecast.lo) / 2)}` : "—"}
            </span>
          ))}
        </span>
      </div>

      {!f ? (
        <div className="px-4 py-4 text-[12px] text-slate-400">Vadeli işlemlerde dünkü 16:00 referansı bulunamadı.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3" style={{ backgroundColor: `${col}10` }}>
            <div>
              <div className="text-[22px] font-extrabold leading-none tracking-wide" style={{ color: col }}>
                {f.dir === "UP" ? "▲ YUKARI AÇILIŞ" : f.dir === "DOWN" ? "▼ AŞAĞI AÇILIŞ" : "◆ YATAY AÇILIŞ"}
              </div>
              <div className="mt-1 text-[12px] text-slate-400">
                gap {f.gap >= 0 ? "+" : ""}{num(f.gap)} puan ({pctTxt(f.gapPct)}) · açılışa {f.minutesToOpen} dk
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">beklenen açılış</div>
              <div className="font-mono text-[26px] font-black leading-none text-slate-100">${num(f.center)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">%80 aralık</div>
              <div className="font-mono text-[16px] font-bold text-slate-200">{num(f.lo)} – {num(f.hi)}</div>
            </div>
            <div className={`rounded border px-2.5 py-1 text-[12px] font-semibold ${confCls}`}>
              güven {f.confidence} · geçmiş yön isabeti %{f.dirHitPct}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-3">
            <div className="bg-[#0f141d] px-4 py-2">
              <div className="mb-1 text-[11px] font-semibold text-slate-300">Vadeliler (dünkü 16:00&apos;dan)</div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[12px]">
                {(["ES", "NQ", "RTY", "YM", "VIX"] as const).map((k) => (
                  <span key={k} className="rounded bg-[#0a0e17] px-1.5 py-0.5">
                    <span className="text-slate-400">{k}</span> <b className={k === "VIX" ? "text-slate-200" : pctCls(f.changes[k])}>{pctTxt(f.changes[k])}</b>
                  </span>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">ES ile aynı yönde: {f.agree}/3 (NQ · RTY · YM)</div>
            </div>
            <div className="bg-[#0f141d] px-4 py-2">
              <div className="mb-1 text-[11px] font-semibold text-slate-300">ES eğilimi (bağlam)</div>
              <div className="flex flex-wrap gap-1.5 text-[12px]">
                {r.trend.map((t) => (
                  <span
                    key={t.tf}
                    title={t.text}
                    className={`rounded border px-1.5 py-0.5 ${t.dir === "UP" ? SIDE_CHIP.ABOVE : t.dir === "DOWN" ? SIDE_CHIP.BELOW : SIDE_CHIP.AT}`}
                  >
                    {t.tf} {t.dir === "UP" ? "▲ yukarı" : t.dir === "DOWN" ? "▼ aşağı" : "◆ yatay"}
                  </span>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Tahmine girmez — yalnızca gece boyunca oluşan eğilim.</div>
            </div>
            <div className="bg-[#0f141d] px-4 py-2">
              <div className="mb-1 text-[11px] font-semibold text-slate-300">SPY premarket</div>
              <div className="font-mono text-[13px] text-slate-200">
                {f.spyPre != null ? <>son {num(f.spyPre)} · fair value&apos;dan {f.spyPrePremium != null && f.spyPrePremium >= 0 ? "+" : ""}{num(f.spyPrePremium)}</> : "henüz işlem yok"}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Çapraz kontrol — premarket likiditesi ince; ölçümde ES daha isabetli.</div>
            </div>
          </div>

          <ul className="flex flex-col gap-0.5 border-t border-[#1c2635] px-4 py-2 text-[12px] leading-snug text-slate-300">
            {f.notes.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
          <div className="border-t border-[#1c2635] px-4 py-1.5 text-[11px] leading-snug text-slate-500">
            58 seans ölçümü (ES fair value): ort. hata 04:00 1,79 · 07:00 1,41 · 08:30 0,79 · 09:00 0,50 · 09:25 0,31 puan; gap yönü %74 → %100.
            Aralık bu ölçümün %80 kapsamasıdır. Açılış yönü işlem kararı değildir — gün yönü 09:55 kuralıyla belirlenir.
          </div>
        </>
      )}
    </div>
  );
}

// ── Tahmin günlüğü paneli ─────────────────────────────────────────

interface JournalResp {
  stats: JournalStats;
  learned: { stageStats: Record<string, { hit60: number; hitClose: number }> | null; bandScale: Record<string, number> | null; openBias?: Record<string, number> | null };
  openBiasAll?: Record<string, { n: number; bias: number; sig: boolean }>;
  minN: number;
  recent: JournalDay[];
  model?: ForecastModel;
  fstats?: ForecastStats;
}

const okMark = (v: boolean | null) => (v == null ? <span className="text-slate-600">·</span> : v ? <span className="text-[#4ade80]">✓</span> : <span className="text-[#f87171]">✕</span>);
const dirMark = (d: string | null) => (d === "UP" ? "▲" : d === "DOWN" ? "▼" : d === "MIXED" ? "◆" : "·");

function JournalPanel({ j }: { j: JournalResp | null }) {
  if (!j) {
    return <div className={`${SURFACE} px-4 py-3 text-[12px] text-slate-400`}><b className="text-slate-200">Tahmin Günlüğü</b> — yükleniyor.</div>;
  }
  const st = j.stats;
  const f925 = st.forecast["09:25"], f400 = st.forecast["04:00"];
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-4 py-2">
        <span className="text-[13px] font-semibold text-slate-200">
          Tahmin Günlüğü <span className="hidden text-[11px] font-normal text-slate-400 sm:inline">· her seans kaydedilir, gerçekleşenle kıyaslanır · {st.n} gün ({st.liveN} canlı, {st.n - st.liveN} geriye dönük)</span>
        </span>
        <span className="text-[11px] text-slate-400">
          öğrenme: {j.minN}+ kayıtta aşama isabetleri ve açılış aralığı gerçekleşenden hesaplanır
          {j.learned.stageStats ? " · AKTİF" : " · bekleniyor"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-[#1c2635] md:grid-cols-3">
        <div className="bg-[#0f141d] px-4 py-2 text-[12px] text-slate-300">
          <div className="mb-1 text-[11px] font-semibold text-slate-400">Açılış tahmini (gerçekleşen)</div>
          {(["04:00", "07:00", "08:30", "09:25"] as const).map((k) => {
            const f = st.forecast[k];
            return f ? (
              <div key={k} className="font-mono text-[12px]">
                {k} · ort. hata {num(f.meanErr)} · aralık içi %{f.inBandPct} · gap yönü {f.dirPct != null ? `%${f.dirPct}` : "—"}
                {j.openBiasAll?.[k] && (
                  <span className={j.openBiasAll[k].sig ? "text-sky-300" : "text-slate-500"}>
                    {" "}· sapma {j.openBiasAll[k].bias >= 0 ? "+" : ""}{num(j.openBiasAll[k].bias)}{j.openBiasAll[k].sig ? " (öğrenildi, tahmine uygulanıyor)" : " (anlamsız, uygulanmıyor)"}
                  </span>
                )}
              </div>
            ) : null;
          })}
          {!f925 && !f400 && <div className="text-slate-500">henüz kayıt yok</div>}
        </div>
        <div className="bg-[#0f141d] px-4 py-2 text-[12px] text-slate-300">
          <div className="mb-1 text-[11px] font-semibold text-slate-400">Açılış aşamaları (yön verdiği günler)</div>
          {Object.entries(st.stages).map(([k, v]) => (
            <div key={k} className="font-mono text-[12px]">
              {k} · 60 dk %{v.hit60} · kapanış %{v.hitClose} <span className="text-slate-500">(n={v.n})</span>
            </div>
          ))}
        </div>
        <div className="bg-[#0f141d] px-4 py-2 text-[12px] text-slate-300">
          <div className="mb-1 text-[11px] font-semibold text-slate-400">Gün yönü kararı</div>
          <div className="font-mono">60 dk %{st.decision.hit60} · kapanış %{st.decision.hitClose} <span className="text-slate-500">(n={st.decision.n})</span></div>
          {Object.entries(st.decision.byWhen).map(([k, v]) => (
            <div key={k} className="font-mono text-[12px] text-slate-400">
              {k === "EMA" ? "EMA20 (zayıf)" : `${k} kararı`} · kapanış %{v.hitClose} <span className="text-slate-500">(n={v.n})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border-t border-[#1c2635]">
        <table className="w-full text-left font-mono text-[11.5px]">
          <thead className="text-slate-500">
            <tr className="border-b border-[#1c2635]">
              <th className="px-3 py-1 font-normal">gün</th>
              <th className="px-2 py-1 font-normal">09:25 tahmin → açılış</th>
              <th className="px-2 py-1 font-normal">hata</th>
              <th className="px-2 py-1 font-normal">09:35 · 09:40 · 09:45 · 09:50 · 09:55 · 10:00</th>
              <th className="px-2 py-1 font-normal">gün yönü</th>
              <th className="px-2 py-1 font-normal">60 dk</th>
              <th className="px-2 py-1 font-normal">kapanış</th>
              <th className="px-2 py-1 font-normal">12:00 kapanış tahmini → gerçek</th>
              <th className="px-2 py-1 font-normal">saatlik bant isabeti</th>
            </tr>
          </thead>
          <tbody>
            {j.recent.slice(0, 10).map((d) => {
              const f = d.forecasts.find((x) => x.label === "09:25");
              return (
                <tr key={d.date} className="border-b border-[#151c28] text-slate-300">
                  <td className="px-3 py-1">{d.date.slice(5)}{d.backfill && <span className="text-slate-600">*</span>}</td>
                  <td className="px-2 py-1">{f ? `${num(f.center)} → ${num(d.open)}` : "—"}</td>
                  <td className="px-2 py-1">{f ? <>{f.error >= 0 ? "+" : ""}{num(f.error)} {okMark(f.inBand)}</> : "—"}</td>
                  <td className="px-2 py-1 tracking-wider">
                    {d.stages.map((x) => (
                      <span key={x.clock} title={`${x.clock}: ${x.dir ?? "—"}`} className={x.dir === "UP" ? "text-[#4ade80]" : x.dir === "DOWN" ? "text-[#f87171]" : "text-slate-500"}>
                        {dirMark(x.dir)}{" "}
                      </span>
                    ))}
                  </td>
                  <td className="px-2 py-1">
                    <span className={d.decision.side === "UP" ? "text-[#4ade80]" : d.decision.side === "DOWN" ? "text-[#f87171]" : "text-slate-500"}>
                      {d.decision.side === "UP" ? "▲ YÜKSELİŞ" : d.decision.side === "DOWN" ? "▼ DÜŞÜŞ" : "◆ yok"}
                    </span>
                    <span className="text-slate-500"> {d.decision.decidedAt ?? ""}</span>
                  </td>
                  <td className="px-2 py-1">{okMark(d.decision.ok60)}</td>
                  <td className="px-2 py-1">{okMark(d.decision.okClose)}</td>
                  <td className="px-2 py-1">
                    {(() => {
                      const c = d.fl?.close.find((x) => x.at === 720);
                      if (!c) return "—";
                      const inB = d.close >= c.lo && d.close <= c.hi;
                      return <>{num(c.lo)}–{num(c.hi)} → {num(d.close)} {okMark(inB)}</>;
                    })()}
                  </td>
                  <td className="px-2 py-1">
                    {(() => {
                      const hs = d.fl?.hours ?? [];
                      const ok = hs.filter((h) => { const f = d.fm?.hours.find((x) => x.h === h.h); const a = f && f.next.length === 12 ? f.next[11] : null; return a != null && a >= h.lo && a <= h.hi; }).length;
                      return hs.length ? `${ok}/${hs.length}` : "—";
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#1c2635] px-4 py-1.5 text-[11px] leading-snug text-slate-500">
        * geriye dönük doldurulan gün (o günün kodu değil, bugünkü kurallarla hesaplandı). Canlı kayıtlar dondurulur — sonradan değişmez.
        Seans 16:05 ET&apos;den sonra kaydedilir.
      </div>
    </div>
  );
}

// ── Senaryo paneli: gün tipi + iki bacak (yön → direnç/destek → dönüş) + 0DTE prim tahmini ──

/** Senaryo paneline özel petrol mavisi zemin (okunurluk için diğer kartlardan ayrışır) */
const PETROL = { bg: "#0b2f3a", cell: "#0e3a47" };

function LegBox({ n, leg, conditional }: { n: number; leg: Leg; conditional: boolean }) {
  const col = leg.side === "CALL" ? "#22c55e" : "#ef4444";
  return (
    <div className="px-4 py-2.5" style={{ backgroundColor: PETROL.cell }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-bold" style={{ color: col }}>
          {n}. bacak · {leg.side === "CALL" ? "▲ CALL" : "▼ PUT"} {leg.strike}
          {conditional && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-300">KOŞULLU</span>}
        </span>
        <span className="font-mono text-[12px] text-slate-400">~{leg.etaMin} dk</span>
      </div>
      <div className="mt-1 font-mono text-[15px] text-slate-100">
        {num(leg.from)} → <b style={{ color: col }}>{num(leg.to)}</b> <span className="text-[12px] text-slate-400">({num(leg.dist)} puan · {leg.toLabel})</span>
      </div>
      <div className="mt-1 font-mono text-[12px] text-slate-300">
        prim ≈ {num(leg.premiumIn)} → {num(leg.premiumOut)} · <b className={leg.multiple >= 2 ? "text-[#4ade80]" : leg.multiple >= 1.3 ? "text-amber-300" : "text-[#f87171]"}>{leg.multiple.toFixed(1)}x</b>
        <span className="text-slate-400"> ({leg.source})</span>
      </div>
      <div className="mt-1 text-[11.5px] leading-snug text-slate-400">{leg.odds}</div>
    </div>
  );
}

function ScenarioPanel({ sc, expectation, waitReason }: { sc: Scenario | null; expectation: string | null; waitReason: string | null }) {
  return (
    <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: "#1d5a68", backgroundColor: PETROL.bg }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1d5a68] px-4 py-2">
        <span className="text-[13px] font-semibold text-slate-200">
          Senaryo · ön plan <span className="hidden text-[11px] font-normal text-slate-400 sm:inline">· gün yönü 09:55–10:00&apos;da kilitlenince bu plan günün senaryosuna dönüşür ve gün boyu TAKİP edilir</span>
        </span>
      </div>
      {expectation && <div className="border-b border-[#1d5a68] px-4 py-1.5 text-[12px] text-slate-300">Beklenti: {expectation}</div>}
      {waitReason || !sc ? (
        <div className="px-4 py-3 text-[12.5px] text-slate-300">
          <b className="text-amber-300">◆ BEKLE</b> — {waitReason ?? "yön ya da hedef seviyesi yok."}
        </div>
      ) : (
        <>
          <div className="px-4 py-1.5 text-[12px] text-slate-400">
            Ön yön: <b className={sc.dir === "UP" ? "text-[#4ade80]" : "text-[#f87171]"}>{sc.dir === "UP" ? "▲ YUKARI" : "▼ AŞAĞI"}</b> · kaynak: {sc.dirSource}
          </div>
          <div className="grid grid-cols-1 gap-px border-t border-[#1d5a68] bg-[#1d5a68] md:grid-cols-2">
            {sc.leg1 ? <LegBox n={1} leg={sc.leg1} conditional={false} /> : <div className="px-4 py-3 text-[12px] text-slate-300" style={{ backgroundColor: PETROL.cell }}>1. bacak için hedef seviye yok.</div>}
            {sc.leg2 ? <LegBox n={2} leg={sc.leg2} conditional /> : <div className="px-4 py-3 text-[12px] text-slate-300" style={{ backgroundColor: PETROL.cell }}>2. bacak (dönüş) için girişin öbür tarafında seviye yok.</div>}
          </div>
          <ul className="border-t border-[#1d5a68] px-4 py-1.5 text-[11.5px] leading-snug text-slate-400">
            {sc.notes.map((x, i) => <li key={i}>• {x}</li>)}
            <li>• 2. bacak yalnızca trend değişimi teyit edilirse (Senaryo Takibi: &quot;TREND DEĞİŞTİ&quot;) ve 5m dönüş işareti gelirse düşünülmeli.</li>
          </ul>
        </>
      )}
    </div>
  );
}

// ── Senaryo TAKİBİ: günün ilk senaryosu, gün boyu aynı çapa ──────────

const STATUS_STYLE: Record<TrackStatus, { col: string; icon: string }> = {
  "TREND ONAYLI": { col: "#22c55e", icon: "✔" },
  "ONAY BEKLENİYOR": { col: "#60a5fa", icon: "…" },
  ONAYSIZ: { col: "#eab308", icon: "◆" },
  ZAYIFLIYOR: { col: "#f97316", icon: "⚠" },
  DEĞİŞTİ: { col: "#ef4444", icon: "✕" },
};

function LegStrip({ chain }: { chain: LegChain }) {
  if (!chain.legs.length && !chain.pending) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[#1d5a68] px-4 py-1.5 font-mono text-[11.5px]">
      <span className="font-sans text-[11px] font-semibold text-slate-400">Günün bacakları:</span>
      {chain.legs.map((L, i) => {
        const up = L.anchor.dir === "UP";
        const done = !!L.exit;
        const res = L.exit ? L.exit.pnl : null;
        return (
          <span key={i} className={`rounded border px-1.5 py-0.5 ${done ? "border-slate-600 text-slate-400" : up ? "border-[#22c55e]/60 bg-[#22c55e]/10 text-[#4ade80]" : "border-[#ef4444]/60 bg-[#ef4444]/10 text-[#f87171]"}`}
            title={L.exit ? `${L.exit.clock}: ${L.exit.why}` : L.status}>
            {L.anchor.legNo}. {L.anchor.kind === "AÇILIŞ" ? "açılış" : "gün içi"} {L.anchor.clock} {up ? "▲" : "▼"} {num(L.anchor.entry)}
            {done ? <> → {L.exit!.clock} <b className={res! >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{res! >= 0 ? "+" : "−"}{Math.abs(res!).toFixed(2)}</b> <span className="text-slate-500">(tepe +{L.mfe.toFixed(2)})</span></> : <> · <b>{L.status}</b></>}
          </span>
        );
      })}
      {chain.pending && (
        <span className="rounded border border-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">… {chain.pending.dir === "UP" ? "▲ LONG" : "▼ SHORT"} tetiği hazırlanıyor</span>
      )}
    </div>
  );
}

function DayChip({ day, recent }: { day: DayTypeLive | null; recent: DayTypeLive | null }) {
  if (!day) return null;
  const col = (d: DayTypeLive) => (d.kind === "TREND" ? "#22c55e" : d.kind === "SIKIŞMA" ? "#eab308" : "#64748b");
  const c = col(day);
  const showRecent = recent && recent.kind !== day.kind && recent.kind !== "OLUŞUYOR";
  return (
    <>
      <span className="rounded border px-2 py-0.5 text-[12px] font-semibold" style={{ color: c, borderColor: `${c}66`, backgroundColor: `${c}14` }} title={day.text}>
        Gün tipi: {day.headline}
      </span>
      {showRecent && (
        <span className="rounded border px-2 py-0.5 text-[12px] font-semibold" style={{ color: col(recent), borderColor: `${col(recent)}66`, backgroundColor: `${col(recent)}14` }} title={`Son 2 saat (24×5m): ${recent.text}`}>
          Son 2 saat: {recent.headline}
        </span>
      )}
    </>
  );
}

function ScenarioTrackPanel({ t, chain, day, recent }: { t: TrackState | null; chain: LegChain; day: DayTypeLive | null; recent: DayTypeLive | null }) {
  const pending = chain.pending;
  const pendingBox = pending && (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2">
      <div className="text-[13.5px] font-extrabold text-amber-300">{pending.text}</div>
      <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-slate-200">
        {pending.have.map((h, i) => <li key={`h${i}`}>✔ {h}</li>)}
        {pending.need.map((h, i) => <li key={`n${i}`} className="text-amber-200">○ {h}</li>)}
      </ul>
      <div className="mt-1 text-[11px] text-slate-400">Koşulların hepsi kapanışla sağlanınca yeni bacak açılır (ilk stop: 5m kapanış VWAP&apos;ın ters tarafı). Kapanış gelmeden girmek erken giriştir.</div>
    </div>
  );
  if (!t) {
    return (
      <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: "#1d5a68", backgroundColor: PETROL.bg }}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1d5a68] px-4 py-2">
          <span className="text-[13px] font-semibold text-slate-200">
            Senaryo Takibi <span className="hidden text-[11px] font-normal text-slate-400 sm:inline">· sabah yön çıkmadı — gün içi yeni bacak tetiği aranıyor (alıcı/satıcı hamlesi, katalizör)</span>
          </span>
          <span className="flex flex-wrap gap-1.5"><DayChip day={day} recent={recent} /></span>
        </div>
        <LegStrip chain={chain} />
        {pendingBox}
        {!pending && (
          <div className="px-4 py-3 text-[12.5px] text-slate-300">
            <b className="text-amber-300">◆ BEKLE</b> — yön yok. Yeni bacak tetiği: 2×5m kapanış VWAP + EMA20&apos;nin aynı tarafında VE son 15m kapanış VWAP + EMA20(15m)&apos;nin aynı tarafında.
          </div>
        )}
        <LegFooter />
      </div>
    );
  }
  return <TrackCard t={t} chain={chain} day={day} recent={recent} pendingBox={pendingBox} />;
}

function LegFooter() {
  return (
    <div className="border-t border-[#1d5a68] px-4 py-1.5 text-[11px] leading-snug text-slate-400">
      Ölçüm (57 seans, 5m): açılış bacağında ilk hedefte çıkmak ort. +0,47 puan (%61); 10:30&apos;da trend onaylıysa taşımak +1,0 puan (%60), trend değişimi çıkışı en kötü günü −5,5 → −2,4&apos;e indirdi.
      Gün içi yeni bacaklar (54): ortalama tepe +1,6 puan ama kazanç oranı %31 ve ortalama ~0 — bunlar erken uyarıdır, kesin sinyal değil: seviyede kâr al, ilk stopa uy, taşıma.
      Tahmin/karar desteğidir; strike ve çıkış kararı sende.
    </div>
  );
}

function TrackCard({ t, chain, day, recent, pendingBox }: { t: TrackState; chain: LegChain; day: DayTypeLive | null; recent: DayTypeLive | null; pendingBox: ReactNode }) {
  const st = STATUS_STYLE[t.status];
  const a = t.anchor;
  const dirCol = a.dir === "UP" ? "#22c55e" : "#ef4444";
  return (
    <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${st.col}88`, backgroundColor: PETROL.bg }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1d5a68] px-4 py-2">
        <span className="text-[13px] font-semibold text-slate-200">
          Senaryo Takibi <span className="hidden text-[11px] font-normal text-slate-400 sm:inline">· {a.kind === "GÜN İÇİ" ? `${a.legNo}. bacak (gün içi, ${a.clock})` : `açılış senaryosu (${a.clock})`} — her dakika yeniden üretilmez, takip edilir; trend değişirse yeni bacak aranır</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <DayChip day={day} recent={recent} />
          <span className="rounded border px-2 py-0.5 text-[12px] font-bold" style={{ color: st.col, borderColor: `${st.col}77`, backgroundColor: `${st.col}18` }}>
            {st.icon} {t.status}
          </span>
        </span>
      </div>
      <LegStrip chain={chain} />
      {chain.counter && (
        <div className={`border-b px-4 py-2 ${chain.counter.level === "TAM" ? "border-orange-500/60 bg-orange-500/15" : "border-amber-500/40 bg-amber-500/10"}`}>
          <div className={`text-[13.5px] font-extrabold ${chain.counter.level === "TAM" ? "animate-pulse text-orange-300" : "text-amber-300"}`}>{chain.counter.text}</div>
        </div>
      )}
      {pendingBox}

      <div className="px-4 py-2.5" style={{ backgroundColor: `${st.col}12` }}>
        <div className="text-[15px] font-extrabold leading-snug sm:text-[17px]" style={{ color: st.col }}>{t.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12.5px] text-slate-200">
          <span>
            <b style={{ color: dirCol }}>{a.dir === "UP" ? "▲ LONG" : "▼ SHORT"}</b> {a.clock} giriş <b>{num(a.entry)}</b> → {t.exit ? <>çıkış <b>{num(t.exit.price)}</b> ({t.exit.clock})</> : <>şimdi <b>{num(t.price)}</b></>}
          </span>
          <span className={t.pnl >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{t.pnl >= 0 ? "+" : "−"}{Math.abs(t.pnl).toFixed(2)} puan ({t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(2)}%)</span>
          {t.mfe > 0.05 && <span className="text-slate-400">tepe +{t.mfe.toFixed(2)}{t.mfeClock ? ` (${t.mfeClock})` : ""}</span>}
          <span className="text-slate-400">önerilen: {a.option.side === "CALL" ? "▲ CALL" : "▼ PUT"} {a.option.strike}{t.optionMultiple != null ? <> · tahmini kat <b className="text-slate-200">≈{t.optionMultiple.toFixed(1)}x</b> <span className="text-slate-500">(model, gerçek prim farklı olabilir)</span></> : null}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-[#1d5a68] bg-[#1d5a68] md:grid-cols-2">
        <div className="px-4 py-2" style={{ backgroundColor: PETROL.cell }}>
          <div className="mb-1 text-[11.5px] font-semibold text-slate-300">Ne yapmalı</div>
          <ul className="flex flex-col gap-1 text-[12px] leading-snug text-slate-200">
            {t.lines.slice(1).map((l, i) => <li key={i} className={l.startsWith("⚠") ? "font-semibold text-orange-300" : ""}>• {l}</li>)}
            {t.ifNotIn && <li className="text-sky-300">• {t.ifNotIn}</li>}
          </ul>
        </div>
        <div className="px-4 py-2" style={{ backgroundColor: PETROL.cell }}>
          <div className="mb-1 text-[11.5px] font-semibold text-slate-300">Hedefler (girişte sabitlendi)</div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[12px]">
            {t.targets.length === 0 && !t.nextLevel && <span className="text-slate-400">ölçülmüş hedef seviyesi yok</span>}
            {t.targets.map((x, i) => (
              <span key={i} title={x.label} className={`rounded border px-1.5 py-0.5 ${x.hitClock ? "border-[#22c55e]/50 bg-[#22c55e]/15 text-[#4ade80]" : "border-[#1d5a68] text-slate-200"}`}>
                T{i + 1} <b>{num(x.price)}</b> {x.hitClock ? `✓ ${x.hitClock}` : <span className="text-slate-400">{x.label.slice(0, 22)}</span>}
              </span>
            ))}
          </div>
          {t.nextLevel && t.status !== "DEĞİŞTİ" && (
            <div className="mt-1.5 text-[12px] text-slate-300">
              Sıradaki seviye (güncel): <b className="font-mono text-slate-100">{num(t.nextLevel.price)}</b> <span className="text-slate-400">{t.nextLevel.label}</span>
            </div>
          )}
          <div className="mb-1 mt-2 text-[11.5px] font-semibold text-slate-300">Trend değişimi koşulları (15m kapanışla)</div>
          <div className="flex flex-col gap-1 text-[12px]">
            {t.rules.map((r, i) => {
              const c = r.state === "tetiklendi" ? "#ef4444" : r.state === "yakın" ? "#f97316" : "#22c55e";
              return (
                <div key={i} className="flex flex-wrap items-baseline justify-between gap-2" title={r.detail}>
                  <span className="text-slate-300">{r.label}</span>
                  <span className="font-mono" style={{ color: c }}>
                    {r.level != null ? num(r.level) : "—"}
                    {r.cushion != null && <span className="text-slate-400"> · pay {r.cushion >= 0 ? "+" : ""}{r.cushion.toFixed(2)}</span>} · {r.state === "ok" ? "güvenli" : r.state === "yakın" && r.cushion != null && r.cushion < 0 ? "fiyat geçti — 15m kapanış bekleniyor" : r.state}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {t.watch.length > 0 && (
        <ul className="border-t border-[#1d5a68] px-4 py-1.5 text-[11.5px] leading-snug text-slate-300">
          {t.watch.map((w, i) => <li key={i}>→ {w}</li>)}
        </ul>
      )}
      <LegFooter />
    </div>
  );
}


// ── EMA20 konumu: 5m + 15m kapanışların EMA20'ye göre tarafı, seri, mesafe, eğim ──

interface EmaTf {
  side: 1 | -1 | 0;
  streak: number;
  ema: number | null;
  dist: number | null;
  slope: number | null;
  clock: string | null;
}
interface EmaPos {
  m5: EmaTf;
  m15: EmaTf;
  dir: "UP" | "DOWN" | "MIXED";
  headline: string;
  text: string;
  /** Tek cümlelik sonuç */
  verdict: string;
}

function emaTf(s: DaySeries, ema: EmaMap, tfSec: number): EmaTf {
  const bars = s.bars;
  const n = bars.length;
  if (!n) return { side: 0, streak: 0, ema: null, dist: null, slope: null, clock: null };
  const last = bars[n - 1];
  const e = ema.get(last.time) ?? null;
  const sideOfBar = (i: number) => {
    const ee = ema.get(bars[i].time);
    return ee == null ? 0 : bars[i].close > ee ? 1 : bars[i].close < ee ? -1 : 0;
  };
  const side = sideOfBar(n - 1) as 1 | -1 | 0;
  let streak = 0;
  for (let i = n - 1; i >= 0 && side !== 0 && sideOfBar(i) === side; i--) streak++;
  const e3 = n >= 4 ? ema.get(bars[n - 4].time) ?? null : null;
  return {
    side, streak, ema: e,
    dist: e != null ? Math.round((last.close - e) * 100) / 100 : null,
    slope: e != null && e3 != null ? Math.round((e - e3) * 100) / 100 : null,
    clock: nyClock(last.time + tfSec),
  };
}

function emaPosition(s5: DaySeries, s15: DaySeries, ema5: EmaMap, ema15: EmaMap): EmaPos {
  const m5 = emaTf(s5, ema5, 300);
  const m15 = emaTf(s15, ema15, 900);
  const w = (x: EmaTf) => (x.side > 0 ? "üstünde" : x.side < 0 ? "altında" : "üzerinde");
  const sl = (x: EmaTf) => (x.slope == null ? "" : x.slope > 0.05 ? "yükselen" : x.slope < -0.05 ? "düşen" : "yatay");
  let dir: EmaPos["dir"] = "MIXED";
  let headline: string;
  let verdict: string;
  if (m5.side !== 0 && m5.side === m15.side) {
    dir = m5.side > 0 ? "UP" : "DOWN";
    const slopeOk = (m15.slope ?? 0) * m5.side > 0;
    headline = m5.side > 0 ? "YUKARI" : "AŞAĞI";
    verdict = slopeOk
      ? `İki zaman dilimi de EMA20 ${w(m5)} ve 15m EMA20 ${sl(m15)} — trend sağlıklı; geri çekilmelerde EMA20 destek/direnç.`
      : `İki zaman dilimi de EMA20 ${w(m5)} ama 15m EMA20 henüz ${sl(m15) || "yatay"} — yön yeni, teyit 15m eğimiyle gelir.`;
  } else if (m15.side !== 0 && m5.side === -m15.side) {
    headline = "GERİ ÇEKİLME";
    verdict = `5m EMA20 ${w(m5)}, 15m hâlâ ${w(m15)} → 15m yönüne karşı geri çekilme. 15m kapanış da EMA20'yi (${m15.ema != null ? num(m15.ema) : "—"}) kırarsa yön döner; kırmazsa 5m tekrar ${m15.side > 0 ? "üstüne" : "altına"} kapanış = devam tetiği.`;
  } else {
    headline = "KARARSIZ";
    verdict = "Kapanışlar EMA20 üzerinde — yön yok, kırılım yönünü bekle.";
  }
  const part = (tf: string, x: EmaTf) => `${tf} (${x.clock ?? "—"}): EMA20 ${x.ema != null ? num(x.ema) : "—"} ${w(x)}${x.streak ? `, ${x.streak} mumdur` : ""}${x.dist != null ? ` · mesafe ${x.dist >= 0 ? "+" : ""}${x.dist.toFixed(2)}` : ""}${x.slope != null ? ` · eğim ${x.slope >= 0 ? "+" : ""}${x.slope.toFixed(2)}/3 mum` : ""}`;
  return { m5, m15, dir, headline, text: `${part("5m", m5)}. ${part("15m", m15)}. ${verdict}`, verdict };
}


// ── Ortak durum kartı düzeni: başlık + etiket · büyük durum · tablo · sonuç ──

const UPC = "#22c55e", DNC = "#ef4444", MXC = "#eab308";
const dirCol = (d: number) => (d > 0 ? UPC : d < 0 ? DNC : MXC);

function StateCard({ title, hint, chip, chipCol, arrow, label, sub, col, children, verdict }: {
  title: string;
  hint?: string;
  chip?: string;
  chipCol?: string;
  arrow: string;
  label: string;
  sub?: string;
  col: string;
  children?: ReactNode;
  verdict?: ReactNode;
}) {
  return (
    <div className={`${SURFACE} flex flex-col overflow-hidden`} style={{ borderColor: `${col}55` }}>
      <div className="flex items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="min-w-0 truncate text-[13px] font-semibold text-slate-200" title={hint}>{title}</span>
        {chip && (
          <span className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: chipCol ?? col, borderColor: `${chipCol ?? col}66`, backgroundColor: `${chipCol ?? col}14` }}>{chip}</span>
        )}
      </div>
      <div className="flex items-center gap-3 px-3 py-2" style={{ backgroundColor: `${col}0d` }}>
        <span className="text-[30px] font-black leading-none" style={{ color: col }}>{arrow}</span>
        <div className="min-w-0">
          <div className="text-[18px] font-extrabold leading-tight tracking-wide" style={{ color: col }}>{label}</div>
          {sub && <div className="text-[11.5px] text-slate-400">{sub}</div>}
        </div>
      </div>
      {children && <div className="flex-1 px-3 py-1.5">{children}</div>}
      {verdict && <div className="border-t border-[#1c2635] px-3 py-1.5 text-[12px] leading-snug text-slate-300">{verdict}</div>}
    </div>
  );
}

/** Zaman dilimi tablosu: satır = 5m/15m, sütunlar serbest */
function TfTable({ head, rows }: { head: string[]; rows: { tf: string; cells: ReactNode[] }[] }) {
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10.5px] text-slate-500">
          <th className="py-0.5 pr-2 font-normal" />
          {head.map((h) => <th key={h} className="py-0.5 pr-2 font-normal">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tf} className="border-t border-[#151c28]">
            <td className="py-1 pr-2 font-mono font-bold text-slate-300">{r.tf}</td>
            {r.cells.map((c, i) => <td key={i} className="py-1 pr-2 font-mono">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const sideTxt = (s: VwapSide | null) => (s === "ABOVE" ? <span className="text-[#4ade80]">▲ üstünde</span> : s === "BELOW" ? <span className="text-[#f87171]">▼ altında</span> : s === "AT" ? <span className="text-slate-300">◆ üzerinde</span> : <span className="text-slate-500">—</span>);
const sgnTxt = (x: number | null, d = 2) => (x == null ? <span className="text-slate-500">—</span> : <span className={x > 0 ? "text-[#4ade80]" : x < 0 ? "text-[#f87171]" : "text-slate-300"}>{x >= 0 ? "+" : "−"}{Math.abs(x).toFixed(d)}</span>);

function VwapPositionCard({ live, vwap, price, info }: { live: LiveDirection | null; vwap: number | null; price: number | null; info: string }) {
  if (!live) {
    return <StateCard title="VWAP Konumu" arrow="…" label="BEKLENİYOR" col="#64748b" verdict="Güncel veri yok — 09:45 ET 15m kapanışına kadar yön okuması başlamaz." />;
  }
  const d = live.dir === "UP" ? 1 : live.dir === "DOWN" ? -1 : 0;
  return (
    <StateCard
      title="VWAP Konumu"
      hint="ham okuma: 5m + 15m kapanışın VWAP tarafı · işlem yönü Karar Desteği'nden"
      chip={live.aligned ? "5m + 15m TEYİTLİ" : "teyit yok"}
      chipCol={live.aligned ? dirCol(d) : MXC}
      arrow={d > 0 ? "▲" : d < 0 ? "▼" : "◆"}
      label={d > 0 ? "YUKARI" : d < 0 ? "AŞAĞI" : "KARARSIZ"}
      sub={`${live.strength} · ${info}`}
      col={dirCol(d)}
      verdict={<>{live.text}{!live.aligned && <span className="text-slate-400"> Teyit için 5m ve 15m kapanışın aynı tarafta olmasını bekle.</span>}</>}
    >
      <TfTable
        head={["kapanış", "taraf", "seri"]}
        rows={[
          { tf: "5m", cells: [<span key="c" className="text-slate-400">{live.asOf5}</span>, sideTxt(live.side5), <span key="s" className="text-slate-200">{live.streak5} mum</span>] },
          { tf: "15m", cells: [<span key="c" className="text-slate-400">{live.asOf15 ?? "—"}</span>, sideTxt(live.side15), <span key="s" className="text-slate-200">{live.streak15} mum</span>] },
        ]}
      />
      <div className="mt-1 flex justify-between font-mono text-[12px]">
        <span className="font-sans text-slate-500">VWAP</span>
        <span className="text-slate-200">{vwap != null ? num(vwap) : "—"}</span>
        <span>fiyat farkı {sgnTxt(vwap != null && price != null ? price - vwap : null)}</span>
      </div>
    </StateCard>
  );
}

function EmaPositionCard({ e }: { e: EmaPos | null }) {
  if (!e) return <StateCard title="EMA20 Konumu" arrow="…" label="BEKLENİYOR" col="#64748b" verdict="Güncel veri yok — kapanmış mum bekleniyor." />;
  const d = e.dir === "UP" ? 1 : e.dir === "DOWN" ? -1 : 0;
  const col = e.headline === "GERİ ÇEKİLME" ? MXC : dirCol(d);
  const row = (tf: string, x: EmaTf) => ({
    tf,
    cells: [
      <span key="e" className="text-slate-200">{x.ema != null ? num(x.ema) : "—"}</span>,
      x.side > 0 ? <span key="s" className="text-[#4ade80]">▲ üstünde</span> : x.side < 0 ? <span key="s" className="text-[#f87171]">▼ altında</span> : <span key="s" className="text-slate-300">◆ üzerinde</span>,
      <span key="n" className="text-slate-300">{x.streak}</span>,
      sgnTxt(x.dist),
      sgnTxt(x.slope),
    ],
  });
  return (
    <StateCard
      title="EMA20 Konumu"
      hint="5m + 15m kapanışın EMA20'ye göre tarafı, seri, mesafe, eğim (3 mum)"
      chip={e.dir !== "MIXED" ? "5m + 15m AYNI TARAF" : e.headline === "GERİ ÇEKİLME" ? "geri çekilme" : "teyit yok"}
      chipCol={col}
      arrow={e.headline === "GERİ ÇEKİLME" ? "↺" : d > 0 ? "▲" : d < 0 ? "▼" : "◆"}
      label={e.headline}
      sub={`5m ${e.m5.clock ?? "—"} · 15m ${e.m15.clock ?? "—"} kapanışı`}
      col={col}
      verdict={e.verdict}
    >
      <TfTable head={["EMA20", "taraf", "seri", "mesafe", "eğim"]} rows={[row("5m", e.m5), row("15m", e.m15)]} />
      <div className="mt-1 text-[11px] leading-snug text-slate-500">{e.text.slice(0, e.text.length - e.verdict.length).trim()}</div>
    </StateCard>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#151c28] py-[3px] text-[11.5px] last:border-0">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className="min-w-0 text-right text-slate-200">{children}</span>
    </div>
  );
}

function DayOverviewCard({ d, day, recent, chain, op }: {
  d: DecisionRead | null;
  day: DayTypeLive | null;
  recent: DayTypeLive | null;
  chain: LegChain | null;
  op: OpeningRegime | null;
}) {
  const kindCol = (x: DayTypeLive | null) => (x?.kind === "TREND" ? (x.side === "DOWN" ? DNC : UPC) : x?.kind === "SIKIŞMA" ? MXC : "#94a3b8");
  const col = kindCol(day);
  const cur = chain?.current ?? null;
  const curLive = cur && cur.status !== "DEĞİŞTİ" ? cur : null;
  const legDone = chain?.legs.filter((l) => l.exit) ?? [];
  const sgn = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`;
  const showRecent = recent && day && recent.kind !== day.kind && recent.kind !== "OLUŞUYOR";
  return (
    <StateCard
      title="Gün Geneli"
      hint="davranış temelli gün tipi + açılış kararı + bacak takibi"
      chip={showRecent ? `son 2 saat: ${recent!.headline}` : d ? `açılış ${num(d.day.open)}` : undefined}
      chipCol={showRecent ? kindCol(recent) : "#94a3b8"}
      arrow={day?.kind === "TREND" ? (day.side === "DOWN" ? "▼" : "▲") : "◆"}
      label={day ? day.headline.replace(/^TREND GÜNÜ.*/, "TREND GÜNÜ") : "GÜNCEL VERİ YOK"}
      sub={day && day.kind !== "OLUŞUYOR" ? `VWAP ${day.side === "DOWN" || (day.devNow ?? 0) < 0 ? "altında" : "üstünde"} %${Math.round(day.sideFrac * 100)} · ${day.crosses} kesişim` : day?.text}
      col={col}
      verdict={
        d ? (
          <div className="flex flex-col gap-1">
            <div>
              <div className="flex justify-between font-mono text-[10.5px] text-slate-500"><span>dip {num(d.day.low)}</span><span>aralık {num(d.day.high - d.day.low)}</span><span>tepe {num(d.day.high)}</span></div>
              <div className="relative h-1.5 rounded bg-gradient-to-r from-[#ef4444]/40 via-[#1c2635] to-[#22c55e]/40">
                {d.day.rangePos != null && <span className="absolute top-[-3px] h-3 w-1 rounded bg-slate-100" style={{ left: `calc(${Math.round(d.day.rangePos * 100)}% - 2px)` }} />}
              </div>
            </div>
            <div className="text-[11.5px] leading-snug text-slate-400">{d.day.text}</div>
            {d.day.buyShare != null && (
              <div>
                <div className="flex justify-between font-mono text-[10.5px]"><span className="text-[#4ade80]">alıcı %{Math.round(d.day.buyShare * 100)}</span><span className="text-[#f87171]">satıcı %{Math.round((1 - d.day.buyShare) * 100)}</span></div>
                <div className="flex h-1.5 overflow-hidden rounded"><span className="bg-[#22c55e]" style={{ width: `${d.day.buyShare * 100}%` }} /><span className="flex-1 bg-[#ef4444]" /></div>
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col">
        {d && (
          <Row k="Seans yönü (fiyat + hacim)">
            <b style={{ color: DIR_COLOR[d.day.dir] }}>{d.day.dir === "UP" ? "▲ YUKARI" : d.day.dir === "DOWN" ? "▼ AŞAĞI" : "◆ YATAY"}</b>
          </Row>
        )}
        <Row k="Açılış kararı">
          {!op || op.status === "WAITING" ? "—"
            : op.waitFor10 ? <span className="text-amber-300">{op.decidedAt === "09:55" ? "09:55 teyitsiz · giriş yok" : "10:00 bekleniyor"}</span>
            : op.net ? <b style={{ color: op.side === "UP" ? "#4ade80" : "#f87171" }}>NET {op.decidedAt} {op.side === "UP" ? "▲" : "▼"} · güven {op.dayHold?.level ?? "—"}</b>
            : <span className="text-amber-300">işlem yok (eğilim {op.side === "UP" ? "▲" : op.side === "DOWN" ? "▼" : "—"})</span>}
        </Row>
        <Row k="Güncel bacak">
          {curLive ? (
            <b style={{ color: curLive.anchor.dir === "UP" ? "#4ade80" : "#f87171" }}>
              {curLive.anchor.legNo}. {curLive.anchor.dir === "UP" ? "▲" : "▼"} {curLive.anchor.clock} · {curLive.status} · {sgn(curLive.pnl)}
            </b>
          ) : chain?.pending ? <span className="text-amber-300">yok · {chain.pending.dir === "UP" ? "▲ LONG" : "▼ SHORT"} tetiği hazırlanıyor</span>
            : <span className="text-slate-400">yok · tetik bekleniyor</span>}
        </Row>
        {(chain?.counter || curLive?.counterWarn) && (
          <Row k="Uyarı"><span className="text-orange-300">{chain?.counter ? `⚡ ters tetik (${chain.counter.level.toLowerCase()})` : "⚠ ters bacak hazırlanıyor"}</span></Row>
        )}
        {legDone.length > 0 && (
          <Row k="Biten bacaklar">
            <span className="font-mono">
              {legDone.map((l, i) => (
                <span key={i} className={l.exit!.pnl >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{i ? " · " : ""}{l.anchor.dir === "UP" ? "▲" : "▼"}{l.anchor.clock} {sgn(l.exit!.pnl)}</span>
              ))}
            </span>
          </Row>
        )}
        {d && (
          <Row k="Açılışa / VWAP'a göre">
            <span className="font-mono"><span className={d.day.vsOpen >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{sgn(d.day.vsOpen)}</span>{" / "}{d.day.vsVwap != null ? <span className={d.day.vsVwap >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{sgn(d.day.vsVwap)}</span> : "—"}</span>
          </Row>
        )}
      </div>
    </StateCard>
  );
}

// ── Pivot noktaları kartı: görsel merdiven + fiyatın pivotlara hareketi ──

const PIVOT_COLOR: Record<PivotKey, string> = { R3: "#16a34a", R2: "#22c55e", R1: "#4ade80", P: "#facc15", S1: "#f87171", S2: "#ef4444", S3: "#dc2626" };
const PIVOT_STATE_CLS: Record<string, string> = {
  "KIRILDI ▲": "border-[#22c55e]/50 bg-[#22c55e]/15 text-[#4ade80]",
  "KIRILDI ▼": "border-[#ef4444]/50 bg-[#ef4444]/15 text-[#f87171]",
  "TEST · TUTTU": "border-amber-500/50 bg-amber-500/15 text-amber-300",
  "ÜZERİNDE": "border-sky-500/50 bg-sky-500/15 text-sky-300",
  "DEĞMEDİ": "border-slate-700 text-slate-500",
};

function PivotCard({ p, price }: { p: PivotRead | null; price: number | null }) {
  if (!p) {
    return (
      <div className={`${SURFACE} px-3 py-2 text-[12px] text-slate-500`}>
        <span className="font-semibold text-slate-300">Pivot Noktaları</span> — güncel veri yok; önceki seansın yüksek/düşük/kapanışı bekleniyor.
      </div>
    );
  }
  const hcol = p.heading === "UP" ? UPC : p.heading === "DOWN" ? DNC : MXC;
  const maxAbs = Math.max(...p.ladder.map((l) => Math.abs(l.dist)), 0.5);
  // hedefe ilerleme: önceki pivot (ters taraftaki) → hedef
  const from = p.heading === "UP" ? p.below : p.heading === "DOWN" ? p.above : null;
  const prog = p.target && from && price != null ? Math.min(1, Math.max(0, (price - from.price) / (p.target.price - from.price))) : null;
  return (
    <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${hcol}55` }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">
          Pivot Noktaları <span className="hidden text-[11px] font-normal text-slate-500 sm:inline">· klasik günlük · {p.base.date}: Y {num(p.base.H)} · D {num(p.base.L)} · K {num(p.base.C)} · yalnız seviye, yön kararına girmez</span>
        </span>
        <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: hcol, borderColor: `${hcol}66`, backgroundColor: `${hcol}14` }}>bölge {p.zone}</span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-[#1c2635] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* görsel merdiven */}
        <div className="bg-[#0f141d] px-3 py-1.5">
          {p.ladder.map((l, i) => {
            const next = p.ladder[i + 1];
            const here = price != null && l.price >= price && (!next || next.price < price);
            const w = Math.round((Math.abs(l.dist) / maxAbs) * 100);
            const near = p.above?.key === l.key || p.below?.key === l.key;
            return (
              <Fragment key={l.key}>
                <div className={`grid grid-cols-[34px_72px_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-[3px] ${near ? "bg-[#151c28]" : ""}`}>
                  <span className="font-mono text-[12.5px] font-bold" style={{ color: PIVOT_COLOR[l.key] }}>{l.key}</span>
                  <span className="font-mono text-[12.5px] text-slate-100">{num(l.price)}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded bg-[#1c2635]">
                      <span className="block h-full rounded" style={{ width: `${w}%`, backgroundColor: l.dist >= 0 ? "#22c55e88" : "#ef444488" }} />
                    </span>
                    <span className={`w-12 text-right font-mono text-[11.5px] ${l.dist >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>{l.dist >= 0 ? "+" : "−"}{Math.abs(l.dist).toFixed(2)}</span>
                  </span>
                  <span className={`rounded border px-1.5 py-[1px] text-right text-[10.5px] font-semibold ${PIVOT_STATE_CLS[l.state] ?? ""}`}>{l.state}{l.touched ? ` · ${l.touched}` : ""}</span>
                </div>
                {here && (
                  <div className="my-0.5 flex items-center gap-1 text-[11px] font-semibold text-sky-300"><span className="h-px flex-1 bg-sky-400/70" />▶ fiyat {num(price!)}<span className="h-px flex-1 bg-sky-400/70" /></div>
                )}
              </Fragment>
            );
          })}
        </div>
        {/* hareket */}
        <div className="flex flex-col gap-2 bg-[#0f141d] px-3 py-2">
          <div>
            <div className="text-[11px] text-slate-500">Fiyatın pivotlara hareketi</div>
            <div className="text-[17px] font-extrabold leading-tight" style={{ color: hcol }}>
              {p.heading === "UP" ? "▲" : p.heading === "DOWN" ? "▼" : "◆"} {p.target ? `${p.target.key} ${num(p.target.price)}'e gidiyor` : p.heading === "FLAT" ? `${p.zone} arasında yatay` : "pivot dışı trend"}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[12px] text-slate-300">
              <span>30 dk hız {p.speed30 >= 0 ? "+" : ""}{p.speed30.toFixed(2)}</span>
              {p.target && price != null && <span>kalan {Math.abs(p.target.price - price).toFixed(2)} puan</span>}
              {p.etaMin != null && <span className="text-slate-400">~{p.etaMin} dk</span>}
            </div>
          </div>
          {prog != null && from && p.target && (
            <div>
              <div className="flex justify-between font-mono text-[10.5px] text-slate-500"><span>{from.key} {num(from.price)}</span><span>%{Math.round(prog * 100)}</span><span>{p.target.key} {num(p.target.price)}</span></div>
              <div className="h-2 overflow-hidden rounded bg-[#1c2635]"><span className="block h-full rounded" style={{ width: `${Math.round(prog * 100)}%`, backgroundColor: hcol }} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[12px]">
            {([["alttaki pivot", p.below, DNC], ["üstteki pivot", p.above, UPC]] as const).map(([t, l, c]) => (
              <div key={t} className="rounded border px-2 py-1" style={{ borderColor: `${c}44`, backgroundColor: `${c}0d` }}>
                <div className="font-sans text-[10.5px] text-slate-500">{t}</div>
                {l ? (
                  <>
                    <div><b style={{ color: c }}>{l.key} {num(l.price)}</b> <span className="text-slate-400">{l.dist >= 0 ? "−" : "+"}{Math.abs(l.dist).toFixed(2)}</span></div>
                    <span className={`mt-0.5 inline-block rounded border px-1 text-[10px] ${PIVOT_STATE_CLS[l.state] ?? ""}`}>{l.state}</span>
                  </>
                ) : "—"}
              </div>
            ))}
          </div>
          <div className="text-[12px] leading-snug text-slate-300">{p.text}</div>
          <div className="text-[10.5px] leading-snug text-slate-500">TEST · TUTTU = değdi, aynı tarafta kaldı (tepki seviyesi) · KIRILDI = açılıştaki tarafından öbür tarafa geçti · varış süresi son 30 dk hızı sabit kalırsa tahminidir.</div>
        </div>
      </div>
    </div>
  );
}

// ── SPY anlık fiyat şeridi (yapışkan): fiyat · son 1 saat · gün · VWAP/EMA20 · en yakın pivotlar ──

interface HiLo { hi: number; lo: number; hiClock: string; loClock: string }

function RangeBar({ label, r, price }: { label: string; r: HiLo | null; price: number | null }) {
  const pos = r && price != null && r.hi > r.lo ? Math.min(1, Math.max(0, (price - r.lo) / (r.hi - r.lo))) : null;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[10.5px] text-slate-500">
        <span>{label}</span>
        {r && <span className="font-mono">aralık {num(r.hi - r.lo)}</span>}
      </div>
      {r ? (
        <>
          <div className="flex justify-between font-mono text-[11.5px]">
            <span className="text-[#f87171]" title={`dip ${r.loClock}`}>▼ {num(r.lo)} <span className="text-[10px] text-slate-500">{r.loClock}</span></span>
            <span className="text-[#4ade80]" title={`tepe ${r.hiClock}`}><span className="text-[10px] text-slate-500">{r.hiClock}</span> {num(r.hi)} ▲</span>
          </div>
          <div className="relative mt-0.5 h-1.5 rounded bg-gradient-to-r from-[#ef4444]/40 via-[#1c2635] to-[#22c55e]/40">
            {pos != null && <span className="absolute top-[-3px] h-3 w-1 rounded bg-slate-100" style={{ left: `calc(${Math.round(pos * 100)}% - 2px)` }} />}
          </div>
        </>
      ) : <div className="font-mono text-[11.5px] text-slate-500">—</div>}
    </div>
  );
}

function DistRow({ k, v, price }: { k: string; v: number | null; price: number | null }) {
  const x = v == null || price == null ? null : price - v;
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[11.5px]">
      <span className="font-sans text-[10.5px] text-slate-500">{k}</span>
      <span className="text-slate-300">{v != null ? num(v) : "—"}</span>
      <span className={x == null ? "text-slate-500" : x >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{x == null ? "" : `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`}</span>
    </div>
  );
}

function PriceStrip({ price, change, changePct, badge, hour, day, vwap, ema, piv }: {
  price: number | null;
  change: number | null;
  changePct: number | null;
  badge: ReactNode;
  hour: HiLo | null;
  day: HiLo | null;
  vwap: number | null;
  ema: number | null;
  piv: PivotRead | null;
}) {
  return (
    <div className="-mx-2 mb-2 border-b border-[#1c2635] bg-[#0a0e17]/95 px-2 py-1.5 backdrop-blur sm:mx-0 sm:rounded-lg sm:border lg:sticky lg:top-0 lg:z-30">
      <div className="grid grid-cols-2 items-center gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr_1fr_auto] lg:grid-cols-[auto_1fr_1fr_auto_minmax(200px,auto)]">
        <div className="col-span-2 flex flex-wrap items-baseline gap-x-2 sm:col-span-1">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500">SPY</span>
          <span className="font-mono text-[26px] font-bold leading-none text-slate-50">{price == null ? "—" : `$${num(price)}`}</span>
          <span className={`font-mono text-[13px] font-semibold ${tone(changePct)}`}>
            {changePct == null ? "" : `${signed(change)} (${signed(changePct)}%)`}
          </span>
          <span className="ml-1">{badge}</span>
        </div>
        <RangeBar label="Son 1 saat" r={hour} price={price} />
        <RangeBar label="Gün (seans)" r={day} price={price} />
        <div className="min-w-[150px]">
          <DistRow k="VWAP" v={vwap} price={price} />
          <DistRow k="EMA20 5m" v={ema} price={price} />
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-4 lg:col-span-1">
          {piv ? (
            <div className="font-mono text-[11.5px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-[10.5px] text-slate-500">Pivot · {piv.zone}</span>
                <span className={piv.heading === "UP" ? "text-[#4ade80]" : piv.heading === "DOWN" ? "text-[#f87171]" : "text-slate-400"}>
                  {piv.heading === "UP" ? "▲" : piv.heading === "DOWN" ? "▼" : "◆"} 30dk {piv.speed30 >= 0 ? "+" : ""}{piv.speed30.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#f87171]">{piv.below ? `${piv.below.key} ${num(piv.below.price)} (−${Math.abs(piv.below.dist).toFixed(2)})` : "—"}</span>
                <span className="text-[#4ade80]">{piv.above ? `${piv.above.key} ${num(piv.above.price)} (+${Math.abs(piv.above.dist).toFixed(2)})` : "—"}</span>
              </div>
            </div>
          ) : <span className="text-[10.5px] text-slate-500">Pivot: önceki seans verisi bekleniyor</span>}
        </div>
      </div>
    </div>
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────

export default function SpyEngineV9() {
  const [toggles, setToggles] = useState<ChartToggles>(DEFAULT_TOGGLES);
  const [pollMs, setPollMs] = useState(1000);
  /** Açılış Rejimi kartı: göster / gizle */
  const [regimeOpen, setRegimeOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  /** Tickerlar varsayılan GİZLİ — "göster" deyince görünür */
  const [showTickers, setShowTickers] = useState(false);
  /** Açılış Tahmini / 15m-5m Grafikleri / Tahmin Günlüğü varsayılan GİZLİ */
  const [showOpenFc, setShowOpenFc] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showScenario, setShowScenario] = useState(false);
  const [showStops, setShowStops] = useState(false);
  const [alertSound, setAlertSound] = useState(true);
  const [replayDate, setReplayDate] = useState("");
  /** SL tamponu çarpanı (ATR15 x): 0,25 normal · 0,40 yüksek oynaklık · 0,50 veri/FOMC günü */
  const [stopMult, setStopMult] = useState(0.25);

  const [data, setData] = useState<StreamResponse | null>(null);
  const [m1, setM1] = useState<Bar[]>([]);
  const [m5, setM5] = useState<Bar[]>([]);
  const [m15, setM15] = useState<Bar[]>([]);

  const [quotes, setQuotes] = useState<StripQuote[]>([]);
  const [quotesAt, setQuotesAt] = useState<number | null>(null);
  /** Açılış tahmini (04:00 → 09:30): ES fair value, 60 sn'de bir */
  const [openFc, setOpenFc] = useState<OpenForecastRead | null>(null);
  /** Tahmin günlüğü + öğrenilen aşama isabetleri (30 dk'da bir) */
  const [journal, setJournal] = useState<JournalResp | null>(null);
  /** 0DTE opsiyon duvarları + max pain — yalnızca seviye (5 dk'da bir) */
  const [optLevelsLive, setOptLevels] = useState<OptionLevels | null>(null);
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

  // Tahmin günlüğü: açılışta bir kez + 30 dk'da bir (sunucu eksik seansları kendisi ekler)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/journal", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setJournal(json as JournalResp);
      } catch {
        // günlük ana akışı etkilemesin
      }
    };
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Açılış tahmini: canlı modda 60 sn'de bir (sunucu 60 sn önbellekler); replay'de anlamsız
  useEffect(() => {
    if (replayDate) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/openforecast", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok && json.read) setOpenFc(json.read as OpenForecastRead);
      } catch {
        // açılış tahmini ana akışı etkilemesin
      }
    };
    load();
    const id = setInterval(load, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [replayDate]);

  // Opsiyon seviyeleri: canlı modda 5 dk'da bir (sunucu da 5 dk önbellekler); replay'de güncel zincir anlamsız
  useEffect(() => {
    if (replayDate) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/optlevels", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok && json.levels) setOptLevels(json.levels as OptionLevels);
      } catch {
        // opsiyon seviyeleri ana akışı etkilemesin
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [replayDate]);

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

  /** Analiz mumları 1m akıştan türetilir (1,2 sn taze) — Yahoo'nun 5m/15m serisine bağlı değil */
  const m5D = useMemo(() => bucketAggregate(m1, 5), [m1]);
  const m15D = useMemo(() => bucketAggregate(m1, 15), [m1]);
  /** 30m — açılış ve gün içi genel gidişat */
  const m30D = useMemo(() => bucketAggregate(m1, 30), [m1]);
  const lastM1Time = m1.length ? m1[m1.length - 1].time : null;
  /** EMA20 — çok günlük akıştan ısınmış (seansın ilk mumlarında da değer var) */
  const ema5 = useMemo(() => emaByTime(m5D), [m5D]);
  const ema15 = useMemo(() => emaByTime(m15D), [m15D]);
  const ema30 = useMemo(() => emaByTime(m30D), [m30D]);

  const analysis = useMemo(() => {
    if (!date || !evalNow) return null;
    const s5 = daySeries(m5D, "5m", date, evalNow, lastM1Time);
    const s15 = daySeries(m15D, "15m", date, evalNow, lastM1Time);
    const s30 = daySeries(m30D, "30m", date, evalNow, lastM1Time);
    const opening = openingRegime(s5, s15, ema5, s30, journal?.learned.stageStats ?? null, data?.levels?.prevClose ?? null);
    // Açılışta (09:45'ten önce) karar verilmez; sonrası her kapanan 5m/15m mumla güncellenir
    const live = opening.status === "WAITING" ? null : liveDirection(s5, s15);
    return { s5, s15, s30, opening, live, c5: commentAll(s5, "5m", 40, ema5), c15: commentAll(s15, "15m", 40, ema15) };
    // her yeni kapanışta (lastClosed) yeniden hesaplanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m5D, m15D, m30D, ema5, ema15, date, lastM1Time, minuteSlot, journal?.learned.stageStats, data?.levels?.prevClose]);

  /** Oluşmakta olan mumların canlı yorumu (yalnızca canlı modda; karar mumu değil) */
  const forming5 = useMemo(
    () => (analysis && date && !replayDate && nowSec ? commentForming(m5D, analysis.s5, "5m", date, nowSec, ema5) : null),
    [analysis, m5D, ema5, date, replayDate, nowSec],
  );
  const forming15 = useMemo(
    () => (analysis && date && !replayDate && nowSec ? commentForming(m15D, analysis.s15, "15m", date, nowSec, ema15) : null),
    [analysis, m15D, ema15, date, replayDate, nowSec],
  );

  /** 15m yapı stopu: ATR15 yalnızca KAPANMIŞ seans 15m mumlarından */
  const stops = useMemo(() => {
    if (!analysis || !evalNow) return null;
    const closed = m15D.filter((b) => isRthBar(b) && b.time + 900 <= evalNow && (lastM1Time == null || lastM1Time >= b.time + 900));
    const a = closed.length >= 15 ? lastNum(atr(closed, 14)) : null;
    return stopZones(analysis.s15, a, stopMult);
  }, [analysis, m15D, evalNow, lastM1Time, stopMult]);

  const price = data?.spot.price ?? null;
  const vwapNow = useMemo(() => (date ? liveVwap(m5D, date) : null), [m5D, date]);

  /** Akış: hacim profili, likidite havuzları/süpürmeler, delta, akıllı para, erken uyarı */
  const flow = useMemo<FlowRead | null>(() => {
    if (!analysis || !date) return null;
    return flowRead({ m1, ymd: date, s5: analysis.s5, price, premarket: data?.levels?.premarket ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, m1, date, data?.levels?.premarket, minuteSlot]);

  const nowMin = evalNow ? nyParts(evalNow).minutes : 0;
  /** 09:45 15m kapanışından sonra seans kartları açılır; öncesi tek satır + açılış tahmini */
  const sessionActive = !!analysis && analysis.opening.status !== "WAITING";

  /** ATR(14) — kapanmış 5m mumlardan (önceki günler dahil, ısınmış) */
  const atr5 = useMemo(() => {
    const closed = m5D.filter((b) => b.time + 300 <= (evalNow || Infinity) && (lastM1Time == null || lastM1Time >= b.time + 300));
    return closed.length >= 15 ? lastNum(atr(closed, 14)) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m5D, lastM1Time, minuteSlot]);

  /** Replay'de güncel zincir anlamsız — gizlenir */
  const optLevels = replayDate ? null : optLevelsLive;

  /**
   * ÇAPA: günün ilk senaryosu. 09:55 kuralı (15m + 2×5m VWAP tarafı), belirsizse 10:00 kararından
   * DETERMİNİSTİK olarak (kapanmış mumlardan) hesaplanır — sayfa gün ortasında açılsa da aynı çapa çıkar.
   * Hedefler çapa anındaki seviyelerden sabitlenir (gelecekten sızma yok: gün zirvesi/dibi ve canlı
   * destek/direnç çıkarılır). Sonradan YENİDEN ÜRETİLMEZ.
   */
  const anchorStage = !date || !evalNow ? 0 : evalNow >= nyDateTimeToEpoch(date, 10 * 60) ? 2 : evalNow >= nyDateTimeToEpoch(date, 9 * 60 + 55) ? 1 : 0;
  const anchorDataReady = !!date && lastM1Time != null && lastM1Time >= nyDateTimeToEpoch(date, anchorStage === 1 ? 9 * 60 + 55 : 10 * 60) - 60;
  const optReady = !!optLevels;

  /** Ölçülmüş ek seviyeler (POC/VA, likidite, Fibonacci, opsiyon duvarları, ADR) — harita ve "sıradaki seviye" ortak kaynağı */
  const lvl = data?.levels ?? null;
  const extraLevels = useMemo(() => {
    if (!flow) return [] as { price: number; label: string }[];
    return [
      ...(flow.profile ? [{ price: flow.profile.poc, label: "POC" }, { price: flow.profile.vah, label: "VAH" }, { price: flow.profile.val, label: "VAL" }] : []),
      ...flow.pools.filter((p) => !p.swept).map((p) => ({ price: p.price, label: `${p.label} likiditesi` })),
      ...(flow.leg?.levels ?? []),
      ...optionLevelList(optLevels),
      ...(flow.adr ? [
        { price: flow.adr.downTo, label: `ADR alt potansiyeli (ort. ${flow.adr.avg.toFixed(2)} puan)` },
        { price: flow.adr.upTo, label: `ADR üst potansiyeli (ort. ${flow.adr.avg.toFixed(2)} puan)` },
      ] : []),
      ...(lvl ? [
        ...(lvl.premarket.high != null ? [{ price: lvl.premarket.high, label: "Premarket zirvesi" }] : []),
        ...(lvl.premarket.low != null ? [{ price: lvl.premarket.low, label: "Premarket dibi" }] : []),
        ...(lvl.rth.high != null ? [{ price: lvl.rth.high, label: "Gün zirvesi" }] : []),
        ...(lvl.rth.low != null ? [{ price: lvl.rth.low, label: "Gün dibi" }] : []),
      ] : []),
    ];
  }, [flow, optLevels, lvl]);

  const anchor = useMemo<Anchor | null>(() => {
    if (!date || anchorStage === 0 || !anchorDataReady) return null;
    const tryAt = (min: number, clock: "09:55" | "10:00"): Anchor | null => {
      const tc = nyDateTimeToEpoch(date, min);
      const s5c = daySeries(m5D, "5m", date, tc, null);
      if (s5c.bars.length < (clock === "09:55" ? 5 : 6)) return null;
      const s15c = daySeries(m15D, "15m", date, tc, null);
      const s30c = daySeries(m30D, "30m", date, tc, null);
      const opc = openingRegime(s5c, s15c, ema5, s30c, null, data?.levels?.prevClose ?? null);
      if (opc.status !== "LOCKED" || (opc.side !== "UP" && opc.side !== "DOWN")) return null;
      // çapa yalnız NET kararda: 09:55 GÜÇLÜ ya da 09:55 belirsizken 10:00 kuralı.
      // NET olmayan günlerde açılış çapası kurulmaz; senaryo gün içi bacak tetikleriyle başlar.
      if (!opc.net) return null;
      if (clock === "09:55" && opc.decidedAt !== "09:55") return null;
      const dir = opc.side;
      const entry = s5c.bars[s5c.bars.length - 1].close;
      const vw = s5c.vwap[s5c.vwap.length - 1] ?? null;
      const fl = flowRead({ m1: m1.filter((b) => b.time < tc), ymd: date, s5: s5c, price: entry, premarket: data?.levels?.premarket ?? null });
      const lv = data?.levels ? { ...data.levels, rth: { high: null, low: null }, support: null, resistance: null, projectedHigh: null, projectedLow: null } : null;
      const mp = buildForecastMap({
        price: entry, vwap: vw, date, nowSec: tc, opening: opc, live: null, levels: lv, forecast: null,
        playBias: { bias: dir, text: "" },
        extra: fl ? [
          ...(fl.profile ? [{ price: fl.profile.poc, label: "POC" }, { price: fl.profile.vah, label: "VAH" }, { price: fl.profile.val, label: "VAL" }] : []),
          ...fl.pools.filter((p) => !p.swept).map((p) => ({ price: p.price, label: `${p.label} likiditesi` })),
          ...(fl.leg?.levels ?? []),
          ...optionLevelList(optLevels),
          ...(fl.adr ? [
            { price: fl.adr.downTo, label: `ADR alt potansiyeli (ort. ${fl.adr.avg.toFixed(2)} puan)` },
            { price: fl.adr.upTo, label: `ADR üst potansiyeli (ort. ${fl.adr.avg.toFixed(2)} puan)` },
          ] : []),
        ] : [],
      });
      if (!mp) return null;
      return {
        date, dir, t0: tc, clock, entry, decidedAt: clock, strength: opc.strength, weak: opc.weak, kind: "AÇILIŞ", legNo: 1, dayHold: opc.dayHold,
        targets: pickTargets(dir, entry, mp.supports, mp.resistances), option: optionFor(dir, entry), iv: realizedIV(m5D, tc),
      };
    };
    return tryAt(9 * 60 + 55, "09:55") ?? (anchorStage === 2 ? tryAt(10 * 60, "10:00") : null);
    // çapa yalnızca gün/aşama/veri/opsiyon-seviyesi değişince yeniden kurulur (dakikada bir DEĞİL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, anchorStage, anchorDataReady, optReady, data?.levels?.prevClose]);

  /**
   * Bacak zinciri: 1. bacak = açılış çapası; trend değişince (ya da sabah yön yoksa 10:00'dan sonra)
   * yeni bacak tetiği aranır — 2×5m kapanış VWAP + EMA20 aynı tarafta VE 15m kapanış VWAP + EMA20(15m) aynı tarafta.
   * Her kapanışta günün tamamı yeniden oynatılır (deterministik; sayfa gün ortasında açılsa da aynı zincir).
   */
  const chain = useMemo<LegChain | null>(() => {
    if (!analysis || price == null || !date || anchorStage < 2 && !anchor) return null;
    if (!analysis.s5.bars.length) return null;
    const legLevels = extraLevels.filter((l) => !l.label.startsWith("Gün zirvesi") && !l.label.startsWith("Gün dibi"));
    return buildLegChain({
      date, first: anchor, s5: analysis.s5, s15: analysis.s15, ema5, ema15, price, atr5,
      vix: openFc?.vixNow ?? null, nowSec: minuteSlot ? minuteSlot * 60 : evalNow,
      levels: legLevels, nextLevels: extraLevels, iv: realizedIV(m5D, evalNow || 0), adrAvg: flow?.adr?.avg ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, anchorStage, analysis, ema15, ema5, price, atr5, openFc?.vixNow, minuteSlot, evalNow, extraLevels, flow?.adr?.avg, date]);
  /** Güncel bacağın takibi (yoksa null) */
  const track: TrackState | null = chain?.current ?? null;
  /** Güncel bacağın çapası (açılış ya da gün içi) */
  const legAnchor: Anchor | null = track?.anchor ?? null;

  /** 1h / 4h genel yapı: çok günlük 1m akışından (seans dışı dahil), yalnız KAPANMIŞ mumlar */
  const m60 = useMemo(() => bucketAggregate(m1, 60), [m1]);
  const m240 = useMemo(() => bucketAggregate(m1, 240), [m1]);
  const ema60 = useMemo(() => emaByTime(m60), [m60]);
  const ema240 = useMemo(() => emaByTime(m240), [m240]);
  const r1h = useMemo(() => (evalNow ? tfRead(multiDaySeries(m60, "1h", evalNow), "1h", ema60) : null), [m60, ema60, evalNow]);
  const r4h = useMemo(() => (evalNow ? tfRead(multiDaySeries(m240, "4h", evalNow), "4h", ema240) : null), [m240, ema240, evalNow]);
  /** EMA20 konumu: 5m + 15m kapanışın EMA20'ye göre tarafı / seri / eğim */
  const emaPos = useMemo(() => (analysis && analysis.s5.bars.length ? emaPosition(analysis.s5, analysis.s15, ema5, ema15) : null), [analysis, ema5, ema15]);
  /** Gün tipi: DAVRANIŞ temelli (VWAP tarafı + kesişim); VIX yalnızca seans öncesi beklenti */
  const dayLive = useMemo(() => (analysis && analysis.s5.bars.length ? dayTypeLive(analysis.s5, atr5) : null), [analysis, atr5]);
  /** Son 2 saatin (24×5m) davranışı — gün ortasında rejim değişince tüm-gün etiketi geride kalır */
  const dayRecent = useMemo(() => {
    if (!analysis || analysis.s5.bars.length < 36) return null;
    const s = analysis.s5;
    return dayTypeLive({ bars: s.bars.slice(-24), vwap: s.vwap.slice(-24) }, atr5);
  }, [analysis, atr5]);

  /**
   * Haritanın yönü = karar panelindeki seans planının yönü (aynı sessionModeOf).
   * Böylece harita ile karar asla farklı yön göstermez.
   */
  const playBias = useMemo<{ bias: "UP" | "DOWN" | "FLAT"; text: string } | null>(() => {
    if (!analysis || price == null || !analysis.s5.bars.length) return null;
    // günün çapa senaryosu varsa harita da ONU gösterir (bozulana kadar)
    if (legAnchor && track && track.status !== "DEĞİŞTİ")
      return {
        bias: legAnchor.dir,
        text: `${legAnchor.kind === "GÜN İÇİ" ? `${legAnchor.legNo}. bacak` : "Senaryo"} (${legAnchor.clock}) ${legAnchor.dir === "UP" ? "yukarı" : "aşağı"} — ${track.status}: ${track.status === "TREND ONAYLI" ? "taşı, yeni giriş yok" : track.status === "ZAYIFLIYOR" ? "zayıflıyor, stopu sıkılaştır" : "hedefte kâr al"}.`,
        alt: track.rules.map((r) => `${r.label}${r.level != null ? ` → ${r.level.toFixed(2)}` : ""} (${r.state === "ok" ? "güvenli" : r.state}).`),
      };
    const s5 = analysis.s5;
    const minsNow = nyParts(s5.bars[s5.bars.length - 1].time + 300).minutes;
    const { mode } = sessionModeOf({ opening: analysis.opening, s5, price, minsNow });
    const op = analysis.opening;
    if (mode === "OPEN_TREND" && (op.side === "UP" || op.side === "DOWN"))
      return { bias: op.side, text: `Gün yönü ${op.label}${op.strength ? ` (${op.strength})` : ""} → 14:00'e kadar ${op.side === "UP" ? "yükseliş" : "düşüş"} senaryosu.` };
    if (mode === "MIDDAY_RANGE") return { bias: "FLAT", text: "Açılış yönü bozuldu / yok: gün ortası aralık — uçlardan VWAP'a dönüş senaryosu." };
    if (mode === "CLOSE_TREND") {
      const v = vwapNow, poc = flow?.profile?.poc ?? null;
      if (v != null && poc != null && Math.sign(price - v) === Math.sign(price - poc) && price !== v)
        return { bias: price > v ? "UP" : "DOWN", text: `Öğleden sonra: fiyat VWAP ve POC'un ${price > v ? "üstünde" : "altında"} → ${price > v ? "yükseliş" : "düşüş"} senaryosu.` };
      if (flow?.warning.level === "STARTED" && flow.warning.side)
        return { bias: flow.warning.side === "LONG" ? "UP" : "DOWN", text: `Öğleden sonra erken uyarı: ${flow.warning.headline}.` };
      return { bias: "FLAT", text: "Öğleden sonra: fiyat VWAP ile POC arasında — yön yok, aralık senaryosu." };
    }
    return { bias: "FLAT", text: op.status === "LOCKED" ? "Açılış yönsüz: 10:30'a kadar bekle — aralık senaryosu." : `Ön okuma (${op.label}) — gün yönü 09:55'te.` };
  }, [analysis, price, vwapNow, flow, legAnchor, track]);


  const map = useMemo(() => {
    if (!analysis || price == null || !date) return null;
    return buildForecastMap({
      price, vwap: vwapNow, date, nowSec: evalNow,
      opening: analysis.opening, live: analysis.live,
      levels: data?.levels ?? null, forecast: data?.forecast ?? null,
      playBias,
      extra: extraLevels,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, price, vwapNow, date, data?.levels, data?.forecast, extraLevels, playBias, minuteSlot]);

  /** Grafik/harita için bugünün RTH 5m mumları (oluşan dahil) + VWAP */
  const todayRth5 = useMemo(() => {
    if (!date) return { bars: [] as Bar[], vwap: [] as (number | null)[], ema: [] as (number | null)[] };
    const bars = m5D.filter((b) => isRthBar(b) && nyParts(b.time).ymd === date);
    let pv = 0, vol = 0;
    const vwap = bars.map((b) => {
      const v = b.volume || 0;
      pv += ((b.high + b.low + b.close) / 3) * v;
      vol += v;
      return vol > 0 ? pv / vol : null;
    });
    return { bars, vwap, ema: bars.map((b) => ema5.get(b.time) ?? null) };
  }, [m5D, ema5, date]);

  /** Bugünün (kısmi) ham gerçekleri — günlük / saatlik tahmin sekmeleri için (yalnız KAPANMIŞ 5m mumlar) */
  const todayFacts = useMemo(
    () => (date && evalNow ? factsOf(m5D, date, data?.levels?.prevClose ?? null, evalNow) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m5D, date, data?.levels?.prevClose, minuteSlot],
  );

  /** Son 1 saat (1m, oluşan dahil) ve seans dip/tepesi — fiyat şeridi için */
  const hourHiLo = useMemo<HiLo | null>(() => {
    const t = evalNow || lastM1Time || 0;
    const bs = m1.filter((b) => b.time > t - 3600 && b.time <= t);
    if (!bs.length) return null;
    let hi = bs[0], lo = bs[0];
    for (const b of bs) { if (b.high > hi.high) hi = b; if (b.low < lo.low) lo = b; }
    return { hi: hi.high, lo: lo.low, hiClock: nyClock(hi.time), loClock: nyClock(lo.time) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m1, minuteSlot, evalNow]);
  const dayHiLo = useMemo<HiLo | null>(() => {
    const bs = todayRth5.bars;
    if (!bs.length) return null;
    let hi = bs[0], lo = bs[0];
    for (const b of bs) { if (b.high > hi.high) hi = b; if (b.low < lo.low) lo = b; }
    return { hi: hi.high, lo: lo.low, hiClock: nyClock(hi.time), loClock: nyClock(lo.time) };
  }, [todayRth5]);
  /** Klasik günlük pivotlar (önceki seans Y/D/K) + fiyatın pivotlara hareketi */
  const pivBase = useMemo(() => (date ? prevDayPivots(m1, date, data?.levels?.prevClose ?? null) : null), [m1, date, data?.levels?.prevClose]);
  const pivR = useMemo<PivotRead | null>(() => {
    if (!pivBase || price == null) return null;
    return pivotRead(pivBase, analysis?.s5 ?? { bars: [], vwap: [] }, price);
  }, [pivBase, analysis?.s5, price]);
  const ema5Now = useMemo(() => {
    const bs = analysis?.s5.bars;
    return bs && bs.length ? ema5.get(bs[bs.length - 1].time) ?? null : null;
  }, [analysis?.s5, ema5]);

  const pendingLeg = chain?.pending ?? null;
  const counterTrig = chain?.counter ?? null;
  /** Karar desteği — her kapanan 5m/15m mumda yeniden okunur */
  const decision = useMemo<DecisionRead | null>(() => {
    if (!analysis || analysis.opening.status === "WAITING") return null;
    return decisionRead({
      s5: analysis.s5, s15: analysis.s15, s30: analysis.s30, ema5, ema15, ema30, warning: flow?.warning ?? null, price, vwapNow,
      atr5, profile: flow?.profile ?? null, hourlyRange: data?.levels?.hourlyRange ?? null,
      dayKind: dayLive ? { kind: dayLive.kind, side: dayLive.side } : null,
      track: legAnchor && track ? { status: track.status, dir: legAnchor.dir, clock: legAnchor.clock, title: track.title, lines: track.lines, watch: [...(counterTrig ? [counterTrig.text] : []), ...(pendingLeg ? [pendingLeg.text] : []), ...track.watch], ifNotIn: track.ifNotIn, changeLevel: track.rules[1]?.level ?? null } : null,
      opening: analysis.opening, stops,
      supports: map?.supports ?? [], resistances: map?.resistances ?? [],
    });
  }, [analysis, ema5, ema15, ema30, flow, price, vwapNow, stops, map, atr5, data?.levels?.hourlyRange, legAnchor, track, dayLive, pendingLeg, counterTrig]);

  /** ÖN PLAN senaryosu (çapa kilitlenmeden önce): seans öncesi açılış tahmininden, 09:35–10:00 ön okumadan. Çapa varsa Senaryo Takibi gösterilir. */
  const scenarioRead = useMemo<{ sc: Scenario | null; wait: string | null }>(() => {
    if (!map) return { sc: null, wait: "Seviye verisi bekleniyor." };
    let dir: "UP" | "DOWN" | null = null;
    let src = "";
    let entry = price;
    let minutesToClose = 0;
    if (!sessionActive) {
      const f = openFc?.now;
      if (!f) return { sc: null, wait: "Açılış tahmini bekleniyor." };
      if (f.dir === "FLAT") return { sc: null, wait: `Açılış tahmini YATAY (gap ${f.gap >= 0 ? "+" : ""}${f.gap.toFixed(2)}) — yön için 09:35–09:55 aşamalarını bekle.` };
      dir = f.dir;
      src = `açılış tahmini (${f.confidence}, gap yönü geçmiş isabet %${f.dirHitPct}) — giriş 09:30 açılışında varsayıldı`;
      entry = f.center;
      minutesToClose = 390;
    } else {
      const d = decision;
      const act = d?.action === "LONG" ? "UP" : d?.action === "SHORT" ? "DOWN" : d?.lean === "LONG" ? "UP" : d?.lean === "SHORT" ? "DOWN" : null;
      const prov = analysis?.opening.provisional;
      dir = act ?? (prov === "UP" || prov === "DOWN" ? prov : null);
      if (!dir) return { sc: null, wait: "Karar Desteği yön vermiyor (BEKLE) — aralık günü ya da açılış aşamaları bekleniyor." };
      src = act
        ? `Karar Desteği (${d?.action !== "BEKLE" ? d?.action : `BEKLE, ${d?.lean} yatkın`} · ${d?.modeLabel})`
        : `açılış ön okuması (${analysis?.opening.label}) — karar 09:55'te, şimdilik izleme`;
      minutesToClose = Math.max(0, 16 * 60 - nowMin);
      if (minutesToClose < 60) return { sc: null, wait: "Kapanışa 1 saatten az — 1–2 saatlik senaryo için süre yok." };
    }
    if (entry == null) return { sc: null, wait: "Fiyat bekleniyor." };
    if (dayLive?.kind === "SIKIŞMA" && sessionActive)
      return { sc: null, wait: `Sıkışma günü (${dayLive.crosses} VWAP kesişimi) — dar aralıkta bekleme tercihin geçerli.` };
    const sc = buildScenario({
      dir, dirSource: src, price: entry,
      supports: map.supports, resistances: map.resistances, vwap: vwapNow,
      hourlyRange: data?.levels?.hourlyRange ?? null, vix: openFc?.vixNow ?? null,
      iv: realizedIV(m5D, evalNow || data?.serverTime || 0),
      minutesToClose, quotes: sessionActive ? optLevels?.quotes ?? null : null,
    });
    return { sc, wait: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, price, sessionActive, openFc, decision, analysis?.opening, nowMin, dayLive, vwapNow, data?.levels?.hourlyRange, optLevels, m5D]);

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

  /** Yön lehine olan SL çizgisi (yön belirsizse ikisi) grafiklere eklenir */
  const chartLines = useMemo(() => {
    const pivLines = pivBase && price != null
      ? PIVOT_ORDER.filter((k) => Math.abs(pivBase.levels[k] - price) / price <= 0.012)
        .map((k: PivotKey) => ({ price: pivBase.levels[k], label: `Pivot ${k} ${pivBase.levels[k].toFixed(2)}`, color: PIVOT_COLOR[k] }))
      : [];
    const base = [...(data?.levels?.lines ?? []), ...pivLines];
    if (!stops) return base;
    // karar panelinin yönü (Canlı Yön kartının ham VWAP okuması değil)
    const dir = decision?.action === "LONG" ? "UP" : decision?.action === "SHORT" ? "DOWN" : "MIXED";
    const out = [...base];
    if (stops.long && dir !== "DOWN") out.push({ price: stops.long.stop, label: `LONG SL ${stops.long.stop.toFixed(2)}`, color: "#22c55e" });
    if (stops.short && dir !== "UP") out.push({ price: stops.short.stop, label: `SHORT SL ${stops.short.stop.toFixed(2)}`, color: "#ef4444" });
    return out;
  }, [data?.levels?.lines, stops, decision?.action, pivBase, price]);

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

  const anchorFresh = !!legAnchor && !!evalNow && evalNow - legAnchor.t0 <= 180;
  // Sesli uyarı: yeni sisteme bağlı — senaryo kurulunca (yön kilitlendi), zayıflayınca (EMA20 kaybı) ve
  // trend değişince. İlk yüklemede (prev == null) çalmaz; eski motor uyarısı artık sesli değildir.
  useEffect(() => {
    const key = legAnchor
      ? `${legAnchor.clock}:${legAnchor.dir}:${track?.status ?? ""}:${chain?.counter ? `c${chain.counter.level}` : track?.counterWarn ? "w" : ""}:${chain?.pending?.dir ?? ""}`
      : `-:${chain?.pending?.dir ?? ""}`;
    const prev = lastAlertKeyRef.current;
    lastAlertKeyRef.current = key;
    if (prev == null || prev === key || !alertSound || replayDate) return;
    const [pc, , ps, pw, pp] = prev.split(":");
    if (legAnchor && track) {
      // yeni bacak: yalnızca GERÇEKTEN yeni kurulduysa (≤3 dk) çal — geç yüklenen sayfada çalma
      if (pc !== legAnchor.clock) { if (anchorFresh) chime("fired"); return; }
      if (track.status === "DEĞİŞTİ" && ps !== "DEĞİŞTİ") { chime("fired"); return; }
      if (chain?.counter && pw !== `c${chain.counter.level}`) { chime(chain.counter.level === "TAM" ? "fired" : "imminent"); return; }
      if ((track.status === "ZAYIFLIYOR" && ps !== "ZAYIFLIYOR") || (track.counterWarn && pw !== "w")) { chime("imminent"); return; }
    }
    if (chain?.pending && (pp ?? "") !== chain.pending.dir) chime("imminent");
  }, [legAnchor, track, chain?.pending, chain?.counter, anchorFresh, alertSound, replayDate, chime]);

  // ── Render ──────────────────────────────────────────────────────
  const op = analysis?.opening ?? null;
  const live = analysis?.live ?? null;
  const opColor = op && op.status === "LOCKED" && !op.net ? "#eab308" : op?.side === "UP" ? "#22c55e" : op?.side === "DOWN" ? "#ef4444" : op?.side === "UNCERTAIN" ? "#eab308" : "#64748b";
  const opArrow = op?.side === "UP" ? "▲" : op?.side === "DOWN" ? "▼" : op?.side === "UNCERTAIN" ? "◆" : "…";

  return (
    <div className="min-h-screen bg-[#0a0e17] p-2 text-slate-300">
      {/* ── Başlık ── */}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-[#eab308]">SPY Engine V10 · Senaryo Takibi</h1>
            <p className="hidden text-[10.5px] text-slate-500 sm:block">
              30m genel yön · 15m karar · 5m tetik (giriş/çıkış zamanlaması) · 09:55 gün yönü kilitlenir, o senaryo gün boyu takip edilir · trend değişimi uyarısı · VWAP + EMA20 · POC / likidite / akıllı para · tahmin haritası
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] ${
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
          <span className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 font-mono text-[11px] text-slate-400">
            {nowSec ? `${nyClock(nowSec, true)} ET` : "—"}
          </span>
          <select
            value={pollMs}
            onChange={(e) => setPollMs(Number(e.target.value))}
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 font-mono text-[11px] text-slate-400"
            title="Yoklama aralığı"
          >
            {POLL_OPTIONS.map((ms) => <option key={ms} value={ms}>{ms / 1000} sn</option>)}
          </select>
          <input
            type="date"
            value={replayDate}
            onChange={(e) => setReplayDate(e.target.value)}
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 font-mono text-[11px] text-slate-400"
            title="Geriye dönük seans oynatma (boş = canlı)"
          />
          {replayDate && (
            <button type="button" onClick={() => setReplayDate("")} className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
              canlıya dön
            </button>
          )}
          <button
            type="button"
            onClick={() => setAlertSound((v) => !v)}
            className={`rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${
              alertSound ? "border-orange-500/40 bg-orange-500/15 text-orange-300" : "border-[#1c2635] bg-[#111827] text-slate-500 hover:bg-[#1c2635]"
            }`}
            title="Yeni bacak kurulduğunda, ters bacak hazırlanırken (2×5m EMA20 ters), zayıflamada (15m EMA20 kaybı) ve trend değişiminde sesli + titreşimli uyarı"
          >
            {alertSound ? "🔔 UYARI AÇIK" : "🔕 UYARI KAPALI"}
          </button>
          <button
            type="button"
            onClick={() => setShowTickers((v) => !v)}
            className={`rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${
              showTickers ? "border-sky-500/60 bg-sky-500/15 text-sky-300 font-bold" : "border-sky-500/60 bg-sky-500/15 text-sky-300 font-bold hover:bg-sky-500/30"
            }`}
          >
            Tickerlar: {showTickers ? "gizle" : "göster"}
          </button>
        </div>
      </header>

      {/* SPY anlık fiyat şeridi — kaydırınca üstte sabit kalır */}
      <PriceStrip
        price={price}
        change={data?.spot.change ?? null}
        changePct={data?.spot.changePct ?? null}
        badge={data ? <PhaseBadge phase={data.session.phase} /> : null}
        hour={hourHiLo}
        day={dayHiLo}
        vwap={vwapNow}
        ema={ema5Now}
        piv={pivR}
      />

      {/* Uyarılar */}
      {data && !data.session.isLive && data.session.note && (
        <div className="mb-2 flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300/90">
          <span>🕒</span><span>{data.session.note}</span>
        </div>
      )}
      {error && (
        <div className="mb-2 rounded border border-red-500/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
          Akış hatası: {error}{failures > 1 && ` · ardışık ${failures} deneme başarısız`}
        </div>
      )}
      {data && data.dataSource.errors.length > 0 && (
        <div className="mb-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10.5px] text-amber-300/80">
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

        {/* ── 0) Açılış tahmini — seans öncesi büyük, açılıştan sonra tek satır sonuç ── */}
        {!replayDate && <Hideable title="Açılış Tahmini" open={showOpenFc} onToggle={() => setShowOpenFc((v) => !v)}><OpenForecastPanel r={openFc} compact={sessionActive && !!openFc?.actual} /></Hideable>}

        {!replayDate && !sessionActive && <ScenarioPanel sc={scenarioRead.sc} expectation={vixExpectation(openFc?.vixNow ?? null)} waitReason={scenarioRead.wait} />}

        {/* Seans kartları HER ZAMAN görünür; veri yokken kendi "güncel veri yok / bekleniyor" durumunu gösterir */}
        {!sessionActive && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-200">
            <b>Güncel seans verisi yok</b> — {data?.session.isLive === false ? "piyasa kapalı ya da veri gelmedi" : "09:35 ET ilk 5m kapanışı bekleniyor"}. Kartlar aşağıda yerinde; veri gelince dolacak
            (09:35 ilk 5m · 09:45 15m · 09:55 büyük resim · belirsizse 10:00 30m teyidi).
          </div>
        )}

        <>
        {/* ── 1) Açılış rejimi — tam genişlik, siyah zemin, gizle/göster ── */}
          <div className="overflow-hidden rounded-lg border bg-black" style={{ borderColor: `${opColor}55` }}>
            <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 ${regimeOpen ? "border-b border-[#1c2635]" : ""}`}>
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] font-semibold tracking-wide text-slate-300">
                Açılış Rejimi
                {regimeOpen ? (
                  <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· 09:35 ilk okuma → 09:45 15m → 09:55 büyük resim (karar) → 09:55 net değilse 10:00 30m kararı</span>
                ) : op ? (
                  <>
                    <b className="text-[13px]" style={{ color: opColor }}>{opArrow} {op.label}</b>
                    {op.dayHold && (
                      <span className="text-[11px] font-normal" style={{ color: op.dayHold.level === "YÜKSEK" ? "#4ade80" : op.dayHold.level === "DÜŞÜK" ? "#fbbf24" : "#cbd5e1" }}>
                        · ilk 2–3 saat güveni {op.dayHold.level}
                      </span>
                    )}
                    <span className="flex gap-0.5">
                      {op.stages.map((st) => {
                        const c = st.skipped ? "#334155" : st.dir === "UP" ? "#22c55e" : st.dir === "DOWN" ? "#ef4444" : st.dir === "MIXED" ? "#eab308" : "#334155";
                        return (
                          <span key={st.clock} title={st.detail} className="rounded px-1 font-mono text-[10px]" style={{ color: c, backgroundColor: `${c}1f` }}>
                            {st.clock} {st.skipped ? "—" : st.dir === "UP" ? "▲" : st.dir === "DOWN" ? "▼" : st.dir === "MIXED" ? "◆" : "…"}
                          </span>
                        );
                      })}
                    </span>
                  </>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5">
              {op && (
                <span className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: opColor, backgroundColor: `${opColor}1f` }}>
                  {op.waitFor10
                    ? op.decidedAt === "09:55" ? "09:55 TEYİTSİZ · giriş yok" : "ÖN KARAR · 10:00'ı bekle"
                    : op.status === "LOCKED"
                      ? op.net
                        ? `NET KARAR ${op.decidedAt}${op.decidedAt === "09:55" && op.check10 ? ` · 10:00 ${op.check10}` : ""}`
                        : "AÇILIŞ İŞLEMİ YOK"
                      : op.status === "FORMING" ? "ÖN OKUMA" : "BEKLİYOR"}
                </span>
              )}
                <button
                  type="button"
                  onClick={() => setRegimeOpen((v) => !v)}
                  className="rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30"
                >
                  {regimeOpen ? "▴ gizle" : "▾ göster"}
                </button>
              </span>
            </div>
            {regimeOpen && (<>
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="text-center">
                <div className="text-[34px] font-black leading-none" style={{ color: opColor }}>{opArrow}</div>
                <div className="mt-1 text-[18px] font-extrabold tracking-wide" style={{ color: opColor }}>{op?.label ?? "VERİ BEKLENİYOR"}</div>
              </div>
              <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-slate-400">{op?.summary ?? "Mum verisi bekleniyor."}</div>
            </div>
            {op?.dayHold && (
              <div
                className="border-t border-[#1c2635] px-4 py-1.5 text-[12px] leading-snug"
                style={{ color: op.dayHold.level === "YÜKSEK" ? "#4ade80" : op.dayHold.level === "DÜŞÜK" ? "#fbbf24" : "#cbd5e1" }}
              >
                <b>İlk 2–3 saat güveni: {op.dayHold.level}</b> — {op.dayHold.text} <span className="text-slate-500">Sonrası seans içinde yeniden yön (Senaryo Takibi bacakları).</span>
              </div>
            )}
            {op && (
              <div className="grid grid-cols-3 gap-1 border-t border-[#1c2635] p-1.5 sm:grid-cols-6">
                {op.stages.map((st) => {
                  const c = st.skipped ? "#334155" : st.dir === "UP" ? "#22c55e" : st.dir === "DOWN" ? "#ef4444" : st.dir === "MIXED" ? "#eab308" : "#334155";
                  return (
                    <div
                      key={st.clock}
                      title={st.detail}
                      className={`rounded border px-1.5 py-1 ${st.decisive ? "ring-1 ring-[#eab308]/60" : ""}`}
                      style={{ borderColor: `${c}66`, backgroundColor: `${c}14` }}
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <b className="text-slate-200">{st.clock}</b>
                        <span style={{ color: c }}>{st.skipped ? "—" : st.dir === "UP" ? "▲" : st.dir === "DOWN" ? "▼" : st.dir === "MIXED" ? "◆" : "…"}</span>
                      </div>
                      <div className="text-[10.5px] text-slate-400">{st.title}{st.decisive ? " · KARAR" : ""}</div>
                      <div className="font-mono text-[10px] text-slate-500">60dk %{st.hit60} · kap. %{st.hitClose}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {op && (op.closes5.length > 0 || op.closes15.length > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#1c2635] px-3 py-1.5 font-mono text-[10.5px]">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-slate-500">5m</span>
                  {op.closes5.map((c) => (
                    <span key={c.clock} className={`rounded border px-1 py-0.5 ${c.side ? SIDE_CHIP[c.side] : "border-slate-700 text-slate-500"}`}>
                      {c.clock} {c.side === "ABOVE" ? "▲" : c.side === "BELOW" ? "▼" : "•"}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-slate-500">15m</span>
                  {op.closes15.map((c) => (
                    <span key={c.clock} className={`rounded border px-1 py-0.5 ${c.side ? SIDE_CHIP[c.side] : "border-slate-700 text-slate-500"}`}>
                      {c.clock} {c.side === "ABOVE" ? "▲" : c.side === "BELOW" ? "▼" : "•"}
                    </span>
                  ))}
                </div>
                <span className="text-slate-500">▲ VWAP üstü kapanış · ▼ VWAP altı kapanış</span>
              </div>
            )}
            </>)}
          </div>

        {/* ── 1a) VWAP konumu · EMA20 konumu · gün geneli ── */}
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-3">
          <VwapPositionCard live={live} vwap={vwapNow} price={price} info={`kontrol ${minuteSlot ? nyClock(minuteSlot * 60) : "—"}`} />
          <EmaPositionCard e={emaPos} />
          <DayOverviewCard d={decision} day={dayLive} recent={dayRecent} chain={chain} op={analysis?.opening ?? null} />
        </div>

        {/* ── 1a2) Pivot noktaları ── */}
        <PivotCard p={pivR} price={price} />

        {/* ── 1b) Erken uyarı · likidite · akıllı para (Karar Desteği'nin üstünde) ── */}
        <FlowPanel f={flow} price={price} nowMin={nowMin} opt={optLevels} scenarioDir={legAnchor && track && track.status !== "DEĞİŞTİ" ? legAnchor.dir : null} />

        {/* ── 1c) Karar desteği — 5m · 15m · gün geneli (fiyat + hacim) ── */}
        <DecisionPanel
          d={decision}
          r1h={r1h}
          r4h={r4h}
          price={price}
          secTo5={evalNow ? 300 - (evalNow % 300) : null}
          forming={forming5}
          waiting={!analysis || analysis.opening.status === "WAITING"}
        />

        {/* ── 1b2) Senaryo Takibi (çapa varsa) — yoksa ön plan ── */}
        <Hideable title="Senaryo Takibi" open={showScenario} onToggle={() => setShowScenario((v) => !v)}>
          {chain ? <ScenarioTrackPanel t={track} chain={chain} day={dayLive} recent={dayRecent} /> : !replayDate && <ScenarioPanel sc={scenarioRead.sc} expectation={null} waitReason={scenarioRead.wait} />}
        </Hideable>

        </>

        {/* ── 2b) 15m yapı stopu — trend taşırken stopu nereye çekeceğini gösterir ── */}
        <Hideable title="Trend Stop Bölgesi" open={showStops} onToggle={() => setShowStops((v) => !v)}>
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
            <span className="text-[12px] font-semibold tracking-wide text-slate-300">
              Trend Stop Bölgesi <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· taşıma stopu referansı: son kapanan 15m dip/zirve ± ATR tamponu · her 15m kapanışta yenilenir · trend DEĞİŞİMİ kuralı için Senaryo Takibi</span>
            </span>
            <span className="flex items-center gap-1 font-mono text-[10.5px] text-slate-500">
              tampon çarpanı
              {([[0.25, "normal"], [0.4, "yüksek vol."], [0.5, "veri günü"]] as const).map(([m, l]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setStopMult(m)}
                  className={`rounded px-1.5 py-0.5 transition-colors ${stopMult === m ? "bg-[#eab308]/20 text-[#eab308]" : "bg-[#111827] text-slate-500 hover:text-slate-300"}`}
                  title={`ATR₁₅ × ${m}`}
                >
                  {m} · {l}
                </button>
              ))}
            </span>
          </div>
          {!stops || !stops.long || !stops.short ? (
            <div className="px-3 py-4 text-[12px] text-slate-500">Güncel veri yok — ilk 15m mum 09:45 ET&apos;de kapanınca stop bölgesi oluşur.</div>
          ) : (
            <div className="grid grid-cols-1 gap-px bg-[#1c2635] lg:grid-cols-2">
              {([stops.long, stops.short] as const).map((z) => {
                const isLong = z.side === "LONG";
                const dir = decision?.action === "LONG" ? "UP" : decision?.action === "SHORT" ? "DOWN" : "MIXED";
                const active = dir === "MIXED" || (isLong ? dir === "UP" : dir === "DOWN");
                const col = isLong ? "#22c55e" : "#ef4444";
                const dist = price != null ? (isLong ? price - z.stop : z.stop - price) : null;
                const hit = dist != null && dist <= 0;
                return (
                  <div key={z.side} className={`bg-[#0f141d] px-3 py-2 ${active ? "" : "opacity-45"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold" style={{ color: col }}>
                        {isLong ? "LONG taşıyorsan" : "SHORT taşıyorsan"}
                        {active && dir !== "MIXED" && <span className="ml-1.5 rounded px-1 text-[9.5px] font-semibold" style={{ backgroundColor: `${col}22` }}>YÖN LEHİNE</span>}
                      </span>
                      <span className="font-mono text-[10.5px] text-slate-500">dayanak: {z.anchorClock} 15m {isLong ? "dip" : "zirve"} {num(z.anchor)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                      <span className="font-mono text-[22px] font-black" style={{ color: col }}>${num(z.stop)}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        SL alanı {num(z.zoneLo)} – {num(z.zoneHi)} · tampon {num(z.buffer)} (ATR₁₅ {stops.atr15 != null ? num(stops.atr15) : "—"} × {stops.mult})
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-snug text-slate-400">
                      {dist != null && (
                        <span className={hit ? "font-semibold text-amber-300" : ""}>
                          {hit ? "⚠ Fiyat stop seviyesine ulaştı/geçti" : `Fiyata uzaklık ${num(dist)} puan (%${num((dist / (price as number)) * 100)})`}
                        </span>
                      )}
                      {z.move && z.prevStop != null && (
                        <span>
                          Önceki 15m stopu {num(z.prevStop)} →{" "}
                          {z.move === "UP" ? <b style={{ color: col }}>stopu {isLong ? "yukarı" : "aşağı"} çek ({num(z.stop)})</b>
                            : z.move === "DOWN" ? <b className="text-slate-300">yeni seviye geride — mevcut stopu KORU</b>
                            : <b className="text-slate-300">değişmedi</b>}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
            Kural: stop yalnızca trend yönünde çekilir (LONG&apos;da yukarı, SHORT&apos;ta aşağı), asla geri gevşetilmez. Yalnızca KAPANMIŞ 15m mum kullanılır; oluşan mumun fitili stopu oynatmaz. Seviyeler grafikte SL çizgisi olarak görünür.
          </div>
        </div>

        </Hideable>

        {/* ── 3) Tahmin: günlük yol · 1 saatlik · harita (mevcut, aynen) ── */}
        {!date ? (
          <div className={`${SURFACE} px-3 py-8 text-center text-[12px] text-slate-500`}>Tahmin bölümü için fiyat ve seviye verisi bekleniyor.</div>
        ) : (
          <ForecastTabs
            bars={todayRth5.bars}
            date={date}
            nowSec={evalNow}
            model={journal?.model ?? null}
            fstats={journal?.fstats ?? null}
            facts={todayFacts}
            mapTab={
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
            <span className="text-[12px] font-semibold tracking-wide text-slate-300">
              Tahmin Haritası <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· destek / direnç · yolculuk · kapanış beklentisi</span>
            </span>
            {map && (
              <span className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-slate-500">gün sonu kapanış ≈</span>
                <b className="text-[14px] text-slate-100">${num(map.closeExpect)}</b>
                <span className="text-slate-500">({num(map.closeLow)} – {num(map.closeHigh)})</span>
              </span>
            )}
          </div>
          {!map || !date ? (
            <div className="px-3 py-8 text-center text-[12px] text-slate-500">Harita için fiyat ve seviye verisi bekleniyor.</div>
          ) : (
            <>
              <ForecastMap bars={todayRth5.bars} vwapSeries={todayRth5.vwap} emaSeries={todayRth5.ema} flow={flow} optLevels={optLevels} map={map} date={date} nowSec={evalNow} />
              <div className="grid grid-cols-1 gap-2 border-t border-[#1c2635] px-3 py-2 lg:grid-cols-2">
                <div>
                  <div className="mb-0.5 text-[11px] font-semibold" style={{ color: map.bias === "UP" ? "#4ade80" : map.bias === "DOWN" ? "#f87171" : "#facc15" }}>
                    {map.biasText}
                  </div>
                  <ol className="flex list-decimal flex-col gap-0.5 pl-4 text-[11.5px] leading-snug text-slate-300 marker:text-slate-500">
                    {map.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
                <ul className="flex flex-col gap-0.5 text-[11px] leading-snug text-slate-500">
                  {map.alt.map((a, i) => <li key={i}>⚠ {a}</li>)}
                  <li className="mt-0.5 text-slate-500">
                    Bu bir TAHMİNDİR. Seviyeler ölçülmüş veriden, yolculuk süresi ortalama saatlik hareketten, kapanış bandı 20 seanslık
                    dağılımdan gelir{forecastAccuracy && forecastAccuracy.checked > 0 ? ` (gerçekleşen isabet %${Math.round((forecastAccuracy.hit / forecastAccuracy.checked) * 100)}, ${forecastAccuracy.checked} seans)` : ""}.
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
            }
          />
        )}

        {/* ── 4) 15m + 5m grafik ── */}
        <Hideable title="15m / 5m Grafikleri" open={showCharts} onToggle={() => setShowCharts((v) => !v)}>
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#1c2635] px-2 py-1">
            <span className="text-[11px] font-semibold tracking-wide text-slate-300">15m / 5m Grafikleri</span>
            <div className="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                onClick={() => setToggles((t) => ({ ...t, candleType: t.candleType === "HA" ? "NORMAL" : "HA" }))}
                className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors ${toggles.candleType === "HA" ? "bg-[#0e7490] text-white" : "bg-[#111827] text-slate-400 hover:bg-[#1c2635]"}`}
              >
                {toggles.candleType === "HA" ? "HA" : "Normal"}
              </button>
              {([["vwap", "VWAP"], ["ema20", "EMA20"], ["ema21", "EMA21"], ["bb", "BB"], ["volume", "VOL"], ["markers", "SİN"], ["levels", "SEV"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
                  className={`rounded px-1.5 py-0.5 text-[10.5px] transition-colors ${toggles[key] ? "bg-[#1c2635] text-slate-200" : "bg-[#111827] text-slate-500 hover:text-slate-400"}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAutoScroll((a) => !a)}
                className={`rounded px-1.5 py-0.5 text-[10.5px] transition-colors ${autoScroll ? "bg-[#1c2635] text-slate-200" : "bg-[#111827] text-slate-500"}`}
                title="Yeni mum geldikçe sağa kaydır"
              >
                ⟳
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-0.5 lg:grid-cols-2">
            <div className="border-b border-[#1c2635] bg-[#0a0e17] lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-1.5 border-b border-[#1c2635] px-2 py-1 text-[10.5px] text-slate-500">
                15m — karar
                {m15Trend && <span className={`text-[13px] font-bold leading-none ${m15Trend === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{m15Trend === "UP" ? "↑" : "↓"}</span>}
              </div>
              <SpyChart
                bars={m15Bars} timeframe="15m" events={events} position={openPosition} toggles={toggles}
                height={380} autoScroll={autoScroll} defaultWindowMin={480}
                levelLines={chartLines} trendDirection={m15Trend}
              />
            </div>
            <div className="bg-[#0a0e17]">
              <div className="flex items-center gap-1.5 border-b border-[#1c2635] px-2 py-1 text-[10.5px] text-slate-500">
                5m — tetik (giriş / çıkış zamanlaması)
                {m5Trend && <span className={`text-[13px] font-bold leading-none ${m5Trend === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{m5Trend === "UP" ? "↑" : "↓"}</span>}
              </div>
              <SpyChart
                bars={m5Bars} timeframe="5m" events={events} position={openPosition} toggles={toggles}
                height={380} autoScroll={autoScroll} defaultWindowMin={120}
                levelLines={chartLines} trendDirection={m5Trend}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 border-t border-[#1c2635] px-2 py-1 font-mono text-[9.5px] text-slate-500">
            <span>Kaynak: {data?.dataSource.primary ?? "—"}</span>
            <span>Son kapanan: 5m {data?.lastClosed.m5 ? nyClock(data.lastClosed.m5) : "—"} · 15m {data?.lastClosed.m15 ? nyClock(data.lastClosed.m15) : "—"}</span>
          </div>
        </div>
        </Hideable>

        {/* ── 5) Anlık mum yorumları ── */}
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          <CommentFeed title="15m Mum Yorumları (karar) — fitil · konum · hacim · VWAP" items={analysis?.c15 ?? []} forming={forming15} />
          <CommentFeed title="5m Mum Yorumları (tetik) — fitil · konum · hacim · VWAP" items={analysis?.c5 ?? []} forming={forming5} />
        </div>

        {/* Motor kapıları — ayrıntı, varsayılan kapalı */}
        {/* ── 6) Tahmin günlüğü — gerçekleşenle kıyas ── */}
        <Hideable title="Tahmin Günlüğü" open={showJournal} onToggle={() => setShowJournal((v) => !v)}><JournalPanel j={journal} /></Hideable>

        <Disclosure title="Eski motor sinyali — 5m puan + 15m kapı (referans; karar desteği ve senaryo takibinden bağımsız)">
          <div className="flex flex-col gap-1.5">
            <div className="rounded border border-slate-700 bg-[#0f141d] px-3 py-1.5 text-[11.5px] text-slate-400">
              Bu bölüm eski giriş motorudur: ana karar 5m puanlama, 15m yalnızca teyit kapısıdır (ve 09:45 öncesi giriş üretmez). Sayfanın güncel rol dağılımı farklıdır:
              <b className="text-slate-200"> 30m genel yön · 15m karar · 5m tetik (giriş/çıkış zamanlaması)</b>. Çelişirse Senaryo Takibi ve Karar Desteği geçerlidir.
            </div>
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
            <GatePanel gates={data?.engine.gateStatus ?? null} />
          </div>
        </Disclosure>
      </div>

      <div className="mt-2 text-center font-mono text-[9.5px] text-slate-700">
        yoklama {pollMs / 1000}sn · {m1.length} × 1m mum yüklü · son yanıt {lastFetch ? `${nyClock(lastFetch, true)} ET` : "—"}
      </div>
    </div>
  );
}
