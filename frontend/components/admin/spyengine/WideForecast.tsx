"use client";

/**
 * Geniş Harita (Tahmin Haritası'nın 2. sekmesi). v3 (2026-11-12): yalnız sistemin hesabı — kullanıcı senaryosu bölümü kaldırıldı.
 * Mumlar + hacim + tarihli/rolü doğru pivotlar + Monte Carlo koni, medoid yol ve soluk örnek yollar (lib/spyengine/wideForecast.ts).
 * Her 4h kapanışında tahmin yeniden kurulur ve kaydedilir; kayıtlar gerçekleşenle ölçülür (kapsama + Brier, mesafe-oranı baseline'ına karşı).
 * Kayıt bu tarayıcıda (localStorage) tutulur. Bu bir TAHMİNDİR; işlem kararı yalnız Takip Sistemi tetiğiyle verilir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { nyParts, type Bar } from "@/lib/spyengine/core";
import type { Htf4hRead } from "@/lib/spyengine/htf4h";
import {
  buildWideForecast, evaluateSnapshots, toSnapshot, trDate, N_PATHS,
  type Snapshot, type WideForecast,
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

function WideChart({ tf, hist, fc, live, levels, histDays }: {
  tf: Tf; hist: Bar[]; fc: WideForecast; live: number | null;
  levels: { price: number; label: string }[]; histDays: number;
}) {
  const start = fc.start;
  const g = useMemo(() => {
    const days = [...new Set(hist.map((b) => nyParts(b.time).ymd))].slice(-histDays);
    const keep = hist.filter((b) => days.includes(nyParts(b.time).ymd));
    const bucketKey = (i: number) => (tf === "15m" ? i : fc.slots[i].day * 2 + (nyParts(fc.slots[i].time).minutes >= 13 * 60 + 30 ? 1 : 0));
    const groups: number[][] = [];
    fc.slots.forEach((_, i) => {
      const last = groups[groups.length - 1];
      if (last && bucketKey(last[0]) === bucketKey(i)) last.push(i); else groups.push([i]);
    });
    const nh = keep.length;
    const total = nh + groups.length + 1;
    const X = (idx: number) => PAD.l + (idx / Math.max(1, total - 1)) * (W - PAD.l - PAD.r);
    const vals: number[] = [start, fc.u1.price, fc.d1.price];
    if (live != null) vals.push(live);
    keep.forEach((b) => vals.push(b.high, b.low));
    groups.forEach((gr) => { const s = gr[gr.length - 1]; vals.push(fc.cone.p10[s], fc.cone.p90[s]); });
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1; lo -= pad; hi += pad;
    const Y = (p: number) => PAD.t + (1 - (p - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const maxVol = Math.max(1, ...keep.map((b) => b.volume || 0));
    return { keep, groups, nh, X, Y, lo, hi, maxVol };
  }, [hist, histDays, fc, tf, start, live]);

  const { keep, groups, nh, X, Y, lo, hi, maxVol } = g;
  const bw = Math.max(1.2, (X(1) - X(0)) * 0.62);
  const futX = (j: number) => X(nh + 1 + j);
  const endOf = (j: number) => groups[j][groups[j].length - 1];
  const x0 = X(nh - 1);
  const pts = (arr: number[]) => (arr.length ? [`${x0.toFixed(1)},${Y(start).toFixed(1)}`, ...groups.map((_, j) => `${futX(j).toFixed(1)},${Y(arr[endOf(j)]).toFixed(1)}`)].join(" ") : "");
  const band = (a: number[], b: number[]) => [
    `${x0.toFixed(1)},${Y(start).toFixed(1)}`,
    ...groups.map((_, j) => `${futX(j).toFixed(1)},${Y(a[endOf(j)]).toFixed(1)}`),
    ...groups.map((_, j) => `${futX(j).toFixed(1)},${Y(b[endOf(j)]).toFixed(1)}`).reverse(),
  ].join(" ");

  const allDays = [...new Set(hist.map((b) => nyParts(b.time).ymd))];
  const today = allDays[allDays.length - 1] ?? null;
  const prev = allDays[allDays.length - 2] ?? null;

  const seps: { x: number; label: string; future: boolean }[] = [];
  keep.forEach((b, i) => { if (i > 0 && nyParts(b.time).ymd !== nyParts(keep[i - 1].time).ymd) seps.push({ x: X(i - 0.5), label: trDate(nyParts(b.time).ymd), future: false }); });
  groups.forEach((gr, j) => {
    const ymd = nyParts(fc.slots[gr[0]].time).ymd;
    const prevYmd = j === 0 ? today : nyParts(fc.slots[groups[j - 1][0]].time).ymd;
    if (ymd !== prevYmd) seps.push({ x: j === 0 ? X(nh - 0.5) + 2 : futX(j - 0.5), label: trDate(ymd), future: true });
  });

  type L = { price: number; text: string; color: string; prio: number; width: number; opacity: number };
  const lbls: L[] = [];
  const short = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);
  for (const l of levels) {
    if (!(l.price > lo && l.price < hi)) continue;
    const key = Math.abs(l.price - fc.u1.price) < 0.01 || Math.abs(l.price - fc.d1.price) < 0.01;
    const above = l.price > start;
    lbls.push({
      price: l.price, text: `${f2(l.price)} ${short(relabel(l.label, start, l.price, today, prev))}`,
      color: above ? "#f87171" : "#4ade80", prio: key ? 0 : 1, width: key ? 1 : 0.6, opacity: key ? 0.85 : 0.4,
    });
  }
  const labelY = layoutLabels(lbls.map((l, i) => ({ y: Y(l.price), prio: l.prio, i })), PAD.t + 4, H - PAD.b - 2);
  const plotR = W - PAD.r;
  const dom = fc.up.pct >= fc.down.pct ? fc.up : fc.down;
  const oth = dom === fc.up ? fc.down : fc.up;
  const col = (c: typeof fc.up) => (c.key === "up" ? "#4ade80" : "#f87171");

  return (
    <svg viewBox={`0 0 ${W} ${H + VH}`} className="h-auto w-full" role="img" aria-label="Geniş harita">
      <rect x={0} y={0} width={W} height={H + VH} fill="#0a0e17" />
      <rect x={X(nh - 0.5)} y={PAD.t} width={plotR - X(nh - 0.5)} height={H - PAD.t - PAD.b} fill="#1e293b" opacity={0.22} />
      {Array.from({ length: 6 }, (_, k) => lo + ((hi - lo) * k) / 5).map((p, k) => (
        <g key={k}>
          <line x1={PAD.l} x2={plotR} y1={Y(p)} y2={Y(p)} stroke="#121a26" strokeWidth={0.6} />
          <text x={PAD.l - 4} y={Y(p) + 3} fontSize={8.5} fill="#475569" textAnchor="end" fontFamily="monospace">{f2(p)}</text>
        </g>
      ))}
      {keep.length > 0 && <text x={X(0)} y={H - 6} fontSize={8.5} fill="#64748b" fontFamily="monospace">{trDate(nyParts(keep[0].time).ymd)}</text>}
      {seps.map((s, i) => (
        <g key={i}>
          <line x1={s.x} x2={s.x} y1={PAD.t} y2={H + VH - 4} stroke={s.future ? "#334155" : "#1e293b"} strokeWidth={0.8} strokeDasharray="3 3" />
          <text x={s.x + 3} y={H - 6} fontSize={8.5} fill={s.future ? "#94a3b8" : "#64748b"} fontFamily="monospace">{s.label}</text>
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
      <polygon points={band(fc.cone.p90, fc.cone.p10)} fill="#94a3b8" opacity={0.08} />
      <polygon points={band(fc.cone.p75, fc.cone.p25)} fill="#94a3b8" opacity={0.12} />
      <polyline points={pts(fc.cone.p50)} fill="none" stroke="#64748b" strokeWidth={0.9} strokeDasharray="2 3" />
      {[oth, dom].map((c) => c.samples.map((s, k) => <polyline key={`${c.key}${k}`} points={pts(s)} fill="none" stroke={col(c)} strokeWidth={0.6} opacity={0.16} />))}
      {oth.medoid.length > 0 && <polyline points={pts(oth.medoid)} fill="none" stroke={col(oth)} strokeWidth={1.4} strokeDasharray="6 3" opacity={0.85} />}
      {dom.medoid.length > 0 && <polyline points={pts(dom.medoid)} fill="none" stroke={col(dom)} strokeWidth={2} />}
      <line x1={x0} x2={x0} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" strokeWidth={0.8} strokeDasharray="2 3" />
      <circle cx={x0} cy={Y(start)} r={3.5} fill="#3b82f6" stroke="#fff" strokeWidth={1.2} />
      {!fc.inRth && live != null && live > 0 && Math.abs(live - start) > 0.005 && (
        <g>
          <circle cx={x0 + 6} cy={Y(live)} r={3} fill="none" stroke="#e3b341" strokeWidth={1.2} />
          <text x={x0 + 12} y={Y(live) + 3} fontSize={8.5} fill="#e3b341" fontFamily="monospace">seans dışı {f2(live)}</text>
        </g>
      )}
      <g fontSize={9} fontFamily="monospace">
        <text x={PAD.l} y={13} fill="#94a3b8">geçmiş {histDays} gün · {tf} · {N_PATHS} simülasyon</text>
        <text x={x0} y={13} fill="#e2e8f0" textAnchor="middle">{fc.inRth ? "şimdi" : "son RTH kapanışı"} {f2(start)}</text>
        <text x={PAD.l} y={28}>
          <tspan fill="#94a3b8">Önce hangi seviye (3 işlem günü, RTH): </tspan>
          <tspan fill="#4ade80" fontWeight={700}>▲ {f2(fc.u1.price)} %{fc.up.pct} ±{fc.up.ci}</tspan>
          <tspan fill="#64748b"> · </tspan>
          <tspan fill="#f87171" fontWeight={700}>▼ {f2(fc.d1.price)} %{fc.down.pct} ±{fc.down.ci}</tspan>
          <tspan fill="#64748b"> · ikisi de değil {fc.none.pct === 0 ? "<%1" : `%${fc.none.pct}`} · mesafe oranı ▲%{fc.baseUp}/▼%{100 - fc.baseUp}</tspan>
        </text>
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
    return buildWideForecast({ symbol, livePrice: price ?? 0, t, bars15, levels, ivAnnual: iv?.v ?? null, ivLabel: iv?.label ?? null, basis4h });
    // tahmin yalnız 4h kapanışında, IV değişince (tam puan) veya elle güncellenince kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, basis4h, ivKey, tick, hasBars]);

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
            <WideChart tf={tf} hist={hist} fc={fc} live={price} levels={levels} histDays={histDays} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] text-slate-500">
            <span><b className="text-slate-200">━</b> kalın: baskın senaryonun medoid yolu (o senaryodaki yolların &quot;ortadaki&quot; gerçek yolu)</span>
            <span><b className="text-slate-300">╌</b> diğer senaryonun medoidi</span>
            <span>ince soluk çizgiler: örnek simülasyon yolları</span>
            <span>gri alan: koyu %25–75 · açık %10–90 · noktalı: medyan</span>
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
