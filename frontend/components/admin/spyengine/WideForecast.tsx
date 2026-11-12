"use client";

/**
 * Geniş Harita (Tahmin Haritası'nın 2. sekmesi, 2026-11-12): son günler + sonraki 3 işlem günü, 15m / 4h.
 * Mumlar + hacim + pivotlar + Monte Carlo koni ve senaryo yolları (lib/spyengine/wideForecast.ts) + kullanıcının kendi senaryosu.
 * Tahmin her 4h mum kapanışında yeniden kurulur ve "Durum güncellemeleri" kaydına yazılır (tarayıcıda, localStorage).
 * Bu bir TAHMİNDİR; olasılıklar kalibre edilmemiş bir modelden (bkz. wideForecast.ts başlığı). İşlem kararı yalnız Takip Sistemi tetiğiyle.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { nyParts, type Bar } from "@/lib/spyengine/core";
import type { Htf4hRead } from "@/lib/spyengine/htf4h";
import { buildWideForecast, type ClassPath, type UserScenarioInput, type WideForecast } from "@/lib/spyengine/wideForecast";

type Tf = "15m" | "4h";

interface UserDraft { h0: string; l1: string; l2: string; t: string; note: string }
const EMPTY_USER: UserDraft = { h0: "", l1: "", l2: "", t: "", note: "" };
interface LogEntry { ts: number; basis4h: number | null; price: number; dir4h: string; up: number; down: number; none: number; uL1?: number; uMain?: number | null; uB?: number | null; manual?: boolean }

/** localStorage'lı durum (kalıcı); depolama yoksa sessizce varsayılana düşer */
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
const num = (s: string): number | null => { const v = parseFloat(s.replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : null; };
const etStamp = (sec: number) =>
  `${new Date(sec * 1000).toLocaleString("tr-TR", { timeZone: "America/New_York", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} ET`;

// ── grafik ────────────────────────────────────────────────────────

const W = 1000, H = 400, VH = 64, PAD = { l: 52, r: 150, t: 26, b: 22 };

function WideChart({ tf, hist, volHist, fc, price, levels, user, histDays }: {
  tf: Tf; hist: Bar[]; volHist: boolean; fc: WideForecast; price: number;
  levels: { price: number; label: string }[]; user: UserScenarioInput | null; histDays: number;
}) {
  const g = useMemo(() => {
    const keep = (() => {
      const days = [...new Set(hist.map((b) => nyParts(b.time).ymd))].slice(-histDays);
      return hist.filter((b) => days.includes(nyParts(b.time).ymd));
    })();
    // gelecek noktalar: 15m → her slot; 4h → 4h mum bitişleri (13:30 ve 16:00 slot sonları)
    const fut: number[] = [];
    fc.slots.forEach((s, i) => {
      if (tf === "15m") fut.push(i);
      else { const m = nyParts(s.endsAt).minutes; if (m === 13 * 60 + 30 || m === 16 * 60) fut.push(i); }
    });
    const nh = keep.length;
    const total = nh + fut.length + 1;
    const X = (idx: number) => PAD.l + (idx / Math.max(1, total - 1)) * (W - PAD.l - PAD.r);
    const vals: number[] = [price];
    keep.forEach((b) => vals.push(b.high, b.low));
    fut.forEach((i) => vals.push(fc.cone.p10[i], fc.cone.p90[i]));
    if (user) [user.h0, user.l1, user.l2, user.t].forEach((v) => { if (v) vals.push(v); });
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1; lo -= pad; hi += pad;
    const Y = (p: number) => PAD.t + (1 - (p - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const maxVol = Math.max(1, ...keep.map((b) => b.volume || 0));
    return { keep, fut, nh, X, Y, lo, hi, maxVol };
  }, [hist, histDays, fc, tf, price, user]);

  const { keep, fut, nh, X, Y, lo, hi, maxVol } = g;
  const bw = Math.max(1.2, (X(1) - X(0)) * 0.62);
  const futX = (j: number) => X(nh + 1 + j);
  const pts = (arr: number[]) => (arr.length ? [`${X(nh - 1).toFixed(1)},${Y(price).toFixed(1)}`, ...fut.map((i, j) => `${futX(j).toFixed(1)},${Y(arr[i]).toFixed(1)}`)].join(" ") : "");
  const bandTop = fut.map((i, j) => `${futX(j).toFixed(1)},${Y(fc.cone.p90[i]).toFixed(1)}`);
  const bandBot = fut.map((i, j) => `${futX(j).toFixed(1)},${Y(fc.cone.p10[i]).toFixed(1)}`).reverse();
  const cone = [`${X(nh - 1).toFixed(1)},${Y(price).toFixed(1)}`, ...bandTop, ...bandBot].join(" ");

  // gün ayırıcıları
  const seps: { x: number; label: string; future: boolean }[] = [];
  keep.forEach((b, i) => { if (i > 0 && nyParts(b.time).ymd !== nyParts(keep[i - 1].time).ymd) seps.push({ x: X(i), label: nyParts(b.time).ymd.slice(5), future: false }); });
  fut.forEach((si, j) => { const s = fc.slots[si]; if (j > 0 && s.day !== fc.slots[fut[j - 1]].day) seps.push({ x: futX(j), label: nyParts(s.time).ymd.slice(5), future: true }); });

  const lines = levels.filter((l) => l.price > lo && l.price < hi).sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price)).slice(0, 9);
  const uLv: { p: number; t: string }[] = [];
  if (user?.h0) uLv.push({ p: user.h0, t: "SEN H0" });
  if (user?.l1) uLv.push({ p: user.l1, t: "SEN L1" });
  if (user?.t) uLv.push({ p: user.t, t: "SEN HEDEF" });
  if (user?.l2) uLv.push({ p: user.l2, t: "SEN B PLANI" });

  const path = (c: ClassPath | null | undefined, color: string, dash: string, w: number) =>
    c && c.median.length ? (
      <g key={c.key}>
        <polyline points={pts(c.median)} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dash || undefined} />
        <text x={futX(fut.length - 1) + 4} y={Y(c.median[fut[fut.length - 1]]) + 3} fontSize={9} fontWeight={700} fill={color} fontFamily="monospace">%{c.pct}</text>
      </g>
    ) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H + VH}`} className="h-auto w-full" role="img" aria-label="Geniş harita">
      <rect x={0} y={0} width={W} height={H + VH} fill="#0a0e17" />
      {/* gelecek bölge */}
      <rect x={X(nh - 0.5)} y={PAD.t} width={W - PAD.r - X(nh - 0.5)} height={H - PAD.t - PAD.b} fill="#1e293b" opacity={0.25} />
      <text x={X(nh - 0.5) + 6} y={PAD.t + 10} fontSize={9} fill="#94a3b8" fontFamily="monospace">TAHMİN → sonraki 3 işlem günü</text>
      {seps.map((s, i) => (
        <g key={i}>
          <line x1={s.x} x2={s.x} y1={PAD.t} y2={H + VH - 4} stroke={s.future ? "#334155" : "#1e293b"} strokeWidth={0.8} strokeDasharray="3 3" />
          <text x={s.x + 3} y={H - 6} fontSize={8.5} fill="#64748b" fontFamily="monospace">{s.label}</text>
        </g>
      ))}
      {/* pivot seviyeleri */}
      {lines.map((l, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(l.price)} y2={Y(l.price)} stroke={l.price > price ? "#f87171" : "#4ade80"} strokeWidth={0.7} strokeDasharray="4 4" opacity={0.55} />
          <text x={W - PAD.r + 4} y={Y(l.price) + 3} fontSize={8.5} fill={l.price > price ? "#f87171" : "#4ade80"} fontFamily="monospace" opacity={0.9}>{f2(l.price)} {l.label.length > 15 ? `${l.label.slice(0, 14)}…` : l.label}</text>
        </g>
      ))}
      {uLv.map((l, i) => (
        <g key={`u${i}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(l.p)} y2={Y(l.p)} stroke="#60a5fa" strokeWidth={1.1} strokeDasharray="8 3" />
          <text x={W - PAD.r + 4} y={Y(l.p) + 3} fontSize={9} fontWeight={700} fill="#60a5fa" fontFamily="monospace">{f2(l.p)} {l.t}</text>
        </g>
      ))}
      {/* fiyat ekseni */}
      {Array.from({ length: 6 }, (_, k) => lo + ((hi - lo) * k) / 5).map((p, k) => (
        <text key={k} x={PAD.l - 4} y={Y(p) + 3} fontSize={8.5} fill="#475569" textAnchor="end" fontFamily="monospace">{f2(p)}</text>
      ))}
      {/* mumlar */}
      {keep.map((b, i) => {
        const up = b.close >= b.open;
        const c = up ? "#22c55e" : "#ef4444";
        const x = X(i);
        return (
          <g key={b.time}>
            <line x1={x} x2={x} y1={Y(b.high)} y2={Y(b.low)} stroke={c} strokeWidth={0.8} />
            <rect x={x - bw / 2} y={Math.min(Y(b.open), Y(b.close))} width={bw} height={Math.max(1, Math.abs(Y(b.open) - Y(b.close)))} fill={c} />
            {volHist && <rect x={x - bw / 2} y={H + VH - 4 - ((b.volume || 0) / maxVol) * (VH - 10)} width={bw} height={((b.volume || 0) / maxVol) * (VH - 10)} fill={c} opacity={0.45} />}
          </g>
        );
      })}
      {/* koni + medyan */}
      <polygon points={cone} fill="#94a3b8" opacity={0.12} />
      <polyline points={pts(fc.cone.p50)} fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 3" />
      {path(fc.up, "#4ade80", "7 4", 1.8)}
      {path(fc.down, "#f87171", "7 4", 1.8)}
      {path(fc.none, "#94a3b8", "3 4", 1.2)}
      {path(fc.user?.l1Path, "#60a5fa", "2 3", 1.1)}
      {path(fc.user?.main, "#60a5fa", "", 2)}
      {path(fc.user?.planB, "#bfdbfe", "6 3", 2)}
      {/* şimdi */}
      <line x1={X(nh - 1)} x2={X(nh - 1)} y1={PAD.t} y2={H - PAD.b} stroke="#e2e8f0" strokeWidth={0.8} strokeDasharray="2 3" />
      <circle cx={X(nh - 1)} cy={Y(price)} r={3.5} fill="#3b82f6" stroke="#fff" strokeWidth={1.2} />
      <text x={X(nh - 1)} y={PAD.t - 8} fontSize={9} fill="#e2e8f0" textAnchor="middle" fontFamily="monospace">şimdi {f2(price)}</text>
      {volHist && <text x={PAD.l} y={H + 12} fontSize={8.5} fill="#64748b" fontFamily="monospace">hacim</text>}
    </svg>
  );
}

// ── panel ─────────────────────────────────────────────────────────

function Pct({ v, tone }: { v: number | null | undefined; tone: "up" | "down" | "blue" | "flat" }) {
  const cls = tone === "up" ? "text-emerald-300" : tone === "down" ? "text-rose-300" : tone === "blue" ? "text-blue-300" : "text-slate-300";
  return <span className={`font-mono font-black ${cls}`}>{v == null ? "—" : `%${v}`}</span>;
}

export default function WideForecast({ symbol, price, t, bars15, bars4h, levels, read4h, volRatio4h }: {
  symbol: string;
  price: number | null;
  t: number;
  /** kapanmış RTH 15m mumlar (çok günlük) */
  bars15: Bar[];
  /** kapanmış RTH 4h mumlar */
  bars4h: Bar[];
  levels: { price: number; label: string }[];
  read4h: Htf4hRead | null;
  volRatio4h: number | null;
}) {
  const [tf, setTf] = useLocal<Tf>(`wide_tf_${symbol}`, "15m");
  const [histDays, setHistDays] = useLocal<number>(`wide_hist_${symbol}`, 2);
  const [draft, setDraft] = useState<UserDraft>(EMPTY_USER);
  const [applied, setApplied] = useLocal<UserDraft>(`wide_user_${symbol}`, EMPTY_USER);
  const [log, setLog] = useLocal<LogEntry[]>(`wide_log_${symbol}`, []);
  const [tick, setTick] = useState(0);
  useEffect(() => { setDraft(applied); }, [applied]);

  const user: UserScenarioInput | null = useMemo(() => {
    const l1 = num(applied.l1);
    return l1 ? { h0: num(applied.h0), l1, l2: num(applied.l2), t: num(applied.t) } : null;
  }, [applied]);

  const basis4h = read4h?.last?.time ?? null;
  const fc = useMemo<WideForecast | null>(() => {
    if (price == null || !t) return null;
    return buildWideForecast({ symbol, price, t, bars15, read4h, levels, user, basis4h, volRatio4h });
    // tahmin yalnız 4h kapanışında, kullanıcı senaryosu değişince veya elle güncellenince kurulur (her 5m'de değil)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, basis4h, user, tick, price == null]);

  // 4h kapanışında durum güncellemesi kaydı
  useEffect(() => {
    if (!fc || price == null) return;
    const last = log[0];
    if (last && last.basis4h === fc.basis4h && !tick) return;
    const entry: LogEntry = {
      ts: t, basis4h: fc.basis4h, price, dir4h: read4h?.dir ?? "—", up: fc.up.pct, down: fc.down.pct, none: fc.none.pct,
      uL1: fc.user?.pL1, uMain: fc.user?.pMain, uB: fc.user?.pPlanB, manual: tick > 0,
    };
    setLog([entry, ...log.filter((e) => !(e.basis4h === entry.basis4h && !e.manual))].slice(0, 30));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc?.basis4h, tick]);

  const hist = tf === "15m" ? bars15 : bars4h;
  const U = fc?.user;

  const inp = "w-full rounded border border-slate-600/60 bg-[#0b111b] px-2 py-1 font-mono text-[12px] text-slate-100 outline-none focus:border-blue-400";

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* üst satır: zaman dilimi + güncelleme damgası */}
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

      {!fc || price == null ? (
        <div className="rounded border border-[#1a2433] px-3 py-10 text-center text-[12px] text-slate-500">Geniş harita için yeterli 15m geçmişi bekleniyor (en az ~3 seans).</div>
      ) : (
        <>
          <div className="overflow-hidden rounded border border-[#1a2433]">
            <WideChart tf={tf} hist={hist} volHist fc={fc} price={price} levels={levels} user={user} histDays={histDays} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] text-slate-500">
            <span><b className="text-emerald-300">━ ━</b> sistem: yukarı seviye önce</span>
            <span><b className="text-rose-300">━ ━</b> sistem: aşağı seviye önce</span>
            <span><b className="text-slate-300">· · ·</b> aralık / medyan</span>
            <span><b className="text-blue-300">━</b> senin senaryon</span>
            <span>gri alan: %10–%90 olasılık konisi</span>
          </div>

          {/* sistem senaryoları */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded border border-emerald-500/50 bg-emerald-500/[0.07] px-3 py-2">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Sistem senaryosu 1</div>
              <div className="mt-0.5 text-[13px] font-semibold text-emerald-300">▲ önce {f2(fc.u1.price)} <span className="text-[11px] font-normal text-slate-400">({fc.u1.label})</span></div>
              <div className="mt-0.5 text-[20px]"><Pct v={fc.up.pct} tone="up" /></div>
              <div className="text-[10.5px] text-slate-400">{fc.u2 ? `sonra ${f2(fc.u2.price)}'e değme %${fc.pU2}` : "3 işlem günü içinde"}</div>
            </div>
            <div className="rounded border border-rose-500/50 bg-rose-500/[0.07] px-3 py-2">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Sistem senaryosu 2</div>
              <div className="mt-0.5 text-[13px] font-semibold text-rose-300">▼ önce {f2(fc.d1.price)} <span className="text-[11px] font-normal text-slate-400">({fc.d1.label})</span></div>
              <div className="mt-0.5 text-[20px]"><Pct v={fc.down.pct} tone="down" /></div>
              <div className="text-[10.5px] text-slate-400">{fc.d2 ? `sonra ${f2(fc.d2.price)}'e değme %${fc.pD2}` : "3 işlem günü içinde"}</div>
            </div>
            <div className="rounded border border-slate-600/60 bg-slate-500/[0.06] px-3 py-2">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Aralık</div>
              <div className="mt-0.5 text-[13px] font-semibold text-slate-200">İkisine de değmez</div>
              <div className="mt-0.5 text-[20px]"><Pct v={fc.none.pct} tone="flat" /></div>
              <div className="text-[10.5px] text-slate-400">{fc.tiltNote}</div>
            </div>
          </div>

          {/* senin senaryon */}
          <div className="rounded border border-blue-400/40 bg-blue-500/[0.05] px-3 py-2">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-blue-300">Senin senaryon</span>
              <span className="text-[10.5px] text-slate-500">Seviyeleri yaz → sistem sıralı dokunma olasılığını hesaplar (3 işlem günü)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <label className="text-[10.5px] text-slate-400">Zayıf yükseliş tepesi (ops.)<input className={inp} inputMode="decimal" value={draft.h0} onChange={(e) => setDraft({ ...draft, h0: e.target.value })} placeholder="örn. 758" /></label>
              <label className="text-[10.5px] text-slate-400">Geri çekilme (L1)<input className={inp} inputMode="decimal" value={draft.l1} onChange={(e) => setDraft({ ...draft, l1: e.target.value })} placeholder="örn. 750" /></label>
              <label className="text-[10.5px] text-slate-400">Ana senaryo hedefi<input className={inp} inputMode="decimal" value={draft.t} onChange={(e) => setDraft({ ...draft, t: e.target.value })} placeholder="güçlü denemede kırılacak" /></label>
              <label className="text-[10.5px] text-slate-400">B planı (L1 altı)<input className={inp} inputMode="decimal" value={draft.l2} onChange={(e) => setDraft({ ...draft, l2: e.target.value })} placeholder="örn. 720" /></label>
              <div className="flex items-end gap-1.5">
                <button type="button" onClick={() => setApplied(draft)} className="flex-1 rounded border border-blue-400 bg-blue-500/25 px-2 py-1 text-[12px] font-bold text-blue-100 hover:bg-blue-500/40">Hesapla</button>
                <button type="button" onClick={() => { setDraft(EMPTY_USER); setApplied(EMPTY_USER); }} className="rounded border border-slate-600/60 px-2 py-1 text-[12px] text-slate-400 hover:text-white">Temizle</button>
              </div>
            </div>
            <textarea className={`${inp} mt-2 h-14 resize-y`} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} onBlur={() => setApplied({ ...applied, note: draft.note })} placeholder="Notun (ör. bugünkü yükseliş zayıf kalır, 750'ye çekilir; sonraki denemede daha güçlü kırılım…)" />
            {U ? (
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                <div className="rounded bg-[#0a0e17] px-2 py-1.5"><div className="text-[10px] text-slate-500">{U.pH0 != null ? "H0 → L1'e çekilme" : "L1'e çekilme"}</div><Pct v={U.pL1} tone="blue" /></div>
                <div className="rounded bg-[#0a0e17] px-2 py-1.5"><div className="text-[10px] text-slate-500">Ana: L1 → {user?.t ? f2(user.t) : "hedef yok"}</div><Pct v={U.pMain} tone="blue" />{U.pMain != null && U.pL1 > 0 && <span className="ml-1 text-[10px] text-slate-500">(L1 gelirse %{Math.round((U.pMain / U.pL1) * 100)})</span>}</div>
                <div className="rounded bg-[#0a0e17] px-2 py-1.5"><div className="text-[10px] text-slate-500">B planı: L1 → {user?.l2 ? f2(user.l2) : "hedef yok"}</div><Pct v={U.pPlanB} tone="blue" />{U.pPlanB != null && U.pL1 > 0 && <span className="ml-1 text-[10px] text-slate-500">(L1 gelirse %{Math.round((U.pPlanB / U.pL1) * 100)})</span>}</div>
                <div className="rounded bg-[#0a0e17] px-2 py-1.5"><div className="text-[10px] text-slate-500">Sistem 4h eğilimi</div><span className={`font-mono text-[13px] font-black ${read4h?.dir === "UP" ? "text-emerald-300" : read4h?.dir === "DOWN" ? "text-rose-300" : "text-amber-300"}`}>{read4h ? (read4h.dir === "UP" ? "▲ YUKARI" : read4h.dir === "DOWN" ? "▼ AŞAĞI" : "◆ YATAY") : "—"}</span></div>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-slate-500">L1 (geri çekilme seviyesi) yazıp Hesapla&apos;ya bas — grafikte mavi yollar ve olasılıklar görünür.</div>
            )}
            {U && user && (
              <p className="mt-2 text-[11.5px] leading-snug text-slate-300">
                <b className="text-blue-300">Hesap:</b>{" "}
                {user.h0 ? `Yükseliş ${f2(user.h0)} civarında zayıf kalır (3 günde değme %${U.pH0}); ` : ""}
                fiyat {f2(user.l1!)} seviyesine {user.l1! < price ? "çekilir" : "çıkar"} (3 günde %{U.pL1}).
                {user.t != null && U.pMain != null ? ` Sonra daha güçlü bir denemeyle ${f2(user.t)} değer: mutlak %${U.pMain}${U.pL1 > 0 ? `, ${f2(user.l1!)}'e gelirse %${Math.round((U.pMain / U.pL1) * 100)}` : ""}.` : ""}
                {user.l2 != null && U.pPlanB != null ? ` B planı: ${f2(user.l1!)} kırılırsa ${f2(user.l2)}'ye gidiş mutlak %${U.pPlanB}${U.pL1 > 0 ? `, ${f2(user.l1!)}'e gelirse %${Math.round((U.pPlanB / U.pL1) * 100)}` : ""}.` : ""}
                {read4h && user.t != null ? ` 4h eğilimi ${read4h.dir === "UP" ? "yukarı" : read4h.dir === "DOWN" ? "aşağı" : "yatay"} — ana senaryonun yönü (${user.t > price ? "yukarı" : "aşağı"}) ile ${read4h.dir === "FLAT" ? "nötr" : (read4h.dir === "UP") === (user.t > price) ? "uyumlu" : "ters"}.` : ""}
              </p>
            )}
          </div>

          {/* seviye dokunma olasılıkları + açıklama */}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="rounded border border-[#1c2635] bg-[#0f141d]">
              <div className="border-b border-[#1c2635] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">Seviyeye dokunma olasılığı (3 işlem günü)</div>
              <div className="max-h-[240px] overflow-y-auto p-1.5">
                {fc.levelOdds.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 py-0.5 font-mono text-[11px]">
                    <span className={`w-14 shrink-0 tabular-nums ${l.side === "UP" ? "text-rose-300" : "text-emerald-300"}`}>{f2(l.price)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-400">{l.label}</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded bg-slate-700/50"><span className={`block h-full ${l.side === "UP" ? "bg-rose-400" : "bg-emerald-400"}`} style={{ width: `${l.touchPct}%` }} /></span>
                    <span className="w-10 text-right font-bold text-slate-200">%{l.touchPct}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-[#1c2635] bg-[#0f141d] px-3 py-2">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">Forecast analizi</div>
              <ul className="flex flex-col gap-1 text-[11.5px] leading-snug text-slate-300">
                {fc.lines.map((l, i) => <li key={i}>• {l}</li>)}
                {read4h && <li>• 4h: {read4h.text} — {read4h.reasons.join(" · ")}</li>}
                {applied.note && <li className="text-blue-200">• Notun: {applied.note}</li>}
              </ul>
              <p className="mt-2 text-[10.5px] leading-snug text-slate-500">
                Bu bir TAHMİNDİR: gerçek oynaklıktan ve 4h eğiminden üretilen Monte Carlo (3000 yol); mum/hacim formasyonu yalnız eğim katsayısına girer.
                Olasılıklar geriye dönük ölçülüp kalibre edilmedi. İşlem kararı yalnız Takip Sistemi tetiğiyle verilir.
              </p>
            </div>
          </div>

          {/* 4h durum güncellemeleri */}
          <div className="rounded border border-[#1c2635] bg-[#0f141d]">
            <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <span>Durum güncellemeleri (her 4h kapanışında)</span><span>{log.length} kayıt</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {log.length === 0 && <div className="px-3 py-3 text-[11px] text-slate-500">İlk 4h kapanışında / sayfa açıkken yazılır.</div>}
              {log.slice(0, 12).map((e, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-[#1c2635]/60 px-3 py-1 font-mono text-[11px] last:border-0">
                  <span className="text-slate-200">{etStamp(e.ts)}</span>
                  <span className="text-slate-500">{e.manual ? "elle" : "4h kapanış"}</span>
                  <span className="text-slate-400">fiyat {f2(e.price)}</span>
                  <span className={e.dir4h === "UP" ? "text-emerald-300" : e.dir4h === "DOWN" ? "text-rose-300" : "text-amber-300"}>4h {e.dir4h === "UP" ? "▲" : e.dir4h === "DOWN" ? "▼" : "◆"}</span>
                  <span className="text-emerald-300">▲%{e.up}</span><span className="text-rose-300">▼%{e.down}</span><span className="text-slate-400">≈%{e.none}</span>
                  {e.uL1 != null && <span className="text-blue-300">sen: L1 %{e.uL1}{e.uMain != null ? ` · ana %${e.uMain}` : ""}{e.uB != null ? ` · B %${e.uB}` : ""}</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

