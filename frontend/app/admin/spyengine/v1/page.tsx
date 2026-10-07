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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SpyChart, { type ChartToggles } from "@/components/admin/spyengine/SpyChart";
import ForecastMap from "@/components/admin/spyengine/ForecastMap";
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
  emaByTime, decisionRead, FACTOR_MAX, CLOSE_TREND_START, sessionModeOf,
  type CandleComment, type Tone, type DecisionRead, type TfRead, type PlanSide,
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
          {title} <span className="text-[10.5px] font-normal text-slate-500">· {sub}</span>
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

function DecisionPanel({ d, price, secTo5, forming, waiting }: {
  d: DecisionRead | null;
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
  const dayCol = DIR_COLOR[d.day.dir];
  return (
    <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${col}66` }}>
      {/* başlık + karar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[12px] font-semibold tracking-wide text-slate-300">
          Karar Desteği <span className="text-[10.5px] font-normal text-slate-500">· her 5m kapanışında fiyat + hacim · 30m gidişat · 15m karar · 5m tetik (giriş/çıkış) · erken uyarı</span>
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

      {/* 5m · 15m · gün */}
      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2 xl:grid-cols-4">
        <TfColumn title="30m" sub="genel gidişat" r={d.r30} />
        <TfColumn title="15m" sub="karar" r={d.r15} />
        <TfColumn title="5m" sub="tetik · giriş/çıkış zamanlaması" r={d.r5} />
        <div className="bg-[#0f141d] px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-semibold text-slate-300">Gün geneli <span className="text-[10.5px] font-normal text-slate-500">· seans</span></span>
            <span className="font-mono text-[10.5px] text-slate-500">açılış {num(d.day.open)}</span>
          </div>
          <div className="mt-1 text-[16px] font-extrabold tracking-wide" style={{ color: dayCol }}>
            {d.day.dir === "UP" ? "▲ YUKARI" : d.day.dir === "DOWN" ? "▼ AŞAĞI" : "◆ YATAY"}
          </div>
          {/* gün aralığı konumu */}
          <div className="mt-1.5">
            <div className="flex justify-between font-mono text-[10px] text-slate-500">
              <span>dip {num(d.day.low)}</span><span>tepe {num(d.day.high)}</span>
            </div>
            <div className="relative h-1.5 rounded bg-[#1c2635]">
              {d.day.rangePos != null && (
                <span className="absolute top-[-3px] h-3 w-1 rounded bg-slate-100" style={{ left: `calc(${Math.round(d.day.rangePos * 100)}% - 2px)` }} />
              )}
            </div>
          </div>
          {d.day.buyShare != null && (
            <div className="mt-1.5">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-[#4ade80]">alıcı hacmi %{Math.round(d.day.buyShare * 100)}</span>
                <span className="text-[#f87171]">satıcı %{Math.round((1 - d.day.buyShare) * 100)}</span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded">
                <span className="bg-[#22c55e]" style={{ width: `${d.day.buyShare * 100}%` }} />
                <span className="flex-1 bg-[#ef4444]" />
              </div>
            </div>
          )}
          <div className="mt-1.5 text-[11px] leading-snug text-slate-400">{d.day.text}</div>
          {/* 5m skor geçmişi */}
          <div className="mt-1.5 text-[10px] text-slate-500">5m skor geçmişi (eski → yeni)</div>
          <div className="mt-0.5 flex flex-wrap gap-0.5">
            {d.history5.map((h) => {
              const c = h.score >= 3 ? "#22c55e" : h.score <= -3 ? "#ef4444" : "#64748b";
              return (
                <span key={h.clock} title={h.clock} className="rounded px-1 py-0.5 font-mono text-[10px] font-semibold" style={{ color: c, backgroundColor: `${c}1f` }}>
                  {h.clock.slice(-5)} {scoreTxt(h.score)}
                </span>
              );
            })}
          </div>
        </div>
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

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0f141d] px-3 py-2">
      <div className="mb-1 text-[11px] font-semibold text-slate-300">{title}</div>
      <div className="flex flex-col gap-0.5 text-[11px] leading-snug text-slate-400">{children}</div>
    </div>
  );
}

function FlowPanel({ f, price, nowMin, opt, scenarioDir }: { f: FlowRead | null; price: number | null; nowMin: number; opt: OptionLevels | null; scenarioDir: "UP" | "DOWN" | null }) {
  if (!f) {
    return (
      <div className={`${SURFACE} px-3 py-3 text-[12px] text-slate-500`}>
        <span className="font-semibold text-slate-300">Erken Uyarı · Likidite · Akıllı Para</span> — ilk 5m kapanışla başlar.
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
  return (
    <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${col}66` }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[12px] font-semibold tracking-wide text-slate-300">
          Erken Uyarı · Likidite · Akıllı Para <span className="text-[10.5px] font-normal text-slate-500">· süpürme · emilim · kurumsal itki · delta uyumsuzluğu · POC göçü · sıkışma/ivme</span>
        </span>
        <span className="font-mono text-[10.5px] text-slate-500">alıcı {w.bull} · satıcı {w.bear} puan</span>
      </div>

      <div className="px-3 py-2" style={{ backgroundColor: `${col}12` }}>
        <div className={`text-[15px] font-extrabold tracking-wide sm:text-[17px] ${w.level === "STARTED" ? "animate-pulse" : ""}`} style={{ color: col }}>
          {scenarioDir && w.side && w.level !== "NONE" ? (
            (w.side === "LONG") === (scenarioDir === "UP")
              ? `${w.headline} — senaryoyu DESTEKLİYOR (yeni giriş değil, taşı)`
              : `${w.headline} — senaryoya TERS: erken uyarı, trend değişimi koşullarını izle`
          ) : w.headline}
        </div>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded bg-[#1c2635]">
          <span className="bg-[#22c55e]" style={{ width: `${(w.bull / tot) * 100}%` }} />
          <span className="bg-[#ef4444]" style={{ width: `${(w.bear / tot) * 100}%` }} />
        </div>
        {w.level !== "NONE" && nowMin > 0 && nowMin < CLOSE_TREND_START && (
          <div className="mt-1 text-[11px] text-amber-300/90">
            ⚠ Bu saatte (14:00 öncesi) erken uyarı geçmiş ölçümde zayıf (%40 isabet) — kararı Karar Desteği&apos;ndeki seans planı verir; bu uyarı yalnızca bilgi.
          </div>
        )}
        {(w.targets.length > 0 || w.invalidation != null) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-500">{w.side ? "hareket sürerse duraklar:" : "olası duraklar:"}</span>
            {w.targets.map((t, i) => (
              <span key={i} className="rounded border border-[#1c2635] bg-[#0a0e17] px-1.5 py-0.5 text-slate-200" title={t.label}>
                {i + 1}) <b>{num(t.price)}</b> <span className="text-slate-500">{t.label} · {num(t.dist)} puan</span>
              </span>
            ))}
            {w.invalidation != null && (
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">iptal: 5m kapanış {w.side === "LONG" ? "<" : ">"} {num(w.invalidation)}</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] lg:grid-cols-2">
        {([["Alıcı izleri", w.bullWhy, "#4ade80"], ["Satıcı izleri", w.bearWhy, "#f87171"]] as const).map(([t, list, c]) => (
          <div key={t} className="bg-[#0f141d] px-3 py-2">
            <div className="mb-0.5 text-[11px] font-semibold" style={{ color: c }}>{t}</div>
            {list.length === 0 ? (
              <div className="text-[11px] text-slate-500">belirgin iz yok</div>
            ) : (
              <ul className="flex flex-col gap-0.5 text-[11px] leading-snug text-slate-300">
                {list.map((x, i) => <li key={i}>• {x}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2 xl:grid-cols-4">
        <MiniCard title="Hacim profili (POC)">
          {prof ? (
            <>
              <span>POC <b className="text-[#fb923c]">{num(prof.poc)}</b> · değer alanı {num(prof.val)} – {num(prof.vah)}</span>
              <span>
                Fiyat{" "}
                {px > prof.vah ? <b className="text-[#4ade80]">değer alanı ÜSTÜNDE → yukarıda kabul arıyor</b>
                  : px < prof.val ? <b className="text-[#f87171]">değer alanı ALTINDA → aşağıda kabul arıyor</b>
                  : <b className="text-slate-300">değer alanı içinde → POC&apos;a dönüş eğilimi</b>}
              </span>
              <span>Son 1 saat POC kayması: <b className={prof.pocShift > 0 ? "text-[#4ade80]" : prof.pocShift < 0 ? "text-[#f87171]" : "text-slate-300"}>{signed(prof.pocShift)}</b></span>
              <span className="font-mono text-[10px] text-slate-500">{prof.pocPath.map((p) => `${p.clock} ${num(p.poc)}`).join(" → ")}</span>
            </>
          ) : <span>veri yok</span>}
        </MiniCard>
        <MiniCard title="Kümülatif delta (alıcı − satıcı)">
          <span>Seans: <b className={f.cumDelta >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{fmtD(f.cumDelta)}</b></span>
          <span>
            Son 30 dk: <b className={f.delta30 >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{fmtD(f.delta30)}</b>
            {f.deltaPct30 != null && <> (%{Math.round(f.deltaPct30 * 100)} → {Math.abs(f.deltaPct30) < 0.12 ? "dengede" : f.deltaPct30 > 0 ? "alıcı baskın" : "satıcı baskın"})</>}
          </span>
          <span className="text-[10.5px] text-slate-500">Kapanış konumundan tahmin — fiyat yeni dip yaparken delta yükseliyorsa gizli alım (uyumsuzluk) var demektir.</span>
        </MiniCard>
        <MiniCard title="Sıkışma · ivme">
          <span>
            {f.compression.active ? <b className="text-amber-300">SIKIŞMA</b> : "Sıkışma yok"}
            {f.compression.ratio != null && <> · son 30 dk mum boyu ortalamanın {f.compression.ratio.toFixed(2)}×</>}
          </span>
          {f.compression.boxHigh != null && f.compression.boxLow != null && (
            <span>Kutu {num(f.compression.boxLow)} – {num(f.compression.boxHigh)} → hacimli kapanışla kırılan yön ivmelenir</span>
          )}
          <span>{f.accel.text ? <b className={f.accel.dir > 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{f.accel.text}</b> : "İvme artışı yok (son 3 mum aynı yönde büyümüyor)"}</span>
        </MiniCard>
        <MiniCard title="Likidite havuzları (stop kümeleri)">
          {above.map((p) => <span key={`a${p.price}`}>▲ <b className="text-[#facc15]">{num(p.price)}</b> {p.label} <span className="text-slate-500">+{num(p.price - px)}</span></span>)}
          {below.map((p) => <span key={`b${p.price}`}>▼ <b className="text-[#facc15]">{num(p.price)}</b> {p.label} <span className="text-slate-500">−{num(px - p.price)}</span></span>)}
          {above.length + below.length === 0 && <span>yakında süpürülmemiş havuz yok</span>}
          <span className="text-[10.5px] text-slate-500">Fiyat bu seviyelere çekilir (stoplar orada). Fitille geçip geri dönerse = süpürme → dönüş sinyali.</span>
        </MiniCard>
      </div>

      <div className="border-t border-[#1c2635] px-3 py-1.5 text-[11px] leading-snug text-slate-400">
        <span className="font-semibold text-slate-300">Opsiyon seviyeleri</span>{" "}
        <span className="text-slate-500">(yalnızca seviye — yön kararına girmez)</span>
        {!opt ? (
          <span className="ml-1 text-slate-500">· opsiyon zinciri alınamadı</span>
        ) : (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono">
            <span className="text-slate-500">{opt.isZeroDte ? "0DTE" : `vade ${opt.expiry} (0DTE yok)`}:</span>
            {opt.callWalls.map((w, i) => (
              <span key={`c${w.strike}`} className="rounded border border-[#ef4444]/30 bg-[#ef4444]/10 px-1.5 py-0.5 text-[#f87171]" title="Dünkü açık pozisyon (OI) — fiyat yukarıdan bu seviyeye çarpma eğilimi">
                call duvarı{i ? " 2" : ""} <b>{num(w.strike)}</b> <span className="text-slate-500">{opt.basis} {Math.round(w.openInterest / 1000)}K · {num(w.strike - (price ?? opt.spot))}</span>
              </span>
            ))}
            {opt.putWalls.map((w, i) => (
              <span key={`p${w.strike}`} className="rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-1.5 py-0.5 text-[#4ade80]" title="Dünkü açık pozisyon (OI) — fiyat aşağıdan bu seviyeye çarpma eğilimi">
                put duvarı{i ? " 2" : ""} <b>{num(w.strike)}</b> <span className="text-slate-500">{opt.basis} {Math.round(w.openInterest / 1000)}K · {num(w.strike - (price ?? opt.spot))}</span>
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
        <div className="mt-0.5 text-[10.5px] text-slate-500">
          OI dünkü kapanış değeridir (vade günü değişmez); açılış öncesi 0DTE OI henüz yayınlanmadığından son işlem günü hacmi kullanılır. ±%3 pencere; veri gecikmeli olabilir. Duvarlar fiyatı çeker/durdurur — yön vermez.
        </div>
      </div>

      {f.events.length > 0 && (
        <div className="border-t border-[#1c2635] px-3 py-1.5">
          <div className="mb-0.5 text-[11px] font-semibold text-slate-300">Akıllı para olayları <span className="font-normal text-slate-500">· en yeni üstte</span></div>
          <ul className="flex max-h-[140px] flex-col gap-0.5 overflow-y-auto text-[11px] leading-snug">
            {f.events.slice().reverse().slice(0, 12).map((e) => (
              <li key={`${e.kind}${e.time}`} className="flex gap-1.5">
                <span className="font-mono text-slate-500">{e.clock}</span>
                <span className={`shrink-0 rounded px-1 font-mono text-[10px] font-semibold ${e.bias > 0 ? "bg-[#22c55e]/15 text-[#4ade80]" : "bg-[#ef4444]/15 text-[#f87171]"}`}>{EVENT_TAG[e.kind]}</span>
                <span className="text-slate-400">{e.text}</span>
              </li>
            ))}
          </ul>
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
          Açılış Tahmini <span className="text-[11px] font-normal text-slate-400">· {r.session} seansı · ES fair value (dünkü kapanış {num(r.prevClose)} × ES değişimi)</span>
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
  learned: { stageStats: Record<string, { hit60: number; hitClose: number }> | null; bandScale: Record<string, number> | null };
  minN: number;
  recent: JournalDay[];
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
          Tahmin Günlüğü <span className="text-[11px] font-normal text-slate-400">· her seans kaydedilir, gerçekleşenle kıyaslanır · {st.n} gün ({st.liveN} canlı, {st.n - st.liveN} geriye dönük)</span>
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
          Senaryo · ön plan <span className="text-[11px] font-normal text-slate-400">· gün yönü 09:55–10:00&apos;da kilitlenince bu plan günün senaryosuna dönüşür ve gün boyu TAKİP edilir</span>
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
            Senaryo Takibi <span className="text-[11px] font-normal text-slate-400">· sabah yön çıkmadı — gün içi yeni bacak tetiği aranıyor (alıcı/satıcı hamlesi, katalizör)</span>
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
          Senaryo Takibi <span className="text-[11px] font-normal text-slate-400">· {a.kind === "GÜN İÇİ" ? `${a.legNo}. bacak (gün içi, ${a.clock})` : `açılış senaryosu (${a.clock})`} — her dakika yeniden üretilmez, takip edilir; trend değişirse yeni bacak aranır</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <DayChip day={day} recent={recent} />
          <span className="rounded border px-2 py-0.5 text-[12px] font-bold" style={{ color: st.col, borderColor: `${st.col}77`, backgroundColor: `${st.col}18` }}>
            {st.icon} {t.status}
          </span>
        </span>
      </div>
      <LegStrip chain={chain} />
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

// ── Sayfa ─────────────────────────────────────────────────────────

export default function SpyEngineV9() {
  const [toggles, setToggles] = useState<ChartToggles>(DEFAULT_TOGGLES);
  const [pollMs, setPollMs] = useState(1000);
  const [autoScroll, setAutoScroll] = useState(true);
  /** Tickerlar varsayılan GİZLİ — "göster" deyince görünür */
  const [showTickers, setShowTickers] = useState(false);
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

  const pendingLeg = chain?.pending ?? null;
  /** Karar desteği — her kapanan 5m/15m mumda yeniden okunur */
  const decision = useMemo<DecisionRead | null>(() => {
    if (!analysis || analysis.opening.status === "WAITING") return null;
    return decisionRead({
      s5: analysis.s5, s15: analysis.s15, s30: analysis.s30, ema5, ema15, ema30, warning: flow?.warning ?? null, price, vwapNow,
      atr5, profile: flow?.profile ?? null, hourlyRange: data?.levels?.hourlyRange ?? null,
      dayKind: dayLive ? { kind: dayLive.kind, side: dayLive.side } : null,
      track: legAnchor && track ? { status: track.status, dir: legAnchor.dir, clock: legAnchor.clock, title: track.title, lines: track.lines, watch: pendingLeg ? [pendingLeg.text, ...track.watch] : track.watch, ifNotIn: track.ifNotIn, changeLevel: track.rules[1]?.level ?? null } : null,
      opening: analysis.opening, stops,
      supports: map?.supports ?? [], resistances: map?.resistances ?? [],
    });
  }, [analysis, ema5, ema15, ema30, flow, price, vwapNow, stops, map, atr5, data?.levels?.hourlyRange, legAnchor, track, dayLive, pendingLeg]);

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
    const base = data?.levels?.lines ?? [];
    if (!stops) return base;
    // karar panelinin yönü (Canlı Yön kartının ham VWAP okuması değil)
    const dir = decision?.action === "LONG" ? "UP" : decision?.action === "SHORT" ? "DOWN" : "MIXED";
    const out = [...base];
    if (stops.long && dir !== "DOWN") out.push({ price: stops.long.stop, label: `LONG SL ${stops.long.stop.toFixed(2)}`, color: "#22c55e" });
    if (stops.short && dir !== "UP") out.push({ price: stops.short.stop, label: `SHORT SL ${stops.short.stop.toFixed(2)}`, color: "#ef4444" });
    return out;
  }, [data?.levels?.lines, stops, decision?.action]);

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
      ? `${legAnchor.clock}:${legAnchor.dir}:${track?.status ?? ""}:${track?.counterWarn ? "w" : ""}:${chain?.pending?.dir ?? ""}`
      : `-:${chain?.pending?.dir ?? ""}`;
    const prev = lastAlertKeyRef.current;
    lastAlertKeyRef.current = key;
    if (prev == null || prev === key || !alertSound || replayDate) return;
    const [pc, , ps, pw, pp] = prev.split(":");
    if (legAnchor && track) {
      // yeni bacak: yalnızca GERÇEKTEN yeni kurulduysa (≤3 dk) çal — geç yüklenen sayfada çalma
      if (pc !== legAnchor.clock) { if (anchorFresh) chime("fired"); return; }
      if (track.status === "DEĞİŞTİ" && ps !== "DEĞİŞTİ") { chime("fired"); return; }
      if ((track.status === "ZAYIFLIYOR" && ps !== "ZAYIFLIYOR") || (track.counterWarn && pw !== "w")) { chime("imminent"); return; }
    }
    if (chain?.pending && (pp ?? "") !== chain.pending.dir) chime("imminent");
  }, [legAnchor, track, chain?.pending, anchorFresh, alertSound, replayDate, chime]);

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
            <h1 className="text-[15px] font-semibold tracking-tight text-[#eab308]">SPY Engine V10 · Senaryo Takibi</h1>
            <p className="text-[10.5px] text-slate-500">
              30m genel yön · 15m karar · 5m tetik (giriş/çıkış zamanlaması) · 09:55 gün yönü kilitlenir, o senaryo gün boyu takip edilir · trend değişimi uyarısı · VWAP + EMA20 · POC / likidite / akıllı para · tahmin haritası
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
              showTickers ? "border-sky-500/40 bg-sky-500/10 text-sky-300" : "border-[#1c2635] bg-[#111827] text-slate-400 hover:bg-[#1c2635]"
            }`}
          >
            Tickerlar: {showTickers ? "gizle" : "göster"}
          </button>
        </div>
      </header>

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
        {!replayDate && <OpenForecastPanel r={openFc} compact={sessionActive && !!openFc?.actual} />}

        {!replayDate && !sessionActive && <ScenarioPanel sc={scenarioRead.sc} expectation={vixExpectation(openFc?.vixNow ?? null)} waitReason={scenarioRead.wait} />}

        {!sessionActive && (
          <div className={`${SURFACE} px-4 py-2.5 text-[12px] text-slate-400`}>
            <b className="text-slate-200">Seans analizi 09:35 ET&apos;de başlar</b> — 09:35 ilk 5m · 09:45 15m · 09:55 büyük resim (gün yönü kararı) · belirsizse 10:00 30m teyidi.
            Açılış Rejimi, Karar Desteği, Erken Uyarı ve Trend Stop kartları ilk 5m kapanışında açılır.
          </div>
        )}

        {sessionActive && (<>
        {/* ── 1) Açılış rejimi + 3 mum yönü ── */}
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${opColor}55` }}>
            <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
              <span className="text-[12px] font-semibold tracking-wide text-slate-300">
                Açılış Rejimi <span className="text-[10.5px] font-normal text-slate-500">· 09:35 ilk okuma → 09:45 15m → 09:55 büyük resim (karar) → gerekirse 10:00 30m teyidi</span>
              </span>
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
            </div>
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
          </div>

          <div className={`${SURFACE} overflow-hidden`} style={{ borderColor: `${live ? liveColor : "#64748b"}55` }}>
            <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
              <span className="text-[12px] font-semibold tracking-wide text-slate-300">
                VWAP Konumu <span className="text-[10.5px] font-normal text-slate-500">· ham okuma (yalnızca 5m + 15m VWAP tarafı) · işlem yönü: Karar Desteği</span>
              </span>
              <span className="font-mono text-[10.5px] text-slate-500">
                {live ? `5m ${live.asOf5} · 15m ${live.asOf15 ?? "—"} kapanışı · ` : ""}
                kontrol {minuteSlot ? nyClock(minuteSlot * 60) : "—"} · sonraki {evalNow ? 60 - (evalNow % 60) : "—"}sn
              </span>
            </div>
            {!live ? (
              <div className="px-4 py-6 text-[12px] text-slate-500">
                09:45 ET 15m kapanışına kadar yön okuması başlamaz. Kapanan mumların yorumu aşağıda akıyor.
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
                    <div className="text-[10.5px] text-slate-500">{live.strength}</div>
                  </div>
                  <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-slate-400">{live.text}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t border-[#1c2635] px-3 py-1.5 font-mono text-[10.5px]">
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

        {/* ── 1b) Karar desteği — 5m · 15m · gün geneli (fiyat + hacim) ── */}
        <DecisionPanel
          d={decision}
          price={price}
          secTo5={evalNow ? 300 - (evalNow % 300) : null}
          forming={forming5}
          waiting={!analysis || analysis.opening.status === "WAITING"}
        />

        {/* ── 1b2) Senaryo Takibi (çapa varsa) — yoksa ön plan ── */}
        {chain ? <ScenarioTrackPanel t={track} chain={chain} day={dayLive} recent={dayRecent} /> : !replayDate && <ScenarioPanel sc={scenarioRead.sc} expectation={null} waitReason={scenarioRead.wait} />}

        {/* ── 1c) Erken uyarı · likidite · akıllı para ── */}
        <FlowPanel f={flow} price={price} nowMin={nowMin} opt={optLevels} scenarioDir={legAnchor && track && track.status !== "DEĞİŞTİ" ? legAnchor.dir : null} />
        </>)}

        {/* ── 2b) 15m yapı stopu — trend taşırken stopu nereye çekeceğini gösterir ── */}
        {sessionActive && (
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
            <span className="text-[12px] font-semibold tracking-wide text-slate-300">
              Trend Stop Bölgesi <span className="text-[10.5px] font-normal text-slate-500">· taşıma stopu referansı: son kapanan 15m dip/zirve ± ATR tamponu · her 15m kapanışta yenilenir · trend DEĞİŞİMİ kuralı için Senaryo Takibi</span>
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
            <div className="px-3 py-4 text-[12px] text-slate-500">İlk 15m mum 09:45 ET&apos;de kapanınca stop bölgesi oluşur.</div>
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

        )}

        {/* ── 3) Tahmin haritası ── */}
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
            <span className="text-[12px] font-semibold tracking-wide text-slate-300">
              Tahmin Haritası <span className="text-[10.5px] font-normal text-slate-500">· destek / direnç · yolculuk · kapanış beklentisi</span>
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

        {/* ── 4) 15m + 5m grafik ── */}
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

        {/* ── 5) Anlık mum yorumları ── */}
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          <CommentFeed title="15m Mum Yorumları (karar) — fitil · konum · hacim · VWAP" items={analysis?.c15 ?? []} forming={forming15} />
          <CommentFeed title="5m Mum Yorumları (tetik) — fitil · konum · hacim · VWAP" items={analysis?.c5 ?? []} forming={forming5} />
        </div>

        {/* Motor kapıları — ayrıntı, varsayılan kapalı */}
        {/* ── 6) Tahmin günlüğü — gerçekleşenle kıyas ── */}
        <JournalPanel j={journal} />

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
