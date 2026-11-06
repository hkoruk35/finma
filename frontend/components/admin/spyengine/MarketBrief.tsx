"use client";

import type { MarketBrief as Brief, MarketTone } from "@/lib/spyengine/marketState";

const COLOR: Record<MarketTone, string> = {
  bull: "#22c55e", bear: "#ef4444", warn: "#eab308", danger: "#ef4444", neutral: "#94a3b8",
};

/** Sayfanın üst özeti. İşlem talimatı Takip Sistemi'nden gelir; piyasa etiketi yalnız son saatin durumunu anlatır. */
export default function MarketBrief({ brief }: { brief: Brief | null }) {
  if (!brief) {
    return (
      <section className="rounded-lg border border-[#1c2635] bg-[#0f141d] px-4 py-3" aria-label="Piyasa durumu">
        <div className="text-[12px] font-semibold text-slate-400">Piyasa Durumu</div>
        <div className="mt-1 text-[18px] font-black text-slate-200">VERİ BEKLENİYOR</div>
      </section>
    );
  }
  const col = COLOR[brief.tone];
  return (
    <section className="overflow-hidden rounded-lg border-2 bg-[#0f141d]" style={{ borderColor: col }} aria-label="Piyasa durumu" role={brief.tone === "danger" ? "alert" : undefined}>
      <div className="px-4 py-2.5" style={{ backgroundColor: `${col}14` }}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Piyasa Durumu · sistem yönlendirmesi</div>
        <div className="mt-0.5 text-[24px] font-black leading-tight tracking-wide" style={{ color: col }}>{brief.title}</div>
        <div className="mt-1 text-[14px] font-semibold leading-snug text-slate-100">{brief.action}</div>
      </div>
      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] sm:grid-cols-2 xl:grid-cols-6">
        {brief.tiles.map((t) => (
          <div key={t.label} className="min-w-0 bg-[#0f141d] px-3 py-2">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{t.label}</div>
            <div className="mt-0.5 text-[15px] font-extrabold leading-tight" style={{ color: COLOR[t.tone] }}>{t.value}</div>
            <div className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{t.note}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
        Durum etiketi son saati anlatır, sonraki yönü garanti etmez. İşlem kararı yalnız Takip Sistemi tetiğiyle verilir.
      </div>
    </section>
  );
}
