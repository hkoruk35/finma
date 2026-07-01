"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDailyTickersForDate, getDailyArchiveDates } from "@/lib/csp-data-source";

interface DailyArchiveProps {
  date: string;
}

export default function DailyArchiveClient({ date }: DailyArchiveProps) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveDates, setArchiveDates] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [tickersData, datesData] = await Promise.all([
          getDailyTickersForDate(date),
          getDailyArchiveDates(),
        ]);
        setTickers(tickersData);
        setArchiveDates(datesData);
      } catch (err) {
        console.error("[DailyArchive] fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [date]);

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", color: "#e6edf3", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #30363d", padding: "10px 0 8px" }}>
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 8 }}>
          <Link href="/admin/trading/csp/daily" style={{ color: "#f59e0b" }}>
            DAILY
          </Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#e6edf3" }}>ARŞIV</span>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#f59e0b" }}>{date}</span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>
            DAILY INTRADAY — {date}
          </span>
        </div>

        {/* Archive Date Selector */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, overflowX: "auto" }}>
          {archiveDates.map((d) => (
            <Link
              key={d}
              href={`/csp/daily/${d}`}
              style={{
                padding: "5px 12px",
                fontSize: 11,
                fontFamily: "monospace",
                fontWeight: 700,
                border: "1px solid",
                borderColor: d === date ? "#f59e0b" : "#30363d",
                background: d === date ? "#f59e0b20" : "transparent",
                color: d === date ? "#f59e0b" : "#8b949e",
                borderRadius: 3,
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {d.split("-").slice(1).join("/")}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#8b949e" }}>
          <span>Yükleniyor...</span>
        </div>
      ) : tickers.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#8b949e" }}>
          Bu tarih için veri bulunamadı.
        </div>
      ) : (
        <div style={{ padding: "20px 0" }}>
          <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 12, paddingLeft: 16 }}>
            {tickers.length} hisse takipte
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px" }}>
            {tickers.map((ticker) => (
              <Link
                key={ticker}
                href={`/stock/${ticker}`}
                style={{
                  padding: "8px 16px",
                  background: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: 4,
                  color: "#f59e0b",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.borderColor = "#f59e0b";
                  (e.target as HTMLElement).style.background = "#f59e0b20";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.borderColor = "#30363d";
                  (e.target as HTMLElement).style.background = "#161b22";
                }}
              >
                {ticker}
              </Link>
            ))}
          </div>

          {/* Back Link */}
          <div style={{ marginTop: 24, paddingLeft: 16 }}>
            <Link
              href="/admin/trading/csp/daily"
              style={{
                color: "#f59e0b",
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ← Güncel daily listesine dön
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
