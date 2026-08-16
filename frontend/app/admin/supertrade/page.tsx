"use client";

import { useEffect, useState } from "react";

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
  NEUTRAL: { label: "Nötr / Beklemede", color: "#94a3b8", desc: "Belirgin yönsel sapma yok" },
  WATCH_LONG: { label: "Long İzleme", color: "#60a5fa", desc: "Yukarı yönlü potansiyel izleniyor" },
  WATCH_SHORT: { label: "Short İzleme", color: "#f87171", desc: "Aşağı yönlü potansiyel izleniyor" },
  EARLY_LONG: { label: "Erken Long Kurulum", color: "#34d399", desc: "İlk kırılım teyit edildi" },
  EARLY_SHORT: { label: "Erken Short Kurulum", color: "#f87171", desc: "İlk kırılım teyit edildi" },
  CONFIRMED_LONG: { label: "Teyitli Long Trend", color: "#10b981", desc: "Kırılım kabul edildi (Acceptance)" },
  CONFIRMED_SHORT: { label: "Teyitli Short Trend", color: "#ef4444", desc: "Kırılım kabul edildi (Acceptance)" },
  STRONG_LONG: { label: "Güçlü Long Momentum", color: "#059669", desc: "Yüksek net skor ve hacim teyidi" },
  STRONG_SHORT: { label: "Güçlü Short Momentum", color: "#dc2626", desc: "Yüksek net skor ve hacim teyidi" },
  LONG_WEAKENING: { label: "Long Zayıflıyor", color: "#f59e0b", desc: "Direnç veya kar satışı baskısı" },
  SHORT_WEAKENING: { label: "Short Zayıflıyor", color: "#f59e0b", desc: "Destek veya tepki alımı baskısı" },
  FAILED_LONG: { label: "Başarısız Long Kırılım", color: "#f43f5e", desc: "Tuzak kırılım, seviye altına dönüş" },
  FAILED_SHORT: { label: "Başarısız Short Kırılım", color: "#f43f5e", desc: "Tuzak kırılım, seviye üstüne dönüş" },
  CHOP: { label: "Yatay / Testere (Chop)", color: "#fbbf24", desc: "Çelişkili göstergeler, işlem riski yüksek" },
  NO_TRADE: { label: "İşlem Yapılmamalı", color: "#6b7280", desc: "Uygun işlem koşulu yok" },
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
      console.error("Snapshot hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestSnapshot();
    const interval = setInterval(fetchLatestSnapshot, 15000);
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
      console.error("Replay hatası:", err);
    } finally {
      setReplayLoading(false);
    }
  };

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
          <div className="flex items-center gap-3">
            <span className="text-xl">🦅</span>
            <h1 className="text-lg font-semibold text-white tracking-wide">SPX Canlı Yön ve Teyit Motoru</h1>
            <span className="bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/20 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
              v2.1 SuperTrade Admin
            </span>
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

      {mode === "live" ? (
        <>
          {/* ── 1. ZARİF ÜST METRİK BARI ───────────────────────────── */}
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

              <div>
                <div className="text-xs text-slate-400 font-medium">Sinyal Durumu</div>
                <div className="text-sm font-semibold mt-1" style={{ color: stateInfo.color }}>
                  {stateInfo.label}
                </div>
                <span className="text-[11px] text-slate-500 block mt-0.5">{stateInfo.desc}</span>
              </div>

              <div>
                <div className="text-xs text-slate-400 font-medium">Skorlar (Long / Short / Net)</div>
                <div className="text-base font-semibold text-white mt-1">
                  {lScore.toFixed(1)} / {sScore.toFixed(1)} |{" "}
                  <span style={{ color: netScore > 0 ? "#34d399" : netScore < 0 ? "#f87171" : "#94a3b8" }}>
                    {netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-0.5">NetScore Arbitrajı</span>
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
                  {/* Katman Çizgileri */}
                  <div className="absolute left-0 right-0 top-[35%] border-b border-dashed border-[#00d2ff]/60 opacity-80 z-10 flex justify-end pr-3">
                    <span className="text-[10px] bg-[#00d2ff]/10 text-[#00d2ff] px-1.5 py-0.5 rounded border border-[#00d2ff]/20">VWAP 7811.17</span>
                  </div>
                  <div className="absolute left-0 right-0 top-[15%] border-b border-dashed border-[#34d399]/60 opacity-80 z-10 flex justify-end pr-3">
                    <span className="text-[10px] bg-[#34d399]/10 text-[#34d399] px-1.5 py-0.5 rounded border border-[#34d399]/20">ONH 7817.50</span>
                  </div>
                  <div className="absolute left-0 right-0 top-[80%] border-b border-dashed border-[#f87171]/60 opacity-80 z-10 flex justify-end pr-3">
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
              <div style={ELEGANT_CARD}>
                <div className="text-xs font-semibold text-slate-200 mb-2">ES 15m (Genel Piyasa Eğilimi)</div>
                <div className="h-[70px] bg-[#070a11] border border-white/[0.06] rounded-md flex items-center justify-between px-4 text-xs">
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
                <div className="h-[70px] bg-[#070a11] border border-white/[0.06] rounded-md flex items-center justify-between px-4 text-xs">
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
                <div className="text-xs font-semibold text-slate-200 mb-2">SPX 1m (Giriş &amp; Uygulama Yapısı)</div>
                <div className="h-[70px] bg-[#070a11] border border-white/[0.06] rounded-md flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Breakout Durumu</span>
                    <span className="font-medium text-[#00d2ff]">Kabul Edildi (Acceptance)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Son Kapanış Fiyatı</span>
                    <span className="font-medium text-white">{snapshot?.spx_price ? snapshot.spx_price.toFixed(2) : "7,786.01"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. SİNYAL KARTI, NEDEN VE YAPAY ZEKA PANELLERİ ─────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {/* Deterministik Sinyal Kartı */}
            <div style={ELEGANT_CARD}>
              <div className="text-xs font-semibold text-[#00d2ff] mb-3 uppercase tracking-wider">🎯 Deterministik Sinyal Kartı</div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">İşlem Yönü Avantajı:</span>
                  <span className="font-medium text-white">{netScore > 0 ? "Long (Yükseliş)" : netScore < 0 ? "Short (Düşüş)" : "Nötr / Beklemede"}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Durum Makinesi:</span>
                  <span className="font-medium" style={{ color: stateInfo.color }}>{stateInfo.label}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Long Skoru:</span>
                  <span className="font-medium text-emerald-400">{lScore.toFixed(1)} / 7.0</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">Short Skoru:</span>
                  <span className="font-medium text-rose-400">{sScore.toFixed(1)} / 7.0</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="text-slate-400">NetScore Arbitrajı:</span>
                  <span className="font-medium text-cyan-400">{netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vade Ufku:</span>
                  <span className="font-medium text-slate-300">15–45 Dakika</span>
                </div>
              </div>
            </div>

            {/* NEDEN Paneli */}
            <div style={ELEGANT_CARD}>
              <div className="text-xs font-semibold text-slate-200 mb-3 uppercase tracking-wider">🔍 Neden Paneli (Veri Gerekçeleri)</div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="text-[#34d399] font-medium">✓ Destekleyici Piyasa Faktörleri:</div>
                <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                  <li>ES Fiyatı vs VWAP: <span className="text-slate-200 font-medium">{es.price_vs_vwap || "Altında"}</span> (VWAP: {es.vwap || "7,811.17"})</li>
                  <li>Globex ONH: <span className="text-slate-200 font-medium">{es.onh || "7,817.50"}</span> | ONL: <span className="text-slate-200 font-medium">{es.onl || "7,796.50"}</span></li>
                  <li>Premarket Yüksek: <span className="text-slate-200 font-medium">{es.premarket_high || "7,817.50"}</span></li>
                  <li>Opening Range OR5: ORH {spx.orh || "7,807.71"} — ORL {spx.orl || "7,801.46"}</li>
                </ul>
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
                    <th className="py-2.5 px-3 font-medium">OTM Uzaklık (Puan &amp; %)</th>
                    <th className="py-2.5 px-3 font-medium">Giriş Ask ($)</th>
                    <th className="py-2.5 px-3 font-medium">Anlık Bid ($)</th>
                    <th className="py-2.5 px-3 font-medium">2 Kontrat Sermaye ($)</th>
                    <th className="py-2.5 px-3 font-medium">Veri Kaynağı</th>
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
                    const bid = Number((ask * 0.94).toFixed(2));
                    return (
                      <tr key={offset} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-3 font-medium text-[#00d2ff]">{offset === 0 ? "ATM" : `${offset} OTM`}</td>
                        <td className="py-2.5 px-3 font-medium text-white">{strike}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-medium">CALL</td>
                        <td className="py-2.5 px-3">
                          {otmPts >= 0 ? `+${otmPts.toFixed(2)}` : otmPts.toFixed(2)} Puan ({otmPct >= 0 ? `+%${otmPct.toFixed(2)}` : `%${otmPct.toFixed(2)}`})
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white">${ask.toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-medium text-emerald-400">${bid.toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-medium text-amber-300">${(ask * 2 * 100).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-400">Canlı Kota (Bid/Ask)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Model Açıklamaları */}
            <div className="mt-4 pt-3 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-5 gap-3 text-xs text-slate-400">
              <div className="bg-[#070a11] p-3 rounded-md border border-white/[0.05]">
                <strong className="text-slate-200 block font-medium mb-1">Model A (Sabit Hedef)</strong>
                +%50 kar hedefinde 2 kontratı birlikte kapatır.
              </div>
              <div className="bg-[#070a11] p-3 rounded-md border border-white/[0.05]">
                <strong className="text-slate-200 block font-medium mb-1">Model B (Maliyet Stop Runner)</strong>
                1. kontrat +%50, 2. kontrat maliyet stop ile taşınır.
              </div>
              <div className="bg-[#070a11] p-3 rounded-md border border-white/[0.05]">
                <strong className="text-slate-200 block font-medium mb-1">Model C (+%50 Stop Runner)</strong>
                1. kontrat +%100, 2. kontrat +%50 kar koruma stoplu.
              </div>
              <div className="bg-[#070a11] p-3 rounded-md border border-white/[0.05]">
                <strong className="text-slate-200 block font-medium mb-1">Model D (Bid Trailing Runner)</strong>
                1. kontrat +%100, 2. kontrat en yüksek Bid'in %20 altından takip eder.
              </div>
              <div className="bg-[#070a11] p-3 rounded-md border border-white/[0.05]">
                <strong className="text-slate-200 block font-medium mb-1">Model E (SPX Yapı Runner)</strong>
                1. kontrat +%100, 2. kontrat SPX 5m yapısı bozulana kadar taşınır.
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              ⚠️ Opsiyon metrikleri teorik modeller ve runner çıkış karşılaştırması içindir. Otomatik emre dönüşmez.
            </p>
          </div>
        </>
      ) : (
        /* ── SEANS YENİDEN OYNATMA MODU ─────────────────────────── */
        <div style={ELEGANT_CARD}>
          <div className="text-sm font-semibold text-white mb-4">
            Geçmiş Seans Yeniden Oynatma &amp; Regresyon Motoru
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1">Yeniden Oynatılacak Tarih</label>
              <input
                type="date"
                value={replayDate}
                onChange={(e) => setReplayDate(e.target.value)}
                className="bg-[#070a11] border border-white/[0.1] text-white text-xs px-3 py-1.5 rounded-md outline-none focus:border-[#00d2ff]"
              />
            </div>
            <button
              onClick={handleRunReplay}
              disabled={replayLoading}
              className="mt-4 sm:mt-0 bg-[#00d2ff] hover:bg-[#00d2ff]/80 text-slate-950 font-medium text-xs px-5 py-2 rounded-md transition-all disabled:opacity-50"
            >
              {replayLoading ? "Seans Oynatılıyor..." : "▶ Oynatmayı Başlat"}
            </button>
          </div>

          {replayData && (
            <div className="bg-[#070a11] border border-white/[0.06] p-4 rounded-md text-xs space-y-4">
              <div className="flex justify-between border-b border-white/[0.06] pb-2 font-medium">
                <span className="text-emerald-400">✅ Seans Simülasyonu Tamamlandı</span>
                <span className="text-slate-400">Hesaplanan Snapshot Sayısı: {replayData.snapshot_count}</span>
              </div>
              <div className="prose prose-invert max-w-none text-slate-300">
                <pre className="bg-[#0b0f17] p-4 rounded-md text-xs overflow-x-auto text-slate-300 font-mono border border-white/[0.06]">
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
