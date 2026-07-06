"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import TickerHoverChart from "@/components/TickerHoverChart";

const ACCENT = "#58a6ff";

export interface ArchivePick {
  ticker: string;
  company: string | null;
  sector: string | null;
  price: number | null;
  change_1d: number | null;
  rsi: number | null;
  label: { text: string; color: string } | null;
}

export interface ArchiveDay {
  date: string; // YYYY-MM-DD
  picks: ArchivePick[];
}

const LABEL_COLOR: Record<string, string> = {
  green: "#3fb950",
  red: "#f85149",
  blue: "#58a6ff",
  gray: "#8b949e",
};

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");
const fmt1 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(1) : "—");

function rsiColor(rsi: number | null | undefined) {
  if (rsi == null) return "#8b949e";
  if (rsi >= 70) return "#f85149";
  if (rsi >= 50) return "#3fb950";
  if (rsi >= 40) return "#e3b341";
  return "#f85149";
}

function heatColors(pct: number | null) {
  if (pct == null) return { bg: "#111111", text: "#333333" };
  if (pct >= 2.0) return { bg: "#0d4a0d", text: "#56d364" };
  if (pct >= 1.0) return { bg: "#0d3a0d", text: "#3fb950" };
  if (pct >= 0.3) return { bg: "#0d2a0d", text: "#3fb950" };
  if (pct > -0.3) return { bg: "#1a1a1a", text: "#8b949e" };
  if (pct > -1.0) return { bg: "#2a0d0d", text: "#f85149" };
  if (pct > -2.0) return { bg: "#3a0d0d", text: "#f85149" };
  return { bg: "#4a0d0d", text: "#ff7b72" };
}

function formatDateShort(d: string, locale: Locale) {
  try {
    return new Date(d + "T12:00:00Z").toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return d;
  }
}

function formatDateLong(d: string, locale: Locale) {
  try {
    return new Date(d + "T12:00:00Z").toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function SwingArchiveTracker({
  archives,
  locale,
}: {
  archives: ArchiveDay[];
  locale: Locale;
}) {
  const [selectedDate, setSelectedDate] = useState(archives[0]?.date ?? "");
  const [activeTab, setActiveTab] = useState<"table" | "heatmap">("table");

  const liveHref = locale === "es" ? "/global/es/swing" : locale === "en" ? "/global/en/swing" : "/global/tr/swing";
  const permalink = (ticker: string) => `/admin/${ticker.toLowerCase()}`;

  const selectedDay = useMemo(
    () => archives.find((a) => a.date === selectedDate) ?? archives[0],
    [archives, selectedDate]
  );

  // Union of tickers across all archived days, ordered by their rank in the most recent day first.
  const allTickers = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    archives.forEach((day) => {
      day.picks.forEach((p) => {
        if (!seen.has(p.ticker)) {
          seen.add(p.ticker);
          ordered.push(p.ticker);
        }
      });
    });
    return ordered;
  }, [archives]);

  const pickByTickerByDate = useMemo(() => {
    const map: Record<string, Record<string, ArchivePick>> = {};
    archives.forEach((day) => {
      day.picks.forEach((p) => {
        if (!map[p.ticker]) map[p.ticker] = {};
        map[p.ticker][day.date] = p;
      });
    });
    return map;
  }, [archives]);

  if (archives.length === 0) {
    return (
      <div
        style={{
          minHeight: "40vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1117",
          color: "#8b949e",
          fontFamily: "monospace",
        }}
      >
        {locale === "tr" ? "Arşiv verisi bulunamadı" : "No archive data found"}
      </div>
    );
  }

  return (
    <div style={{ background: "#0d1117", minHeight: "60vh", fontFamily: "monospace", color: "#e6edf3", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #30363d", paddingBottom: 10, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.5px" }}>
              {locale === "tr" ? "Swing Trade Arşivi" : "Swing Trade Archive"}
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>{archives.length} {locale === "tr" ? "gün" : "days"}</span>
              <span>{selectedDay ? formatDateLong(selectedDay.date, locale) : ""}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <Link
              href={liveHref}
              style={{
                padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                border: "1px solid #30363d", background: "transparent", color: "#8b949e",
                borderRadius: 4, textDecoration: "none", letterSpacing: "0.05em",
              }}
            >
              {locale === "tr" ? "← CANLI" : "← LIVE"}
            </Link>
            {(["table", "heatmap"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid", borderColor: activeTab === tab ? ACCENT : "#30363d",
                  background: activeTab === tab ? ACCENT + "20" : "transparent",
                  color: activeTab === tab ? ACCENT : "#8b949e",
                  borderRadius: 4, cursor: "pointer", letterSpacing: "0.05em",
                }}
              >
                {tab === "table" ? "ANA TABLO" : "ISI HARİTASI"}
              </button>
            ))}
          </div>
        </div>

        {/* Date selector — only meaningful for the table tab */}
        {activeTab === "table" && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {archives.map((day, i) => (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                style={{
                  padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
                  border: "1px solid", borderColor: selectedDate === day.date ? ACCENT : "#30363d",
                  background: selectedDate === day.date ? ACCENT + "20" : "transparent",
                  color: selectedDate === day.date ? ACCENT : "#8b949e",
                  borderRadius: 3, cursor: "pointer",
                }}
              >
                {formatDateShort(day.date, locale)}
                {i === 0 ? ` (${locale === "tr" ? "son" : "latest"})` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TABLE — selected day's picks */}
      {activeTab === "table" && selectedDay && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                {[
                  { label: "TICKER", align: "left" },
                  { label: "SEKTÖR", align: "left" },
                  { label: "FİYAT", align: "right" },
                  { label: "Δ% 1G", align: "right" },
                  { label: "RSI", align: "right" },
                  { label: "DURUM", align: "right" },
                  { label: "DETAY", align: "right" },
                ].map(({ label, align }) => (
                  <th
                    key={label}
                    style={{
                      padding: "7px 8px", textAlign: align as "left" | "right",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: ACCENT, whiteSpace: "nowrap", background: "#0d1117",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedDay.picks.map((p, idx) => {
                const labelColor = p.label ? LABEL_COLOR[p.label.color] || "#8b949e" : "#8b949e";
                return (
                  <tr key={p.ticker} style={{ background: idx % 2 === 1 ? "#161b22" : "#0d1117", borderBottom: "1px solid #21262d" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: "#58a6ff" }}>
                      <TickerHoverChart ticker={p.ticker} detailHref={permalink(p.ticker)}>
                        <span>{p.ticker}</span>
                      </TickerHoverChart>
                    </td>
                    <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 11 }}>{p.sector || "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>${fmt2(p.price)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: (p.change_1d ?? 0) >= 0 ? "#3fb950" : "#f85149" }}>
                      {p.change_1d != null ? `${p.change_1d >= 0 ? "+" : ""}${fmt2(p.change_1d)}%` : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: rsiColor(p.rsi) }}>{fmt1(p.rsi)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: labelColor }}>
                      {p.label?.text || "—"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      <Link
                        href={permalink(p.ticker)}
                        style={{ color: ACCENT, textDecoration: "none", fontWeight: 700, fontSize: 10, background: ACCENT + "15", border: "1px solid " + ACCENT + "50", borderRadius: 3, padding: "3px 8px", display: "inline-block" }}
                      >
                        {locale === "tr" ? "ANALİZ" : "ANALYZE"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ISI HARİTASI — günlük Δ% grid across the archived days */}
      {activeTab === "heatmap" && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 12, padding: "0 4px" }}>
            {locale === "tr"
              ? `Son ${archives.length} günün Δ% ısı haritası — her hücre o günün kapanış değişimini gösterir`
              : `Last ${archives.length} days Δ% heatmap — each cell shows that day's closing change`}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #30363d" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", color: ACCENT, fontSize: 10, letterSpacing: "0.1em" }}>TICKER</th>
                  {archives.map((day) => (
                    <th key={day.date} style={{ padding: "6px 10px", textAlign: "center", color: ACCENT, fontSize: 10, whiteSpace: "nowrap" }}>
                      {formatDateShort(day.date, locale)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTickers.map((ticker, idx) => (
                  <tr key={ticker} style={{ background: idx % 2 === 1 ? "#161b22" : "#0d1117", borderBottom: "1px solid #21262d" }}>
                    <td style={{ padding: "6px 10px" }}>
                      <TickerHoverChart ticker={ticker} detailHref={permalink(ticker)}>
                        <Link href={permalink(ticker)} style={{ color: "#58a6ff", fontWeight: 900 }}>{ticker}</Link>
                      </TickerHoverChart>
                    </td>
                    {archives.map((day) => {
                      const pick = pickByTickerByDate[ticker]?.[day.date];
                      const pct = pick?.change_1d ?? null;
                      const { bg, text } = heatColors(pct);
                      return (
                        <td key={day.date} style={{ padding: "6px 10px", textAlign: "center", background: bg, color: text, fontSize: 10, fontWeight: 700, minWidth: 58 }}>
                          {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : <span style={{ color: "#333" }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "+2%+", bg: "#0d4a0d", text: "#56d364" },
              { label: "+1–2%", bg: "#0d3a0d", text: "#3fb950" },
              { label: "+0.3–1%", bg: "#0d2a0d", text: "#3fb950" },
              { label: "±0.3%", bg: "#1a1a1a", text: "#8b949e" },
              { label: "-0.3–1%", bg: "#2a0d0d", text: "#f85149" },
              { label: "-1–2%", bg: "#3a0d0d", text: "#f85149" },
              { label: "-2%+", bg: "#4a0d0d", text: "#ff7b72" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 14, height: 14, background: item.bg, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: item.text }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
