"use client";

/**
 * Günlük Plan & Seviye Haritası (Geniş Harita v5) — sunucunun deterministik planını (lib/spyengine/dayPlan.ts) gösterir.
 * Sıra: başlık + skor · metrik kartları · lejant · ana grafik · akış/seviyeler · uyarı/senaryo · koşullu plan ·
 * sonraki 15 dk / sonraki günler · sinyal haritası/teknik · sürüm seçici. Eksik veri gizlenmez, gri "veri yok" yazar.
 * Senaryo yolları seviyelerden çizilir, OLASILIK DEĞİLDİR. Yüzdeler yalnız Monte Carlo ve ölçülmüş frekanslardan.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DayPlan, Lean, PathPt, Zone } from "@/lib/spyengine/dayPlan";

const f2 = (v: number) => v.toFixed(2);
const sg = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
const TR_MON = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const TR_DAY = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const trLong = (ymd: string) => `${Number(ymd.slice(8, 10))} ${TR_MON[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)} ${TR_DAY[new Date(`${ymd}T12:00:00Z`).getUTCDay()]}`;
const trShort = (ymd: string) => `${Number(ymd.slice(8, 10))} ${TR_MON[Number(ymd.slice(5, 7)) - 1]}`;
const zf = (z: { low: number; high: number }) => (z.high - z.low < 0.05 ? f2(z.low) : `${f2(z.low)}–${f2(z.high)}`);

const MISSING_TR: Record<string, string> = {
  vix: "VIX / örtük oynaklık", gex: "GEX", gamma_flip: "gamma flip", call_wall: "call duvarı", put_wall: "put duvarı",
  straddle: "ATM straddle", overnight_20_04: "20:00–04:00 gece verisi", intraday_profile: "gün içi profil (sabit kullanıldı)",
  events_macro: "ekonomik takvim", events_earnings: "bilanço takvimi", volume_ratio: "hacim oranı", sma200: "200 SMA", monte_carlo: "Monte Carlo",
};
const missingLabel = (k: string) => MISSING_TR[k] ?? (k.startsWith("rel_") ? `${k.slice(4)} fiyatı` : k);

const NA = () => <span className="text-slate-500">veri yok</span>;

/** "17 Kas 2026 09:35" (ET) */
const etStamp = (sec: number) => {
  const d = new Date(sec * 1000);
  const ymd = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const hm = d.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${trShort(ymd)} ${ymd.slice(0, 4)} ${hm}`;
};
const EMA_COL = { e9: "#22d3ee", e20: "#a78bfa", e50: "#fb923c" } as const;

function Card({ title, children, tone = "base" }: { title: string; children: React.ReactNode; tone?: "base" | "warn" | "info" }) {
  const cls = tone === "warn" ? "border-amber-500/40 bg-amber-500/[0.08]" : tone === "info" ? "border-sky-500/40 bg-sky-500/[0.08]" : "border-[#1c2635] bg-[#0f141d]";
  return (
    <div className={`rounded-lg border ${cls} px-3 py-2`}>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</div>
      {children}
    </div>
  );
}

// ── grafik ────────────────────────────────────────────────────────

const W = 1000, H = 340, PAD = { l: 48, r: 150, t: 14, b: 26 };
const X0 = 4 * 60, X1 = 16 * 60;
const AXIS = [240, 510, 570, 600, 630, 690, 720, 810, 900, 960];
const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function Chart({ p, colors }: { p: DayPlan; colors: Record<string, { stroke: string; dash: string; label: string }> }) {
  const [hover, setHover] = useState<number | null>(null);
  const g = useMemo(() => {
    const vals: number[] = [p.meta.spot];
    p.actual_path.forEach((q) => vals.push(q.p));
    p.scenarios.forEach((s) => s.points.forEach((q) => vals.push(q.p)));
    p.band.forEach((b) => vals.push(b.lo, b.hi));
    (p.ema ?? []).forEach((e) => vals.push(e.e9, e.e20, e.e50));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    // en uzak ilgili seviye ±1: yolların aralığına 0,5 aralık mesafede kalan seviyeler dahil
    const span = Math.max(1, hi - lo);
    const lv = p.levels.filter((z) => z.high >= lo - span * 0.5 && z.low <= hi + span * 0.5);
    lv.forEach((z) => { lo = Math.min(lo, z.low); hi = Math.max(hi, z.high); });
    lo -= 1; hi += 1;
    return { lo, hi, lv };
  }, [p]);
  const X = (m: number) => PAD.l + ((Math.max(X0, Math.min(X1, m)) - X0) / (X1 - X0)) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - (v - g.lo) / (g.hi - g.lo)) * (H - PAD.t - PAD.b);
  const line = (pts: PathPt[]) => pts.map((q) => `${X(q.m).toFixed(1)},${Y(q.p).toFixed(1)}`).join(" ");
  const step = (() => { const r = g.hi - g.lo; const raw = r / 7; const pw = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / pw; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * pw; })();
  const ticks: number[] = [];
  for (let v = Math.ceil(g.lo / step) * step; v <= g.hi; v += step) ticks.push(v);
  // sağ etiket yerleşimi (çakışmasız)
  const placed: number[] = [];
  const labelY = g.lv.map((z) => {
    const y0 = Y((z.low + z.high) / 2);
    for (let d = 0; d < 40; d++) for (const c of [y0 + d, y0 - d]) if (c > PAD.t && c < H - PAD.b && placed.every((q) => Math.abs(q - c) >= 11)) { placed.push(c); return c; }
    return null;
  });
  // "şimdi" = son kapanan 5m mum (senaryolar da buradan başlar); seans öncesi günden önceki mumsa 04:00
  const lastM = p.actual_path.length ? p.actual_path[p.actual_path.length - 1].m : X0;
  const nowM = Math.max(X0, Math.min(X1, lastM));
  const valAt = (pts: PathPt[], m: number) => {
    if (!pts.length || m < pts[0].m || m > pts[pts.length - 1].m) return null;
    let best = pts[0];
    for (const q of pts) if (Math.abs(q.m - m) < Math.abs(best.m - m)) best = q;
    return Math.abs(best.m - m) <= 15 ? best.p : null;
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    if (x < PAD.l || x > W - PAD.r) { setHover(null); return; }
    setHover(Math.round(X0 + ((x - PAD.l) / (W - PAD.l - PAD.r)) * (X1 - X0)));
  };
  const tip = hover != null ? [
    { k: "Gerçekleşen", v: valAt(p.actual_path, hover), c: "#e2e8f0" },
    ...(["e9", "e20", "e50"] as const).map((k) => ({ k: `EMA${k.slice(1)}`, v: valAt((p.ema ?? []).map((e) => ({ t: "", m: e.m, p: e[k] })), hover), c: EMA_COL[k] })),
    ...p.scenarios.map((s) => ({ k: colors[s.key].label, v: valAt(s.points, hover), c: colors[s.key].stroke })),
  ].filter((r) => r.v != null) : [];
  const bandPoly = p.band.length ? [...p.band.map((b) => `${X(b.m).toFixed(1)},${Y(b.hi).toFixed(1)}`), ...[...p.band].reverse().map((b) => `${X(b.m).toFixed(1)},${Y(b.lo).toFixed(1)}`)].join(" ") : "";
  const zc = (z: Zone) => (z.type === "R" ? "#f87171" : z.type === "S" ? "#4ade80" : "#94a3b8");

  return (
    <div className="relative min-w-[1000px] sm:min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Günlük senaryo haritası" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <rect x={0} y={0} width={W} height={H} fill="#0a0e17" />
        <rect x={X(570)} y={PAD.t} width={X(960) - X(570)} height={H - PAD.t - PAD.b} fill="#1e293b" opacity={0.18} />
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke="#131b28" strokeWidth={0.7} />
            <text x={PAD.l - 4} y={Y(v) + 3.5} fontSize={11} fill="#64748b" textAnchor="end" fontFamily="monospace">{v.toFixed(step < 1 ? 1 : 0)}</text>
          </g>
        ))}
        {AXIS.map((m) => (
          <g key={m}>
            <line x1={X(m)} x2={X(m)} y1={PAD.t} y2={H - PAD.b} stroke="#131b28" strokeWidth={0.6} />
            <text x={X(m)} y={H - 8} fontSize={11} fill="#64748b" textAnchor="middle" fontFamily="monospace">{hh(m)}</text>
          </g>
        ))}
        {g.lv.map((z, i) => {
          const c = zc(z);
          const wide = Y(z.low) - Y(z.high) > 1.5;
          const ly = labelY[i];
          return (
            <g key={`z${i}`}>
              {wide && <rect x={PAD.l} y={Y(z.high)} width={W - PAD.l - PAD.r} height={Y(z.low) - Y(z.high)} fill={c} opacity={0.06} />}
              <line x1={PAD.l} x2={W - PAD.r} y1={Y((z.low + z.high) / 2)} y2={Y((z.low + z.high) / 2)} stroke={c} strokeWidth={z.rejects ? 1 : 0.6} strokeDasharray="5 4" opacity={z.rejects ? 0.75 : 0.4} />
              {ly != null && (
                <text x={W - PAD.r + 6} y={ly + 4} fontSize={11} fill={c} fontFamily="monospace">
                  {zf(z)}{z.rejects ? ` ·${z.rejects}r` : ""}
                </text>
              )}
            </g>
          );
        })}
        {bandPoly && <polygon points={bandPoly} fill={colors.main.stroke} opacity={0.07} />}
        {p.scenarios.map((s) => (
          <polyline key={s.key} points={line(s.points)} fill="none" stroke={colors[s.key].stroke} strokeWidth={s.key === "main" ? 2 : 1.6} strokeDasharray={colors[s.key].dash} />
        ))}
        {(["e50", "e20", "e9"] as const).map((k) => (p.ema?.length ?? 0) > 1 && (
          <polyline key={k} points={line(p.ema.map((e) => ({ t: "", m: e.m, p: e[k] })))} fill="none" stroke={EMA_COL[k]} strokeWidth={1} opacity={0.85} />
        ))}
        {p.actual_path.length > 1 && <polyline points={line(p.actual_path)} fill="none" stroke="#e2e8f0" strokeWidth={1.6} />}
        {(p.breaks ?? []).map((b, i) => {
          const x = X(b.m), y = Y(b.p), up = b.dir === "UP", s = b.inval ? 7 : 5;
          const pts = up ? `${x},${y - 6 - s} ${x - s},${y - 6} ${x + s},${y - 6}` : `${x},${y + 6 + s} ${x - s},${y + 6} ${x + s},${y + 6}`;
          return <polygon key={`b${i}`} points={pts} fill={up ? "#22c55e" : "#ef4444"} stroke={b.inval ? "#fde047" : "#0a0e17"} strokeWidth={b.inval ? 1.5 : 0.8} />;
        })}
        <text x={PAD.l + 4} y={PAD.t + 12} fontSize={12} fill="#e2e8f0" fontFamily="monospace" fontWeight={700}>
          Güncelleme {etStamp(p.meta.asOf)} ET · son 5m kapanışı {p.meta.spot_et} · {p.meta.version || "canlı"}
        </text>
        <line x1={X(nowM)} x2={X(nowM)} y1={PAD.t} y2={H - PAD.b} stroke="#3b82f6" strokeWidth={0.9} strokeDasharray="2 3" />
        <circle cx={X(nowM)} cy={Y(p.meta.spot)} r={3.5} fill="#3b82f6" stroke="#fff" strokeWidth={1.2} />
        {hover != null && tip.length > 0 && <line x1={X(hover)} x2={X(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#475569" strokeWidth={0.8} />}
      </svg>
      {hover != null && tip.length > 0 && (
        <div className="pointer-events-none absolute top-2 rounded border border-slate-600 bg-black/90 px-2 py-1 font-mono text-[11px]" style={{ left: `${Math.min(70, (X(hover) / W) * 100 + 1)}%` }}>
          <div className="font-bold text-slate-200">{hh(hover)}</div>
          {tip.map((r) => <div key={r.k} style={{ color: r.c }}>{r.k}: {f2(r.v!)}</div>)}
        </div>
      )}
    </div>
  );
}

function LeanLine({ l }: { l: Lean | null }) {
  if (!l) return <NA />;
  return <span className={l.dir === "UP" ? "text-emerald-300" : l.dir === "DOWN" ? "text-rose-300" : "text-slate-400"}>{l.text}</span>;
}

// ── panel ─────────────────────────────────────────────────────────

export default function DayPlanPanel({ symbol }: { symbol: string }) {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [sel, setSel] = useState<string>("latest");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (version: string) => {
    try {
      const r = await fetch(`/api/admin/spyengine/v2/dayplan?symbol=${symbol}&version=${version}`, { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (j.plan) setPlan(j.plan);
      setVersions(j.versions ?? []);
      setErr(j.ok ? null : j.error ?? "veri yok");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [symbol]);

  useEffect(() => {
    const first = setTimeout(() => { void load(sel); }, 0);
    if (sel !== "latest") return () => clearTimeout(first);
    const id = setInterval(() => { void load("latest"); }, 30 * 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [load, sel]);

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/spyengine/v2/dayplan?symbol=${symbol}`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (j.ok) { setPlan(j.plan); setVersions(j.versions ?? []); setSel("latest"); setErr(null); }
      else setErr(j.error ?? `HTTP ${r.status}`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  if (!plan) return <div className="rounded border border-[#1a2433] px-3 py-8 text-center text-[12px] text-slate-500">{err ? `Günlük plan: ${err}` : "Günlük plan yükleniyor…"}</div>;
  return <DayPlanView p={plan} versions={versions} sel={sel} onSel={setSel} onRefresh={refresh} busy={busy} err={err} />;
}

type VersionRow = { v: number; asof_et: string; created_at_et: string; spot: number };

/** Saf görünüm (veri çekmez) — sürüm seçimi ve yenileme dışarıdan */
export function DayPlanView({ p, versions, sel, onSel, onRefresh, busy, err }: {
  p: DayPlan; versions: VersionRow[]; sel: string; onSel: (v: string) => void; onRefresh: () => void; busy: boolean; err: string | null;
}) {
  const dir = p.bias.dir;
  const dirCol = dir === "BEAR" ? "#f87171" : dir === "BULL" ? "#4ade80" : "#94a3b8";
  const oppCol = dir === "BULL" ? "#f87171" : "#4ade80";
  const colors: Record<string, { stroke: string; dash: string; label: string }> = {
    main: { stroke: dir === "NÖTR" ? "#93c5fd" : dirCol, dash: "", label: p.scenarios.find((s) => s.key === "main")?.label ?? "Ana" },
    break: { stroke: "#fbbf24", dash: "2 4", label: p.scenarios.find((s) => s.key === "break")?.label ?? "Retest kırılır" },
    invalid: { stroke: dir === "NÖTR" ? "#4ade80" : oppCol, dash: "7 5", label: p.scenarios.find((s) => s.key === "invalid")?.label ?? "Geçersiz" },
  };
  const c = p.cards;
  const touchOf = (z: Zone) => p.nextDays.mc?.zoneTouch.find((t) => Math.abs(t.price - (z.low + z.high) / 2) < 0.02)?.pct ?? null;
  const ring = p.score.value != null ? (p.score.value / 10) * 2 * Math.PI * 22 : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* 1) başlık */}
      <div className="flex items-start justify-between gap-3 rounded-lg border border-[#1c2635] bg-[#0f141d] px-3 py-2">
        <div className="min-w-0">
          <div className="text-[16px] font-bold text-slate-100">{p.meta.symbol} · {trLong(p.meta.date)} · <span className="font-mono">{p.meta.version || "canlı"}</span></div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[12px] text-slate-400">
            <span>güncelleme <b className="text-slate-100">{etStamp(p.meta.asOf)} ET</b></span>
            <span>spot <b className="text-slate-100">{f2(p.meta.spot)}</b> (5m kapanış {p.meta.spot_et})</span>
            {p.meta.prev_close != null && <span>dün kapanış {f2(p.meta.prev_close)} ({sg(p.meta.spot - p.meta.prev_close)})</span>}
            {c.rel.map((r) => <span key={r.symbol}>{r.symbol} {r.pct == null ? <NA /> : <b className={r.pct >= 0 ? "text-emerald-300" : "text-rose-300"}>{r.pct >= 0 ? "+" : ""}{r.pct.toFixed(2)}%</b>}</span>)}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: dirCol }}><b>{dir}</b> <span className="text-slate-400">— {p.bias.reason}</span></div>
        </div>
        <div className="relative h-[56px] w-[56px] shrink-0" title={`Skor ham değeri ${p.score.raw ?? "—"} (−100..+100)`}>
          <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
            <circle cx={28} cy={28} r={22} fill="none" stroke="#1e293b" strokeWidth={4} />
            <circle cx={28} cy={28} r={22} fill="none" stroke={dirCol} strokeWidth={4} strokeDasharray={`${ring} 999`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono leading-none">
            <span className="text-[17px] font-black text-slate-100">{p.score.value ?? "—"}</span>
            <span className="text-[11px] text-slate-500">/10</span>
          </div>
        </div>
      </div>

      {/* 2) metrik kartları */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card title="Premarket aralığı">
          {c.pm_range ? <>
            <div className="font-mono text-[16px] font-bold text-slate-100">{f2(c.pm_range.low)} – {f2(c.pm_range.high)}</div>
            <div className="text-[11.5px] text-slate-400">dip {c.pm_range.lowAt} · tepe {c.pm_range.highAt} · {c.pm_range.note}</div>
          </> : <NA />}
          {c.on_range && <div className="mt-0.5 text-[11px] text-slate-500">Gece {f2(c.on_range.low)}–{f2(c.on_range.high)} · {c.on_range.note}</div>}
        </Card>
        <Card title="Olaylar">
          {p.missing.includes("events_macro") && p.missing.includes("events_earnings") ? <NA /> : c.events.length ? (
            <ul className="flex flex-col gap-0.5 text-[12.5px]">
              {c.events.map((e, i) => <li key={i}><b className="font-mono text-slate-100">{e.time ?? "saat ?"}</b> <span className="text-slate-300">{e.name}</span></li>)}
            </ul>
          ) : <div className="text-[12px] text-slate-400">Bugün yüksek etkili olay yok</div>}
          {(p.missing.includes("events_macro") !== p.missing.includes("events_earnings")) && <div className="text-[11px] text-slate-500">{p.missing.includes("events_macro") ? "ekonomik takvim: veri yok" : "bilanço takvimi: veri yok"}</div>}
        </Card>
        <Card title="Beklenen hareket (EM)">
          {c.em ? <>
            <div className="font-mono text-[16px] font-bold text-slate-100">±{f2(c.em.value)} <span className="text-[12px] font-normal text-slate-400">{f2(c.em.low)} – {f2(c.em.high)}</span></div>
            <div className="text-[11.5px] text-slate-400">yarım EM {f2(c.em.halfLow)} / {f2(c.em.halfHigh)} · {c.em.ivLabel} {c.em.iv.toFixed(2)} · EM = kapanış × IV/√252</div>
          </> : <NA />}
          <div className="text-[11.5px] text-slate-400">ATM straddle: {c.straddle ? <>{f2(c.straddle.value)} ({c.straddle.expiry}, {c.straddle.strike}){c.straddle.ratio != null && <> · straddle/EM {c.straddle.ratio.toFixed(2)}</>}</> : <NA />}</div>
        </Card>
        <Card title="Gamma / opsiyon duvarları">
          {c.walls ? <div className="font-mono text-[12.5px] text-slate-200">
            flip {c.walls.flip != null ? f2(c.walls.flip) : <NA />} · call {c.walls.callWall ?? <NA />} · put {c.walls.putWall ?? <NA />}
            <div className="font-sans text-[11px] text-slate-500">{c.walls.source}</div>
          </div> : <NA />}
        </Card>
      </div>

      {/* 3) lejant */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11.5px]">
        <span className="flex items-center gap-1.5 text-slate-300"><svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke="#e2e8f0" strokeWidth="2" /></svg>Gerçekleşen</span>
        {p.scenarios.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5" style={{ color: colors[s.key].stroke }}>
            <svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke={colors[s.key].stroke} strokeWidth="2" strokeDasharray={colors[s.key].dash} /></svg>{s.label}
          </span>
        ))}
        {(["e9", "e20", "e50"] as const).map((k) => {
          const last = p.ema?.[p.ema.length - 1];
          return (
            <span key={k} className="flex items-center gap-1.5" style={{ color: EMA_COL[k] }}>
              <svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke={EMA_COL[k]} strokeWidth="1.5" /></svg>EMA{k.slice(1)}{last ? ` ${f2(last[k])}` : ""}
            </span>
          );
        })}
        <span className="flex items-center gap-1 text-slate-300"><span className="text-emerald-400">▲</span><span className="text-rose-400">▼</span> 5m kapanış kırılımı</span>
        <span className="rounded border border-slate-600/60 px-1.5 py-px text-[11px] text-slate-400">seviye tabanlı senaryo — olasılık değildir</span>
        <span className="text-[11px] text-slate-500">gölge: Ana ±1σ ({p.meta.profile === "sabit" ? "sabit profil" : `ölçülen profil, ${p.meta.sessions} seans`})</span>
      </div>

      {/* 4) ana grafik */}
      {/* mobilde grafik gerçek boyutunda (etiketler 11px), kendi kutusunda yatay kaydırılır */}
      <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-[#1a2433]">
        {p.scenarios.length || p.actual_path.length ? <Chart p={p} colors={colors} /> : <div className="px-3 py-10 text-center text-[12px] text-slate-500">Senaryo için yeterli seviye yok</div>}
      </div>

      {/* 4b) 5m kapanış kırılımları */}
      <Card title={`5m kırılımlar (bugün) · güncelleme ${etStamp(p.meta.asOf)} ET`}>
        {(p.breaks ?? []).length ? (
          <ul className="flex max-h-[180px] flex-col gap-0.5 overflow-y-auto font-mono text-[12px]">
            {[...p.breaks].reverse().map((b, i) => (
              <li key={i} className={b.dir === "UP" ? "text-emerald-300" : "text-rose-300"}>
                <b>{b.t}</b> {b.dir === "UP" ? "▲ yukarı kırılım" : "▼ aşağı kırılım"} {b.zone} · kapanış {f2(b.p)}
                {b.inval && <span className="ml-1 rounded bg-amber-400/20 px-1 text-amber-200">İPTAL</span>}
                <span className="font-sans text-[11px] text-slate-500"> — {b.label}</span>
              </li>
            ))}
          </ul>
        ) : <div className="text-[12px] text-slate-400">Bugün henüz 5m kapanışla kırılan önemli bölge yok</div>}
        <div className="mt-1 text-[11px] text-slate-500">Yalnız ret almış ya da ≥2 kaynaklı bölgeler; bölgenin 0,05 ötesinde 5m kapanış = kırılım, aynı yönde tekrar sayılmaz.</div>
      </Card>

      {/* 5) akış + seviyeler */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card title="Premarket akış">
          <ul className="flex flex-col gap-0.5 text-[12px] leading-snug text-slate-300">{p.texts.flow.map((t, i) => <li key={i}>• {t}</li>)}</ul>
        </Card>
        <Card title="Seviyeler">
          <div className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto font-mono text-[12px]">
            {p.levels.map((z, i) => {
              const t = touchOf(z);
              return (
                <div key={i} className={`flex items-baseline gap-2 ${z.type === "R" ? "text-rose-300" : z.type === "S" ? "text-emerald-300" : "text-slate-300"}`}>
                  <span className="w-[112px] shrink-0">{zf(z)}</span>
                  <span className="min-w-0 flex-1 truncate font-sans text-[11.5px] text-slate-400" title={z.label}>{z.label}</span>
                  {z.rejects > 0 && <span className="shrink-0 text-[11px] text-amber-300">{z.rejects} ret</span>}
                  {t != null && <span className="w-9 shrink-0 text-right text-[11px] text-slate-400" title="3 işlem gününde dokunma (Monte Carlo)">%{t}</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">kırmızı direnç · yeşil destek · gri fiyatın içinde · % = 3 günde dokunma (MC)</div>
        </Card>
      </div>

      {/* 6) uyarı + senaryo */}
      {p.texts.warning.length > 0 && (
        <Card title="Uyarı" tone="warn">
          <ul className="flex flex-col gap-0.5 text-[12.5px] leading-snug text-amber-200">{p.texts.warning.map((t, i) => <li key={i}>• {t}</li>)}</ul>
        </Card>
      )}
      <Card title="Senaryo" tone="info"><p className="text-[12.5px] leading-snug text-sky-200">{p.texts.scenario}</p></Card>

      {/* 7) koşullu plan */}
      <Card title="Plan (koşullu)">
        {p.plan.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12px]">
              <thead><tr className="text-left text-slate-500"><th className="py-0.5 pr-2 font-normal">Kurulum</th><th className="pr-2 font-normal">Giriş</th><th className="pr-2 font-normal">Hedef</th><th className="pr-2 font-normal">Stop</th><th className="font-normal">R:R</th></tr></thead>
              <tbody>
                {p.plan.map((r, i) => (
                  <tr key={i} className="border-t border-[#1c2635]/70 font-mono text-slate-200">
                    <td className={`py-0.5 pr-2 font-sans font-semibold ${r.setup.startsWith("Put") ? "text-rose-300" : "text-emerald-300"}`}>{r.setup}</td>
                    <td className="pr-2">{r.entry}</td>
                    <td className="pr-2">{r.targets.map(f2).join(" / ")}</td>
                    <td className="pr-2">{f2(r.stop)}</td>
                    <td className={Math.max(...r.rr) < 1 ? "text-amber-300" : ""} title={Math.max(...r.rr) < 1 ? "R:R < 1 — risk ödülden büyük" : undefined}>{r.rr.length > 1 ? `${Math.min(...r.rr).toFixed(1)}–${Math.max(...r.rr).toFixed(1)}` : r.rr[0].toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <NA />}
        <div className="mt-1 text-[11px] text-slate-500">R:R = |hedef − giriş| / |giriş − stop|. İşlem kararı Takip Sistemi tetiğiyle verilir; bu tablo koşullu plandır.</div>
      </Card>

      {/* 8) sonraki 15 dk + sonraki günler */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card title={`Sonraki 15 dk (${p.next15.at} dilimi)`}>
          <div className="font-mono text-[14px] font-bold text-slate-100">±{f2(p.next15.range)} <span className="text-[12px] font-normal text-slate-400">{f2(p.next15.lo)} – {f2(p.next15.hi)} (±1σ)</span></div>
          <div className="mt-0.5 text-[12px] text-slate-300">Durum: {p.next15.state ?? <NA />}</div>
          <div className="text-[12px]">Geçmiş: <LeanLine l={p.next15.lean} /></div>
          <div className="mt-0.5 text-[11px] text-slate-500">{p.next15.note} Yön yalnız n≥40, |z|≥2 ve iki yarı aynı yöndeyse yazılır.</div>
        </Card>
        <Card title="Sonraki günler">
          {p.nextDays.em.length ? (
            <div className="font-mono text-[12px] text-slate-300">{p.nextDays.em.map((e) => <div key={e.day}>{trShort(e.date)} ±1σ: {f2(e.low)} – {f2(e.high)}</div>)}</div>
          ) : <div className="text-[12px]">IV bandı: <NA /></div>}
          {p.nextDays.mc ? (
            <div className="mt-1 text-[12px] text-slate-300">
              Önce hangisi (MC, 3 gün): <b className="text-emerald-300">▲{f2(p.nextDays.mc.up.price)} %{p.nextDays.mc.up.pct}</b> · <b className="text-rose-300">▼{f2(p.nextDays.mc.down.price)} %{p.nextDays.mc.down.pct}</b>{p.nextDays.mc.none > 0 && <> · hiçbiri %{p.nextDays.mc.none}</>}
              <div className="font-mono text-[11.5px] text-slate-400">{p.nextDays.mc.dayEnds.slice(0, 3).map((d) => `${trShort(d.date)} %10–90 ${f2(d.p10)}–${f2(d.p90)}`).join(" · ")}</div>
            </div>
          ) : <div className="text-[12px]">Monte Carlo: <NA /></div>}
          <div className="mt-1 text-[12px] text-slate-300">Günlük durum: {p.nextDays.state}</div>
          <div className="text-[12px]">Ertesi gün: <LeanLine l={p.nextDays.lean1} /></div>
          <div className="text-[12px]">3 gün: <LeanLine l={p.nextDays.lean3} /></div>
          {p.nextDays.events.length > 0 && <div className="mt-1 text-[12px] text-amber-200">Yaklaşan: {p.nextDays.events.map((e) => `${trShort(e.date)} ${e.time ?? ""} ${e.name}`).join(" · ")}</div>}
        </Card>
      </div>

      {/* 9) sinyal haritası + teknik */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card title="Sinyal haritası">
          <div className="flex flex-col gap-1">
            {p.score.components.map((s) => (
              <div key={s.key} title={s.note}>
                <div className="flex justify-between text-[11.5px]"><span className="text-slate-300">{s.name}</span><span className="font-mono text-slate-400">{s.value == null ? "veri yok" : s.value > 0 ? `+${s.value}` : s.value}</span></div>
                <div className="relative h-1.5 rounded bg-slate-800">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
                  {s.value != null && <div className={`absolute top-0 h-full rounded ${s.value >= 0 ? "bg-emerald-500" : "bg-rose-500"}`} style={s.value >= 0 ? { left: "50%", width: `${s.value / 2}%` } : { right: "50%", width: `${-s.value / 2}%` }} />}
                </div>
                <div className="text-[11px] text-slate-500">{s.note}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Teknik">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[12px] text-slate-300">
            <span>4s RSI</span><span>{c.tech.rsi4h ?? <NA />}</span>
            <span>4s MACD / sinyal</span><span>{c.tech.macd4h != null ? `${c.tech.macd4h} / ${c.tech.signal4h}` : <NA />}</span>
            <span>4s histogram</span><span>{c.tech.hist4h ?? <NA />}</span>
            <span>4s ATR</span><span>{c.tech.atr4h ?? <NA />}</span>
            <span>200 SMA</span><span>{c.tech.sma200 ?? <NA />}</span>
            <span>Hacim oranı</span><span>{c.tech.volRatio != null ? `${c.tech.volRatio}x` : <NA />}</span>
            <span>PM VWAP</span><span>{c.tech.vwapPm ?? <NA />}</span>
            <span>RTH VWAP</span><span>{c.tech.vwapRth ?? <span className="text-slate-500">seans öncesi</span>}</span>
            {c.prev && <><span>Dün H/L</span><span>{f2(c.prev.high)} / {f2(c.prev.low)}</span></>}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">4s mumlar extended (04:00 hizalı); günlük ortalamalar temettü düzeltmeli.</div>
        </Card>
      </div>

      {/* 10) eksikler + sürüm */}
      {p.missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <span className="text-slate-500">Veri yok:</span>
          {p.missing.map((m) => <span key={m} className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-px text-slate-400">{missingLabel(m)}</span>)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1c2635] bg-[#0f141d] px-3 py-1.5 text-[12px]">
        <span className="text-slate-400">Sürüm</span>
        <select value={sel} onChange={(e) => onSel(e.target.value)} className="rounded border border-slate-600 bg-[#0b111b] px-1.5 py-0.5 font-mono text-[12px] text-slate-100">
          <option value="latest">son ({versions.length ? `v${versions[versions.length - 1].v}` : "—"})</option>
          {[...versions].reverse().map((v) => <option key={v.v} value={`v${v.v}`}>v{v.v} · {v.asof_et} ET · {f2(v.spot)}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={onRefresh} className="rounded border border-blue-400 bg-blue-500/20 px-2.5 py-0.5 font-semibold text-blue-100 hover:bg-blue-500/35 disabled:opacity-50">{busy ? "…" : "↻ Yenile"}</button>
        <span className="text-[11px] text-slate-500">motor {p.meta.engine} · hash {p.meta.inputs_hash} · snapshot {p.meta.asof_et} ET · sürümler 04:05 / 06:45 / 08:35 / 09:15 ve seansta 5 dk&apos;da bir</span>
        {err && <span className="text-[11px] text-amber-300">{err}</span>}
      </div>
    </div>
  );
}
