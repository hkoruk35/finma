"use client";

/**
 * SPY Engine — sonuç odaklı gerekçe kartları: gün yönelimi şeridi · VWAP · EMA20 · alıcı/satıcı hacmi ·
 * emir defteri + opsiyon Call/Put akışı. Hesaplar lib/spyengine/evidence.ts'te; burada yalnız sunum.
 */

import type { ReactNode } from "react";
import type { BookRead, DayBias, EmaTf, OptionFlowRead, PressureRead, PressureWin, Side, VwapRead } from "@/lib/spyengine/evidence";

const UP = "#22c55e", DN = "#ef4444", NEU = "#94a3b8";
const sideCol = (s: Side | null | undefined) => (s === 1 ? UP : s === -1 ? DN : NEU);
const num = (x: number) => x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sg = (x: number, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;
const kfmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(Math.round(v)));
const SURFACE = "rounded-lg border border-[#1c2635] bg-[#0f141d]";

function Card({ title, chip, side, headline, children, verdict }: {
  title: string; chip?: string; side: Side | null | undefined; headline: string; children?: ReactNode; verdict?: string;
}) {
  const c = sideCol(side);
  return (
    <div className={`${SURFACE} flex flex-col overflow-hidden`} style={{ borderColor: `${c}55` }}>
      <div className="flex items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="truncate text-[13px] font-semibold text-slate-200">{title}</span>
        {chip && <span className="shrink-0 font-mono text-[10.5px] text-slate-500">{chip}</span>}
      </div>
      <div className="px-3 py-2" style={{ backgroundColor: `${c}12` }}>
        <div className="text-[16px] font-extrabold leading-tight tracking-wide" style={{ color: c }}>
          {side === 1 ? "▲ " : side === -1 ? "▼ " : "◆ "}{headline}
        </div>
      </div>
      {children && <div className="flex-1 px-3 py-1.5">{children}</div>}
      {verdict && <div className="border-t border-[#1c2635] px-3 py-1.5 text-[12px] leading-snug text-slate-200">{verdict}</div>}
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#151c28] py-[3px] text-[11.5px] last:border-0">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className="min-w-0 text-right font-mono text-slate-200">{children}</span>
    </div>
  );
}

/** İki renkli oran çubuğu (sol = alıcı/call yeşil, sağ = satıcı/put kırmızı) */
function SplitBar({ left, label, lLabel, rLabel }: { left: number; label: string; lLabel: string; rLabel: string }) {
  const l = Math.round(Math.max(0, Math.min(1, left)) * 100);
  return (
    <div className="py-[3px]">
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className="text-slate-500">{label}</span>
        <span className="font-mono"><b className="text-[#4ade80]">{lLabel} %{l}</b> <span className="text-slate-600">·</span> <b className="text-[#f87171]">{rLabel} %{100 - l}</b></span>
      </div>
      <div className="flex h-2 overflow-hidden rounded bg-[#1c2635]">
        <div style={{ width: `${l}%`, backgroundColor: UP }} />
        <div style={{ width: `${100 - l}%`, backgroundColor: DN }} />
      </div>
    </div>
  );
}

export function BiasStrip({ b }: { b: DayBias }) {
  const c = sideCol(b.side);
  return (
    <div className={`${SURFACE} flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2`} style={{ borderColor: `${c}66`, backgroundColor: `${c}0f` }}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Gün yönelimi</span>
      <b className="text-[15px]" style={{ color: c }}>{b.side === 1 ? "▲" : b.side === -1 ? "▼" : "◆"} {b.headline}</b>
      <span className="flex flex-wrap gap-1">
        {b.items.map((i) => (
          <span key={i.label} className="rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: sideCol(i.side), borderColor: `${sideCol(i.side)}55` }}>
            {i.side === 1 ? "▲" : i.side === -1 ? "▼" : "◆"} {i.label}
          </span>
        ))}
      </span>
      <span className="ml-auto text-[10.5px] text-slate-500">gerekçe özeti — işlem kararı Karar Merdiveni&apos;nde</span>
    </div>
  );
}

export function VwapCard({ r, clock }: { r: VwapRead | null; clock: string | null }) {
  if (!r) return <Card title="VWAP" side={0} headline="VERİ BEKLENİYOR" verdict="İlk 5m kapanışla başlar." />;
  return (
    <Card title="VWAP" chip={clock ? `son 5m ${clock}` : undefined} side={r.side} headline={r.headline} verdict={r.verdict}>
      <Row k="VWAP · 30 dk eğim">{num(r.vwap)} · <span style={{ color: sideCol(r.slope30 == null ? 0 : r.slope30 > 0.05 ? 1 : r.slope30 < -0.05 ? -1 : 0) }}>{r.slope30 != null ? sg(r.slope30) : "—"}</span></Row>
      <Row k="Fiyatın uzaklığı">{sg(r.dev)} puan · {sg(r.z, 1)}σ{r.devAtr != null ? ` · ${sg(r.devAtr, 1)} ATR` : ""}</Row>
      <Row k="Bant ±1σ">{num(r.bands.dn1)} – {num(r.bands.up1)}</Row>
      <Row k="Bant ±2σ (aşırı)">{num(r.bands.dn2)} – {num(r.bands.up2)}</Row>
      <Row k="Gün içinde VWAP üstü kapanış">%{r.abovePct}</Row>
      <Row k="Son 2 saatte kesişim">{r.crosses2h}{r.crosses2h >= 4 ? " · testere" : r.crosses2h === 0 ? " · temiz trend" : ""}</Row>
    </Card>
  );
}

function EmaRow({ k, e }: { k: string; e: EmaTf | null }) {
  if (!e) return <Row k={k}>—</Row>;
  const slope = e.slopeAtr == null ? "" : e.slopeAtr > 0.1 ? "↗" : e.slopeAtr < -0.1 ? "↘" : "→";
  return (
    <Row k={k}>
      {num(e.value)} {slope} · <span style={{ color: sideCol(e.side) }}>fiyat {e.side === 1 ? "üstte" : e.side === -1 ? "altta" : "üzerinde"} {sg(e.dist)}</span>
    </Row>
  );
}

export function EmaCard({ e5, e15, v, opening }: {
  e5: EmaTf | null; e15: EmaTf | null; v: { side: Side; headline: string; verdict: string };
  opening: { label: string; orLow: number | null; orHigh: number | null; broken: boolean } | null;
}) {
  const cr = e5?.lastCross ?? null;
  return (
    <Card title="EMA20 · kısa vade trend" chip="5m + 15m" side={v.side} headline={v.headline} verdict={v.verdict}>
      <EmaRow k="EMA20 5m" e={e5} />
      <EmaRow k="EMA20 15m" e={e15} />
      <Row k="5m son kesişim">{cr ? <span style={{ color: sideCol(cr.dir) }}>{cr.clock} {cr.dir === 1 ? "yukarı" : "aşağı"} · {cr.barsAgo} mum önce</span> : "—"}</Row>
      <Row k="Açılış okuması">{opening ? opening.label : "—"}</Row>
      <Row k="Açılış aralığı (ilk 15 dk)">{opening?.orLow != null && opening.orHigh != null ? `${num(opening.orLow)} – ${num(opening.orHigh)}${opening.broken ? " · kırıldı" : ""}` : "—"}</Row>
    </Card>
  );
}

const rvolWord = (x: number) => (x < 0.8 ? "zayıf" : x < 1.2 ? "normal" : x < 1.5 ? "canlı" : x < 3 ? "güçlü" : "aşırı");

export function VolumeCard({ p, dayRvol, rvol5, clock }: { p: PressureRead | null; dayRvol: number | null; rvol5: number | null; clock: string | null }) {
  const pw = (w: PressureWin | undefined, label: string) => (w ? <SplitBar left={w.buyPct} label={label} lLabel="alıcı" rLabel="satıcı" /> : null);
  const head = p ? p.headline : "VERİ BEKLENİYOR";
  const volTxt = dayRvol == null ? "" : dayRvol < 0.8 ? " Gün hacmi normalin altında: hareketler kolay geri döner." : dayRvol >= 1.5 ? " Gün hacmi güçlü: hareketler kalıcı olma eğiliminde." : "";
  return (
    <Card title="Hacim · alıcı / satıcı" chip={clock ? `son 5m ${clock}` : undefined} side={p?.side ?? 0} headline={head} verdict={p ? `${p.verdict}${volTxt}` : undefined}>
      <Row k="Gün hacmi (RVOL)">{dayRvol != null ? `${dayRvol.toFixed(2)}× · ${rvolWord(dayRvol)}` : "—"}</Row>
      <Row k="Son 5m hacmi (RVOL)">{rvol5 != null ? `${rvol5.toFixed(2)}× · ${rvolWord(rvol5)}` : "—"}</Row>
      {pw(p?.day, `Gün (${p ? kfmt(p.day.buy + p.day.sell) : "—"})`)}
      {pw(p?.m30, "Son 30 dk")}
      {pw(p?.m5, "Son 5 dk")}
      <div className="mt-0.5 text-[10px] text-slate-600">1m mumların kapanış konumu + tik yönünden tahmin</div>
    </Card>
  );
}

export function BookOptionsCard({ b, o }: { b: BookRead | null; o: OptionFlowRead | null }) {
  const sides = [b?.side ?? 0, o?.side ?? 0];
  const s: Side = sides[0] === sides[1] ? (sides[0] as Side) : sides[1] !== 0 && sides[0] === 0 ? (sides[1] as Side) : sides[0] !== 0 && sides[1] === 0 ? (sides[0] as Side) : 0;
  const head = !b && !o ? "VERİ BEKLENİYOR" : s === 1 ? "ALIŞ / CALL AĞIRLIKLI" : s === -1 ? "SATIŞ / PUT AĞIRLIKLI" : "DENGEDE";
  const f = o?.flow;
  return (
    <Card title="Emir defteri · opsiyon akışı" chip={f ? `${f.isZeroDte ? "0DTE" : `vade ${f.expiry}`}` : undefined} side={s} headline={head} verdict={[b?.verdict, o?.verdict].filter(Boolean).join(" ") || undefined}>
      {b ? (
        <>
          <Row k="Alış × miktar">{b.bid != null ? num(b.bid) : "—"} × <b className="text-[#4ade80]">{b.bidSize ?? "—"}</b></Row>
          <Row k="Satış × miktar">{b.ask != null ? num(b.ask) : "—"} × <b className="text-[#f87171]">{b.askSize ?? "—"}</b></Row>
          {b.imbAvg != null
            ? <SplitBar left={(b.imbAvg + 1) / 2} label={`Kademe dengesi · 5 dk ort. (${b.samples} örnek)`} lLabel="alış" rLabel="satış" />
            : b.imbNow != null && <SplitBar left={(b.imbNow + 1) / 2} label="Kademe dengesi · anlık" lLabel="alış" rLabel="satış" />}
          <Row k="Makas">{b.spread != null ? b.spread.toFixed(2) : "—"}</Row>
        </>
      ) : <div className="text-[11.5px] text-slate-500">Emir defteri alınamadı.</div>}
      {o && f ? (
        <>
          <SplitBar left={f.calls.volume / Math.max(1, f.calls.volume + f.puts.volume)} label={`Toplam hacim (${kfmt(f.calls.volume + f.puts.volume)} kontrat · SPY yapısal put ağırlıklı)`} lLabel="call" rLabel="put" />
          <SplitBar left={f.calls.premium / Math.max(1, f.calls.premium + f.puts.premium)} label={`Para dışı prim (${kfmt(f.calls.premium + f.puts.premium)})`} lLabel="call" rLabel="put" />
          <Row k="Fiyata yakın (±%1) C/P">{o.cpNear != null ? o.cpNear.toFixed(2) : "—"}</Row>
          <Row k="En hacimli">
            <span className="text-[#4ade80]">C {f.calls.top.slice(0, 2).map((t) => t.strike).join("/")}</span> · <span className="text-[#f87171]">P {f.puts.top.slice(0, 2).map((t) => t.strike).join("/")}</span>
          </Row>
        </>
      ) : <div className="mt-1 text-[11.5px] text-slate-500">Opsiyon zinciri alınamadı.</div>}
      <div className="mt-0.5 text-[10px] text-slate-600">Defter: en iyi alış/satış kademesi (Level 1, birkaç sn&apos;de bir) · opsiyon: Yahoo zinciri, ~1 dk</div>
    </Card>
  );
}
