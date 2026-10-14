"use client";

/**
 * SPY Engine — 15m setup kurulumu + sonraki 4 adet 15m mum tahmini (simülasyon).
 * Tahmin Haritası ile aynı SVG dili: mumlar, VWAP, EMA20, pivotlar, salınım dip/tepeleri,
 * setup çizimi (bölge / giriş / stop / hedefler) ve hayalet (kesikli) tahmin mumları + kapanış bandı.
 * Hesap her 15m mum KAPANIŞINDA yenilenir (lib/spyengine/setup15.ts).
 */

import { useMemo } from "react";
import { nyClock, nyParts, type Bar } from "@/lib/spyengine/core";
import { setupHist, type Setup15, type Setup15Read, type Setup15Stats, type TfTrend } from "@/lib/spyengine/setup15";

const W = 920;
const H = 360;
const PAD = { l: 8, r: 112, t: 26, b: 22 };
const VIEW = 52;
const num = (x: number) => x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const UP = "#22c55e", DN = "#ef4444";

function Chart({ bars, forming, read }: { bars: Bar[]; forming: Bar | null; read: Setup15Read }) {
  const view = bars.slice(-VIEW);
  const off = bars.length - view.length;
  const S = view.length;
  const slots = S + 4;
  const fc = read.forecast.candles;
  const p = read.primary;

  const g = useMemo(() => {
    const ys: number[] = [];
    for (const b of view) ys.push(b.high, b.low);
    if (forming) ys.push(forming.high, forming.low);
    for (const k of fc) ys.push(k.lo, k.hi, k.h, k.l);
    if (p) ys.push(p.stop, p.trigger, ...p.targets);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = Math.max(0.2, (hi - lo) * 0.05);
    lo -= pad; hi += pad;
    const slotW = (W - PAD.l - PAD.r) / slots;
    const X = (i: number) => PAD.l + (i + 0.5) * slotW;
    const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    return { lo, hi, slotW, X, Y };
  }, [view, forming, fc, p, slots]);
  const { X, Y, slotW, lo, hi } = g;
  const inY = (v: number) => v >= lo && v <= hi;
  const bw = Math.max(2, slotW * 0.62);
  const plotR = W - PAD.r;
  const idxOf = (t: number) => view.findIndex((b) => b.time === t);

  // seans ayırıcıları + saat etiketleri
  const seps: { i: number; label: string }[] = [];
  const hours: { i: number; label: string }[] = [];
  view.forEach((b, i) => {
    const pp = nyParts(b.time);
    if (i > 0 && nyParts(view[i - 1].time).ymd !== pp.ymd) seps.push({ i, label: pp.ymd.slice(5).replace("-", ".") });
    if (pp.minutes % 60 === 30 && pp.minutes !== 570) hours.push({ i, label: nyClock(b.time) });
  });

  // bugünün VWAP'ı (15m, kapanmış)
  const today = view.length ? nyParts(view[view.length - 1].time).ymd : "";
  let pv = 0, vol = 0;
  const vwapPts: string[] = [];
  view.forEach((b, i) => {
    if (nyParts(b.time).ymd !== today) return;
    pv += ((b.high + b.low + b.close) / 3) * (b.volume || 0);
    vol += b.volume || 0;
    if (vol > 0) vwapPts.push(`${X(i).toFixed(1)},${Y(pv / vol).toFixed(1)}`);
  });
  const emaPts = view
    .map((b, i) => {
      const e = read.ema15[off + i];
      return e != null ? `${X(i).toFixed(1)},${Y(e).toFixed(1)}` : null;
    })
    .filter(Boolean)
    .join(" ");

  // salınımlar + yapı zikzakı
  const sws = read.swings.filter((s) => s.idx >= off).map((s) => ({ ...s, i: s.idx - off }));
  const zig = sws.map((s) => `${X(s.i).toFixed(1)},${Y(s.price).toFixed(1)}`).join(" ");

  const pivots = read.levels.filter((l) => (l.kind === "pivot" || l.kind === "prev") && inY(l.price));

  const setupDraw = (s: Setup15, faint: boolean) => {
    const c = s.dir === 1 ? UP : DN;
    const ai = Math.max(0, idxOf(s.anchor));
    const x0 = X(ai) - slotW / 2, x1 = X(S + 3) + slotW / 2;
    const op = faint ? 0.35 : 1;
    return (
      <g key={`${s.kind}${s.dir}`} opacity={op}>
        <rect x={x0} y={Y(s.zone[1])} width={x1 - x0} height={Math.max(2, Y(s.zone[0]) - Y(s.zone[1]))} fill={c} opacity={0.1} stroke={c} strokeOpacity={0.4} strokeWidth={0.8} />
        <line x1={x0} x2={plotR} y1={Y(s.trigger)} y2={Y(s.trigger)} stroke="#f59e0b" strokeWidth={1.3} />
        <line x1={X(S - 1)} x2={plotR} y1={Y(s.stop)} y2={Y(s.stop)} stroke={DN} strokeWidth={1} strokeDasharray="5 3" />
        {s.targets.map((t, k) => (
          <line key={k} x1={X(S - 1)} x2={plotR} y1={Y(t)} y2={Y(t)} stroke={UP} strokeWidth={1} strokeDasharray="5 3" opacity={k ? 0.6 : 1} />
        ))}
        {!faint && (
          <g fontSize={8.5} fontFamily="monospace" fontWeight={700}>
            <text x={plotR + 4} y={Y(s.trigger) + 3} fill="#fbbf24">GİRİŞ {s.trigger.toFixed(2)}</text>
            <text x={plotR + 4} y={Y(s.stop) + 3} fill="#f87171">STOP {s.stop.toFixed(2)}</text>
            {s.targets.map((t, k) => <text key={k} x={plotR + 4} y={Y(t) + 3} fill="#4ade80">H{k + 1} {t.toFixed(2)}</text>)}
            <text x={x0 + 3} y={Y(s.zone[1]) - 3} fill={c} fontSize={9}>{s.title} · {s.status}</text>
          </g>
        )}
      </g>
    );
  };

  const cone = fc.length
    ? `M ${X(S - 1)},${Y(read.forecast.base)} ${fc.map((k, i) => `L ${X(S + i)},${Y(k.hi)}`).join(" ")} ${[...fc].reverse().map((k, i) => `L ${X(S + fc.length - 1 - i)},${Y(k.lo)}`).join(" ")} Z`
    : "";
  const fcColor = read.forecast.dir === 1 ? UP : read.forecast.dir === -1 ? DN : "#eab308";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="15m setup tahmini">
      <rect x={0} y={0} width={W} height={H} fill="#0a0e17" />
      {(() => {
        const out = [];
        const step = hi - lo > 6 ? 1 : hi - lo > 3 ? 0.5 : 0.25;
        for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
          out.push(
            <g key={v}>
              <line x1={PAD.l} x2={plotR} y1={Y(v)} y2={Y(v)} stroke="#1c2635" strokeWidth={0.6} />
            </g>,
          );
        }
        return out;
      })()}
      {hours.map((h) => (
        <text key={`h${h.i}`} x={X(h.i)} y={H - 8} fontSize={8} fill="#475569" textAnchor="middle" fontFamily="monospace">{h.label}</text>
      ))}
      {seps.map((s) => (
        <g key={`s${s.i}`}>
          <line x1={X(s.i) - slotW / 2} x2={X(s.i) - slotW / 2} y1={PAD.t} y2={H - PAD.b} stroke="#334155" strokeWidth={0.8} strokeDasharray="2 2" />
          <text x={X(s.i) - slotW / 2 + 3} y={PAD.t + 9} fontSize={8} fill="#64748b" fontFamily="monospace">{s.label}</text>
        </g>
      ))}

      {/* pivotlar + dünkü tepe/dip */}
      {pivots.map((l) => (
        <g key={`pv${l.label}`}>
          <line x1={PAD.l} x2={plotR} y1={Y(l.price)} y2={Y(l.price)} stroke="#a78bfa" strokeWidth={0.8} strokeDasharray="8 3 1 3" opacity={0.7} />
          <text x={PAD.l + 3} y={Y(l.price) - 2} fontSize={7.5} fill="#a78bfa" fontFamily="monospace">{l.label.replace("pivot ", "")} {l.price.toFixed(2)}</text>
        </g>
      ))}

      {/* setup çizimleri: ikincil soluk, birincil net */}
      {read.setups.filter((s) => s !== p).slice(0, 1).map((s) => setupDraw(s, true))}
      {p && setupDraw(p, false)}

      {/* mumlar */}
      {view.map((b, i) => {
        const c = b.close >= b.open ? UP : DN;
        return (
          <g key={b.time}>
            <line x1={X(i)} x2={X(i)} y1={Y(b.high)} y2={Y(b.low)} stroke={c} strokeWidth={0.8} />
            <rect x={X(i) - bw / 2} y={Math.min(Y(b.open), Y(b.close))} width={bw} height={Math.max(1, Math.abs(Y(b.open) - Y(b.close)))} fill={c} />
          </g>
        );
      })}

      {/* yapı zikzakı + salınım işaretleri */}
      {zig && <polyline points={zig} fill="none" stroke="#94a3b8" strokeWidth={0.9} strokeDasharray="3 3" opacity={0.7} />}
      {sws.map((s) => {
        const y = Y(s.price) + (s.kind === "H" ? -4 : 4);
        const cx = X(s.i);
        return (
          <path key={`${s.kind}${s.time}`} d={s.kind === "H" ? `M${cx - 3},${y - 4} L${cx + 3},${y - 4} L${cx},${y}` : `M${cx - 3},${y + 4} L${cx + 3},${y + 4} L${cx},${y}`} fill={s.kind === "H" ? "#f87171" : "#4ade80"} />
        );
      })}

      {vwapPts.length > 1 && <polyline points={vwapPts.join(" ")} fill="none" stroke="#e879f9" strokeWidth={1.3} />}
      {emaPts && <polyline points={emaPts} fill="none" stroke="#22d3ee" strokeWidth={1.1} />}

      {/* tahmin: bant + hayalet mumlar */}
      {cone && <path d={cone} fill={fcColor} opacity={0.08} />}
      {fc.map((k, i) => {
        const c = k.c >= k.o ? UP : DN;
        return (
          <g key={k.t}>
            <line x1={X(S + i)} x2={X(S + i)} y1={Y(k.h)} y2={Y(k.l)} stroke={c} strokeWidth={0.9} strokeDasharray="2 2" />
            <rect x={X(S + i) - bw / 2} y={Math.min(Y(k.o), Y(k.c))} width={bw} height={Math.max(1, Math.abs(Y(k.o) - Y(k.c)))} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={1} strokeDasharray="3 2" />
            {(i === 0 || i === fc.length - 1) && <text x={X(S + i)} y={H - 8} fontSize={8} fill="#f59e0b" textAnchor={i === 0 ? "end" : "start"} fontFamily="monospace">{nyClock(k.t)}</text>}
          </g>
        );
      })}
      {fc.length > 0 && (
        <polyline
          points={[`${X(S - 1)},${Y(read.forecast.base)}`, ...fc.map((k, i) => `${X(S + i)},${Y(k.c)}`)].join(" ")}
          fill="none" stroke={fcColor} strokeWidth={1.6} strokeDasharray="6 4"
        />
      )}

      {/* oluşan mum (gerçekleşen) — 1. tahmin yuvasının üstünde */}
      {forming && (
        <g opacity={0.95}>
          <line x1={X(S) + bw * 0.15} x2={X(S) + bw * 0.15} y1={Y(forming.high)} y2={Y(forming.low)} stroke="#e2e8f0" strokeWidth={0.9} />
          <rect x={X(S) - bw * 0.15} y={Math.min(Y(forming.open), Y(forming.close))} width={bw * 0.6} height={Math.max(1, Math.abs(Y(forming.open) - Y(forming.close)))} fill={forming.close >= forming.open ? UP : DN} stroke="#e2e8f0" strokeWidth={0.6} />
        </g>
      )}

      {/* şimdi ayırıcı */}
      <line x1={X(S) - slotW / 2} x2={X(S) - slotW / 2} y1={PAD.t} y2={H - PAD.b} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />
      <text x={X(S) - slotW / 2} y={PAD.t - 3} fontSize={8} fill="#94a3b8" textAnchor="middle">son kapanış</text>

      <g fontSize={8} fontFamily="monospace">
        <line x1={PAD.l + 4} x2={PAD.l + 18} y1={8} y2={8} stroke="#e879f9" strokeWidth={1.3} />
        <text x={PAD.l + 21} y={11} fill="#e879f9">VWAP</text>
        <line x1={PAD.l + 50} x2={PAD.l + 64} y1={8} y2={8} stroke="#22d3ee" strokeWidth={1.1} />
        <text x={PAD.l + 67} y={11} fill="#22d3ee">EMA20</text>
        <line x1={PAD.l + 102} x2={PAD.l + 116} y1={8} y2={8} stroke="#a78bfa" strokeWidth={0.8} strokeDasharray="8 3 1 3" />
        <text x={PAD.l + 119} y={11} fill="#a78bfa">pivot / dünkü T-D</text>
        <text x={PAD.l + 210} y={11} fill="#94a3b8">▲▼ 15m salınım · kesikli mumlar: sonraki 4 mum tahmini · gölge: ~%60 kapanış bandı</text>
      </g>
    </svg>
  );
}

const dirTxt = (d: number) => (d === 1 ? "▲ yukarı" : d === -1 ? "▼ aşağı" : "◆ nötr");
const dirCls = (d: number) => (d === 1 ? "text-[#4ade80]" : d === -1 ? "text-[#f87171]" : "text-amber-300");

function TfRow({ t, label }: { t: TfTrend | null; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
      <b className="w-9 text-slate-300">{label}</b>
      {t ? (
        <>
          <span className={`font-semibold ${dirCls(t.dir)}`}>{dirTxt(t.dir)}</span>
          <span className="text-slate-400">{t.text}</span>
          {t.ema != null && <span className="font-mono text-slate-500">EMA20 {num(t.ema)}</span>}
        </>
      ) : <span className="text-slate-500">veri bekleniyor</span>}
    </div>
  );
}

/** Setup'ın canlı durumu: son 15m kapanışından beri oluşan mumdaki en yüksek/düşük ve anlık fiyatla H1 / stop görüldü mü */
function liveState(s: Setup15, forming: Bar | null, price: number | null): { text: string; cls: string } | null {
  if (price == null) return null;
  const hi = Math.max(price, forming?.high ?? price), lo = Math.min(price, forming?.low ?? price);
  const hit = (lvl: number, up: boolean) => (up ? hi >= lvl : lo <= lvl);
  const tgtHit = s.targets[0] != null && hit(s.targets[0], s.dir === 1);
  const stopHit = hit(s.stop, s.dir === -1);
    const trigHit = s.status === "KURULUYOR" && hit(s.trigger, s.dir === 1);
  const mv = (price - s.trigger) * s.dir;
  const base = `şimdi ${num(price)} · girişe göre ${mv >= 0 ? "+" : "−"}${num(Math.abs(mv))}`;
  if (stopHit && !tgtHit) return { text: `${base} · STOP seviyesi görüldü — kurulum bozuldu`, cls: "text-[#f87171]" };
  if (tgtHit) return { text: `${base} · H1 ${num(s.targets[0])} görüldü ✓ — kârın bir kısmını al`, cls: "text-[#4ade80]" };
  if (trigHit) return { text: `${base} · tetik seviyesi aşıldı — 15m kapanışı bekleniyor`, cls: "text-amber-300" };
  return { text: base, cls: "text-slate-400" };
}

export default function Setup15Panel({ bars, forming, read, stats, htfReady, price }: {
  /** Anlık fiyat (canlı) — setup'ın güncel durumu için */
  price?: number | null;
  /** Kapanmış RTH 15m mumları (çok günlük) */
  bars: Bar[];
  /** Oluşmakta olan 15m mum (yoksa null) */
  forming: Bar | null;
  read: Setup15Read | null;
  stats: Setup15Stats | null;
  /** 1h geçmiş (EMA ısınması) yüklendi mi */
  htfReady: boolean;
}) {
  if (!read) {
    return <div className="px-4 py-8 text-center text-[12px] text-slate-500">15m setup tahmini için en az 30 kapanmış 15m mum ve ATR gerekiyor — veri bekleniyor.</div>;
  }
  const p = read.primary;
  const fc = read.forecast;
  const alignTxt = read.align >= 2 ? "1h + 4h yukarı uyumlu" : read.align <= -2 ? "1h + 4h aşağı uyumlu" : read.align === 0 ? "1h / 4h karışık" : read.align > 0 ? "üst zaman hafif yukarı" : "üst zaman hafif aşağı";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[12px] font-semibold tracking-wide text-slate-300">
          15m Setup &amp; 4 Mum Tahmini <span className="hidden text-[10.5px] font-normal text-slate-500 sm:inline">· 1h / 4h teyidi · pivotlar · her 15m kapanışta güncellenir</span>
        </span>
        <span className="flex items-center gap-2 font-mono text-[11px]">
          {price != null && <span className="text-slate-300">şimdi <b className="text-slate-100">{num(price)}</b> ·</span>}
          <span className="text-slate-500">tahmin son 15m kapanışına ({nyClock(read.key + 900)}) göre · +60 dk ≈</span>
          <b className="text-[14px] text-slate-100">${num(fc.candles[3].c)}</b>
          <span className="text-slate-500">({num(fc.candles[3].lo)} – {num(fc.candles[3].hi)})</span>
        </span>
      </div>

      <Chart bars={bars} forming={forming} read={read} />

      <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] lg:grid-cols-3">
        <div className="bg-[#0f141d] px-3 py-2">
          <div className="mb-1 text-[11px] font-semibold text-slate-400">Üst zaman teyidi <span className={`ml-1 ${dirCls(Math.sign(read.align))}`}>{alignTxt}</span></div>
          <TfRow t={read.h4} label="4h" />
          <TfRow t={read.h1} label="1h" />
          <TfRow t={read.m15} label="15m" />
          <div className="mt-1 font-mono text-[11px] text-slate-500">ATR14 (15m) {num(read.atr)}{htfReady ? "" : " · 1h geçmişi yükleniyor (EMA ısınması eksik olabilir)"}</div>
        </div>

        <div className="bg-[#0f141d] px-3 py-2">
          <div className="mb-1 text-[11px] font-semibold text-slate-400">Olası setup kurulumları</div>
          {read.setups.length === 0 && <div className="text-[12px] text-slate-500">Şu an tanımlı bir setup yok (kırılım / geri çekilme / süpürme / bant koşulları oluşmadı).</div>}
          {read.setups.map((s) => (
            <div key={`${s.kind}${s.dir}`} className={`mb-1.5 rounded border px-2 py-1 ${s === p ? "border-[#334155] bg-[#131b29]" : "border-[#1c2635]"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <b className={`text-[12px] ${s.dir === 1 ? "text-[#4ade80]" : "text-[#f87171]"}`}>{s.title}</b>
                <span className="font-mono text-[11px] text-slate-400">{s.status} · skor {s.score} · R:R {s.rr}</span>
              </div>
              {(() => { const ls = liveState(s, forming, price ?? null); return ls ? <div className={`font-mono text-[11px] font-semibold ${ls.cls}`}>● CANLI: {ls.text}</div> : null; })()}
              <div className="font-mono text-[11px] text-slate-300">
                giriş {num(s.trigger)} · stop {num(s.stop)} · H1 {num(s.targets[0])}{s.targets[1] != null ? ` · H2 ${num(s.targets[1])}` : ""}
              </div>
              <div className="text-[11px] leading-snug text-slate-500">{s.reasons.join(" · ")}</div>
              {(() => {
                const h = setupHist(s, read.align);
                return (
                  <div className="font-mono text-[10.5px] text-slate-500">
                    60 seans geçmişi: {h ? <>H1 stoptan önce %{h.win} · ort. <span className={h.avgR > 0.05 ? "text-[#4ade80]" : h.avgR < -0.05 ? "text-[#f87171]" : "text-slate-400"}>{h.avgR > 0 ? "+" : ""}{h.avgR.toFixed(2)}R</span> <span className="text-slate-600">(n={h.n}{h.n < 15 ? ", az örnek" : ""})</span></> : "örnek yok"}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>

        <div className="bg-[#0f141d] px-3 py-2">
          <div className="mb-1 text-[11px] font-semibold text-slate-400">Sonraki 4 adet 15m mum (simülasyon)</div>
          <div className={`mb-1 text-[11.5px] ${dirCls(fc.dir)}`}>{fc.text}</div>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-slate-500"><th className="text-left font-normal">mum</th><th className="text-right font-normal">A</th><th className="text-right font-normal">Y</th><th className="text-right font-normal">D</th><th className="text-right font-normal">K</th><th className="text-right font-normal">bant</th></tr>
            </thead>
            <tbody>
              {fc.candles.map((k) => (
                <tr key={k.t} className="text-slate-300">
                  <td>{nyClock(k.t)}</td>
                  <td className="text-right">{num(k.o)}</td>
                  <td className="text-right">{num(k.h)}</td>
                  <td className="text-right">{num(k.l)}</td>
                  <td className={`text-right ${k.c >= k.o ? "text-[#4ade80]" : "text-[#f87171]"}`}>{num(k.c)}</td>
                  <td className="text-right text-slate-500">{num(k.lo)}–{num(k.hi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {stats ? (
              <>
                Son {stats.n} kapanışta geriye dönük (walk-forward): yön isabeti %{stats.dirHit} <span className="text-slate-600">(n={stats.dirN})</span> · bant içi %{stats.inBand} · +60 dk hata {num(stats.mae)} <span className="text-slate-600">(fiyat aynı kalır varsayımı {num(stats.naiveMae)})</span>
              </>
            ) : "Geriye dönük ölçüm için yeterli 15m geçmişi birikiyor."}
          </div>
        </div>
      </div>
      <div className="border-t border-[#1c2635] px-3 py-1 text-[10.5px] leading-snug text-slate-500">
        Bu bir TAHMİNDİR. 60 seanslık geriye dönük ölçümde 4 mumluk yol yönü ~%54 tuttu ve hatası &quot;fiyat aynı kalır&quot; varsayımıyla aynı düzeyde; setup türlerinin hiçbirinin belirgin pozitif beklentisi yok (kartlardaki geçmiş satırı). Setup seviyeleri ölçülmüş veriden (15m salınımlar, pivotlar, VWAP, EMA20) gelir; mum simülasyonu birincil setup yönünde ATR ölçekli sürüklenme, yoldaki karşı seviyelerde fitil/duraklama ve geçmiş 15m değişim dağılımıyla üretilir. Yön kararı Karar Merdiveni&apos;nde kalır.
      </div>
    </div>
  );
}
