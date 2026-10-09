"use client";

/**
 * QQQ Engine — Karar Merdiveni (/admin/qqqengine/v1) · SPY Engine'in (/admin/spyengine/v1) QQQ uyarlaması.
 *
 * Aynı tek karar satırı (lib/spyengine/ladder.ts): İŞLEM YOK · İZLE · ERKEN UYARI · TETİK · TERS UYARI · İPTAL.
 * Farklar: (1) eşikler QQQ için ayrı kalibre (lib/qqqengine/config.ts); (2) büyük teknoloji liderlerinin
 * (NVDA, MSFT, AAPL, AMZN, GOOGL, META, AVGO, TSLA, COST, NFLX) VWAP/EMA20 genişliği ve 15 dk momentumu
 * tetik filtresi olarak karar merdivenine girer ve ayrı panelde izlenir; (3) SPY'a özgü öğrenen tahmin modeli,
 * açılış tahmini (ES) ve tahmin günlüğü yoktur.
 *
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur; API uçları ayrıca satır içi kontrol yapar.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { prevDayPivots, pivotRead, PIVOT_ORDER, type PivotKey, type PivotRead } from "@/lib/spyengine/pivots";
import SpyChart, { type ChartToggles } from "@/components/admin/spyengine/SpyChart";
import {
  TickerStrip, InfoCards, PhaseBadge, SURFACE, num, signed, tone,
  type StripQuote, type SpotStats,
} from "@/components/admin/spyengine/panels";
import {
  fromCompact, nyClock, nyParts, isRthBar, bucketAggregate, atr, lastNum,
  type Bar, type SessionInfo, type CompactBar,
} from "@/lib/spyengine/core";
import {
  daySeries, liveVwap, fmtVol, stopZones, openingRegime, emaByTime,
  type CandleComment, type Tone,
} from "@/lib/spyengine/openingMap";
import type {
  EngineEvent, PositionState, ContractType, EngineState, GateStatus, RegimeState,
} from "@/lib/spyengine/strategy";
import type { LevelRead, CloseForecast } from "@/lib/spyengine/levels";
import { flowRead, type FlowRead } from "@/lib/spyengine/flow";
import { type OptionLevels } from "@/lib/spyengine/optionLevels";
import type { ReversalState } from "@/lib/spyengine/reversal";
import Link from "next/link";
import { QQQ_LADDER_CFG } from "@/lib/qqqengine/config";
import type { TechRow } from "@/lib/qqqengine/techs";
import {
  ladderRead, ladderComment5, ladderComment15, ladderForming, rvolText,
  type LadderRead, type LadderStep, type LadderStatus, type Cond, type RvolBase,
} from "@/lib/spyengine/ladder";

const CFG = QQQ_LADDER_CFG;

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

/** Merdivenin ayrıntısı: 4 adımın koşulları, risk, gün içi durum geçmişi */
function LadderPanel({ L, s, waiting }: { L: LadderRead | null; s: LadderStep | null; waiting: boolean }) {
  if (!L || !s) {
    return (
      <div className={`${SURFACE} px-3 py-3 text-[12px] text-slate-500`}>
        <span className="font-semibold text-slate-300">Karar Merdiveni · ayrıntı</span> — {waiting ? "09:35 ET ilk 5m kapanışıyla başlar." : "mum verisi bekleniyor."}
      </div>
    );
  }
  const rg = s.regime;
  const permCol = rg.permission === "CALL" ? "#22c55e" : rg.permission === "PUT" ? "#ef4444" : "#94a3b8";
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">
          Karar Merdiveni · ayrıntı <span className="hidden text-[11px] font-normal text-slate-500 sm:inline">· 1) seans planı → 2) 5m erken uyarı → 3) 5m tetik → 4) risk · yalnızca kapanmış mum</span>
        </span>
        <span className="font-mono text-[11px] text-slate-500">RVOL tabanı: son {L.base?.days ?? 0} seans, aynı saat</span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-[#1c2635] md:grid-cols-2 xl:grid-cols-4">
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
            <div className="text-[10.5px] leading-snug text-slate-500">15m VWAP+EMA20 · 30m/1h EMA20 aynı tarafta. Tetik 5m&apos;den gelir; teyit yalnızca bilgidir, giriş engellemez (erken girişler kaçmasın diye). Giriş filtresi: teknoloji liderleri.</div>
          </div>
          <CondList title="Seans planı (hangisi aktif)" conds={rg.conds} empty="—" />
          <div className="text-[10.5px] leading-snug text-slate-500">
            Açılış yönü 10:00–14:00 (açılış aralığı {rg.opening?.orLow != null && rg.opening?.orHigh != null ? `${num(rg.opening.orLow)}–${num(rg.opening.orHigh)}` : ""} karşı ucu kırılınca biter) · öğlen VWAP ± {CFG.plan.fadeK} ATR ({rg.fadeDn != null && rg.fadeUp != null ? `${num(rg.fadeDn)} / ${num(rg.fadeUp)}` : "—"}) dışında VWAP&apos;a dönüş · 14:00 sonrası VWAP+POC tarafı.
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
            Giriş tetik mumunun kapanışında; teknoloji liderleri işleme ters ise tetik açılmaz.
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-[#0f141d] px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Adım 4 · risk</div>
          <ul className="flex flex-col gap-0.5 text-[11.5px] leading-snug text-slate-300">
            <li>• Stop: son 3 mumun {"dibi/tepesi"} ∓ {CFG.risk.stopPadAtr} ATR (açılış bacağında 10:00–11:00: yalnızca tetik mumunun ucu, ≤ {CFG.risk.openLeg.maxStopAtr} ATR); trend modlarında bu &gt; {CFG.risk.maxStopAtr} ATR ise VWAP/EMA20 çizgisinin ötesi; o da genişse işlem yok</li>
            <li>• Hedef: {CFG.risk.rr}R · öğlen dönüşünde VWAP (en az {CFG.risk.fadeMinR}R)</li>
            <li>• Günde en fazla {CFG.risk.maxAttempts} deneme · çıkıştan sonra {CFG.risk.cooldownBars} mum bekle</li>
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
        Kalibrasyon (QQQ 5m, 59 seans 17 Tem–8 Eki, spot fiyat, opsiyon spread&apos;i hariç): SPY ayarı QQQ&apos;da tutmadı (+3,8R; görülmemiş son 20 günde −1,7R). QQQ için ayrı arama yapıldı ve teknoloji liderleri filtresi eklendi.
        Seçilen ayar: 85 işlem (1,5/gün) · %51 kazanç · toplam +16,5R · üç dönem ayrı ayrı +7,1R / +4,4R / +5,0R. Mod bazında: kapanış yönü +6,8R (65) · öğlen dönüş +9,7R (20); açılış yönü QQQ&apos;da kenar vermedi (kapalı).
        Dürüst not: arama ve seçim aynı 59 günde yapıldı, gerçek bir görülmemiş dönem kalmadı; sonuçlar SPY&apos;a göre daha zayıf ve daha az kanıtlıdır. Geçmiş sonuç geleceği garanti etmez.
        Eşikler: lib/qqqengine/config.ts. Diğer kartlar yalnızca gerekçe gösterir, karar vermez.
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

function FlowPanel({ f, price, opt, step }: { f: FlowRead | null; price: number | null; opt: OptionLevels | null; step: LadderStep | null }) {
  const [optOpen, setOptOpen] = useState(false);
  const [tracesOpen, setTracesOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  if (!f) {
    return (
      <div className={`${SURFACE} px-3 py-3 text-[12px] text-slate-500`}>
        <span className="font-semibold text-slate-300">Likidite · Akıllı Para · Hacim Profili</span> — güncel veri yok; ilk 5m kapanışla başlar.
      </div>
    );
  }
  const w = f.warning;
  const px = price ?? 0;
  const prof = f.profile;
  const above = f.pools.filter((p) => !p.swept && p.price > px).sort((a, b) => a.price - b.price).slice(0, 3);
  const below = f.pools.filter((p) => !p.swept && p.price < px).sort((a, b) => b.price - a.price).slice(0, 3);
  const fmtD = (v: number) => `${v >= 0 ? "+" : "−"}${fmtVol(Math.abs(v))}`;
  const lc = step ? ladderCol(step) : "#64748b";
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      {/* başlık */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">
          Likidite · Akıllı Para · Hacim Profili <span className="hidden text-[11px] font-normal text-slate-500 sm:inline">· gerekçe — karar vermez · süpürme · emilim · kurumsal itki · delta uyumsuzluğu · POC göçü · sıkışma/ivme</span>
        </span>
        {step && (
          <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: lc, borderColor: `${lc}66`, backgroundColor: `${lc}14` }}>
            karar satırı: {step.status}{step.side && step.status !== "İŞLEM YOK" ? ` · ${step.side}` : ""}
          </span>
        )}
      </div>

      {/* alıcı / satıcı izleri */}
      <div className="border-t border-[#1c2635] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setTracesOpen((v) => !v)} className="rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30">{tracesOpen ? "▴ gizle" : "▾ göster"}</button>
          <span className="text-[12px] font-semibold text-slate-200">Alıcı / satıcı izleri <span className="font-normal text-slate-500">· kanıt</span></span>
        </div>
      </div>
      {tracesOpen && (
      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2">
        {([["Alıcı izleri (kanıt)", w.bullWhy, "#cbd5e1"], ["Satıcı izleri (kanıt)", w.bearWhy, "#cbd5e1"]] as const).map(([t, list, c]) => (
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
      )}

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

      {/* olaylar — varsayılan gizli */}
      {f.events.length > 0 && (
        <div className="border-t border-[#1c2635] px-3 py-2">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setEventsOpen((v) => !v)} className="rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30">{eventsOpen ? "▴ gizle" : "▾ göster"}</button>
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
    </div>
  );
}

// ── Açılış tahmini paneli (04:00 Londra → 09:30 New York) ─────────


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

interface TechResp {
  ok: boolean;
  date: string;
  rows: TechRow[];
  breadth: number | null;
  momentum: number | null;
  upWeight: number;
  downWeight: number;
  read: string;
  asOf: number | null;
  series: [number, number, number][];
}

const pctS = (v: number | null, d = 2) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}%`);

/** Büyük teknoloji liderleri: QQQ'yu kimler taşıyor / çekiyor — yön vermez, tetik filtresine girdi (genişlik) sağlar */
function TechPanel({ t, step }: { t: TechResp | null; step: LadderStep | null }) {
  if (!t) {
    return <div className={`${SURFACE} px-3 py-3 text-[12px] text-slate-500`}><span className="font-semibold text-slate-300">Teknoloji Liderleri</span> — veri bekleniyor.</div>;
  }
  const b = t.breadth;
  const filt = step?.tech;
  const dirTxt = (x: number | null) => (x == null ? "—" : `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`);
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">
          Teknoloji Liderleri <span className="hidden text-[11px] font-normal text-slate-500 sm:inline">· QQQ&apos;yu taşıyanlar · VWAP + EMA20 tarafı · 15 dk momentum · QQQ&apos;ya göreli güç · tetik filtresi için genişlik</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="rounded border border-[#334155] bg-[#0a0e17] px-2 py-0.5 text-slate-300">genişlik {dirTxt(b)}</span>
          <span className="rounded border border-[#334155] bg-[#0a0e17] px-2 py-0.5 text-slate-300">momentum {dirTxt(t.momentum)}</span>
          <span className="rounded border border-[#334155] bg-[#0a0e17] px-2 py-0.5 text-slate-400">üstte %{t.upWeight} · altta %{t.downWeight}</span>
        </span>
      </div>
      <div className="border-b border-[#1c2635] px-3 py-1.5 text-[12px] leading-snug text-slate-300">
        {t.read}
        {filt && step && step.side && step.status !== "İŞLEM YOK" && (
          <span className="ml-1 text-slate-500">Karar satırındaki {step.side} yönüne göre genişlik {dirTxt(filt.vw * (step.side === "CALL" ? 1 : -1))}, momentum {dirTxt(filt.mom * (step.side === "CALL" ? 1 : -1))} (ters &lt; {CFG.tech.minVw} ise tetik açılmaz).</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] text-slate-500">
              <th className="px-3 py-1 font-normal">Hisse</th>
              <th className="px-2 py-1 text-right font-normal">Ağırlık</th>
              <th className="px-2 py-1 text-right font-normal">Fiyat</th>
              <th className="px-2 py-1 text-right font-normal">Gün %</th>
              <th className="px-2 py-1 text-right font-normal">VWAP&apos;a %</th>
              <th className="px-2 py-1 font-normal">Konum</th>
              <th className="px-2 py-1 text-right font-normal">15dk %</th>
              <th className="px-2 py-1 text-right font-normal">QQQ&apos;ya göre</th>
              <th className="px-2 py-1 text-right font-normal">Katkı (bps)</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.sym} className="border-t border-[#151c28] font-mono">
                <td className="px-3 py-1 font-sans"><b className="text-slate-200">{r.sym}</b> <span className="text-[10.5px] text-slate-500">{r.name}</span></td>
                <td className="px-2 py-1 text-right text-slate-400">%{r.weight}</td>
                <td className="px-2 py-1 text-right text-slate-200">{r.price != null ? r.price.toFixed(2) : "—"}</td>
                <td className={`px-2 py-1 text-right ${r.dayPct == null ? "text-slate-500" : r.dayPct >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>{pctS(r.dayPct)}</td>
                <td className="px-2 py-1 text-right text-slate-300">{pctS(r.vwapPct)}</td>
                <td className="px-2 py-1 font-sans text-[11px] text-slate-300">{r.side > 0 ? "VWAP+EMA20 üstü" : r.side < 0 ? "VWAP+EMA20 altı" : r.price == null ? "—" : "karışık"}</td>
                <td className={`px-2 py-1 text-right ${r.mom15Pct == null ? "text-slate-500" : r.mom15Pct >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>{pctS(r.mom15Pct)}</td>
                <td className="px-2 py-1 text-right text-slate-300">{r.rsPct == null ? "—" : `${r.rsPct >= 0 ? "+" : "−"}${Math.abs(r.rsPct).toFixed(2)} puan`}</td>
                <td className="px-2 py-1 text-right text-slate-400">{r.contribBps == null ? "—" : r.contribBps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
        Ağırlıklar yaklaşıktır (Nasdaq-100&apos;deki büyük paylar; güncel dağılım için fon sağlayıcısına bakın). Genişlik = ağırlıklı (VWAP tarafı + EMA20 tarafı)/2, −1…+1.
        Ölçüm (QQQ, 59 seans): liderler işleme TERS iken açılan 35 işlem −15,5R (%23 kazanç); uyumlu/nötr iken pozitif — bu yüzden ters genişlik tetiği engeller. Katkı ≈ ağırlık × günlük değişim.
      </div>
    </div>
  );
}

// ── Ortak durum kartı düzeni: başlık + etiket · büyük durum · tablo · sonuç ──

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

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#151c28] py-[3px] text-[11.5px] last:border-0">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className="min-w-0 text-right text-slate-200">{children}</span>
    </div>
  );
}

const UPC = "#22c55e", DNC = "#ef4444";
const NEUTRAL = "#64748b";

/** VWAP gerekçesi: fiyat − VWAP (ATR cinsinden), öğlen dönüş eşikleri, kesişim — karar vermez */
function VwapEvidence({ s, vwap, price }: { s: LadderStep | null; vwap: number | null; price: number | null }) {
  const rg = s?.regime ?? null;
  const dev = vwap != null && price != null ? price - vwap : null;
  const devA = rg?.devAtr ?? null;
  return (
    <StateCard
      title="VWAP · gerekçe"
      hint="karar vermez — seans planının VWAP girdileri"
      chip={devA == null ? "veri yok" : Math.abs(devA) >= CFG.plan.fadeK ? `uzama ≥ ${CFG.plan.fadeK} ATR` : "VWAP'a yakın"}
      chipCol={NEUTRAL}
      arrow="•"
      label={dev != null ? `${dev >= 0 ? "+" : "−"}${Math.abs(dev).toFixed(2)}` : "—"}
      sub={devA != null ? `fiyat − VWAP = ${devA >= 0 ? "+" : "−"}${Math.abs(devA).toFixed(2)} ATR(5m) · son 5m ${s?.clock ?? "—"}` : "5m kapanış bekleniyor"}
      col={NEUTRAL}
    >
      <Row k="VWAP (RTH, 09:30)">{vwap != null ? num(vwap) : "—"}</Row>
      <Row k={`Öğlen dönüş eşiği (± ${CFG.plan.fadeK} ATR)`}>{rg?.fadeDn != null && rg.fadeUp != null ? `${num(rg.fadeDn)} / ${num(rg.fadeUp)}` : "—"}</Row>
      <Row k="POC (hacim profili)">{rg?.poc != null ? num(rg.poc) : "—"}</Row>
      <Row k="Son 2 saatte VWAP kesişimi">{rg ? `${rg.crosses}` : "—"}</Row>
    </StateCard>
  );
}

/** EMA20 gerekçesi: 5m/15m değer + açılış okuması — karar vermez */
function EmaEvidence({ s, ema5, ema15, price }: { s: LadderStep | null; ema5: number | null; ema15: number | null; price: number | null }) {
  const op = s?.regime.opening ?? null;
  const d = (e: number | null) => (e != null && price != null ? `${num(e)} (${price - e >= 0 ? "+" : "−"}${Math.abs(price - e).toFixed(2)})` : "—");
  return (
    <StateCard
      title="EMA20 · açılış · gerekçe"
      hint="karar vermez — trend modlarında tetik VWAP + EMA20'nin doğru tarafında kapanış ister"
      chip={op ? (op.net ? `NET ${op.decidedAt ?? ""}` : "açılış net değil") : "açılış bekleniyor"}
      chipCol={NEUTRAL}
      arrow="•"
      label={ema5 != null ? num(ema5) : "—"}
      sub="EMA20 (5m) · parantezde fiyatın uzaklığı"
      col={NEUTRAL}
    >
      <Row k="EMA20 5m">{d(ema5)}</Row>
      <Row k="EMA20 15m">{d(ema15)}</Row>
      <Row k="Açılış okuması">{op ? op.label : "—"}</Row>
      <Row k="Açılış aralığı (ilk 15 dk)">{op?.orLow != null && op.orHigh != null ? `${num(op.orLow)} – ${num(op.orHigh)}${op.broken ? " · kırıldı" : ""}` : "—"}</Row>
    </StateCard>
  );
}

/** Hacim gerekçesi: RVOL (mum + gün), yerel artış, yorum tablosu — karar vermez */
function VolumeEvidence({ s, base }: { s: LadderStep | null; base: RvolBase | null }) {
  const rows: [string, string][] = [["< 0,8", "zayıf ilgi"], ["0,8 – 1,2", "normal"], ["1,2 – 1,5", "hareketi destekliyor"], ["1,5 – 3,0", "güçlü ilgi"], ["> 3,0", "aşırı — haber/tükenme"]];
  return (
    <StateCard
      title="Hacim (RVOL) · gerekçe"
      hint="RVOL = hacim ÷ son 20 seansta aynı saatin ortalaması"
      chip={base ? `taban: ${base.days} seans` : "taban yok"}
      chipCol={NEUTRAL}
      arrow="•"
      label={s?.dayRvol != null ? `gün ${s.dayRvol.toFixed(2)}` : "—"}
      sub={s?.dayRvol != null ? rvolText(s.dayRvol) : "veri yok"}
      col={NEUTRAL}
    >
      <Row k={`Son 5m RVOL (${s?.clock ?? "—"})`}>{s?.rvol != null ? `${s.rvol.toFixed(2)} · ${rvolText(s.rvol)}` : "—"}</Row>
      <Row k="Yerel artış (÷ önceki 3 mum)">{s?.localRatio != null ? `${s.localRatio.toFixed(2)}×${s.localRatio >= CFG.trig.volRatio ? " · tetik hacmi yeterli" : ""}` : "—"}</Row>
      <div className="mt-1 grid grid-cols-5 gap-0.5 text-center font-mono text-[9.5px] text-slate-500">
        {rows.map(([k, v]) => <div key={k} className="rounded bg-[#0a0e17] px-0.5 py-0.5"><div className="text-slate-300">{k}</div>{v}</div>)}
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
          <span className="text-[11px] font-semibold tracking-wide text-slate-500">QQQ</span>
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
  /** 15m-5m Grafikleri varsayılan GİZLİ */
  const [showCharts, setShowCharts] = useState(false);
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
  /** 0DTE opsiyon duvarları + max pain — yalnızca seviye (5 dk'da bir) */
  const [optLevelsLive, setOptLevels] = useState<OptionLevels | null>(null);

  /** Büyük teknoloji liderleri (10 sn'de bir; oynatmada seans sonu görünümü) */
  const [techs, setTechs] = useState<TechResp | null>(null);

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
      const res = await fetch(`/api/admin/qqqengine/v2${q.size ? `?${q}` : ""}`, { credentials: "include", cache: "no-store" });
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

  // Teknoloji liderleri: canlıda 10 sn'de bir; oynatmada seçili günün seans sonu
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/qqqengine/v2/techs${replayDate ? `?date=${replayDate}` : ""}`, { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setTechs(json as TechResp);
      } catch {
        // liderler ana akışı etkilemesin
      }
    };
    load();
    if (replayDate) return () => { cancelled = true; };
    const id = setInterval(load, 10 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [replayDate]);

  // Opsiyon seviyeleri: canlı modda 5 dk'da bir (sunucu da 5 dk önbellekler); replay'de güncel zincir anlamsız
  useEffect(() => {
    if (replayDate) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/qqqengine/v2/optlevels", { credentials: "include", cache: "no-store" });
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
    const opening = openingRegime(s5, s15, ema5, s30, null, data?.levels?.prevClose ?? null);
    return { s5, s15, s30, opening };
    // her yeni kapanışta (lastClosed) yeniden hesaplanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m5D, m15D, m30D, ema5, ema15, date, lastM1Time, minuteSlot, data?.levels?.prevClose]);

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
  const lvl = data?.levels ?? null;
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
  /** 5m mum başlangıcı → teknoloji genişliği/momentumu (karar merdiveni filtresi) */
  const techMap = useMemo(() => {
    const m = new Map<number, { vw: number; mom: number }>();
    for (const r of techs?.series ?? []) m.set(r[0], { vw: r[1], mom: r[2] });
    return m;
  }, [techs]);
  /** Üst zaman dilimi teyidi için 30m / 1h mumlar + EMA20 (yalnızca doğrulama; tetik 5m'den gelir) */
  const m60D = useMemo(() => bucketAggregate(m1, 60), [m1]);
  const htf = useMemo(() => ({ m30: m30D, e30: emaByTime(m30D), m60: m60D, e60: emaByTime(m60D) }), [m30D, m60D]);
  const ladderInput = useMemo(() => {
    if (!analysis || !date) return null;
    return { date, s5: analysis.s5, s15: analysis.s15, s30: analysis.s30, ema5, ema15, atr5: atr5Map, atr15: atr15Map, rvol: rvolBase, prevClose: data?.levels?.prevClose ?? null, htf, staticLevels, tech: techMap, cfg: CFG };
  }, [analysis, date, ema5, ema15, atr5Map, atr15Map, rvolBase, htf, staticLevels, techMap, data?.levels?.prevClose]);
  const ladder = useMemo<LadderRead | null>(() => (ladderInput ? ladderRead(ladderInput) : null), [ladderInput]);
  const lad = ladder?.current ?? null;

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
    const key = lad ? `${lad.status}:${lad.side ?? ""}` : "-";
    const prev = lastAlertKeyRef.current;
    lastAlertKeyRef.current = key;
    if (prev == null || prev === key || !alertSound || replayDate || !lad) return;
    if (lad.status === "TETİK" && lad.plan && !prev.startsWith("TETİK")) chime("fired");
    else if (lad.status === "ERKEN UYARI" || lad.status === "TERS UYARI") chime("imminent");
  }, [lad, alertSound, replayDate, chime]);


  // ── Render ──────────────────────────────────────────────────────
  const op = analysis?.opening ?? null;
  /** Grafik yön oku = rejim izni (tek kaynak) */
  const chartDir: "UP" | "DOWN" | null = lad?.regime.permission === "CALL" ? "UP" : lad?.regime.permission === "PUT" ? "DOWN" : null;
  /** Aşama yüzdelerinin dayandığı örnek: günlükten öğrenildiyse gün sayısı, değilse sabit ölçüm */
  const stageN = "SPY ölçümü";
  const ema15Now = (() => {
    const bs = analysis?.s15.bars;
    return bs && bs.length ? ema15.get(bs[bs.length - 1].time) ?? null : null;
  })();

  return (
    <div className="min-h-screen bg-[#0a0e17] p-2 text-slate-300">
      {/* ── Başlık ── */}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight text-[#eab308]">QQQ Engine · Karar Merdiveni
              <Link href="/admin/spyengine/v1" className="rounded-md border border-sky-500/60 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/30">→ SPY Engine</Link>
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

        {/* ── 1a) Gerekçe kartları — VWAP · EMA20/yapı · hacim (karar vermez) ── */}
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-3">
          <VwapEvidence s={lad} vwap={vwapNow} price={price} />
          <EmaEvidence s={lad} ema5={ema5Now} ema15={ema15Now} price={price} />
          <VolumeEvidence s={lad} base={rvolBase} />
        </div>

        {/* ── 1a2) Pivot noktaları ── */}
        <PivotCard p={pivR} price={price} />

        {/* ── 1b) Karar merdiveni ayrıntısı — 4 adımın koşulları ── */}
        <LadderPanel L={ladder} s={lad} waiting={!analysis || !analysis.s5.bars.length} />

        {/* ── 1b2) Teknoloji liderleri — QQQ'yu kimler taşıyor ── */}
        <TechPanel t={techs} step={lad} />

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

      </div>

      <div className="mt-2 text-center font-mono text-[9.5px] text-slate-700">
        yoklama {pollMs / 1000}sn · {m1.length} × 1m mum yüklü · son yanıt {lastFetch ? `${nyClock(lastFetch, true)} ET` : "—"}
      </div>
    </div>
  );
}
