"use client";

/**
 * Hisse Swing / Hisse Opsiyon merkez sayfalarının liste tabloları (2026-11-12).
 * Her satırda: ticker üzerine gelince grafik açılır (TickerHoverChart), tıklayınca detay sayfası.
 * Performans: öneri anındaki fiyat → bugünkü (canlı) fiyat değişimi; swing için swing_performance.json, opsiyon için options_outcomes.json.
 * Renk: yükseliş yeşil, düşüş kırmızı, nötr gri — tracker sayfalarıyla aynı Dark Grey (#0f1117) zemin.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import TickerHoverChart from "@/components/TickerHoverChart";

const f2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(2));
const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "text-slate-400" : v > 0 ? "text-emerald-400" : v < 0 ? "text-rose-400" : "text-slate-300");
/** hisse detay sayfası (herkese açık grafik + analiz sayfası; frontend/AGENTS.md'de doğrulanmış rota) */
export const detailHref = (t: string) => `/global/tr/graphic/${encodeURIComponent(t)}`;

/** Canlı fiyatlar: /api/admin/spyengine/v2/quotes?symbols=… (40'lık parçalar, 60 sn'de bir) */
export function useQuotes(symbols: string[]): Record<string, { price: number | null; changePct: number | null }> {
  const [q, setQ] = useState<Record<string, { price: number | null; changePct: number | null }>>({});
  const key = [...new Set(symbols)].join(",");
  useEffect(() => {
    if (!key) return;
    let dead = false;
    const list = key.split(",");
    const load = async () => {
      const out: Record<string, { price: number | null; changePct: number | null }> = {};
      for (let i = 0; i < list.length; i += 40) {
        try {
          const r = await fetch(`/api/admin/spyengine/v2/quotes?symbols=${encodeURIComponent(list.slice(i, i + 40).join(","))}`, { credentials: "include", cache: "no-store" });
          const j = await r.json();
          for (const x of j?.quotes ?? []) out[x.symbol] = { price: x.price ?? null, changePct: x.changePct ?? null };
        } catch { /* sessiz */ }
      }
      if (!dead) setQ(out);
    };
    void load();
    const id = setInterval(load, 60_000);
    return () => { dead = true; clearInterval(id); };
  }, [key]);
  return q;
}

const TH = ({ children, right }: { children?: ReactNode; right?: boolean }) => (
  <th className={`whitespace-nowrap border-b border-[#30363d] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${right ? "text-right" : "text-left"}`}>{children}</th>
);
const TD = ({ children, right, cls = "" }: { children?: ReactNode; right?: boolean; cls?: string }) => (
  <td className={`whitespace-nowrap border-b border-[#1c2128] px-2.5 py-1.5 font-mono text-[12px] ${right ? "text-right" : ""} ${cls}`}>{children}</td>
);

function Ticker({ t, href }: { t: string; href: string }) {
  return (
    <TickerHoverChart ticker={t} locale="tr">
      <Link href={href} className="font-bold text-[#58a6ff] hover:underline">{t}</Link>
    </TickerHoverChart>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-[#30363d] bg-[#0f1117]"><table className="w-full border-collapse">{children}</table></div>;
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`rounded border px-2.5 py-0.5 font-mono text-[11px] font-bold ${value === k ? "border-[#58a6ff] bg-[#58a6ff20] text-[#58a6ff]" : "border-[#30363d] bg-[#0d1117] text-slate-400 hover:text-white"}`}>{l}</button>
      ))}
    </div>
  );
}

// ── Engine hisseleri ─────────────────────────────────────────────

export interface EngineRow { symbol: string; name: string; page: string; group: string }

export function EngineTable({ rows }: { rows: EngineRow[] }) {
  const q = useQuotes(rows.map((r) => r.symbol));
  return (
    <Shell>
      <thead><tr><TH>Hisse</TH><TH>Ad</TH><TH>Grup</TH><TH right>Fiyat</TH><TH right>Gün %</TH><TH>Engine</TH><TH>Detay</TH></tr></thead>
      <tbody>
        {rows.map((r) => {
          const d = q[r.symbol];
          return (
            <tr key={r.symbol} className="hover:bg-white/[0.03]">
              <TD><Ticker t={r.symbol} href={r.page} /></TD>
              <TD cls="text-slate-300">{r.name}</TD>
              <TD cls="text-slate-500">{r.group}</TD>
              <TD right cls="text-slate-100">{d?.price != null ? `$${f2(d.price)}` : "—"}</TD>
              <TD right cls={tone(d?.changePct)}>{pct(d?.changePct)}</TD>
              <TD><Link href={r.page} className="text-[11px] text-slate-400 hover:text-white">Takip Sistemi →</Link></TD>
              <TD><Link href={detailHref(r.symbol)} className="text-[11px] text-slate-400 hover:text-white">Grafik →</Link></TD>
            </tr>
          );
        })}
      </tbody>
    </Shell>
  );
}

// ── Swing: yeni adaylar (bugünkü liste) ──────────────────────────

export interface SwingPickRow { ticker: string; company?: string; score?: number | null; price?: number | null; buyLow?: number | null; buyHigh?: number | null; target?: number | null; stop?: number | null; sector?: string | null }

export function SwingCandidates({ rows, date }: { rows: SwingPickRow[]; date: string | null }) {
  const q = useQuotes(rows.map((r) => r.ticker));
  return (
    <Shell>
      <thead><tr><TH>Hisse</TH><TH>Sektör</TH><TH right>Skor</TH><TH right>Öneri fiyatı{date ? ` (${date})` : ""}</TH><TH right>Şimdi</TH><TH right>Öneriden beri</TH><TH right>Giriş bölgesi</TH><TH>Durum</TH></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><TD cls="text-slate-500">Şu an aday yok.</TD></tr>}
        {rows.map((r) => {
          const live = q[r.ticker]?.price ?? null;
          const ch = live != null && r.price ? ((live - r.price) / r.price) * 100 : null;
          const inZone = live != null && r.buyLow != null && r.buyHigh != null && live >= r.buyLow && live <= r.buyHigh;
          const above = live != null && r.buyHigh != null && live > r.buyHigh;
          return (
            <tr key={r.ticker} className="hover:bg-white/[0.03]">
              <TD><Ticker t={r.ticker} href={detailHref(r.ticker)} /></TD>
              <TD cls="text-slate-500">{r.sector ?? "—"}</TD>
              <TD right cls="text-slate-300">{r.score != null ? r.score.toFixed(1) : "—"}</TD>
              <TD right cls="text-slate-300">{r.price ? `$${f2(r.price)}` : "—"}</TD>
              <TD right cls="text-slate-100">{live != null ? `$${f2(live)}` : "—"}</TD>
              <TD right cls={tone(ch)}>{pct(ch)}</TD>
              <TD right cls="text-slate-400">{r.buyLow != null ? `$${f2(r.buyLow)}–${f2(r.buyHigh)}` : "—"}</TD>
              <TD cls={inZone ? "text-emerald-300" : above ? "text-amber-300" : "text-slate-400"}>{live == null ? "—" : inZone ? "giriş bölgesinde" : above ? "bölgenin üstünde" : "bölgenin altında"}</TD>
            </tr>
          );
        })}
      </tbody>
    </Shell>
  );
}

// ── Swing: öneri performansı (swing_performance.json history) ────

export interface SwingPerfRow {
  date: string; ticker: string; entry: number; last: number | null; ret: number | null; peak: number | null; mae: number | null;
  days: number | null; stop: number | null; result: string; dup: boolean;
}

const RESULT_TR: Record<string, [string, string]> = {
  PENDING: ["Açık", "text-sky-300"], WIN: ["Kazanç", "text-emerald-400"], LOSS: ["Zarar", "text-rose-400"], STOP: ["Stop", "text-rose-400"],
  STOP_LOSS: ["Stop", "text-rose-400"], TIMEOUT: ["Süre doldu", "text-amber-300"], EXPIRED: ["Süre doldu", "text-amber-300"],
};

export function SwingPerformance({ rows, stats }: { rows: SwingPerfRow[]; stats: { winRate: number | null; avg: number | null; pending: number | null; completed: number | null } }) {
  const [tab, setTab] = useState<"open" | "closed" | "all">("open");
  const [dups, setDups] = useState(false);
  const open = rows.filter((r) => r.result === "PENDING");
  const view = useMemo(() => {
    const base = tab === "open" ? open : tab === "closed" ? rows.filter((r) => r.result !== "PENDING") : rows;
    return (dups ? base : base.filter((r) => !r.dup)).slice(0, 150);
  }, [tab, dups, rows, open]);
  const q = useQuotes(tab === "closed" ? [] : view.filter((r) => r.result === "PENDING").map((r) => r.ticker));
  const avgOpen = open.length ? open.reduce((a, r) => a + (r.ret ?? 0), 0) / open.length : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ["Kazanma oranı (kapanan)", stats.winRate != null ? `%${stats.winRate}` : "—", "text-slate-100"],
          ["Ort. getiri (kapanan)", pct(stats.avg), tone(stats.avg)],
          ["Kapanan öneri", stats.completed ?? "—", "text-slate-100"],
          ["Açık öneri", open.filter((r) => !r.dup).length, "text-sky-300"],
          ["Açıkların ort. getirisi", pct(avgOpen), tone(avgOpen)],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2">
            <div className="text-[10px] text-slate-500">{l}</div>
            <div className={`font-mono text-[18px] font-black ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[["open", "Açık"], ["closed", "Kapanan"], ["all", "Tümü"]]} />
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400"><input type="checkbox" checked={dups} onChange={(e) => setDups(e.target.checked)} /> tekrar önerileri de göster</label>
      </div>
      <Shell>
        <thead><tr><TH>Öneri tarihi</TH><TH>Hisse</TH><TH right>Giriş</TH><TH right>Son / çıkış</TH><TH right>Öneriden beri</TH><TH right>En yüksek</TH><TH right>En düşük</TH><TH right>Gün</TH><TH right>Stop</TH><TH>Durum</TH></tr></thead>
        <tbody>
          {view.length === 0 && <tr><TD cls="text-slate-500">Kayıt yok.</TD></tr>}
          {view.map((r, i) => {
            const live = r.result === "PENDING" ? q[r.ticker]?.price ?? null : null;
            const last = live ?? r.last;
            const ret = live != null ? ((live - r.entry) / r.entry) * 100 : r.ret;
            const [lbl, cls] = RESULT_TR[r.result] ?? [r.result, "text-slate-300"];
            return (
              <tr key={`${r.ticker}${r.date}${i}`} className="hover:bg-white/[0.03]">
                <TD cls="text-slate-400">{r.date}</TD>
                <TD><Ticker t={r.ticker} href={detailHref(r.ticker)} /></TD>
                <TD right cls="text-slate-300">${f2(r.entry)}</TD>
                <TD right cls="text-slate-100">{last != null ? `$${f2(last)}` : "—"}{live != null && <span className="ml-1 text-[9px] text-sky-400">canlı</span>}</TD>
                <TD right cls={`font-bold ${tone(ret)}`}>{pct(ret)}</TD>
                <TD right cls="text-emerald-400/80">{pct(r.peak)}</TD>
                <TD right cls="text-rose-400/80">{pct(r.mae)}</TD>
                <TD right cls="text-slate-400">{r.days ?? "—"}</TD>
                <TD right cls="text-slate-500">{r.stop != null ? `$${f2(r.stop)}` : "—"}</TD>
                <TD cls={cls}>{lbl}</TD>
              </tr>
            );
          })}
        </tbody>
      </Shell>
    </div>
  );
}

// ── Opsiyon: güncel tarama önerileri ─────────────────────────────

export interface OptionPickRow {
  ticker: string; date: string; side: string; strike: number | null; exp: string | null; dte: number | null; mid: number | null;
  delta: number | null; score: number | null; under: number | null; label: string | null;
}

export function OptionPicks({ rows }: { rows: OptionPickRow[] }) {
  const q = useQuotes(rows.map((r) => r.ticker));
  return (
    <Shell>
      <thead><tr><TH>Hisse</TH><TH>Yön</TH><TH>Kontrat</TH><TH right>Vade</TH><TH right>Prim (öneri)</TH><TH right>Δ</TH><TH right>Skor</TH><TH right>Hisse (öneri)</TH><TH right>Hisse şimdi</TH><TH right>Hisse değişim</TH><TH>Kurulum</TH></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><TD cls="text-slate-500">Şu an tarama önerisi yok.</TD></tr>}
        {rows.map((r) => {
          const live = q[r.ticker]?.price ?? null;
          const ch = live != null && r.under ? ((live - r.under) / r.under) * 100 : null;
          const good = ch == null ? null : r.side === "PUT" ? -ch : ch; // yön lehine mi
          return (
            <tr key={`${r.ticker}${r.strike}${r.exp}`} className="hover:bg-white/[0.03]">
              <TD><Ticker t={r.ticker} href={detailHref(r.ticker)} /></TD>
              <TD cls={r.side === "PUT" ? "font-bold text-rose-400" : "font-bold text-emerald-400"}>{r.side}</TD>
              <TD cls="text-slate-200">${r.strike ?? "—"} {r.side === "PUT" ? "P" : "C"}</TD>
              <TD right cls="text-slate-400">{r.exp ?? "—"}{r.dte != null ? ` (${r.dte}g)` : ""}</TD>
              <TD right cls="text-slate-200">{r.mid != null ? `$${f2(r.mid)}` : "—"}</TD>
              <TD right cls="text-slate-400">{r.delta != null ? r.delta.toFixed(2) : "—"}</TD>
              <TD right cls="text-slate-300">{r.score != null ? r.score.toFixed(1) : "—"}</TD>
              <TD right cls="text-slate-400">{r.under != null ? `$${f2(r.under)}` : "—"}</TD>
              <TD right cls="text-slate-100">{live != null ? `$${f2(live)}` : "—"}</TD>
              <TD right cls={tone(good)}>{pct(ch)}</TD>
              <TD cls="max-w-[260px] truncate text-[11px] text-slate-500">{r.label ?? ""}</TD>
            </tr>
          );
        })}
      </tbody>
    </Shell>
  );
}

// ── Opsiyon: öneri performansı (options_outcomes.json) ───────────

export interface OptionPosRow {
  date: string; ticker: string; side: string; strike: number | null; exp: string | null; entry: number | null; current: number | null;
  pnl: number | null; status: string; days: number | null; tp: number | null; sl: number | null; under0: number | null; reason: string | null;
}

const STATUS_TR: Record<string, [string, string]> = {
  open: ["Açık", "text-sky-300"], tp_hit: ["Hedef", "text-emerald-400"], sl_hit: ["Stop", "text-rose-400"],
  time_stop: ["Süre stop", "text-amber-300"], expired: ["Vade doldu", "text-slate-400"], manual: ["Elle", "text-slate-400"],
};

export function OptionPerformance({ rows, summary }: { rows: OptionPosRow[]; summary: { winRate: number | null; avg: number | null; open: number; closed: number; updated: string | null } }) {
  const [tab, setTab] = useState<"open" | "closed" | "all">("open");
  const view = (tab === "open" ? rows.filter((r) => r.status === "open") : tab === "closed" ? rows.filter((r) => r.status !== "open") : rows).slice(0, 200);
  const open = rows.filter((r) => r.status === "open");
  const avgOpen = open.length ? open.reduce((a, r) => a + (r.pnl ?? 0), 0) / open.length : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ["Kazanma oranı (kapanan)", summary.winRate != null ? `%${summary.winRate}` : "—", "text-slate-100"],
          ["Ort. P&L (kapanan)", pct(summary.avg), tone(summary.avg)],
          ["Kapanan", summary.closed, "text-slate-100"],
          ["Açık", summary.open, "text-sky-300"],
          ["Açıkların ort. P&L", pct(avgOpen), tone(avgOpen)],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2">
            <div className="text-[10px] text-slate-500">{l}</div>
            <div className={`font-mono text-[18px] font-black ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} items={[["open", "Açık"], ["closed", "Kapanan"], ["all", "Tümü"]]} />
        <span className="font-mono text-[10.5px] text-slate-500">{summary.updated ? `P&L güncelleme: ${summary.updated}` : ""}</span>
      </div>
      <Shell>
        <thead><tr><TH>Öneri tarihi</TH><TH>Hisse</TH><TH>Kontrat</TH><TH right>Vade</TH><TH right>Giriş prim</TH><TH right>Güncel / çıkış</TH><TH right>P&L</TH><TH right>Hedef</TH><TH right>Stop</TH><TH right>Gün</TH><TH>Durum</TH></tr></thead>
        <tbody>
          {view.length === 0 && <tr><TD cls="text-slate-500">Kayıt yok.</TD></tr>}
          {view.map((r, i) => {
            const [lbl, cls] = STATUS_TR[r.status] ?? [r.status, "text-slate-300"];
            return (
              <tr key={`${r.ticker}${r.date}${r.strike}${i}`} className="hover:bg-white/[0.03]" title={r.reason ?? undefined}>
                <TD cls="text-slate-400">{r.date}</TD>
                <TD><Ticker t={r.ticker} href={detailHref(r.ticker)} /></TD>
                <TD cls={r.side === "PUT" ? "text-rose-300" : "text-emerald-300"}>${r.strike ?? "—"} {r.side === "PUT" ? "P" : "C"}</TD>
                <TD right cls="text-slate-400">{r.exp ?? "—"}</TD>
                <TD right cls="text-slate-300">{r.entry != null ? `$${f2(r.entry)}` : "—"}</TD>
                <TD right cls="text-slate-100">{r.current != null ? `$${f2(r.current)}` : "—"}</TD>
                <TD right cls={`font-bold ${tone(r.pnl)}`}>{pct(r.pnl)}</TD>
                <TD right cls="text-emerald-400/70">{r.tp != null ? `$${f2(r.tp)}` : "—"}</TD>
                <TD right cls="text-rose-400/70">{r.sl != null ? `$${f2(r.sl)}` : "—"}</TD>
                <TD right cls="text-slate-400">{r.days ?? "—"}</TD>
                <TD cls={cls}>{lbl}</TD>
              </tr>
            );
          })}
        </tbody>
      </Shell>
    </div>
  );
}
