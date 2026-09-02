"use client";

/**
 * SPY Engine V3.1 — "Sinyaller & Arşiv" sekmesi.
 *
 * Sol: bu seansın sinyalleri ve sonuçları, anlık takip.
 * Sağ: Supabase'e yazılmış geçmiş seanslar — tarih seçilerek incelenir ve
 *      Excel'e (.xls) aktarılır.
 *
 * Motor deterministik olduğu için bu sekme grafikte gördüğünüz işaretlerin
 * TAM listesidir — ayrı bir hesaplama yapılmaz, aynı `positions` dizisi
 * gösterilir.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nyClock } from "@/lib/spyengine/core";
import { EVENT_LABEL, EVENT_STYLE, EXIT_LABEL_SHORT, type PositionState } from "@/lib/spyengine/strategy";
import { toArchiveTrade, type ArchivedTrade, type ArchiveSession } from "@/lib/spyengine/archiveTypes";
import { Panel, SURFACE, num, signed, tone } from "./panels";

type ArchiveTrade = ArchivedTrade;

function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "—";
  return EXIT_LABEL_SHORT[reason as keyof typeof EXIT_LABEL_SHORT] ?? reason;
}

// ── Excel (.xls) dışa aktarma ─────────────────────────────────────

const XLS_HEADERS = [
  "Seans", "Giriş Saati (ET)", "Yön", "Kontrat", "Opsiyon Sembolü",
  "Giriş SPY", "Giriş Primi", "Çıkış Saati (ET)", "Çıkış SPY", "Çıkış Primi",
  "Çıkış Gerekçesi", "Durum", "K/Z ($/kontrat)", "Açıklama",
];

function tradeRow(date: string, t: ArchiveTrade): (string | number)[] {
  return [
    date,
    nyClock(t.entryTime),
    t.side === "LONG" ? "LONG GİRİŞ" : "SHORT GİRİŞ",
    t.contractType,
    t.contract ?? "prim verisi yok",
    t.entrySpot,
    t.entryPremium ?? "",
    t.exitTime ? nyClock(t.exitTime) : "",
    t.exitSpot ?? "",
    t.exitPremium ?? "",
    reasonLabel(t.exitReason),
    t.status === "CLOSED" ? "Kapandı" : "Açık",
    t.realizedPnl,
    t.exitNote ?? "",
  ];
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Excel'in doğrudan açabildiği HTML tablo formatında .xls üretir.
 * CSV yerine bunu tercih ediyoruz: Türkçe Excel'de CSV ayırıcısı `;` olduğu
 * için virgüllü dosyalar tek sütuna yapışıyor ve ondalık ayırıcı çakışıyor.
 * HTML tablosunda böyle bir yerel ayar sorunu yok.
 */
function downloadXls(filename: string, rows: (string | number)[][]) {
  const body = rows
    .map((r, i) => {
      const tag = i === 0 ? "th" : "td";
      const cells = r
        .map((c) => `<${tag}>${escapeHtml(typeof c === "number" ? String(c) : c)}</${tag}>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const html =
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" />` +
    `<style>th{background:#eee;font-weight:bold}td,th{border:1px solid #ccc;padding:4px}</style></head>` +
    `<body><table>${body}</table></body></html>`;

  const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Bileşen ───────────────────────────────────────────────────────

export default function SignalsArchive({ positions, sessionDate }: {
  positions: PositionState[];
  sessionDate: string | null;
}) {
  const [sessions, setSessions] = useState<ArchiveSession[]>([]);
  const [totals, setTotals] = useState<{ pnl: number; closed: number; wins: number; losses: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  /** Arşivde seçili seans — boş = tümü */
  const [pickedDate, setPickedDate] = useState<string>("");

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

  /**
   * Geçmiş seansları sunucuda yeniden oynatıp arşive yazar. Sayfanın açık
   * OLMADIĞI günler böyle kurtarılır; motor deterministik olduğu için sonuç
   * o gün canlı üretilenle aynıdır. Pencere Yahoo 1m geçmişiyle sınırlı
   * (~5 seans) — ötesi için veri yok, uydurulmaz.
   */
  const backfill = useCallback(async () => {
    setBackfilling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/spyengine/v2/archive/backfill?days=5", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.ok) {
        const skipped = (json.report ?? []).filter((r: { ok: boolean }) => !r.ok);
        setMessage(
          `${json.written} seans yazıldı · ${json.trades} işlem · ${json.withPremium} tanesinde gerçek prim` +
            (skipped.length
              ? ` · atlanan: ${skipped.map((r: { date: string; note: string }) => `${r.date} (${r.note})`).join(", ")}`
              : ""),
        );
        await loadArchive();
      } else {
        setMessage(json.error || "Geri doldurulamadı");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBackfilling(false);
    }
  }, [loadArchive]);

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

  const visibleSessions = useMemo(
    () => (pickedDate ? sessions.filter((s) => s.date === pickedDate) : sessions),
    [sessions, pickedDate]
  );

  const exportSessions = useCallback((list: ArchiveSession[], filename: string) => {
    const rows: (string | number)[][] = [XLS_HEADERS];
    for (const s of list) for (const t of s.trades) rows.push(tradeRow(s.date, t));
    if (rows.length === 1) {
      setMessage("Dışa aktarılacak işlem yok.");
      return;
    }
    downloadXls(filename, rows);
  }, []);

  const exportLive = useCallback(() => {
    if (!sessionDate || !live.length) return;
    const rows: (string | number)[][] = [XLS_HEADERS];
    for (const p of live) rows.push(tradeRow(sessionDate, toArchiveTrade(p) as ArchiveTrade));
    downloadXls(`spyengine-${sessionDate}.xls`, rows);
  }, [live, sessionDate]);

  const btn = "rounded border border-[#1c2635] bg-[#111827] px-2 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:bg-[#1c2635] disabled:opacity-40";

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
      {/* ── Bu seans ── */}
      <Panel
        title={`Bu Seansın Sinyalleri${sessionDate ? ` · ${sessionDate}` : ""}`}
        right={
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={exportLive} disabled={!live.length} className={btn}>
              ⭳ Excel
            </button>
            <button type="button" onClick={save} disabled={saving || !sessionDate || !positions.length} className={btn}>
              {saving ? "Kaydediliyor…" : "Arşive kaydet"}
            </button>
          </div>
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
            <table className="w-full min-w-[700px] text-[11px]">
              <thead>
                <tr className="border-b border-[#1c2635] text-left text-[9px] tracking-wider text-slate-500">
                  <th className="py-1.5 pr-2 font-semibold">GİRİŞ</th>
                  <th className="py-1.5 pr-2 font-semibold">YÖN</th>
                  <th className="py-1.5 pr-2 font-semibold">KONTRAT</th>
                  <th className="py-1.5 pr-2 font-semibold">GİRİŞ SPY</th>
                  <th className="py-1.5 pr-2 font-semibold">GİRİŞ PRİM</th>
                  <th className="py-1.5 pr-2 font-semibold">ÇIKIŞ</th>
                  <th className="py-1.5 pr-2 font-semibold">ÇIKIŞ PRİM</th>
                  <th className="py-1.5 pr-2 font-semibold">GEREKÇE</th>
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
                          {p.side === "LONG" ? "▲ LONG GİRİŞ" : "▼ SHORT GİRİŞ"}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-[10px] text-slate-500">
                        <span className={p.contractType === "A" ? "text-[#38bdf8]" : "text-[#a855f7]"}>{p.contractType}</span>
                        {" · "}{p.contract ?? "prim yok"}
                      </td>
                      <td className="py-1.5 pr-2 text-slate-300">{num(p.entrySpot)}</td>
                      <td className="py-1.5 pr-2 text-slate-300">{p.entryPremium == null ? "—" : num(p.entryPremium)}</td>
                      <td className="py-1.5 pr-2 text-slate-400">{p.exitTime ? nyClock(p.exitTime) : "—"}</td>
                      <td className="py-1.5 pr-2 text-slate-300">{p.exitPremium == null ? "—" : num(p.exitPremium)}</td>
                      <td className="py-1.5 pr-2">
                        {p.status === "CLOSED" ? (
                          <span className="text-slate-400">{reasonLabel(p.exitReason)}</span>
                        ) : (
                          <span className="text-[#22c55e]">
                            Açık · {p.progress.againstBars}/{p.progress.reversalNeeded} ters mum
                          </span>
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
                            {p.status === "OPEN" && (
                              <div className="mt-0.5 text-[10px] text-slate-500">↳ {p.progress.note}</div>
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
          <div className="flex items-center gap-1.5">
            <select
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="rounded border border-[#1c2635] bg-[#111827] px-1.5 py-1 font-mono text-[10px] text-slate-300"
              title="Seans seç"
            >
              <option value="">Tüm seanslar ({sessions.length})</option>
              {sessions.map((s) => (
                <option key={s.date} value={s.date}>{s.date}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                exportSessions(
                  visibleSessions,
                  pickedDate ? `spyengine-${pickedDate}.xls` : "spyengine-tum-seanslar.xls"
                )
              }
              disabled={!visibleSessions.length}
              className={btn}
            >
              ⭳ Excel
            </button>
            <button
              type="button"
              onClick={backfill}
              disabled={backfilling}
              className={btn}
              title="Son 5 seansı sunucuda yeniden oynatıp gerçek 0DTE primiyle arşive yazar (sayfanın açık olmadığı günler için)"
            >
              {backfilling ? "Dolduruluyor…" : "↻ Geçmişi doldur"}
            </button>
            <button type="button" onClick={loadArchive} className={btn}>yenile</button>
          </div>
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

        {!visibleSessions.length ? (
          <div className="text-[12px] italic text-slate-600">
            {sessions.length
              ? "Seçilen tarihte kayıt yok."
              : "Henüz arşivlenmiş seans yok. Gün içinde bir pozisyon kapandığında otomatik yazılır."}
          </div>
        ) : (
          <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
            {visibleSessions.map((s) => (
              <div key={s.date} className={`${SURFACE} p-2`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-slate-200">{s.date}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[11px] font-semibold ${tone(s.totalPnl)}`}>${signed(s.totalPnl)}</span>
                    <button
                      type="button"
                      onClick={() => exportSessions([s], `spyengine-${s.date}.xls`)}
                      className="rounded bg-[#1c2635] px-1.5 py-0.5 text-[9px] text-slate-400 transition-colors hover:text-slate-200"
                      title={`${s.date} seansını Excel'e aktar`}
                    >
                      ⭳
                    </button>
                  </div>
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
                      <span className="w-20 truncate text-slate-500" title={t.contract ?? ""}>{t.contract ?? "prim yok"}</span>
                      <span className="text-slate-400">{num(t.entrySpot)}</span>
                      <span className="truncate text-slate-600" title={t.exitNote ?? ""}>{reasonLabel(t.exitReason)}</span>
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
