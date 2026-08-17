"use client";

import { useEffect, useState } from "react";
import { Badge, Panel, Row, toneClass, signed } from "@/components/admin/supertrade/ui";

interface TradeLog {
  id: string;
  created_at: string;
  session_date: string;
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

export default function PerformancePage() {
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/supertrade/log")
      .then((r) => r.json())
      .then((data) => {
        if (data.logs) setLogs(data.logs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] p-5 text-slate-300">
        <Panel title="Sistem Performansı">Yükleniyor...</Panel>
      </div>
    );
  }

  const won = logs.filter((l) => l.status === "WON").length;
  const lost = logs.filter((l) => l.status === "LOST").length;
  const totalClosed = won + lost;
  const winRate = totalClosed > 0 ? (won / totalClosed) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 text-slate-300 md:p-5">
      <header className="mb-4">
        <h1 className="text-[18px] font-medium text-slate-100">SuperTrade Öğrenme ve Performans</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Sistemin geçmişte ürettiği sinyaller, hedeflerine ulaşıp ulaşmadığı ve strateji dersleri.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
        <Panel padding="p-4" title="Başarı Oranı (Win Rate)">
          <div className="text-[32px] font-medium text-[#3b82f6]">
            {winRate.toFixed(1)}%
          </div>
          <div className="mt-1 text-[12px] text-slate-400">
            {won} Başarılı / {totalClosed} Kapanan İşlem
          </div>
        </Panel>
        
        <Panel padding="p-4" title="Bekleyen İşlemler">
          <div className="text-[32px] font-medium text-slate-200">
            {logs.filter(l => l.status === "PENDING").length}
          </div>
          <div className="mt-1 text-[12px] text-slate-400">
            Bugün aktif olan sinyaller
          </div>
        </Panel>

        <Panel padding="p-4" title="Öğrenim Motoru">
          <p className="text-[12px] leading-relaxed text-slate-400">
            Bu sayfa, kırılımların (breakout) ardından fiyatın en az 10 puan hedef yönüne gidip gitmediğini veya stop (iptal) seviyesini kırıp kırmadığını otonom olarak analiz eder.
          </p>
        </Panel>
      </div>

      <Panel title="İşlem Geçmişi ve Analizler" padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#1c2635] text-[10px] uppercase tracking-[0.06em] text-[#3b82f6]">
                <th className="px-4 py-3 font-medium">Tarih</th>
                <th className="px-4 py-3 font-medium">Yön</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 font-medium">Giriş / Stop</th>
                <th className="px-4 py-3 font-medium">Sonuç (Çıkış)</th>
                <th className="px-4 py-3 font-medium">Öğrenim (Analiz)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2635]/70 tabular-nums">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">Kayıtlı işlem bulunamadı.</td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-400">
                    <div>{log.session_date}</div>
                    <div className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleTimeString('tr-TR')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={log.direction === "LONG" ? "up" : "down"}>{log.direction}</Badge>
                    <div className="mt-1 text-[10px] text-slate-500">{log.signal_state}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={log.status === "WON" ? "up" : log.status === "LOST" ? "down" : log.status === "PENDING" ? "brand" : "neutral"}>
                      {log.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div>Giriş: ${log.entry_price.toFixed(2)}</div>
                    <div className="text-[#ef4444] text-[10px]">Stop: ${log.invalidation_price.toFixed(2)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {log.exit_price ? `$${log.exit_price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 max-w-xs">
                    {log.analysis ? log.analysis : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
