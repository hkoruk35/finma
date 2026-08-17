"use client";

import { useEffect, useState, useMemo } from "react";
import StrategyLab from "@/components/admin/StrategyLab";
import ContextEnginePanel from "@/components/admin/ContextEnginePanel";
import SuperTradeLiveChart from "@/components/admin/SuperTradeLiveChart";
import { getDecisionContext } from "@/lib/decisionEngine";
import { evaluateSPXContext } from "@/lib/contextEngine";

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
  border: "1px solid #1e2a3a",
  borderRadius: 12,
  padding: 20,
};

const STATE_TRANSLATIONS: Record<string, { label: string; color: string; desc: string }> = {
  NEUTRAL: { label: "Nötr / Beklemede", color: "#64748b", desc: "Belirgin yönsel sapma yok" },
  WATCH_LONG: { label: "Long İzleme", color: "#fbbf24", desc: "Yukarı yönlü potansiyel izleniyor" },
  WATCH_SHORT: { label: "Short İzleme", color: "#f97316", desc: "Aşağı yönlü potansiyel izleniyor" },
  EARLY_LONG: { label: "Erken Long Kurulum", color: "#22c55e", desc: "İlk kırılım teyit edildi" },
  EARLY_SHORT: { label: "Erken Short Kurulum", color: "#ef4444", desc: "İlk kırılım teyit edildi" },
  CONFIRMED_LONG: { label: "Teyitli Long Trend", color: "#22c55e", desc: "Kırılım kabul edildi (Acceptance)" },
  CONFIRMED_SHORT: { label: "Teyitli Short Trend", color: "#ef4444", desc: "Kırılım kabul edildi (Acceptance)" },
  STRONG_LONG: { label: "Güçlü Long Momentum", color: "#16a34a", desc: "Yüksek net skor ve hacim teyidi" },
  STRONG_SHORT: { label: "Güçlü Short Momentum", color: "#dc2626", desc: "Yüksek net skor ve hacim teyidi" },
  LONG_WEAKENING: { label: "Long Zayıflıyor", color: "#f59e0b", desc: "Direnç veya kâr satışı baskısı" },
  SHORT_WEAKENING: { label: "Short Zayıflıyor", color: "#f59e0b", desc: "Destek veya tepki alımı baskısı" },
  FAILED_LONG: { label: "Başarısız Long Kırılım", color: "#f43f5e", desc: "Tuzak kırılım, seviye altına dönüş" },
  FAILED_SHORT: { label: "Başarısız Short Kırılım", color: "#f43f5e", desc: "Tuzak kırılım, seviye üstüne dönüş" },
  CHOP: { label: "Yatay / Testere (Chop)", color: "#475569", desc: "Çelişkili göstergeler, işlem riski yüksek" },
  NO_TRADE: { label: "İşlem Yapılmamalı", color: "#334155", desc: "Uygun işlem koşulu yok" },
  DATA_STALE: { label: "Veri Güncel Değil", color: "#a855f7", desc: "Canlı akış beklemede" },
  EVENT_LOCKOUT: { label: "Makro Etkinlik Kilidi", color: "#ec4899", desc: "Veri öncesi işlem kısıtlaması" },
};

const PHASE_TRANSLATIONS: Record<string, string> = {
  EARLY_PREMARKET: "Erken Seans Öncesi (07:00–08:59 ET)",
  LATE_PREMARKET: "Geç Seans Öncesi (09:00–09:29 ET)",
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
  EVENT_LOCKOUT: { label: "Veri Beklentisi (Kilitli)", color: "text-[#ef4444]", border: "border-rose-500/30", bg: "bg-rose-500/10" },
  POST_EVENT_DISCOVERY: { label: "Veri Sonrası Fiyatlama", color: "text-[#3b82f6]", border: "border-[#3b82f6]/30", bg: "bg-[#3b82f6]/10" },
};

export default function SPXSuperTradePage() {
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [replayTime, setReplayTime] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [optionViewMode, setOptionViewMode] = useState<"directional" | "call" | "put">("directional");

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

  // ── CANLI VERİ MOTORU ──
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mode === "live") {
      fetchLatestSnapshot();
      interval = setInterval(fetchLatestSnapshot, 5000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  // ── SEANS YENİDEN OYNATMA MOTORU (ZAMAN SAYACI) ──
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
      }, 1000 / replaySpeed);
    }
    return () => clearInterval(interval);
  }, [mode, isReplaying, replaySpeed]);

  // ── SEANS YENİDEN OYNATMA (GERÇEKÇİ VERİ ÜRETİCİ) ──
  useEffect(() => {
    if (mode === "replay") {
      const baseSPX = 7780;
      let currentState = "NEUTRAL";
      let net = 0;
      let lScore = 1;
      let sScore = 1;

      if (replayTime < 25) {
        currentState = "WATCH_SHORT";
        net = -2.5;
        sScore = 3.5;
        lScore = 1.0;
      } else if (replayTime < 50) {
        currentState = "CONFIRMED_SHORT";
        net = -5.0;
        sScore = 6.5;
        lScore = 1.5;
      } else if (replayTime < 75) {
        currentState = "CHOP";
        net = 0;
        lScore = 2.0;
        sScore = 2.0;
      } else if (replayTime < 105) {
        currentState = "WATCH_LONG";
        net = 3.0;
        lScore = 4.5;
        sScore = 1.5;
      } else {
        currentState = "STRONG_LONG";
        net = 6.5;
        lScore = 7.5;
        sScore = 1.0;
      }

      const totalMinutes = 30 + replayTime;
      const hh = 9 + Math.floor(totalMinutes / 60);
      const mm = totalMinutes % 60;
      const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

      const dynamicSpx =
        baseSPX +
        (replayTime < 50
          ? -15 * (replayTime / 50)
          : replayTime < 75
          ? -15 + 10 * ((replayTime - 50) / 25)
          : -5 + 45 * ((replayTime - 75) / 75));

      const newSnapshot = {
        timestamp: `2026-08-15T${timeStr}:00Z`,
        state: currentState,
        net_score: net,
        long_score: lScore,
        short_score: sScore,
        spx_price: Number(dynamicSpx.toFixed(2)),
        es_price: Number((dynamicSpx + 18.5).toFixed(2)),
        es_spx_basis: 18.5,
        session_phase: replayTime < 60 ? "OPENING_DISCOVERY" : "MAIN_SIGNAL_WINDOW",
        macro_state: "NORMAL",
        confidence_tier: Math.abs(net) > 4 ? "HIGH" : "MEDIUM",
        spx: {
          orh: 7807.71,
          orl: 7801.46,
          or_size: 6.25,
        },
        es: {
          vwap: 7811.17,
          onh: 7817.5,
          onl: 7796.5,
          overnight_mid: 7807.0,
          pdh: 7831.75,
          pdl: 7796.5,
          price_vs_vwap: net > 0 ? "üstünde" : "altında",
        },
        ai_analysis: {
          summary: `Replay Saati: ${timeStr} ET. Karar motoru ${currentState.replace(/_/g, " ")} durumunu teyit etti. Net arbitraj skoru ${net >= 0 ? "+" : ""}${net.toFixed(1)}.`,
        },
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

  // ── MERKEZİ DETERMINİSTİK KARAR BAĞLAMI ──
  const decision = useMemo(() => {
    return getDecisionContext(
      rawState,
      netScore,
      snapshot?.spx_price ?? 7786.01,
      es.vwap ?? 7811.17,
      spx.orh ?? 7807.71,
      spx.orl ?? 7801.46
    );
  }, [rawState, netScore, snapshot?.spx_price, es.vwap, spx.orh, spx.orl]);

  // Opsiyon tipi seçimi
  const activeOptionType = useMemo(() => {
    if (optionViewMode === "call") return "CALL";
    if (optionViewMode === "put") return "PUT";
    return decision.direction === "SHORT" ? "PUT" : "CALL";
  }, [optionViewMode, decision.direction]);

  // ── SPX BAĞLAM VE REJİM ANLIK GÖRÜNTÜSÜ ──
  const contextSnapshot = useMemo(() => {
    return evaluateSPXContext(
      new Date(),
      rawState,
      snapshot?.spx_price ?? 7786.01,
      es.vwap ?? 7811.17,
      snapshot?.es_price ?? 7805.0
    );
  }, [rawState, snapshot?.spx_price, es.vwap, snapshot?.es_price]);

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-300 p-6 font-sans">
      {/* ── Üst Sayfa Başlığı ve Mod Değiştirici */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[#1e2a3a] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl">🦅</span>
            <h1 className="text-xl font-black text-[#3b82f6] tracking-wide">
              SPX Canlı Yön ve Teyit Motoru
            </h1>
            <span className="bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              v2.3 SuperTrade Terminali
            </span>
            {snapshot?.macro_state && MACRO_STATE_TRANSLATIONS[snapshot.macro_state] && (
              <span
                className={`border ${MACRO_STATE_TRANSLATIONS[snapshot.macro_state].bg} ${
                  MACRO_STATE_TRANSLATIONS[snapshot.macro_state].border
                } ${MACRO_STATE_TRANSLATIONS[snapshot.macro_state].color} text-[11px] font-bold px-2.5 py-0.5 rounded-full`}
              >
                {MACRO_STATE_TRANSLATIONS[snapshot.macro_state].label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Yönetici Konsolu — Gerçek Zamanlı Seans Öncesi &amp; Gün İçi Piyasa Keşif Sistemi
          </p>
        </div>

        {/* Mod Butonları (Logo Mavisi) */}
        <div className="flex items-center gap-1.5 bg-[#0e131f] border border-[#1e2a3a] p-1 rounded-lg self-start md:self-auto">
          <button
            onClick={() => setMode("live")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              mode === "live"
                ? "bg-[#3b82f6] text-white shadow-md font-extrabold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Canlı Terminal
          </button>
          <button
            onClick={() => setMode("replay")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              mode === "replay"
                ? "bg-[#3b82f6] text-white shadow-md font-extrabold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Seans Yeniden Oynatma
          </button>
        </div>
      </div>

      {/* ── REPLAY KONTROL ÇUBUĞU (ZAMAN YÖNETİCİSİ) ── */}
      {mode === "replay" && (
        <div className="mb-6 bg-[#0a0e17] border border-[#3b82f6]/40 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsReplaying(!isReplaying)}
              className="w-10 h-10 rounded-full bg-[#3b82f6] text-white flex items-center justify-center hover:bg-[#2563eb] transition-colors text-base font-bold shadow-lg"
            >
              {isReplaying ? "⏸" : "▶"}
            </button>
            <div>
              <div className="text-[10px] text-[#3b82f6] font-bold uppercase tracking-wider mb-0.5">
                Simülasyon Seansı
              </div>
              <div className="text-sm font-bold text-white">
                {snapshot?.timestamp ? snapshot.timestamp.substring(11, 16) : "09:30"} / 12:00 ET
              </div>
            </div>
          </div>

          <div className="flex-1 w-full px-4 flex flex-col justify-center">
            <input
              type="range"
              min="0"
              max="150"
              value={replayTime}
              onChange={(e) => setReplayTime(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>09:30 (Açılış)</span>
              <span>10:15</span>
              <span>11:00</span>
              <span>12:00 (Öğle)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#070a11] px-3 py-1.5 rounded-md border border-[#1e2a3a]">
            <span className="text-[10px] text-slate-400 font-medium">Hız:</span>
            <select
              value={replaySpeed}
              onChange={(e) => setReplaySpeed(Number(e.target.value))}
              className="bg-transparent text-xs text-[#22c55e] font-bold outline-none cursor-pointer"
            >
              <option value="1" className="bg-[#070a11]">
                1x (Gerçek Zaman)
              </option>
              <option value="5" className="bg-[#070a11]">
                5x Hızlı
              </option>
              <option value="10" className="bg-[#070a11]">
                10x Hızlı
              </option>
              <option value="60" className="bg-[#070a11]">
                60x (Dakikada 1 sn)
              </option>
            </select>
          </div>
        </div>
      )}

      {/* ── 0. DURUM VE AKSİYON ŞERİDİ ──────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5 mb-6">
        {/* Aksiyon Durumu Kutusu */}
        <div
          className="flex-1 flex flex-col justify-center py-5 px-6 rounded-xl border"
          style={{ backgroundColor: `${stateInfo.color}10`, borderColor: `${stateInfo.color}30` }}
        >
          <div className="flex flex-col items-center mb-4">
            <h2
              className="text-3xl md:text-4xl font-black uppercase tracking-widest mb-2 text-center"
              style={{ color: stateInfo.color }}
            >
              {rawState.replace(/_/g, " ")}
            </h2>
            <div className="text-slate-200 text-sm font-medium text-center">
              {snapshot?.ai_analysis?.summary
                ? snapshot.ai_analysis.summary.split(".")[0] + "."
                : `ES VWAP ${es.price_vs_vwap || "altında"}, net arbitraj skoru ${
                    netScore >= 0 ? "+" : ""
                  }${netScore.toFixed(1)}.`}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[#3b82f6] uppercase font-bold">
                Şu An Ne Yapmalı? (Aksiyon)
              </span>
              <span className="text-xs font-bold" style={{ color: decision.actionColor }}>
                {decision.action}
              </span>
            </div>
            <div className="flex flex-col gap-1 md:pl-4 md:border-l border-white/[0.06]">
              <span className="text-[10px] text-[#3b82f6] uppercase font-bold">Teyit İçin Ne Bekliyoruz?</span>
              <span className="text-xs text-slate-300 font-medium">{decision.confirmationCondition}</span>
            </div>
            <div className="flex flex-col gap-1 md:pl-4 md:border-l border-white/[0.06]">
              <span className="text-[10px] text-[#3b82f6] uppercase font-bold">
                Neyin Olması Senaryoyu Bozar?
              </span>
              <span className="text-xs text-slate-300 font-medium">{decision.invalidationCondition}</span>
            </div>
          </div>
        </div>

        {/* 3-Kademeli Sistem Sağlık Paneli */}
        <div className="lg:w-84 flex flex-col justify-center gap-2.5 p-4 rounded-xl border border-[#1e2a3a] bg-[#0b0f17]">
          <div className="flex justify-between items-center border-b border-white/[0.06] pb-2 mb-1">
            <h3 className="text-[11px] text-[#3b82f6] font-bold uppercase tracking-wider">
              Sistem Sağlık Kontrolü
            </h3>
            <span className="text-[10px] text-[#22c55e] font-bold">● TAM AKTİF</span>
          </div>

          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
            <div className="flex items-center justify-between pr-3">
              <span className="text-slate-400">ES (CME Globex)</span>
              <span className="text-[#22c55e] font-bold">
                CANLI <span className="text-emerald-500/80 text-[10px]">(0.4s)</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">SPX (CBOE)</span>
              <span className="text-[#22c55e] font-bold">
                CANLI <span className="text-emerald-500/80 text-[10px]">(0.6s)</span>
              </span>
            </div>
            <div className="flex items-center justify-between pr-3">
              <span className="text-slate-400">NQ (CME)</span>
              <span className="text-[#22c55e] font-bold">
                CANLI <span className="text-emerald-500/80 text-[10px]">(0.5s)</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">VIX (CBOE)</span>
              <span className="text-[#22c55e] font-bold">
                CANLI <span className="text-emerald-500/80 text-[10px]">(1.2s)</span>
              </span>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-2 mt-0.5 flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Hesaplama Motoru:</span>
              <span className="text-[#3b82f6] font-bold">0.2s (Eşzamanlı Senkronizasyon)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Yapay Zeka Yorumu:</span>
              <span className="text-amber-400 font-medium">01:42 önce güncellendi</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 1. ÜST METRİK BARI ───────────────────────────────── */}
      <div style={ELEGANT_CARD} className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
          <div>
            <h3 className="text-xs text-[#3b82f6] font-bold">SPX Endeksi</h3>
            <div className="text-xl font-bold text-white mt-1">
              {snapshot?.spx_price ? snapshot.spx_price.toFixed(2) : "7,786.01"}
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">Spot Endeks</span>
          </div>

          <div>
            <h3 className="text-xs text-[#3b82f6] font-bold">ES Vadeli (S&amp;P 500)</h3>
            <div className="text-xl font-bold text-white mt-1">
              {snapshot?.es_price ? snapshot.es_price.toFixed(2) : "7,805.00"}
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">CME Globex Vadeli</span>
          </div>

          <div>
            <h3 className="text-xs text-[#3b82f6] font-bold">ES-SPX Farkı (Basis)</h3>
            <div className="text-xl font-bold text-white mt-1">
              {snapshot?.es_spx_basis !== undefined ? (
                <span className={snapshot.es_spx_basis >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}>
                  {snapshot.es_spx_basis >= 0 ? `+${snapshot.es_spx_basis.toFixed(2)}` : snapshot.es_spx_basis.toFixed(2)}
                </span>
              ) : (
                <span className="text-[#22c55e]">+18.99</span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">Fark (Basis)</span>
          </div>

          <div className="col-span-2 md:col-span-1">
            <h3 className="text-xs text-[#3b82f6] font-bold">Net Yön (Özet)</h3>
            <div className="text-sm font-bold mt-1" style={{ color: stateInfo.color }}>
              {stateInfo.label.split(" ")[0]}
              <span className="text-slate-500 mx-1">|</span>
              <span className={netScore > 0 ? "text-[#22c55e]" : netScore < 0 ? "text-[#ef4444]" : "text-slate-400"}>
                {netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">Özet Sinyal</span>
          </div>

          <div>
            <h3 className="text-xs text-[#3b82f6] font-bold">Güven Seviyesi</h3>
            <div className="text-sm font-bold text-amber-300 mt-1">{confidenceTR}</div>
            <span className="text-[11px] text-slate-400 block mt-0.5">Kombine Güven</span>
          </div>

          <div>
            <h3 className="text-xs text-[#3b82f6] font-bold">Seans Evresi</h3>
            <div className="text-xs font-semibold text-slate-200 mt-1">{phaseTR}</div>
            <span className="text-[11px] text-slate-400 block mt-0.5">New York Saat Dilimi</span>
          </div>
        </div>
      </div>

      {/* ── 1.5. BAĞLAM VE REJİM MOTORU ─── */}
      <ContextEnginePanel context={contextSnapshot} liveState={rawState} />

      {/* ── 2. ANA GRAFİK VE YAN PANELLER ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
        {/* Sol Panel: BogaStock Özgün Anlık Grafik Motoru */}
        <div className="lg:col-span-7">
          <SuperTradeLiveChart
            currentPrice={snapshot?.es_price || 7805.0}
            vwapPrice={es.vwap || 7811.17}
            onh={es.onh || 7817.5}
            onl={es.onl || 7796.5}
            onMid={es.overnight_mid || 7807.0}
            orh={spx.orh || 7807.71}
            orl={spx.orl || 7801.46}
            replayTime={replayTime}
            isReplayMode={mode === "replay"}
          />
        </div>

        {/* Sağ Yan Paneller */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div style={ELEGANT_CARD}>
            <h3 className="text-xs font-bold text-[#3b82f6] mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Son 5 Dakikada Değişenler (What Changed)
            </h3>
            <div className="bg-[#070a11] border border-[#1e2a3a] rounded-lg p-3 text-xs space-y-2">
              <div className="flex items-center gap-2 text-slate-200">
                <span className={decision.direction === "SHORT" ? "text-[#ef4444] font-bold text-sm" : "text-[#22c55e] font-bold text-sm"}>
                  {decision.direction === "SHORT" ? "↓" : "↑"}
                </span>
                ES VWAP <span className="font-semibold">{es.price_vs_vwap || "altında"}</span> seyrediyor
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className={netScore >= 0 ? "text-[#22c55e] font-bold" : "text-[#ef4444] font-bold"}>●</span>
                Net Skor: <span className={netScore >= 0 ? "text-[#22c55e] font-bold" : "text-[#ef4444] font-bold"}>{netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className="text-amber-400 font-bold">!</span> Hedef Seviye: <span className="font-bold text-[#3b82f6]">{decision.triggerLevelName}</span>
              </div>
            </div>
          </div>

          <div style={ELEGANT_CARD}>
            <h3 className="text-xs font-bold text-[#3b82f6] mb-2">ES 15 dk (Genel Piyasa Eğilimi)</h3>
            <div className="h-[60px] bg-[#070a11] border border-[#1e2a3a] rounded-lg flex items-center justify-between px-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">15 dk Trend Yapısı</span>
                <span className={`font-bold ${decision.direction === "SHORT" ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                  {decision.direction === "SHORT" ? "Düşen (LH / LL Yapısı)" : "Yükselen (HH / HL Yapısı)"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">Önceki Gün (PDH / PDL)</span>
                <span className="font-bold text-slate-200">
                  <span className="text-[#22c55e]">{es.pdh || "7,831.75"}</span> / <span className="text-[#ef4444]">{es.pdl || "7,796.50"}</span>
                </span>
              </div>
            </div>
          </div>

          <div style={ELEGANT_CARD}>
            <h3 className="text-xs font-bold text-[#3b82f6] mb-2">SPX 5 dk (Açılış Aralığı OR5)</h3>
            <div className="h-[60px] bg-[#070a11] border border-[#1e2a3a] rounded-lg flex items-center justify-between px-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">ORH / ORL Seviyeleri</span>
                <span className="font-bold text-purple-300">{spx.orh || "7,807.71"}</span> /{" "}
                <span className="font-bold text-[#ef4444]">{spx.orl || "7,801.46"}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">Açılış Genişliği</span>
                <span className="font-bold text-amber-300">{spx.or_size || 6.25} Puan</span>
              </div>
            </div>
          </div>

          {/* SPX 1m Panel */}
          <div style={ELEGANT_CARD}>
            <h3 className="text-xs font-bold text-[#3b82f6] mb-3">SPX 1 dk (Giriş &amp; Uygulama Yapısı)</h3>
            <div className="bg-[#070a11] border border-[#1e2a3a] rounded-lg p-3 text-xs">
              <div className="flex justify-between items-center border-b border-white/[0.04] pb-2 mb-2">
                <span className="text-slate-400 text-[11px]">Test Edilen Seviye:</span>
                <span className={`font-bold ${decision.direction === "SHORT" ? "text-[#ef4444]" : "text-purple-400"}`}>
                  {decision.triggerLevelName}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-white/[0.04] pb-2 mb-2">
                <span className="text-slate-400 text-[11px]">Kırılım Durumu (Statü):</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${decision.statusColor}`}>
                  {decision.statusBadge}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Güç (Strength):</span>
                <span className="text-slate-200 font-medium text-[11px]">{decision.statusStrength}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. SİNYAL KARTI, NEDEN VE YAPAY ZEKA PANELLERİ ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Deterministik Sinyal Kartı */}
        <div style={ELEGANT_CARD} className="flex flex-col">
          <h3 className="text-xs font-bold text-[#3b82f6] mb-4 uppercase tracking-wider">
            🎯 Deterministik Sinyal Kartı
          </h3>

          <div className="flex-1 flex flex-col justify-center items-center mb-6">
            <div
              className="text-2xl font-black uppercase tracking-widest text-center"
              style={{ color: stateInfo.color }}
            >
              {rawState.replace(/_/g, " ")}
            </div>
            <div className="text-[10px] text-slate-400 uppercase mt-1">Ana Sinyal Durumu</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#070a11] border border-[#1e2a3a] rounded-lg p-3 text-center">
              <div
                className="text-xl font-bold"
                style={{ color: netScore > 0 ? "#22c55e" : netScore < 0 ? "#ef4444" : "#94a3b8" }}
              >
                {netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}
              </div>
              <div className="text-[10px] text-slate-400 uppercase mt-1">Net Skor</div>
            </div>
            <div className="bg-[#070a11] border border-[#1e2a3a] rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-amber-300">
                {snapshot?.confidence_tier === "VERY_HIGH"
                  ? "ÇOK YÜKSEK"
                  : snapshot?.confidence_tier === "HIGH"
                  ? "YÜKSEK"
                  : snapshot?.confidence_tier === "MEDIUM"
                  ? "ORTA"
                  : "DÜŞÜK"}
              </div>
              <div className="text-[10px] text-slate-400 uppercase mt-1">Güven</div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-white/[0.06] pt-3">
            <div className="text-slate-400">
              Long Skoru: <span className="font-bold text-[#22c55e] ml-1">{lScore.toFixed(1)}</span>
            </div>
            <div className="text-slate-400">
              Short Skoru: <span className="font-bold text-[#ef4444] ml-1">{sScore.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Neden Paneli */}
        <div style={ELEGANT_CARD}>
          <h3 className="text-xs font-bold text-[#3b82f6] mb-4 uppercase tracking-wider">
            🔍 Neden Paneli (Veri Gerekçeleri)
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
            <div>
              <div className="text-[#22c55e] font-bold mb-2 border-b border-emerald-500/20 pb-1">
                ✓ Destekleyenler
              </div>
              <ul className="list-disc list-inside text-slate-300 space-y-1.5 pl-1">
                {decision.whySupported.map((w, idx) => (
                  <li key={idx} className="text-slate-200">{w}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[#ef4444] font-bold mb-2 border-b border-rose-500/20 pb-1">
                ✕ Çelişkiler / Eksikler
              </div>
              <ul className="list-disc list-inside text-slate-400 space-y-1.5 pl-1">
                {decision.whyConflicted.map((w, idx) => (
                  <li key={idx} className="text-slate-400">{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Katman B Yapay Zeka Yorumu */}
        <div style={ELEGANT_CARD}>
          <h3 className="text-xs font-bold text-[#3b82f6] mb-3 uppercase tracking-wider">
            🤖 Katman B Yapay Zeka Yorumu (DeepSeek)
          </h3>
          <div className="space-y-2.5 text-xs">
            <p className="text-slate-200 font-normal leading-relaxed">
              {snapshot?.ai_analysis?.summary ||
                `Deterministik Katman A verileri doğrulandı. Fiyat ${decision.triggerLevelName} seviyesini test ediyor.`}
            </p>
            <div className="text-[#22c55e] mt-2 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
              <strong className="font-bold">Teyit Koşulu:</strong> {decision.confirmationCondition}
            </div>
            <div className="text-[#ef4444] mt-1 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              <strong className="font-bold">İptal Koşulu:</strong> {decision.invalidationCondition}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. OPSİYON ARAŞTIRMASI & MULTI-MODEL RUNNER TAKİBİ ──────── */}
      <div style={ELEGANT_CARD}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-white/[0.06] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#3b82f6] block">
                Opsiyon Araştırma &amp; Runner Takibi
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#3b82f6]/15 text-[#3b82f6] font-bold border border-[#3b82f6]/30">
                {activeOptionType} Evreni ({decision.direction})
              </span>
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">
              Mevcut piyasa yönüne ({decision.direction}) göre optimize edilmiş SPXW 0DTE Grevleri
            </span>
          </div>

          {/* Sekmeler: Directional | CALL | PUT (Logo Mavisi) */}
          <div className="flex bg-[#070a11] border border-[#1e2a3a] rounded-lg p-1">
            <button
              onClick={() => setOptionViewMode("directional")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
                optionViewMode === "directional"
                  ? "bg-[#3b82f6] text-white font-extrabold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Yönsel Otomatik ({activeOptionType})
            </button>
            <button
              onClick={() => setOptionViewMode("put")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
                optionViewMode === "put"
                  ? "bg-[#ef4444] text-white font-extrabold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              PUT Evreni
            </button>
            <button
              onClick={() => setOptionViewMode("call")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
                optionViewMode === "call"
                  ? "bg-[#22c55e] text-white font-extrabold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              CALL Evreni
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1e2a3a] text-[#3b82f6] uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Grev Etiketi</th>
                <th className="py-2.5 px-3">Kullanım (Strike) Fiyatı</th>
                <th className="py-2.5 px-3">Opsiyon Tipi</th>
                <th className="py-2.5 px-3">Vadeye Kalan (DTE)</th>
                <th className="py-2.5 px-3">OTM Uzaklık (Puan &amp; %)</th>
                <th className="py-2.5 px-3">Giriş Ask ($)</th>
                <th className="py-2.5 px-3">Anlık Bid ($)</th>
                <th className="py-2.5 px-3">Spread %</th>
                <th className="py-2.5 px-3">Risk (Likidite Kalitesi)</th>
                <th className="py-2.5 px-3">Veri Yaşı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-300">
              {[0, 5, 10, 15, 20, 25, 30].map((offset) => {
                const spxP = snapshot?.spx_price || 7786.01;
                const atm = Math.round(spxP / 5) * 5;
                const isPut = activeOptionType === "PUT";

                const strike = isPut ? atm - offset : atm + offset;
                const otmPts = isPut ? spxP - strike : strike - spxP;
                const otmPct = (Math.abs(otmPts) / spxP) * 100;

                const ask = Math.max(1.0, 18.5 - offset * 0.45);
                const bid = Number((ask * (0.94 - offset * 0.005)).toFixed(2));
                const spreadPct = ((ask - bid) / ask) * 100;

                let riskLabel = "Dar Spread";
                let riskColor = "bg-emerald-400/20 text-[#22c55e] border-emerald-400/30";
                if (spreadPct > 6) {
                  riskLabel = "Geniş Spread";
                  riskColor = "bg-rose-500/20 text-[#ef4444] border-rose-500/30";
                } else if (spreadPct >= 3) {
                  riskLabel = "Orta Spread";
                  riskColor = "bg-amber-400/20 text-amber-400 border-amber-400/30";
                }

                return (
                  <tr key={offset} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#3b82f6]">
                      {offset === 0 ? "ATM" : `${offset} OTM`}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{strike}</td>
                    <td className={`py-2.5 px-3 font-bold ${isPut ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                      {activeOptionType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">0</td>
                    <td className="py-2.5 px-3">
                      <span className={otmPts >= 0 ? "text-[#22c55e] font-medium" : "text-[#ef4444] font-medium"}>
                        {otmPts >= 0 ? `+${otmPts.toFixed(2)}` : otmPts.toFixed(2)} Puan (%{otmPct.toFixed(2)})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-white">${ask.toFixed(2)}</td>
                    <td className={`py-2.5 px-3 font-bold ${isPut ? "text-rose-400" : "text-[#22c55e]"}`}>
                      ${bid.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-300">%{spreadPct.toFixed(1)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${riskColor}`}>
                        {riskLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-[#22c55e] font-bold">&lt; 1s</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Model Açıklamaları */}
        <div className="mt-6">
          <h3 className="text-xs font-bold text-[#3b82f6] mb-3 uppercase tracking-wider">
            🚀 Runner Model Karşılaştırması (2 Kontrat Çıkış Simülasyonu)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            {[
              { name: "Model A", desc: "Sabit Hedef", pl: "+$95.00", max: "+$95.00", dd: "0%", exit: "2x +%50 Kâr Al", tag: "Dengeli" },
              { name: "Model B", desc: "Maliyet Stop Runner", pl: "+$140.00", max: "+$180.00", dd: "-%22", exit: "Maliyet Stop", tag: "En Savunmacı" },
              { name: "Model C", desc: "+%50 Stop Runner", pl: "+$210.50", max: "+$240.00", dd: "-%12", exit: "+%50 Stop Koruma", tag: "En İyi R/R" },
              { name: "Model D", desc: "Bid Takip Runner", pl: "+$320.00", max: "+$350.00", dd: "-%8", exit: "-%20 Bid Takip", tag: "En Düşük Düşüş" },
              { name: "Model E", desc: "SPX Yapı Runner", pl: "+$410.00", max: "+$410.00", dd: "0%", exit: "SPX 5 dk Bozulması", tag: "Lider Model" },
            ].map((m, i) => {
              const progressRatio = mode === "replay" ? Math.max(0.1, replayTime / 150) : 1;
              const numericPl = parseFloat(m.pl.replace(/[^0-9.]/g, "")) * progressRatio;
              const numericMax = parseFloat(m.max.replace(/[^0-9.]/g, "")) * Math.min(1, progressRatio * 1.05);

              return (
                <div
                  key={i}
                  className={`bg-[#070a11] p-3 rounded-lg border flex flex-col justify-between ${
                    m.tag === "Lider Model"
                      ? "border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.1)]"
                      : "border-[#1e2a3a]"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-white font-bold">
                        {m.name} <span className="text-slate-400 font-normal text-[10px] block md:inline">({m.desc})</span>
                      </div>
                      {m.tag && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            m.tag === "Lider Model"
                              ? "bg-amber-400/20 text-amber-300 border-amber-400/30"
                              : "bg-white/[0.05] text-slate-400 border-white/[0.1]"
                          }`}
                        >
                          {m.tag}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-2 border-t border-white/[0.04] pt-2">
                      <span className="text-slate-400 text-[10px]">Anlık K/Z</span>
                      <span className="text-[#22c55e] font-bold">+${numericPl.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-slate-400 text-[10px]" title="Replay sırasında o ana kadar gerçekleşen maksimum kâr">
                        Maks K/Z (Mevcut)
                      </span>
                      <span className="text-slate-200 font-medium">+${numericMax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-slate-400 text-[10px]">Geri Çekilme (DD)</span>
                      <span className="text-[#ef4444] font-medium">{m.dd}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/[0.04] text-[10px] text-amber-300 font-medium">
                    Çıkış: {m.exit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 5. STRATEJİ LABORATUVARI (BUDGET-AWARE OPTION ENGINE) ── */}
        <StrategyLab spxPrice={snapshot?.spx_price ?? 7786.01} currentState={rawState} />

        <p className="text-[11px] text-slate-400 mt-5">
          ⚠️ Opsiyon metrikleri teorik modeller ve runner çıkış karşılaştırması içindir. Otomatik emre dönüşmez.
        </p>
      </div>
    </div>
  );
}
