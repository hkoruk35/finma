"use client";

/**
 * Geniş Harita (Tahmin Haritası'nın 2. sekmesi). v4 (2026-11-12): sistemin en olası 2 senaryosu (kontrol noktası medyanları, sade)
 * + kullanıcının açılış/10:30/12:00/14:00/kapanış tahminleri — "Hesapla" ile simülasyon bu noktalardan geçecek şekilde köprülenir.
 * Mumlar + hacim + tarihli/rolü doğru pivotlar + Monte Carlo koni, medoid yol ve soluk örnek yollar (lib/spyengine/wideForecast.ts).
 * Her 4h kapanışında tahmin yeniden kurulur ve kaydedilir; kayıtlar gerçekleşenle ölçülür (kapsama + Brier, mesafe-oranı baseline'ına karşı).
 * Kayıt bu tarayıcıda (localStorage) tutulur. Bu bir TAHMİNDİR; işlem kararı yalnız Takip Sistemi tetiğiyle verilir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { nyParts, type Bar } from "@/lib/spyengine/core";
import type { Htf4hRead } from "@/lib/spyengine/htf4h";
import {
  buildWideForecast, evaluateSnapshots, toSnapshot, trDate, N_PATHS,
  type Snapshot, type UserWp, type WideForecast,
} from "@/lib/spyengine/wideForecast";

type Tf = "15m" | "4h";

/** sembol → örtük oynaklık endeksi (yalnız endeks ETF'leri; hisselerde yok) */
const IV_INDEX: Record<string, { sym: string; label: string }> = {
  SPY: { sym: "^VIX", label: "VIX" },
  QQQ: { sym: "^VXN", label: "VXN" },
  IWM: { sym: "^RVX", label: "RVX" },
};

function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(initial);
  useEffect(() => {
    const id = setTimeout(() => {
      try { const raw = localStorage.getItem(key); if (raw != null) setVal(JSON.parse(raw) as T); } catch { /* yok */ }
    }, 0);
    return () => clearTimeout(id);
  }, [key]);
  const set = useCallback((v: T) => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* yok */ } }, [key]);
  return [val, set];
}

const f2 = (v: number) => v.toFixed(2);
const etStamp = (sec: number) =>
  `${new Date(sec * 1000).toLocaleString("tr-TR", { timeZone: "America/New_York", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} ET`;

/** "Bugün/Dün" etiketlerini tarihli yaz; fiyatın üstündeki S / altındaki R seviyelerine rolünü ekle */
function relabel(label: string, price: number, lvl: number, today: string | null, prev: string | null): string {
  let s = label;
  if (today) s = s.replace(/Bugün/g, trDate(today));
  if (prev) s = s.replace(/Dün/g, trDate(prev));
  return s.split(" · ").map((p) => {
    if (/^4h S\d/.test(p) && lvl > price) return `${p} (direnç)`;
    if (/^4h R\d/.test(p) && lvl < price) return `${p} (destek)`;
    return p;
  }).join(" · ");
}

// ── grafik ────────────────────────────────────────────────────────

const W = 1000, H = 400, VH = 64, PAD = { l: 52, r: 186, t: 40, b: 22 };
const MIN_GAP = 11;

function layoutLabels(items: { y: number; prio: number; i: number }[], top: number, bottom: number): Map<number, number> {
  const placed: number[] = [];
  const out = new Map<number, number>();
  for (const it of [...items].sort((a, b) => a.prio - b.prio || a.y - b.y)) {
    let best: number | null = null;
    for (let d = 0; d <= 26 && best == null; d += 1) {
      for (const cand of [it.y + d, it.y - d]) {
        if (cand < top || cand > bottom) continue;
        if (placed.every((p) => Math.abs(p - cand) >= MIN_GAP)) { best = cand; break; }
      }
    }
    if (best == null) continue;
    placed.push(best);
    out.set(it.i, best);
  }
  return out;
}

function niceStep(range: number, target = 9): number {
  const raw = range / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

export function WideChart({ tf, hist, fc, live, levels, histDays, showSys }: {
  tf: Tf; hist: Bar[]; fc: WideForecast; live: number | null;
  levels: { price: number; label: string }[]; histDays: number; showSys: boolean;
}) {
  const start = fc.start;
  const U = fc.user;
  const cone = U ? U.cone : fc.cone;
  const g = useMemo(() => {
    const days = [...new Set(hist.map((b) => nyParts(b.time).ymd))].slice(-histDays);
    const keep = hist.filter((b) => days.includes(nyParts(b.time).ymd));
    const bucketKey = (i: number) => (tf === "15m" ? i : fc.slots[i].day * 2 + (nyParts(fc.slots[i].time).minutes >= 13 * 60 + 30 ? 1 : 0));
    const groups: number[][] = [];
    fc.slots.forEach((_, i) => {
      const last = groups[groups.length - 1];
      if (last && bucketKey(last[0]) === bucketKey(i)) last.push(i); else groups.push([i]);
    });
    const gOf: { j: number; pos: number; len: number }[] = [];
    groups.forEach((gr, j) => gr.forEach((sl, pos) => { gOf[sl] = { j, pos, len: gr.length }; }));
    const nh = keep.length;
    const total = nh + groups.length + 1;
    const X = (idx: number) => PAD.l + (idx / Math.max(1, total - 1)) * (W - PAD.l - PAD.r);
    const vals: number[] = [start];
    if (live != null && live > 0) vals.push(live);
    keep.forEach((b) => vals.push(b.high, b.low));
    fc.slots.forEach((_, s) => vals.push(cone.p10[s], cone.p90[s]));
    if (U) U.wps.forEach((w) => vals.push(w.price));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1; lo -= pad; hi += pad;
    const Y = (p: number) => PAD.t + (1 - (p - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const maxVol = Math.max(1, ...keep.map((b) => b.volume || 0));
    return { keep, groups, gOf, nh, X, Y, lo, hi, maxVol };
  }, [hist, histDays, fc, tf, start, live, cone, U]);

  const { keep, groups, gOf, nh, X, Y, lo, hi, maxVol } = g;
  const bw = Math.max(1.2, (X(1) - X(0)) * 0.62);
  const futX = (j: number) => X(nh + 1 + j);
  const x0 = X(nh - 1);
  /** slotun bitiş noktası x'i (4h'de kova içinde orantılı) */
  const xEnd = (s: number) => { const q = gOf[s]; return futX(q.j - 1 + (q.pos + 1) / q.len); };
  const xOpen = (s: number) => { const q = gOf[s]; return q.j === 0 && q.pos === 0 ? x0 + (futX(0) - x0) * 0.35 : futX(q.j - 1 + q.pos / q.len); };
  const xWp = (w: { t: number; open: boolean }) => {
    const cp = fc.checkpoints.find((c) => c.t === w.t && c.open === w.open);
    return cp ? (cp.open ? xOpen(cp.slot) : xEnd(cp.slot)) : x0;
  };
  const conePts = (arr: number[]) => [`${x0.toFixed(1)},${Y(start).toFixed(1)}`, ...fc.slots.map((_, s) => `${xEnd(s).toFixed(1)},${Y(arr[s]).toFixed(1)}`)].join(" ");
  const band = (a: number[], b: number[]) => [
    `${x0.toFixed(1)},${Y(start).toFixed(1)}`,
    ...fc.slots.map((_, s) => `${xEnd(s).toFixed(1)},${Y(a[s]).toFixed(1)}`),
    ...fc.slots.map((_, s) => `${xEnd(s).toFixed(1)},${Y(b[s]).toFixed(1)}`).reverse(),
  ].join(" ");
  const wpLine = (wp: { t: number; open: boolean; price: number }[]) => [`${x0.toFixed(1)},${Y(start).toFixed(1)}`, ...wp.map((w) => `${xWp(w).toFixed(1)},${Y(w.price).toFixed(1)}`)].join(" ");

  const allDays = [...new Set(hist.map((b) => nyParts(b.time).ymd))];
  const today = allDays[allDays.length - 1] ?? null;
  const prev = allDays[allDays.length - 2] ?? null;

  const seps: { x: number; label: string; future: boolean }[] = [];
  keep.forEach((b, i) => { if (i > 0 && nyParts(b.time).ymd !== nyParts(keep[i - 1].time).ymd) seps.push({ x: X(i - 0.5), label: trDate(nyParts(b.time).ymd), future: false }); });
  groups.forEach((gr, j) => {
    const ymd = nyParts(fc.slots[gr[0]].time).ymd;
    const prevYmd = j === 0 ? today : nyParts(fc.slots[groups[j - 1][0]].time).ymd;
    if (ymd !== prevYmd) seps.push({ x: j === 0 ? X(nh - 0.5) + 2 : futX(j - 1), label: trDate(ymd), future: true });
  });

  // sağ kenar seviye etiketleri (çakışmasız)
  type L = { price: number; text: string; color: string; prio: number; width: number; opacity: number };
  const lbls: L[] = [];
  const short = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);
  for (const l of levels) {
    if (!(l.price > lo && l.price < hi)) continue;
    const key = Math.abs(l.price - fc.u1.price) < 0.01 || Math.abs(l.price - fc.d1.price) < 0.01;
    lbls.push({
      price: l.price, text: `${f2(l.price)} ${short(relabel(l.label, start, l.price, today, prev))}`,
      color: l.price > start ? "#f87171" : "#4ade80", prio: key ? 0 : 1, width: key ? 0.9 : 0.5, opacity: key ? 0.7 : 0.3,
    });
  }
  const labelY = layoutLabels(lbls.map((l, i) => ({ y: Y(l.price), prio: l.prio, i })), PAD.t + 4, H - PAD.b - 2);
  const plotR = W - PAD.r;
  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) ticks.push(p);

  // nokta etiketleri: kullanıcı modunda her nokta; sistem modunda yalnız gün kapanışları (yukarı senaryo üstte, aşağı altta)
  // etiket kutuları çakışmasın: önce tercih edilen taraf, sonra diğeri; ikisi de doluysa yalnız nokta çizilir (fiyat tabloda)
  const placed: { x: number; y: number }[] = [{ x: x0, y: Y(start) - 12 }];
  const dotLabel = (x: number, y: number, txt: string, color: string, above: boolean, key: string) => {
    const cands = above ? [y - 17, y + 5] : [y + 5, y - 17];
    const top = cands.find((ty) => ty > PAD.t - 2 && ty + 11 < H - PAD.b && placed.every((q) => Math.abs(q.x - x) >= 40 || Math.abs(q.y - ty) >= 12));
    if (top != null) placed.push({ x, y: top });
    return (
      <g key={key}>
        <circle cx={x} cy={y} r={3} fill={color} stroke="#0a0e17" strokeWidth={1} />
        {top != null && (
          <>
            <rect x={x - 19} y={top} width={38} height={11} rx={2} fill="#0a0e17" opacity={0.85} />
            <text x={x} y={top + 8.5} fontSize={8.5} fontWeight={700} fill={color} textAnchor="middle" fontFamily="monospace">{txt}</text>
          </>
        )}
      </g>
    );
  };
  const sysShown = !U || showSys;
  const closeOnly = (wp: { t: number; open: boolean; price: number }[]) => wp.filter((w) => fc.checkpoints.find((c) => c.t === w.t && c.open === w.open)?.label === "Kapanış");

  return (
    <svg viewBox={`0 0 ${W} ${H + VH}`} className="h-auto w-full" role="img" aria-label="Geniş harita">
      <rect x={0} y={0} width={W} height={H + VH} fill="#0a0e17" />
      <rect x={X(nh - 0.5)} y={PAD.t} width={plotR - X(nh - 0.5)} height={H - PAD.t - PAD.b} fill="#1e293b" opacity={0.22} />
      {ticks.map((p, k) => (
        <g key={k}>
          <line x1={PAD.l} x2={plotR} y1={Y(p)} y2={Y(p)} stroke="#131b28" strokeWidth={0.6} />
          <text x={PAD.l - 4} y={Y(p) + 3} fontSize={9} fill="#64748b" textAnchor="end" fontFamily="monospace">{p.toFixed(step < 1 ? 2 : step < 10 ? 1 : 0)}</text>
        </g>
      ))}
      {keep.length > 0 && <text x={X(0)} y={H - 6} fontSize={9} fill="#64748b" fontFamily="monospace">{trDate(nyParts(keep[0].time).ymd)}</text>}
      {seps.map((s, i) => (
        <g key={i}>
          <line x1={s.x} x2={s.x} y1={PAD.t} y2={H + VH - 4} stroke={s.future ? "#334155" : "#1e293b"} strokeWidth={0.8} strokeDasharray="3 3" />
          <text x={s.x + 3} y={H - 6} fontSize={9} fill={s.future ? "#cbd5e1" : "#64748b"} fontWeight={s.future ? 700 : 400} fontFamily="monospace">{s.label}</text>
        </g>
      ))}
      {lbls.map((l, i) => {
        const y = Y(l.price);
        const ly = labelY.get(i);
        return (
          <g key={`l${i}`}>
            <line x1={PAD.l} x2={plotR} y1={y} y2={y} stroke={l.color} strokeWidth={l.width} strokeDasharray="4 4" opacity={ly == null ? l.opacity * 0.5 : l.opacity} />
            {ly != null && (
              <>
                {Math.abs(ly - y) > 1 && <line x1={plotR} x2={plotR + 6} y1={y} y2={ly} stroke={l.color} strokeWidth={0.6} opacity={0.7} />}
                <text x={plotR + 8} y={ly + 3} fontSize={8.5} fontWeight={l.prio === 0 ? 700 : 400} fill={l.color} fontFamily="monospace">{l.text}</text>
              </>
            )}
          </g>
        );
      })}
      {keep.map((b, i) => {
        const up = b.close >= b.open;
        const c = up ? "#22c55e" : "#ef4444";
        const x = X(i);
        const vh = ((b.volume || 0) / maxVol) * (VH - 12);
        return (
          <g key={b.time}>
            <line x1={x} x2={x} y1={Y(b.high)} y2={Y(b.low)} stroke={c} strokeWidth={0.8} />
            <rect x={x - bw / 2} y={Math.min(Y(b.open), Y(b.close))} width={bw} height={Math.max(1, Math.abs(Y(b.open) - Y(b.close)))} fill={c} />
            <rect x={x - bw / 2} y={H + VH - 4 - vh} width={bw} height={vh} fill={c} opacity={0.4} />
          </g>
        );
      })}
      {/* koni: kullanıcı senaryosu varsa onun etrafında, yoksa genel */}
      <polygon points={band(cone.p90, cone.p10)} fill={U ? "#3b82f6" : "#94a3b8"} opacity={U ? 0.08 : 0.07} />
      <polygon points={band(cone.p75, cone.p25)} fill={U ? "#3b82f6" : "#94a3b8"} opacity={U ? 0.13 : 0.11} />
      {!U && <polyline points={conePts(cone.p50)} fill="none" stroke="#64748b" strokeWidth={0.9} strokeDasharray="2 3" />}
      {/* sistemin iki senaryosu: kontrol noktası medyanları, düz parçalı */}
      {sysShown && [fc.down, fc.up].map((c) => c.wp.length > 0 && (
        <g key={c.key} opacity={U ? 0.45 : 1}>
          <polyline points={wpLine(c.wp)} fill="none" stroke={c.key === "up" ? "#4ade80" : "#f87171"} strokeWidth={U ? 1.2 : 1.9} strokeDasharray={U ? "5 4" : ""} />
          {!U && closeOnly(c.wp).map((w, k) => dotLabel(xWp(w), Y(w.price), f2(w.price), c.key === "up" ? "#4ade80" : "#f87171", c.key === "up", `${c.key}${k}`))}
        </g>
      ))}
      {/* kullanıcı senaryosu */}
      {U && (
        <g>
          <polyline points={wpLine(U.wps)} fill="none" stroke="#60a5fa" strokeWidth={2.2} />
          {U.wps.map((w, k) => dotLabel(xWp(w), Y(w.price), f2(w.price), w.verdict === "olası" ? "#93c5fd" : w.verdict === "zayıf olasılık" ? "#fbbf24" : "#f87171", k % 2 === 0, `u${k}`))}
        </g>
      )}
      <line x1={x0} x2={x0} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" strokeWidth={0.8} strokeDasharray="2 3" />
      <circle cx={x0} cy={Y(start)} r={3.5} fill="#3b82f6" stroke="#fff" strokeWidth={1.2} />
      {!fc.inRth && live != null && live > 0 && Math.abs(live - start) > 0.005 && (
        <g>
          <circle cx={x0 - 6} cy={Y(live)} r={3} fill="none" stroke="#e3b341" strokeWidth={1.2} />
          <text x={x0 - 12} y={Y(live) + 3} fontSize={8.5} fill="#e3b341" textAnchor="end" fontFamily="monospace">seans dışı {f2(live)}</text>
        </g>
      )}
      <g fontSize={9.5} fontFamily="monospace">
        <text x={PAD.l} y={13} fill="#94a3b8">geçmiş {histDays} gün · {tf}</text>
        <text x={x0} y={13} fill="#e2e8f0" textAnchor="middle">{fc.inRth ? "şimdi" : "son RTH kapanışı"} {f2(start)}</text>
        {U ? (
          <text x={PAD.l} y={28}>
            <tspan fill="#60a5fa" fontWeight={700}>━ Senin senaryon</tspan>
            <tspan fill="#94a3b8"> · mavi alan: senaryon etrafındaki olası sapma (%25–75 koyu, %10–90 açık) · nokta rengi: </tspan>
            <tspan fill="#93c5fd">olası</tspan><tspan fill="#94a3b8"> / </tspan><tspan fill="#fbbf24">zayıf</tspan><tspan fill="#94a3b8"> / </tspan><tspan fill="#f87171">çok düşük</tspan>
          </text>
        ) : (
          <text x={PAD.l} y={28}>
            <tspan fill="#4ade80" fontWeight={700}>━ Senaryo 1: önce ▲ {f2(fc.u1.price)} %{fc.up.pct}</tspan>
            <tspan fill="#64748b">   </tspan>
            <tspan fill="#f87171" fontWeight={700}>━ Senaryo 2: önce ▼ {f2(fc.d1.price)} %{fc.down.pct}</tspan>
            <tspan fill="#64748b">   · gün kapanış fiyatları noktalarda · gri alan %25–75 / %10–90</tspan>
          </text>
        )}
      </g>
      <text x={PAD.l} y={H + 10} fontSize={8.5} fill="#64748b" fontFamily="monospace">hacim</text>
    </svg>
  );
}

// ── panel ─────────────────────────────────────────────────────────

export default function WideForecast({ symbol, price, t, bars15, bars4h, levels, read4h }: {
  symbol: string;
  price: number | null;
  t: number;
  bars15: Bar[];
  bars4h: Bar[];
  levels: { price: number; label: string }[];
  read4h: Htf4hRead | null;
}) {
  const [tf, setTf] = useLocal<Tf>(`wide_tf_${symbol}`, "15m");
  const [histDays, setHistDays] = useLocal<number>(`wide_hist_${symbol}`, 2);
  const [snaps, setSnaps] = useLocal<Snapshot[]>(`wide_snaps_${symbol}`, []);
  const [tick, setTick] = useState(0);
  const [applied, setApplied] = useLocal<Record<string, string>>(`wide_uwp_${symbol}`, {});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [showSys, setShowSys] = useLocal<boolean>(`wide_showsys_${symbol}`, false);
  useEffect(() => { setDraft(applied); }, [applied]);
  const userWps: UserWp[] = useMemo(() => Object.entries(applied).flatMap(([k, v]) => {
    const price = parseFloat(String(v).replace(",", "."));
    const [ts, kind] = k.split("|");
    return Number.isFinite(price) && price > 0 ? [{ t: Number(ts), open: kind === "o", price }] : [];
  }), [applied]);
  const userKey = JSON.stringify(userWps);
  const [iv, setIv] = useState<{ v: number; label: string } | null>(null);

  // örtük oynaklık (yalnız endeks ETF'leri): 5 dk'da bir
  useEffect(() => {
    const ix = IV_INDEX[symbol];
    if (!ix) return;
    let dead = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/admin/spyengine/v2/quotes?symbols=${encodeURIComponent(ix.sym)}`, { credentials: "include", cache: "no-store" });
        const j = await r.json();
        const q = j?.quotes?.[0];
        if (!dead && q?.price > 0) setIv({ v: q.price / 100, label: ix.label });
      } catch { /* IV yoksa gerçekleşen oynaklık kullanılır */ }
    };
    void load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { dead = true; clearInterval(id); };
  }, [symbol]);

  const basis4h = read4h?.last?.time ?? null;
  const ivKey = iv ? Math.round(iv.v * 100) : 0;
  const hasBars = bars15.length > 0;
  const fc = useMemo<WideForecast | null>(() => {
    if (!t || !hasBars) return null;
    return buildWideForecast({ symbol, livePrice: price ?? 0, t, bars15, levels, ivAnnual: iv?.v ?? null, ivLabel: iv?.label ?? null, basis4h, userWps });
    // tahmin yalnız 4h kapanışında, IV değişince (tam puan) veya elle güncellenince kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, basis4h, ivKey, tick, hasBars, userKey]);

  // her 4h kapanışında (ve elle) kayıt
  useEffect(() => {
    if (!fc) return;
    const last = snaps[0];
    if (last && last.basis4h === fc.basis4h && !tick) return;
    const s = toSnapshot(fc, tick > 0);
    setSnaps([s, ...snaps.filter((e) => !(e.basis4h === s.basis4h && !e.manual))].slice(0, 200));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc?.basis4h, tick]);

  const cal = useMemo(() => evaluateSnapshots(snaps, bars15), [snaps, bars15]);
  const hist = tf === "15m" ? bars15 : bars4h;
  const allDays = [...new Set(bars15.map((b) => nyParts(b.time).ymd))];
  const today = allDays[allDays.length - 1] ?? null, prev = allDays[allDays.length - 2] ?? null;

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["15m", "4h"] as Tf[]).map((x) => (
            <button key={x} type="button" onClick={() => setTf(x)} className={`rounded border px-2.5 py-0.5 font-mono text-[11px] font-bold ${tf === x ? "border-blue-400 bg-blue-500/20 text-blue-200" : "border-slate-600/60 bg-slate-500/10 text-slate-300 hover:text-white"}`}>{x}</button>
          ))}
          <span className="ml-2 font-mono text-[10.5px] text-slate-500">geçmiş</span>
          {[2, 5, 10].map((d) => (
            <button key={d} type="button" onClick={() => setHistDays(d)} className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${histDays === d ? "border-slate-300 bg-slate-400/20 text-white" : "border-slate-600/60 bg-slate-500/10 text-slate-400 hover:text-white"}`}>{d} gün</button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10.5px] text-slate-400">
          {fc && <span>Güncelleme: <b className="text-slate-100">{etStamp(fc.generatedAt)}</b>{fc.basis4h ? <> · dayanak: son kapanmış 4h mum ({etStamp(fc.basis4h)} açılışlı)</> : null}</span>}
          <button type="button" onClick={() => setTick((n) => n + 1)} className="rounded border border-slate-600/70 bg-[#111827] px-2 py-0.5 font-semibold text-slate-200 hover:border-blue-400 hover:text-white">↻ Şimdi güncelle</button>
        </div>
      </div>

      {!fc ? (
        <div className="rounded border border-[#1a2433] px-3 py-10 text-center text-[12px] text-slate-500">Geniş harita için yeterli 15m geçmişi bekleniyor (en az ~3 seans).</div>
      ) : (
        <>
          <div className="rounded border border-slate-600/40 bg-slate-500/[0.05] px-3 py-1 text-[11px] text-slate-300">{fc.startNote}</div>
          <div className="overflow-hidden rounded border border-[#1a2433]">
            <WideChart tf={tf} hist={hist} fc={fc} live={price} levels={levels} histDays={histDays} showSys={showSys} />
          </div>
          {/* senin senaryon: kontrol noktası tahminleri */}
          <div className="rounded border border-blue-400/40 bg-blue-500/[0.05] px-3 py-2">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-blue-300">Senin senaryon</span>
              <span className="text-[10.5px] text-slate-500">Tahmin ettiğin fiyatları yaz (boş bırakılabilir) → Hesapla: sistem bu noktalardan geçen yolları simüle eder. Soluk sayılar sistemin medyanı.</span>
            </div>
            {(() => {
              const byDay = [...new Set(fc.checkpoints.map((c) => c.ymd))];
              const rows = ["Açılış", "10:30", "12:00", "14:00", "Kapanış"];
              return (
                <div className="overflow-x-auto">
                  <table className="font-mono text-[11px]">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="px-1.5 py-1 text-left font-normal" />
                        {byDay.map((d) => <th key={d} className="px-1.5 py-1 text-left font-bold text-slate-200">{trDate(d)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r}>
                          <td className="px-1.5 py-0.5 text-slate-400">{r}</td>
                          {byDay.map((d) => {
                            const cp = fc.checkpoints.find((c) => c.ymd === d && c.label === r);
                            if (!cp) return <td key={d} className="px-1.5 py-0.5 text-slate-600">—</td>;
                            const key = `${cp.t}|${cp.open ? "o" : "c"}`;
                            const med = cp.open ? null : fc.cone.p50[cp.slot];
                            return (
                              <td key={d} className="px-1.5 py-0.5">
                                <input
                                  className="w-[86px] rounded border border-slate-600/60 bg-[#0b111b] px-1.5 py-0.5 text-[12px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-400"
                                  inputMode="decimal" value={draft[key] ?? ""} placeholder={med != null ? f2(med) : ""}
                                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                                  onKeyDown={(e) => { if (e.key === "Enter") setApplied(draft); }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setApplied(draft)} className="rounded border border-blue-400 bg-blue-500/25 px-3 py-1 text-[12px] font-bold text-blue-100 hover:bg-blue-500/40">Hesapla</button>
              <button type="button" onClick={() => { setDraft({}); setApplied({}); }} className="rounded border border-slate-600/60 px-3 py-1 text-[12px] text-slate-400 hover:text-white">Temizle</button>
              {fc.user && (
                <label className="ml-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <input type="checkbox" checked={showSys} onChange={(e) => setShowSys(e.target.checked)} /> sistemin 2 senaryosunu da göster
                </label>
              )}
            </div>
            {fc.user && (
              <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="overflow-x-auto rounded bg-[#0a0e17]">
                  <table className="w-full font-mono text-[11px]">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="px-2 py-1 text-left font-normal">Nokta</th>
                        <th className="px-2 py-1 text-right font-normal">Senin</th>
                        <th className="px-2 py-1 text-right font-normal">Model %10–90</th>
                        <th className="px-2 py-1 text-right font-normal">Dilim</th>
                        <th className="px-2 py-1 text-left font-normal">Değerlendirme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fc.user.wps.map((w, i) => (
                        <tr key={i} className="border-t border-[#1c2635]/60">
                          <td className="px-2 py-0.5 text-slate-300">{w.label}</td>
                          <td className="px-2 py-0.5 text-right font-bold text-blue-200">{f2(w.price)}</td>
                          <td className="px-2 py-0.5 text-right text-slate-400">{f2(w.p10)}–{f2(w.p90)}</td>
                          <td className="px-2 py-0.5 text-right text-slate-400">%{w.pctile}</td>
                          <td className={`px-2 py-0.5 ${w.verdict === "olası" ? "text-blue-300" : w.verdict === "zayıf olasılık" ? "text-amber-300" : "text-rose-300"}`}>{w.verdict}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="flex flex-col gap-1 text-[11.5px] leading-snug text-slate-300">
                  {fc.user.lines.map((l, i) => <li key={i}>• {l}</li>)}
                  <li className="text-slate-500">• Dilim: senin fiyatının, modelin o andaki dağılımında kaldığı yüzdelik (%50 = medyan). %10–90 dışı = zayıf, %5–95 dışı = çok düşük olasılık.</li>
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded border border-emerald-500/50 bg-emerald-500/[0.07] px-3 py-2">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Senaryo 1 · önce yukarı</div>
              <div className="mt-0.5 text-[13px] font-semibold text-emerald-300">▲ {f2(fc.u1.price)} <span className="text-[11px] font-normal text-slate-400">({relabel(fc.u1.label, fc.start, fc.u1.price, today, prev)})</span></div>
              <div className="mt-0.5 font-mono text-[20px] font-black text-emerald-300">%{fc.up.pct} <span className="text-[12px] font-semibold text-slate-400">±{fc.up.ci}</span></div>
              <div className="text-[10.5px] text-slate-400">mesafe oranı (yön yok): %{fc.baseUp}</div>
            </div>
            <div className="rounded border border-rose-500/50 bg-rose-500/[0.07] px-3 py-2">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Senaryo 2 · önce aşağı</div>
              <div className="mt-0.5 text-[13px] font-semibold text-rose-300">▼ {f2(fc.d1.price)} <span className="text-[11px] font-normal text-slate-400">({relabel(fc.d1.label, fc.start, fc.d1.price, today, prev)})</span></div>
              <div className="mt-0.5 font-mono text-[20px] font-black text-rose-300">%{fc.down.pct} <span className="text-[12px] font-semibold text-slate-400">±{fc.down.ci}</span></div>
              <div className="text-[10.5px] text-slate-400">mesafe oranı (yön yok): %{100 - fc.baseUp}</div>
            </div>
            <div className="rounded border border-slate-600/60 bg-slate-500/[0.06] px-3 py-2">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Aralık</div>
              <div className="mt-0.5 text-[13px] font-semibold text-slate-200">3 günde ikisine de değmez</div>
              <div className="mt-0.5 font-mono text-[20px] font-black text-slate-300">{fc.none.pct === 0 ? "<%1" : `%${fc.none.pct}`} <span className="text-[12px] font-semibold text-slate-400">±{fc.none.ci}</span></div>
              <div className="text-[10.5px] text-slate-400">{N_PATHS} simülasyon · ±: %95 güven aralığı</div>
            </div>
          </div>

          <div className="rounded border border-[#1c2635] bg-[#0f141d]">
            <div className="border-b border-[#1c2635] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">Zamana bağlı dokunuş (yalnız RTH) — 0DTE için</div>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-1 text-left font-normal">Şu ana kadar</th>
                    <th className="px-3 py-1 text-right font-normal text-emerald-300/80">▲ {f2(fc.u1.price)}</th>
                    <th className="px-3 py-1 text-right font-normal text-rose-300/80">▼ {f2(fc.d1.price)}</th>
                  </tr>
                </thead>
                <tbody>
                  {fc.touches.map((r, i) => (
                    <tr key={i} className={`border-t border-[#1c2635]/60 ${r.label.endsWith("kapanış") ? "text-slate-200" : "text-slate-400"}`}>
                      <td className="px-3 py-0.5">{r.label}</td>
                      <td className="px-3 py-0.5 text-right text-emerald-300">%{r.up}</td>
                      <td className="px-3 py-0.5 text-right text-rose-300">%{r.down}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="rounded border border-[#1c2635] bg-[#0f141d]">
              <div className="border-b border-[#1c2635] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">Seviyeye dokunma olasılığı (3 işlem günü, RTH)</div>
              <div className="max-h-[240px] overflow-y-auto p-1.5">
                {fc.levelOdds.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 py-0.5 font-mono text-[11px]">
                    <span className={`w-14 shrink-0 tabular-nums ${l.side === "UP" ? "text-rose-300" : "text-emerald-300"}`}>{f2(l.price)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-400">{relabel(l.label, fc.start, l.price, today, prev)}</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded bg-slate-700/50"><span className={`block h-full ${l.side === "UP" ? "bg-rose-400" : "bg-emerald-400"}`} style={{ width: `${l.touchPct}%` }} /></span>
                    <span className="w-10 text-right font-bold text-slate-200">%{l.touchPct}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-[#1c2635] bg-[#0f141d] px-3 py-2">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">Forecast analizi</div>
              <ul className="flex flex-col gap-1 text-[11.5px] leading-snug text-slate-300">
                {fc.lines.slice(1).map((l, i) => <li key={i}>• {l}</li>)}
                {read4h && <li className="text-slate-400">• 4h (yalnız bilgi, olasılığa girmez): {read4h.text} — {read4h.reasons.join(" · ")}</li>}
              </ul>
            </div>
          </div>

          <div className="rounded border border-[#1c2635] bg-[#0f141d] px-3 py-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">Kalibrasyon ölçümü (kayıtlı tahminler, gerçekleşene karşı)</div>
            <div className="grid grid-cols-1 gap-2 font-mono text-[11px] md:grid-cols-3">
              <div className="rounded bg-[#0a0e17] px-2 py-1.5">
                <div className="text-[10px] text-slate-500">%10–90 bandı kapsama (hedef ~%80)</div>
                <div className="text-[14px] font-bold text-slate-100">{cal.cov80.n ? `%${Math.round((cal.cov80.hit / cal.cov80.n) * 100)}` : "—"} <span className="text-[10px] font-normal text-slate-500">{cal.cov80.n} gün sonu</span></div>
              </div>
              <div className="rounded bg-[#0a0e17] px-2 py-1.5">
                <div className="text-[10px] text-slate-500">%25–75 bandı kapsama (hedef ~%50)</div>
                <div className="text-[14px] font-bold text-slate-100">{cal.cov50.n ? `%${Math.round((cal.cov50.hit / cal.cov50.n) * 100)}` : "—"} <span className="text-[10px] font-normal text-slate-500">{cal.cov50.n} gün sonu</span></div>
              </div>
              <div className="rounded bg-[#0a0e17] px-2 py-1.5">
                <div className="text-[10px] text-slate-500">Brier — önce hangi seviye (düşük = iyi)</div>
                <div className="text-[14px] font-bold text-slate-100">
                  {cal.brierModel != null ? <>model {cal.brierModel.toFixed(3)} · mesafe oranı {cal.brierBase!.toFixed(3)}</> : "—"}
                  <span className="ml-1 text-[10px] font-normal text-slate-500">{cal.resolved} çözülmüş</span>
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug text-slate-500">
              Her 4h kapanışında tahmin kaydedilir; kapsama gün sonu kapanışlarıyla, Brier ilk dokunuşla ölçülür. Model mesafe oranını istatistiksel olarak geçmedikçe yön eğimi açılmaz.
              Kayıt bu tarayıcıda tutulur ve ölçüm yalnız sayfadaki son ≤10 seanslık 15m veriyle yapılabilir; az örnekle sonuç güvenilir değildir.
            </p>
          </div>

          <div className="rounded border border-[#1c2635] bg-[#0f141d]">
            <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <span>Durum güncellemeleri (her 4h kapanışında)</span><span>{snaps.length} kayıt</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {snaps.length === 0 && <div className="px-3 py-3 text-[11px] text-slate-500">İlk 4h kapanışında / sayfa açıkken yazılır.</div>}
              {snaps.slice(0, 12).map((e, i) => {
                const last = e.dayEnds[e.dayEnds.length - 1];
                return (
                  <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-[#1c2635]/60 px-3 py-1 font-mono text-[11px] last:border-0">
                    <span className="text-slate-200">{etStamp(e.ts)}</span>
                    <span className="text-slate-500">{e.manual ? "elle" : "4h kapanış"}</span>
                    <span className="text-slate-400">başlangıç {f2(e.start)}</span>
                    <span className="text-emerald-300">▲{f2(e.u1)} %{e.pUp}</span>
                    <span className="text-rose-300">▼{f2(e.d1)} %{e.pDown}</span>
                    <span className="text-slate-500">mesafe ▲%{e.baseUp}</span>
                    {last && <span className="text-slate-400">3. gün %80: {f2(last.p10)}–{f2(last.p90)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
