"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getAllTickers } from "@/lib/data";
import type { Locale } from "@/lib/i18n/copy";

const ACCENT = "#58a6ff";

interface Stock {
  ticker: string;
  company: string;
  blurb: string;
}

interface StockData {
  ticker: string;
  company: string;
  blurb: string;
  price: number;
  change_pct: number;
}

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");

export default function ThemeSwingTracker({
  locale,
  themeSlug,
  stocks,
}: {
  locale: Locale;
  themeSlug: string;
  stocks: Stock[];
}) {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const allTickers = await getAllTickers();
        const rows: StockData[] = stocks.map((s) => {
          const tickerData = allTickers?.find((t: any) => t.ticker === s.ticker);
          return {
            ticker: s.ticker,
            company: s.company,
            blurb: s.blurb,
            price: tickerData?.price ?? 0,
            change_pct: tickerData?.change_pct ?? 0,
          };
        });
        setData(rows);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [stocks]);

  const filtered = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toUpperCase();
    return data.filter((s) => s.ticker.includes(q) || s.company.toUpperCase().includes(q));
  }, [data, searchQuery]);

  const labels: Record<
    Locale,
    { ticker: string; price: string; change: string; description: string; detail: string; search: string }
  > = {
    tr: { ticker: "TICKER", price: "FİYAT", change: "Δ% 1G", description: "AÇIKLAMA", detail: "GRAFİK DETAY", search: "Hisse ara..." },
    en: { ticker: "TICKER", price: "PRICE", change: "Δ% 1D", description: "DESCRIPTION", detail: "CHART DETAIL", search: "Search..." },
    es: { ticker: "TICKER", price: "PRECIO", change: "Δ% 1D", description: "DESCRIPCIÓN", detail: "DETALLE", search: "Buscar..." },
    fr: { ticker: "TICKER", price: "PRIX", change: "Δ% 1J", description: "DESCRIPTION", detail: "DÉTAIL", search: "Rechercher..." },
    pt: { ticker: "TICKER", price: "PREÇO", change: "Δ% 1D", description: "DESCRIÇÃO", detail: "DETALHE", search: "Pesquisar..." },
  };

  const l = labels[locale] || labels.en;

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder={l.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-[#161b22] border border-[#30363d] rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#58a6ff]"
        />
      </div>

      {/* Table - SwingTracker style */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 350px)", width: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #30363d", background: "#0f1117" }}>
              <th
                style={{
                  padding: "7px 8px",
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: ACCENT,
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {l.ticker}
              </th>
              <th
                style={{
                  padding: "7px 8px",
                  textAlign: "right",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: ACCENT,
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {l.price}
              </th>
              <th
                style={{
                  padding: "7px 8px",
                  textAlign: "right",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: ACCENT,
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {l.change}
              </th>
              <th
                style={{
                  padding: "7px 8px",
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: ACCENT,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {l.description}
              </th>
              <th
                style={{
                  padding: "7px 8px",
                  textAlign: "right",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: ACCENT,
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {l.detail}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#8b949e" }}>
                  {locale === "tr" ? "Yükleniyor..." : "Loading..."}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#8b949e" }}>
                  {locale === "tr" ? "Hisse bulunamadı" : "No stocks found"}
                </td>
              </tr>
            ) : (
              filtered.map((stock, idx) => (
                <tr key={stock.ticker} style={{ background: "#0f1117", borderBottom: "1px solid #21262d" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 700, color: "#58a6ff" }}>
                    <Link href={`/global/${locale}/graphic/${stock.ticker}`} style={{ color: "#58a6ff", textDecoration: "none" }}>
                      {stock.ticker}
                    </Link>
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "white" }}>${fmt2(stock.price)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: stock.change_pct >= 0 ? "#3fb950" : "#f85149" }}>
                    {stock.change_pct >= 0 ? "+" : ""}{fmt2(stock.change_pct)}%
                  </td>
                  <td style={{ padding: "6px 8px", color: "#8b949e", fontSize: 11, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={stock.blurb}>
                    {stock.blurb}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    <Link
                      href={`/global/${locale}/graphic/${stock.ticker}`}
                      style={{
                        color: ACCENT,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: 10,
                        background: ACCENT + "15",
                        border: "1px solid " + ACCENT + "50",
                        borderRadius: 3,
                        padding: "3px 8px",
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >
                      {l.detail}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
