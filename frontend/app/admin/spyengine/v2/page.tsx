"use client";

/**
 * SPY Engine V11 — Karar Hiyerarşisi (V10 /admin/spyengine/v1 ile YAN YANA çalışır).
 *
 * Bu sayfa HİÇBİR YÖN HESAPLAMAZ: lib/spyengine/v11/engine.ts'in ürettiği
 * `V11Snapshot`'ı gösterir. Kurallar (talimat §Temel ilkeler):
 *  1. Yön hükmü yalnızca Karar Kartı'nda (LONG/SHORT yalnızca orada).
 *  2. Yeşil/kırmızı yalnızca Karar Kartı'nda aksiyon yönü için; sarı yalnızca uyarı; geri kalan nötr.
 *  3. Her hüküm üç parçalı: ne · neden (≤3) · neyle bozulur (fiyat).
 *  4. Diğer her şey kanıttır ve karttan küçüktür.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { V11Snapshot, StripItem, ChartData } from "@/lib/spyengine/v11/snapshot";

const POLL_MS = 10_000;

const STATE_STYLE: Record<string, { fg: string; bd: string; note: string }> = {
  BEKLE: { fg: "#cbd5e1", bd: "#334155", note: "işlem yok" },
  HAZIRLAN: { fg: "#93c5fd", bd: "#1d4ed8", note: "kurulum yaklaşıyor" },
  "GİR": { fg: "#f8fafc", bd: "#e2e8f0", note: "tetik alındı" },
  "YÖNET": { fg: "#f8fafc", bd: "#94a3b8", note: "pozisyon açık" },
  "ÇIK": { fg: "#f8fafc", bd: "#94a3b8", note: "pozisyon kapandı" },
  PAS: { fg: "#94a3b8", bd: "#334155", note: "bu fırsattan geçildi" },
};

// Aksiyon yönü renkleri YALNIZCA Karar Kartı'nda kullanılır.
const SIDE_COLOR = { LONG: "#22c55e", SHORT: "#ef4444" } as const;
const WARN = "#eab308";

const num = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toFixed(d));

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    /* ses yoksa sessiz */
  }
}

// ── Karar Kartı ────────────────────────────────────────────────────

function DecisionCard({ s }: { s: V11Snapshot }) {
  const v = s.verdict;
  if (!v) return <div className="rounded-xl border border-[#1c2635] bg-[#0b0f16] p-6 text-slate-400">Veri bekleniyor…</div>;
  const st = STATE_STYLE[v.state] ?? STATE_STYLE.BEKLE;
  const sideCol = v.side ? SIDE_COLOR[v.side] : null;
  const plan = v.plan;
  return (
    <section className="rounded-xl border-2 bg-[#0b0f16] p-5" style={{ borderColor: sideCol && (v.state === "GİR" || v.state === "YÖNET") ? sideCol : st.bd }} aria-label="Karar Kartı">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[40px] font-black leading-none tracking-wide" style={{ color: st.fg }}>{v.state}</span>
        {v.side && (
          <span className="rounded-md px-3 py-1 text-[22px] font-black tracking-wider text-white" style={{ backgroundColor: SIDE_COLOR[v.side] }}>{v.side}</span>
        )}
        {v.setup && <span className="text-[15px] font-semibold text-slate-300">{v.headline.split(" · ").slice(1).join(" · ")}</span>}
        {!v.setup && <span className="text-[15px] text-slate-400">{v.headline.split(" · ").slice(1).join(" · ")}</span>}
        <span className="ml-auto text-[12px] text-slate-500">{st.note}</span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Neden</div>
          <ul className="space-y-1 text-[13.5px] leading-snug text-slate-200">
            {v.why.map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Neyle bozulur</div>
          <div className="font-mono text-[28px] font-bold leading-none text-slate-100">{v.invalidation.price != null ? num(v.invalidation.price) : "—"}</div>
          <div className="mt-1 text-[12.5px] leading-snug text-slate-400">{v.invalidation.text}</div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{plan ? "Plan" : "Tetik"}</div>
          {plan ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[13px] text-slate-200">
              <span className="text-slate-500">giriş</span><span>{num(plan.entry)}</span>
              <span className="text-slate-500">stop</span><span>{num(plan.stop)}</span>
              <span className="text-slate-500">T1{plan.t1Label ? ` · ${plan.t1Label}` : ""}</span><span>{num(plan.t1)}</span>
              {plan.t2 != null && (<><span className="text-slate-500">T2</span><span>{num(plan.t2)}</span></>)}
              {plan.rr != null && (<><span className="text-slate-500">R/R</span><span>{num(plan.rr)}</span></>)}
            </div>
          ) : (
            <div className="text-[12.5px] text-slate-500">Plan yok</div>
          )}
          {v.trigger && <div className="mt-2 text-[12px] leading-snug text-slate-400">5m tetik: {v.trigger}</div>}
        </div>
      </div>

      {v.warnings.length > 0 && (
        <div className="mt-4 space-y-1 rounded-md border px-3 py-2 text-[12.5px]" style={{ borderColor: `${WARN}66`, backgroundColor: `${WARN}12`, color: WARN }}>
          {v.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}
    </section>
  );
}

// ── Erken Uyarı Şeridi ─────────────────────────────────────────────

function EarlyStrip({ items }: { items: StripItem[] }) {
  return (
    <section className="rounded-lg border border-[#1c2635] bg-[#0b0f16]" aria-label="Erken Uyarı Şeridi">
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Erken uyarı · son {items.length || 3} A sınıfı olay</span>
        <span className="normal-case tracking-normal text-slate-600">olay kararı çevirmez; yalnızca daraltır</span>
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-2 text-[12.5px] text-slate-500">A sınıfı olay yok.</div>
      ) : (
        <ul className="divide-y divide-[#111826]">
          {items.map((e) => (
            <li key={e.id} className={`px-3 py-1.5 text-[12.5px] text-slate-300 ${e.fresh ? "animate-pulse" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-slate-400">{e.clock}</span>
                <b className="text-slate-100">{e.label}</b>
                <span>{e.level}</span>
                <span className="text-slate-400">→ {e.effect}</span>
                <span className="font-mono text-slate-400">iptal {num(e.invalidation)}</span>
                <span className="font-mono text-slate-500">{e.ageMin} dk</span>
                <span className="font-mono text-slate-400">{e.outcomes.map((o) => `${o.min}dk ${o.state}`).join(" · ")}</span>
              </div>
              <div className="text-[11.5px] text-slate-500">{e.archive}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Grafik (nötr renkler) ──────────────────────────────────────────

function DayChart({ c, price }: { c: ChartData; price: number | null }) {
  const W = 900, H = 260, padL = 8, padR = 56, padT = 10, padB = 18;
  if (!c.bars.length) return null;
  const vals = c.bars.flatMap((b) => [b[2], b[3]]).concat(c.lines.map((l) => l.price), c.vwap);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.05 || 0.5;
  const y = (p: number) => padT + ((hi + pad - p) / (hi - lo + 2 * pad)) * (H - padT - padB);
  const slot = (W - padL - padR) / 78;
  const x = (i: number) => padL + (i + 0.5) * slot;
  const idxOf = new Map(c.bars.map((b, i) => [b[0], i]));
  const vwapPath = c.vwap.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-[#1c2635] bg-[#0b0f16]" role="img" aria-label="5 dakikalık gün grafiği">
      {c.bars.map((b, i) => {
        const up = b[4] >= b[1];
        return (
          <g key={b[0]}>
            <line x1={x(i)} x2={x(i)} y1={y(b[2])} y2={y(b[3])} stroke="#64748b" strokeWidth={1} />
            <rect x={x(i) - slot * 0.3} width={slot * 0.6} y={y(Math.max(b[1], b[4]))} height={Math.max(1, Math.abs(y(b[1]) - y(b[4])))} fill={up ? "#0b0f16" : "#64748b"} stroke={up ? "#cbd5e1" : "#64748b"} strokeWidth={1} />
          </g>
        );
      })}
      <path d={vwapPath} fill="none" stroke="#60a5fa" strokeWidth={1.6} />
      {c.lines.map((l) => (
        <g key={l.label + l.price}>
          <line x1={padL} x2={W - padR} y1={y(l.price)} y2={y(l.price)} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="5 4" opacity={0.6} />
          <text x={W - padR + 4} y={y(l.price) + 3.5} fontSize={10} fill="#cbd5e1">{l.label} {l.price.toFixed(2)}</text>
        </g>
      ))}
      {c.marks.map((m, k) => {
        const i = idxOf.get(m.t);
        if (i == null) return null;
        return <rect key={k} x={x(i) - 3} y={y(m.price) - 3} width={6} height={6} transform={`rotate(45 ${x(i)} ${y(m.price)})`} fill={m.grade === "A" ? "#f1f5f9" : "none"} stroke="#f1f5f9" strokeWidth={1} />;
      })}
      {price != null && <text x={W - padR + 4} y={H - 4} fontSize={10} fill="#94a3b8">son kapanış {price.toFixed(2)}</text>}
      <text x={padL} y={H - 4} fontSize={10} fill="#60a5fa">— VWAP</text>
      <text x={padL + 56} y={H - 4} fontSize={10} fill="#94a3b8">◆ A/B olay</text>
    </svg>
  );
}

// ── Sayfa ──────────────────────────────────────────────────────────

export default function SpyEngineV11() {
  const [snap, setSnap] = useState<V11Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [asof, setAsof] = useState("");
  const [sound, setSound] = useState(false);
  const lastAlert = useRef<string | null>(null);
  const lastState = useRef<string | null>(null);

  const q = useMemo(() => {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    if (date && asof) p.set("asof", asof);
    return p.toString();
  }, [date, asof]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/spyengine/v2/decision${q ? `?${q}` : ""}`, { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setSnap(j as V11Snapshot);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [q]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    if (date) return () => clearTimeout(first); // oynatmada yoklama yok
    const t = setInterval(load, POLL_MS);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load, date]);

  // sesli uyarı + tarayıcı bildirimi: yeni A sınıfı olay ya da uyarı gerektiren hüküm
  useEffect(() => {
    if (!snap || !sound || snap.session.replay) return;
    const fresh = snap.strip.find((e) => e.fresh);
    const stateKey = snap.verdict ? `${snap.asOf}:${snap.verdict.state}:${snap.verdict.side}` : null;
    let msg: string | null = null;
    if (fresh && lastAlert.current !== fresh.id) {
      lastAlert.current = fresh.id;
      msg = `A sınıfı olay: ${fresh.label} · ${fresh.level}`;
    } else if (snap.verdict?.alert && stateKey && lastState.current !== stateKey) {
      msg = `${snap.verdict.headline}`;
    }
    lastState.current = stateKey;
    if (msg) {
      beep();
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("SPY Engine V11", { body: msg });
      } catch {
        /* bildirim yoksa sessiz */
      }
    }
  }, [snap, sound]);

  const toggleSound = async () => {
    const next = !sound;
    setSound(next);
    if (next) {
      beep();
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission();
      } catch {
        /* yok say */
      }
    }
  };

  const ev = snap?.evidence;

  return (
    <main className="min-h-screen bg-[#070a10] px-4 py-4 text-slate-200">
      <div className="mx-auto max-w-[1100px] space-y-3">
        {/* Başlık */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[18px] font-bold text-slate-100">SPY Engine <span className="text-slate-500">V11</span></h1>
          <span className="rounded border border-[#1c2635] px-2 py-0.5 text-[11px] text-slate-400">Karar Hiyerarşisi · V10 ile yan yana</span>
          <Link href="/admin/spyengine/v1" className="text-[12px] text-sky-400 hover:underline">V10 sayfası</Link>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-[12px]">
            {snap && (
              <span className="font-mono text-slate-400">
                {snap.ymd} · son kapanış {snap.asOfClock ?? "—"} ET{snap.session.replay ? " · OYNATMA" : snap.session.live ? " · canlı" : " · seans dışı"}
              </span>
            )}
            <button type="button" onClick={toggleSound} className={`rounded border px-2 py-1 text-[11px] font-semibold ${sound ? "border-sky-500 text-sky-300" : "border-[#1c2635] text-slate-400"}`}>
              {sound ? "UYARI AÇIK" : "UYARI KAPALI"}
            </button>
          </div>
        </header>

        {err && <div className="rounded-md border px-3 py-2 text-[12.5px]" style={{ borderColor: `${WARN}66`, color: WARN }}>⚠ Veri alınamadı: {err}</div>}

        {/* Fiyat satırı: karar fiyatı RTH kapanışı; AH yalnızca bilgi */}
        {snap && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-mono text-[26px] font-bold text-slate-100">{num(snap.price)}</span>
            <span className="text-[12px] text-slate-500">son kapanmış RTH 5m</span>
            {snap.ah && (
              <span className="rounded border border-[#334155] px-2 py-0.5 font-mono text-[12px] text-slate-400" title="Seans dışı fiyat: karar alanlarına girmez">
                {snap.ah.label} {num(snap.ah.price)}{snap.ah.diff != null ? ` (${snap.ah.diff >= 0 ? "+" : "−"}${Math.abs(snap.ah.diff).toFixed(2)})` : ""}
              </span>
            )}
            <span className="rounded border border-[#1c2635] bg-[#0b0f16] px-2 py-0.5 text-[12px] font-semibold text-slate-300" title="Rejim: hangi işlem mantığının çalıştığını seçer">
              Rejim · {snap.regime.text}{snap.regime.since ? ` (${snap.regime.since}'den beri)` : ""}
            </span>
            {snap.session.note && <span className="text-[11.5px] text-slate-500">{snap.session.note}</span>}
          </div>
        )}

        {snap && <DecisionCard s={snap} />}
        {snap && <EarlyStrip items={snap.strip} />}

        {/* Açılış (10:00'da katlanmış arşiv satırı) + biten bacaklar */}
        {snap?.opening && <div className="rounded border border-[#1c2635] bg-[#0b0f16] px-3 py-1.5 text-[12px] text-slate-400">{snap.opening.text}</div>}
        {ev && ev.legs.length > 0 && (
          <div className="rounded border border-[#1c2635] bg-[#0b0f16] px-3 py-1.5 text-[12px] text-slate-400">
            <span className="mr-2 font-semibold text-slate-500">Bugünkü bacaklar</span>
            {ev.legs.map((l, i) => (
              <span key={i} className="mr-4 font-mono">
                {l.entryClock} {l.setup} {l.open ? "(açık)" : `→ ${l.exitClock} ${l.r != null ? (l.r >= 0 ? "+" : "") + l.r + "R" : ""}`}
              </span>
            ))}
          </div>
        )}

        {snap && <DayChart c={snap.chart} price={snap.price} />}

        {/* Kanıt paneli — karttan küçük, nötr */}
        {ev && (
          <section className="space-y-2 text-[12.5px]" aria-label="Kanıt paneli">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kanıt</div>

            <details className="rounded border border-[#1c2635] bg-[#0b0f16]" open>
              <summary className="cursor-pointer px-3 py-1.5 font-semibold text-slate-300">Zaman dilimi rolleri</summary>
              <div className="space-y-1 px-3 pb-2 text-slate-400">
                <div>{ev.roles.htf}</div>
                <div>{ev.roles.m15}</div>
                <div>{ev.roles.m5}</div>
                <div className="text-slate-500">4h kaldırıldı (gün içi karara katkısı ölçülmemiş).</div>
              </div>
            </details>

            <details className="rounded border border-[#1c2635] bg-[#0b0f16]">
              <summary className="cursor-pointer px-3 py-1.5 font-semibold text-slate-300">Rejim girdileri</summary>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 px-3 pb-2 font-mono text-slate-400 sm:grid-cols-3">
                <span>aday: {ev.regime.candidate}</span>
                <span>bekleyen: {ev.regime.pending ?? "—"}</span>
                <span>vwap_cross_2h: {ev.regime.inputs.cross2h}</span>
                <span>va_inside_ratio: {ev.regime.inputs.insideRatio == null ? "—" : `%${Math.round(ev.regime.inputs.insideRatio * 100)}`}</span>
                <span>va_acceptance: {ev.regime.inputs.acceptance ?? "—"}</span>
                <span>htf_bias: {num(ev.regime.inputs.htfBias, 1)}</span>
                <span>range_vs_adr: {num(ev.regime.inputs.rangeVsAdr)}</span>
                <span>or_break: {ev.regime.inputs.orBreak ?? "—"}</span>
                <span>ATR14(5m): {num(ev.atr5, 3)}</span>
              </div>
            </details>

            <details className="rounded border border-[#1c2635] bg-[#0b0f16]">
              <summary className="cursor-pointer px-3 py-1.5 font-semibold text-slate-300">Seviyeler (tek birleşik liste)</summary>
              <div className="max-h-[320px] overflow-auto px-3 pb-2">
                <table className="w-full font-mono text-slate-400">
                  <tbody>
                    {ev.levels.map((l, i) => {
                      const above = snap!.price != null && l.price > snap!.price;
                      const prevAbove = i > 0 && snap!.price != null && ev.levels[i - 1].price > snap!.price;
                      return (
                        <tr key={`${l.price}${l.label}${i}`} className={l.dynamic ? "text-sky-300" : ""}>
                          <td className="w-20 py-0.5">{l.price.toFixed(2)}</td>
                          <td>{l.label}</td>
                          <td className="text-right text-slate-500">{l.distAtr == null ? "" : `${l.distAtr > 0 ? "+" : ""}${l.distAtr} ATR`}</td>
                          <td className="w-6 text-right text-slate-600">{prevAbove && !above ? "◂" : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="rounded border border-[#1c2635] bg-[#0b0f16]">
              <summary className="cursor-pointer px-3 py-1.5 font-semibold text-slate-300">Olay logu (A/B) · {ev.events.length}</summary>
              <div className="max-h-[320px] overflow-auto px-3 pb-2">
                {ev.events.map((e, i) => (
                  <div key={i} className="border-b border-[#111826] py-1 text-slate-400">
                    <span className="mr-2 font-mono">{e.clock}</span>
                    <b className="mr-2 text-slate-200">{e.label}</b>
                    <span className="mr-2 rounded border border-[#334155] px-1 text-[10.5px]">{e.grade}</span>
                    {e.level} → {e.effect}
                    <span className="ml-2 font-mono text-slate-500">{e.outcomes.map((o) => `${o.min}dk ${o.state}`).join(" · ")}</span>
                    <div className="text-[11px] text-slate-500">{e.archive}{e.experimental ? " · deneysel" : ""}</div>
                  </div>
                ))}
              </div>
            </details>

            <details className="rounded border border-[#1c2635] bg-[#0b0f16]">
              <summary className="cursor-pointer px-3 py-1.5 font-semibold text-slate-300">Deneysel (arşiv isabeti &lt; %50 · ana ekrandan kaldırıldı)</summary>
              <ul className="space-y-1 px-3 pb-2 text-slate-400">
                {ev.experimental.length === 0 && <li className="text-slate-500">Yok.</li>}
                {ev.experimental.map((x, i) => (
                  <li key={i}><b className="text-slate-300">{x.name}</b> <span className="rounded border border-[#334155] px-1 text-[10.5px]">deneysel</span> — {x.detail}</li>
                ))}
              </ul>
            </details>

            <details className="rounded border border-[#1c2635] bg-[#0b0f16]">
              <summary className="cursor-pointer px-3 py-1.5 font-semibold text-slate-300">Arşiv (geriye dönük V11 hükümleri)</summary>
              <div className="px-3 pb-2 text-slate-400">
                {ev.archive ? (
                  <>
                    <div>{ev.archive.days} seans ({ev.archive.from} → {ev.archive.to}) · 5m mumlar · olay ölçütü: {ev.archive.horizonMin} dk içinde beklenen yönde ≥0,5×ATR, ters yönden önce · rastgele taban %{ev.archive.baseline == null ? "—" : Math.round(ev.archive.baseline * 100)}</div>
                    {ev.archive.trades && (
                      <div className="mt-1 font-mono">
                        işlem {ev.archive.trades.n} · kazanç %{ev.archive.trades.winRate == null ? "—" : Math.round(ev.archive.trades.winRate * 100)} · ort. {num(ev.archive.trades.avgR)}R · toplam {num(ev.archive.trades.sumR)}R
                      </div>
                    )}
                    <div className="mt-1 text-[11.5px] text-slate-500">Eşikler başlangıç değeridir (lib/spyengine/v11/config.ts); bu tablo kalibrasyon içindir, işlem tavsiyesi değildir.</div>
                  </>
                ) : (
                  <span className="text-slate-500">Arşiv hesaplanamadı.</span>
                )}
              </div>
            </details>
          </section>
        )}

        {/* Oynatma (geriye dönük test) */}
        <footer className="flex flex-wrap items-center gap-2 border-t border-[#1c2635] pt-3 text-[12px] text-slate-500">
          <span>Geriye dönük oynatma:</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-[#1c2635] bg-[#0b0f16] px-2 py-1 text-slate-300" />
          <input type="time" value={asof} onChange={(e) => setAsof(e.target.value)} disabled={!date} className="rounded border border-[#1c2635] bg-[#0b0f16] px-2 py-1 text-slate-300 disabled:opacity-40" />
          {date && <button type="button" onClick={() => { setDate(""); setAsof(""); }} className="rounded border border-[#1c2635] px-2 py-1 text-slate-300">canlıya dön</button>}
          <span className="text-slate-600">Yahoo 5m geçmişi ≤ 60 gün.</span>
        </footer>
      </div>
    </main>
  );
}
