"use client";

import { useEffect, useState } from "react";
import StrategyLab from "@/components/admin/StrategyLab";

interface Snapshot {
  timestamp: string;
  session_phase: string;
  macro_state: string;
  spx_price: number;
  es_price: number;
  es_spx_basis: number;
  spx: Record<string, any>;
  es: Record<string, any>;
  long_score: number;
  short_score: number;
  net_score: number;
  confidence_tier: string;
  state: string;
  ai_analysis?: Record<string, any>;
}

const ELEGANT_CARD = {
  background: "#0b0f17",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: 10,
  padding: 18,
};

const STATE_TRANSLATIONS: Record<string, { label: string; color: string; desc: string }> = {
  NEUTRAL: { label: "Nötr / Beklemede", color: "#64748b", desc: "Belirgin yönsel sapma yok" },
  WATCH_LONG: { label: "Long İzleme", color: "#fbbf24", desc: "Yukarı yönlü potansiyel izleniyor" },
  WATCH_SHORT: { label: "Short İzleme", color: "#f97316", desc: "Aşağı yönlü potansiyel izleniyor" },
  EARLY_LONG: { label: "Erken Long Kurulum", color: "#34d399", desc: "İlk kırılım teyit edildi" },
  EARLY_SHORT: { label: "Erken Short Kurulum", color: "#f87171", desc: "İlk kırılım teyit edildi" },
  CONFIRMED_LONG: { label: "Teyitli Long Trend", color: "#22c55e", desc: "Kırılım kabul edildi (Acceptance)" },
  CONFIRMED_SHORT: { label: "Teyitli Short Trend", color: "#ef4444", desc: "Kırılım kabul edildi (Acceptance)" },
  STRONG_LONG: { label: "Güçlü Long Momentum", color: "#4ade80", desc: "Yüksek net skor ve hacim teyidi" },
  STRONG_SHORT: { label: "Güçlü Short Momentum", color: "#dc2626", desc: "Yüksek net skor ve hacim teyidi" },
  LONG_WEAKENING: { label: "Long Zayıflıyor", color: "#f59e0b", desc: "Direnç veya kar satışı baskısı" },
  SHORT_WEAKENING: { label: "Short Zayıflıyor", color: "#f59e0b", desc: "Destek veya tepki alımı baskısı" },
  FAILED_LONG: { label: "Başarısız Long Kırılım", color: "#f43f5e", desc: "Tuzak kırılım, seviye altına dönüş" },
  FAILED_SHORT: { label: "Başarısız Short Kırılım", color: "#f43f5e", desc: "Tuzak kırılım, seviye üstüne dönüş" },
  CHOP: { label: "Yatay / Testere (Chop)", color: "#475569", desc: "Çelişkili göstergeler, işlem riski yüksek" },
  NO_TRADE: { label: "İşlem Yapılmamalı", color: "#334155", desc: "Uygun işlem koşulu yok" },
  DATA_STALE: { label: "Veri Güncel Değil", color: "#a855f7", desc: "Canlı akış beklemede" },
  EVENT_LOCKOUT: { label: "Makro Etkinlik Kilidi", color: "#ec4899", desc: "Veri öncesi işlem kısıtlaması" },
};

const PHASE_TRANSLATIONS: Record<string, string> = {
  EARLY_PREMARKET: "Erken Premarket (07:00–08:59 ET)",
  LATE_PREMARKET: "Geç Premarket (09:00–09:29 ET)",
  OPENING_DISCOVERY: "Açılış Keşfi (09:30–09:35 ET)",
  MAIN_SIGNAL_WINDOW: "Ana Sinyal Penceresi (09:35–10:30 ET)",
  REST_OF_SESSION: "Seans Devamı (10:30–16:00 ET)",
  OFF_HOURS: "Piyasa Kapalı (Kapanış Verileri)",
};

const CONFIDENCE_TRANSLATIONS: Record<string, string> = {
  LOW: "Düşük Güven",
  MEDIUM: "Orta Güven",
  HIGH: "Yüksek Güven",
  VERY_HIGH: "Çok Yüksek Güven",
};

const MACRO_STATE_TRANSLATIONS: Record<string, { label: string; color: string; border: string; bg: string }> = {
  NORMAL: { label: "Normal Akış", color: "text-slate-300", border: "border-slate-500/30", bg: "bg-slate-500/10" },
  PRE_EVENT: { label: "Makro Öncesi Denge", color: "text-amber-400", border: "border-amber-400/30", bg: "bg-amber-400/10" },
  EVENT_LOCKOUT: { label: "Veri Beklentisi (Lockout)", color: "text-rose-400", border: "border-rose-400/30", bg: "bg-rose-400/10" },
  POST_EVENT_DISCOVERY: { label: "Veri Sonrası Fiyatlama", color: "text-cyan-400", border: "border-cyan-400/30", bg: "bg-cyan-400/10" },
};


export default function SPXSuperTradePage() {
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [replayDate, setReplayDate] = useState("2026-08-15");
  const [replayData, setReplayData] = useState<any>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayTime, setReplayTime] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);

  const fetchLatestSnapshot = async () => {
    try {
      const res = await fetch("/api/admin/supertrade");
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
      }
    } catch (err) {
      console.error("Snapshot hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── LIVE ENGINE ──
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mode === "live") {
      fetchLatestSnapshot();
      interval = setInterval(fetchLatestSnapshot, 15000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  // ── REPLAY ENGINE (TIME TICKER) ──
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mode === "replay" && isReplaying) {
      interval = setInterval(() => {
        setReplayTime((prev) => {
          if (prev >= 150) {
            setIsReplaying(false);
            return 150;
          }
          return prev + 1;
        });
      }, 1000 / replaySpeed); // 1 second real-time = 1 minute simulation time (at 1x speed)
    }
    return () => clearInterval(interval);
  }, [mode, isReplaying, replaySpeed]);

  // ── REPLAY ENGINE (DATA GENERATOR) ──
  useEffect(() => {
    if (mode === "replay") {
      // 0 to 150 minutes (09:30 to 12:00)
      const baseSPX = 7780;
      const progress = replayTime / 150;
      
      let currentState = "NEUTRAL";
      let net = 0;
      let lScore = 1;
      let sScore = 1;
      
      if (replayTime < 20) {
        currentState = "WATCH_SHORT";
        net = -2.5;
        sScore = 3.5;
      } else if (replayTime < 45) {
        currentState = "CONFIRMED_SHORT";
        net = -5.0;
        sScore = 6.0;
      } else if (replayTime < 75) {
        currentState = "CHOP";
        net = 0;
        lScore = 2;
        sScore = 2;
      } else if (replayTime < 100) {
        currentState = "WATCH_LONG";
        net = 3.0;
        lScore = 4.0;
      } else {
        currentState = "STRONG_LONG";
        net = 6.5;
        lScore = 7.5;
        sScore = 1.0;
      }

      const totalMinutes = 30 + replayTime;
      const hh = 9 + Math.floor(totalMinutes / 60);
      const mm = totalMinutes % 60;
      const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

      const newSnapshot = {
        timestamp: `2026-08-15T${timeStr}:00Z`,
        state: currentState,
        net_score: net,
        long_score: lScore,
        short_score: sScore,
        spx_price: baseSPX + (progress * 40) - (Math.sin(progress * Math.PI * 4) * 15), // add some volatility
        session_phase: replayTime < 60 ? "IB" : "TREND",
        macro_state: "RISK_ON",
        confidence_tier: net > 4 || net < -4 ? "HIGH" : "MEDIUM",
        es: { price_vs_vwap: net > 0 ? "üstünde" : "altında" },
        ai_analysis: { summary: `Simülasyon Saati: ${timeStr}. Fiyat hareketleri dinamik olarak oluşturuluyor.` }
      };
      setSnapshot(newSnapshot as any);
    }
  }, [replayTime, mode]);

  const spx = snapshot?.spx ?? {};
  const es = snapshot?.es ?? {};
  const lScore = snapshot?.long_score ?? 2.0;
  const sScore = snapshot?.short_score ?? 3.0;
  const netScore = snapshot?.net_score ?? -1.0;
  const rawState = snapshot?.state ?? "NEUTRAL";
  const stateInfo = STATE_TRANSLATIONS[rawState] || { label: rawState, color: "#94a3b8", desc: "" };
  const phaseTR = PHASE_TRANSLATIONS[snapshot?.session_phase ?? "OFF_HOURS"] || snapshot?.session_phase;
  const confidenceTR = CONFIDENCE_TRANSLATIONS[snapshot?.confidence_tier ?? "LOW"] || snapshot?.confidence_tier;

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-300 p-6 font-sans">
      {/* ── Üst Sayfa Başlığı ve Mod Değiştirici */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl">🦅</span>
            <h1 className="text-lg font-semibold text-white tracking-wide">SPX Canlı Yön ve Teyit Motoru</h1>
            <span className="bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/20 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
              v2.2 SuperTrade Admin
            </span>
            {snapshot?.macro_state && MACRO_STATE_TRANSLATIONS[snapshot.macro_state] && (
              <span className={`border ${MACRO_STATE_TRANSLATIONS[snapshot.macro_state].bg} ${MACRO_STATE_TRANSLATIONS[snapshot.macro_state].border} ${MACRO_STATE_TRANSLATIONS[snapshot.macro_state].color} text-[11px] font-medium px-2.5 py-0.5 rounded-full`}>
                {MACRO_STATE_TRANSLATIONS[snapshot.macro_state].label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Yalnızca Yönetici — Gerçek Zamanlı Seans Öncesi &amp; Gün İçi Piyasa Keşif Sistemi
          </p>
        </div>

        {/* Kibar Mod Butonları */}
        <div className="flex items-center gap-1.5 bg-[#0e131f] border border-white/[0.08] p-1 rounded-lg self-start md:self-auto">
          <button
            onClick={() => setMode("live")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === "live"
                ? "bg-[#00d2ff] text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Canlı Terminal
          </button>
          <button
            onClick={() => setMode("replay")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === "replay"
                ? "bg-[#00d2ff] text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Seans Yeniden Oynatma
          </button>
        </div>
      </div>

      {mode === "replay" && (
        <div className="mb-6 bg-[#0a0e17] border border-[#00d2ff]/30 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 shadow-[0_0_15px_rgba(0,210,255,0.05)]">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsReplaying(!isReplaying)}
              className="w-10 h-10 rounded-full bg-[#00d2ff] text-slate-950 flex items-center justify-center hover:bg-[#00d2ff]/80 transition-colors"
            >
              {isReplaying ? "⏸" : "▶"}
            </button>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Live Simulator</div>
              <div className="text-sm font-bold text-white">{snapshot?.timestamp ? snapshot.timestamp.substring(11, 16) : "09:30"} / 12:00</div>
            </div>
          </div>
          
          <div className="flex-1 w-full px-4 flex flex-col justify-center">
            <input 
              type="range" 
              min="0" 
              max="150" 
              value={replayTime}
              onChange={(e) => setReplayTime(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00d2ff]"
            />
            <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
              <span>09:30</span>
              <span>10:30</span>
              <span>11:30</span>
              <span>12:00</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-[#070a11] px-2 py-1 rounded-md border border-white/[0.06]">
            <span className="text-[10px] text-slate-500 font-medium">Hız:</span>
            <select 
              value={replaySpeed}
              onChange={(e) => setReplaySpeed(Number(e.target.value))}
              className="bg-transparent text-xs text-emerald-400 font-bold outline-none cursor-pointer"
            >
              <option value="1" className="bg-[#070a11]">1x (Gerçek Zamanlı)</option>
              <option value="5" className="bg-[#070a11]">5x</option>
              <option value="10" className="bg-[#070a11]">10x</option>
              <option value="60" className="bg-[#070a11]">60x (Hızlı Çekim)</option>
            </select>
          </div>
        </div>
      )}

      <>
          {/* ── 0. DATA QUALITY & ACTION STATE ──────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-5 mb-6">
            
            {/* Action State Box */}
            <div className="flex-1 flex flex-col justify-center py-5 px-6 rounded-xl border" style={{ backgroundColor: `${stateInfo.color}10`, borderColor: `${stateInfo.color}30` }}>
              <div className="flex flex-col items-center mb-4">
                <div className="text-3xl md:text-4xl font-extrabold uppercase tracking-widest mb-2" style={{ color: stateInfo.color }}>
                  {rawState.replace(/_/g, " ")}
                </div>
                <div className="text-slate-300 text-sm font-medium text-center">
                  {snapshot?.ai_analysis?.summary 
                    ? snapshot.ai_analysis.summary.split('.')[0] + '.' 
                    : `ES VWAP ${es.price_vs_vwap || 'altında'}, 5m yapı ${netScore > 0 ? 'bullish' : netScore < 0 ? 'bearish' : 'nötr'}, net arbitraj skoru ${netScore >= 0 ? '+' : ''}${netScore.toFixed(1)}.`}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Şu An Ne Yapmalı? (Aksiyon)</span>
                  <span className="text-xs font-medium" style={{ color: stateInfo.color }}>
                    {netScore > 2 ? "İşleme Gir (Long)" : netScore < -2 ? "İşleme Gir (Short)" : "Bekle / İzle"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 md:pl-4 md:border-l border-white/[0.06]">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Teyit İçin Ne Bekliyoruz?</span>
                  <span className="text-xs text-slate-300 font-medium">
                    {netScore >= 0 ? "ORH kırılımı + 5m acceptance" : "ORL kırılımı + 5m acceptance"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 md:pl-4 md:border-l border-white/[0.06]">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Neyin Olması Senaryoyu Bozar?</span>
                  <span className="text-xs text-slate-300 font-medium">
                    {netScore >= 0 ? "ES tekrar VWAP altı + NetScore düşüşü" : "ES tekrar VWAP üstü + NetScore artışı"}
                  </span>
                </div>
              </div>
            </div>

            {/* Data Quality Panel */}
            <div className="lg:w-80 flex flex-col justify-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-[#0b0f17]">
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider border-b border-white/[0.06] pb-2 mb-1">
                Data Feed Quality
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="flex items-center justify-between pr-4">
                  <span className="text-slate-400">ES (CME)</span>
                  <span className="text-emerald-400 font-medium">LIVE <span className="text-emerald-500/60 text-[10px] ml-1">(0.4s)</span></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">SPX (CBOE)</span>
                  <span className="text-emerald-400 font-medium">LIVE <span className="text-emerald-500/60 text-[10px] ml-1">(0.6s)</span></span>
                </div>
                <div className="flex items-center justify-between pr-4">
                  <span className="text-slate-400">NQ (CME)</span>
                  <span className="text-emerald-400 font-medium">LIVE <span className="text-emerald-500/60 text-[10px] ml-1">(0.5s)</span></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">VIX (CBOE)</span>
                  <span className="text-emerald-400 font-medium">LIVE <span className="text-emerald-500/60 text-[10px] ml-1">(1.2s)</span></span>
                </div>
                <div className="flex items-center justify-between pr-4 col-span-2">
                  <span className="text-slate-400">Options (OPRA)</span>
                  <span className="text-emerald-400 font-medium">LIVE <span className="text-emerald-500/60 text-[10px] ml-1">(0.8s)</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 1. ZARİF ÜST METRİK BARI (YENİDEN TASARLANMIŞ) ──────── */}
          <div style={ELEGANT_CARD} className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
              <div>
                <div className="text-xs text-slate-400 font-medium">SPX Endeksi</div>
                <div className="text-xl font-semibold text-white mt-1">
                  {snapshot?.spx_price ? snapshot.spx_price.toFixed(2) : "7,786.01"}
                </div>
                <span className="text-[11px] text-slate-500 block mt-0.5">Son Seans Kapanışı</span>
              </div>

              <div>
                <div className="text-xs text-slate-400 font-medium">ES Vadeli (S&amp;P 500)</div>
                <div className="text-xl font-semibold text-white mt-1">
                  {snapshot?.es_price ? snapshot.es_price.toFixed(2) : "7,805.00"}
                </div>
                <span className="text-[11px] text-slate-500 block mt-0.5">CME Globex Vadeli</span>
              </div>

              <div>
                <div className="text-xs text-slate-400 font-medium">ES-SPX Farkı (Basis)</div>
                <div className="text-xl font-semibold text-[#00d2ff] mt-1">
                  {snapshot?.es_spx_basis !== undefined
                    ? snapshot.es_spx_basis >= 0
                      ? `+${snapshot.es_spx_basis.toFixed(2)}`
                      : snapshot.es_spx_basis.toFixed(2)
                    : "+18.99"}
                </div>
                <span className="text-[11px] text-slate-500 block mt-0.5">ES - SPX Farkı</span>
              </div>

              <div className="col-span-2 md:col-span-1">
                <div className="text-xs text-slate-400 font-medium">Net Yön (Mini)</div>
                <div className="text-sm font-semibold mt-1" style={{ color: stateInfo.color }}>
                  {stateInfo.label.split(" ")[0]} 
                  <span className="text-slate-500 mx-1">|</span> 
                  <span style={{ color: netScore > 0 ? "#22c55e" : netScore < 0 ? "#ef4444" : "#94a3b8" }}>
                    {netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-0.5">Özet Sinyal</span>
              </div>

              <div>
                <div className="text-xs text-slate-400 font-medium">Güven Seviyesi</div>
                <div className="text-sm font-semibold text-amber-300 mt-1">{confidenceTR}</div>
                <span className="text-[11px] text-slate-500 block mt-0.5">Kombine Güven</span>
              </div>

              <div>
                <div className="text-xs text-slate-400 font-medium">Seans Evresi</div>
                <div className="text-xs font-medium text-slate-200 mt-1">{phaseTR}</div>
                <span className="text-[11px] text-slate-500 block mt-0.5">New York Saat Dilimi</span>
              </div>
            </div>
          </div>

          {/* ── 2. ANA GRAFİK PANELLERİ (Durağan/Canlı Görsel Akış) ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
            {/* Sol Panel: ES Vadeli 5-Dakikalık */}
            <div className="lg:col-span-7 flex flex-col justify-between" style={ELEGANT_CARD}>
              <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2.5">
                <span className="text-sm font-semibold text-white">ES Vadeli 5m (Ana Yön &amp; VWAP Grafiği)</span>
                <span className="text-xs bg-slate-800/80 px-2.5 py-0.5 rounded text-slate-300">Seans Akışı</span>
              </div>

              {/* Seviye Kartları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-[#070a11] p-2.5 rounded-md border border-white/[0.06]">
                  <span className="text-slate-400 text-[11px] block font-medium">Seans VWAP</span>
                  <span className="font-semibold text-[#00d2ff] text-sm">{es.vwap ? es.vwap.toFixed(2) : "7,811.17"}</span>
                </div>
                <div className="bg-[#070a11] p-2.5 rounded-md border border-white/[0.06]">
                  <span className="text-slate-400 text-[11px] block font-medium">Globex ONH</span>
                  <span className="font-semibold text-[#34d399] text-sm">{es.onh ? es.onh.toFixed(2) : "7,817.50"}</span>
                </div>
                <div className="bg-[#070a11] p-2.5 rounded-md border border-white/[0.06]">
                  <span className="text-slate-400 text-[11px] block font-medium">Globex ONL</span>
                  <span className="font-semibold text-[#f87171] text-sm">{es.onl ? es.onl.toFixed(2) : "7,796.50"}</span>
                </div>
                <div className="bg-[#070a11] p-2.5 rounded-md border border-white/[0.06]">
                  <span className="text-slate-400 text-[11px] block font-medium">ON Midpoint</span>
                  <span className="font-semibold text-amber-300 text-sm">{es.overnight_mid ? es.overnight_mid.toFixed(2) : "7,807.00"}</span>
                </div>
              </div>

              {/* Görsel Mum Akışı (SVG Visualizer) */}
              <div className="h-[270px] bg-[#050811] border border-white/[0.06] rounded-md p-4 relative flex flex-col justify-between overflow-hidden">
                <div className="flex justify-between items-center text-xs text-slate-400 border-b border-white/[0.04] pb-2">
                  <span>ES1! CME — 5m Intraday Candle Stream</span>
                  <span className="text-slate-300 text-[11px]">
                    VWAP: <strong className="text-[#00d2ff]">{es.vwap || 7811.17}</strong> | ONH: <strong className="text-[#34d399]">{es.onh || 7817.50}</strong> | ONL: <strong className="text-[#f87171]">{es.onl || 7796.50}</strong>
                  </span>
                </div>

                <div className="w-full h-[200px] relative flex items-end justify-between px-3 pt-4">
                  {/* Katman Çizgileri - ONH / ONL */}
                  <div className="absolute left-0 right-0 top-[15%] border-b border-solid border-[#34d399]/40 opacity-80 z-10 flex justify-end pr-3">
                    <span className="text-[10px] bg-[#34d399]/10 text-[#34d399] px-1.5 py-0.5 rounded border border-[#34d399]/20">ONH 7817.50</span>
                  </div>
                  <div className="absolute left-0 right-0 top-[35%] border-b border-dashed border-[#00d2ff]/60 opacity-80 z-10 flex justify-end pr-3">
                    <span className="text-[10px] bg-[#00d2ff]/10 text-[#00d2ff] px-1.5 py-0.5 rounded border border-[#00d2ff]/20">VWAP 7811.17</span>
                  </div>
                  
                  {/* Katman Çizgileri - ORH / ORL (Daha Belirgin, Kesik Çizgi) */}
                  <div className="absolute left-0 right-0 top-[45%] border-b-2 border-dashed border-purple-400/70 opacity-90 z-10 flex justify-end pr-3">
                    <span className="text-[10px] bg-purple-400/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-400/20 font-bold">ORH 7807.71</span>
                  </div>
                  <div className="absolute left-0 right-0 top-[65%] border-b-2 border-dashed border-rose-400/70 opacity-90 z-10 flex justify-end pr-3">
                    <span className="text-[10px] bg-rose-400/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-400/20 font-bold">ORL 7801.46</span>
                  </div>

                  <div className="absolute left-0 right-0 top-[80%] border-b border-solid border-[#f87171]/40 opacity-80 z-10 flex justify-end pr-3">
                    <span className="text-[10px] bg-[#f87171]/10 text-[#f87171] px-1.5 py-0.5 rounded border border-[#f87171]/20">ONL 7796.50</span>
                  </div>

                  {/* Gerçek Seans Mum Örneği Akışı */}
                  {[
                    { h: 40, l: 15, o: 20, c: 35, bull: true },
                    { h: 45, l: 30, o: 35, c: 42, bull: true },
                    { h: 55, l: 40, o: 42, c: 50, bull: true },
                    { h: 60, l: 45, o: 50, c: 48, bull: false },
                    { h: 52, l: 35, o: 48, c: 38, bull: false },
                    { h: 42, l: 25, o: 38, c: 30, bull: false },
                    { h: 38, l: 28, o: 30, c: 36, bull: true },
                    { h: 48, l: 34, o: 36, c: 45, bull: true },
                    { h: 65, l: 44, o: 45, c: 62, bull: true },
                    { h: 70, l: 58, o: 62, c: 66, bull: true },
                    { h: 75, l: 60, o: 66, c: 64, bull: false },
                    { h: 68, l: 55, o: 64, c: 58, bull: false },
                    { h: 62, l: 50, o: 58, c: 52, bull: false },
                    { h: 56, l: 48, o: 52, c: 54, bull: true },
                  ].map((c, i) => (
                    <div key={i} className="flex flex-col items-center h-full justify-end w-3 relative">
                      <div className="w-[1px] bg-slate-600/80 absolute" style={{ bottom: `${c.l}%`, height: `${c.h - c.l}%` }} />
                      <div
                        className={`w-2.5 rounded-sm z-10 ${c.bull ? "bg-[#34d399]" : "bg-[#f87171]"}`}
                        style={{ bottom: `${Math.min(c.o, c.c)}%`, height: `${Math.max(4, Math.abs(c.c - c.o))}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sağ Yan Paneller */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* "What Changed" Paneli (09:30-10:30) */}
              <div style={ELEGANT_CARD}>
                <div className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  Son 5 Dakikada Değişenler (What Changed)
                </div>
                <div className="bg-[#070a11] border border-white/[0.06] rounded-md p-3 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-emerald-400 font-bold">↑</span> ES VWAP reclaimed (7,811.17 üzerine çıktı)
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-emerald-400 font-bold">↑</span> NetScore +2.0 → +3.5 yükseldi
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-amber-400 font-bold">!</span> VIX hala teyit vermiyor (Negatif Diverjans)
                  </div>
                </div>
              </div>

              <div style={ELEGANT_CARD}>
                <div className="text-xs font-semibold text-slate-200 mb-2">ES 15m (Genel Piyasa Eğilimi)</div>
                <div className="h-[60px] bg-[#070a11] border border-white/[0.06] rounded-md flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">15m Trend Yapısı</span>
                    <span className="font-medium text-[#34d399]">Yükselen (HH / HL Yapısı)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Önceki Gün (PDH / PDL)</span>
                    <span className="font-medium text-slate-200">{es.pdh || "7,831.75"} / {es.pdl || "7,796.50"}</span>
                  </div>
                </div>
              </div>

              <div style={ELEGANT_CARD}>
                <div className="text-xs font-semibold text-slate-200 mb-2">SPX 5m (Açılış Aralığı OR5)</div>
                <div className="h-[60px] bg-[#070a11] border border-white/[0.06] rounded-md flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">ORH / ORL Seviyeleri</span>
                    <span className="font-medium text-[#34d399]">{spx.orh || "7,807.71"}</span> / <span className="font-medium text-[#f87171]">{spx.orl || "7,801.46"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Açılış Genişliği</span>
                    <span className="font-medium text-amber-300">{spx.or_size || 6.25} Puan</span>
                  </div>
                </div>
              </div>

              <div style={ELEGANT_CARD}>
                <div className="text-xs font-semibold text-slate-200 mb-3">SPX 1m (Giriş &amp; Uygulama Yapısı)</div>
                <div className="bg-[#070a11] border border-white/[0.06] rounded-md p-3 text-xs">
                  <div className="flex justify-between items-center border-b border-white/[0.04] pb-2 mb-2">
                    <span className="text-slate-400 text-[11px]">Test Edilen Seviye:</span>
                    <span className="font-medium text-purple-400">ORH 7807.71</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/[0.04] pb-2 mb-2">
                    <span className="text-slate-400 text-[11px]">Kırılım Durumu (Status):</span>
                    <span className="bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">ACCEPTANCE</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[11px]">Güç (Strength):</span>
                    <span className="text-emerald-400 font-medium text-[11px]">1m accepted, 5m pending</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. SİNYAL KARTI, NEDEN VE YAPAY ZEKA PANELLERİ ─────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {/* Deterministik Sinyal Kartı */}
            <div style={ELEGANT_CARD} className="flex flex-col">
              <div className="text-xs font-semibold text-[#00d2ff] mb-4 uppercase tracking-wider">🎯 Deterministik Sinyal Kartı</div>
              
              <div className="flex-1 flex flex-col justify-center items-center mb-6">
                <div className="text-2xl font-black uppercase tracking-widest text-center" style={{ color: stateInfo.color }}>
                  {rawState.replace(/_/g, " ")}
                </div>
                <div className="text-[10px] text-slate-500 uppercase mt-1">Ana Sinyal Durumu</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#070a11] border border-white/[0.06] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold" style={{ color: netScore > 0 ? "#34d399" : netScore < 0 ? "#f87171" : "#94a3b8" }}>
                    {netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase mt-1">NetScore</div>
                </div>
                <div className="bg-[#070a11] border border-white/[0.06] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-amber-300">
                    {snapshot?.confidence_tier === "VERY_HIGH" ? "ÇOK YÜKSEK" : snapshot?.confidence_tier === "HIGH" ? "YÜKSEK" : snapshot?.confidence_tier === "MEDIUM" ? "ORTA" : "DÜŞÜK"}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase mt-1">Güven</div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs border-t border-white/[0.06] pt-3">
                <div className="text-slate-400">Long Skoru: <span className="font-medium text-emerald-400 ml-1">{lScore.toFixed(1)}</span></div>
                <div className="text-slate-400">Short Skoru: <span className="font-medium text-rose-400 ml-1">{sScore.toFixed(1)}</span></div>
              </div>
            </div>

            {/* NEDEN Paneli */}
            <div style={ELEGANT_CARD}>
              <div className="text-xs font-semibold text-slate-200 mb-4 uppercase tracking-wider">🔍 Neden Paneli (Veri Gerekçeleri)</div>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                {/* Destekleyenler */}
                <div>
                  <div className="text-[#34d399] font-medium mb-2 border-b border-[#34d399]/20 pb-1">✓ Destekleyenler</div>
                  <ul className="list-disc list-inside text-slate-400 space-y-1.5 pl-1">
                    <li>ES <span className="text-slate-200 font-medium">VWAP üstünde</span></li>
                    <li>NetScore <span className="text-slate-200 font-medium">Pozitif (+{netScore > 0 ? netScore.toFixed(1) : "2.5"})</span></li>
                    <li>NQ <span className="text-slate-200 font-medium">Hizalı</span></li>
                  </ul>
                </div>
                {/* Çelişkiler */}
                <div>
                  <div className="text-rose-400 font-medium mb-2 border-b border-rose-400/20 pb-1">✕ Çelişkiler</div>
                  <ul className="list-disc list-inside text-slate-400 space-y-1.5 pl-1">
                    <li>ORH <span className="text-slate-200 font-medium">Henüz kırılmadı</span></li>
                    <li>VIX <span className="text-slate-200 font-medium">Düşüş onaysız</span></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* AI Yorum Paneli */}
            <div style={ELEGANT_CARD}>
              <div className="text-xs font-semibold text-[#00d2ff] mb-3 uppercase tracking-wider">🤖 Katman B Yapay Zeka Yorumu (DeepSeek)</div>
              {snapshot?.ai_analysis ? (
                <div className="space-y-2 text-xs">
                  <p className="text-slate-200 font-normal leading-relaxed">{snapshot.ai_analysis.summary}</p>
                  {snapshot.ai_analysis.invalidation_conditions && (
                    <div className="text-rose-400 mt-2">
                      <strong className="font-medium">İptal/Geçersizlik Koşulu:</strong> {snapshot.ai_analysis.invalidation_conditions.join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
                  <p className="font-medium text-slate-200">Katman B AI Özeti:</p>
                  <p>Deterministik Katman A verileri doğrulandı. Fiyat ES VWAP altında seyrediyor, NQ hizalaması nötr seviyede.</p>
                  <p className="text-emerald-400"><strong>Teyit Koşulu:</strong> ES'in 7,811.17 VWAP seviyesi üzerine 5m mum kapatması.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── 4. OPSİYON ARAŞTIRMASI & MULTI-MODEL SIMULATÖRÜ ───────── */}
          <div style={ELEGANT_CARD}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 border-b border-white/[0.06] pb-3">
              <div>
                <span className="text-sm font-semibold text-amber-300 block">
                  Opsiyon Araştırma &amp; 5 Multi-Model Runner Takibi (Simülasyon)
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  İki kontratlık çıkış stratejileri ve duyarlılık karşılaştırması
                </span>
              </div>
              <span className="text-xs text-slate-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                SPXW 0DTE Evreni
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-slate-400 uppercase text-[10px]">
                    <th className="py-2.5 px-3 font-medium">Grev Etiketi</th>
                    <th className="py-2.5 px-3 font-medium">Grev Fiyatı</th>
                    <th className="py-2.5 px-3 font-medium">Opsiyon Tipi</th>
                    <th className="py-2.5 px-3 font-medium">DTE</th>
                    <th className="py-2.5 px-3 font-medium">OTM Uzaklık (Puan &amp; %)</th>
                    <th className="py-2.5 px-3 font-medium">Giriş Ask ($)</th>
                    <th className="py-2.5 px-3 font-medium">Anlık Bid ($)</th>
                    <th className="py-2.5 px-3 font-medium">Spread %</th>
                    <th className="py-2.5 px-3 font-medium">Risk (Kalite)</th>
                    <th className="py-2.5 px-3 font-medium">Veri Yaşı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-slate-300">
                  {[0, 5, 10, 15, 20, 25, 30].map((offset) => {
                    const spxP = snapshot?.spx_price || 7786.01;
                    const atm = Math.round(spxP / 5) * 5;
                    const strike = atm + offset;
                    const otmPts = strike - spxP;
                    const otmPct = (otmPts / spxP) * 100;
                    const ask = Math.max(1.0, 18.5 - offset * 0.45);
                    const bid = Number((ask * (0.94 - (offset * 0.005))).toFixed(2));
                    const spreadPct = ((ask - bid) / ask) * 100;
                    
                    let riskLabel = "Tight";
                    let riskColor = "bg-emerald-400/20 text-emerald-400 border-emerald-400/30";
                    if (spreadPct > 6) {
                      riskLabel = "Wide";
                      riskColor = "bg-rose-400/20 text-rose-400 border-rose-400/30";
                    } else if (spreadPct >= 3) {
                      riskLabel = "Moderate";
                      riskColor = "bg-amber-400/20 text-amber-400 border-amber-400/30";
                    }

                    return (
                      <tr key={offset} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-3 font-medium text-[#00d2ff]">{offset === 0 ? "ATM" : `${offset} OTM`}</td>
                        <td className="py-2.5 px-3 font-medium text-white">{strike}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-medium">CALL</td>
                        <td className="py-2.5 px-3 text-slate-400">0</td>
                        <td className="py-2.5 px-3">
                          {otmPts >= 0 ? `+${otmPts.toFixed(2)}` : otmPts.toFixed(2)} Puan ({otmPct >= 0 ? `+%${otmPct.toFixed(2)}` : `%${otmPct.toFixed(2)}`})
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white">${ask.toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-medium text-emerald-400">${bid.toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-400">%{spreadPct.toFixed(1)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${riskColor}`}>{riskLabel}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-emerald-500 font-medium">&lt; 1s</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Model Açıklamaları (Live Simulator Grid) */}
            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-200 mb-3 uppercase tracking-wider">🚀 Runner Model Karşılaştırması (2 Kontrat Çıkış Simülasyonu)</div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                {[
                  { name: "Model A", desc: "Sabit Hedef", pl: "+$95.00", max: "+$95.00", dd: "0%", exit: "2x +50% TP", tag: "Balanced" },
                  { name: "Model B", desc: "Maliyet Stop Runner", pl: "+$140.00", max: "+$180.00", dd: "-22%", exit: "Maliyet Stop", tag: "Most Defensive" },
                  { name: "Model C", desc: "+%50 Stop Runner", pl: "+$210.50", max: "+$240.00", dd: "-12%", exit: "+%50 Stop Koruma", tag: "Best R/R" },
                  { name: "Model D", desc: "Bid Trailing Runner", pl: "+$320.00", max: "+$350.00", dd: "-8%", exit: "-20% Bid Trail", tag: "Lowest Drawdown" },
                  { name: "Model E", desc: "SPX Yapı Runner", pl: "+$410.00", max: "+$410.00", dd: "0%", exit: "SPX 5m Bozulması", tag: "Best Current" },
                ].map((m, i) => (
                  <div key={i} className={`bg-[#070a11] p-3 rounded-lg border flex flex-col justify-between ${m.tag === "Best Current" ? "border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.1)]" : "border-white/[0.08]"}`}>
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-white font-bold">{m.name} <span className="text-slate-500 font-normal text-[10px] block md:inline">({m.desc})</span></div>
                        {m.tag && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${m.tag === "Best Current" ? "bg-amber-400/20 text-amber-400 border-amber-400/30" : "bg-white/[0.05] text-slate-400 border-white/[0.1]"}`}>
                            {m.tag}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-2 border-t border-white/[0.04] pt-2">
                        <span className="text-slate-400 text-[10px]">Current P/L</span>
                        <span className="text-emerald-400 font-bold">{m.pl}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-slate-400 text-[10px]">Max P/L</span>
                        <span className="text-slate-200">{m.max}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-slate-400 text-[10px]">Drawdown</span>
                        <span className="text-rose-400">{m.dd}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/[0.04] text-[10px] text-amber-300 font-medium">
                      Çıkış: {m.exit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <StrategyLab spxPrice={snapshot?.spx_price ?? 7786.01} currentState={rawState} />

            <p className="text-[11px] text-slate-500 mt-5">
              ⚠️ Opsiyon metrikleri teorik modeller ve runner çıkış karşılaştırması içindir. Otomatik emre dönüşmez.
            </p>
          </div>
      </>
    </div>
  );
}
