"use client";

import { useEffect, useState } from "react";
import { Badge, Panel, Tabs, toneClass } from "@/components/admin/supertrade/ui";

interface TradeLog {
  id: string;
  created_at: string;
  session_date: string;
  asset: string;
  signal_state: string;
  direction: string;
  entry_price: number;
  invalidation_price: number;
  net_score: number;
  status: "PENDING" | "WON" | "LOST" | "CHOP";
  exit_price: number | null;
  exit_time: string | null;
  analysis: string | null;
  strategy_json: any;
}

const ASSET_OPTIONS = [
  { value: "ALL", label: "Tümü" },
  { value: "SPX", label: "SPX" },
  { value: "SPY", label: "SPY" },
  { value: "QQQ", label: "QQQ" },
  { value: "IWM", label: "IWM" },
  { value: "BTC", label: "BTC" },
  { value: "ETH", label: "ETH" },
  { value: "GLD", label: "GLD" },
] as const;

type SelectedAsset = typeof ASSET_OPTIONS[number]["value"];

export default function V4PerformancePage() {
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>("ALL");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/supertrade/log?asset=${selectedAsset}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.logs) setLogs(data.logs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedAsset]);

  const won = logs.filter((l) => l.status === "WON").length;
  const lost = logs.filter((l) => l.status === "LOST").length;
  const chop = logs.filter((l) => l.status === "CHOP").length;
  const totalClosed = won + lost + chop;
  const winRate = totalClosed > 0 ? ((won + chop) / totalClosed) * 100 : 0;

  let totalDollarPnl = 0;
  logs.forEach((l) => {
    if (l.status === "PENDING") return;
    
    const ePrem = l.strategy_json?.entryPremium;
    const xPrem = l.strategy_json?.exitPremium;
    
    if (typeof ePrem === "number" && typeof xPrem === "number" && ePrem > 0) {
      // 0DTE: We always BUY the option. So PnL is (Exit - Entry) * 100.
      totalDollarPnl += (xPrem - ePrem) * 100;
    } else {
      // Eski loglar için varsayılan fallback
      if (l.status === "WON") totalDollarPnl += 158;
      else totalDollarPnl -= 89;
    }
  });

  const formatNumber = (num: number, currency: boolean = false, digits: number = 2) => {
    return num.toLocaleString('tr-TR', {
      style: currency ? 'currency' : 'decimal',
      currency: 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  return (
    <div className="min-h-screen bg-[#05080f] p-4 text-slate-300 md:p-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1e293b]/40 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SuperTrade V4 <span className="text-[#3b82f6]">Performans Tracker</span></h1>
          <p className="mt-2 text-sm text-slate-400 max-w-xl leading-relaxed">
            Canlı sinyal sonuçları, net PnL istatistikleri ve opsiyon bazlı maliyet analizleri.
          </p>
        </div>
        <div className="bg-[#0f172a] p-1 rounded-xl border border-[#1e293b] shadow-xl">
          <Tabs
            options={ASSET_OPTIONS as any}
            value={selectedAsset}
            onChange={setSelectedAsset as any}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-8">
        <div className="bg-gradient-to-br from-[#0d1527] to-[#080d19] border border-[#1e293b] rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Başarı Oranı (Win Rate)</h3>
          <div className="text-4xl font-bold text-[#3b82f6] tracking-tight">
            {winRate.toFixed(1)}%
          </div>
          <div className="mt-2 text-[13px] text-slate-500 font-medium">
            <span className="text-slate-300">{won + chop}</span> Başarılı / <span className="text-slate-300">{totalClosed}</span> Toplam İşlem
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-[#0d1527] to-[#080d19] border border-[#1e293b] rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl ${totalDollarPnl >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}></div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Toplam Net Kâr / Zarar</h3>
          <div className={`text-4xl font-bold tracking-tight ${totalDollarPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {totalDollarPnl > 0 ? '+' : ''}{formatNumber(totalDollarPnl, true, 2)}
          </div>
          <div className="mt-2 text-[13px] text-slate-500 font-medium">
            Tahmini PnL (Kontrat x100 üzerinden)
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0d1527] to-[#080d19] border border-[#1e293b] rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Bekleyen İşlemler</h3>
          <div className="text-4xl font-bold text-amber-400 tracking-tight">
            {logs.filter(l => l.status === "PENDING").length}
          </div>
          <div className="mt-2 text-[13px] text-slate-500 font-medium">
            Seans bitimini bekleyen açık pozisyonlar
          </div>
        </div>
      </div>

      <div className="bg-[#0b1120] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#1e293b] bg-[#0d1527]">
          <h2 className="text-lg font-semibold text-white tracking-tight">İşlem Geçmişi ve Sonuçlar</h2>
        </div>
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
             <div className="p-12 flex items-center justify-center text-slate-500 font-medium">Veriler Yükleniyor...</div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#080c14]">
                <tr className="border-b border-[#1e293b] text-xs uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4 font-semibold">Tarih</th>
                  <th className="px-6 py-4 font-semibold">Sinyal / Varlık</th>
                  <th className="px-6 py-4 font-semibold">Durum</th>
                  <th className="px-6 py-4 font-semibold">Spot Hedefleri</th>
                  <th className="px-6 py-4 font-semibold">Opsiyon / Kontrat Çıktısı</th>
                  <th className="px-6 py-4 font-semibold max-w-xs">Sonuç</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/70 tabular-nums">
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">Kayıtlı işlem bulunamadı.</td>
                  </tr>
                )}
                {logs.map((log) => {
                  const ePrem = log.strategy_json?.entryPremium || 0;
                  const xPrem = log.strategy_json?.exitPremium || 0;
                  const isCall = log.direction === "LONG";
                  const pnl = (xPrem - ePrem) * 100;

                  return (
                    <tr key={log.id} className="transition-all hover:bg-white/[0.02] group">
                      <td className="px-6 py-4 text-slate-300">
                        <div className="font-medium text-white">{log.session_date}</div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(log.created_at).toLocaleTimeString('tr-TR')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-bold text-white text-[15px]">{log.asset || "SPX"}</span>
                          <Badge tone={isCall ? "up" : "down"}>{log.direction}</Badge>
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">{log.signal_state}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={log.status === "WON" ? "up" : log.status === "LOST" ? "down" : log.status === "PENDING" ? "brand" : "neutral"}>
                          {log.status === "WON" ? "BAŞARILI" : log.status === "LOST" ? "KAYIP" : log.status === "PENDING" ? "BEKLİYOR" : "NÖTR"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        <div className="flex justify-between items-center max-w-[160px] mb-1">
                          <span className="text-slate-500">Giriş:</span>
                          <span className="font-medium">{formatNumber(log.entry_price, true)}</span>
                        </div>
                        <div className="flex justify-between items-center max-w-[160px] mb-1">
                          <span className="text-rose-500/80">Stop:</span>
                          <span className="text-rose-400">{formatNumber(log.invalidation_price, true)}</span>
                        </div>
                        <div className="flex justify-between items-center max-w-[160px]">
                          <span className="text-[#3b82f6]/80">Çıkış:</span>
                          <span className="text-[#3b82f6]">{log.exit_price ? formatNumber(log.exit_price, true) : "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {log.status !== "PENDING" ? (
                          <>
                            <div className="mb-1 text-slate-400">
                              <span className="text-slate-200 font-medium">{isCall ? "CALL" : "PUT"} Kontrat</span> (x100)
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs">
                                <span className="text-slate-500">Maliyet: </span>
                                <span className="font-medium">{formatNumber(ePrem * 100, true)}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-slate-500">Kapanış: </span>
                                <span className={`font-bold ${pnl > 0 ? 'text-[#10b981]' : pnl < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                                  {formatNumber(xPrem * 100, true)}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-slate-500 italic text-xs">Piyasa kapanışı bekleniyor...</div>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className={`text-[13px] font-medium leading-relaxed ${log.status === "WON" ? "text-[#10b981]" : log.status === "LOST" ? "text-rose-400" : "text-slate-400"}`}>
                          {log.analysis ? log.analysis : "İşlem sonucu hesaplanıyor."}
                        </div>
                        {log.status !== "PENDING" && (
                          <div className={`mt-1.5 text-xs font-bold px-2 py-1 inline-block rounded-md ${pnl > 0 ? "bg-[#10b981]/10 text-[#10b981]" : "bg-rose-500/10 text-rose-400"}`}>
                            Net PnL: {pnl > 0 ? '+' : ''}{formatNumber(pnl, true)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
