"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { getHotTheme, localizedThemeTitle } from "@/lib/hotThemes2026";
import { getRealStockCardData } from "@/lib/copilot/stockData";
import { getAllTickers } from "@/lib/data";

interface StockRow {
  ticker: string;
  company: string;
  blurb: string;
  price: number;
  change_pct: number;
}

const fmt2 = (n: number | null | undefined) => (n != null && isFinite(n) ? n.toFixed(2) : "—");

const SIGNAL_ICON: Record<string, string> = { BUY: "●", WATCH: "◑", HOLD: "○", SELL: "✕" };
const SIGNAL_COLOR: Record<string, string> = { BUY: "#3fb950", WATCH: "#e3b341", HOLD: "#8b949e", SELL: "#f85149" };

export default function ThemeTracker({ locale, themeSlug }: { locale: Locale; themeSlug: string }) {
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadTheme = async () => {
      setLoading(true);
      try {
        const hotTheme = getHotTheme(themeSlug);
        if (!hotTheme) {
          setStocks([]);
          setLoading(false);
          return;
        }

        const allTickers = await getAllTickers();
        const rows: StockRow[] = hotTheme.stocks.map((stock) => {
          const tickerData = allTickers?.find((t: any) => t.ticker === stock.ticker);
          return {
            ticker: stock.ticker,
            company: stock.company,
            blurb: stock.blurb,
            price: tickerData?.price ?? 0,
            change_pct: tickerData?.change_pct ?? 0,
          };
        });

        setStocks(rows);
      } catch (err) {
        console.error("Failed to load theme", err);
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [themeSlug]);

  const filtered = useMemo(() => {
    if (!searchQuery) return stocks;
    const q = searchQuery.toUpperCase();
    return stocks.filter((s) => s.ticker.includes(q) || s.company.toUpperCase().includes(q) || s.blurb.toUpperCase().includes(q));
  }, [stocks, searchQuery]);

  const labels: Record<Locale, { ticker: string; price: string; change: string; description: string; action: string; search: string }> = {
    tr: { ticker: "HİSSE", price: "FİYAT", change: "DEĞİŞİM %", description: "AÇIKLAMA", action: "GRAFİK DETAY", search: "Hisse Ara..." },
    en: { ticker: "TICKER", price: "PRICE", change: "CHANGE %", description: "DESCRIPTION", action: "CHART DETAIL", search: "Search Ticker..." },
    es: { ticker: "TICKER", price: "PRECIO", change: "CAMBIO %", description: "DESCRIPCIÓN", action: "DETALLE", search: "Buscar..." },
    fr: { ticker: "TICKER", price: "PRIX", change: "CHANGEMENT %", description: "DESCRIPTION", action: "DÉTAIL", search: "Rechercher..." },
    pt: { ticker: "TICKER", price: "PREÇO", change: "MUDANÇA %", description: "DESCRIÇÃO", action: "DETALHE", search: "Pesquisar..." },
  };

  const l = labels[locale] || labels.en;

  if (loading) return <div className="text-center text-slate-400 py-8">{locale === "tr" ? "Yükleniyor..." : "Loading..."}</div>;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={l.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#58a6ff]"
        />
      </div>

      {/* Table */}
      <div className="bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363d] bg-[#161b22]">
                <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">{l.ticker}</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">{l.price}</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">{l.change}</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">{l.description}</th>
                <th className="px-4 py-2 text-center text-xs font-bold text-slate-400 uppercase">{l.action}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((stock, idx) => {
                const isPositive = stock.change_pct >= 0;
                const changeColor = isPositive ? "#3fb950" : "#f85149";

                return (
                  <tr key={stock.ticker} className="border-b border-[#30363d] hover:bg-[#161b22] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/global/${locale}/graphic/${stock.ticker}`} className="text-[#58a6ff] hover:underline font-bold">
                        {stock.ticker}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold">${fmt2(stock.price)}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: changeColor }}>
                      {isPositive ? "+" : ""}{fmt2(stock.change_pct)}%
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate" title={stock.blurb}>
                      {stock.blurb}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/global/${locale}/graphic/${stock.ticker}`}
                        className="inline-block px-3 py-1 bg-[#58a6ff] text-[#0d1117] font-bold text-xs rounded hover:bg-[#79c0ff] transition-colors whitespace-nowrap"
                      >
                        {l.action}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-slate-400 py-8">
          {locale === "tr" ? "Hisse bulunamadı" : "No stocks found"}
        </div>
      )}
    </div>
  );
}
