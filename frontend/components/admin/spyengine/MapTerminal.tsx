"use client";

/**
 * Tahmin Haritası — terminal paneli (2026-11-10, kullanıcı isteği; önce SPY sayfasında).
 *
 * Grafik (ForecastMap, değişmedi) solda biraz küçük; sağda fiyata göre sıralı SEVİYE MERDİVENİ kutucukları
 * (direnç · fiyat · VWAP · EMA20 · destek · POC/VAH/VAL · likidite · opsiyon duvarları), altta kısa ÖZET kutucukları
 * (yön · ana senaryo · iptal · önce hangi seviye · gün sonu bandı). Eski uzun açıklamalar silinmedi: "Plan ayrıntısı"
 * altında duruyor. ⛶ ile tam ekran (Fullscreen API; desteklenmezse sabit katman) — Esc kapatır.
 * Bu panel karar vermez: işlem kararı yalnız Takip Sistemi tetiğiyle verilir.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ForecastMap, { type MapScenario } from "@/components/admin/spyengine/ForecastMap";
import type { Bar } from "@/lib/spyengine/core";
import type { ForecastMapData } from "@/lib/spyengine/openingMap";
import type { FlowRead } from "@/lib/spyengine/flow";
import type { OptionLevels } from "@/lib/spyengine/optionLevels";
import type { NextLevelOdds } from "@/lib/spyengine/mtfPivots";
import { FC_RULES, type TrackForecast } from "@/lib/spyengine/tracker";
import { usePersistedState } from "@/lib/spyengine/usePersistedState";

const f2 = (v: number) => v.toFixed(2);
const sgn = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
/** uzun kaynak etiketini kısalt: "Dün kapanış · 4h P" → "Dün kapanış" */
const shortLbl = (s: string, n = 14) => {
  const first = s.split(/ · | \/ |, /)[0].trim();
  return first.length > n ? `${first.slice(0, n - 1)}…` : first;
};

/** kutucuk renk temaları: çerçeve · zemin · yazı */
const THEME = {
  res: { frame: "border-rose-500/50", bg: "bg-rose-500/[0.09]", fg: "text-rose-300", bar: "bg-rose-500" },
  sup: { frame: "border-emerald-500/50", bg: "bg-emerald-500/[0.09]", fg: "text-emerald-300", bar: "bg-emerald-500" },
  price: { frame: "border-amber-400/70", bg: "bg-amber-400/[0.14]", fg: "text-amber-200", bar: "bg-amber-400" },
  vwap: { frame: "border-fuchsia-500/50", bg: "bg-fuchsia-500/[0.08]", fg: "text-fuchsia-300", bar: "bg-fuchsia-400" },
  ema: { frame: "border-cyan-500/50", bg: "bg-cyan-500/[0.08]", fg: "text-cyan-300", bar: "bg-cyan-400" },
  poc: { frame: "border-orange-500/45", bg: "bg-orange-500/[0.08]", fg: "text-orange-300", bar: "bg-orange-500" },
  liq: { frame: "border-yellow-400/45", bg: "bg-yellow-400/[0.07]", fg: "text-yellow-200", bar: "bg-yellow-400" },
  call: { frame: "border-pink-400/45", bg: "bg-pink-400/[0.07]", fg: "text-pink-300", bar: "bg-pink-400" },
  put: { frame: "border-sky-400/45", bg: "bg-sky-400/[0.07]", fg: "text-sky-300", bar: "bg-sky-400" },
  pain: { frame: "border-slate-400/40", bg: "bg-slate-400/[0.06]", fg: "text-slate-200", bar: "bg-slate-300" },
  up: { frame: "border-emerald-500/55", bg: "bg-emerald-500/[0.10]", fg: "text-emerald-300", bar: "bg-emerald-500" },
  down: { frame: "border-rose-500/55", bg: "bg-rose-500/[0.10]", fg: "text-rose-300", bar: "bg-rose-500" },
  flat: { frame: "border-amber-400/50", bg: "bg-amber-400/[0.08]", fg: "text-amber-200", bar: "bg-amber-400" },
  info: { frame: "border-slate-600/60", bg: "bg-slate-500/[0.06]", fg: "text-slate-200", bar: "bg-slate-500" },
} as const;
type ThemeKey = keyof typeof THEME;

interface Rung { price: number; tag: string; label: string; theme: ThemeKey; prio: number; isPrice?: boolean }

/** Sağ sütun: fiyata göre sıralı seviye kutucuğu */
function RungTile({ r, price }: { r: Rung; price: number }) {
  const t = THEME[r.theme];
  const d = r.price - price;
  return (
    <div className={`flex items-center gap-2 rounded border ${t.frame} ${t.bg} py-[3px] pl-0 pr-2 ${r.isPrice ? "ring-1 ring-amber-300/60" : ""}`}>
      <span className={`h-5 w-1 shrink-0 rounded-r ${t.bar}`} />
      <span className={`w-[52px] shrink-0 font-mono text-[9.5px] font-bold uppercase tracking-wider ${t.fg}`}>{r.tag}</span>
      <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400" title={r.label}>{r.label}</span>
      <span className={`font-mono text-[12.5px] font-bold tabular-nums ${r.isPrice ? "text-amber-100" : "text-slate-100"}`}>{f2(r.price)}</span>
      {!r.isPrice && (
        <span className={`w-[44px] text-right font-mono text-[10px] tabular-nums ${d > 0 ? "text-emerald-400/90" : d < 0 ? "text-rose-400/90" : "text-slate-500"}`}>{sgn(d)}</span>
      )}
      {r.isPrice && <span className="w-[44px] text-right font-mono text-[9.5px] text-amber-300/80">ŞİMDİ</span>}
    </div>
  );
}

/** Alt sıra: özet kutucuğu (etiket · büyük değer · kısa alt satır) */
function StatTile({ theme, label, value, sub, title }: { theme: ThemeKey; label: string; value: ReactNode; sub?: ReactNode; title?: string }) {
  const t = THEME[theme];
  return (
    <div className={`rounded border ${t.frame} ${t.bg} px-2.5 py-1.5`} title={title}>
      <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className={`mt-0.5 font-mono text-[15px] font-black leading-tight tabular-nums ${t.fg}`}>{value}</div>
      {sub != null && <div className="mt-0.5 truncate text-[10.5px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function MapTerminal({
  map, date, bars, vwapSeries, emaSeries, flow, optLevels, nowSec, endSec, scenarios, fc, odds, accuracy, ema,
}: {
  map: ForecastMapData | null;
  date: string | null;
  bars: Bar[];
  vwapSeries: (number | null)[];
  emaSeries: (number | null)[];
  flow: FlowRead | null;
  optLevels: OptionLevels | null;
  nowSec: number;
  endSec?: number;
  scenarios?: MapScenario[];
  /** Takip Sistemi'nin güncel 30 dk senaryosu (seans öncesinde null) */
  fc: TrackForecast | null;
  odds: NextLevelOdds | null;
  accuracy: { checked: number; hit: number } | null;
  ema: number | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [detail, setDetail] = usePersistedState("spyengine_ui_mapdetail", false);

  // tam ekran: Fullscreen API (tarayıcı Esc'i kendisi yönetir); desteklenmezse sabit katman + Esc
  useEffect(() => {
    // tarayıcı tam ekranından (Esc / F11) çıkılınca katmanı da kapat
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.fullscreenElement) setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  const toggleFull = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    if (full) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { /* zaten çıkılmış */ });
      setFull(false);
      return;
    }
    // katman hemen açılır (tarayıcı izin vermese de çalışır); izin verirse ayrıca gerçek tam ekran
    setFull(true);
    if (el.requestFullscreen) el.requestFullscreen().catch(() => { /* gömülü pencere / izin yok — katman yeterli */ });
  }, [full]);

  const price = map?.price ?? null;

  // ── seviye merdiveni (grafikteki seviyelerle aynı kaynaklar) ──
  const rungs: Rung[] = [];
  if (map && price != null) {
    map.resistances.slice(0, 2).forEach((l, i) => rungs.push({ price: l.price, tag: `DİRENÇ ${i + 1}`, label: shortLbl(l.label), theme: "res", prio: 1 }));
    map.supports.slice(0, 2).forEach((l, i) => rungs.push({ price: l.price, tag: `DESTEK ${i + 1}`, label: shortLbl(l.label), theme: "sup", prio: 1 }));
    if (map.vwap != null) rungs.push({ price: map.vwap, tag: "VWAP", label: "gün ort.", theme: "vwap", prio: 1 });
    if (ema != null) rungs.push({ price: ema, tag: "EMA20", label: "5m ort.", theme: "ema", prio: 1 });
    const prof = flow?.profile ?? null;
    if (prof) {
      rungs.push({ price: prof.poc, tag: "POC", label: "hacim max", theme: "poc", prio: 2 });
      rungs.push({ price: prof.vah, tag: "VAH", label: "değer üst", theme: "poc", prio: 4 });
      rungs.push({ price: prof.val, tag: "VAL", label: "değer alt", theme: "poc", prio: 4 });
    }
    if (flow) {
      const up = flow.pools.filter((p) => !p.swept && p.side === "BUY" && p.price > price).sort((a, b) => a.price - b.price)[0];
      const dn = flow.pools.filter((p) => !p.swept && p.side === "SELL" && p.price < price).sort((a, b) => b.price - a.price)[0];
      if (up) rungs.push({ price: up.price, tag: "LİKİDİTE", label: "alış stop", theme: "liq", prio: 3 });
      if (dn) rungs.push({ price: dn.price, tag: "LİKİDİTE", label: "satış stop", theme: "liq", prio: 3 });
    }
    if (optLevels) {
      const cw = optLevels.callWalls[0], pw = optLevels.putWalls[0];
      if (cw) rungs.push({ price: cw.strike, tag: "CALL DVR", label: "opsiyon", theme: "call", prio: 3 });
      if (pw) rungs.push({ price: pw.strike, tag: "PUT DVR", label: "opsiyon", theme: "put", prio: 3 });
      if (optLevels.maxPain != null) rungs.push({ price: optLevels.maxPain, tag: "MAX PAIN", label: "mıknatıs", theme: "pain", prio: 4 });
    }
  }
  // aynı fiyattaki tekrarları birleştir (öncelikli kalır), fiyat satırını ekle, yukarıdan aşağı sırala
  const ladder: Rung[] = [];
  for (const r of [...rungs].sort((a, b) => a.prio - b.prio)) if (!ladder.some((x) => Math.abs(x.price - r.price) < 0.03)) ladder.push(r);
  if (price != null) ladder.push({ price, tag: "FİYAT", label: "son", theme: "price", prio: 0, isPrice: true });
  ladder.sort((a, b) => b.price - a.price || (a.isPrice ? -1 : 1));

  // ── özet kutucukları ──
  const biasTheme: ThemeKey = map?.bias === "UP" ? "up" : map?.bias === "DOWN" ? "down" : "flat";
  const biasWord = map?.bias === "UP" ? "▲ YUKARI" : map?.bias === "DOWN" ? "▼ AŞAĞI" : "◆ YATAY";
  // "Takip Sistemi 12:20: 15m AŞAĞI · …" → "15m AŞAĞI"
  const biasSub = map ? shortLbl(map.biasText.replace(/^Takip Sistemi \d{1,2}:\d{2}:\s*/, ""), 40) : "";
  const vwapGap = map && map.vwap != null ? map.price - map.vwap : null;
  const hasFc = !!fc && fc.dir !== 0 && fc.target != null && fc.invalid != null;
  const tHit = hasFc && fc!.rule ? FC_RULES[fc!.rule].tHit : undefined;
  const accPct = accuracy && accuracy.checked > 0 ? Math.round((accuracy.hit / accuracy.checked) * 100) : null;

  return (
    <div
      ref={boxRef}
      className={`overflow-hidden rounded-lg border border-[#1f2a3a] bg-[#070b12] ${full ? "fixed inset-0 z-[60] overflow-y-auto rounded-none border-0 p-3" : ""}`}
    >
      {/* başlık şeridi */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2a3a] bg-[#0b111b] px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11.5px] font-bold uppercase tracking-[0.18em] text-slate-200">Tahmin Haritası</span>
          <span className="rounded border border-slate-600/60 bg-slate-500/10 px-1.5 py-px font-mono text-[9.5px] text-slate-400">ufuk +90 dk</span>
          {map && <span className={`rounded border px-1.5 py-px font-mono text-[10px] font-bold ${THEME[biasTheme].frame} ${THEME[biasTheme].bg} ${THEME[biasTheme].fg}`}>{biasWord}</span>}
        </div>
        <div className="flex items-center gap-2">
          {map && (
            <span className="font-mono text-[10.5px] text-slate-500">
              kapanış bandı <b className="text-[12px] text-slate-100">{f2(map.closeLow)} – {f2(map.closeHigh)}</b>
            </span>
          )}
          <button
            type="button"
            onClick={toggleFull}
            className="rounded border border-slate-600/70 bg-[#111827] px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-200 transition-colors hover:border-amber-400/70 hover:text-amber-200"
            title={full ? "Tam ekrandan çık (Esc)" : "Tam ekran"}
          >
            {full ? "✕ Kapat" : "⛶ Tam ekran"}
          </button>
        </div>
      </div>

      {!map || !date || price == null ? (
        <div className="px-3 py-8 text-center text-[12px] text-slate-500">Harita için fiyat ve seviye verisi bekleniyor.</div>
      ) : (
        <>
          {/* grafik + sağ sütun: seviye merdiveni */}
          <div className={`grid grid-cols-1 gap-2 p-2 ${full ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-[minmax(0,1fr)_270px]"}`}>
            <div className="min-w-0 overflow-hidden rounded border border-[#1a2433]">
              <ForecastMap bars={bars} vwapSeries={vwapSeries} emaSeries={emaSeries} flow={flow} optLevels={optLevels} map={map} date={date} nowSec={nowSec} endSec={endSec} scenarios={scenarios} height={full ? 560 : undefined} />
            </div>
            <div className="flex min-w-0 flex-col gap-[3px]">
              <div className="mb-0.5 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">
                <span>Seviyeler</span><span>fark</span>
              </div>
              {ladder.map((r, i) => <RungTile key={`${r.tag}${r.price}${i}`} r={r} price={price} />)}
            </div>
          </div>

          {/* alt sıra: özet kutucukları */}
          <div className="grid grid-cols-2 gap-2 px-2 pb-2 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile theme={biasTheme} label="Yön" value={biasWord} sub={biasSub} title={map.biasText} />
            {hasFc ? (
              <StatTile
                theme={fc!.dir > 0 ? "up" : "down"}
                label="Ana senaryo"
                value={<>{fc!.dir > 0 ? "▲" : "▼"} {f2(fc!.target as number)}</>}
                sub={<>{shortLbl(fc!.targetLabel)}{tHit ? ` · değme %${tHit}` : ""}</>}
                title={fc!.rule ? FC_RULES[fc!.rule].label : undefined}
              />
            ) : odds ? (
              // 30 dk senaryosu yokken grafik iki yol çizer (en yakın üst/alt seviye) — kutucuklar aynı yolları yazar
              <StatTile theme="up" label="Yukarı yol" value={<>▲ {f2(odds.up.price)}</>} sub={`${shortLbl(odds.up.keys[0] ?? "")} · %${odds.upPct}`} title="mesafeye göre olasılık, yön tahmini değil" />
            ) : (
              <StatTile theme="info" label="Ana senaryo" value="YOK" sub="ölçülmüş kenar yok" title={fc?.text || undefined} />
            )}
            {hasFc ? (
              <StatTile
                theme="info"
                label="İptal"
                value={<>5m {fc!.dir > 0 ? "<" : ">"} {f2(fc!.invalid as number)}</>}
                sub={`${shortLbl(fc!.invalidLabel)} ${fc!.dir > 0 ? "altı" : "üstü"} kapanış`}
              />
            ) : odds ? (
              <StatTile theme="down" label="Aşağı yol" value={<>▼ {f2(odds.down.price)}</>} sub={`${shortLbl(odds.down.keys[0] ?? "")} · %${odds.downPct}`} title="mesafeye göre olasılık, yön tahmini değil" />
            ) : (
              <StatTile theme="info" label="İptal" value="—" sub="senaryo yok" />
            )}
            {!hasFc && vwapGap != null ? (
              <StatTile
                theme={vwapGap > 0 ? "up" : vwapGap < 0 ? "down" : "info"}
                label="VWAP'a göre"
                value={sgn(vwapGap)}
                sub={vwapGap > 0 ? "fiyat VWAP üstünde" : vwapGap < 0 ? "fiyat VWAP altında" : "VWAP üzerinde"}
              />
            ) : odds ? (
              <StatTile
                theme="info"
                label="Önce hangi seviye"
                value={<><span className="text-emerald-300">▲%{odds.upPct}</span> <span className="text-slate-500">·</span> <span className="text-rose-300">▼%{odds.downPct}</span></>}
                sub={`${f2(odds.up.price)} / ${f2(odds.down.price)} · mesafe, yön değil`}
              />
            ) : (
              <StatTile theme="info" label="Önce hangi seviye" value="—" sub="seviye bekleniyor" />
            )}
            <StatTile
              theme="info"
              label="Gün sonu bandı"
              value={`${f2(map.closeLow)}–${f2(map.closeHigh)}`}
              sub={accPct != null ? `isabet %${accPct} · ${accuracy!.checked} ölçüm` : "20 seans dağılımı"}
            />
          </div>

          {/* eski açıklamalar — silinmedi, ayrıntıda */}
          <div className="border-t border-[#1f2a3a] bg-[#0b111b]">
            <button
              type="button"
              onClick={() => setDetail((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500 hover:text-slate-300"
            >
              <span>Plan ayrıntısı</span><span>{detail ? "▴ gizle" : "▾ göster"}</span>
            </button>
            {detail && (
              <div className="grid grid-cols-1 gap-2 px-3 pb-2 lg:grid-cols-2">
                <div className="text-[11px] leading-snug text-slate-300">
                  <div className={`mb-0.5 font-semibold ${THEME[biasTheme].fg}`}>{map.biasText}</div>
                  {fc && !hasFc && fc.text && <div className="text-amber-300/90">{fc.text.replace(/^30 dk: /, "")}</div>}
                  <ol className="mt-1 flex list-decimal flex-col gap-0.5 pl-4 text-slate-400 marker:text-slate-600">
                    {map.steps.filter((x) => !x.startsWith("Gün sonu")).map((x, i) => <li key={i}>{x}</li>)}
                  </ol>
                </div>
                <ul className="flex flex-col gap-0.5 text-[11px] leading-snug text-slate-500">
                  {map.alt.map((a, i) => <li key={i}>⚠ {a}</li>)}
                  <li className="mt-0.5">Bu bir TAHMİNDİR; seviyeler ölçülmüş veriden. Gün sonu bandı 20 seanslık dağılımdan.</li>
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
