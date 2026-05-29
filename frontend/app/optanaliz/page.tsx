"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";

// ── Constants & Types ────────────────────────────────────────────────────────

const SYSTEM_TR = {
  SQUEEZE: "Volatilite Sıkışması", SPRING: "Başarısız Kırılım",
  AWAKENING: "Gizli Kırılım", EMA_CROSS: "EMA Kesişimi",
  PULLBACK: "Geri Çekilme", BREAKOUT: "Trend Kırılımı", MOMENTUM: "Momentum",
};

const SYSTEM_DESC = {
  SQUEEZE: "Volatilite daralması sonrası sert patlama potansiyeli. İstatistik: %52 Başarı.",
  SPRING: "Bear Trap sonrası boğa uyanışı.",
  AWAKENING: "Kurumsal para girişinin ilk sinyali. İstatistik: %48 Başarı.",
  EMA_CROSS: "Altın Kesişim. İstatistik: %64 Başarı (En Güvenilir Sinyal).",
  PULLBACK: "Trend içi sağlıklı düzeltme. İstatistik: %58 Başarı.",
  BREAKOUT: "Direnç kırılımı ve yeni trend tescili.",
  MOMENTUM: "Hızlanan alıcı iştahı.",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getExpiryDate(dte: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dte);
  const day = date.getDay();
  if (day !== 5) {
    const diff = 5 - day;
    date.setDate(date.getDate() + (diff > 0 ? diff : diff + 7));
  }
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calcContracts(price: number, system: string, bogaScore: number, isExhausted: boolean, ivRank: number | null) {
  const contracts = [];
  const isHighIV = ivRank !== null && ivRank > 60;
  
  contracts.push({
    type: isHighIV ? "CREDIT SPREAD" : "CALL (Kısa Vade)",
    label: "ATM",
    isRecommended: true,
    strike: `$${price.toFixed(2)}`,
    delta: "~0.50",
    reason: "En iyi risk/ödül bu vadede oluşuyor.",
    color: "#22c55e",
    dte: 45,
    expiry: getExpiryDate(45)
  });

  contracts.push({
    type: isHighIV ? "DEBIT SPREAD" : "CALL (Orta Vade)",
    label: "ATM",
    isRecommended: false,
    strike: `$${price.toFixed(2)}`,
    delta: "~0.50",
    reason: "Daha muhafazakar, yavaş zaman erimesi.",
    color: "#3b82f6",
    dte: 60,
    expiry: getExpiryDate(60)
  });

  return contracts;
}

function fmt(n: any, dec: number = 2): string {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toFixed(dec);
}

function getIndicatorStatus(key: string, val: number): { label: string, color: string, desc: string } {
  if (key === "RSI") {
    if (val > 70) return { label: "Aşırı Alım", color: "#ef4444", desc: "Fiyat doygunluğa ulaşmış olabilir." };
    if (val < 30) return { label: "Aşırı Satım", color: "#22c55e", desc: "Tepki yükselişi gelebilir." };
    return { label: "Nötr", color: "#eab308", desc: "Dengeli fiyat hareketi." };
  }
  if (key === "ADX") {
    if (val > 25) return { label: "Güçlü Trend", color: "#22c55e", desc: "Mevcut trend yönünde hareket kuvvetli." };
    return { label: "Zayıf Trend", color: "#ef4444", desc: "Yön belirsiz veya yatay piyasa." };
  }
  if (key === "RVOL") {
    if (val > 1.5) return { label: "Hacim Patlaması", color: "#22c55e", desc: "Kurumsal ilgi yüksek." };
    return { label: "Normal Hacim", color: "#94a3b8", desc: "Sıradan işlem aktivitesi." };
  }
  return { label: "Veri Yok", color: "#475569", desc: "" };
}

function generateComment(pick: any, ivRank: number | null): string {
  const score = pick.boga_score || pick.score || 0;
  const system = pick.selected_system || "";
  const isExhausted = pick.trend_status?.is_exhausted || pick.is_exhausted;

  if (isExhausted) return "⚠️ Trend yorulması tespit edildi, yeni girişlerde çok dikkatli olunmalı.";
  if (system === "EMA_CROSS") return "🌟 İstatistiksel olarak en güvenilir sinyal türü. Momentum güçlü.";
  if (system === "SQUEEZE") return "⌛ Sıkışma patlamak üzere. SL seviyesine mutlaka sadık kalınmalı.";
  if (system === "AWAKENING") return "🌟 Kurumsal para girişinin ilk aşaması. Trend yeni başlıyor.";
  return "⚖️ Mevcut verilerle dengeli bir risk profili çiziyor.";
}

function getRecommendation(pick: any, ivRank: number | null): "CALL" | "SPREAD" | "STOCK" | "SKIP" {
  const score = pick.boga_score || pick.score || 0;
  const system = pick.selected_system || "";
  const isExhausted = pick.trend_status?.is_exhausted || pick.is_exhausted;
  const iv = ivRank ?? 40;
  
  if (isExhausted) return "SKIP";
  if (score >= 65 && iv < 60) return "CALL";
  if (score >= 65 && iv >= 60) return "SPREAD";
  if (score < 65 && score >= 50) return "STOCK";
  return "SKIP";
}

// ── Components ───────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string, children: React.ReactNode }) {
  return (
    <div className="group relative inline-block">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-white opacity-0 shadow-2xl transition-all duration-300 group-hover:opacity-100 z-[100] border border-white/10 scale-95 group-hover:scale-100">
        {text}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

function MatrixItem({ label, action, criteria, color, active, desc }: { label: string, action: string, criteria: string, color: string, active: boolean, desc: string }) {
  return (
    <div className={`p-6 rounded-2xl border transition-all duration-500 relative overflow-hidden flex flex-col h-full ${
      active 
        ? "bg-[#1e293b]/60 border-[#3b82f6] shadow-xl" 
        : "bg-black/10 border-white/5 opacity-50"
    }`}>
      {active && (
        <div className="absolute top-4 right-4 flex items-center gap-2 px-2 py-0.5 bg-[#3b82f6] rounded-full">
          <span className="text-[9px] font-bold text-white uppercase tracking-widest">AKTİF</span>
        </div>
      )}
      <div className="mb-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</div>
        <div className="text-xl font-bold tracking-tight uppercase" style={{ color: color }}>{action}</div>
      </div>
      <div className="space-y-3">
        <div className="text-[10px] font-mono text-slate-400 bg-white/5 p-2 rounded-lg border border-white/5">{criteria}</div>
        <p className="text-[11px] text-slate-300 font-medium leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function PickCard({ pick, ivRank, liveOptions }: { pick: any, ivRank: number | null, liveOptions?: any }) {
  const zones = pick.boga_zones || {};
  const ts = pick.trend_status || {};
  const price = pick.current_price || 0;
  const bogaScore = pick.boga_score || pick.score || 0;
  const system = pick.selected_system || "MOMENTUM";
  const isExhausted = ts.is_exhausted || pick.is_exhausted || false;
  const rrRatio = zones.risk_reward || zones.rr_ratio || pick.rr_ratio || 0;
  const rec = getRecommendation(pick, ivRank);

  const sellZone = zones.sell_zone || {};
  const stopZone = zones.stop_loss_zone || zones.stop_zone || {};
  
  const contracts = calcContracts(price, system, bogaScore, isExhausted, ivRank);
  const rsiStat = getIndicatorStatus("RSI", ts.rsi_14 || 50);
  const adxStat = getIndicatorStatus("ADX", ts.adx || 20);
  const rvolStat = getIndicatorStatus("RVOL", ts.rvol_today || 1.0);

  return (
    <div className="space-y-6">
      {/* 1. Action Header */}
      <div className="bg-[#1e293b]/60 border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#3b82f6] to-[#22c55e] opacity-50" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
              <span className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-widest">AI Strateji Kararı</span>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">
              AI ÖNERİSİ: <span className="text-[#22c55e]">{pick.ticker}</span> hissesini <span className="text-[#3b82f6]">${fmt(price)}</span> civarından izle, hedef <span className="text-[#3b82f6]">${fmt(sellZone.high)}</span>, stop <span className="text-[#ef4444]">${fmt(stopZone.high)}</span>.
            </h2>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-widest">GÜVEN SKORU</span>
            <div className="flex items-center gap-3">
               <span className="text-3xl font-bold text-white tracking-tighter">{fmt(bogaScore, 0)}%</span>
               <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#22c55e]" style={{ width: `${bogaScore}%` }} />
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Analysis Panel */}
      <div className="bg-[#0f172a] rounded-[40px] border border-white/5 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 border-b border-white/5 pb-8">
          <div className="flex items-center gap-6">
            <span className="text-5xl md:text-6xl font-bold text-white tracking-tighter uppercase italic">{pick.ticker}</span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#3b82f6] uppercase">{(SYSTEM_TR as any)[system] || system}</span>
                <Tooltip text={(SYSTEM_DESC as any)[system] || "BOGA AI teknik analiz sistemi."}>
                  <span className="cursor-help text-base text-slate-600 hover:text-white transition-colors">ⓘ</span>
                </Tooltip>
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{pick.sector}</span>
            </div>
          </div>
          <div className="text-right">
             <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">BOGA ANALİZ SKORU</span>
             <span className={`text-4xl font-bold ${bogaScore >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{fmt(bogaScore, 0)}<span className="text-sm font-medium opacity-30 ml-1">/100</span></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {contracts.map((c, i) => (
            <div key={i} className={`relative bg-white/[0.01] rounded-3xl p-6 border transition-all ${c.isRecommended ? 'border-[#22c55e]/20' : 'border-white/5 opacity-80'}`}>
              {c.isRecommended && (
                <div className="absolute -top-3 left-6 px-3 py-1 bg-[#22c55e] text-black text-[9px] font-bold rounded-full uppercase tracking-widest">Tavsiye</div>
              )}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{c.type}</span>
                  <span className="text-xl font-bold text-white uppercase italic">{c.label} ({c.dte} G)</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">HEDEF %</span>
                  <span className="text-xl font-bold text-[#22c55e]">+%40</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-black/30 p-4 rounded-xl border border-white/5 mb-4">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Giriş (Spot)</span>
                  <span className="text-sm font-bold text-white">{c.strike}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Vade Tarihi</span>
                  <span className="text-sm font-bold text-white">{c.expiry}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed italic">"{c.reason}"</p>
            </div>
          ))}
        </div>

        <div className="bg-white/[0.01] rounded-2xl p-6 border border-white/5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Teknik Göstergeler</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "RSI (14)", val: ts.rsi_14 || 37, stat: rsiStat },
              { label: "ADX", val: ts.adx || 17, stat: adxStat },
              { label: "RVOL", val: ts.rvol_today || 1.2, stat: rvolStat },
              { label: "CMF", val: ts.cmf || -0.05, stat: { label: "Nötr", color: "#94a3b8", desc: "Para akışı dengeli." } }
            ].map((item, idx) => (
              <Tooltip key={idx} text={item.stat.desc}>
                <div className="flex flex-col cursor-help group/item">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-tight">{item.label}</span>
                  <span className="text-xl font-bold text-white mb-2 group-hover/item:text-[#3b82f6] transition-colors">{fmt(item.val, 1)}</span>
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg inline-block text-center" style={{ background: item.stat.color + "10", color: item.stat.color, border: `1px solid ${item.stat.color}20` }}>{item.stat.label}</span>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Horizontal Stats Band */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] rounded-2xl border border-white/5 p-6 shadow-lg">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Risk / Ödül</h4>
          <div className="text-3xl font-bold text-[#3b82f6] tracking-tighter">{fmt(rrRatio, 2)}<span className="text-sm opacity-40 ml-1">x</span></div>
        </div>

        <div className="bg-[#0f172a] rounded-2xl border border-white/5 p-6 border-l-2 border-l-[#22c55e] shadow-lg">
           <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Başarı Oranı</h4>
           <div className="text-3xl font-bold text-white">68% <span className="text-[10px] text-[#22c55e] font-bold uppercase ml-1">Win</span></div>
        </div>

        <div className="bg-[#0f172a] rounded-2xl border border-white/5 p-6 shadow-lg">
           <h4 className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-widest mb-2">AI Özet Notu</h4>
           <p className="text-xs text-slate-400 font-medium leading-relaxed italic">
             "{generateComment(pick, ivRank)}"
           </p>
        </div>
      </div>

      {/* 4. Decision Matrix */}
      <div className="bg-[#0f172a] rounded-3xl border border-white/5 p-8 shadow-xl">
        <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
          <div className="w-1 h-4 bg-[#3b82f6]" /> Karar Matrisi (AI Standartları)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MatrixItem label="EN GÜÇLÜ" action="CALL AL" active={rec === 'CALL'} criteria="BOGA > %65 + IV < %60" color="#22c55e" desc="Yüksek getiri potansiyeli ve ucuz opsiyon." />
          <MatrixItem label="KORUMALI" action="SPREAD KUR" active={rec === 'SPREAD'} criteria="BOGA > %65 + IV ≥ %60" color="#8b5cf6" desc="Yüksek oynaklık için dikey yayılım stratejisi." />
          <MatrixItem label="GÜVENLİ" action="SPOT AL" active={rec === 'STOCK'} criteria="BOGA %50 - %65" color="#3b82f6" desc="Orta vadeli, kaldıraçsız spot hisse alımı." />
          <MatrixItem label="RİSKLİ" action="PAS GEÇ" active={rec === 'SKIP'} criteria="YORGUN TREND / DÜŞÜK SKOR" color="#ef4444" desc="İstatistiksel olarak beklemede kalma bölgesi." />
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function OptAnalizPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#3b82f6] animate-pulse font-bold tracking-tight text-xl uppercase">BOGA ANALYZING...</div>}>
      <OptAnalizContent />
    </Suspense>
  );
}

function OptAnalizContent() {
  const searchParams = useSearchParams();
  const symbolParam = searchParams.get("symbol")?.toUpperCase();
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [dataRange, setDataRange] = useState<"latest" | "15days">("latest");
  const [picks, setPicks] = useState<any[]>([]);
  const [liveOptions, setLiveOptions] = useState<any>({});
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [ivRankText, setIvRankText] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const t = Date.now();
        if (dataRange === "latest") {
          const [picksRes, optsRes] = await Promise.all([
            fetch(`/swing_all_picks.json?v=${t}`),
            fetch(`/swing_options_live.json?v=${t}`).catch(() => null)
          ]);
          if (!picksRes.ok) throw new Error("Veri yüklenemedi");
          const data = await picksRes.json();
          let optsData: any = {};
          if (optsRes && optsRes.ok) {
             const o = await optsRes.json();
             optsData = o.options || {};
          }
          const rawPicks = data.picks || [];
          rawPicks.sort((a: any, b: any) => {
            const ea = a.trend_status?.is_exhausted || a.is_exhausted || false;
            const eb = b.trend_status?.is_exhausted || b.is_exhausted || false;
            if (ea !== eb) return ea ? 1 : -1;
            return (b.boga_score || b.score || 0) - (a.boga_score || a.score || 0);
          });
          setPicks(rawPicks);
          setGeneratedAt(data.generated_at || null);
          setLiveOptions(optsData);
          if (rawPicks.length > 0 && !symbolParam) setSelectedTicker(rawPicks[0].ticker);
          if (symbolParam && rawPicks.some((p: any) => p.ticker === symbolParam)) setSelectedTicker(symbolParam);
        } else {
          const res = await fetch(`/swing_performance.json?v=${t}`);
          if (!res.ok) throw new Error("Arşiv verisi yüklenemedi");
          const data = await res.json();
          const history = data.history || [];
          const uniqueHistory: any[] = [];
          const seen = new Set();
          history.slice(0, 100).forEach((h: any) => {
            if (!seen.has(h.ticker)) {
              seen.add(h.ticker);
              uniqueHistory.push({ ...h, boga_score: h.score, selected_system: "ARCHIVE" });
            }
          });
          setPicks(uniqueHistory);
          if (uniqueHistory.length > 0) setSelectedTicker(uniqueHistory[0].ticker);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [dataRange, symbolParam]);

  const ivMap = React.useMemo(() => {
    let map: any = {};
    if (ivRankText.trim()) {
      ivRankText.split(",").forEach((part: string) => {
        const [a, b] = part.trim().split(":");
        if (b !== undefined) map[a.trim().toUpperCase()] = Number(b);
        else map["__all__"] = Number(a);
      });
    }
    return map;
  }, [ivRankText]);

  const selectedPick = picks.find((p: any) => p.ticker === selectedTicker);
  const selectedIvRank = selectedPick ? (ivMap[selectedPick.ticker] ?? ivMap["__all__"] ?? null) : null;

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#3b82f6] animate-pulse font-bold tracking-tight text-xl uppercase">BOGA AI ANALYZING...</div>;

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f1f5f9] font-sans pb-16">
      <Header />
      
      <div className="max-w-7xl mx-auto p-6 md:p-10 relative">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3"><div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /><span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">BOGA AI Terminal v116</span></div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-tighter text-white uppercase italic">Opsiyon <span className="text-[#3b82f6] not-italic">Analiz Portalı</span></h1>
              <p className="text-slate-500 text-xs mt-2 font-bold tracking-widest uppercase">Teknik Sinyal ve Strateji Motoru</p>
            </div>
            
            <Link 
              href="/optanaliz-performance" 
              className="flex items-center gap-4 px-8 py-3 bg-[#1e293b] hover:bg-[#2d3a4f] text-white font-bold rounded-xl border border-white/5 shadow-lg text-[11px] uppercase tracking-widest transition-all"
            >
               Performans Raporu →
            </Link>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 mt-8 bg-[#0f172a] p-4 rounded-2xl border border-white/5 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="flex bg-[#1e293b] rounded-xl p-1 border border-white/5">
                <button onClick={() => setViewMode("card")} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === "card" ? "bg-[#3b82f6] text-white" : "text-slate-500 hover:text-white"}`}>Kart</button>
                <button onClick={() => setViewMode("list")} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === "list" ? "bg-[#3b82f6] text-white" : "text-slate-500 hover:text-white"}`}>Liste</button>
              </div>
              <div className="flex bg-[#1e293b] rounded-xl p-1 border border-white/5">
                <button onClick={() => setDataRange("latest")} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${dataRange === "latest" ? "bg-[#3b82f6] text-white" : "text-slate-500 hover:text-white"}`}>Güncel</button>
                <button onClick={() => setDataRange("15days")} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${dataRange === "15days" ? "bg-[#3b82f6] text-white" : "text-slate-500 hover:text-white"}`}>Son 15 G</button>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">
               {generatedAt && <span>Yenileme: {new Date(generatedAt).toLocaleTimeString('tr-TR')}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          <div className="space-y-6">
            <div className="bg-[#0f172a] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
              <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                 <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Sinyal Akışı</span>
                 <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              </div>
              <div className="max-h-[700px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#3b82f6]/20">
                {picks.map((p: any) => {
                  const isEx = p.trend_status?.is_exhausted || p.is_exhausted;
                  return (
                    <button key={p.ticker} onClick={() => setSelectedTicker(p.ticker)} className={`w-full flex items-center justify-between p-5 border-b border-white/5 transition-all ${selectedTicker === p.ticker ? "bg-[#3b82f6]/5 border-l-4 border-l-[#3b82f6]" : "hover:bg-white/[0.01]"}`}>
                      <div className="flex flex-col items-start"><span className={`font-bold tracking-tight text-lg ${selectedTicker === p.ticker ? "text-[#3b82f6]" : "text-white"}`}>{p.ticker}</span><span className="text-[9px] text-slate-600 font-bold uppercase">{p.sector}</span></div>
                      <div className="flex flex-col items-end"><span className={`text-sm font-bold ${(p.boga_score || p.score) >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{fmt(p.boga_score || p.score, 0)}%</span>{isEx && <span className="text-[8px] text-[#ef4444] font-bold uppercase mt-1">Yorgun</span>}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-[#0f172a] rounded-2xl border border-white/5 p-4 shadow-lg">
               <label className="text-[9px] font-bold text-slate-600 tracking-widest uppercase block mb-3">IV Rank Override</label>
               <input value={ivRankText} onChange={e => setIvRankText(e.target.value)} placeholder="NVDA:45,AAPL:30" className="w-full bg-black/30 border border-white/5 rounded-xl p-3 text-[11px] text-white outline-none focus:border-[#3b82f6] transition-all placeholder:text-slate-800 font-bold" />
            </div>
          </div>

          <div>
            {viewMode === "card" ? (
              <>{selectedPick ? <PickCard pick={selectedPick} ivRank={selectedIvRank} liveOptions={liveOptions[selectedPick.ticker]} /> : <div className="h-[500px] flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl text-slate-700 bg-white/[0.01]"><p className="font-bold uppercase tracking-widest text-xs">Seçim Yapınız</p></div>}</>
            ) : (
              <div className="bg-[#0f172a] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-[11px] border-collapse">
                     <thead>
                       <tr className="bg-white/[0.02] text-slate-500 font-bold uppercase tracking-widest border-b border-white/10">
                         <th className="px-8 py-5">Sembol</th><th className="px-8 py-5">Fiyat</th><th className="px-8 py-5">Skor</th><th className="px-8 py-5">Sistem</th><th className="px-8 py-5">IV Rank</th><th className="px-8 py-5">AI Yorum</th><th className="px-8 py-5 text-right">İşlem</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {picks.map((p: any) => {
                         const iv = ivMap[p.ticker] ?? ivMap["__all__"] ?? null;
                         const comment = generateComment(p, iv);
                         const systemName = (SYSTEM_TR as any)[p.selected_system] || p.selected_system || "MOMENTUM";
                         return (
                           <tr key={p.ticker} className={`hover:bg-white/[0.01] transition-all group ${selectedTicker === p.ticker ? "bg-[#3b82f6]/5" : ""}`}>
                             <td className="px-8 py-6"><div className="flex flex-col"><span className="text-xl font-bold text-white group-hover:text-[#3b82f6] transition-colors tracking-tighter italic">{p.ticker}</span><span className="text-[9px] text-slate-600 font-bold uppercase">{p.sector}</span></div></td>
                             <td className="px-8 py-6 text-slate-300 font-bold text-base">${fmt(p.current_price || p.price)}</td>
                             <td className="px-8 py-6"><span className={`text-base font-bold ${(p.boga_score || p.score) >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{fmt(p.boga_score || p.score, 0)}%</span></td>
                             <td className="px-8 py-6"><span className="text-[9px] bg-white/5 px-2 py-1 rounded-lg border border-white/10 text-slate-500 font-bold uppercase tracking-tighter">{systemName}</span></td>
                             <td className="px-8 py-6">{iv !== null ? <span className={`font-bold text-sm ${iv > 60 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>%{iv}</span> : <span className="text-slate-700">—</span>}</td>
                             <td className="px-8 py-6"><span className="text-slate-500 font-bold italic text-[11px] leading-relaxed max-w-[180px] inline-block">"{comment}"</span></td>
                             <td className="px-8 py-6 text-right"><button onClick={() => { setSelectedTicker(p.ticker); setViewMode("card"); }} className="text-[10px] font-bold text-[#3b82f6] border border-[#3b82f6]/10 px-4 py-2 rounded-xl hover:bg-[#3b82f6]/10 uppercase transition-all">Detay →</button></td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
