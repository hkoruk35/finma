"use client";

/**
 * SPY Engine — TAKİP SİSTEMİ paneli (lib/spyengine/tracker.ts).
 *
 * Eski "Açılış aşamaları" + "Açılış trendi" + 5m/15m mum okumaları tek yerde:
 *   • ŞİMDİ: son 5m kapanışın tek okuması — yön · ne yap · 30 dk tahmini · kurulum/pozisyon.
 *   • Zaman şeridi: her satır 30 dk (6 adet 5m kartı). 09:05–09:30 seans öncesi → 09:35–10:00 açılış aşamaları →
 *     … → 14:35–15:00. Varsayılan görünüm SON 30 dk'lık satır; yukarı kaydırınca önceki satırlar.
 *   • Karta tıklayınca ayrıntı: 5m/15m mum okuması, yön puanı dökümü, kontrol listesi, merdiven durumu, olaylar, tahminin sonucu.
 *   • Geçmiş: kurulum etiketlerine göre sonuçlar ve tahmin kurallarının gerçekleşen isabeti (sunucu günlüğü).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BREAKDOWN_LABEL, FC_RULES, PHASE_TEXT, SCORE_MAX, TAG_TEXT, VETO_TEXT,
  type Breakdown, type TrackRead, type TrackStep, type D,
} from "@/lib/spyengine/tracker";
import type { TrackerSummary } from "@/lib/spyengine/trackerStore";

const UP = "#22c55e", DN = "#ef4444", WARN = "#eab308", NEU = "#64748b";
const num = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));
const sg = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(Math.abs(n) % 1 ? 1 : 0)}`;
const toneCol = (t: TrackStep["tone"]) => (t === "bull" ? UP : t === "bear" ? DN : t === "warn" ? WARN : NEU);
const dCol = (d: number) => (d > 0 ? UP : d < 0 ? DN : NEU);
const arrow = (d: number) => (d > 0 ? "▲" : d < 0 ? "▼" : "◆");

export interface LadderMark { status: string; side: string | null; message: string; openTrend: string | null; changed?: boolean }

const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Satır tanımları: seans öncesi + 09:35'ten 15:00'e kadar 30'ar dk */
const ROWS: { key: string; title: string; mins: number[] }[] = [
  { key: "pre", title: "Seans öncesi · bilgi", mins: [545, 550, 555, 560, 565, 570] },
  ...Array.from({ length: 11 }, (_, k) => {
    const start = 575 + 30 * k;
    const mins = Array.from({ length: 6 }, (_, j) => start + 5 * j);
    const title = k === 0 ? "Açılış · 09:45 ilk 15m teyidi" : "5m tetik · 15m teyit";
    return { key: `r${k}`, title, mins };
  }),
];

function Gauge({ score, thr }: { score: number; thr: number }) {
  const MAX = SCORE_MAX;
  const pos = (v: number) => `${((v + MAX) / (2 * MAX)) * 100}%`;
  const col = dCol(Math.abs(score) >= 3 ? score : 0);
  return (
    <div className="relative mt-1 h-3 rounded bg-gradient-to-r from-[#ef4444]/35 via-[#1c2635] to-[#22c55e]/35">
      {[-thr, thr].map((t) => <span key={t} className="absolute top-[-2px] h-4 w-px bg-slate-400/70" style={{ left: pos(t) }} title={`eşik ${t}`} />)}
      <span className="absolute top-[-2px] h-4 w-px bg-slate-600" style={{ left: "50%" }} />
      <span className="absolute top-[-4px] h-5 w-1.5 rounded" style={{ left: `calc(${pos(Math.max(-MAX, Math.min(MAX, score)))} - 3px)`, backgroundColor: col }} />
    </div>
  );
}

function Chip({ v, children, title }: { v: number; children: ReactNode; title?: string }) {
  const c = v > 0 ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]" : v < 0 ? "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#f87171]" : "border-slate-700 text-slate-500";
  return <span title={title} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10.5px] ${c}`}>{children}</span>;
}

function BreakdownChips({ b }: { b: Breakdown }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(BREAKDOWN_LABEL) as (keyof Breakdown)[]).map((k) => (
        <Chip key={k} v={b[k]}>{BREAKDOWN_LABEL[k]} {b[k] === 0 ? "0" : sg(b[k])}</Chip>
      ))}
    </div>
  );
}

function HtfChips({ h }: { h: TrackStep["htf"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {([["15m", h.m15], ["30m", h.m30], ["1h", h.h1], ["4h", h.h4]] as [string, D][]).map(([k, v]) => (
        <Chip key={k} v={v} title={`${k}: fiyat EMA20'nin ${v > 0 ? "üstünde ve EMA yükseliyor" : v < 0 ? "altında ve EMA düşüyor" : "karışık tarafında"}`}>{k} {arrow(v)}</Chip>
      ))}
    </div>
  );
}

function Outcome({ s }: { s: TrackStep }) {
  if (!s.fc.dir) return <span className="text-slate-600">30dk —</span>;
  if (!s.out) return <span className="text-slate-500">30dk {arrow(s.fc.dir)} bekleniyor</span>;
  const ok = s.out.hit;
  return (
    <span className={ok ? "text-[#4ade80]" : "text-[#f87171]"} title={`30 dk sonra ${s.out.move >= 0 ? "+" : ""}${s.out.move.toFixed(2)} puan${s.out.targetHit ? " · hedefe değdi" : ""}${s.out.invalidHit ? " · iptal seviyesi önce geldi" : ""}${s.out.done ? "" : " · süre dolmadı"}`}>
      30dk {arrow(s.fc.dir)} {ok ? "✓" : "✗"} {s.out.move >= 0 ? "+" : ""}{s.out.move.toFixed(2)}{s.out.targetHit ? " ◎" : ""}{s.out.done ? "" : "…"}
    </span>
  );
}

function Cell({ s, min, sel, onSel, mark, isNow, past }: { s: TrackStep | null; min: number; sel: boolean; onSel: () => void; mark?: LadderMark; isNow: boolean; past: boolean }) {
  if (!s) {
    return (
      <div className="flex min-h-[92px] flex-col rounded border border-dashed border-[#1c2635] px-1.5 py-1 text-[10.5px] text-slate-600">
        <span className="font-mono font-semibold">{hm(min)}{(min - 570) % 15 === 0 && min > 570 ? " · 15m" : ""}</span>
        <span className="mt-auto">{past ? "veri yok" : "bekleniyor"}</span>
      </div>
    );
  }
  const col = toneCol(s.tone);
  const ladderHot = !!mark?.changed && (mark.status === "TETİK" || mark.status === "ERKEN UYARI" || mark.status === "TERS UYARI" || !!(mark.openTrend && /^(UYARI|AÇIK|KAPANDI)/.test(mark.openTrend)));
  return (
    <button
      type="button"
      onClick={onSel}
      className={`flex min-h-[92px] flex-col rounded border px-1.5 py-1 text-left transition-colors ${sel ? "ring-1 ring-sky-400" : ""} ${isNow ? "shadow-[0_0_0_1px_#eab30899]" : ""}`}
      style={{ borderColor: `${col}${s.is15 ? "aa" : "55"}`, backgroundColor: `${col}${s.tone === "neutral" ? "08" : "12"}` }}
    >
      <span className="flex items-center justify-between gap-1 font-mono text-[10.5px]">
        <b className="text-slate-200">{s.clock}</b>
        <span className="flex items-center gap-1">
          {s.is15 && <span className="rounded bg-sky-500/20 px-1 text-[9px] font-semibold text-sky-300">15m</span>}
          {isNow && <span className="rounded bg-[#eab308]/20 px-1 text-[9px] font-semibold text-[#eab308]">SON</span>}
          <span className="font-bold" style={{ color: dCol(s.dir) }}>{arrow(s.dir)}{s.pre ? s.score : sg(s.score)}</span>
        </span>
      </span>
      <span className="mt-0.5 text-[11.5px] font-extrabold leading-tight" style={{ color: col }}>{s.headline}</span>
      <span className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-slate-300">{s.action}</span>
      <span className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-0.5 font-mono text-[9.5px]">
        <Outcome s={s} />
        {ladderHot && <span className="rounded bg-orange-500/20 px-1 text-[9px] font-semibold text-orange-300" title={mark?.openTrend ?? mark?.message}>merdiven {mark?.openTrend && !["TETİK", "ERKEN UYARI", "TERS UYARI"].includes(mark.status) ? `açılış trendi ${mark.openTrend.split(" · ")[0]}` : `${mark?.status}${mark?.side ? ` ${mark.side}` : ""}`}</span>}
      </span>
    </button>
  );
}

function StepDetail({ s, mark }: { s: TrackStep; mark?: LadderMark }) {
  return (
    <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-3">
      <div className="flex flex-col gap-1 bg-[#0f141d] px-3 py-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">{s.clock} · {s.stageLabel}</div>
        <div className="text-[15px] font-black leading-tight" style={{ color: toneCol(s.tone) }}>{s.headline}</div>
        <div className="text-[12px] leading-snug text-slate-100">{s.action}</div>
        <div className="text-[11.5px] font-semibold" style={{ color: dCol(s.dir) }}>{s.trend}</div>
        <div className="text-[11.5px] leading-snug text-slate-300">{s.fc.text}</div>
        {s.out && s.fc.dir !== 0 && (
          <div className={`text-[11.5px] font-semibold ${s.out.hit ? "text-[#4ade80]" : "text-[#f87171]"}`}>
            Gerçekleşen: 30 dk sonra {s.out.move >= 0 ? "+" : ""}{s.out.move.toFixed(2)} puan — {s.out.hit ? "yön doğru" : "yön yanlış"}{s.out.targetHit ? " · hedefe değdi" : ""}{s.out.invalidHit ? " · önce iptal seviyesi geldi" : ""}{s.out.done ? "" : " (süre dolmadı)"}
          </div>
        )}
        {mark && (
          <div className="mt-1 rounded border border-orange-500/30 bg-orange-500/5 px-2 py-1 text-[11px] leading-snug text-orange-200">
            <b>Karar merdiveni {s.clock}:</b> {mark.status}{mark.side ? ` ${mark.side}` : ""} — {mark.message}
            {mark.openTrend && <span className="block text-orange-300">Açılış trendi: {mark.openTrend}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 bg-[#0f141d] px-3 py-2">
        <div className="flex items-baseline justify-between text-[11px] text-slate-400">
          <span>yön puanı <b className="font-mono text-[13px]" style={{ color: dCol(s.dir) }}>{sg(s.score)}</b> / ±6,5 · eşik {s.threshold}</span>
          <span className="font-mono">ivme {sg(s.mom.score)}</span>
        </div>
        {!s.pre && <Gauge score={s.score} thr={s.threshold} />}
        {!s.pre && <BreakdownChips b={s.breakdown} />}
        <HtfChips h={s.htf} />
        <div className="font-mono text-[10.5px] leading-snug text-slate-400">
          {s.vwap != null && <>VWAP {num(s.vwap)} · </>}{s.poc != null && <>POC {num(s.poc)} · </>}{s.ema5 != null && <>EMA20 5m {num(s.ema5)} · </>}{s.ema15 != null && <>15m {num(s.ema15)}</>}
          <br />
          {s.rvol5 != null && <>RVOL 5m {s.rvol5.toFixed(2)} · </>}{s.rvol15 != null && <>15m {s.rvol15.toFixed(2)} · </>}30dk itki {s.mom.impulse.toFixed(1)} ATR · VWAP kesişimi {s.crosses}
        </div>
      </div>
      <div className="flex flex-col gap-1 bg-[#0f141d] px-3 py-2">
        <div className="text-[11px] leading-snug text-slate-300">{s.c5}</div>
        {s.c15 && <div className="text-[11px] leading-snug text-sky-200">{s.c15}</div>}
        {s.checklist.length > 0 && (
          <div>
            <div className="mt-1 text-[10.5px] font-semibold text-slate-500">{s.setup ? `${s.setup.tag} ${s.setup.side} · ${TAG_TEXT[s.setup.tag]}` : "kontrol listesi"}</div>
            <ul className="flex flex-col gap-0.5">
              {s.checklist.map((c) => (
                <li key={c.key} className="flex gap-1.5 text-[11px] leading-snug">
                  <span className={c.ok ? "text-[#4ade80]" : "text-slate-600"}>{c.ok ? "✓" : "✗"}</span>
                  <span className={c.ok ? "text-slate-200" : "text-slate-400"}>{c.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(s.warns ?? []).map((w) => <div key={w} className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-200">DİKKAT · {VETO_TEXT[w]}</div>)}
        {s.events.length > 0 && <ul className="mt-1 flex flex-col gap-0.5 text-[10.5px] leading-snug text-slate-400">{s.events.map((e, i) => <li key={i}>• {e}</li>)}</ul>}
      </div>
    </div>
  );
}

function NowBlock({ r, s, countdown }: { r: TrackRead; s: TrackStep; countdown: string | null }) {
  const col = toneCol(s.tone);
  const p = s.pos;
  return (
    <div className="grid grid-cols-1 gap-px bg-[#1c2635] md:grid-cols-[1.25fr_1fr_1fr]">
      <div className="bg-[#0f141d] px-3 py-2.5" style={{ borderLeft: `3px solid ${col}` }}>
        <div className="flex items-baseline justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">
          <span>Şimdi · {s.clock} kapanışı</span>
          {countdown && <span className="font-mono normal-case tracking-normal text-slate-400">sonraki kontrol {r.nextCheck} · {countdown}</span>}
        </div>
        <div className="mt-0.5 text-[20px] font-black leading-tight tracking-wide" style={{ color: col }}>{s.headline}</div>
        <div className="mt-1 text-[13px] font-semibold leading-snug text-slate-100">{s.action}</div>
        <div className="mt-1 text-[12px] font-bold" style={{ color: dCol(s.dir) }}>{s.trend}</div>
        <div className="mt-1 rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-1 text-[12px] leading-snug text-slate-200">
          {s.fc.text}
          {s.fc.rule && <span className="block text-[10.5px] text-slate-500">Kural: {FC_RULES[s.fc.rule].text}. Geçmiş ölçüm {FC_RULES[s.fc.rule].n} tahmin, %{FC_RULES[s.fc.rule].hit} isabet.</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 bg-[#0f141d] px-3 py-2.5">
        <div className="flex items-baseline justify-between text-[11px] text-slate-400">
          <span>Yön puanı <b className="font-mono text-[16px]" style={{ color: dCol(s.dir) }}>{sg(s.score)}</b> <span className="text-slate-500">/ ±6,5</span></span>
          <span className="font-mono text-[11px]" style={{ color: dCol(s.dir) }}>{s.dir ? s.strength : "YÖN YOK"}</span>
        </div>
        {!s.pre && <Gauge score={s.score} thr={s.threshold} />}
        {!s.pre && <BreakdownChips b={s.breakdown} />}
        <div className="mt-0.5 text-[10.5px] text-slate-500">15m = teyit · 30m / 1h / 4h yalnız bilgi (karara girmez):</div>
        <HtfChips h={s.htf} />
      </div>
      <div className="flex flex-col gap-1 bg-[#0f141d] px-3 py-2.5">
        {s.runners?.length > 0 && (
          <div className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11.5px] leading-snug text-sky-100">
            <b className="text-sky-300">Taşınan yarı</b> (stop yalnız sıkılaşır):
            {s.runners.map((x, k) => <div key={k} className="font-mono">{x.side} {x.entryClock} · giriş {num(x.entry)} · stop <b>{num(x.stop)}</b> · {x.liveR >= 0 ? "+" : "−"}{Math.abs(x.liveR).toFixed(2)}R</div>)}
          </div>
        )}
        {p ? (
          <>
            <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">Pozisyon · {p.tag}{p.contracts ? ` · ${p.contracts} kontrat` : ""}</div>
            <div className="text-[16px] font-black" style={{ color: p.side === "CALL" ? UP : DN }}>{p.side === "CALL" ? "▲ CALL" : "▼ PUT"} · {p.liveR >= 0 ? "+" : "−"}{Math.abs(p.liveR).toFixed(2)}R</div>
            <div className="grid grid-cols-2 gap-1 font-mono text-[11.5px]">
              {([["giriş", p.entry], ["stop", p.stop], ["1R (yarısı)", p.h1], ["sonraki seviye", p.h2]] as const).map(([k, v]) => (
                <div key={k} className="rounded border border-[#1c2635] bg-[#0a0e17] px-1.5 py-0.5"><span className="text-[9.5px] text-slate-500">{k} </span><b className="text-slate-100">{num(v)}</b></div>
              ))}
            </div>
            <div className="text-[11px] text-slate-400">{"1R'de 1 kontratı kapat, stopu girişe çek · kalan yarı: her 15m kapanışında stop 15m " + (p.side === "CALL" ? "dibinin altına" : "tepesinin üstüne") + " (tamponlu) taşınır · 15m yön teyidi 1R'den önce dönerse çık"}</div>
          </>
        ) : s.setup ? (
          <>
            <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">Kurulum · {s.setup.status === "ARMED" ? "HAZIR" : "İZLENİYOR"}</div>
            <div className="text-[14px] font-extrabold" style={{ color: s.setup.status === "ARMED" ? WARN : s.setup.side === "CALL" ? UP : DN }}>{s.setup.side} · {s.setup.tag} <span className="text-[11px] font-semibold text-slate-400">({TAG_TEXT[s.setup.tag]})</span></div>
            {s.setup.triggerText && <div className="text-[11.5px] text-slate-200">Tetik: {s.setup.triggerText}{s.setup.stop != null ? ` · stop ${num(s.setup.stop)}` : ""}</div>}
            <ul className="mt-0.5 flex flex-col gap-0.5">
              {s.checklist.map((c) => (
                <li key={c.key} className="flex gap-1.5 text-[11.5px] leading-snug">
                  <span className={`font-bold ${c.ok ? "text-[#4ade80]" : "text-slate-600"}`}>{c.ok ? "✓" : "✗"}</span>
                  <span className={c.ok ? "text-slate-100" : "text-slate-400"}>{c.text}</span>
                </li>
              ))}
            </ul>
            {(s.warns ?? []).map((w) => <div key={w} className="mt-0.5 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-200">DİKKAT · {VETO_TEXT[w]} (engellemez)</div>)}
          </>
        ) : (
          <>
            <div className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500">Kurulum</div>
            <div className="text-[12px] leading-snug text-slate-300">
              {s.pre ? "Seans öncesi — işlem yok. İlk 15m yön teyidi 09:45'te." : s.phase === "KAPANIŞ" ? "15:00 sonrası yeni giriş yok — açık pozisyon 15:45'e kadar yönetilir." : s.phase === "AÇILIŞ" ? "09:45 15m kapanışı bekleniyor — yön teyidi gelince 5m tetik aranır." : "15m kapanış VWAP ile EMA20 arasında — yön teyidi yok. 15m ikisinin üstünde/altında kapanınca 5m tetik aranır."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TrackerPanel({ r, nowSec, live, marks, hist }: {
  r: TrackRead | null;
  nowSec: number;
  live: boolean;
  /** mum başlangıcı → karar merdiveninin o mumdaki durumu */
  marks?: Map<number, LadderMark>;
  hist: TrackerSummary | null;
}) {
  const [selT, setSelT] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /** kullanıcı yukarı kaydırdıysa yeni kapanışta aşağı atlanmaz */
  const [pinned, setPinned] = useState(true);

  const byMin = useMemo(() => {
    const m = new Map<number, TrackStep>();
    for (const s of r?.steps ?? []) m.set(s.min, s);
    return m;
  }, [r]);
  const cur = r?.current ?? null;
  const rows = useMemo(() => {
    const lastMin = cur?.min ?? 0;
    return ROWS.filter((row) => row.mins.some((m) => byMin.has(m)) || (row.mins[0] <= lastMin + 5 && row.mins[5] >= lastMin + 5));
  }, [byMin, cur?.min]);

  // yeni kapanışta son satıra kaydır (kullanıcı yukarı kaydırmadıysa)
  const lastKey = cur ? `${cur.t}` : "";
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [lastKey, rows.length, expanded, pinned]);

  if (!r) {
    return (
      <div className="rounded-lg border border-[#1c2635] bg-[#0f141d] px-3 py-3 text-[12px] text-slate-400">
        <b className="text-slate-200">Takip Sistemi</b> — 09:00 ET&apos;den itibaren her 5m kapanışında analiz; mum verisi bekleniyor.
      </div>
    );
  }
  const sel = selT != null ? r.steps.find((s) => s.t === selT) ?? null : null;
  const secsLeft = cur && live ? cur.t + 600 - nowSec : null;
  const countdown = secsLeft != null && secsLeft > 0 && secsLeft <= 600 ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, "0")}` : null;
  const doneTr = r.trades.filter((t) => t.resultR != null);
  const openTr = r.trades.find((t) => t.resultR == null);
  const badge = (txt: string, c: string, title?: string) => <span title={title} className="rounded border px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: c, borderColor: `${c}66`, backgroundColor: `${c}14` }}>{txt}</span>;

  return (
    <div className="overflow-hidden rounded-lg border border-[#1c2635] bg-black">
      {/* başlık + gün rozetleri */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold tracking-wide text-slate-100">Takip Sistemi</span>
          <span className="text-[11px] text-slate-400">· 5m tetik · 15m yön teyidi · VWAP · EMA20 · hacim · formasyon (RSI/RVOL belirsizlikte) · {cur ? PHASE_TEXT[cur.phase] : ""}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {badge(`seans öncesi ${r.k0.bias}`, r.k0.bias === "CALL" ? UP : r.k0.bias === "PUT" ? DN : NEU, "Premarket fiyatı dünkü kapanışa göre + premarket aralık kırılımı (bilgi)")}
          {badge(`gap ${r.gap.pts != null ? (r.gap.pts >= 0 ? "+" : "") + r.gap.pts.toFixed(2) : "—"} ${r.gap.type}`, r.gap.type === "UP" ? UP : r.gap.type === "DOWN" ? DN : NEU)}
          {r.dayClass && badge(r.dayClass === "TREND_CANDLE" ? "TREND MUMU" : r.dayClass === "INDECISION" ? "KARARSIZ AÇILIŞ" : "NORMAL AÇILIŞ", r.dayClass === "TREND_CANDLE" ? WARN : NEU, "09:30–09:45 15m mumunun sınıfı")}
          {r.or15?.squeeze && badge("DAR AÇILIŞ", WARN, "OR15 günlük ATR'nin %15'inden dar — kırılım yakın olabilir")}
          {r.eventDay && badge("VERİ GÜNÜ", WARN, "dikkat — boyut yarım")}
          {badge(`30dk tahmin ${r.pred.hit}/${r.pred.n}`, NEU, "Bugün sonucu belli olan yönlü tahminler: doğru yön / toplam")}
          {r.trades.length > 0 && badge(`işlem ${r.trades.length} · ${r.realizedR >= 0 ? "+" : ""}${r.realizedR.toFixed(2)}R`, r.realizedR >= 0 ? UP : DN)}
        </span>
      </div>

      {cur && <NowBlock r={r} s={cur} countdown={countdown} />}

      {/* zaman şeridi */}
      <div className="flex items-center justify-between gap-2 border-t border-[#1c2635] px-3 py-1">
        <span className="text-[11px] text-slate-400">5 dk&apos;lık analiz kartları · her satır 30 dk · karta tıkla → ayrıntı{pinned ? " · son satır gösteriliyor" : ""}</span>
        <span className="flex gap-1">
          {!pinned && <button type="button" onClick={() => { setPinned(true); const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; setSelT(null); }} className="rounded border border-sky-500/50 px-2 py-0.5 text-[11px] font-semibold text-sky-300">↓ son satır</button>}
          <button type="button" onClick={() => setExpanded((v) => !v)} className="rounded-md border border-sky-500/60 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/30">{expanded ? "▴ daralt" : "▾ tüm gün"}</button>
        </span>
      </div>
      <div
        ref={scrollRef}
        onScroll={(e) => { const el = e.currentTarget; const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 24; if (atBottom !== pinned) setPinned(atBottom); }}
        className={`overflow-y-auto border-t border-[#1c2635] ${expanded ? "" : "max-h-[322px] sm:max-h-[228px] lg:max-h-[150px]"}`}
      >
        {rows.map((row) => {
          const first = row.mins[0], last = row.mins[5];
          return (
            <div key={row.key} className="border-b border-[#151c28] px-2 py-1 last:border-0">
              <div className="mb-0.5 flex items-baseline gap-2 font-mono text-[10.5px]">
                <b className="text-slate-300">{hm(first)}–{hm(last)}</b>
                <span className="font-sans text-slate-500">{row.title}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
                {row.mins.map((m) => {
                  const s = byMin.get(m) ?? null;
                  return <Cell key={m} s={s} min={m} past={!!cur && m < cur.min} sel={!!s && s.t === selT} isNow={!!s && s.t === cur?.t} onSel={() => s && setSelT((v) => (v === s.t ? null : s.t))} mark={s ? marks?.get(s.t) : undefined} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
      {sel && <StepDetail s={sel} mark={marks?.get(sel.t)} />}

      {/* bugünkü işlemler + uyarılar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#1c2635] px-3 py-1.5">
        <button type="button" onClick={() => setShowTrades((v) => !v)} className="rounded-md border border-sky-500/60 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/30">{showTrades ? "▴ gizle" : "▾ göster"}</button>
        <span className="text-[12px] font-semibold text-slate-300">Bugünkü işlemler ve uyarılar</span>
        <span className="text-[11px] text-slate-500">{r.trades.length ? `${r.trades.length} işlem${openTr ? " · 1 açık" : ""}${doneTr.length ? ` · ${r.realizedR >= 0 ? "+" : ""}${r.realizedR.toFixed(2)}R` : ""}` : "işlem yok"} · {r.alerts.filter((a) => a.level !== "KADEME").length} uyarı</span>
      </div>
      {showTrades && (
        <div className="grid grid-cols-1 gap-px border-t border-[#1c2635] bg-[#1c2635] md:grid-cols-2">
          <div className="bg-[#0f141d] px-3 py-2">
            {r.trades.length === 0 ? <div className="text-[11.5px] text-slate-500">Bugün işlem yok.</div> : (
              <ul className="flex flex-col gap-1 font-mono text-[11px]">
                {r.trades.map((t) => (
                  <li key={t.id} className="text-slate-300">
                    <b style={{ color: t.side === "CALL" ? UP : DN }}>{t.side}</b> {t.entryClock} {t.contracts ?? 2}× {t.tag}{t.reentry ? " (yeniden)" : ""} · {num(t.entry)} · stop {num(t.stop0)} · H1 {num(t.h1)} · {t.size === "half" ? "½" : "tam"}
                    {" → "}{t.exitClock ? <>{t.exitClock} {t.exitReason} <b className={(t.resultR ?? 0) >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{(t.resultR ?? 0) >= 0 ? "+" : ""}{t.resultR}R</b></> : <b className="text-sky-300">açık {t.liveR != null ? `${t.liveR >= 0 ? "+" : ""}${t.liveR}R` : ""}</b>}
                    <span className="text-slate-500"> · MFE {t.mfeR}R · {t.strike}{t.momWhy?.length ? ` · momentum: ${t.momWhy.join(", ")}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="max-h-[200px] overflow-y-auto bg-[#0f141d] px-3 py-2">
            {r.alerts.length === 0 ? <div className="text-[11.5px] text-slate-500">Uyarı yok.</div> : (
              <ul className="flex flex-col gap-0.5 text-[11px] leading-snug">
                {[...r.alerts].reverse().map((a) => (
                  <li key={a.key} className={a.level === "TETİK" ? "text-[#4ade80]" : a.level === "ÇIKIŞ" ? "text-orange-300" : a.level === "İPTAL" ? "text-slate-500" : a.level === "YÖNET" ? "text-sky-300" : "text-slate-400"}>
                    <span className="font-mono">{a.clock}</span> <b>{a.level}</b> · {a.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* geçmiş */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#1c2635] px-3 py-1.5">
        <button type="button" onClick={() => setShowHist((v) => !v)} className="rounded-md border border-sky-500/60 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/30">{showHist ? "▴ gizle" : "▾ göster"}</button>
        <span className="text-[12px] font-semibold text-slate-300">Takip Sistemi geçmişi</span>
        <span className="text-[11px] text-slate-500">{hist ? `${hist.count} seans (${hist.liveCount} canlı) · 30 dk tahmin isabeti %${hist.pred.n ? Math.round((100 * hist.pred.hit) / hist.pred.n) : 0} (${hist.pred.n})` : "yükleniyor"}</span>
      </div>
      {showHist && hist && (
        <div className="border-t border-[#1c2635] bg-[#0f141d] px-3 py-2">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-slate-400">Kurulumlar (n · kazanç · ort. R · toplam · durum)</div>
              {hist.byTag.length === 0 ? <div className="text-[11.5px] text-slate-500">Henüz işlem yok.</div> : (
                <table className="w-full font-mono text-[11px]">
                  <tbody>
                    {hist.byTag.map((t) => (
                      <tr key={t.tag} className="border-b border-[#151c28] text-slate-300">
                        <td className="py-0.5 pr-2">{t.tag}</td><td className="pr-2">{t.n}</td><td className="pr-2">%{t.win}</td>
                        <td className={`pr-2 ${t.avgR >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>{t.avgR >= 0 ? "+" : ""}{t.avgR}R</td>
                        <td className="pr-2">{t.totalR >= 0 ? "+" : ""}{t.totalR}R</td>
                        <td className={t.status === "LIVE_OK" ? "text-[#4ade80]" : "text-amber-300"}>{t.status === "LIVE_OK" ? "CANLI OK" : "GÖZLEM"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-1 text-[10.5px] text-slate-500">CANLI OK = en az 100 işlem ve işlem başı ≥ +0,20R. Altındakiler gözlemde: sinyal verir ama kanıt henüz yetersiz. (K*/T_* = önceki sürümün etiketleri.)</div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-slate-400">30 dk tahmin kuralları (gerçekleşen)</div>
              <table className="w-full font-mono text-[11px]">
                <tbody>
                  {hist.byRule.map((x) => (
                    <tr key={x.rule} className="border-b border-[#151c28] text-slate-300">
                      <td className="py-0.5 pr-2 font-sans">{FC_RULES[x.rule].label}</td>
                      <td className="pr-2">{x.n}</td>
                      <td className="pr-2">yön %{x.n ? Math.round((100 * x.hit) / x.n) : 0}</td>
                      <td className="pr-2">hedef %{x.n ? Math.round((100 * x.tHit) / x.n) : 0}</td>
                      <td className={x.avgMove >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{x.avgMove >= 0 ? "+" : ""}{x.avgMove}</td>
                      <td className="pl-2 text-slate-500">{x.liveN ? `canlı %${Math.round((100 * x.liveHit) / x.liveN)} (${x.liveN})` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-1 text-[10.5px] text-slate-500">Ort. = tahmin yönünde 30 dk&apos;lık puan. Yön isabeti %50 = yazı-tura.</div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-slate-400">Son seanslar</div>
              <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-slate-300">
                {hist.recent.map((d) => (
                  <li key={d.date}>{d.date.slice(5)}{d.backfill ? "*" : ""} · eğilim {d.bias} · gap {d.gap} · {d.dayClass ?? "—"} · tahmin {d.pred} · {d.trades} işlem {d.trades ? `${d.r >= 0 ? "+" : ""}${d.r}R` : ""}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-slate-400">Son 20 işlem</div>
              <ul className="flex max-h-[180px] flex-col gap-0.5 overflow-y-auto font-mono text-[11px] text-slate-300">
                {hist.trades.map((t) => (
                  <li key={t.id}>{t.date.slice(5)} {t.entryClock} <b style={{ color: t.side === "CALL" ? UP : DN }}>{t.side}</b> {t.tag} → {t.exitReason} <b className={(t.resultR ?? 0) >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{(t.resultR ?? 0) >= 0 ? "+" : ""}{t.resultR}R</b></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-2 text-[10.5px] leading-snug text-slate-500">* geriye dönük (canlı motorun aynı fonksiyonuyla gün yeniden oynatıldı). Her seans 16:05 ET&apos;den sonra dondurularak kaydedilir. Opsiyon akışı geçmişte yok (flow=off).</div>
        </div>
      )}
    </div>
  );
}
