"use client";

/**
 * SPY Engine — Karar Günlüğü & Öğrenen Model paneli: arşivlenen kararların sonuçları, mod güveni,
 * gölge (kapalı) modlar, eğitim notları ve son günlerin dersleri. Hesaplar lib/spyengine/decisionCore.ts'te.
 */

import type { DecisionDay, DecisionModel, LoggedAttempt, ModeStat, Trust } from "@/lib/spyengine/decisionCore";

export interface DecisionResp { ok: boolean; model: DecisionModel; recent: DecisionDay[]; count: number; added: string[]; trades?: (LoggedAttempt & { date: string })[] }

const TRUST_CLS: Record<Trust, string> = {
  YÜKSEK: "border-[#22c55e]/50 bg-[#22c55e]/10 text-[#4ade80]",
  ORTA: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  DÜŞÜK: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  KAPAT: "border-[#ef4444]/50 bg-[#ef4444]/10 text-[#f87171]",
  YETERSİZ: "border-slate-700 bg-slate-800/40 text-slate-400",
};
const sgn = (x: number, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;

function Row({ m, s, shadow }: { m: string; s: ModeStat & { reopen?: boolean }; shadow?: boolean }) {
  return (
    <tr className="border-b border-[#151c28] last:border-0">
      <td className="py-1 pr-2 text-slate-200">{m}{shadow && <span className="ml-1 text-[10px] text-slate-500">(gölge)</span>}</td>
      <td className="px-2 text-right font-mono">{s.n}</td>
      <td className="px-2 text-right font-mono">%{s.n ? Math.round((100 * s.wins) / s.n) : 0}</td>
      <td className={`px-2 text-right font-mono ${s.sumR >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>{sgn(s.sumR, 1)}R</td>
      <td className="px-2 text-right font-mono">{sgn(s.avgR)} <span className="text-slate-500">±{s.se}</span></td>
      <td className="px-2 text-right font-mono">{s.recentAvgR != null ? sgn(s.recentAvgR) : "—"}</td>
      <td className="pl-2 text-right"><span className={`rounded border px-1.5 py-0.5 text-[10.5px] font-semibold ${TRUST_CLS[s.level]}`}>{s.level}{s.reopen ? " · AÇ?" : ""}</span></td>
    </tr>
  );
}

export default function DecisionLogPanel({ r }: { r: DecisionResp | null }) {
  if (!r || !r.model) return <div className="rounded-lg border border-[#1c2635] bg-[#0f141d] px-4 py-6 text-center text-[12px] text-slate-500">Karar günlüğü yükleniyor…</div>;
  const m = r.model;
  const modes = Object.entries(m.modes).sort((a, b) => b[1].n - a[1].n);
  const shadow = Object.entries(m.shadow);
  const lessons = Object.entries(m.lessons).sort((a, b) => b[1].n - a[1].n);
  return (
    <div className="overflow-hidden rounded-lg border border-[#1c2635] bg-[#0f141d]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">Karar Günlüğü &amp; Öğrenen Model</span>
        <span className="font-mono text-[11px] text-slate-500">{m.days} gün arşiv ({m.liveDays} canlı) · {m.trades} işlem · {m.version}</span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-[#1c2635] lg:grid-cols-2">
        <div className="bg-[#0f141d] px-3 py-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mod güveni (arşivden öğrenilen)</div>
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-slate-500"><th className="text-left font-normal">mod</th><th className="px-2 text-right font-normal">işlem</th><th className="px-2 text-right font-normal">kazanç</th><th className="px-2 text-right font-normal">toplam</th><th className="px-2 text-right font-normal">ort. R</th><th className="px-2 text-right font-normal">son 12</th><th className="pl-2 text-right font-normal">güven</th></tr></thead>
            <tbody>
              {modes.map(([k, s]) => <Row key={k} m={k} s={s} />)}
              {shadow.map(([k, s]) => <Row key={`s${k}`} m={k} s={s} shadow />)}
            </tbody>
          </table>
          <div className="mt-1.5 text-[10.5px] leading-snug text-slate-500">
            Güven: ≥{30} işlemde ortalama R ve belirsizlik (±SE) · KAPAT = kanıt güçlü eksiyse mod otomatik kapanır · gölge = kapalı modun izlenen sonuçları (otomatik açılmaz; &quot;AÇ?&quot; yalnız öneri).
            {m.disabled.length > 0 && <b className="text-[#f87171]"> Şu an otomatik kapalı: {m.disabled.join(", ")}.</b>}
          </div>
        </div>

        <div className="bg-[#0f141d] px-3 py-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Model notları</div>
          <ul className="flex flex-col gap-1 text-[12px] leading-snug text-slate-200">
            {m.insights.length ? m.insights.map((x, i) => <li key={i} className="flex gap-1.5"><span className="text-slate-500">•</span><span>{x}</span></li>) : <li className="text-slate-500">Henüz yeterli kayıt yok.</li>}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1">
            {lessons.map(([k, v]) => <span key={k} className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400">{k.replace(/_/g, " ").toLowerCase()} · {v.n}{v.of ? `/${v.of}` : ""}</span>)}
          </div>
        </div>
      </div>

      <div className="border-t border-[#1c2635] px-3 py-2">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Son günler — kararlar ve dersler</div>
        <div className="flex flex-col gap-1.5">
          {r.recent.map((d) => (
            <div key={d.date} className="rounded border border-[#151c28] px-2 py-1.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[11.5px]">
                <b className="text-slate-200">{d.date}</b>
                <span className="text-slate-400">açılış: {d.opening.label}{d.opening.right != null ? (d.opening.right ? " ✓" : " ✕") : ""}</span>
                <span className={d.summary.R >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{d.summary.n} işlem · {sgn(d.summary.R, 1)}R · {sgn(d.summary.pts)} puan</span>
                <span className="text-slate-500">{d.transitions.length} karar değişimi · {d.warnings.length} uyarı{d.live?.length ? ` · ${d.live.length} canlı kayıt` : ""}{d.backfill ? " · geriye dönük" : ""}</span>
              </div>
              {d.attempts.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-slate-400">
                  {d.attempts.map((a, i) => <span key={i}>{a.clock} {a.side} {a.mode.split(" ")[0]} → {a.exitWhy ?? "açık"} {a.r != null ? sgn(a.r) + "R" : ""}</span>)}
                </div>
              )}
              {d.lessons.filter((l) => !["HEDEF", "STOP_DOĞRU"].includes(l.tag) && !(l.tag === "KARŞI_MOMENTUM" && l.text.includes("sonuç KÂR"))).slice(0, 3).map((l, i) => <div key={i} className="mt-0.5 text-[11px] leading-snug text-amber-200/90">📝 {l.text}</div>)}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
        Her seans kapandığında motorun tüm kararları (durum geçişleri, uyarılar, işlemler, açılış, 15m tahminleri) tarihli arşive donduruluyor; model bu sonuçlardan her yeni günde yeniden öğreniyor.
        Otomatik değişiklik yalnızca kanıt güçlü eksi olan modu kapatmaktır; eşik/stop değişiklikleri öneri olarak kalır. Geçmiş sonuç geleceği garanti etmez.
      </div>
    </div>
  );
}
