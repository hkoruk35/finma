"use client";

/**
 * Motor izleme listesi (Endeks Merkezi) — bütün Takip Sistemi motorlarının anlık durumu tek tabloda, 60 sn'de bir.
 * Veri: /api/admin/engine/status (lib/spyengine/liveStatus.ts — son kapanmış 5m mumla, birkaç dk gecikmeli olabilir).
 * Yeni pozisyon / tetik hazır / erken uyarı / yeni TETİK·ÇIKIŞ uyarısında satır yanıp söner, isteğe bağlı ses + tarayıcı bildirimi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TickerHoverChart from "@/components/TickerHoverChart";
import type { EngineLiveStatus } from "@/lib/spyengine/liveStatus";

interface Props { symbols: { symbol: string; page: string; group: string }[] }

const f2 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));
const STATE: Record<number, { label: string; cls: string }> = {
  3: { label: "POZİSYON", cls: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" },
  2: { label: "TETİK HAZIR", cls: "border-amber-400/60 bg-amber-400/15 text-amber-200" },
  1: { label: "ERKEN UYARI", cls: "border-amber-400/40 bg-amber-400/[0.07] text-amber-300" },
  0: { label: "BEKLE", cls: "border-slate-600/50 bg-slate-500/10 text-slate-400" },
};

export default function EngineMonitor({ symbols }: Props) {
  const [rows, setRows] = useState<EngineLiveStatus[]>([]);
  const [at, setAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [sound, setSound] = useState(false);
  const [notif, setNotif] = useState<NotificationPermission | "unsupported">("default");
  const prev = useRef<Record<string, { rank: number; lastKey: string }>>({});
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    try { setSound(localStorage.getItem("engine_monitor_sound") === "1"); } catch { /* yok */ }
    setNotif(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const beep = useCallback(() => {
    try {
      const ctx = audio.current ?? new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audio.current = ctx;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25);
    } catch { /* ses yok */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/engine/status?symbols=${symbols.map((s) => s.symbol).join(",")}`, { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) return;
      const st: EngineLiveStatus[] = j.statuses;
      const newFlash: Record<string, number> = {};
      const msgs: string[] = [];
      for (const s of st) {
        const lastKey = s.last ? `${s.last.clock}${s.last.level}` : "";
        const p = prev.current[s.symbol];
        if (p) {
          const rose = s.rank > p.rank;
          const newAlert = lastKey && lastKey !== p.lastKey && (s.last!.level === "TETİK" || s.last!.level === "ÇIKIŞ" || s.last!.level === "HAZIRLAN");
          if (rose || newAlert) {
            newFlash[s.symbol] = Date.now();
            msgs.push(`${s.symbol}: ${rose ? STATE[s.rank].label : s.last!.level}${s.pos ? ` ${s.pos.side}` : s.armed ? ` ${s.armed.side}` : ""}`);
          }
        }
        prev.current[s.symbol] = { rank: s.rank, lastKey };
      }
      if (msgs.length) {
        setFlash((f) => ({ ...f, ...newFlash }));
        if (sound) beep();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try { new Notification("BOGA Motor uyarısı", { body: msgs.join(" · ") }); } catch { /* yok */ }
        }
      }
      setRows(st);
      setAt(j.serverTime);
    } catch { /* sessiz */ } finally { setLoading(false); }
  }, [symbols, sound, beep]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const meta = Object.fromEntries(symbols.map((s, i) => [s.symbol, { ...s, i }]));
  const sorted = [...rows].sort((a, b) => b.rank - a.rank || (meta[a.symbol]?.i ?? 0) - (meta[b.symbol]?.i ?? 0));
  const cnt = (k: number) => rows.filter((r) => r.rank === k).length;
  const now = Date.now();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
          <span className={STATE[3].cls + " rounded border px-2 py-0.5 font-bold"}>{cnt(3)} pozisyon</span>
          <span className={STATE[2].cls + " rounded border px-2 py-0.5 font-bold"}>{cnt(2)} tetik hazır</span>
          <span className={STATE[1].cls + " rounded border px-2 py-0.5 font-bold"}>{cnt(1)} erken uyarı</span>
          <span className="text-[10.5px] text-slate-500">{at ? `güncelleme ${new Date(at * 1000).toLocaleTimeString("tr-TR", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" })} ET · 60 sn'de bir · son kapanmış 5m mumla` : loading ? "yükleniyor…" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { const v = !sound; setSound(v); try { localStorage.setItem("engine_monitor_sound", v ? "1" : "0"); } catch { /* yok */ } if (v) beep(); }}
            className={`rounded border px-2.5 py-1 text-[11px] font-bold ${sound ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-[#30363d] bg-[#0d1117] text-slate-400"}`}>
            {sound ? "🔔 Sesli uyarı açık" : "🔕 Sesli uyarı kapalı"}
          </button>
          {notif !== "unsupported" && notif !== "granted" && (
            <button type="button" onClick={async () => { try { setNotif(await Notification.requestPermission()); } catch { /* yok */ } }}
              className="rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white">Tarayıcı bildirimi aç</button>
          )}
          {notif === "granted" && <span className="text-[10.5px] text-slate-500">bildirim açık</span>}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#30363d] bg-[#0f1117]">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              {["Motor", "Durum", "15m yön", "Fiyat", "Pozisyon / tetik", "Son uyarı", "Bugün", "Saat"].map((h) => <th key={h} className="whitespace-nowrap border-b border-[#30363d] px-2.5 py-1.5 font-bold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-slate-500">{loading ? "Motor durumları hesaplanıyor (ilk yükleme ~20 sn)…" : "Veri yok."}</td></tr>}
            {sorted.map((s) => {
              const m = meta[s.symbol];
              const st = STATE[s.rank];
              const hot = flash[s.symbol] && now - flash[s.symbol] < 120_000;
              return (
                <tr key={s.symbol} className={`border-b border-[#1c2128] ${hot ? "animate-pulse bg-amber-400/10" : "hover:bg-white/[0.03]"}`}>
                  <td className="whitespace-nowrap px-2.5 py-1.5">
                    <TickerHoverChart ticker={s.symbol} locale="tr"><Link href={m?.page ?? "#"} className="font-bold text-[#58a6ff] hover:underline">{s.symbol}</Link></TickerHoverChart>
                    <span className="ml-1.5 text-[10px] text-slate-600">{m?.group}</span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5"><span className={`rounded border px-1.5 py-0.5 text-[10.5px] font-bold ${st.cls}`}>{s.ok ? st.label : "VERİ YOK"}</span></td>
                  <td className={`whitespace-nowrap px-2.5 py-1.5 font-bold ${s.dir15 > 0 ? "text-emerald-400" : s.dir15 < 0 ? "text-rose-400" : "text-slate-500"}`}>{s.dir15 > 0 ? "▲ YUKARI" : s.dir15 < 0 ? "▼ AŞAĞI" : "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-100">{f2(s.price)}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5">
                    {s.pos ? (
                      <span className={s.pos.side === "PUT" ? "text-rose-300" : "text-emerald-300"}>
                        {s.pos.side} giriş {f2(s.pos.entry)} · stop {f2(s.pos.stop)} · <b className={s.pos.liveR >= 0 ? "text-emerald-400" : "text-rose-400"}>{s.pos.liveR >= 0 ? "+" : ""}{s.pos.liveR.toFixed(2)}R</b>
                      </span>
                    ) : s.armed ? (
                      <span className="text-amber-200">{s.armed.side} tetik {f2(s.armed.trigger)}</span>
                    ) : s.early ? (
                      <span className="text-amber-300">{s.early.length > 60 ? `${s.early.slice(0, 59)}…` : s.early}</span>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="max-w-[360px] truncate px-2.5 py-1.5 text-[11px] text-slate-400" title={s.last?.text}>
                    {s.last ? <><b className={s.last.level === "TETİK" ? "text-emerald-300" : s.last.level === "ÇIKIŞ" || s.last.level === "RED" ? "text-rose-300" : "text-slate-300"}>{s.last.clock} {s.last.level}</b> {s.last.text.replace(new RegExp(`^${s.last.level}\\s*·?\\s*(\\d{1,2}:\\d{2}\\s*·?\\s*)?`), "")}</> : "—"}
                  </td>
                  <td className={`whitespace-nowrap px-2.5 py-1.5 ${s.realizedR > 0 ? "text-emerald-400" : s.realizedR < 0 ? "text-rose-400" : "text-slate-500"}`}>{s.trades ? `${s.trades} işlem · ${s.realizedR >= 0 ? "+" : ""}${s.realizedR.toFixed(2)}R` : "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-500">{s.asOf ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10.5px] leading-snug text-slate-500">
        Durum sunucuda motorun aynı kurallarıyla son kapanmış 5m mumdan hesaplanır; motor sayfasındaki canlı akışın birkaç dakika gerisinde olabilir.
        Kesin giriş/çıkış için motor sayfasını aç. Ses ve bildirim yalnız bu sayfa açıkken çalışır.
      </p>
    </div>
  );
}
