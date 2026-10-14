"use client";

/**
 * SPY / QQQ Engine — Önerilen İşlemler kaydı: bugün motorun önerdiği işlemler (canlı) + karar günlüğü arşivindeki
 * geçmiş günler (Supabase'te donmuş kayıtlar, son 60 seans). Hesap yok; yalnız listeler.
 */

import { useState } from "react";

export interface TradeRow {
  date: string; clock: string; side: string; mode: string; setup: string;
  entry: number; stop: number; target: number;
  exitClock: string | null; exit: number | null; exitWhy: string | null; r: number | null;
}

const f2 = (x: number | null | undefined) => (x == null ? "—" : x.toFixed(2));
const sgn = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`;

export default function TradeLogPanel({ today, past }: { today: TradeRow[]; past: TradeRow[] }) {
  const [days, setDays] = useState(10);
  const todayDate = today[0]?.date;
  const archive = past.filter((t) => t.date !== todayDate);
  const dates = Array.from(new Set(archive.map((t) => t.date))).sort().reverse();
  const shown = dates.slice(0, days);
  const rows = [...today, ...archive.filter((t) => shown.includes(t.date))].sort((a, b) => (a.date === b.date ? b.clock.localeCompare(a.clock) : b.date.localeCompare(a.date)));
  const done = rows.filter((t) => t.r != null);
  const sumR = done.reduce((a, t) => a + (t.r ?? 0), 0);
  const wins = done.filter((t) => (t.r ?? 0) > 0).length;
  const byMode: Record<string, { n: number; R: number }> = {};
  for (const t of done) { const m = (byMode[t.mode] ??= { n: 0, R: 0 }); m.n++; m.R += t.r ?? 0; }

  return (
    <div className="overflow-hidden rounded-lg border border-[#1c2635] bg-[#0f141d]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">Önerilen İşlemler</span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          {done.length} kapanan · %{done.length ? Math.round((100 * wins) / done.length) : 0} kazanç · <b className={sumR >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{sgn(sumR)}R</b>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded border border-[#1c2635] bg-[#0a0e17] px-1 py-0.5 text-[11px] text-slate-300">
            {[5, 10, 20, 60].map((n) => <option key={n} value={n}>bugün + son {n} gün</option>)}
          </select>
        </span>
      </div>
      {Object.keys(byMode).length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-[#1c2635] px-3 py-1 font-mono text-[10.5px] text-slate-400">
          {Object.entries(byMode).map(([m, v]) => <span key={m}>{m}: {v.n} işlem · <span className={v.R >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{sgn(v.R)}R</span></span>)}
        </div>
      )}
      <div className="max-h-[460px] overflow-auto">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0 bg-[#0f141d] text-slate-500">
            <tr>
              <th className="px-2 py-1 text-left font-normal">tarih</th><th className="px-2 text-left font-normal">saat</th><th className="px-2 text-left font-normal">yön</th>
              <th className="px-2 text-left font-normal">mod / kurulum</th><th className="px-2 text-right font-normal">giriş</th><th className="px-2 text-right font-normal">stop</th>
              <th className="px-2 text-right font-normal">hedef</th><th className="px-2 text-left font-normal">çıkış</th><th className="px-2 text-right font-normal">R</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-4 text-center text-slate-500">Kayıtlı işlem yok.</td></tr>}
            {rows.map((t, i) => (
              <tr key={`${t.date}-${t.clock}-${t.mode}-${i}`} className={`border-t border-[#151c28] ${t.date === todayDate ? "bg-sky-500/5" : ""}`}>
                <td className="px-2 py-1 font-mono text-slate-400">{t.date === todayDate ? "bugün" : t.date.slice(5)}</td>
                <td className="px-2 font-mono text-slate-300">{t.clock}</td>
                <td className={`px-2 font-bold ${t.side === "CALL" ? "text-[#4ade80]" : "text-[#f87171]"}`}>{t.side}</td>
                <td className="px-2 text-slate-300"><span className="font-semibold">{t.mode}</span> <span className="text-slate-500">· {t.setup}</span></td>
                <td className="px-2 text-right font-mono text-slate-200">{f2(t.entry)}</td>
                <td className="px-2 text-right font-mono text-slate-400">{f2(t.stop)}</td>
                <td className="px-2 text-right font-mono text-slate-400">{f2(t.target)}</td>
                <td className="px-2 font-mono text-slate-400">{t.exitClock ? `${t.exitClock} ${f2(t.exit)} · ${t.exitWhy ?? ""}` : <span className="text-sky-300">açık</span>}</td>
                <td className={`px-2 text-right font-mono font-semibold ${t.r == null ? "text-slate-500" : t.r >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>{t.r == null ? "—" : sgn(t.r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
        Bugünkü satırlar motorun canlı hesabından; geçmiş günler her seans kapanışında karar günlüğüne (Supabase) dondurulan kayıtlardan gelir. Önceki günler o günkü motor sürümüyle üretildiği için bugünkü kurallardan farklı olabilir.
      </div>
    </div>
  );
}
