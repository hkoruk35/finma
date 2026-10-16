"use client";

/**
 * SPY Engine — Takip Sistemi (/admin/spyengine/v1)
 *
 * TEK KARAR KAYNAĞI: lib/spyengine/tracker.ts (2026-10-15, kullanıcı yapısı)
 *   15m yön teyidi (son 15m kapanış VWAP + EMA20 aynı tarafta) → 5m tetik (VWAP · EMA20 · hacim çubuğu · mum formasyonu;
 *   RVOL/RSI yalnız belirsizlikte) → stop son 2 mumun ucu → 1R'de yarısı + stop girişe → kalan yarı her 15m kapanışında
 *   15m dip/tepe ∓ tampon. Kazanç yön tahmininden değil bu düzenden gelir.
 * Üst bant, Takip paneli, sesli uyarı, harita senaryosu ve trend stop bölgesi hepsi aynı okumadan beslenir.
 * Kaldırıldı (çelişkili ikinci hüküm üretiyorlardı): Karar Merdiveni (bant, panel, ses, karar/işlem günlükleri),
 * merdiven tabanlı 5m/15m mum yorumları, Gün yönelimi + VWAP/EMA/hacim/defter kanıt kartları, eski açılış kararı günlüğü,
 * 15m setup tahmini, 15m/5m grafikleri. 30m/1h/4h yalnız bilgi. Açılış Tahmini (ES fair value) seans öncesi bilgi olarak kalır.
 *
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur; API uçları da ayrıca satır içi kontrol yapar.
 */

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pivotFrames, mtfPivotRead, type MtfPivotRead, type MtfLevel } from "@/lib/spyengine/mtfPivots";
import ForecastMap, { type MapScenario } from "@/components/admin/spyengine/ForecastMap";
import TrackerPanel from "@/components/admin/spyengine/TrackerPanel";
import SpyMarketWatch, { type WatchQuote } from "@/components/admin/spyengine/SpyMarketWatch";
import TradeLogPanel, { type TradeRow } from "@/components/admin/spyengine/TradeLogPanel";
import { trackerRead, trackPrewarn, FC_RULES, type TrackRead, type TrackAlert, type TrackStep, type TrackTrade } from "@/lib/spyengine/tracker";
import type { TrackerSummary } from "@/lib/spyengine/trackerStore";
import { mergeHourly } from "@/lib/spyengine/setup15";
import {
  PhaseBadge, SURFACE, num, signed, tone,
  type SpotStats,
} from "@/components/admin/spyengine/panels";
import {
  fromCompact, nyClock, nyParts, isRthBar, bucketAggregate, atr, lastNum,
  type Bar, type SessionInfo, type CompactBar,
} from "@/lib/spyengine/core";
import {
  daySeries, liveVwap, fmtVol, stopZones, openingRegime, buildForecastMap, emaByTime,
} from "@/lib/spyengine/openingMap";
import type {
  EngineEvent, PositionState, ContractType, EngineState, GateStatus, RegimeState,
} from "@/lib/spyengine/strategy";
import type { LevelRead, CloseForecast } from "@/lib/spyengine/levels";
import { flowRead, type FlowRead } from "@/lib/spyengine/flow";
import { optionLevelList, type OptionLevels } from "@/lib/spyengine/optionLevels";
import type { OpenForecastRead } from "@/lib/spyengine/openForecastFetch";
import type { ReversalState } from "@/lib/spyengine/reversal";
import type { RvolBase } from "@/lib/spyengine/ladder";

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
  /** RVOL tabanı (son 20 seans, aynı saat; med = medyan — Takip Sistemi) */
  rvolBase?: RvolBase | null;
}

/** veri yoklama: her saniye · tam sayfa yenileme (reload): her 30 saniye */
const POLL_MS = 1000;
const FULL_REFRESH_MS = 30 * 1000;

function mergeBars(prev: Bar[], incoming: Bar[], full: boolean): Bar[] {
  if (full) return incoming;
  if (!incoming.length) return prev;
  const map = new Map<number, Bar>();
  for (const b of prev) map.set(b.time, b);
  for (const b of incoming) map.set(b.time, b);
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

const SIDE_CHIP: Record<string, string> = {
  ABOVE: "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]",
  BELOW: "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#f87171]",
  AT: "border-slate-600 bg-slate-700/20 text-slate-300",
};

/**
 * En üst bant — sayfanın TEK karar satırı (Takip Sistemi: 15m yön teyidi → 5m tetik → 1R'de yarısı → 15m izleyen stop).
 * Başka hiçbir bölüm yön/işlem hükmü vermez.
 */
function TopBar({ t, waiting }: { t: TrackStep | null; waiting: boolean }) {
  if (!t) {
    return (
      <div className="rounded-lg border-2 border-slate-600 bg-slate-700/10 px-4 py-2.5 text-[15px] font-semibold text-slate-300">
        ◆ BEKLE · {waiting ? "09:35 ET ilk 5m kapanışı bekleniyor; yön teyidi 09:45 15m kapanışında." : "mum verisi bekleniyor."}
      </div>
    );
  }
  const col = t.tone === "bull" ? "#22c55e" : t.tone === "bear" ? "#ef4444" : t.tone === "warn" ? "#eab308" : "#94a3b8";
  const dcol = t.dir > 0 ? "#4ade80" : t.dir < 0 ? "#f87171" : "#94a3b8";
  return (
    <div className="rounded-lg border-2 px-4 py-2.5" style={{ borderColor: col, backgroundColor: `${col}14` }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`text-[20px] font-black tracking-wide ${t.setup?.status === "ARMED" ? "animate-pulse" : ""}`} style={{ color: col }}>{t.headline}</span>
        <span className="text-[15px] font-semibold leading-snug text-slate-100">· {t.action}</span>
        <span className="ml-auto font-mono text-[11px] text-slate-500">{t.stageLabel} · son 5m kapanış {t.clock} ET</span>
      </div>
      {!t.pre && (
        <div className="mt-1 text-[13px] leading-snug text-slate-300">
          <b className="text-slate-400">Yön:</b> <b style={{ color: dcol }}>{t.trend}</b> <span className="text-slate-500">(puan {t.score > 0 ? "+" : ""}{t.score}/6,5)</span>
          <span className="text-slate-400"> · {t.fc.text}</span>
        </div>
      )}
      {!t.pre && t.setup && t.setup.status !== "OPEN" && t.checklist.some((c) => !c.ok) && (
        <div className="mt-0.5 text-[12px] leading-snug text-slate-400"><b>Tetik için eksik:</b> {t.checklist.filter((c) => !c.ok && c.key !== "fresh").map((c) => c.text).join(" · ") || "taze tetik (yeni hiza ya da EMA20/VWAP'a geri çekilme)"}</div>
      )}
      <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">Kazanç yön tahmininden değil düzenden gelir: 15m teyitli 5m tetik · stop son 2 mumun ucu · 1R&apos;de yarısı + stop girişe · kalan yarı her 15m kapanışında 15m dip/tepe ∓ tampon.</div>
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

function FlowPanel({ f, price, opt }: { f: FlowRead | null; price: number | null; opt: OptionLevels | null }) {
  const [open, setOpen] = useState(false);
  const [optOpen, setOptOpen] = useState(false);
  const [tracesOpen, setTracesOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className={SHOW_BTN}>{open ? "▴ gizle" : "▾ göster"}</button>
        <span className="text-[13px] font-semibold text-slate-200">Likidite · Akıllı Para · Hacim Profili</span>
        <span className="hidden text-[11px] text-slate-500 sm:inline">· gerekçe, karar vermez</span>
      </div>
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

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      {head}
      {!open ? (
        <div className="border-t border-[#1c2635] px-3 py-1.5 text-[11.5px] text-slate-400">
          Ölçüm (karar vermez): POC {prof ? num(prof.poc) : "—"} · değer alanı {prof ? `${num(prof.val)}–${num(prof.vah)}` : "—"} · {dHead.replace("Son 30 dk: ", "30 dk ")}
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
            Alıcı/satıcı hacmi ve &quot;akıllı para&quot; etiketleri fiyat–hacim davranışından çıkarımdır, emir defteri verisi değildir. Bu olaylar karar vermez; karar yalnızca üst banttaki Takip Sistemi&apos;nden gelir.
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

const UPC = "#22c55e", DNC = "#ef4444";
const NEUTRAL = "#64748b";

// ── Pivot noktaları kartı: 30m / 1h / 4h Fibonacci pivotları (her mum kapanışında güncellenir) ──

const KIND_COLOR: Record<MtfLevel["kind"], string> = { R: "#4ade80", S: "#f87171", P: "#facc15", F: "#38bdf8" };
const PIVOT_STATE_CLS: Record<string, string> = {
  "KIRILDI ▲": "border-[#22c55e]/50 bg-[#22c55e]/15 text-[#4ade80]",
  "KIRILDI ▼": "border-[#ef4444]/50 bg-[#ef4444]/15 text-[#f87171]",
  "TEST · TUTTU": "border-amber-500/50 bg-amber-500/15 text-amber-300",
  "ÜZERİNDE": "border-sky-500/50 bg-sky-500/15 text-sky-300",
  "DEĞMEDİ": "border-slate-700 text-slate-500",
};

function PivotCard({ p, price }: { p: MtfPivotRead | null; price: number | null }) {
  if (!p) {
    return (
      <div className={`${SURFACE} px-3 py-2 text-[12px] text-slate-500`}>
        <span className="font-semibold text-slate-300">Pivot Noktaları</span> — güncel veri yok; 30m / 1h / 4h kapanmış mum bekleniyor.
      </div>
    );
  }
  const hcol = NEUTRAL;
  const maxAbs = Math.max(...p.ladder.map((l) => Math.abs(l.dist)), 0.5);
  const from = p.heading === "UP" ? p.below : p.heading === "DOWN" ? p.above : null;
  const prog = p.target && from && price != null ? Math.min(1, Math.max(0, (price - from.price) / (p.target.price - from.price))) : null;
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">
          Pivot Noktaları <span className="hidden text-[11px] font-normal text-slate-500 sm:inline">· Fibonacci (0,382 / 0,618 / 1,0) · {p.sets.map((x) => `${x.tf} ${x.base.clock} Y ${num(x.base.H)} D ${num(x.base.L)} K ${num(x.base.C)}`).join(" · ")}{p.fib ? ` · gün salınımı ${num(p.fib.lo)}–${num(p.fib.hi)}` : ""}</span>
        </span>
        <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: hcol, borderColor: `${hcol}66`, backgroundColor: `${hcol}14` }}>bölge {p.zone}</span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-[#1c2635] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="bg-[#0f141d] px-3 py-1.5">
          {p.ladder.map((l, i) => {
            const next = p.ladder[i + 1];
            const here = price != null && l.price >= price && (!next || next.price < price);
            const w = Math.round((Math.abs(l.dist) / maxAbs) * 100);
            const near = p.above?.price === l.price || p.below?.price === l.price;
            return (
              <Fragment key={`${l.price}${l.label}`}>
                <div className={`grid grid-cols-[minmax(0,118px)_62px_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-[3px] ${near ? "bg-[#151c28]" : ""}`}>
                  <span className="truncate font-mono text-[11.5px] font-bold" style={{ color: KIND_COLOR[l.kind] }} title={l.keys.join(" · ")}>{l.label}{l.weight >= 5 ? " ★" : ""}</span>
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
        <div className="flex flex-col gap-2 bg-[#0f141d] px-3 py-2">
          <div>
            <div className="text-[11px] text-slate-500">Son 30 dk hareketi · seviye bilgisi</div>
            <div className="text-[17px] font-extrabold leading-tight" style={{ color: hcol }}>
              {p.heading === "UP" ? "▲" : p.heading === "DOWN" ? "▼" : "◆"} {p.target ? `sıradaki ${p.target.label} ${num(p.target.price)}` : p.heading === "FLAT" ? `${p.zone} arasında yatay` : "pivot dışı"}
            </div>
            <div className="mt-0.5 text-[12px] leading-snug text-slate-300">{p.text}</div>
          </div>
          {prog != null && from && p.target && (
            <div>
              <div className="flex justify-between font-mono text-[10.5px] text-slate-500"><span>{num(from.price)}</span><span>%{Math.round(prog * 100)}</span><span>{num(p.target.price)}</span></div>
              <div className="h-2 overflow-hidden rounded bg-[#1c2635]"><span className="block h-full rounded" style={{ width: `${Math.round(prog * 100)}%`, backgroundColor: hcol }} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[12px]">
            {([["alttaki pivot", p.below, DNC], ["üstteki pivot", p.above, UPC]] as const).map(([t, l, c]) => (
              <div key={t} className="rounded border px-2 py-1" style={{ borderColor: `${c}44`, backgroundColor: `${c}0d` }}>
                <div className="font-sans text-[10.5px] text-slate-500">{t}</div>
                {l ? (
                  <>
                    <div><b style={{ color: c }}>{num(l.price)}</b> <span className="text-slate-400">{l.dist >= 0 ? "−" : "+"}{Math.abs(l.dist).toFixed(2)}</span></div>
                    <div className="truncate font-sans text-[10.5px] text-slate-400">{l.keys.join(" · ")}</div>
                  </>
                ) : "—"}
              </div>
            ))}
          </div>
          <div className="text-[10.5px] leading-snug text-slate-500">
            Pivotlar 30m / 1h / 4h son KAPANMIŞ mumdan Fibonacci kuralıyla hesaplanır (P ± 0,382 · 0,618 · 1,0 × aralık) ve her yeni mumda güncellenir; mavi = gün salınımının Fibonacci geri çekilmesi.
            Aynı fiyattaki kaynaklar birleşir (★ = güçlü kesişim). TEST · TUTTU = değdi, aynı tarafta kaldı · KIRILDI = öbür tarafa geçti.
          </div>
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
  piv: MtfPivotRead | null;
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
                <span className="truncate text-[#f87171]" title={piv.below?.keys.join(" · ")}>{piv.below ? `${piv.below.keys[0]} ${num(piv.below.price)} (−${Math.abs(piv.below.dist).toFixed(2)})` : "—"}</span>
                <span className="truncate text-[#4ade80]" title={piv.above?.keys.join(" · ")}>{piv.above ? `${piv.above.keys[0]} ${num(piv.above.price)} (+${Math.abs(piv.above.dist).toFixed(2)})` : "—"}</span>
              </div>
            </div>
          ) : <span className="text-[10.5px] text-slate-500">Pivot: 30m/1h/4h verisi bekleniyor</span>}
        </div>
      </div>
    </div>
  );
}

// ── Kayıt yardımcıları ─────────────────────────────────────────────

/** Takip işlemi → Önerilen İşlemler satırı (R kontrat başına; kontrat önerisi kurulum metninde) */
function tradeRow(date: string, a: TrackTrade): TradeRow {
  return {
    date, clock: a.entryClock, side: a.side, mode: a.tag,
    setup: `${a.contracts ?? 2} kontrat · ${a.why ?? ""}${a.momWhy?.length ? ` · ${a.contracts === 1 ? "" : "momentum: "}${a.momWhy.join(", ")}` : ""}`,
    entry: a.entry, stop: a.stop0, target: a.h1,
    exitClock: a.exitClock, exit: a.exit, exitWhy: a.exitReason, r: a.resultR,
  };
}

const LEVEL_CLS: Record<string, string> = {
  TETİK: "text-[#4ade80]", ÇIKIŞ: "text-orange-300", YÖNET: "text-sky-300", HAZIRLAN: "text-[#facc15]", İPTAL: "text-slate-500", KADEME: "text-slate-400",
};

function AlertLog({ today, past }: { today: { date: string; clock: string; level: string; side: string | null; text: string }[]; past: { date: string; clock: string; level: string; side: string | null; text: string }[] }) {
  const todayDate = today[0]?.date;
  const rows = [...today, ...past.filter((a) => a.date !== todayDate)].sort((a, b) => (a.date === b.date ? b.clock.localeCompare(a.clock) : b.date.localeCompare(a.date)));
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">Uyarı Kaydı</span>
        <span className="font-mono text-[11px] text-slate-500">bugün + son 10 seans · {rows.length} uyarı</span>
      </div>
      <div className="max-h-[360px] overflow-auto">
        {rows.length === 0 ? <div className="px-3 py-4 text-center text-[12px] text-slate-500">Kayıtlı uyarı yok.</div> : (
          <table className="w-full text-[11.5px]">
            <tbody>
              {rows.map((a, i) => (
                <tr key={`${a.date}-${a.clock}-${a.level}-${i}`} className={`border-t border-[#151c28] ${a.date === todayDate ? "bg-sky-500/5" : ""}`}>
                  <td className="px-2 py-1 font-mono text-slate-400">{a.date === todayDate ? "bugün" : a.date.slice(5)}</td>
                  <td className="px-2 font-mono text-slate-300">{a.clock}</td>
                  <td className={`px-2 font-semibold ${LEVEL_CLS[a.level] ?? "text-slate-300"}`}>{a.level}</td>
                  <td className="px-2 text-slate-300">{a.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] text-slate-500">Bugünkü uyarılar canlı hesaptan; geçmiş günler her seans kapanışında Takip günlüğüne (Supabase) dondurulur. HAZIRLAN uyarıları canlı sayfadan kaydedilir.</div>
    </div>
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────

export default function SpyEngineV9() {
  const pollMs = POLL_MS;
  /** Tickerlar varsayılan GİZLİ — "göster" deyince görünür */
  const [showTickers, setShowTickers] = useState(false);
  /** Açılış Tahmini / Tahmin Günlüğü varsayılan GİZLİ */
  const [showOpenFc, setShowOpenFc] = useState(false);
  /** Kayıt bölümleri (sayfa altı) — varsayılan gizli */
  const [showTrades, setShowTrades] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showStops, setShowStops] = useState(false);
  const [alertSound, setAlertSound] = useState(true);
  const [replayDate, setReplayDate] = useState("");
  // 30 sn'de bir gerçek tam sayfa yenileme (kullanıcı isteği; ses izni yeniden tıklama ister) — geçmiş gün izlenirken yapılmaz
  useEffect(() => {
    if (replayDate) return;
    const id = setTimeout(() => window.location.reload(), FULL_REFRESH_MS);
    return () => clearTimeout(id);
  }, [replayDate]);
  /** SL tamponu çarpanı (ATR15 x): 0,25 normal · 0,40 yüksek oynaklık · 0,50 veri/FOMC günü */
  const [stopMult, setStopMult] = useState(0.25);

  const [data, setData] = useState<StreamResponse | null>(null);
  const [m1, setM1] = useState<Bar[]>([]);
  /** 1h geçmişi (~6 ay, RTH) — Takip Sistemi 1h/4h EMA20 yönü, günlük ATR ve 4h/1h pivotları için; 5 dk'da bir yenilenir */
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

  const [quotes, setQuotes] = useState<WatchQuote[]>([]);
  const [quotesAt, setQuotesAt] = useState<number | null>(null);
  /** Açılış tahmini (04:00 → 09:30): ES fair value, 60 sn'de bir */
  const [openFc, setOpenFc] = useState<OpenForecastRead | null>(null);
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
        const res = await fetch("/api/admin/spyengine/v2/quotes?set=spy", { credentials: "include", cache: "no-store" });
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

  // Takip Sistemi günlüğü: açılışta bir kez + 10 dk'da bir (sunucu biten seansları dondurur; özet döner)
  const [trackHist, setTrackHist] = useState<TrackerSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/tracker", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) setTrackHist(json as TrackerSummary);
      } catch {
        // günlük ana akışı etkilemesin
      }
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
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

  const date = data?.session.date ?? "";

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
  // ── TAKİP SİSTEMİ: her 5m kapanışında tek okuma (lib/spyengine/tracker.ts) ──
  /** Bir mum yalnız 1m akışında bitişinden sonraki dakika görülünce kapanmış sayılır  */
  const trackNow = replayDate ? evalNow : lastM1Time != null ? Math.min(evalNow || lastM1Time, lastM1Time) : evalNow;
  const trackKey = trackNow ? Math.floor(trackNow / 300) : 0;
  /** Son kapanmış 5m mumun imzası — Takip yalnız yeni kapanışta (ya da kapanmış mum düzeltilince) yeniden hesaplanır */
  const trackSig = (() => {
    for (let k = m5D.length - 1; k >= 0; k--) if (m5D[k].time + 300 <= trackNow) return `${trackKey}:${m5D[k].close}:${m5D[k].volume}`;
    return `${trackKey}`;
  })();
  const h1Track = useMemo(() => (trackNow ? mergeHourly(h1Hist, m1, trackNow) : []),
    // yalnız yeni 5m kapanışında
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h1Hist, trackKey]);
  const track = useMemo<TrackRead | null>(() => {
    if (!date || !trackNow) return null;
    return trackerRead({
      date, m5: m5D, nowSec: trackNow, h1: h1Track, fine: m1,
      prevClose: data?.levels?.prevClose ?? null, rvol: data?.rvolBase ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackSig, h1Track, date, data?.levels?.prevClose, data?.rvolBase, replayDate]);
  const trackCur = track?.current ?? null;

  /** Pivot noktaları: 30m / 1h / 4h Fibonacci (her mum kapanışında güncellenir) */
  const pivFrames = useMemo(() => pivotFrames(m5D.filter((b) => isRthBar(b) && b.time + 300 <= (trackNow || Infinity)), h1Hist),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackKey, h1Hist]);
  const pivR = useMemo<MtfPivotRead | null>(() => {
    if (price == null || !trackNow) return null;
    return mtfPivotRead(pivFrames, analysis?.s5.bars ?? [], price, trackNow);
  }, [pivFrames, analysis?.s5, price, trackNow]);
  const ema5Now = useMemo(() => {
    const bs = analysis?.s5.bars;
    return bs && bs.length ? ema5.get(bs[bs.length - 1].time) ?? null : null;
  }, [analysis?.s5, ema5]);

  /** Harita yönü = Takip Sistemi'nin 5m yön okuması (sayfada tek tahmin kaynağı) */
  const playBias = useMemo<{ bias: "UP" | "DOWN" | "FLAT"; text: string } | null>(() => {
    const t = trackCur && !trackCur.pre ? trackCur : null;
    if (!t) return null;
    if (t.dir > 0) return { bias: "UP", text: `Takip Sistemi ${t.clock}: ${t.trend} (yön puanı +${t.score}) → yükseliş senaryosu.` };
    if (t.dir < 0) return { bias: "DOWN", text: `Takip Sistemi ${t.clock}: ${t.trend} (yön puanı ${t.score}) → düşüş senaryosu.` };
    return { bias: "FLAT", text: `Takip Sistemi ${t.clock}: yön yok (puan ${t.score}) — aralık senaryosu.` };
  }, [trackCur]);

  /** Haritanın ufku: şimdi + 90 dk (gün sonuna kadar uzanmaz) ve Takip Sistemi'nin 30 dk senaryoları */
  const mapEnd = evalNow ? Math.max(evalNow, (trackCur?.t ?? evalNow) + 300) + 90 * 60 : undefined;
  const scenarios = useMemo<MapScenario[] | undefined>(() => {
    const t = trackCur && !trackCur.pre ? trackCur : null;
    if (!t || price == null) return undefined;
    const t0 = t.t + 300;
    const lv = [...(pivR?.ladder ?? []).map((l) => ({ price: l.price, label: l.keys[0] })), ...(t.vwap != null ? [{ price: t.vwap, label: "VWAP" }] : [])];
    const next = (d: 1 | -1, from: number) => lv.filter((l) => d * (l.price - from) > 0.15).sort((a, b) => d * (a.price - b.price))[0] ?? null;
    if (t.fc.dir && t.fc.target != null && t.fc.invalid != null) {
      const d = t.fc.dir as 1 | -1;
      // ölçülmüş: 30 dk içinde hedefe iptalden önce değme oranı
      const pct = t.fc.rule ? FC_RULES[t.fc.rule].tHit ?? null : null;
      const beyond = next(d, t.fc.target);
      const main: MapScenario = {
        main: true, pct, color: d > 0 ? "#22c55e" : "#ef4444",
        pts: [{ t: t0, price: price, label: "şimdi" }, { t: t0 + 30 * 60, price: t.fc.target, label: `${d > 0 ? "▲" : "▼"} ${t.fc.target.toFixed(2)} ${t.fc.targetLabel}` },
          ...(beyond ? [{ t: t0 + 75 * 60, price: beyond.price, label: `devam ${beyond.price.toFixed(2)} ${beyond.label}` }] : [])],
      };
      const opp = next((-d) as 1 | -1, t.fc.invalid);
      const alt: MapScenario = {
        main: false, pct: null, color: "#94a3b8",
        pts: [{ t: t0, price: price, label: "şimdi" }, { t: t0 + 20 * 60, price: t.fc.invalid, label: `iptal ${t.fc.invalid.toFixed(2)}` },
          ...(opp ? [{ t: t0 + 55 * 60, price: opp.price, label: `iptal → ${opp.price.toFixed(2)} ${opp.label}` }] : [])],
      };
      return [alt, main];
    }
    const up = next(1, price), dn = next(-1, price);
    return [
      ...(up ? [{ main: false, pct: null, color: "#22c55e", pts: [{ t: t0, price, label: "şimdi" }, { t: t0 + 40 * 60, price: up.price, label: `▲ ${up.price.toFixed(2)} ${up.label} (üstü kapanışla)` }] }] : []),
      ...(dn ? [{ main: false, pct: null, color: "#ef4444", pts: [{ t: t0, price, label: "şimdi" }, { t: t0 + 40 * 60, price: dn.price, label: `▼ ${dn.price.toFixed(2)} ${dn.label} (altı kapanışla)` }] }] : []),
    ];
  }, [trackCur, price, pivR]);

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

  // Takip Sistemi uyarıları: TETİK / YÖNET / ÇIKIŞ / İPTAL (kapanışta) + HAZIRLAN (kapanışa ≤ 60 sn) — her biri bir kez
  const seenAlerts = useRef<Set<string> | null>(null);
  const prewarn = useMemo<TrackAlert | null>(() => {
    if (replayDate || !nowSec || !track) return null;
    const cur = m5D.length ? m5D[m5D.length - 1] : null;
    return cur && cur.time + 300 > nowSec ? trackPrewarn(track, cur, nowSec) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, nowSec, replayDate]);
  useEffect(() => {
    if (replayDate || !track || !data?.session.isLive) return;
    const all = [...track.alerts.filter((a) => a.level !== "KADEME"), ...(prewarn ? [prewarn] : [])];
    if (seenAlerts.current == null) { seenAlerts.current = new Set(all.map((a) => a.key)); return; } // ilk yüklemede çalma
    const fresh = all.filter((a) => !seenAlerts.current!.has(a.key));
    if (!fresh.length) return;
    for (const a of fresh) seenAlerts.current.add(a.key);
    if (alertSound) {
      if (fresh.some((a) => a.level === "TETİK" || a.level === "ÇIKIŞ")) chime("fired");
      else if (fresh.some((a) => a.level === "HAZIRLAN" || a.level === "YÖNET")) chime("imminent");
    }
    void fetch("/api/admin/spyengine/v2/tracker", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: track.date, alerts: fresh.map((a) => ({ t: a.t, clock: a.clock, level: a.level, tag: a.tag, side: a.side, text: a.text })) }),
    }).catch(() => { /* kayıt ana akışı etkilemesin */ });
  }, [track, prewarn, replayDate, data?.session.isLive, alertSound, chime]);

  // Cuma notu: yalnız NY saatiyle Cuma günleri (canlıda bugün, replay'de seçilen seans)
  const isFriday = evalNow > 0 && new Date(`${nyParts(evalNow).ymd}T12:00:00Z`).getUTCDay() === 5;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0e17] p-2 text-slate-300">
      {isFriday && (
        <div className="mb-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-center text-[13px] font-semibold text-emerald-300">
          🕌 Bugün mübarek Cuma günü… Gerekmedikçe işlem açma.
        </div>
      )}
      {/* ── Başlık ── */}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight text-[#eab308]">SPY Engine · Takip Sistemi
              <Link href="/admin/qqqengine/v1" className="rounded-md border border-sky-500/60 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/30">→ QQQ Engine</Link>
            </h1>
            <p className="hidden text-[10.5px] text-slate-500 sm:block">
              Ana karar: 15m yön teyidi (VWAP + EMA20) → 5m tetik (VWAP · EMA20 · hacim çubuğu · mum formasyonu; RVOL/RSI belirsizlikte) → 1R&apos;de yarısı, kalan 15m izleyen stop · tek karar kaynağı · 30m/1h/4h yalnız bilgi
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
            title="Takip Sistemi: HAZIRLAN / YÖNET (ön uyarı sesi) · TETİK / ÇIKIŞ (giriş/çıkış sesi) — sesli + titreşimli"
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
            Piyasa takibi: {showTickers ? "gizle" : "göster"}
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
        <TopBar t={trackCur} waiting={!analysis || !analysis.s5.bars.length} />
        {prewarn && (
          <div className="animate-pulse rounded-lg border-2 border-[#eab308] bg-[#eab308]/10 px-4 py-1.5 text-[14px] font-bold text-[#facc15]">⚡ {prewarn.text}</div>
        )}

        {/* SPY Piyasa Takibi — varsayılan gizli (bilgi; karar üst bantta) */}
        {showTickers && <SpyMarketWatch quotes={quotes} updatedAt={quotesAt} spot={data?.spot ?? null} phase={data?.session.phase ?? "CLOSED"} />}

        {/* ── 0) Açılış tahmini — seans öncesi büyük, açılıştan sonra tek satır sonuç ── */}
        {!replayDate && <Hideable title="Açılış Tahmini" open={showOpenFc} onToggle={() => setShowOpenFc((v) => !v)}><OpenForecastPanel r={openFc} compact={sessionActive && !!openFc?.actual} /></Hideable>}

        {/* Seans kartları HER ZAMAN görünür; veri yokken kendi "güncel veri yok / bekleniyor" durumunu gösterir */}
        {!sessionActive && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-200">
            <b>Güncel seans verisi yok</b> — {data?.session.isLive === false ? "piyasa kapalı ya da veri gelmedi" : "09:35 ET ilk 5m kapanışı bekleniyor"}. Kartlar aşağıda yerinde; veri gelince dolacak
            (09:35 ilk 5m okuması · 09:45 ilk 15m yön teyidi · sonra her 5m kapanışında tetik aranır).
          </div>
        )}

        <>
        {/* ── 1) TAKİP SİSTEMİ — açılış aşamaları + açılış trendi + 5 dk'lık yön/trend kartları (09:00 → 15:00) ── */}
        <TrackerPanel r={track} nowSec={nowSec} live={!replayDate && !!data?.session.isLive} hist={trackHist} />

        {/* ── 1b) Pivot noktaları ── */}
        <PivotCard p={pivR} price={price} />

        {/* ── 1c) Likidite · akıllı para · hacim profili (gerekçe) ── */}
        <FlowPanel f={flow} price={price} opt={optLevels} />

        </>

        {/* ── 2b) 15m yapı stopu — trend taşırken stopu nereye çekeceğini gösterir ── */}
        <Hideable title="Trend Stop Bölgesi" open={showStops} onToggle={() => setShowStops((v) => !v)}>
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
            <span className="text-[12px] font-semibold tracking-wide text-slate-300">
              Trend Stop Bölgesi <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· Takip Sistemi&apos;nin kalan yarı için kullandığı kural: son kapanan 15m dip/tepe ∓ ATR15 tamponu (varsayılan 0,25) · her 15m kapanışta yenilenir, yalnız sıkılaşır</span>
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
                const sd = trackCur && !trackCur.pre ? trackCur.side15 : 0;
                const dir = sd > 0 ? "UP" : sd < 0 ? "DOWN" : "MIXED";
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

        {/* ── 3) Tahmin haritası — sayfadaki tek grafik (Takip Sistemi senaryoları, ufuk şimdi + 90 dk) ── */}
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
            <span className="text-[12px] font-semibold tracking-wide text-slate-300">
              Tahmin Haritası <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· destek / direnç · Takip Sistemi senaryoları (sonraki 30–90 dk) · pivotlar</span>
            </span>
            {map && (
              <span className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-slate-500">gün sonu kapanış bandı</span>
                <b className="text-[13px] text-slate-100">{num(map.closeLow)} – {num(map.closeHigh)}</b>
              </span>
            )}
          </div>
          {!map || !date ? (
            <div className="px-3 py-8 text-center text-[12px] text-slate-500">Harita için fiyat ve seviye verisi bekleniyor.</div>
          ) : (
            <>
              <ForecastMap bars={todayRth5.bars} vwapSeries={todayRth5.vwap} emaSeries={todayRth5.ema} flow={flow} optLevels={optLevels} map={map} date={date} nowSec={evalNow} endSec={mapEnd} scenarios={scenarios} />
              <div className="grid grid-cols-1 gap-2 border-t border-[#1c2635] px-3 py-2 lg:grid-cols-2">
                <div>
                  <div className="mb-0.5 text-[11px] font-semibold" style={{ color: map.bias === "UP" ? "#4ade80" : map.bias === "DOWN" ? "#f87171" : "#facc15" }}>
                    {map.biasText}
                  </div>
                  {trackCur && !trackCur.pre && (
                    <ul className="flex flex-col gap-0.5 text-[12px] leading-snug text-slate-200">
                      {trackCur.fc.dir !== 0 && trackCur.fc.target != null && trackCur.fc.invalid != null ? (
                        <>
                          <li><b style={{ color: trackCur.fc.dir > 0 ? "#4ade80" : "#f87171" }}>Ana senaryo{trackCur.fc.rule && FC_RULES[trackCur.fc.rule].tHit ? ` (hedefe değme %${FC_RULES[trackCur.fc.rule].tHit})` : ""}:</b> {trackCur.fc.dir > 0 ? "yukarı" : "aşağı"} {num(trackCur.fc.target)} ({trackCur.fc.targetLabel}) — {trackCur.fc.rule ? FC_RULES[trackCur.fc.rule].label : ""}.</li>
                          <li><b className="text-slate-400">Alternatif:</b> 5m kapanış {num(trackCur.fc.invalid)} ({trackCur.fc.invalidLabel}) {trackCur.fc.dir > 0 ? "altına" : "üstüne"} geçerse senaryo iptal, ters yöne dönülür.</li>
                        </>
                      ) : (
                        <li><b className="text-amber-300">Ölçülmüş bir kenar yok:</b> {trackCur.fc.text.replace(/^30 dk: /, "")}.</li>
                      )}
                    </ul>
                  )}
                  <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-4 text-[11px] leading-snug text-slate-400 marker:text-slate-500">
                    {map.steps.filter((x) => !x.startsWith("Gün sonu")).map((x, i) => <li key={i}>{x}</li>)}
                  </ol>
                </div>
                <ul className="flex flex-col gap-0.5 text-[11px] leading-snug text-slate-500">
                  {map.alt.map((a, i) => <li key={i}>⚠ {a}</li>)}
                  <li className="mt-0.5 text-slate-500">
                    Bu bir TAHMİNDİR. Senaryo yüzdesi 45 seanslık ölçümde fiyatın 30 dk içinde hedefe iptal seviyesinden önce değme oranıdır (30 dk sonraki yön isabeti ayrıca ~%47 — yön tek başına kenar değil); seviyeler ölçülmüş veriden.
                    Gün sonu bandı 20 seanslık dağılımdan{forecastAccuracy && forecastAccuracy.checked > 0 ? ` (gerçekleşen isabet %${Math.round((forecastAccuracy.hit / forecastAccuracy.checked) * 100)}, ${forecastAccuracy.checked} seans)` : ""}.
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* ── Kayıtlar: Takip Sistemi'nin önerdiği işlemler (bugün canlı + arşiv) ve uyarılar ── */}
        <Hideable title="Önerilen İşlemler (kayıt)" open={showTrades} onToggle={() => setShowTrades((v) => !v)}>
          <TradeLogPanel
            today={(track?.trades ?? []).map((a) => tradeRow(date ?? "", a))}
            past={(trackHist?.allTrades ?? []).map((a) => tradeRow(a.date, a))}
          />
        </Hideable>
        <Hideable title="Uyarı Kaydı" open={showAlerts} onToggle={() => setShowAlerts((v) => !v)}>
          <AlertLog today={(track?.alerts ?? []).filter((a) => a.level !== "KADEME").map((a) => ({ date: date ?? "", clock: a.clock, level: a.level, side: a.side, text: a.text }))} past={trackHist?.alertLog ?? []} />
        </Hideable>
      </div>

      <div className="mt-2 text-center font-mono text-[9.5px] text-slate-700">
        yoklama {pollMs / 1000}sn · tam yenileme {FULL_REFRESH_MS / 1000}sn · {m1.length} × 1m mum yüklü · son yanıt {lastFetch ? `${nyClock(lastFetch, true)} ET` : "—"}
      </div>
    </div>
  );
}
