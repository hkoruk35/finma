"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Panel, Table, TBody, Td, Th, THead, Tr } from "@/components/admin/supertrade/ui";

type SignalState = "IDLE" | "WATCHING" | "ARMED" | "TRIGGERED" | "ACTIVE" | "EXITED";

interface EngineState {
  asset: string;
  m15: "Bullish" | "Bearish" | "Neutral";
  m5: "Breakout Watch" | "Support Test" | "Breakout" | "Reversal" | "Waiting";
  m1: "Bullish Rejection" | "Bearish Rejection" | "Hammer" | "Engulfing" | "Waiting";
  state: SignalState;
  action: "BEKLE" | "BUY" | "SHORT" | "HOLD" | "EXIT" | "INVALIDATED";
  price: number;
  confidence: number;
  reasoning: string;
  entryPrice?: number;
}

export default function SPYEngineV1() {
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEngineData = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v1?symbol=SPY");
        const json = await res.json();
        
        if (json.ok && json.data) {
          setEngineState(json.data);
          setError(null);
        } else {
          setError(json.error || "Bilinmeyen bir hata oluştu");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchEngineData();
    const interval = setInterval(fetchEngineData, 15000); // 15 saniyede bir güncelle

    return () => clearInterval(interval);
  }, []);

  const getActionColor = (action: string) => {
    switch(action) {
      case "BUY": return "bg-green-500/20 text-green-400 border border-green-500/30";
      case "SHORT": return "bg-red-500/20 text-red-400 border border-red-500/30";
      case "HOLD": return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
      case "EXIT": return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
      default: return "bg-slate-700 text-slate-300";
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "text-green-400 font-bold";
    if (score >= 70) return "text-blue-400";
    if (score >= 60) return "text-yellow-400";
    return "text-slate-400";
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 text-slate-300 md:p-5">
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1c2635] pb-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-[18px] font-medium tracking-tight text-[#eab308]">
              SPYEngine V1
            </h1>
            <Badge tone="brand">Canlı Sinyal Motoru</Badge>
          </div>
          <p className="text-[12px] text-slate-500">
            Market Context (15m) → Setup (5m) → Trigger (1m) hiyerarşisiyle çalışan non-repainting işlem tetiği.
          </p>
        </div>
        <Link 
          href="/admin/supertrade/v4" 
          className="flex items-center gap-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-colors px-3 py-1.5 text-[12px] font-medium text-slate-300 whitespace-nowrap"
        >
          🦅 SuperTrade V4'e Dön
        </Link>
      </header>

      {loading && !engineState ? (
        <div className="text-slate-500 text-sm">SPYEngine başlatılıyor, piyasa verileri analiz ediliyor...</div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-900/20 p-4 rounded border border-red-500/30">
          Motor hatası: {error}
        </div>
      ) : engineState && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4 flex flex-col">
              <span className="text-[11px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Aktif Durum</span>
              <span className="text-[20px] font-bold text-white tracking-tight">{engineState.state}</span>
            </div>
            <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4 flex flex-col">
              <span className="text-[11px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Güven Skoru</span>
              <span className={`text-[20px] font-bold tracking-tight ${getConfidenceColor(engineState.confidence)}`}>
                {engineState.confidence > 0 ? `${engineState.confidence}/100` : "-"}
              </span>
            </div>
            <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4 flex flex-col">
              <span className="text-[11px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Anlık Fiyat</span>
              <span className="text-[20px] font-bold text-white tracking-tight">${engineState.price.toFixed(2)}</span>
            </div>
            <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4 flex flex-col">
              <span className="text-[11px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Tavsiye</span>
              <span className={`text-[16px] font-bold px-3 py-1 rounded w-fit ${getActionColor(engineState.action)}`}>
                {engineState.action}
              </span>
            </div>
          </div>

          <Panel padding="p-0">
            <Table bordered={false}>
              <THead>
                <tr>
                  <Th>Varlık</Th>
                  <Th>15m (Yön / Rejim)</Th>
                  <Th>5m (Setup Motoru)</Th>
                  <Th>1m (Hassas Tetik)</Th>
                  <Th align="center">Sonuç</Th>
                </tr>
              </THead>
              <TBody>
                <Tr className="hover:bg-[#1c2635]/50 transition-colors group cursor-pointer relative">
                  <Td>
                    <div className="font-medium text-slate-100">{engineState.asset}</div>
                    <div className="text-[11px] text-slate-500">S&P 500 ETF</div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${engineState.m15 === "Bullish" ? "bg-green-500" : engineState.m15 === "Bearish" ? "bg-red-500" : "bg-slate-500"}`}></span>
                      <span className={engineState.m15 === "Bullish" ? "text-green-400" : engineState.m15 === "Bearish" ? "text-red-400" : "text-slate-400"}>{engineState.m15}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${engineState.m5.includes("Breakout") && engineState.m5 !== "Breakout Watch" ? "bg-green-500" : engineState.m5 === "Breakout Watch" ? "bg-yellow-500" : "bg-slate-500"}`}></span>
                      <span className={engineState.m5.includes("Breakout") && engineState.m5 !== "Breakout Watch" ? "text-green-400" : engineState.m5 === "Breakout Watch" ? "text-yellow-400" : "text-slate-400"}>{engineState.m5}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${engineState.m1 !== "Waiting" && !engineState.m1.includes("Bearish") ? "bg-green-500" : engineState.m1.includes("Bearish") ? "bg-red-500" : "bg-slate-500"}`}></span>
                      <span className={engineState.m1 !== "Waiting" && !engineState.m1.includes("Bearish") ? "text-green-400" : engineState.m1.includes("Bearish") ? "text-red-400" : "text-slate-400"}>{engineState.m1}</span>
                    </div>
                  </Td>
                  <Td align="center">
                    <Badge tone={engineState.action === "BUY" || engineState.action === "HOLD" ? "up" : engineState.action === "SHORT" || engineState.action === "EXIT" ? "down" : "neutral"}>
                      {engineState.action}
                    </Badge>
                  </Td>
                </Tr>
              </TBody>
            </Table>
          </Panel>

          <div className="mt-6 bg-[#111827] border border-[#1f2937] rounded-lg p-5">
            <h3 className="text-[14px] font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sinyal Motoru Detayları (Log)
            </h3>
            <div className="text-[13px] font-mono text-slate-400 bg-[#0d1117] p-3 rounded border border-[#1c2635]">
              <span className="text-[#3b82f6]">{new Date().toLocaleTimeString()}</span> - <span className={engineState.action === "BUY" ? "text-green-400" : engineState.action === "EXIT" ? "text-yellow-400" : ""}>{engineState.reasoning}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
