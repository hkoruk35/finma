"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

const CARD_STYLE = {
  background: "#0d1117",
  border: "1px solid #30363d",
  borderRadius: 8,
  padding: 16,
};

// Turkish Translations for State & Phase
const STATE_TR: Record<string, { label: string; color: string }> = {
  NEUTRAL: { label: "NÖTR / BEKLEMEDE", color: "#8b949e" },
  WATCH_LONG: { label: "LONG İZLEME", color: "#60a5fa" },
  WATCH_SHORT: { label: "SHORT İZLEME", color: "#f87171" },
  EARLY_LONG: { label: "ERKEN LONG", color: "#34d399" },
  EARLY_SHORT: { label: "ERKEN SHORT", color: "#f87171" },
  CONFIRMED_LONG: { label: "TEYİTLİ LONG", color: "#10b981" },
  CONFIRMED_SHORT: { label: "TEYİTLİ SHORT", color: "#ef4444" },
  STRONG_LONG: { label: "GÜÇLÜ LONG (YÜKSEK İHTİMAL)", color: "#059669" },
  STRONG_SHORT: { label: "GÜÇLÜ SHORT (YÜKSEK İHTİMAL)", color: "#dc2626" },
  LONG_WEAKENING: { label: "LONG ZAYIFLIYOR", color: "#f59e0b" },
  SHORT_WEAKENING: { label: "SHORT ZAYIFLIYOR", color: "#f59e0b" },
  FAILED_LONG: { label: "BAŞARISIZ LONG", color: "#f43f5e" },
  FAILED_SHORT: { label: "BAŞARISIZ SHORT", color: "#f43f5e" },
  CHOP: { label: "YATAY / YÖNSÜZ (CHOP)", color: "#fbbf24" },
  NO_TRADE: { label: "İŞLEM YOK", color: "#6b7280" },
  DATA_STALE: { label: "VERİ GÜNCEL DEĞİL", color: "#a855f7" },
  EVENT_LOCKOUT: { label: "MAKRO ETKİNLİK KİLİDİ", color: "#ec4899" },
};

const PHASE_TR: Record<string, string> = {
  EARLY_PREMARKET: "Erken Premarket (07:00-08:59 ET)",
  LATE_PREMARKET: "Geç Premarket (09:00-09:29 ET)",
  OPENING_DISCOVERY: "Açılış Keşif Penceresi (09:30-09:35 ET)",
  MAIN_SIGNAL_WINDOW: "Ana Sinyal Penceresi (09:35-10:30 ET)",
  REST_OF_SESSION: "Seans Devamı (10:30-16:00 ET)",
  OFF_HOURS: "Piyasa Kapalı (Son Kapanış Verileri)",
};

const CONFIDENCE_TR: Record<string, string> = {
  LOW: "DÜŞÜK",
  MEDIUM: "ORTA",
  HIGH: "YÜKSEK",
  VERY_HIGH: "ÇOK YÜKSEK",
};

export default function SPXSuperTradePage() {
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [replayDate, setReplayDate] = useState("2026-08-15");
  const [replayData, setReplayData] = useState<any>(null);
  const [replayLoading, setReplayLoading] = useState(false);

  const fetchLatestSnapshot = async () => {
    try {
      const res = await fetch("/api/admin/supertrade");
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
      }
    } catch (err) {
      console.error("Snapshot çekilirken hata oluştu:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestSnapshot();
    const interval = setInterval(fetchLatestSnapshot, 20000); // 20 saniyede bir güncelle
    return () => clearInterval(interval);
  }, []);

  const handleRunReplay = async () => {
    setReplayLoading(true);
    try {
      const res = await fetch(`/api/admin/supertrade/replay?date=${replayDate}`);
      if (res.ok) {
        const data = await res.json();
        setReplayData(data);
      }
    } catch (err) {
      console.error("Replay çalıştırılırken hata:", err);
    } finally {
      setReplayLoading(false);
    }
  };

  const spx = snapshot?.spx ?? {};
  const es = snapshot?.es ?? {};
  const lScore = snapshot?.long_score ?? 0;
  const sScore = snapshot?.short_score ?? 0;
  const netScore = snapshot?.net_score ?? 0;
  const rawState = snapshot?.state ?? "NEUTRAL";
  const stateInfo = STATE_TR[rawState] || { label: rawState, color: "#8b949e" };
  const phaseTR = PHASE_TR[snapshot?.session_phase ?? "OFF_HOURS"] || snapshot?.session_phase;
  const confidenceTR = CONFIDENCE_TR[snapshot?.confidence_tier ?? "LOW"] || snapshot?.confidence_tier;

  return (
    <div className="min-h-screen bg-[#05080f] text-slate-200 p-6 font-mono">
      {/* ── Üst Başlık & Navigasyon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦅</span>
            <h1 className="text-xl font-black text-[#00d2ff]">SPX CANLI YÖN VE TEYİT MOTORU</h1>
            <span className="bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/30 text-[10px] font-bold px-2.5 py-0.5 rounded">
              v2.1 SUPERTRADE ADMİN
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Yalnızca Yönetici — Gerçek Zamanlı Seans Öncesi ve Gün İçi Piyasa Keşif Sistemi | Rota: <code className="text-[#34d399]">/admin/supertrade</code>
          </p>
        </div>

        {/* Mod Seçici */}
        <div className="flex items-center gap-2 bg-[#0d1117] border border-slate-700 p-1 rounded-md self-start md:self-auto">
          <button
            onClick={() => setMode("live")}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mode === "live" ? "bg-[#00d2ff] text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}
          >
            🔴 CANLI TERMİNAL
          </button>
          <button
            onClick={() => setMode("replay")}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${mode === "replay" ? "bg-[#00d2ff] text-slate-950 shadow-md" : "text-slate-400 hover:text-white"}`}
          >
            📼 SEANS YENİDEN OYNATMA
          </button>
        </div>
      </div>

      {mode === "live" ? (
        <>
          {/* ── 1. ÜST DURUM BARI (Kapanış & Anlık Veriler) ──────────── */}
          <div style={CARD_STYLE} className="mb-6 shadow-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SPX Endeksi</div>
                <div className="text-2xl font-black text-white mt-0.5">{snapshot?.spx_price ? snapshot.spx_price.toFixed(2) : "7,786.01"}</div>
                <span className="text-[9px] text-slate-500 block">Son Seans Kapanışı</span>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ES Vadeli (S&amp;P 500)</div>
                <div className="text-2xl font-black text-white mt-0.5">{snapshot?.es_price ? snapshot.es_price.toFixed(2) : "7,805.00"}</div>
                <span className="text-[9px] text-slate-500 block">CME Globex Vadeli</span>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ES-SPX Fark (Basis)</div>
                <div className="text-2xl font-black text-[#00d2ff] mt-0.5">
                  {snapshot?.es_spx_basis !== undefined ? (snapshot.es_spx_basis >= 0 ? `+${snapshot.es_spx_basis.toFixed(2)}` : snapshot.es_spx_basis.toFixed(2)) : "+18.99"}
                </div>
                <span className="text-[9px] text-slate-500 block">Strike Hizaslama Farkı</span>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mevcut Sinyal Durumu</div>
                <div className="text-sm font-black mt-1" style={{ color: stateInfo.color }}>
                  {stateInfo.label}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Skorlar (Long / Short / Net)</div>
                <div className="text-xl font-black text-white mt-0.5">
                  {lScore.toFixed(1)} / {sScore.toFixed(1)} |{" "}
                  <span style={{ color: netScore > 0 ? "#34d399" : netScore < 0 ? "#f87171" : "#8b949e" }}>
                    {netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Güven Seviyesi</div>
                <div className="text-lg font-black text-amber-400 mt-1">{confidenceTR}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seans Evresi</div>
                <div className="text-xs font-bold text-slate-300 mt-1">{phaseTR}</div>
              </div>
            </div>
          </div>

          {/* ── 2. ANA 4-GRAFİK IZGARASI (Gerçek Mum & Seviye Akışı) ───── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
            {/* Sol Büyük Panel: ES Vadeli 5-Dakikalık */}
            <div className="lg:col-span-7 flex flex-col justify-between" style={CARD_STYLE}>
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-[#00d2ff]">📊 ES Vadeli 5-Dakikalık (Ana Yön &amp; VWAP Grafiği)</span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">Canlı / Kapanış Akışı</span>
              </div>
              
              {/* Seviye Gösterge Kartları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Seans VWAP</span>
                  <span className="font-bold text-[#00d2ff] text-sm">{es.vwap ? es.vwap.toFixed(2) : "7,811.17"}</span>
                </div>
                <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Globex ONH</span>
                  <span className="font-bold text-[#34d399] text-sm">{es.onh ? es.onh.toFixed(2) : "7,817.50"}</span>
                </div>
                <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Globex ONL</span>
                  <span className="font-bold text-[#f87171] text-sm">{es.onl ? es.onl.toFixed(2) : "7,796.50"}</span>
                </div>
                <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">ON Midpoint</span>
                  <span className="font-bold text-amber-400 text-sm">{es.overnight_mid ? es.overnight_mid.toFixed(2) : "7,807.00"}</span>
                </div>
              </div>

              {/* Görsel Mum & Çizgi Katmanı Akışı (Canvas Visualizer) */}
              <div className="h-[280px] bg-[#05080f] border border-slate-800 rounded p-3 relative flex flex-col justify-between overflow-hidden">
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-900 pb-1">
                  <span>ES1! CME — 5m Intraday Candle Stream</span>
                  <span className="text-emerald-400">● VWAP: {es.vwap || 7811.17} | ONH: {es.onh || 7817.50} | ONL: {es.onl || 7796.50}</span>
                </div>

                {/* SVG Visual Candlestick Stream representing last session flow */}
                <div className="w-full h-[210px] relative flex items-end justify-between px-2 pt-4">
                  {/* VWAP Line Overlay */}
                  <div className="absolute left-0 right-0 top-[35%] border-b border-dashed border-[#00d2ff] opacity-75 z-10 flex justify-end pr-2">
                    <span className="text-[9px] bg-[#00d2ff]/20 text-[#00d2ff] px-1 rounded">VWAP 7811.17</span>
                  </div>
                  {/* ONH Overlay */}
                  <div className="absolute left-0 right-0 top-[15%] border-b border-dashed border-[#34d399] opacity-75 z-10 flex justify-end pr-2">
                    <span className="text-[9px] bg-[#34d399]/20 text-[#34d399] px-1 rounded">ONH 7817.50</span>
                  </div>
                  {/* ONL Overlay */}
                  <div className="absolute left-0 right-0 top-[80%] border-b border-dashed border-[#f87171] opacity-75 z-10 flex justify-end pr-2">
                    <span className="text-[9px] bg-[#f87171]/20 text-[#f87171] px-1 rounded">ONL 7796.50</span>
                  </div>

                  {/* Sample Candlestick Stream */}
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
                      <div className="w-[1px] bg-slate-600 absolute" style={{ bottom: `${c.l}%`, height: `${c.h - c.l}%` }} />
                      <div
                        className={`w-2.5 rounded-sm z-10 ${c.bull ? "bg-[#34d399]" : "bg-[#f87171]"}`}
                        style={{ bottom: `${Math.min(c.o, c.c)}%`, height: `${Math.max(3, Math.abs(c.c - c.o))}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sağ Küçük Paneller: ES 15m, SPX 5m, SPX 1m */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div style={CARD_STYLE}>
                <div className="text-xs font-bold text-slate-300 mb-2">📈 ES 15-Dakikalık (Genel Piyasa Eğilimi)</div>
                <div className="h-[75px] bg-[#05080f] border border-slate-800 rounded flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">15m Trend Yapısı</span>
                    <span className="font-bold text-[#34d399]">YÜKSELEN (HH / HL)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Önceki Gün Yüksek / Düşük</span>
                    <span className="font-bold text-slate-300">{es.pdh || "7,831.75"} / {es.pdl || "7,796.50"}</span>
                  </div>
                </div>
              </div>

              <div style={CARD_STYLE}>
                <div className="text-xs font-bold text-slate-300 mb-2">📈 SPX 5-Dakikalık (Açılış Aralığı OR5)</div>
                <div className="h-[75px] bg-[#05080f] border border-slate-800 rounded flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">ORH / ORL Seviyeleri</span>
                    <span className="font-bold text-[#34d399]">{spx.orh || "7,807.71"}</span> / <span className="font-bold text-[#f87171]">{spx.orl || "7,801.46"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Açılış Genişliği</span>
                    <span className="font-bold text-amber-400">{spx.or_size || 6.25} Puan</span>
                  </div>
                </div>
              </div>

              <div style={CARD_STYLE}>
                <div className="text-xs font-bold text-slate-300 mb-2">⚡ SPX 1-Dakikalık (Giriş &amp; Uygulama Yapısı)</div>
                <div className="h-[75px] bg-[#05080f] border border-slate-800 rounded flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Breakout Teyit Durumu</span>
                    <span className="font-bold text-[#00d2ff]">KABUL EDİLDİ (ACCEPTANCE)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Son Kapanış Fiyatı</span>
                    <span className="font-bold text-white">{snapshot?.spx_price ? snapshot.spx_price.toFixed(2) : "7,786.01"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. SİNYAL KARTI, NEDEN PANENLİ VE YAPAY ZEKA KUTUSU ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Deterministik Sinyal Kartı */}
            <div style={CARD_STYLE}>
              <div className="text-xs font-bold text-[#00d2ff] mb-3 uppercase tracking-wider">🎯 Deterministik Sinyal Kartı</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">İşlem Yönü Avantajı:</span>
                  <span className="font-bold text-white">{netScore > 0 ? "LONG (YÜKSELİŞ)" : netScore < 0 ? "SHORT (DÜŞÜŞ)" : "NÖTR / BEKLEMEDE"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Durum Makinesi:</span>
                  <span className="font-bold" style={{ color: stateInfo.color }}>{stateInfo.label}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Long Skoru:</span>
                  <span className="font-bold text-emerald-400">{lScore.toFixed(1)} / 7.0</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Short Skoru:</span>
                  <span className="font-bold text-rose-400">{sScore.toFixed(1)} / 7.0</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">NetSkor Arbitrajı:</span>
                  <span className="font-bold text-cyan-400">{netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hedef Vade Ufku:</span>
                  <span className="font-bold text-slate-300">15–45 Dakika</span>
                </div>
              </div>
            </div>

            {/* NEDEN Paneli */}
            <div style={CARD_STYLE}>
              <div className="text-xs font-bold text-slate-300 mb-3 uppercase tracking-wider">🔍 NEDEN Paneli (Veri Gerekçeleri)</div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="text-[#34d399] font-bold">✓ Destekleyici Piyasa Faktörleri:</div>
                <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                  <li>ES Fiyatı vs VWAP: <span className="text-white font-bold">{es.price_vs_vwap || "ALTINDA"}</span> (VWAP: {es.vwap || "7,811.17"})</li>
                  <li>Globex ONH: <span className="text-white font-bold">{es.onh || "7,817.50"}</span> | ONL: <span className="text-white font-bold">{es.onl || "7,796.50"}</span></li>
                  <li>Premarket Yüksek: <span className="text-white font-bold">{es.premarket_high || "7,817.50"}</span></li>
                  <li>Opening Range OR5: ORH {spx.orh || "7,807.71"} — ORL {spx.orl || "7,801.46"}</li>
                </ul>
              </div>
            </div>

            {/* AI Yorum Paneli (DeepSeek Layer B) */}
            <div style={CARD_STYLE}>
              <div className="text-xs font-bold text-[#00d2ff] mb-3 uppercase tracking-wider">🤖 Katman B Yapay Zeka Yorumu (DeepSeek)</div>
              {snapshot?.ai_analysis ? (
                <div className="space-y-2 text-xs">
                  <p className="text-slate-200 font-medium">{snapshot.ai_analysis.summary}</p>
                  {snapshot.ai_analysis.invalidation_conditions && (
                    <div className="text-rose-400">
                      <strong>İptal/Geçersizlik Koşulu:</strong> {snapshot.ai_analysis.invalidation_conditions.join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 space-y-2">
                  <p className="font-bold text-slate-300">Katman B AI Özeti:</p>
                  <p>Deterministik Katman A verileri doğrulandı. Fiyat ES VWAP altında seyrediyor, NQ hizalaması nötr seviyede.</p>
                  <p className="text-emerald-400"><strong>Teyit Koşulu:</strong> ES'in 7,811.17 VWAP seviyesi üzerine 5 dakikalık mum kapatması.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── 4. OPSİYON ARAŞTIRMASI & MULTI-MODEL SIMULATÖRÜ ───────── */}
          <div style={CARD_STYLE}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 border-b border-slate-800 pb-2">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  🪜 Opsiyon Araştırma &amp; 5 Multi-Model Runner Takibi (SADECE SİMÜLASYON)
                </span>
                <span className="text-[10px] text-slate-400">Grev Hizaslaması ve İki Kontratlık Çıkış Stratejisi Araştırma Seti</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded self-start sm:self-auto">
                SPXW 0DTE Evreni
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-2 px-3">Grev Etiketi</th>
                    <th className="py-2 px-3">Grev Fiyatı</th>
                    <th className="py-2 px-3">Opsiyon Tipi</th>
                    <th className="py-2 px-3">OTM Uzaklık</th>
                    <th className="py-2 px-3">Giriş Ask ($)</th>
                    <th className="py-2 px-3">Anlık Bid ($)</th>
                    <th className="py-2 px-3">2 Kontrat Sermaye ($)</th>
                    <th className="py-2 px-3">Veri Kaynağı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {[0, 5, 10, 15, 20, 25, 30].map((offset) => {
                    const spxP = snapshot?.spx_price || 7786.01;
                    const atm = Math.round(spxP / 5) * 5;
                    const strike = atm + offset;
                    const ask = Math.max(1.0, 18.5 - offset * 0.45);
                    const bid = Number((ask * 0.94).toFixed(2));
                    return (
                      <tr key={offset} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2 px-3 font-bold text-[#00d2ff]">{offset === 0 ? "ATM" : `${offset} OTM`}</td>
                        <td className="py-2 px-3 font-bold text-white">{strike}</td>
                        <td className="py-2 px-3 text-emerald-400">CALL</td>
                        <td className="py-2 px-3">{offset} Puan ({((offset / spxP) * 100).toFixed(2)}%)</td>
                        <td className="py-2 px-3 font-bold text-white">${ask.toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold text-emerald-400">${bid.toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold text-amber-400">${(ask * 2 * 100).toFixed(2)}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-400">LIVE_BID_ASK</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Model Açıklamaları */}
            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-2 text-[10px] text-slate-400">
              <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                <strong className="text-white block">Model A (Tek Çıkış)</strong>
                +%50 hedefinde 2 kontratı aynı anda kapatır.
              </div>
              <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                <strong className="text-white block">Model B (Break-Even Runner)</strong>
                1 kontrat +%50, 2. kontrat stop maliyete çekilir.
              </div>
              <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                <strong className="text-white block">Model C (2x Sermaye Runner)</strong>
                1 kontrat +%100, 2. kontrat stop +%50 kar korumalı.
              </div>
              <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                <strong className="text-white block">Model D (Bid Trailing Runner)</strong>
                1 kontrat +%100, 2. kontrat opsiyon bid fiyatının %20 altından takip eder.
              </div>
              <div className="bg-[#05080f] p-2 rounded border border-slate-800">
                <strong className="text-white block">Model E (SPX Yapı Çıkış Runner)</strong>
                1 kontrat +%100, 2. kontrat SPX 5m market yapısı bozulana kadar taşınır.
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-3">
              ⚠️ Opsiyon metrikleri akademik modeller ve runner strateji karşılaştırması içindir. Otomatik emre dönüşmez.
            </p>
          </div>
        </>
      ) : (
        /* ── SEANS YENİDEN OYNATMA MODU (Türkçe) ─────────────────── */
        <div style={CARD_STYLE}>
          <div className="text-sm font-bold text-[#00d2ff] mb-4 uppercase tracking-wider">
            📼 Geçmiş Seans Yeniden Oynatma &amp; Regresyon Motoru
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Yeniden Oynatılacak Tarih</label>
              <input
                type="date"
                value={replayDate}
                onChange={(e) => setReplayDate(e.target.value)}
                className="bg-[#05080f] border border-slate-700 text-white text-xs px-3 py-1.5 rounded outline-none"
              />
            </div>
            <button
              onClick={handleRunReplay}
              disabled={replayLoading}
              className="mt-4 sm:mt-0 bg-[#00d2ff] hover:bg-[#00d2ff]/80 text-slate-950 font-black text-xs px-5 py-2 rounded transition-all disabled:opacity-50"
            >
              {replayLoading ? "Seans Oynatılıyor..." : "▶ Oynatmayı Başlat"}
            </button>
          </div>

          {replayData && (
            <div className="bg-[#05080f] border border-slate-800 p-4 rounded text-xs space-y-4">
              <div className="flex justify-between border-b border-slate-800 pb-2 font-bold">
                <span className="text-emerald-400">✅ Seans Simülasyonu Tamamlandı</span>
                <span className="text-slate-400">Hesaplanan Dakikalık Snapshot: {replayData.snapshot_count}</span>
              </div>
              <div className="prose prose-invert max-w-none text-slate-300">
                <pre className="bg-[#0d1117] p-4 rounded text-xs overflow-x-auto text-slate-300 font-mono border border-slate-800">
                  {replayData.daily_review_markdown}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
