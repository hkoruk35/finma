"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { WEEKDAY_LABELS_TR } from "@/lib/x/recurringSchedules";

const ACCENT = "#58a6ff";
const LOCALES = ["en", "es", "fr", "pt", "tr"] as const;
type Locale = (typeof LOCALES)[number];

const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };
const btnStyle = { background: ACCENT, color: "#0d1117", border: "none", padding: "8px 14px", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer" };

// X Studio "Listeden Seç"teki AYNI sabit varlık tanımları — burada da elle
// tekrarlanıyor çünkü lib/x/listOptions.ts server-only (supabase-admin import
// ediyor), client component'te doğrudan import edilemez.
const CATEGORY_LABELS: Record<string, string> = { index: "Endeksler", sector: "Sektörler", commodity: "Değerli Madenler", fx: "Döviz", crypto: "Kripto" };
const ASSETS: { category: "index" | "sector" | "commodity" | "fx" | "crypto"; ticker: string; label: string }[] = [
  { category: "index", ticker: "^GSPC", label: "S&P 500" },
  { category: "index", ticker: "^IXIC", label: "NASDAQ" },
  { category: "index", ticker: "^DJI", label: "DOW" },
  { category: "index", ticker: "^RUT", label: "RUSSELL 2000" },
  { category: "index", ticker: "^VIX", label: "VIX" },
  { category: "sector", ticker: "XLK", label: "Teknoloji" },
  { category: "sector", ticker: "XLF", label: "Finans" },
  { category: "sector", ticker: "XLV", label: "Sağlık" },
  { category: "sector", ticker: "XLY", label: "Tüketici (Döngüsel)" },
  { category: "sector", ticker: "XLP", label: "Tüketici (Temel)" },
  { category: "sector", ticker: "XLE", label: "Enerji" },
  { category: "sector", ticker: "XLI", label: "Endüstriyel" },
  { category: "sector", ticker: "XLB", label: "Materyaller" },
  { category: "sector", ticker: "XLRE", label: "Gayrimenkul" },
  { category: "sector", ticker: "XLU", label: "Kamu Hizmetleri" },
  { category: "sector", ticker: "XLC", label: "İletişim Hizmetleri" },
  { category: "commodity", ticker: "GOLD", label: "Altın" },
  { category: "commodity", ticker: "SILVER", label: "Gümüş" },
  { category: "commodity", ticker: "USOIL", label: "Ham Petrol (WTI)" },
  { category: "commodity", ticker: "NATGAS", label: "Doğal Gaz" },
  { category: "fx", ticker: "EURUSD", label: "EUR/USD" },
  { category: "fx", ticker: "GBPUSD", label: "GBP/USD" },
  { category: "fx", ticker: "USDJPY", label: "USD/JPY" },
  { category: "fx", ticker: "USDCHF", label: "USD/CHF" },
  { category: "fx", ticker: "AUDUSD", label: "AUD/USD" },
  { category: "fx", ticker: "USDCAD", label: "USD/CAD" },
  { category: "crypto", ticker: "BTCUSD", label: "Bitcoin" },
  { category: "crypto", ticker: "ETHUSD", label: "Ethereum" },
  { category: "crypto", ticker: "SOLUSD", label: "Solana" },
  { category: "crypto", ticker: "XRPUSD", label: "XRP" },
];

interface RecurringScheduleRow {
  id: string;
  content_type: "stock" | "market_asset";
  ticker: string;
  category: string | null;
  weekly: boolean;
  locale: string | null;
  recurrence_type: "interval" | "weekly";
  interval_hours: number | null;
  weekday: number | null;
  time_of_day: string | null;
  enabled: boolean;
  next_run_at: string;
}

function utcIsoToNyDisplay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) + " NY";
}

export default function AnalizYonetimiPage() {
  const [lastByTicker, setLastByTicker] = useState<Record<string, { created_at: string; locale: string; status: string; source: string | null }>>({});
  const [schedules, setSchedules] = useState<RecurringScheduleRow[]>([]);
  const [busyTicker, setBusyTicker] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [localeFilter, setLocaleFilter] = useState<Locale | "">("");

  const load = useCallback(async () => {
    const [statusRes, schedRes] = await Promise.all([
      fetch("/api/admin/x/asset-status"),
      fetch("/api/admin/x/recurring-schedules"),
    ]);
    if (statusRes.ok) setLastByTicker((await statusRes.json()).lastByTicker ?? {});
    if (schedRes.ok) setSchedules((await schedRes.json()).schedules ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publishNow = async (asset: (typeof ASSETS)[number], weekly: boolean) => {
    setBusyTicker(asset.ticker + (weekly ? ":weekly" : ":daily"));
    setError("");
    const res = await fetch("/api/admin/x/publish-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: "market_asset",
        ticker: asset.ticker,
        category: asset.category,
        weekly,
        locale: localeFilter || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Yayınlama hatası");
    } else {
      const failed = (data.results ?? []).filter((r: any) => !r.posted);
      if (failed.length) setError(`${asset.ticker}: bazı diller başarısız — ${failed.map((f: any) => `${f.locale}:${f.error}`).join(" | ")}`);
    }
    await load();
    setBusyTicker(null);
  };

  const toggleSchedule = async (id: string, enabled: boolean) => {
    await fetch(`/api/admin/x/recurring-schedules?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await load();
  };

  const deleteSchedule = async (id: string) => {
    await fetch(`/api/admin/x/recurring-schedules?id=${id}`, { method: "DELETE" });
    await load();
  };

  const grouped = ASSETS.reduce<Record<string, typeof ASSETS>>((acc, a) => {
    (acc[a.category] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT }}>Analiz Yönetimi — Endeks/Döviz/Emtia/Kripto/Sektör</h1>
        <Link href="/admin/x-studio" style={{ color: ACCENT, fontSize: 12 }}>← X Studio</Link>
      </div>

      {error && <div style={{ color: "#f85149", marginBottom: 12, fontSize: 12, fontWeight: "bold" }}>{error}</div>}

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Yayınlarken hedef dil:</span>
        <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value as Locale | "")} style={{ ...inputStyle }}>
          <option value="">Tümü (5 dil)</option>
          {LOCALES.map((l) => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>
        <span style={{ fontSize: 11, opacity: 0.5 }}>
          Not: x_posts geçmişinde günlük/haftalık ayrımı tutulmuyor — "Son paylaşım" tarihleri her iki modu da kapsar.
        </span>
      </div>

      {Object.entries(grouped).map(([category, assets]) => (
        <div key={category} style={{ marginBottom: 20, padding: 14, border: "1px solid #30363d", borderRadius: 8, background: "#0d1117" }}>
          <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 10 }}>{CATEGORY_LABELS[category]}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {assets.map((a) => {
              const last = lastByTicker[a.ticker];
              return (
                <div key={a.ticker} style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ minWidth: 160 }}>
                    {a.ticker} <span style={{ opacity: 0.6 }}>{a.label}</span>
                  </span>
                  <span style={{ opacity: 0.75, fontSize: 11 }}>
                    {last ? `Son: ${new Date(last.created_at).toLocaleString("tr-TR")} [${last.locale.toUpperCase()}] (${last.status})` : "Hiç paylaşılmamış"}
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button
                      style={{ ...btnStyle, padding: "4px 10px", fontSize: 10 }}
                      disabled={busyTicker === a.ticker + ":daily"}
                      onClick={() => publishNow(a, false)}
                    >
                      {busyTicker === a.ticker + ":daily" ? "..." : "Günlük Yayınla"}
                    </button>
                    <button
                      style={{ ...btnStyle, padding: "4px 10px", fontSize: 10, background: "#8b5cf6" }}
                      disabled={busyTicker === a.ticker + ":weekly"}
                      onClick={() => publishNow(a, true)}
                    >
                      {busyTicker === a.ticker + ":weekly" ? "..." : "Haftalık Yayınla"}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 24, padding: 14, border: "1px solid #30363d", borderRadius: 8, background: "#0d1117" }}>
        <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 10 }}>🔁 Tekrarlanan Programlar ({schedules.length})</h2>
        {schedules.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Henüz tanımlanmış bir tekrarlanan program yok. X Studio → Listeden Seç → Endeksler/Döviz/Emtia/Kripto bölümünden seçip
            "🔁 Tekrarlanan Programlama" ile ekleyebilirsin.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {schedules.map((s) => (
            <div key={s.id} style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: s.enabled ? 1 : 0.5 }}>
              <span>{s.ticker} <span style={{ opacity: 0.6 }}>({s.category || s.content_type})</span></span>
              <span>{s.recurrence_type === "interval" ? `Her ${s.interval_hours} saatte` : `Her ${WEEKDAY_LABELS_TR[s.weekday ?? 0]} ${s.time_of_day} NY`}</span>
              <span style={{ color: "#f59e0b" }}>Sıradaki: {utcIsoToNyDisplay(s.next_run_at)}</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button onClick={() => toggleSchedule(s.id, !s.enabled)} style={{ ...btnStyle, padding: "4px 8px", fontSize: 10, background: s.enabled ? "#22c55e" : "#30363d" }}>
                  {s.enabled ? "Açık" : "Kapalı"}
                </button>
                <button onClick={() => deleteSchedule(s.id)} style={{ background: "transparent", border: "none", color: "#f85149", cursor: "pointer", fontSize: 13, padding: "0 4px" }}>✕</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
