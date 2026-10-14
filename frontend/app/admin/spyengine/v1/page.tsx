"use client";

/**
 * SPY Engine — Karar Merdiveni (/admin/spyengine/v1)
 *
 * Ekranda aynı anda TEK durum görünür (lib/spyengine/ladder.ts):
 *   İŞLEM YOK · İZLE · ERKEN UYARI · TETİK · TERS UYARI · İPTAL
 *   1) yön izni = seans planı (açılış yönü · öğlen VWAP'a dönüş · kapanış VWAP+POC · tepe/dip reddi) → 2) 5m erken uyarı → 3) 5m tetik → 4) risk.
 * Diğer kartlar (VWAP, EMA20/yapı, hacim/RVOL, likidite/akış, pivot, açılış aşamaları,
 * 15m/5m mum yorumları) yalnızca GEREKÇE gösterir; kendi yön hükmü vermez.
 * Kaldırılanlar (çelişkili ikinci hüküm üretiyorlardı): Karar Desteği, Senaryo Takibi,
 * gün tipi/"son 2 saat" etiketi, VWAP/EMA20 "TEYİTLİ/YUKARI" rozetleri, eski motor sinyali.
 *
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur;
 * API uçları da ayrıca satır içi kontrol yapar.
 */

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { prevDayPivots, pivotRead, PIVOT_ORDER, type PivotKey, type PivotRead } from "@/lib/spyengine/pivots";
import SpyChart, { type ChartToggles } from "@/components/admin/spyengine/SpyChart";
import ForecastMap from "@/components/admin/spyengine/ForecastMap";
import ForecastTabs from "@/components/admin/spyengine/ForecastTabs";
import type { ForecastModel, ForecastStats } from "@/lib/spyengine/forecastModel";
import Setup15Panel from "@/components/admin/spyengine/Setup15Panel";
import DecisionLogPanel, { type DecisionResp } from "@/components/admin/spyengine/DecisionLogPanel";
import { applyTrust, type ModeStat } from "@/lib/spyengine/decisionCore";
import { backtestSetup15, mergeHourly, readSetup15 } from "@/lib/spyengine/setup15";
import { BiasStrip, BookOptionsCard, EmaCard, VolumeCard, VwapCard } from "@/components/admin/spyengine/EvidenceCards";
import { bookRead, dayBias, emaTf, emaVerdict, optionFlowRead, pressureRead, vwapRead, type BookSample } from "@/lib/spyengine/evidence";
import type { OptionFlow, QuoteBook } from "@/lib/spyengine/optionFetch";
import {
  TickerStrip, InfoCards, PhaseBadge, SURFACE, num, signed, tone,
  type StripQuote, type SpotStats,
} from "@/components/admin/spyengine/panels";
import {
  fromCompact, nyClock, nyParts, isRthBar, bucketAggregate, atr, lastNum,
  type Bar, type SessionInfo, type CompactBar,
} from "@/lib/spyengine/core";
import {
  daySeries, liveVwap, fmtVol, stopZones, openingRegime, buildForecastMap, emaByTime,
  type CandleComment, type Tone,
} from "@/lib/spyengine/openingMap";
import type {
  EngineEvent, PositionState, ContractType, EngineState, GateStatus, RegimeState,
} from "@/lib/spyengine/strategy";
import type { LevelRead, CloseForecast } from "@/lib/spyengine/levels";
import { flowRead, type FlowRead } from "@/lib/spyengine/flow";
import { optionLevelList, type OptionLevels } from "@/lib/spyengine/optionLevels";
import type { OpenForecastRead } from "@/lib/spyengine/openForecastFetch";
import type { JournalDay, JournalStats } from "@/lib/spyengine/journal";
import type { ReversalState } from "@/lib/spyengine/reversal";
import {
  ladderRead, ladderComment5, ladderComment15, ladderForming, rvolText, rsiSeries, LADDER_CFG,
  type LadderRead, type LadderStep, type LadderStatus, type Cond, type RvolBase,
} from "@/lib/spyengine/ladder";

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
  /** Karar merdiveni RVOL tabanı (son 20 seans, aynı saat) */
  rvolBase?: RvolBase | null;
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
        <span className={`rounded bg-[#0a0e17] px-1 py-0.5 ${c.volRatio != null && c.volRatio >= 1.2 ? "text-sky-300" : c.volRatio != null && c.volRatio < 0.8 ? "text-amber-300" : ""}`}>
          hacim {fmtVol(c.volume)}{c.volRatio != null ? ` · RVOL ${c.volRatio.toFixed(2)}` : ""}
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

// ── Karar merdiveni — sayfanın TEK karar kaynağı (lib/spyengine/ladder.ts) ──

const LADDER_STYLE: Record<LadderStatus, { col: string; dot: string }> = {
  "İŞLEM YOK": { col: "#94a3b8", dot: "⚪" },
  "İZLE": { col: "#38bdf8", dot: "🔵" },
  "ERKEN UYARI": { col: "#eab308", dot: "🟡" },
  "TETİK": { col: "#22c55e", dot: "🟢" },
  "TERS UYARI": { col: "#fb923c", dot: "🟠" },
  "İPTAL": { col: "#94a3b8", dot: "⚪" },
};
const ladderCol = (s: LadderStep) => (s.status === "TETİK" ? (s.side === "PUT" ? "#ef4444" : "#22c55e") : LADDER_STYLE[s.status].col);
const ladderDot = (s: LadderStep) => (s.status === "TETİK" ? (s.side === "PUT" ? "🔴" : "🟢") : LADDER_STYLE[s.status].dot);

/** En üstteki tek satır: durum · neden · ne olursa değişir */
function LadderBar({ s, waiting }: { s: LadderStep | null; waiting: boolean }) {
  if (!s) {
    return (
      <div className="rounded-lg border-2 border-slate-600 bg-slate-700/10 px-4 py-2.5 text-[15px] font-semibold text-slate-300">
        ⚪ İŞLEM YOK · {waiting ? "09:35 ET ilk 5m kapanışı bekleniyor; rejim için 15m kapanışlar gerekir (en erken 10:00)." : "mum verisi bekleniyor."}
      </div>
    );
  }
  const col = ladderCol(s);
  const pl = s.plan;
  return (
    <div className="rounded-lg border-2 px-4 py-2.5" style={{ borderColor: col, backgroundColor: `${col}14` }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`text-[20px] font-black tracking-wide ${s.status === "TETİK" || s.status === "ERKEN UYARI" ? "animate-pulse" : ""}`} style={{ color: col }}>
          {ladderDot(s)} {s.status}
        </span>
        <span className="text-[15px] font-semibold leading-snug text-slate-100">· {s.message}</span>
        <span className="ml-auto font-mono text-[11px] text-slate-500">son 5m kapanış {s.clock} ET</span>
      </div>
      <div className="mt-1 text-[13px] leading-snug text-slate-300"><b className="text-slate-400">Ne olursa değişir:</b> {s.change}</div>
      {pl && (s.status === "TETİK" || s.status === "TERS UYARI") && (
        <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono text-[12px] sm:grid-cols-4">
          <div className="rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-1"><div className="text-[10px] text-slate-500">giriş (5m kapanış)</div><b className="text-slate-100">{num(pl.entry)}</b></div>
          <div className="rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-1"><div className="text-[10px] text-slate-500">stop · {pl.stopAtr.toFixed(2)} ATR</div><b className="text-slate-100">{num(pl.stop)}</b></div>
          <div className="rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-1"><div className="text-[10px] text-slate-500">hedef ({pl.targetLabel})</div><b className="text-slate-100">{num(pl.target)}</b></div>
          <div className="rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-1"><div className="text-[10px] text-slate-500">kurulum</div><b className="text-[11px] text-slate-100">{pl.setup}</b></div>
        </div>
      )}
    </div>
  );
}

function CondList({ title, conds, empty }: { title: string; conds: Cond[] | null; empty: string }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-semibold text-slate-400">{title}</div>
      {!conds || conds.length === 0 ? <div className="text-[11.5px] text-slate-500">{empty}</div> : (
        <ul className="flex flex-col gap-0.5">
          {conds.map((c) => (
            <li key={c.key} className="flex gap-1.5 text-[11.5px] leading-snug">
              <span className={c.ok ? "text-sky-300" : "text-slate-600"}>{c.ok ? "✓" : "✗"}</span>
              <span className={c.ok ? "text-slate-200" : "text-slate-400"}>
                {c.label}{c.required && <span className="text-slate-500"> · zorunlu</span>}
                <span className="block font-mono text-[10.5px] text-slate-500">{c.value}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** küçük durum rozeti (✓ / ✗ / —) */
function Pill({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  const cls = ok == null ? "border-slate-700 text-slate-500" : ok ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]" : "border-slate-700 bg-slate-800/40 text-slate-400";
  return <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{ok == null ? "•" : ok ? "✓" : "✗"} {children}</span>;
}

/** Karar özeti: ŞİMDİ ne yap · NEDEN · giriş kontrol listesi / plan ne zaman değişir (sade ve sonuç odaklı) */
function LadderSummary({ L, s, hist }: { L: LadderRead; s: LadderStep; hist: ModeStat | null }) {
  const rg = s.regime;
  const side = s.side ?? (rg.permission === "CALL" || rg.permission === "PUT" ? rg.permission : null);
  const sideN = side === "CALL" ? 1 : side === "PUT" ? -1 : 0;
  const pl = s.plan;
  const col = ladderCol(s);
  const arrow = side === "CALL" ? "▲" : side === "PUT" ? "▼" : "◆";
  const headline =
    s.status === "TETİK" && pl ? `${arrow} ${pl.side} — pozisyon açık`
      : s.status === "ERKEN UYARI" ? `${arrow} ${side ?? ""} İÇİN HAZIRLAN`
        : s.status === "İZLE" ? `${arrow} ${side ?? ""} YÖNÜ AÇIK · GİRME`
          : s.status === "TERS UYARI" ? "⚠ TERS UYARI — pozisyonu koru"
            : s.status === "İPTAL" ? "✕ KURULUM İPTAL"
              : "◆ BEKLE — işlem yok";
  const sub =
    s.status === "TETİK" && pl ? `giriş ${num(pl.entry)} · stop ${num(pl.stop)} · hedef ${num(pl.target)}`
      : s.status === "ERKEN UYARI" ? "Emri hazırla, girme. 5m tetik mumu kapanınca gir."
        : s.status === "İZLE" ? "Yön izni var ama kurulum henüz oluşmadı — tetik mumunu bekle."
          : s.status === "TERS UYARI" ? "Ters yönde sinyal var: kârı al ya da stopu sıkılaştır."
            : s.status === "İPTAL" ? "Tetik geldi ama risk/hedef uygun değil — yeni kurulum beklenir."
              : "Seans planı yön vermiyor.";
  const trig = (s.status === "İZLE" || s.status === "ERKEN UYARI") ? (s.trigConds ?? []).filter((c) => c.required || c.key === "t4") : [];
  const reqOk = trig.filter((c) => c.required).every((c) => c.ok);
  const done = L.attempts.filter((a) => a.r != null);
  const totR = done.reduce((a, x) => a + (x.r ?? 0), 0);
  const rsiOk = (d: 1 | -1 | 0) => (sideN === 0 ? null : d === sideN);
  return (
    <div className="grid grid-cols-1 gap-px bg-[#1c2635] md:grid-cols-[1.05fr_1fr_1fr]">
      {/* ŞİMDİ */}
      <div className="bg-[#0f141d] px-3 py-2.5" style={{ borderLeft: `3px solid ${col}` }}>
        <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">Şimdi</div>
        <div className="mt-0.5 text-[19px] font-black leading-tight tracking-wide" style={{ color: col }}>{headline}</div>
        <div className="mt-1 text-[12.5px] leading-snug text-slate-200">{sub}</div>
        {s.status === "TETİK" && pl && <div className="mt-1 font-mono text-[11px] text-slate-400">{pl.setup} · stop {pl.stopAtr.toFixed(2)} ATR</div>}
        {s.trendEnd && s.trendEnd.level !== "İZLE" && (
          <div className={`mt-1.5 rounded border px-2 py-1 text-[12px] font-semibold leading-snug ${s.trendEnd.level === "BİTTİ" ? "border-[#ef4444]/50 bg-[#ef4444]/10 text-[#f87171]" : "border-orange-500/50 bg-orange-500/10 text-orange-300"}`}>⚠ {s.trendEnd.text}</div>
        )}
        {s.manage && (
          <div className="mt-1.5 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[12px] leading-snug text-sky-100"><b className="text-sky-300">{s.manage.action}</b> — {s.manage.text}</div>
        )}
        <div className="mt-1.5 font-mono text-[11px] text-slate-500">
          bugün: {L.attempts.length ? `${L.attempts.length} deneme · ${done.length ? `${totR >= 0 ? "+" : ""}${totR.toFixed(1)}R` : "sonuç bekleniyor"}` : "deneme yok"}
        </div>
      </div>

      {/* NEDEN */}
      <div className="bg-[#0f141d] px-3 py-2.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">Neden</div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-slate-100 line-clamp-4">{s.message}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300">{rg.mode}</span>
          {s.confirm && (<>
            <Pill ok={s.confirm.m15}>15m</Pill><Pill ok={s.confirm.m30}>30m</Pill><Pill ok={s.confirm.h1}>1h</Pill>
          </>)}
          {s.rsi && sideN !== 0 && (<>
            <Pill ok={rsiOk(s.rsi.d15)}>RSI 15m {s.rsi.v15 != null ? s.rsi.v15.toFixed(0) : "—"}</Pill>
            <Pill ok={rsiOk(s.rsi.d30)}>RSI 30m {s.rsi.v30 != null ? s.rsi.v30.toFixed(0) : "—"}</Pill>
          </>)}
        </div>
        {hist && hist.n >= 10 && (
          <div className="mt-1.5 text-[11px] leading-snug text-slate-300">
            Arşivde <b>{s.regime.mode}</b>: {hist.n} işlem · %{Math.round((100 * hist.wins) / hist.n)} kazanç · ort. <b className={hist.avgR >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{hist.avgR >= 0 ? "+" : "−"}{Math.abs(hist.avgR).toFixed(2)}R</b> · güven <b>{hist.level}</b>
          </div>
        )}
        {s.confirm && <div className="mt-1 text-[10.5px] leading-snug text-slate-500">Rozetler işlem yönüyle uyum (yeşil ✓ = aynı yönde). Üst zaman ve RSI bilgidir; giriş yalnız 5m tetikten gelir.</div>}
        {s.reverse.length > 0 && <div className="mt-1 text-[12px] leading-snug text-orange-300">⚠ {s.reverse[0]}</div>}
      </div>

      {/* KONTROL LİSTESİ / PLAN */}
      <div className="bg-[#0f141d] px-3 py-2.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">{trig.length ? "Girmeden önce kontrol" : "Plan ne zaman değişir"}</div>
        {trig.length ? (
          <>
            <ul className="mt-1 flex flex-col gap-1">
              {trig.map((c) => (
                <li key={c.key} className="flex items-start gap-1.5 text-[12px] leading-snug">
                  <span className={`mt-[1px] font-bold ${c.ok ? "text-[#4ade80]" : "text-slate-600"}`}>{c.ok ? "✓" : "✗"}</span>
                  <span className={c.ok ? "text-slate-100" : "text-slate-400"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 text-[11px] font-semibold" style={{ color: reqOk ? "#4ade80" : "#94a3b8" }}>{reqOk ? "Zorunlu şartlar tamam — kapanışta TETİK." : "Zorunlu şartlar tamamlanınca TETİK."}</div>
          </>
        ) : <div className="mt-1 text-[12.5px] leading-snug text-slate-100">{s.change}</div>}
      </div>
    </div>
  );
}

/** Merdivenin ayrıntısı: 4 adımın koşulları, risk, gün içi durum geçmişi */
function LadderPanel({ L, s, waiting, hist }: { L: LadderRead | null; s: LadderStep | null; waiting: boolean; hist?: ModeStat | null }) {
  if (!L || !s) {
    return (
      <div className={`${SURFACE} px-3 py-3 text-[12px] text-slate-500`}>
        <span className="font-semibold text-slate-300">Karar Merdiveni · ayrıntı</span> — {waiting ? "09:35 ET ilk 5m kapanışıyla başlar." : "mum verisi bekleniyor."}
      </div>
    );
  }
  return <LadderPanelBody L={L} s={s} hist={hist ?? null} />;
}

function LadderPanelBody({ L, s, hist }: { L: LadderRead; s: LadderStep; hist: ModeStat | null }) {
  const [open, setOpen] = useState(false);
  const rg = s.regime;
  const permCol = rg.permission === "CALL" ? "#22c55e" : rg.permission === "PUT" ? "#ef4444" : "#94a3b8";
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">Karar Merdiveni · karar desteği</span>
        <span className="font-mono text-[11px] text-slate-500">son 5m kapanış {s.clock} ET</span>
      </div>
      <LadderSummary L={L} s={s} hist={hist} />
      <div className="flex flex-wrap items-center gap-2 border-t border-[#1c2635] px-3 py-1.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30">{open ? "▴ gizle" : "▾ göster"}</button>
        <span className="text-[12px] font-semibold text-slate-300">Teknik ayrıntı <span className="font-normal text-slate-500">· 4 adımın koşulları, risk kuralları, gün içi geçmiş, kalibrasyon</span></span>
      </div>
      {open && (<>
      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-2 bg-[#0f141d] px-3 py-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Adım 1 · yön izni = seans planı</div>
            <div className="text-[18px] font-extrabold" style={{ color: permCol }}>{rg.permission === "NÖTR" ? "NÖTR" : `${rg.permission} izni`}</div>
            <div className="text-[11px] font-semibold text-slate-300">{rg.mode}</div>
            <div className="text-[11px] leading-snug text-slate-400">{rg.modeText}</div>
            <div className="mt-1 font-mono text-[11px] text-slate-400">
              Üst TF teyidi{s.confirm ? ` ${s.confirm.n}/3` : ""}:{" "}
              {s.confirm ? (
                <>
                  <span className={s.confirm.m15 ? "text-sky-300" : "text-slate-600"}>15m {s.confirm.m15 ? "✓" : "✗"}</span>{" · "}
                  <span className={s.confirm.m30 ? "text-sky-300" : "text-slate-600"}>30m {s.confirm.m30 ? "✓" : "✗"}</span>{" · "}
                  <span className={s.confirm.h1 ? "text-sky-300" : "text-slate-600"}>1h {s.confirm.h1 ? "✓" : "✗"}</span>
                </>
              ) : "yön yok"}
            </div>
            <div className="text-[10.5px] leading-snug text-slate-500">15m VWAP+EMA20 · 30m/1h EMA20 aynı tarafta. Tetik 5m&apos;den gelir; teyit yalnızca bilgidir, giriş engellemez (filtre yapınca günlük işlem 2,2→1,8&apos;e düşüp erken girişler kaçıyor).</div>
            <div className="mt-1 font-mono text-[11px] text-slate-400">
              RSI(14): 15m {s.rsi?.v15 != null ? s.rsi.v15.toFixed(1) : "—"} {s.rsi ? (s.rsi.d15 > 0 ? "↑" : s.rsi.d15 < 0 ? "↓" : "→") : ""} · 30m {s.rsi?.v30 != null ? s.rsi.v30.toFixed(1) : "—"} {s.rsi ? (s.rsi.d30 > 0 ? "↑" : s.rsi.d30 < 0 ? "↓" : "→") : ""}
            </div>
            <div className="text-[10.5px] leading-snug text-slate-500">Açılış yönü tetiği 15m RSI yönünü ister (50 üstü + yükselen = yukarı). Ölçüm: RSI ters/kararsızken açılan açılış işlemleri %27 kazanç, −2,4R; şartla açılış modu +28,4R → +37,8R. 30m bilgi amaçlı.</div>
          </div>
          <CondList title="Seans planı (hangisi aktif)" conds={rg.conds} empty="—" />
          <div className="text-[10.5px] leading-snug text-slate-500">
            Açılış yönü 10:00–14:00 (açılış aralığı {rg.opening?.orLow != null && rg.opening?.orHigh != null ? `${num(rg.opening.orLow)}–${num(rg.opening.orHigh)}` : ""} karşı ucu kırılınca biter) · öğlen VWAP ± {LADDER_CFG.plan.fadeK} ATR ({rg.fadeDn != null && rg.fadeUp != null ? `${num(rg.fadeDn)} / ${num(rg.fadeUp)}` : "—"}) dışında VWAP&apos;a dönüş{LADDER_CFG.plan.closeOn ? " · 14:00 sonrası VWAP+POC tarafı" : " · 14:00 sonrası yeni yön işlemi yok (kapanış modu ölçümde kenarsızdı, kapalı)"}.
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-[#0f141d] px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Adım 2 · 5m erken uyarı</div>
          <CondList title="Hareket hazırlanıyor mu? (girme, emri hazırla)" conds={s.warnSigns} empty={rg.permission === "NÖTR" ? "Yön izni yok — açılış ya da öğlen uzaması bekleniyor." : s.status === "TETİK" ? "Pozisyon açık." : "—"} />
          <div>
            <div className="mb-0.5 text-[11px] font-semibold text-orange-300">Ters yön uyarısı</div>
            {s.reverse.length ? <ul className="flex flex-col gap-0.5 text-[11.5px] text-orange-200">{s.reverse.map((r, i) => <li key={i}>• {r}</li>)}</ul>
              : <div className="text-[11.5px] text-slate-500">yok (hacimli ters VWAP kesişimi · likidite süpürmesi · tükenme izleniyor)</div>}
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-[#0f141d] px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Adım 3 · 5m tetik</div>
          <CondList title="5m tetik: 3 şart ya da 2 mum formasyonu (kapanmış mum)" conds={s.trigConds} empty={rg.permission === "NÖTR" ? "Yön izni yokken tetik aranmaz." : "Pozisyon açık."} />
          <div className="text-[10.5px] leading-snug text-slate-500">
            Giriş tetik mumunun kapanışında. Ölçüm: tetiklerin ~%70&apos;inden önceki 4 mumda erken uyarı yanmıştı.
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-[#0f141d] px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Adım 4 · risk</div>
          <ul className="flex flex-col gap-0.5 text-[11.5px] leading-snug text-slate-300">
            <li>• Stop: son 3 mumun {"dibi/tepesi"} ∓ {LADDER_CFG.risk.stopPadAtr} ATR (açılış bacağında 10:00–11:00: yalnızca tetik mumunun ucu, ≤ {LADDER_CFG.risk.openLeg.maxStopAtr} ATR); trend modlarında bu &gt; {LADDER_CFG.risk.maxStopAtr} ATR ise VWAP/EMA20 çizgisinin ötesi; o da genişse işlem yok</li>
            <li>• Hedef: {LADDER_CFG.risk.rr}R · öğlen dönüşünde VWAP (en az {LADDER_CFG.risk.fadeMinR}R)</li>
            <li>• Günde en fazla {LADDER_CFG.risk.maxAttempts} deneme · çıkıştan sonra {LADDER_CFG.risk.cooldownBars} mum bekle</li>
            <li>• 10:00 öncesi ve 15:30 sonrası yeni giriş yok · 15:50&apos;de kalan pozisyon kapanır</li>
            <li className="text-amber-300/90">• FOMC/CPI saatleri uygulanmıyor (takvim verisi yok) — o günlerde kendin kontrol et</li>
          </ul>
          <div>
            <div className="mb-0.5 text-[11px] font-semibold text-slate-400">Bugünkü denemeler</div>
            {L.attempts.length === 0 ? <div className="text-[11.5px] text-slate-500">yok</div> : (
              <ul className="flex flex-col gap-0.5 font-mono text-[11.5px]">
                {L.attempts.map((a, i) => (
                  <li key={i} className="text-slate-300">
                    {i + 1}. {a.side} {a.clock} · {a.mode} · {num(a.entry)} · stop {num(a.stop)} · hedef {num(a.target)} → {a.result ? `${a.exitClock} ${a.result}${a.r != null ? ` ${a.r >= 0 ? "+" : ""}${a.r}R` : ""}` : "açık"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#1c2635] px-3 py-1.5 font-mono text-[11px] text-slate-400">
        <span>son 5m RVOL <b className="text-slate-200">{s.rvol != null ? s.rvol.toFixed(2) : "—"}</b> <span className="font-sans text-slate-500">({rvolText(s.rvol)})</span></span>
        <span>yerel hacim <b className="text-slate-200">{s.localRatio != null ? `${s.localRatio.toFixed(2)}×` : "—"}</b></span>
        <span>gün RVOL <b className="text-slate-200">{s.dayRvol != null ? s.dayRvol.toFixed(2) : "—"}</b></span>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-[#1c2635] px-3 py-1.5">
        <span className="mr-1 text-[10.5px] text-slate-500">gün içi durum (eski → yeni)</span>
        {L.steps.filter((x, i, arr) => i === 0 || x.status !== arr[i - 1].status || x.side !== arr[i - 1].side).map((x) => {
          const c = ladderCol(x);
          return <span key={x.time} title={x.message} className="rounded px-1 py-0.5 font-mono text-[10px] font-semibold" style={{ color: c, backgroundColor: `${c}1f` }}>{x.clock} {x.status}{x.side && x.status !== "İŞLEM YOK" ? ` ${x.side}` : ""}</span>;
        })}
      </div>
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
        Kalibrasyon (SPY 5m, 59 seans 21 Tem–9 Eki, spot fiyat, opsiyon spread&apos;i hariç): 86 işlem (1,5/gün) · %59 kazanç · toplam +66,4R · üç dönem ayrı ayrı +20,7R / +22,5R / +23,3R.
        13 Eki (gün içi): ERKEN UYARI 2 mum kilitlendi (durum titremesi günde 15 → 12; işlemler aynı), öğlen dönüşünde 15m RSI uzama yönündeyse &quot;teyit zayıf&quot; notu. 58 seans: 84 işlem %60 +67,2R.
        13 Eki denetimi: kapanış yönü modu kapatıldı (46 işlem, %39, işlem başı +0,11R — öğleden sonra gürültüsü). Trend sonu çıkışı, ORB, kesişimde trend başı girişi, gap teyidi ölçüldü; hiçbiri mevcut sistemi geçmedi (ayrıntı: lib/spyengine/ladder.ts).
        12 Eki güncellemesi: açılış tetiği 15m RSI yönünü ister (açılış modu 47 işlem +28,4R → 34 işlem +37,8R), 09:55 GÜÇLÜ kararda 10:00 beklenmez; gürültülü erken uyarılar (09:35–09:50 ön okuma, izinsiz öğlen hazırlığı) kaldırıldı — uyarılar 412 → 268, tetiğe dönüş %20 → %25.
        Mod bazında: açılış yönü +37,8R (34) · öğlen dönüş +24,7R (50) · tepe/dip reddi +4,0R (2 — nadir).
        Ardışık 2 hacimli 5m mumu TEK BAŞINA kovalamak ölçümde yazı-tura çıktı (yön isabeti %50–56, görülmemiş dönemde ≈ 0R); bu yüzden yön izninin içinde tetik olarak kullanılıyor. Hacimli kırılımı kovalamak −5,4R verdi.
        Geçmiş sonuç geleceği garanti etmez. Eşikler: lib/spyengine/ladder.ts · LADDER_CFG. Diğer kartlar yalnızca gerekçe gösterir, karar vermez.
      </div>
      </>)}
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

function FlowTile({ title, ask, headline, tone: tcol, children, note }: { title: string; ask: string; headline: ReactNode; tone?: string; children?: ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-[#0f141d] px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
        <div className="text-[10px] text-slate-600">{ask}</div>
      </div>
      <div className="text-[14px] font-extrabold leading-snug" style={{ color: tcol ?? "#e2e8f0" }}>{headline}</div>
      {children}
      {note && <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{note}</div>}
    </div>
  );
}

function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#151c28] py-[3px] text-[11.5px] last:border-0">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className="min-w-0 text-right font-mono text-slate-200">{children}</span>
    </div>
  );
}

const SHOW_BTN = "rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30";

function FlowPanel({ f, price, opt, step }: { f: FlowRead | null; price: number | null; opt: OptionLevels | null; step: LadderStep | null }) {
  const [open, setOpen] = useState(false);
  const [optOpen, setOptOpen] = useState(false);
  const [tracesOpen, setTracesOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const lc = step ? ladderCol(step) : "#64748b";
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className={SHOW_BTN}>{open ? "▴ gizle" : "▾ göster"}</button>
        <span className="text-[13px] font-semibold text-slate-200">Likidite · Akıllı Para · Hacim Profili</span>
        <span className="hidden text-[11px] text-slate-500 sm:inline">· gerekçe, karar vermez</span>
      </div>
      {step && (
        <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: lc, borderColor: `${lc}66`, backgroundColor: `${lc}14` }}>
          karar satırı: {step.status}{step.side && step.status !== "İŞLEM YOK" ? ` · ${step.side}` : ""}
        </span>
      )}
    </div>
  );
  if (!f) {
    return (
      <div className={`${SURFACE} overflow-hidden`}>
        {head}
        {open && <div className="border-t border-[#1c2635] px-3 py-3 text-[12px] text-slate-500">Güncel veri yok; ilk 5m kapanışla başlar.</div>}
      </div>
    );
  }
  const w = f.warning;
  const px = price ?? 0;
  const prof = f.profile;
  const above = f.pools.filter((pl) => !pl.swept && pl.price > px).sort((a, b) => a.price - b.price).slice(0, 3);
  const below = f.pools.filter((pl) => !pl.swept && pl.price < px).sort((a, b) => b.price - a.price).slice(0, 3);
  const fmtD = (v: number) => `${v >= 0 ? "+" : "−"}${fmtVol(Math.abs(v))}`;
  const UPC2 = "#4ade80", DNC2 = "#f87171", NEU2 = "#94a3b8";

  // — okumalar (sonuç cümleleri) —
  const vaPos = !prof ? 0 : px > prof.vah ? 1 : px < prof.val ? -1 : 0;
  const vaHead = !prof ? "veri yok" : vaPos > 0 ? "Fiyat değer alanının ÜSTÜNDE" : vaPos < 0 ? "Fiyat değer alanının ALTINDA" : "Fiyat değer alanının İÇİNDE";
  const vaMean = !prof ? "" : vaPos > 0 ? "Yukarıda kabul görüyor — geri çekilmede alıcılar savunur." : vaPos < 0 ? "Aşağıda kabul görüyor — tepkiler satıcılara çarpar." : "Denge bölgesi — fiyat çoğunlukla POC'a doğru geri döner.";
  const dpct = f.deltaPct30;
  const dSide = dpct == null || Math.abs(dpct) < 0.12 ? 0 : dpct > 0 ? 1 : -1;
  const dHead = dSide > 0 ? "Son 30 dk: ALICILAR önde" : dSide < 0 ? "Son 30 dk: SATICILAR önde" : "Son 30 dk: alıcı ≈ satıcı";
  const dDay = f.cumDelta >= 0 ? "gün boyu alıcı ağırlıklı" : "gün boyu satıcı ağırlıklı";
  const compHead = f.compression.active ? "SIKIŞMA — kırılım yaklaşıyor" : f.accel.text ? f.accel.text : "Normal hareket";
  const compTone = f.compression.active ? "#fbbf24" : f.accel.text ? (f.accel.dir > 0 ? UPC2 : DNC2) : NEU2;
  const nearUp = above[0], nearDn = below[0];
  const poolHead = !nearUp && !nearDn ? "Yakında süpürülmemiş havuz yok"
    : nearUp && nearDn ? (nearUp.price - px <= px - nearDn.price ? `Önce ▲ ${num(nearUp.price)} yakın (+${num(nearUp.price - px)})` : `Önce ▼ ${num(nearDn.price)} yakın (−${num(px - nearDn.price)})`)
    : nearUp ? `▲ ${num(nearUp.price)} yakın (+${num(nearUp.price - px)})` : `▼ ${num(nearDn!.price)} yakın (−${num(px - nearDn!.price)})`;

  // — tek satır özet —
  const votes = [vaPos, dSide];
  const total = votes.reduce((a, v) => a + v, 0);
  const sumTxt = total > 0 ? "alıcı tarafı ağır basıyor" : total < 0 ? "satıcı tarafı ağır basıyor" : "denge — net bir taraf yok";
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      {head}
      {!open ? (
        <div className="border-t border-[#1c2635] px-3 py-1.5 text-[11.5px] text-slate-400">
          Kısa okuma: <b className={total > 0 ? "text-[#4ade80]" : total < 0 ? "text-[#f87171]" : "text-slate-300"}>{sumTxt}</b> · POC {prof ? num(prof.poc) : "—"} · {dHead.replace("Son 30 dk: ", "30 dk ")}
        </div>
      ) : (
        <>
          {/* ölçüm kutucukları */}
          <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] sm:grid-cols-2 xl:grid-cols-4">
            <FlowTile title="Hacim profili" ask="fiyat nerede kabul görüyor?" headline={vaHead} tone={vaPos > 0 ? UPC2 : vaPos < 0 ? DNC2 : NEU2} note={vaMean}>
              {prof && (
                <div>
                  <KV k="POC (en çok işlem)">{num(prof.poc)}</KV>
                  <KV k="Değer alanı">{num(prof.val)} – {num(prof.vah)}</KV>
                  <KV k="POC 1 saatte"><span className={prof.pocShift > 0 ? "text-[#4ade80]" : prof.pocShift < 0 ? "text-[#f87171]" : "text-slate-300"}>{signed(prof.pocShift)} {prof.pocShift > 0 ? "yukarı kayıyor" : prof.pocShift < 0 ? "aşağı kayıyor" : "sabit"}</span></KV>
                </div>
              )}
            </FlowTile>
            <FlowTile title="Alıcı / satıcı baskısı" ask="kim daha agresif?" headline={dHead} tone={dSide > 0 ? UPC2 : dSide < 0 ? DNC2 : NEU2} note="Kapanış konumundan tahmin (gerçek işlem tarafı değil). Fiyat yeni dip yaparken delta yükseliyorsa gizli alım vardır.">
              <div>
                <KV k="Seans toplamı"><span className={f.cumDelta >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{fmtD(f.cumDelta)}</span> · {dDay}</KV>
                <KV k="Son 30 dk"><span className={f.delta30 >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{fmtD(f.delta30)}</span>{dpct != null ? ` · %${Math.round(Math.abs(dpct) * 100)} ${dSide === 0 ? "dengede" : dSide > 0 ? "alıcı" : "satıcı"}` : ""}</KV>
              </div>
            </FlowTile>
            <FlowTile title="Sıkışma · ivme" ask="kırılım yaklaşıyor mu?" headline={compHead} tone={compTone}>
              <div>
                <KV k="Mum boyu">{f.compression.ratio != null ? `ortalamanın ${f.compression.ratio.toFixed(2)}×` : "—"}</KV>
                {f.compression.boxHigh != null && f.compression.boxLow != null && <KV k="Kutu">{num(f.compression.boxLow)} – {num(f.compression.boxHigh)}</KV>}
              </div>
            </FlowTile>
            <FlowTile title="Stop kümeleri" ask="fiyat nereye çekilir?" headline={poolHead} tone={NEU2} note="Fiyat bu seviyelere çekilir (stoplar orada). Fitille geçip geri dönerse = süpürme → dönüş sinyali.">
              <div className="flex flex-col gap-0.5 font-mono text-[11.5px]">
                {above.map((pl) => <div key={`a${pl.price}`} className="flex justify-between gap-2"><span className="text-[#4ade80]">▲ {num(pl.price)}</span><span className="truncate text-slate-400">{pl.label}</span><span className="text-slate-500">+{num(pl.price - px)}</span></div>)}
                {below.map((pl) => <div key={`b${pl.price}`} className="flex justify-between gap-2"><span className="text-[#f87171]">▼ {num(pl.price)}</span><span className="truncate text-slate-400">{pl.label}</span><span className="text-slate-500">−{num(px - pl.price)}</span></div>)}
              </div>
            </FlowTile>
          </div>

          {/* alıcı / satıcı izleri */}
          <div className="border-t border-[#1c2635] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setTracesOpen((v) => !v)} className={SHOW_BTN}>{tracesOpen ? "▴ gizle" : "▾ göster"}</button>
              <span className="text-[12px] font-semibold text-slate-200">Alıcı / satıcı izleri <span className="font-normal text-slate-500">· kanıt</span></span>
            </div>
          </div>
          {tracesOpen && (
            <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2">
              {([["Alıcı izleri", w.bullWhy, UPC2], ["Satıcı izleri", w.bearWhy, DNC2]] as const).map(([t, list, c]) => (
                <div key={t} className="bg-[#0f141d] px-3 py-2">
                  <div className="mb-1 text-[12px] font-semibold" style={{ color: c }}>{t}</div>
                  {list.length === 0 ? <div className="text-[12px] text-slate-500">belirgin iz yok</div> : (
                    <ul className="flex flex-col gap-1 text-[12px] leading-snug text-slate-200">
                      {list.map((x, k) => <li key={k} className="flex gap-1.5"><span style={{ color: c }}>•</span><span>{x}</span></li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* opsiyon seviyeleri */}
          <div className="border-t border-[#1c2635] px-3 py-2">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setOptOpen((v) => !v)} className={SHOW_BTN}>{optOpen ? "▴ gizle" : "▾ göster"}</button>
              <span className="text-[12px] font-semibold text-slate-200">Opsiyon seviyeleri</span>
              <span className="text-[11px] text-slate-500">{opt ? (opt.isZeroDte ? "0DTE" : `vade ${opt.expiry} (0DTE yok)`) : "opsiyon zinciri alınamadı"} · yalnız seviye, yön vermez</span>
            </div>
            {optOpen && opt && (
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11.5px]">
                {opt.callWalls.map((cw, k) => (
                  <span key={`c${cw.strike}`} className="rounded border border-[#ef4444]/30 bg-[#ef4444]/10 px-1.5 py-0.5 text-[#f87171]" title="Dünkü açık pozisyon (OI) — fiyat yukarıdan bu seviyeye çarpma eğilimi">
                    call{k ? " 2" : ""} <b>{num(cw.strike)}</b> <span className="text-slate-500">{Math.round(cw.openInterest / 1000)}K · {num(cw.strike - (price ?? opt.spot))}</span>
                  </span>
                ))}
                {opt.putWalls.map((pw, k) => (
                  <span key={`p${pw.strike}`} className="rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-1.5 py-0.5 text-[#4ade80]" title="Dünkü açık pozisyon (OI) — fiyat aşağıdan bu seviyeye çarpma eğilimi">
                    put{k ? " 2" : ""} <b>{num(pw.strike)}</b> <span className="text-slate-500">{Math.round(pw.openInterest / 1000)}K · {num(pw.strike - (price ?? opt.spot))}</span>
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
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setEventsOpen((v) => !v)} className={SHOW_BTN}>{eventsOpen ? "▴ gizle" : "▾ göster"}</button>
                <span className="text-[12px] font-semibold text-slate-200">Akıllı para olayları <span className="font-normal text-slate-500">· en yeni üstte · {f.events.length} olay</span></span>
              </div>
              {eventsOpen && <div className="flex max-h-[170px] flex-col overflow-y-auto">
                {f.events.slice().reverse().slice(0, 12).map((e) => (
                  <div key={`${e.kind}${e.time}${e.price}`} className="grid grid-cols-[44px_118px_minmax(0,1fr)] items-baseline gap-2 border-b border-[#151c28] py-1 text-[12px] last:border-0">
                    <span className="font-mono text-slate-400">{e.clock}</span>
                    <span className={`rounded px-1.5 py-[1px] text-center font-mono text-[10.5px] font-semibold ${e.bias > 0 ? "bg-[#22c55e]/15 text-[#4ade80]" : "bg-[#ef4444]/15 text-[#f87171]"}`}>{EVENT_TAG[e.kind]}</span>
                    <span className="leading-snug text-slate-300">{e.text}</span>
                  </div>
                ))}
              </div>}
            </div>
          )}
          <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
            Alıcı/satıcı hacmi ve &quot;akıllı para&quot; etiketleri fiyat–hacim davranışından çıkarımdır, emir defteri verisi değildir. Bu olaylar karar vermez; ters yön uyarısı yalnızca karar satırından gelir.
          </div>
        </>
      )}
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

const UPC = "#22c55e", DNC = "#ef4444";
const NEUTRAL = "#64748b";

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
  // bilgi kartı: yön rengi yok (yön kararı yalnızca karar satırında)
  const hcol = NEUTRAL;
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
            <div className="text-[11px] text-slate-500">Son 30 dk hareketi · bilgi, karar vermez</div>
            <div className="text-[17px] font-extrabold leading-tight" style={{ color: hcol }}>
              {p.heading === "UP" ? "▲" : p.heading === "DOWN" ? "▼" : "◆"} {p.target ? `sıradaki pivot ${p.target.key} ${num(p.target.price)}` : p.heading === "FLAT" ? `${p.zone} arasında yatay` : "pivot dışı"}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[12px] text-slate-300">
              <span>30 dk hız {p.speed30 >= 0 ? "+" : ""}{p.speed30.toFixed(2)}</span>
              {p.target && price != null && <span>kalan {Math.abs(p.target.price - price).toFixed(2)} puan</span>}
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
          <div className="text-[10.5px] leading-snug text-slate-500">TEST · TUTTU = değdi, aynı tarafta kaldı (tepki seviyesi) · KIRILDI = açılıştaki tarafından öbür tarafa geçti.</div>
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
  const [showStops, setShowStops] = useState(false);
  const [alertSound, setAlertSound] = useState(true);
  const [replayDate, setReplayDate] = useState("");
  /** SL tamponu çarpanı (ATR15 x): 0,25 normal · 0,40 yüksek oynaklık · 0,50 veri/FOMC günü */
  const [stopMult, setStopMult] = useState(0.25);

  const [data, setData] = useState<StreamResponse | null>(null);
  const [m1, setM1] = useState<Bar[]>([]);
  const [m5, setM5] = useState<Bar[]>([]);
  const [m15, setM15] = useState<Bar[]>([]);
  /** Emir defteri (Level 1) + opsiyon Call/Put akışı — birkaç saniyede bir; defter örnekleri 5 dk ortalama için tutulur */
  const [book, setBook] = useState<QuoteBook | null>(null);
  const [optFlow, setOptFlow] = useState<OptionFlow | null>(null);
  const [bookSamples, setBookSamples] = useState<BookSample[]>([]);
  /** 1h geçmişi (~6 ay, RTH) — 15m setup tahmininin 1h/4h teyidi için; 5 dk'da bir yenilenir */
  const [h1Hist, setH1Hist] = useState<Bar[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/htf?symbol=SPY", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setH1Hist(fromCompact(json.h1));
      } catch {
        // üst zaman geçmişi gelmezse 1m'den türetilen saatlikle devam edilir
      }
    };
    void load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const [quotes, setQuotes] = useState<StripQuote[]>([]);
  const [quotesAt, setQuotesAt] = useState<number | null>(null);
  /** Açılış tahmini (04:00 → 09:30): ES fair value, 60 sn'de bir */
  const [openFc, setOpenFc] = useState<OpenForecastRead | null>(null);
  /** Tahmin günlüğü + öğrenilen aşama isabetleri (30 dk'da bir) */
  const [journal, setJournal] = useState<JournalResp | null>(null);
  /** Karar günlüğü + öğrenen model (arşivlenmiş seans kararları ve sonuçları; 10 dk'da bir) */
  const [decisions, setDecisions] = useState<DecisionResp | null>(null);
  const [showDecisions, setShowDecisions] = useState(false);
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

  // Karar günlüğü: açılışta bir kez + 10 dk'da bir (sunucu biten seansları arşivler, modeli yeniden öğrenir)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/decisions", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setDecisions(json as DecisionResp);
      } catch {
        // günlük ana akışı etkilemesin
      }
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

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

  // Emir defteri + opsiyon akışı: canlıda 3 sn'de bir (oynatmada anlamsız — kapalı)
  useEffect(() => {
    if (replayDate) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/orderflow?symbol=SPY", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (cancelled || !json.ok) return;
        if (json.options) setOptFlow(json.options as OptionFlow);
        const b = json.book as QuoteBook | null;
        if (b) {
          setBook(b);
          if (b.bidSize != null && b.askSize != null && b.bid != null && b.ask != null && b.marketState === "REGULAR") {
            const smp: BookSample = { t: b.fetchedAt, bidSize: b.bidSize, askSize: b.askSize, spread: b.ask - b.bid };
            setBookSamples((prev) => (prev.length && prev[prev.length - 1].t === smp.t ? prev : [...prev.filter((x) => x.t >= smp.t - 600), smp]));
          }
        }
      } catch {
        // defter/opsiyon akışı gelmezse kartlar "alınamadı" der, ana akış etkilenmez
      }
    };
    void load();
    const id = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [replayDate]);

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

  const analysis = useMemo(() => {
    if (!date || !evalNow) return null;
    const s5 = daySeries(m5D, "5m", date, evalNow, lastM1Time);
    const s15 = daySeries(m15D, "15m", date, evalNow, lastM1Time);
    const s30 = daySeries(m30D, "30m", date, evalNow, lastM1Time);
    const opening = openingRegime(s5, s15, ema5, s30, journal?.learned.stageStats ?? null, data?.levels?.prevClose ?? null);
    return { s5, s15, s30, opening };
    // her yeni kapanışta (lastClosed) yeniden hesaplanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m5D, m15D, m30D, ema5, ema15, date, lastM1Time, minuteSlot, journal?.learned.stageStats, data?.levels?.prevClose]);

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

  /** Ölçülmüş ek seviyeler (POC/VA, likidite, Fibonacci, opsiyon duvarları, ADR) — harita ortak kaynağı */
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
  // ── 15m setup + 4 mum tahmini (1h/4h teyidi) ──────────────────
  /** Kapanmış RTH 15m mumları (çok günlük, 1m akıştan) */
  const m15Closed = useMemo(
    () => (evalNow ? m15D.filter((b) => isRthBar(b) && b.time + 900 <= evalNow && (lastM1Time == null || lastM1Time >= b.time + 900)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m15D, lastM1Time, minuteSlot],
  );
  const setupKey = m15Closed.length ? m15Closed[m15Closed.length - 1].time : 0;
  /** Oluşmakta olan 15m mum (1. tahmin yuvasında gerçekleşen olarak gösterilir) */
  const m15Forming = useMemo(() => {
    const b = m15D.length ? m15D[m15D.length - 1] : null;
    return b && isRthBar(b) && b.time > setupKey && nyParts(b.time).ymd === date ? b : null;
  }, [m15D, setupKey, date]);
  const setup15 = useMemo(() => {
    if (!setupKey) return { read: null, stats: null };
    const h1 = mergeHourly(h1Hist, m1, setupKey + 900);
    const pivCache = new Map<string, ReturnType<typeof prevDayPivots>>();
    const pivotsFor = (ymd: string) => {
      if (!pivCache.has(ymd)) pivCache.set(ymd, ymd === date ? pivBase : prevDayPivots(m1, ymd, null));
      return pivCache.get(ymd) ?? null;
    };
    // gün içi VWAP (kapanmış 15m mumlardan)
    const vw = new Map<number, number>();
    let day = "", pv = 0, vol = 0;
    for (const b of m15Closed) {
      const ymd = nyParts(b.time).ymd;
      if (ymd !== day) { day = ymd; pv = 0; vol = 0; }
      pv += ((b.high + b.low + b.close) / 3) * (b.volume || 0);
      vol += b.volume || 0;
      if (vol > 0) vw.set(b.time, pv / vol);
    }
    const vwapAt = (t: number) => vw.get(t) ?? null;
    const last = m15Closed[m15Closed.length - 1];
    const read = readSetup15({ m15: m15Closed, h1, pivots: pivotsFor(nyParts(last.time).ymd), vwap: vwapAt(last.time) });
    const stats = backtestSetup15(m15Closed, h1, pivotsFor, vwapAt, 120);
    return { read, stats };
    // yalnız yeni 15m kapanışında (ve 1h geçmişi gelince) yeniden hesaplanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupKey, h1Hist, pivBase]);

  const pivR = useMemo<PivotRead | null>(() => {
    if (!pivBase || price == null) return null;
    return pivotRead(pivBase, analysis?.s5 ?? { bars: [], vwap: [] }, price);
  }, [pivBase, analysis?.s5, price]);
  const ema5Now = useMemo(() => {
    const bs = analysis?.s5.bars;
    return bs && bs.length ? ema5.get(bs[bs.length - 1].time) ?? null : null;
  }, [analysis?.s5, ema5]);

  // ── KARAR MERDİVENİ: sayfanın tek karar kaynağı ─────────────────
  /** ATR14 — mum zamanı → değer (çok günlük, ısınmış). Kapanmış mumun ATR'si yalnızca geçmiş mumlara bağlıdır. */
  const atrMapOf = (bs: Bar[]) => {
    const a = atr(bs, 14);
    const m = new Map<number, number>();
    bs.forEach((b, i) => { if (a[i] != null) m.set(b.time, a[i] as number); });
    return m;
  };
  const atr5Map = useMemo(() => atrMapOf(m5D), [m5D]);
  const atr15Map = useMemo(() => atrMapOf(m15D), [m15D]);
  /** Gün içinde değişmeyen seviyeler: önceki seans pivotları, dünkü tepe/dip, premarket */
  const staticLevels = useMemo(() => {
    const out: { price: number; label: string }[] = [];
    if (pivBase) {
      for (const k of PIVOT_ORDER) out.push({ price: pivBase.levels[k], label: `pivot ${k}` });
      out.push({ price: pivBase.H, label: "dünkü tepe" }, { price: pivBase.L, label: "dünkü dip" });
    }
    const pmH = lvl?.premarket.high ?? null, pmL = lvl?.premarket.low ?? null;
    if (pmH != null) out.push({ price: pmH, label: "premarket tepesi" });
    if (pmL != null) out.push({ price: pmL, label: "premarket dibi" });
    return out;
  }, [pivBase, lvl]);
  const rvolBase = data?.rvolBase ?? null;
  /** Üst zaman dilimi teyidi için 30m / 1h mumlar + EMA20 (yalnızca doğrulama; tetik 5m'den gelir) */
  const m60D = useMemo(() => bucketAggregate(m1, 60), [m1]);
  const htf = useMemo(() => ({ m30: m30D, e30: emaByTime(m30D), m60: m60D, e60: emaByTime(m60D) }), [m30D, m60D]);
  /** 15m / 30m RSI(14) — RTH, çok günlük (açılış tetiği 15m RSI yönünü ister; 30m bilgi) */
  const rsiInput = useMemo(() => ({ r15: rsiSeries(m15D), r30: rsiSeries(m30D) }), [m15D, m30D]);
  /** Öğrenen model: kanıt güçlü eksi olan mod otomatik kapanır (başka hiçbir ayar kendiliğinden değişmez) */
  const cfgEff = useMemo(() => applyTrust(LADDER_CFG, decisions?.model ?? null), [decisions?.model]);
  const ladderInput = useMemo(() => {
    if (!analysis || !date) return null;
    return { date, s5: analysis.s5, s15: analysis.s15, s30: analysis.s30, ema5, ema15, atr5: atr5Map, atr15: atr15Map, rvol: rvolBase, prevClose: data?.levels?.prevClose ?? null, htf, staticLevels, rsi: rsiInput, cfg: cfgEff };
  }, [analysis, date, ema5, ema15, atr5Map, atr15Map, rvolBase, htf, staticLevels, rsiInput, cfgEff, data?.levels?.prevClose]);
  const ladder = useMemo<LadderRead | null>(() => (ladderInput ? ladderRead(ladderInput) : null), [ladderInput]);
  const lad = ladder?.current ?? null;

  // Her canlı kararı (durum / yön / mod değişimi) günün karar günlüğüne işle — gün kapanınca arşiv kaydına birleşir
  const loggedSig = useRef("");
  useEffect(() => {
    if (replayDate || !lad || !date || !data?.session.isLive) return;
    const sig = `${date}|${lad.status}|${lad.side}|${lad.regime.mode}`;
    if (loggedSig.current === sig) return;
    loggedSig.current = sig;
    void fetch("/api/admin/spyengine/v2/decisions", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, events: [{ t: lad.time, clock: lad.clock, status: lad.status, side: lad.side, mode: lad.regime.mode, msg: lad.message, price: price, entry: lad.plan?.entry, stop: lad.plan?.stop, target: lad.plan?.target }] }),
    }).catch(() => { /* kayıt ana akışı etkilemesin */ });
  }, [lad, date, replayDate, data?.session.isLive, price]);

  /** Mum yorumları — aynı sistem (5m: merdiven durumu + kalite + RVOL; 15m: rejim koşulları) */
  const comments = useMemo(() => {
    if (!ladder || !ladderInput) return { c5: [] as CandleComment[], c15: [] as CandleComment[] };
    const c5: CandleComment[] = [], c15: CandleComment[] = [];
    for (let i = ladderInput.s5.bars.length - 1; i >= 0 && c5.length < 40; i--) c5.push(ladderComment5(ladderInput, ladder, i));
    for (let k = ladderInput.s15.bars.length - 1; k >= 0 && c15.length < 40; k--) c15.push(ladderComment15(ladderInput, ladder, k));
    return { c5, c15 };
  }, [ladder, ladderInput]);
  /** Oluşan mumlar (yalnızca canlı modda; karar mumu değil) */
  const formingOf = (all: Bar[], span: number, tf: "5m" | "15m") => {
    if (!analysis || !date || replayDate || !nowSec) return null;
    const cur = all.find((b) => isRthBar(b) && nyParts(b.time).ymd === date && b.time <= nowSec && b.time + span > nowSec);
    if (!cur) return null;
    const a = tf === "5m" ? (atr5 ?? null) : (lastNum(atr(m15D.filter((b) => b.time < cur.time), 14)) ?? null);
    return ladderForming(cur, vwapNow, a, rvolBase, nowSec, tf);
  };
  const forming5 = formingOf(m5D, 300, "5m");
  const forming15 = formingOf(m15D, 900, "15m");

  /** Harita yönü = merdivenin rejim izni (sayfada tek yön kaynağı) */
  const playBias = useMemo<{ bias: "UP" | "DOWN" | "FLAT"; text: string } | null>(() => {
    if (!lad) return null;
    const pm = lad.regime.permission;
    if (pm === "CALL") return { bias: "UP", text: `Karar satırı: CALL izni (${lad.status}) → yükseliş senaryosu.` };
    if (pm === "PUT") return { bias: "DOWN", text: `Karar satırı: PUT izni (${lad.status}) → düşüş senaryosu.` };
    return { bias: "FLAT", text: "Karar satırı: rejim NÖTR — yön yok, aralık senaryosu." };
  }, [lad]);

  const map = useMemo(() => {
    if (!analysis || price == null || !date) return null;
    return buildForecastMap({
      price, vwap: vwapNow, date, nowSec: evalNow,
      opening: analysis.opening, live: null,
      levels: data?.levels ?? null, forecast: data?.forecast ?? null,
      playBias,
      extra: extraLevels,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, price, vwapNow, date, data?.levels, data?.forecast, extraLevels, playBias, minuteSlot]);

  /** Grafik çizgileri: merdivenin planı (giriş/stop/hedef) + rejim yönündeki trend stopu */
  const chartLines = useMemo(() => {
    const pivLines = pivBase && price != null
      ? PIVOT_ORDER.filter((k) => Math.abs(pivBase.levels[k] - price) / price <= 0.012)
        .map((k: PivotKey) => ({ price: pivBase.levels[k], label: `Pivot ${k} ${pivBase.levels[k].toFixed(2)}`, color: PIVOT_COLOR[k] }))
      : [];
    const out = [...(data?.levels?.lines ?? []), ...pivLines];
    const pl = lad?.plan;
    if (pl) {
      out.push({ price: pl.stop, label: `${pl.side} stop ${pl.stop.toFixed(2)}`, color: "#f59e0b" });
      out.push({ price: pl.target, label: `${pl.side} hedef ${pl.target.toFixed(2)}`, color: "#38bdf8" });
    } else if (stops) {
      const pm = lad?.regime.permission ?? "NÖTR";
      if (stops.long && pm !== "PUT") out.push({ price: stops.long.stop, label: `CALL trend stopu ${stops.long.stop.toFixed(2)}`, color: "#64748b" });
      if (stops.short && pm !== "CALL") out.push({ price: stops.short.stop, label: `PUT trend stopu ${stops.short.stop.toFixed(2)}`, color: "#64748b" });
    }
    return out;
  }, [data?.levels?.lines, stops, lad, pivBase, price]);

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

  // Sesli uyarı: yalnızca merdiven durumu değişince — ERKEN UYARI / TERS UYARI (ön uyarı sesi), TETİK (giriş sesi).
  // İlk yüklemede (prev == null) çalmaz.
  useEffect(() => {
    const key = lad ? `${lad.status}:${lad.side ?? ""}:${lad.trendEnd && lad.trendEnd.level !== "İZLE" ? lad.trendEnd.level : ""}:${lad.manage && ["HEDEF", "KÜÇÜLT", "ARTTIR", "KAPANDI"].includes(lad.manage.phase === "POZİSYON" ? lad.manage.action : lad.manage.phase) ? lad.manage.phase + lad.manage.action : ""}` : "-";
    const prev = lastAlertKeyRef.current;
    lastAlertKeyRef.current = key;
    if (prev == null || prev === key || !alertSound || replayDate || !lad) return;
    if (lad.status === "TETİK" && lad.plan && !prev.startsWith("TETİK")) chime("fired");
    else if (lad.status === "ERKEN UYARI" || lad.status === "TERS UYARI") chime("imminent");
    else if (lad.trendEnd && lad.trendEnd.level !== "İZLE") chime("imminent");
    else if (lad.manage && (lad.manage.phase === "HEDEF" || lad.manage.phase === "ARTTIR" || lad.manage.action === "KÜÇÜLT" || lad.manage.phase === "KAPANDI")) chime("fired");
  }, [lad, alertSound, replayDate, chime]);


  // ── Render ──────────────────────────────────────────────────────
  const op = analysis?.opening ?? null;
  /** Grafik yön oku = rejim izni (tek kaynak) */
  const chartDir: "UP" | "DOWN" | null = lad?.regime.permission === "CALL" ? "UP" : lad?.regime.permission === "PUT" ? "DOWN" : null;
  /** Aşama yüzdelerinin dayandığı örnek: günlükten öğrenildiyse gün sayısı, değilse sabit ölçüm */
  const stageN = journal?.learned.stageStats ? `${journal.stats.n} gün` : "sabit ölçüm";
  // ── Sonuç odaklı gerekçe kartları ──
  const atr15Now = m15Closed.length ? atr15Map.get(m15Closed[m15Closed.length - 1].time) ?? null : null;
  const m5Closed = analysis?.s5.bars ?? [];
  const vwapR = vwapRead(m5Closed, price, atr5);
  const ema5Tf = emaTf(m5D.filter((b) => b.time + 300 <= (evalNow || Infinity) && (lastM1Time == null || lastM1Time >= b.time + 300)), ema5, price, atr5);
  const ema15Tf = emaTf(m15Closed, ema15, price, atr15Now);
  const emaV = emaVerdict(ema5Tf, ema15Tf);
  const today1 = date ? m1.filter((b) => isRthBar(b) && nyParts(b.time).ymd === date) : [];
  const pressR = pressureRead(today1, evalNow);
  const bookR = replayDate ? null : bookRead(book, bookSamples, evalNow);
  const optR = replayDate ? null : optionFlowRead(optFlow);
  const bias = dayBias([
    { label: "VWAP", side: vwapR?.side },
    { label: "EMA20", side: ema5Tf && ema15Tf ? (emaV.side !== 0 ? emaV.side : ema5Tf.side === ema15Tf.side ? ema5Tf.side : 0) : null },
    { label: "Alıcı/satıcı", side: pressR?.side },
    { label: "Emir defteri", side: bookR && bookR.imbAvg != null ? bookR.side : null },
    { label: "Opsiyon C/P", side: optR?.side },
  ]);

  return (
    <div className="min-h-screen bg-[#0a0e17] p-2 text-slate-300">
      {/* ── Başlık ── */}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight text-[#eab308]">SPY Engine · Karar Merdiveni
              <Link href="/admin/qqqengine/v1" className="rounded-md border border-sky-500/60 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/30">→ QQQ Engine</Link>
            </h1>
            <p className="hidden text-[10.5px] text-slate-500 sm:block">
              Tek durum: İŞLEM YOK · İZLE · ERKEN UYARI · TETİK · TERS UYARI · İPTAL — seans planı (açılış yönü · öğlen VWAP&apos;a dönüş · kapanış VWAP+POC) → 5m erken uyarı → 5m tetik → risk · diğer kartlar yalnızca gerekçe
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
            title="Karar satırı ERKEN UYARI / TERS UYARI (ön uyarı sesi) ya da TETİK (giriş sesi) olduğunda sesli + titreşimli uyarı"
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
        {/* ── KARAR SATIRI — ekrandaki tek durum ── */}
        <LadderBar s={lad} waiting={!analysis || !analysis.s5.bars.length} />

        {/* Tickerlar — varsayılan gizli */}
        {showTickers && (
          <div className="flex flex-col gap-1 rounded border border-[#1c2635] p-1">
            <TickerStrip quotes={quotes} updatedAt={quotesAt} />
            <InfoCards spot={data?.spot ?? null} lastFetch={lastFetch} phase={data?.session.phase ?? "CLOSED"} />
          </div>
        )}

        {/* ── 0) Açılış tahmini — seans öncesi büyük, açılıştan sonra tek satır sonuç ── */}
        {!replayDate && <Hideable title="Açılış Tahmini" open={showOpenFc} onToggle={() => setShowOpenFc((v) => !v)}><OpenForecastPanel r={openFc} compact={sessionActive && !!openFc?.actual} /></Hideable>}

        {/* Seans kartları HER ZAMAN görünür; veri yokken kendi "güncel veri yok / bekleniyor" durumunu gösterir */}
        {!sessionActive && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-200">
            <b>Güncel seans verisi yok</b> — {data?.session.isLive === false ? "piyasa kapalı ya da veri gelmedi" : "09:35 ET ilk 5m kapanışı bekleniyor"}. Kartlar aşağıda yerinde; veri gelince dolacak
            (09:35 ilk 5m · 09:45 15m · 09:55 büyük resim · belirsizse 10:00 30m teyidi).
          </div>
        )}

        <>
        {/* ── 1) Açılış aşamaları — BİLGİ, karar vermez (yön kararı karar satırında) ── */}
          <div className="overflow-hidden rounded-lg border border-[#1c2635] bg-black">
            <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 ${regimeOpen ? "border-b border-[#1c2635]" : ""}`}>
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] font-semibold tracking-wide text-slate-300">
                Açılış aşamaları <span className="text-[10.5px] font-normal text-slate-500">· bilgi, karar vermez</span>
                {regimeOpen ? (
                  <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· 09:35 ilk okuma → 09:45 15m → 09:55 büyük resim (karar) → 09:55 net değilse 10:00 30m kararı</span>
                ) : op ? (
                  <>
                    <span className="text-[12px] font-normal text-slate-400">okuma: {op.label}</span>
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
                <div className="text-[11px] text-slate-500">açılış okuması</div>
                <div className="mt-1 text-[15px] font-bold tracking-wide text-slate-300">{op?.label ?? "VERİ BEKLENİYOR"}</div>
              </div>
              <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-slate-400">{op?.summary ?? "Mum verisi bekleniyor."}</div>
            </div>
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
                      <div className="font-mono text-[10px] text-slate-500" title="Kalibre edilmiş olasılık değil — geçmiş ölçümden model puanı">model puanı 60dk %{st.hit60} · kap. %{st.hitClose} · {stageN}</div>
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

        {/* ── 1a) Gerekçe kartları — gün yönelimi · VWAP · EMA20 · alıcı/satıcı · emir defteri + opsiyon akışı ── */}
        <BiasStrip b={bias} />
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
          <VwapCard r={vwapR} clock={lad?.clock ?? null} />
          <EmaCard e5={ema5Tf} e15={ema15Tf} v={emaV} opening={lad?.regime.opening ?? null} />
          <VolumeCard p={pressR} dayRvol={lad?.dayRvol ?? null} rvol5={lad?.rvol ?? null} clock={lad?.clock ?? null} />
          <BookOptionsCard b={bookR} o={optR} />
        </div>

        {/* ── 1a2) Karar merdiveni — karar özeti (+ gizli teknik ayrıntı) ── */}
        <LadderPanel L={ladder} s={lad} waiting={!analysis || !analysis.s5.bars.length} hist={lad ? decisions?.model.modes[lad.regime.mode] ?? null : null} />

        {/* ── 1b) Pivot noktaları ── */}
        <PivotCard p={pivR} price={price} />

        {/* ── 1c) Likidite · akıllı para · hacim profili (gerekçe) ── */}
        <FlowPanel f={flow} price={price} opt={optLevels} step={lad} />

        </>

        {/* ── 2b) 15m yapı stopu — trend taşırken stopu nereye çekeceğini gösterir ── */}
        <Hideable title="Trend Stop Bölgesi" open={showStops} onToggle={() => setShowStops((v) => !v)}>
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
            <span className="text-[12px] font-semibold tracking-wide text-slate-300">
              Trend Stop Bölgesi <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· taşıma stopu referansı: son kapanan 15m dip/zirve ± ATR tamponu · her 15m kapanışta yenilenir · bilgi — işlem stopu karar satırındaki plandan gelir</span>
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
                const dir = lad?.regime.permission === "CALL" ? "UP" : lad?.regime.permission === "PUT" ? "DOWN" : "MIXED";
                const active = dir === "MIXED" || (isLong ? dir === "UP" : dir === "DOWN");
                const col = isLong ? "#22c55e" : "#ef4444";
                const dist = price != null ? (isLong ? price - z.stop : z.stop - price) : null;
                const hit = dist != null && dist <= 0;
                return (
                  <div key={z.side} className={`bg-[#0f141d] px-3 py-2 ${active ? "" : "opacity-45"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold" style={{ color: col }}>
                        {isLong ? "CALL taşıyorsan" : "PUT taşıyorsan"}
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
            Kural: stop yalnızca trend yönünde çekilir (CALL&apos;da yukarı, PUT&apos;ta aşağı), asla geri gevşetilmez. Yalnızca KAPANMIŞ 15m mum kullanılır; oluşan mumun fitili stopu oynatmaz. Seviyeler grafikte SL çizgisi olarak görünür.
          </div>
        </div>

        </Hideable>

        {/* ── 3) Tahmin: 15m setup + 4 mum tahmini · harita ── */}
        {!date ? (
          <div className={`${SURFACE} px-3 py-8 text-center text-[12px] text-slate-500`}>Tahmin bölümü için fiyat ve seviye verisi bekleniyor.</div>
        ) : (
          <ForecastTabs
            setupTab={<Setup15Panel bars={m15Closed} forming={m15Forming} read={setup15.read} stats={setup15.stats} htfReady={h1Hist.length > 0} price={price} />}
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
                15m — rejim
                {chartDir && <span className={`text-[13px] font-bold leading-none ${chartDir === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{chartDir === "UP" ? "↑" : "↓"}</span>}
              </div>
              <SpyChart
                bars={m15Bars} timeframe="15m" events={events} position={openPosition} toggles={toggles}
                height={380} autoScroll={autoScroll} defaultWindowMin={480}
                levelLines={chartLines} trendDirection={chartDir}
              />
            </div>
            <div className="bg-[#0a0e17]">
              <div className="flex items-center gap-1.5 border-b border-[#1c2635] px-2 py-1 text-[10.5px] text-slate-500">
                5m — erken uyarı / tetik
                {chartDir && <span className={`text-[13px] font-bold leading-none ${chartDir === "UP" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{chartDir === "UP" ? "↑" : "↓"}</span>}
              </div>
              <SpyChart
                bars={m5Bars} timeframe="5m" events={events} position={openPosition} toggles={toggles}
                height={380} autoScroll={autoScroll} defaultWindowMin={120}
                levelLines={chartLines} trendDirection={chartDir}
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
          <CommentFeed title="15m Mum Yorumları — rejim: 5 koşul · VWAP tamponu · RVOL" items={comments.c15} forming={forming15} />
          <CommentFeed title="5m Mum Yorumları — karar satırı durumu · mum kalitesi · RVOL · yerel hacim" items={comments.c5} forming={forming5} />
        </div>

        {/* ── 6) Tahmin günlüğü — gerçekleşenle kıyas ── */}
        <Hideable title="Tahmin Günlüğü" open={showJournal} onToggle={() => setShowJournal((v) => !v)}><JournalPanel j={journal} /></Hideable>

        {/* ── 7) Karar günlüğü & öğrenen model — her karar ve sonucu arşivde ── */}
        <Hideable title="Karar Günlüğü & Öğrenen Model" open={showDecisions} onToggle={() => setShowDecisions((v) => !v)}><DecisionLogPanel r={decisions} /></Hideable>

      </div>

      <div className="mt-2 text-center font-mono text-[9.5px] text-slate-700">
        yoklama {pollMs / 1000}sn · {m1.length} × 1m mum yüklü · son yanıt {lastFetch ? `${nyClock(lastFetch, true)} ET` : "—"}
      </div>
    </div>
  );
}
