"use client";

/**
 * SPY Engine — Tahmin sekmeleri:
 *   1) Günlük tahmin: 10:00'da dondurulan yol (orta çizgi + %20–%80 bandı) ve GERÇEKLEŞEN ayrı çizgide;
 *      kapanış tahminleri (10:00 / 12:00 / 14:00 / 15:00) 16:00 hizasında.
 *   2) 1 saatlik tahmin: son tam saatte dondurulan sonraki 60 dk yolu + gerçekleşen.
 *   3) Mevcut tahmin haritası (children) — aynen korunur.
 * Model arşivden öğrenir (forecastModel.ts); her yeni seans günlüğe eklenince güncellenir.
 */

import { useMemo, useState, type ReactNode } from "react";
import { nyClock, nyDateTimeToEpoch, nyParts, type Bar } from "@/lib/spyengine/core";
import {
  DAY_POINTS, CLOSE_CHECKS, HOUR_STARTS, makeLog, pathOf,
  type ForecastModel, type ForecastStats, type PathFacts,
} from "@/lib/spyengine/forecastModel";

const W = 920, H = 300, PAD = { l: 8, r: 70, t: 18, b: 22 };
const num = (x: number) => x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Pt { t: number; mid: number; lo: number; hi: number }

function PathChart({ bars, fc, t0, t1, nowSec, marks, title }: {
  bars: Bar[];
  fc: Pt[];
  t0: number;
  t1: number;
  nowSec: number;
  marks?: { t: number; lo: number; hi: number; mid: number; label: string }[];
  title: string;
}) {
  const g = useMemo(() => {
    const real = bars.filter((b) => b.time + 300 > t0 && b.time < t1).map((b) => ({ t: b.time + 300, p: b.close }));
    const ys = [...real.map((r) => r.p), ...fc.flatMap((f) => [f.lo, f.hi]), ...(marks ?? []).flatMap((m) => [m.lo, m.hi])];
    if (!ys.length) return null;
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const padY = Math.max(0.3, (hi - lo) * 0.08);
    lo -= padY; hi += padY;
    const X = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
    const Y = (p: number) => PAD.t + ((hi - p) / (hi - lo)) * (H - PAD.t - PAD.b);
    const ticks: number[] = [];
    const step = (t1 - t0) > 4 * 3600 ? 3600 : 900;
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t);
    const yt: number[] = [];
    const ys2 = (hi - lo) / 5;
    for (let k = 0; k <= 5; k++) yt.push(lo + k * ys2);
    return { real, X, Y, ticks, yt };
  }, [bars, fc, t0, t1, marks]);
  if (!g) return <div className="px-3 py-8 text-center text-[12px] text-slate-500">Veri bekleniyor.</div>;
  const { real, X, Y, ticks, yt } = g;
  const band = fc.length ? `M ${fc.map((f) => `${X(f.t)},${Y(f.hi)}`).join(" L ")} L ${[...fc].reverse().map((f) => `${X(f.t)},${Y(f.lo)}`).join(" L ")} Z` : "";
  const mid = fc.length ? `M ${fc.map((f) => `${X(f.t)},${Y(f.mid)}`).join(" L ")}` : "";
  const realP = real.length ? `M ${real.map((r) => `${X(r.t)},${Y(r.p)}`).join(" L ")}` : "";
  const nowX = nowSec > t0 && nowSec < t1 ? X(nowSec) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
      {yt.map((y, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(y)} y2={Y(y)} stroke="#1c2635" strokeWidth={1} />
          <text x={W - PAD.r + 6} y={Y(y) + 4} fontSize={11} fill="#64748b" fontFamily="monospace">{y.toFixed(2)}</text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} x={X(t)} y={H - 6} fontSize={11} fill="#64748b" textAnchor="middle" fontFamily="monospace">{nyClock(t)}</text>
      ))}
      {band && <path d={band} fill="#f59e0b" fillOpacity={0.12} stroke="#f59e0b" strokeOpacity={0.35} strokeWidth={1} />}
      {mid && <path d={mid} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" />}
      {realP && <path d={realP} fill="none" stroke="#e2e8f0" strokeWidth={2} />}
      {fc.length > 0 && <circle cx={X(fc[0].t)} cy={Y(fc[0].mid)} r={4} fill="#f59e0b" />}
      {(marks ?? []).map((m, i) => (
        <g key={i}>
          <line x1={X(m.t) + (i - 1.5) * 9} x2={X(m.t) + (i - 1.5) * 9} y1={Y(m.hi)} y2={Y(m.lo)} stroke="#38bdf8" strokeWidth={3} strokeOpacity={0.55} />
          <circle cx={X(m.t) + (i - 1.5) * 9} cy={Y(m.mid)} r={3} fill="#38bdf8" />
        </g>
      ))}
      {nowX != null && <line x1={nowX} x2={nowX} y1={PAD.t} y2={H - PAD.b} stroke="#475569" strokeDasharray="3 3" />}
      {real.length > 0 && (
        <text x={X(real[real.length - 1].t) + 6} y={Y(real[real.length - 1].p) - 6} fontSize={12} fill="#e2e8f0" fontFamily="monospace">{real[real.length - 1].p.toFixed(2)}</text>
      )}
    </svg>
  );
}

function Legend({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1 text-[11px] text-slate-400">{children}</div>;
}
const Sw = ({ c, dash, label }: { c: string; dash?: boolean; label: string }) => (
  <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-5 border-t-2" style={{ borderColor: c, borderStyle: dash ? "dashed" : "solid" }} />{label}</span>
);

export default function ForecastTabs({ bars, date, nowSec, model, fstats, facts, mapTab, initialTab = 0 }: {
  /** Bugünün RTH 5m mumları (oluşan dahil) */
  bars: Bar[];
  date: string;
  nowSec: number;
  model: ForecastModel | null;
  fstats: ForecastStats | null;
  /** Bugünün (kısmi) ham gerçekleri — factsOf(...) */
  facts: PathFacts | null;
  /** Mevcut tahmin haritası */
  mapTab: ReactNode;
  initialTab?: 0 | 1 | 2;
}) {
  const [tab, setTab] = useState<0 | 1 | 2>(initialTab);
  const log = useMemo(() => (model && facts ? makeLog(model, facts) : null), [model, facts]);
  const t = (m: number) => nyDateTimeToEpoch(date, m);

  // — günlük —
  const dayPts: Pt[] = log?.day ? log.day.map((d, k) => ({ t: t(DAY_POINTS[k]), ...d })) : [];
  const closeMarks = (log?.close ?? []).map((c) => ({ t: t(960), lo: c.lo, hi: c.hi, mid: c.mid, label: `${Math.floor(c.at / 60)}:${String(c.at % 60).padStart(2, "0")}` }));
  const lastClose = log?.close.length ? log.close[log.close.length - 1] : null;

  // — saatlik: son tam saat —
  const nowMin = nowSec ? nyParts(nowSec).minutes : 0;
  const curH = [...HOUR_STARTS].reverse().find((h) => h <= nowMin) ?? null;
  const hf = curH != null ? facts?.hours.find((x) => x.h === curH) ?? null : null;
  const hourPts: Pt[] = useMemo(() => {
    if (!model || !hf) return [];
    const grp = hf.cls === "MIX" ? "MIX" : "ALIGNED";
    const dir = hf.cls === "UP" ? 1 : hf.cls === "DOWN" ? -1 : 0;
    const ds = model.hour[grp];
    // ilk nokta: saat başı fiyatı (sıfır hareket) — orta çizgi tek karar (pathOf)
    const pts = pathOf([{ n: 0, mean: 0, lo: 0, hi: 0, sig: false }, ...ds], hf.p0, dir);
    return pts.map((p, s) => ({ t: t(hf.h + 5 * s), ...p }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, hf, date]);
  const hourEnd = hourPts.length ? hourPts[hourPts.length - 1] : null;
  const hourLogs = log?.hours ?? [];

  const tabs = ["Günlük tahmin", "1 saatlik tahmin", "Tahmin haritası"] as const;
  const fsC = fstats?.close ?? {};
  return (
    <div className="overflow-hidden rounded-lg border border-[#1c2635] bg-[#0f141d]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1c2635] px-2 py-1.5">
        {tabs.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i as 0 | 1 | 2)}
            className={`rounded px-3 py-1 text-[12px] font-semibold ${tab === i ? "bg-[#1c2635] text-slate-100" : "text-slate-400 hover:bg-[#151c28]"}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">
          model: {model ? `${model.n} arşiv günü` : "yükleniyor"} · her seans sonunda günlüğe eklenir, model güncellenir
        </span>
      </div>

      {tab === 0 && (
        <>
          {!log?.day ? (
            <div className="px-4 py-6 text-[12px] text-slate-400">
              Günlük tahmin yolu 10:00 kapanışında dondurulur (açılış kararı sınıfı + 10:00 fiyatı). {model ? "" : "Model yükleniyor."}
            </div>
          ) : (
            <>
              <PathChart bars={bars} fc={dayPts} t0={t(570)} t1={t(965)} nowSec={nowSec} marks={closeMarks} title="Günlük tahmin" />
              <Legend>
                <Sw c="#f59e0b" dash label="10:00 tahmini (orta)" />
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-sm bg-[#f59e0b]/25" />%20–%80 bant (~%60 kapsama)</span>
                <Sw c="#e2e8f0" label="gerçekleşen" />
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-1 rounded bg-[#38bdf8]" />kapanış tahminleri (10/12/14/15)</span>
              </Legend>
            </>
          )}
          <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2">
            <div className="bg-[#0f141d] px-3 py-2 text-[12px] text-slate-300">
              <div className="mb-1 text-[11px] font-semibold text-slate-400">Bugünün kapanış tahminleri</div>
              {(log?.close ?? []).length === 0 && <div className="text-slate-500">10:00&apos;dan itibaren 10:00 / 12:00 / 14:00 / 15:00&apos;te kaydedilir.</div>}
              {(log?.close ?? []).map((c) => (
                <div key={c.at} className="flex justify-between font-mono text-[12px]">
                  <span>{Math.floor(c.at / 60)}:{String(c.at % 60).padStart(2, "0")} · fiyat {num(c.price)}</span>
                  <span className="text-sky-300">kapanış ≈ {num(c.mid)} <span className="text-slate-400">({num(c.lo)} – {num(c.hi)})</span></span>
                </div>
              ))}
              {lastClose && (
                <div className="mt-1 text-[11px] text-slate-500">
                  Orta çizgi yalnız geçmişte ANLAMLI bir sürüklenme varsa kayar; yoksa &quot;şimdiki fiyat&quot; en iyi tahmindir (walk-forward ölçümünde yönlü orta çizgi hatayı büyütüyordu). Değer bantta.
                </div>
              )}
            </div>
            <div className="bg-[#0f141d] px-3 py-2 text-[12px] text-slate-300">
              <div className="mb-1 text-[11px] font-semibold text-slate-400">Arşivde tutarlılık (walk-forward: her gün yalnız önceki günlerle)</div>
              {fstats && fstats.day.n > 0 ? (
                <>
                  <div className="font-mono text-[12px]">Günlük yol 16:00 · bant içi %{fstats.day.inBand} · ort. hata {num(fstats.day.mae)} <span className="text-slate-500">(n={fstats.day.n})</span></div>
                  {CLOSE_CHECKS.map((m) => {
                    const k = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
                    const v = fsC[k];
                    return v ? (
                      <div key={k} className="font-mono text-[12px]">
                        kapanış @{k} · bant içi %{v.inBand} · hata {num(v.mae)} <span className="text-slate-500">(şimdiki fiyat {num(v.naiveMae)})</span>{v.dirHit != null ? ` · yön %${v.dirHit}` : ""}
                      </div>
                    ) : null;
                  })}
                </>
              ) : <div className="text-slate-500">Arşiv tahmin kaydı birikiyor (ilk 10 günden sonra başlar).</div>}
            </div>
          </div>
        </>
      )}

      {tab === 1 && (
        <>
          {!hf || !hourPts.length ? (
            <div className="px-4 py-6 text-[12px] text-slate-400">Saatlik tahmin her tam saatte (10:00–15:00) dondurulur: 5m + 15m kapanışın VWAP/EMA20 hizasına göre sonraki 60 dk.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 pt-2 text-[12px]">
                <b className="text-slate-200">{Math.floor(hf.h / 60)}:{String(hf.h % 60).padStart(2, "0")} → {Math.floor((hf.h + 60) / 60)}:{String((hf.h + 60) % 60).padStart(2, "0")}</b>
                <span className={hf.cls === "UP" ? "text-[#4ade80]" : hf.cls === "DOWN" ? "text-[#f87171]" : "text-amber-300"}>
                  hiza: {hf.cls === "UP" ? "5m + 15m VWAP/EMA20 üstünde" : hf.cls === "DOWN" ? "5m + 15m VWAP/EMA20 altında" : "karışık"}
                </span>
                {hourEnd && <span className="font-mono text-slate-300">+60 dk ≈ {num(hourEnd.mid)} <span className="text-slate-500">({num(hourEnd.lo)} – {num(hourEnd.hi)})</span></span>}
              </div>
              <PathChart bars={bars} fc={hourPts} t0={t(hf.h) - 300} t1={t(hf.h + 60) + 60} nowSec={nowSec} title="1 saatlik tahmin" />
              <Legend>
                <Sw c="#f59e0b" dash label={`${Math.floor(hf.h / 60)}:${String(hf.h % 60).padStart(2, "0")} tahmini`} />
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-sm bg-[#f59e0b]/25" />%20–%80 bant</span>
                <Sw c="#e2e8f0" label="gerçekleşen" />
              </Legend>
            </>
          )}
          <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2">
            <div className="bg-[#0f141d] px-3 py-2 text-[12px] text-slate-300">
              <div className="mb-1 text-[11px] font-semibold text-slate-400">Bugünün saatlik tahminleri</div>
              {hourLogs.length === 0 && <div className="text-slate-500">10:00&apos;da başlar.</div>}
              {hourLogs.map((h) => {
                const f = facts?.hours.find((x) => x.h === h.h);
                const done = f && f.next.length === 12 ? f.next[11] : null;
                const inB = done != null ? done >= h.lo && done <= h.hi : null;
                return (
                  <div key={h.h} className="flex justify-between gap-2 font-mono text-[12px]">
                    <span>{Math.floor(h.h / 60)}:00 {h.cls === "UP" ? "▲" : h.cls === "DOWN" ? "▼" : "◆"} {num(h.p0)}</span>
                    <span className="text-slate-400">tahmin {num(h.lo)}–{num(h.hi)}</span>
                    <span className={done == null ? "text-slate-500" : inB ? "text-[#4ade80]" : "text-[#f87171]"}>{done == null ? "sürüyor" : `${num(done)} ${inB ? "✓" : "✕"}`}</span>
                  </div>
                );
              })}
            </div>
            <div className="bg-[#0f141d] px-3 py-2 text-[12px] text-slate-300">
              <div className="mb-1 text-[11px] font-semibold text-slate-400">Arşivde tutarlılık (+60 dk)</div>
              {fstats ? (["UP", "DOWN", "MIX"] as const).map((c) => {
                const v = fstats.hour[c];
                return v && v.n ? (
                  <div key={c} className="font-mono text-[12px]">
                    {c === "UP" ? "▲ hizalı yukarı" : c === "DOWN" ? "▼ hizalı aşağı" : "◆ karışık"} · bant içi %{v.inBand} · hata {num(v.mae)}{v.dirHit != null ? ` · yön %${v.dirHit}` : ""} <span className="text-slate-500">(n={v.n})</span>
                  </div>
                ) : null;
              }) : <div className="text-slate-500">yükleniyor</div>}
              <div className="mt-1 text-[11px] text-slate-500">Hiza, saatlik yönü tek başına anlamlı biçimde öngörmüyor; bant (olası aralık) güvenilir. Yön kararı Karar Desteği ve Senaryo Takibi&apos;nden gelir.</div>
            </div>
          </div>
        </>
      )}

      {tab === 2 && mapTab}
    </div>
  );
}
