"use client";

import { useEffect, useState } from "react";
import { SURFACE } from "@/components/admin/spyengine/panels";
import type { GexRead, GexScope } from "@/lib/spyengine/gex";
import type { GexSnapshot } from "@/lib/spyengine/gexStore";
import { usePersistedState } from "@/lib/spyengine/usePersistedState";

const SHOW_BTN = "rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300 shadow-sm hover:bg-sky-500/30";
const money = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("tr-TR")} M$`;
const px = (v: number | null) => (v == null ? "—" : v.toFixed(2));
const cls = (v: number) => (v >= 0 ? "text-[#4ade80]" : "text-[#f87171]");

function Row({ label, s }: { label: string; s: GexScope | null }) {
  if (!s) return <tr className="border-t border-[#151c28] text-slate-500"><td className="py-1 pr-3">{label}</td><td colSpan={5}>veri yok</td></tr>;
  return (
    <tr className="border-t border-[#151c28] text-slate-300">
      <td className="py-1 pr-3 font-sans">{label}</td>
      <td className={`pr-3 text-right ${cls(s.cboeM)}`}>{money(s.cboeM)}</td>
      <td className={`pr-3 text-right ${cls(s.ownM)}`}>{money(s.ownM)}</td>
      <td className="pr-3 text-right">{px(s.flip)}</td>
      <td className="pr-3 text-right">{px(s.callWall)}</td>
      <td className="text-right">{px(s.putWall)}</td>
    </tr>
  );
}

/** SPY gamma gözlemi: Takip Sistemi kararlarına girmez. */
export default function GexCard() {
  const [open, setOpen] = usePersistedState("spyengine_ui_gex", false);
  const [read, setRead] = useState<GexRead | null>(null);
  const [snapshots, setSnapshots] = useState<GexSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v2/gex", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        setRead(json.read ?? null);
        setSnapshots(Array.isArray(json.snapshots) ? json.snapshots : []);
        setError(json.ok ? null : json.error ?? "veri alınamadı");
      } catch {
        if (!cancelled) setError("veri alınamadı");
      }
    };
    void load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className={SHOW_BTN}>{open ? "▴ gizle" : "▾ göster"}</button>
        <span className="text-[13px] font-semibold text-slate-200">Gamma Kaydı</span>
        <span className="text-[11px] text-slate-500">· gözlem, karar vermez · bugün {snapshots.length} kayıt</span>
        {read?.d7 && <span className="ml-auto font-mono text-[11px] text-slate-400">7 gün flip {px(read.d7.flip)} · spot {px(read.spot)}</span>}
      </div>
      {open && (
        <div className="border-t border-[#1c2635] px-3 py-2">
          {!read ? <div className="text-[12px] text-slate-500">{error ?? "Veri bekleniyor."}</div> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] font-mono text-[11.5px]">
                  <thead className="text-[10.5px] text-slate-500">
                    <tr><th className="pb-1 text-left font-normal">kapsam</th><th className="text-right font-normal">Cboe gamma</th><th className="text-right font-normal">model gamma</th><th className="text-right font-normal">flip</th><th className="text-right font-normal">call duvarı</th><th className="text-right font-normal">put duvarı</th></tr>
                  </thead>
                  <tbody>
                    <Row label={`ilk vade ${read.firstExpiry?.slice(5) ?? ""}`} s={read.d0} />
                    <Row label="7 güne kadar" s={read.d7} />
                    <Row label="45 güne kadar" s={read.d45} />
                  </tbody>
                </table>
              </div>
              <div className="mt-1 text-[10.5px] leading-snug text-slate-500">
                Cboe gecikmeli veri {read.source || "—"} · ATM IV {read.atmIv != null ? `%${(read.atmIv * 100).toFixed(1)}` : "—"} · OI&apos;li kontrat {read.quality.oiPos}/{read.quality.contracts}.
                Model tahminidir: dealer yönü varsayımdır, OI önceki güne aittir ve kapsam değişince işaret değişebilir. Yön ya da giriş sinyali olarak kullanma.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
