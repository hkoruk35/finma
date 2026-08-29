"use client";

/**
 * SPY Engine V2 — "Sinyaller & Arşiv" sekmesi.
 *
 * Sol: bu seansın sinyalleri ve sonuçları, anlık takip.
 * Sağ: Supabase'e yazılmış geçmiş seanslar.
 *
 * Motor deterministik olduğu için bu sekme grafikte gördüğünüz işaretlerin
 * TAM listesidir — ayrı bir hesaplama yapılmaz, aynı `events`/`positions`
 * dizileri gösterilir.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { nyClock } from "@/lib/spyengine/core";
import { EVENT_LABEL, EVENT_STYLE, type PositionState } from "@/lib/spyengine/strategy";
import { Panel, SURFACE, num, signed, tone } from "./panels";

interface ArchiveTrade {
  id: string;
  side: "LONG" | "SHORT";
  entryTime: number;
  entrySpot: number;
  contract: string | null;
  strike: number | null;
  entryPremium: number | null;
  exitTime: number | null;
  exitReason: string | null;
  closedPct: number;
  status: string;
  realizedPnl: number;
  premiumDataMissing: boolean;
}

interface ArchiveSession {
  date: string;
  updatedAt: string;
  trades: ArchiveTrade[];
  totalPnl: number;
  closed: number;
  wins: number;
  losses: number;
}

const REASON_LABEL: Record<string, string> = {
  STOP: "Stop",
  TRAIL_EXIT: "Trailing",
  EOD_EXIT: "Gün Sonu",
};

function toArchiveTrade(p: PositionState) {
  return {
    id: p.id,
    side: p.side,
    entryTime: p.entryTime,
    entrySpot: p.entrySpot,
    contract: p.contract,
    strike: p.strike,
    entryPremium: p.entryPremium,
    stopLevel: p.stopLevel,
    targetLevel: p.targetLevel,
    peakPremium: p.peakPremium,
    trailLevel: p.trailLevel,
    exitTime: p.exitTime,
    exitReason: p.exitReason,
    closedPct: p.closedPct,
    status: p.status,
    realizedPnl: p.realizedPnl,
    premiumDataMissing: p.premiumDataMissing,
    events: p.events.map((e) => ({
      kind: e.kind, time: e.time, premium: e.premium, label: e.label, note: e.note,
    })),
  };
}

export default function SignalsArchive({ positions, sessionDate }: {
  positions: PositionState[];
  sessionDate: string | null;
}) {
  const [sessions, setSessions] = useState<ArchiveSession[]>([]);
  const [totals, setTotals] = useState<{ pnl: number; closed: number; wins: number; losses: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadArchive = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/spyengine/v2/archive", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setSessions(json.sessions || []);
        setTotals(json.totals || null);
      } else {
        setMessage(json.error || "Arşiv okunamadı");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Arşiv, harici bir sistemden (Supabase) okunuyor: mount'ta bir kez ve
  // sonra kapanan işlem sayısı değiştikçe senkronize edilir.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await loadArchive();
    })();
    return () => { cancelled = true; };
  }, [loadArchive]);

  const save = useCallback(async () => {
    if (!sessionDate) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/spyengine/v2/archive", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: sessionDate, trades: positions.map(toArchiveTrade) }),
      });
      const json = await res.json();
      setMessage(json.ok ? `${sessionDate} arşivlendi (${json.saved} işlem).` : json.error || "Kaydedilemedi");
      if (json.ok) await loadArchive();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [sessionDate, positions, loadArchive]);

  // Kapanan işlem sayısı değiştiğinde otomatik arşivle — el ile
  // "kaydet"e basmayı beklemeden gün içi sonuçlar kalıcı olsun.
  const closedCount = positions.filter((p) => p.status === "CLOSED").length;
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);
  useEffect(() => {
    if (!sessionDate || !closedCount) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await saveRef.current();
    })();
    return () => { cancelled = true; };
  }, [closedCount, sessionDate]);

  const live = positions;
  const liveClosed = live.filter((p) => p.status === "CLOSED");
  const livePnl = liveClosed.reduce((s, p) => s + p.realizedPnl, 0);
  const liveOpenPnl = live.filter((p) => p.status !== "CLOSED").reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_1fr]">
      {/* ── Bu seans ── */}
      <Panel
        title={`Bu Seansın Sinyalleri${sessionDate ? ` · ${sessionDate}` : ""}`}
        right={
          <button
            type="button"
            onClick={save}
            disabled={saving || !sessionDate || !positions.length}
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:bg-[#1c2635] disabled:opacity-40"
          >
            {saving ? "Kaydediliyor…" : "Arşive kaydet"}
          </button>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded border border-[#1c2635] bg-[#1c2635] sm:grid-cols-4">
          {[
            { k: "Sinyal", v: String(live.length) },
            { k: "Kapanan", v: String(liveClosed.length) },
            { k: "Gerçekleşen K/Z", v: `$${signed(livePnl)}`, t: tone(livePnl) },
            { k: "Açık K/Z", v: `$${signed(liveOpenPnl)}`, t: tone(liveOpenPnl) },
          ].map((c) => (
            <div key={c.k} className="bg-[#0f141d] px-2 py-1.5">
              <div className="text-[9px] tracking-wider text-slate-500">{c.k}</div>
              <div className={`font-mono text-[13px] font-semibold ${c.t ?? "text-slate-100"}`}>{c.v}</div>
            </div>
          ))}
        </div>

        {!live.length ? (
          <div className="text-[12px] italic text-slate-600">
            Bu seansta henüz giriş sinyali üretilmedi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[11px]">
              <thead>
                <tr className="border-b border-[#1c2635] text-left text-[9px] tracking-wider text-slate-500">
                  <th className="py-1.5 pr-2 font-semibold">SAAT</th>
                  <th className="py-1.5 pr-2 font-semibold">YÖN</th>
                  <th className="py-1.5 pr-2 font-semibold">KONTRAT</th>
                  <th className="py-1.5 pr-2 font-semibold">GİRİŞ SPY</th>
                  <th className="py-1.5 pr-2 font-semibold">GİRİŞ PRİM</th>
                  <th className="py-1.5 pr-2 font-semibold">STOP</th>
                  <th className="py-1.5 pr-2 font-semibold">HEDEF</th>
                  <th className="py-1.5 pr-2 font-semibold">DURUM</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">K/Z</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[...live].reverse().map((p) => {
                  const open = expanded === p.id;
                  const total = p.realizedPnl + (p.unrealizedPnl ?? 0);
                  return [
                    <tr
                      key={p.id}
                      onClick={() => setExpanded(open ? null : p.id)}
                      className="cursor-pointer border-b border-[#151c28] transition-colors hover:bg-[#141b26]"
                    >
                      <td className="py-1.5 pr-2 text-slate-400">{nyClock(p.entryTime)}</td>
                      <td className="py-1.5 pr-2">
                        <span className={p.side === "LONG" ? "text-[#22c55e]" : "text-[#ef4444]"}>
                          {p.side === "LONG" ? "▲ LONG" : "▼ SHORT"}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-[10px] text-slate-500">{p.contract ?? "prim yok"}</td>
                      <td className="py-1.5 pr-2 text-slate-300">{num(p.entrySpot)}</td>
                      <td className="py-1.5 pr-2 text-slate-300">{p.entryPremium == null ? "—" : num(p.entryPremium)}</td>
                      <td className="py-1.5 pr-2 text-[#ef4444]">{p.stopLevel == null ? "—" : num(p.stopLevel)}</td>
                      <td className="py-1.5 pr-2 text-[#38bdf8]">{p.targetLevel == null ? "—" : num(p.targetLevel)}</td>
                      <td className="py-1.5 pr-2">
                        {p.status === "CLOSED" ? (
                          <span className="text-slate-400">
                            {REASON_LABEL[p.exitReason ?? ""] ?? "Kapandı"} · {p.exitTime ? nyClock(p.exitTime) : "—"}
                          </span>
                        ) : p.status === "HALF" ? (
                          <span className="text-[#38bdf8]">%50 kapalı</span>
                        ) : (
                          <span className="text-[#22c55e]">Açık</span>
                        )}
                      </td>
                      <td className={`py-1.5 pr-2 text-right ${tone(total)}`}>{signed(total)}$</td>
                    </tr>,
                    open ? (
                      <tr key={`${p.id}-ev`} className="border-b border-[#151c28] bg-[#0a0e17]">
                        <td colSpan={9} className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            {p.events.map((ev) => {
                              const st = EVENT_STYLE[ev.kind];
                              return (
                                <div key={ev.id} className="flex items-start gap-2 text-[10px]">
                                  <span className="w-10 shrink-0 text-slate-600">{nyClock(ev.time)}</span>
                                  <span className="shrink-0 rounded px-1 py-0.5 font-bold" style={{ backgroundColor: `${st.color}22`, color: st.color }}>
                                    {st.glyph} {EVENT_LABEL[ev.kind]}
                                  </span>
                                  <span className="flex-1 text-slate-500">{ev.note}</span>
                                </div>
                              );
                            })}
                            {p.trailPath.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {p.trailPath.map((s, i) => (
                                  <span key={i} className="rounded bg-[#1c2635] px-1 py-0.5 text-[9px] text-[#a855f7]">
                                    {nyClock(s.time)} → {num(s.level)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
        {message && <div className="mt-2 text-[10px] text-slate-500">{message}</div>}
      </Panel>

      {/* ── Arşiv ── */}
      <Panel
        title="Arşiv (Supabase)"
        right={
          <button
            type="button"
            onClick={loadArchive}
            className="rounded border border-[#1c2635] bg-[#111827] px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-[#1c2635]"
          >
            yenile
          </button>
        }
      >
        {totals && (
          <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded border border-[#1c2635] bg-[#1c2635] sm:grid-cols-4">
            {[
              { k: "Toplam K/Z", v: `$${signed(totals.pnl)}`, t: tone(totals.pnl) },
              { k: "İşlem", v: String(totals.closed) },
              { k: "Kazanan", v: String(totals.wins), t: "text-[#22c55e]" },
              { k: "Kaybeden", v: String(totals.losses), t: "text-[#ef4444]" },
            ].map((c) => (
              <div key={c.k} className="bg-[#0f141d] px-2 py-1.5">
                <div className="text-[9px] tracking-wider text-slate-500">{c.k}</div>
                <div className={`font-mono text-[13px] font-semibold ${c.t ?? "text-slate-100"}`}>{c.v}</div>
              </div>
            ))}
          </div>
        )}

        {!sessions.length ? (
          <div className="text-[12px] italic text-slate-600">
            Henüz arşivlenmiş seans yok. Gün içinde bir pozisyon kapandığında otomatik yazılır.
          </div>
        ) : (
          <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
            {sessions.map((s) => (
              <div key={s.date} className={`${SURFACE} p-2`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-slate-200">{s.date}</span>
                  <span className={`font-mono text-[11px] font-semibold ${tone(s.totalPnl)}`}>${signed(s.totalPnl)}</span>
                </div>
                <div className="mb-1.5 flex gap-3 text-[9px] text-slate-500">
                  <span>{s.trades.length} sinyal</span>
                  <span>{s.closed} kapandı</span>
                  <span className="text-[#22c55e]">{s.wins} kazanç</span>
                  <span className="text-[#ef4444]">{s.losses} kayıp</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {s.trades.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="w-9 text-slate-600">{nyClock(t.entryTime)}</span>
                      <span className={t.side === "LONG" ? "text-[#22c55e]" : "text-[#ef4444]"}>
                        {t.side === "LONG" ? "▲" : "▼"}
                      </span>
                      <span className="w-24 truncate text-slate-500" title={t.contract ?? ""}>{t.contract ?? "prim yok"}</span>
                      <span className="text-slate-400">{num(t.entrySpot)}</span>
                      <span className="text-slate-600">{REASON_LABEL[t.exitReason ?? ""] ?? t.status}</span>
                      <span className={`ml-auto ${tone(t.realizedPnl)}`}>{signed(t.realizedPnl)}$</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
