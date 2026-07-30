"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MARKET_THEMES } from "@/lib/themeData";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

interface CSPList {
  key: string;
  label: string;
  range: string;
  description: string;
  color: string;
  borderColor: string;
  textColor: string;
  href: string;
}

const CSP_LISTS: CSPList[] = [
  { key: "active", label: "Active Watchlist", range: "$5 – $250", description: "Cash Secured Put candidates across all price tiers. Low, mid, and high-priced stocks for weekly/monthly CSP premium collection.", color: "bg-[#10b981]/5", borderColor: "border-[#10b981]/30", textColor: "text-[#10b981]", href: "/csp/active" },
  { key: "portfolio", label: "Portföy", range: "Tüm Fiyatlar", description: "Kişisel portföy izleme ve yönetimi. Sahip olduğunuz hisseleri takip edin.",                            color: "bg-[#f97316]/5", borderColor: "border-[#f97316]/30", textColor: "text-[#f97316]", href: "/csp/portfolio" },
  { key: "swing", label: "Swing", range: "Günlük Tarama", description: "Günlük swing ticaret adayları. BOGA AI tarafından tespit edilen günlük setuplar.",                   color: "bg-[#6b7280]/5", borderColor: "border-[#6b7280]/30", textColor: "text-[#6b7280]", href: "/csp/swing" },
  { key: "daily", label: "Daily", range: "İntraday Takip", description: "Günlük intraday takip hisseleri. Saatlik performans ve durum güncellemeleri.",                   color: "bg-[#f59e0b]/5", borderColor: "border-[#f59e0b]/30", textColor: "text-[#f59e0b]", href: "/csp/daily" },
  { key: "long_term", label: "Long-Term", range: "Makro Trendler", description: "Uzun vadeli hisse seçimleri ve portföy yönetimi. Makro trendler ve değer oyunları.",            color: "bg-[#14b8a6]/5", borderColor: "border-[#14b8a6]/30", textColor: "text-[#14b8a6]", href: "/csp/long_term" },
];

export default function CSPWatchlistSection() {
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "portfolio" | "swing" | "daily" | "long_term">("all");
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [addMessage, setAddMessage] = useState("");

  // Extract all unique tickers from MARKET_THEMES + 2026 hot themes
  const allThemeTickers = Array.from(
    new Set([
      ...MARKET_THEMES.flatMap((t) => t.tickers),
      ...HOT_THEMES_2026.flatMap((t) => t.stocks.map((s) => s.ticker)),
    ])
  ).sort();

  useEffect(() => {
    setMounted(true);
    // localStorage anlık yükle
    const loaded: Record<string, string[]> = {};
    for (const csp of CSP_LISTS) {
      try {
        const raw = localStorage.getItem(`shared_${csp.key}csp`);
        loaded[csp.key] = raw ? JSON.parse(raw) : [];
      } catch {
        loaded[csp.key] = [];
      }
    }
    setLists(loaded);
    // API'den taze veri
    Promise.all(
      CSP_LISTS.map((csp) =>
        fetch(`/api/csp-watchlist/${csp.key}`)
          .then((r) => r.json())
          .then((d) => ({ key: csp.key, tickers: d.tickers ?? [] }))
          .catch(() => ({ key: csp.key, tickers: [] }))
      )
    ).then((results) => {
      const fresh: Record<string, string[]> = {};
      for (const r of results) {
        fresh[r.key] = r.tickers;
        try {
          localStorage.setItem(`shared_${r.key}csp`, JSON.stringify(r.tickers));
        } catch {}
      }
      setLists(fresh);
    });
  }, []);

  const handleAddToList = (listKey: string) => {
    if (selectedStocks.length === 0) return;

    const current = lists[listKey] ?? [];
    const newTickers = selectedStocks.filter((s) => !current.includes(s));

    if (newTickers.length === 0) {
      setAddMessage(`${selectedStocks.length} hisse zaten listede var`);
      setTimeout(() => setAddMessage(""), 3000);
      return;
    }

    const updated = [...current, ...newTickers];
    const newLists = { ...lists, [listKey]: updated };
    setLists(newLists);

    try {
      localStorage.setItem(`shared_${listKey}csp`, JSON.stringify(updated));
    } catch {}

    setAddMessage(`${newTickers.length} hisse ${CSP_LISTS.find((c) => c.key === listKey)?.label}'ye eklendi`);
    setSelectedStocks([]);
    setTimeout(() => setAddMessage(""), 3000);
  };

  if (!mounted) return null;

  const hasAny = CSP_LISTS.some((c) => (lists[c.key]?.length ?? 0) > 0);

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
        <h2 className="text-xs font-black text-[#10b981] uppercase tracking-[0.2em]">
          CSP STRATEGY WATCHLISTS
        </h2>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          Cash Secured Put — Price Tiers
        </span>
        <Link
          href="/admin/analytics/terminal"
          className="ml-auto text-[10px] text-[#3b82f6] hover:text-white border border-[#3b82f6]/30 px-2 py-1 rounded transition-all hover:bg-[#3b82f6]/10"
        >
          Manage in Terminal →
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 text-[11px] font-black uppercase whitespace-nowrap rounded-lg transition-all border ${
            activeTab === "all"
              ? "bg-[#e3b341]/20 border-[#e3b341] text-[#e3b341]"
              : "bg-transparent border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          ALL LIST ({allThemeTickers.length})
        </button>
        {CSP_LISTS.map((csp) => {
          const [colorHex] = csp.color.match(/#[0-9a-f]{6}/i) || ["#3b82f6"];
          return (
            <button
              key={csp.key}
              onClick={() => setActiveTab(csp.key as any)}
              style={activeTab === csp.key ? {
                backgroundColor: `${colorHex}33`,
                borderColor: colorHex,
                color: colorHex,
              } : {}}
              className={`px-4 py-2 text-[11px] font-black uppercase whitespace-nowrap rounded-lg transition-all border ${
                activeTab === csp.key
                  ? ""
                  : "bg-transparent border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              {csp.label} ({(lists[csp.key] ?? []).length})
            </button>
          );
        })}
      </div>

      {/* ALL LIST Tab - Summary Only */}
      {activeTab === "all" && (
        <div className="mb-12 bg-[#e3b341]/5 border border-[#e3b341]/30 rounded-xl p-6">
          <div className="mb-6">
            <h3 className="text-lg font-black text-[#e3b341] uppercase tracking-wider mb-4">
              ALL LIST — Tüm Market Themes Özeti
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              900+ hisse içeren kapsamlı borsa evrenimiz. Detaylı analiz ve takip için aşağıdaki linki kullanın.
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-[#e3b341]/30 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Toplam Hisse</div>
              <div className="text-2xl font-black text-[#e3b341]">{allThemeTickers.length}+</div>
            </div>
            <div className="bg-white/5 border border-[#e3b341]/30 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Aktif Tema</div>
              <div className="text-2xl font-black text-[#e3b341]">122</div>
            </div>
            <div className="bg-white/5 border border-[#e3b341]/30 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Sektör</div>
              <div className="text-2xl font-black text-[#e3b341]">11+</div>
            </div>
            <div className="bg-white/5 border border-[#e3b341]/30 rounded-lg p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Güncelleme</div>
              <div className="text-2xl font-black text-[#e3b341]">24/7</div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/admin/trading/csp/all-list"
              className="flex-1 text-center py-3 bg-[#e3b341]/20 border border-[#e3b341] text-[#e3b341] font-medium rounded-lg hover:bg-[#e3b341]/30 transition-all uppercase text-sm tracking-wider"
            >
              Detaylı Listeyi Görüntüle →
            </Link>
            <Link
              href="/admin/analytics/screener"
              className="flex-1 text-center py-3 bg-white/5 border border-white/10 text-slate-300 font-medium rounded-lg hover:bg-white/10 transition-all uppercase text-sm tracking-wider"
            >
              Screener ile Filtrele
            </Link>
          </div>

          {/* Features List */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Özellikler</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-[#e3b341]">✓</span> Detaylı BOGA Tracker analiz
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-[#e3b341]">✓</span> Gerçek zamanlı fiyat verileri
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-[#e3b341]">✓</span> Signal filtreleme (AL, İzle, Bekle, SAT)
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-[#e3b341]">✓</span> EMA, RSI, Pattern analizi
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-[#e3b341]">✓</span> Heatmap görselleştirme
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="text-[#e3b341]">✓</span> Sıralanabilir kolonlar
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual CSP Lists */}
      {(activeTab === "active" || activeTab === "portfolio" || activeTab === "long_term") && (
        <div className="grid grid-cols-1 gap-5">
          {CSP_LISTS.filter((c) => c.key === activeTab).map((csp) => {
            const tickers = lists[csp.key] ?? [];

            return (
              <div
                key={csp.key}
                className={`${csp.color} border ${csp.borderColor} rounded-xl p-5`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={`text-sm font-black ${csp.textColor} uppercase tracking-wider`}>
                      {csp.label}
                    </h3>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {csp.range}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${csp.borderColor} ${csp.textColor}`}>
                    {tickers.length} hisse
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                  {csp.description}
                </p>

                {/* Ticker list */}
                {tickers.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
                    <p className="text-slate-600 text-[11px] mb-2">
                      Bu listeye henüz hisse eklenmedi
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      ALL LIST sekmesinden seçerek ekleyin veya Terminal'den düzenleyin
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tickers.map((ticker) => (
                      <Link
                        key={ticker}
                        href={`/stock/${ticker}`}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded border ${csp.borderColor} ${csp.textColor} hover:bg-white/10 transition-all font-mono`}
                      >
                        {ticker}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                  <Link
                    href={csp.href}
                    className={`flex-1 text-center py-1.5 text-[10px] font-black uppercase tracking-wider border ${csp.borderColor} ${csp.textColor} rounded-lg hover:bg-white/5 transition-all`}
                  >
                    Listeyi Gör →
                  </Link>
                  <Link
                    href="/admin/analytics/terminal"
                    className="px-3 py-1.5 text-[10px] text-slate-500 border border-white/5 rounded-lg hover:text-white hover:bg-white/5 transition-all"
                  >
                    Düzenle
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid layout for all CSP lists when activeTab is not 'all' */}
      {activeTab !== "all" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
          {CSP_LISTS.map((csp) => {
            const tickers = lists[csp.key] ?? [];

            return (
              <div
                key={csp.key}
                className={`${csp.color} border ${csp.borderColor} rounded-xl p-5`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={`text-sm font-black ${csp.textColor} uppercase tracking-wider`}>
                      {csp.label}
                    </h3>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {csp.range}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${csp.borderColor} ${csp.textColor}`}>
                    {tickers.length} hisse
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                  {csp.description}
                </p>

                {tickers.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
                    <p className="text-slate-600 text-[11px]">Terminal'den hisse ekleyin</p>
                    <Link
                      href="/admin/analytics/terminal"
                      className={`inline-block mt-2 text-[10px] font-medium ${csp.textColor} hover:underline`}
                    >
                      Terminal'e git →
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tickers.map((ticker) => (
                      <Link
                        key={ticker}
                        href={`/stock/${ticker}`}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded border ${csp.borderColor} ${csp.textColor} hover:bg-white/10 transition-all font-mono`}
                      >
                        {ticker}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                  <Link
                    href={csp.href}
                    className={`flex-1 text-center py-1.5 text-[10px] font-black uppercase tracking-wider border ${csp.borderColor} ${csp.textColor} rounded-lg hover:bg-white/5 transition-all`}
                  >
                    Listeyi Gör →
                  </Link>
                  <Link
                    href="/admin/analytics/terminal"
                    className="px-3 py-1.5 text-[10px] text-slate-500 border border-white/5 rounded-lg hover:text-white hover:bg-white/5 transition-all"
                  >
                    Düzenle
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasAny && activeTab !== "all" && (
        <div className="mt-3 text-center text-[11px] text-slate-600">
          Terminal sayfasında Active Watchlist sekmesinden hisse ekleyebilirsiniz.
        </div>
      )}
    </div>
  );
}
