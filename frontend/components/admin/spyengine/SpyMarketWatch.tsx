"use client";

/**
 * SPY Engine — "SPY Piyasa Takibi" (varsayılan gizli). Gün içi SPY işlemcisinin bakması gereken semboller,
 * gruplu ve Türkçe açıklamalı (/api/admin/spyengine/v2/quotes?set=spy) + SPY'ın kendi seans verileri.
 * Yalnız BİLGİ: yön/işlem kararı vermez — karar üst banttaki Takip Sistemi'nde.
 */

import type { ReactNode } from "react";
import { nyClock } from "@/lib/spyengine/core";
import { SURFACE, num, signed, tone, type SpotStats, type StripQuote } from "@/components/admin/spyengine/panels";
import type { SessionPhase } from "@/lib/spyengine/core";

export type WatchQuote = StripQuote & { group?: string };

const GROUPS: { key: string; title: string; hint: string }[] = [
  { key: "spy", title: "SPY ve S&P 500", hint: "işlem yaptığımız ETF, endeksin kendisi, vadeli ve genişlik" },
  { key: "risk", title: "Risk ve korku göstergeleri", hint: "VIX yükselirse SPY'a genelde baskı; faiz ve dolar yükselişi de hisseleri zorlar" },
  { key: "idx", title: "Diğer endeksler", hint: "teknoloji, küçük şirketler ve Dow — SPY ile aynı yönde mi?" },
  { key: "sector", title: "Sektörler", hint: "S&P 500'ün ağırlıklı sektörleri — hareketi kim taşıyor?" },
  { key: "lead", title: "SPY'ın en büyük hisseleri", hint: "endeksin yaklaşık üçte biri — liderler düşerse SPY'ın yükselmesi zor" },
];

const pct = (x: number | null | undefined) => (x == null ? "—" : `${signed(x, 2)}%`);
const arrow = (x: number | null | undefined) => (x == null ? "" : x > 0 ? "▲" : x < 0 ? "▼" : "▬");

function Cell({ q }: { q: WatchQuote }) {
  const isYield = q.label === "TNX";
  return (
    <a href={`/global/tr/graphic/${encodeURIComponent(q.symbol)}`} target="_blank" rel="noreferrer" className="block bg-[#0f141d] px-2.5 py-1.5 transition-colors hover:bg-[#1c2635]" title={`${q.name} (${q.symbol}) — detay grafik`}>
      <div className="truncate text-[10.5px] leading-tight text-slate-400">{q.name}</div>
      <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
        <span className="text-[11px] font-bold text-sky-300">{q.label}{q.extended && <span className="ml-1 text-[8px] font-semibold text-amber-400/80">seans dışı</span>}</span>
        {q.error || q.price == null ? <span className="font-mono text-[10px] text-slate-600">veri yok</span> : (
          <span className="font-mono text-[12px] tabular-nums text-slate-100">{isYield ? `%${num(q.price, 2)}` : num(q.price, q.price > 1000 ? 0 : 2)}</span>
        )}
      </div>
      {q.price != null && !q.error && (
        <div className="mt-0.5 flex items-baseline justify-between gap-1 whitespace-nowrap font-mono text-[10px] tabular-nums">
          <span className={tone(q.changePct)}>gün {arrow(q.changePct)}{pct(q.changePct)}</span>
          <span className={tone(q.changePctHour ?? null)}>1sa {arrow(q.changePctHour)}{pct(q.changePctHour)}</span>
        </div>
      )}
    </a>
  );
}

function Stat({ k, v, sub, cls }: { k: string; v: ReactNode; sub?: ReactNode; cls?: string }) {
  return (
    <div className="rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-1">
      <div className="text-[10px] text-slate-500">{k}</div>
      <div className={`font-mono text-[13px] font-semibold ${cls ?? "text-slate-100"}`}>{v}</div>
      {sub != null && <div className="text-[10px] leading-snug text-slate-500">{sub}</div>}
    </div>
  );
}

const PHASE_TR: Record<SessionPhase, string> = { PRE: "seans öncesi", RTH: "seans içi", POST: "seans sonrası", CLOSED: "piyasa kapalı" };

export default function SpyMarketWatch({ symbol = "SPY", quotes, updatedAt, spot, phase }: { symbol?: string; quotes: WatchQuote[]; updatedAt: number | null; spot: SpotStats | null; phase: SessionPhase }) {
  const by = (l: string) => quotes.find((q) => q.label === l && !q.error && q.price != null) ?? null;
  const spy = by("SPY"), es = by("ES"), vix = by("VIX"), vix9 = by("VIX9D"), rsp = by("RSP"), tnx = by("TNX"), dxy = by("DXY");
  const leaders = quotes.filter((q) => q.group === "lead" && q.changePct != null);
  const upLeaders = leaders.filter((q) => (q.changePct ?? 0) > 0).length;

  // öncü okumalar — yalnız olgu + genel anlamı (karar değil)
  const notes: { t: string; c: string }[] = [];
  if (spy?.changePct != null && es?.changePct != null) {
    const same = Math.sign(spy.changePct) === Math.sign(es.changePct);
    notes.push({ t: `Vadeli (ES) ${pct(es.changePct)} · SPY ${pct(spy.changePct)} — ${same ? "aynı yönde" : "ayrışıyor (dikkat)"}`, c: same ? "text-slate-300" : "text-amber-300" });
  }
  if (vix?.changePct != null) notes.push({ t: `VIX ${num(vix.price, 2)} (${pct(vix.changePct)}) — korku ${vix.changePct > 0 ? "artıyor: SPY için genelde baskı" : "azalıyor: SPY için genelde destek"}`, c: vix.changePct > 0 ? "text-[#f87171]" : "text-[#4ade80]" });
  if (vix?.price != null && vix9?.price != null) notes.push({ t: `Kısa vade korku (VIX9D ${num(vix9.price, 2)}) ${vix9.price > vix.price ? "30 günlükten yüksek — gün içi oynaklık/gerginlik yüksek" : "30 günlükten düşük — kısa vadede sakin"}`, c: vix9.price > vix.price ? "text-amber-300" : "text-slate-300" });
  if (rsp?.changePct != null && spy?.changePct != null) {
    const diff = rsp.changePct - spy.changePct;
    notes.push({ t: `Genişlik: eşit ağırlık (RSP) SPY'dan ${diff >= 0 ? "güçlü" : "zayıf"} (${signed(diff, 2)} puan) — ${diff >= 0 ? "hareket geniş tabanlı" : "hareketi birkaç büyük hisse taşıyor"}`, c: "text-slate-300" });
  }
  if (leaders.length) notes.push({ t: `Büyük hisseler: ${leaders.length} liderden ${upLeaders}'i yükselişte`, c: upLeaders * 2 > leaders.length ? "text-[#4ade80]" : upLeaders * 2 < leaders.length ? "text-[#f87171]" : "text-slate-300" });
  if (tnx?.changePct != null) notes.push({ t: `10 yıllık faiz %${num(tnx.price, 2)} (${pct(tnx.changePct)}) — ${tnx.changePct > 0 ? "yükselen faiz hisseleri zorlar" : "düşen faiz hisseleri rahatlatır"}`, c: "text-slate-300" });
  if (dxy?.changePct != null) notes.push({ t: `Dolar endeksi ${num(dxy.price, 2)} (${pct(dxy.changePct)}) — ${dxy.changePct > 0 ? "güçlenen dolar genelde baskı" : "zayıflayan dolar genelde destek"}`, c: "text-slate-300" });

  const vwapSide = spot?.price != null && spot.vwap != null ? (spot.price > spot.vwap ? "fiyat VWAP üstünde" : spot.price < spot.vwap ? "fiyat VWAP altında" : "VWAP'ta") : "VWAP oluşmadı";
  const gap = spot && spot.preHigh != null && spot.prevClose != null && spot.price != null ? spot.price - spot.prevClose : null;

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[13px] font-semibold text-slate-200">{symbol} Piyasa Takibi <span className="text-[11px] font-normal text-slate-500">· bilgi — işlem kararı üst banttaki Takip Sistemi&apos;nde</span></span>
        <span className="font-mono text-[10.5px] text-slate-500">{updatedAt ? `${nyClock(updatedAt, true)} ET` : "veri bekleniyor"} · {PHASE_TR[phase]}</span>
      </div>

      {/* SPY'ın kendi verileri */}
      <div className="grid grid-cols-2 gap-1.5 border-b border-[#1c2635] p-2 sm:grid-cols-4 xl:grid-cols-8">
        <Stat k={`${symbol} fiyat`} v={spot?.price != null ? `$${num(spot.price)}` : "—"} sub={spot?.priceTime ? `${nyClock(spot.priceTime, true)} ET` : undefined} />
        <Stat k="Günlük değişim" v={pct(spot?.changePct)} cls={tone(spot?.changePct ?? null)} sub={spot?.change != null ? `${signed(spot.change)} $ · dünkü kapanış ${num(spot.prevClose)}` : undefined} />
        <Stat k="Seans zirve / dip" v={spot?.rthHigh != null ? `${num(spot.rthHigh)} / ${num(spot.rthLow)}` : "—"} sub={spot?.rangePct != null ? `fiyat aralığın %${num(spot.rangePct, 0)}'inde` : "seans başlamadı"} />
        <Stat k="Seans öncesi zirve / dip" v={spot?.preHigh != null ? `${num(spot.preHigh)} / ${num(spot.preLow)}` : "—"} sub={gap != null && phase === "PRE" ? `açılış farkı (gap) ${signed(gap)} $` : "premarket aralığı"} />
        <Stat k="VWAP" v={spot?.vwap != null ? num(spot.vwap) : "—"} sub={vwapSide} />
        <Stat k="Ort. 1 dk hareket (ATR)" v={spot?.atr14 != null ? num(spot.atr14, 3) : "—"} sub="oynaklık ölçüsü" />
        <Stat k="Seans hacmi" v={spot?.rthVolume ? Math.round(spot.rthVolume).toLocaleString("tr-TR") : "—"} sub={spot?.volume ? `seans dışı dahil ${Math.round(spot.volume).toLocaleString("tr-TR")}` : undefined} />
        <Stat k="Seans tarihi" v={spot?.date ?? "—"} sub="New York takvimi" />
      </div>

      {/* öncü okumalar */}
      {notes.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 border-b border-[#1c2635] px-3 py-1.5 text-[11.5px] leading-snug md:grid-cols-2">
          {notes.map((n, i) => <li key={i} className={n.c}>• {n.t}</li>)}
        </ul>
      )}

      {/* gruplar */}
      {GROUPS.map((g) => {
        const qs = quotes.filter((q) => q.group === g.key);
        if (!qs.length) return null;
        return (
          <div key={g.key} className="border-b border-[#1c2635] last:border-0">
            <div className="flex flex-wrap items-baseline gap-2 px-3 pt-1.5">
              <span className="text-[11.5px] font-semibold text-slate-300">{g.title}</span>
              <span className="text-[10.5px] text-slate-500">{g.hint}</span>
            </div>
            <div className="grid gap-px bg-[#1c2635] p-px [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
              {qs.map((q) => <Cell key={q.symbol} q={q} />)}
            </div>
          </div>
        );
      })}
      <div className="px-3 py-1 text-[10px] text-slate-600">Fiyatlar ~15 sn&apos;de bir yenilenir (Yahoo, seans dışı fiyat dahil). Karta tıklayınca detay grafik yeni sekmede açılır. 1sa = son 1 saatteki değişim.</div>
    </div>
  );
}
