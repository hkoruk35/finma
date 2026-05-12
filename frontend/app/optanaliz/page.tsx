"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";

// ── Helpers (User Provided Logic) ─────────────────────────────────────────────

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
    strike: `$${price.toFixed(2)}`,
    delta: "~0.50",
    reason: "Spot fiyata en duyarlı, 45 günlük taşıma süresi",
    color: "#22c55e",
    dte: 45,
    expiry: getExpiryDate(45)
  });

  contracts.push({
    type: isHighIV ? "DEBIT SPREAD" : "CALL (Orta Vade)",
    label: "ATM",
    strike: `$${price.toFixed(2)}`,
    delta: "~0.50",
    reason: "Zaman erimesi (Theta) daha yavaş, daha güvenli",
    color: "#3b82f6",
    dte: 60,
    expiry: getExpiryDate(60)
  });

  return contracts;
}

function calcExitPlan(bogaScore: number, holdDays: number): { tp: number, sl: number, timeExit: number } {
  const tp = bogaScore >= 75 ? 50 : 40;
  const sl = bogaScore >= 75 ? -35 : -30;
  return { tp, sl, timeExit: holdDays };
}

function fmt(n: any, dec: number = 2): string {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toFixed(dec);
}

function riskBadge(rr: number): { label: string, color: string } {
  if (rr >= 3.0) return { label: "S Elite", color: "#22c55e" };
  if (rr >= 2.5) return { label: "A+ Premium", color: "#84cc16" };
  if (rr >= 2.0) return { label: "A Strong", color: "#eab308" };
  if (rr >= 1.5) return { label: "B Medium", color: "#f97316" };
  return { label: "C Weak", color: "#ef4444" };
}

const SYSTEM_COLORS = {
  SQUEEZE: "#a78bfa", SPRING: "#f97316", AWAKENING: "#14b8a6",
  EMA_CROSS: "#3b82f6", PULLBACK: "#22c55e", BREAKOUT: "#ef4444", MOMENTUM: "#94a3b8",
};

const SYSTEM_TR = {
  SQUEEZE: "Volatilite Sıkışması", SPRING: "Başarısız Kırılım",
  AWAKENING: "Gizli Kırılım", EMA_CROSS: "EMA Kesişimi",
  PULLBACK: "Geri Çekilme", BREAKOUT: "Trend Kırılımı", MOMENTUM: "Momentum",
};

function generateComment(pick: any, ivRank: number | null): string {
  const score = pick.boga_score || pick.score || 0;
  const system = pick.selected_system || "";
  const isExhausted = pick.trend_status?.is_exhausted || pick.is_exhausted;
  const rr = pick.boga_zones?.risk_reward || pick.rr_ratio || 0;

  if (isExhausted) return "⚠️ Trend yorulması, yeni giriş riskli.";
  if (score >= 85 && ivRank !== null && ivRank < 30) return "🚀 Yüksek Skor + Ucuz Opsiyon: Güçlü Fırsat!";
  if (score >= 80 && rr >= 3.0) return "🎯 Harika Risk/Ödül Oranı.";
  if (system === "BREAKOUT" && score >= 75) return "⚡ Trend Kırılımı + Momentum desteği.";
  if (system === "SQUEEZE") return "⌛ Volatilite sıkışması: Patlama yakın olabilir.";
  if (ivRank !== null && ivRank > 70) return "💎 Yüksek IV: Spread stratejileri daha uygun.";
  if (score >= 70) return "📈 Pozitif trend eğilimi devam ediyor.";
  return "⚖️ Dengeli risk profili, izlemede kalın.";
}

function getRecommendation(pick: any, ivRank: number | null): "CALL" | "SPREAD" | "STOCK" | "SKIP" {
  const score = pick.boga_score || pick.score || 0;
  const rr = pick.boga_zones?.risk_reward || pick.rr_ratio || 0;
  const isExhausted = pick.trend_status?.is_exhausted || pick.is_exhausted;
  const iv = ivRank ?? 40; 

  if (isExhausted) return "SKIP";
  if (score >= 60 && rr >= 2.2) {
    if (iv < 60) return "CALL";
    return "SPREAD";
  }
  if (score < 60 || rr < 2.0) return "STOCK";
  return "SKIP";
}

// ── Sub-Components ────────────────────────────────────────────────────────────

function Row({ label, value, accent }: { label: string, value: React.ReactNode, accent?: string }) {
  return (
    <div className="flex justify-between items-center mb-1">
      <span className="text-[11px] text-[#475569]">{label}</span>
      <span className={`text-[12px] font-semibold ${accent ? "" : "text-[#f1f5f9]"}`} style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}

function Chip({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold border"
      style={{
        background: color + "18",
        color: color,
        borderColor: color + "33"
      }}>
      {label ? `${label}: ${value}` : value}
    </span>
  );
}

function MatrixItem({ label, criteria, color, active, desc }: { label: string, criteria: string, color: string, active: boolean, desc: string }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden ${
      active 
        ? "bg-white/[0.03] border-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-[#3b82f6]/50" 
        : "bg-black/20 border-white/5 opacity-50"
    }`}>
      {active && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-ping" />
          <span className="text-[8px] font-black text-[#3b82f6] uppercase tracking-widest">Sistem Önerisi</span>
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="text-[11px] font-black tracking-widest" style={{ color: color }}>{label}</div>
        <div className="text-[9px] font-mono text-slate-500">{criteria}</div>
      </div>
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{desc}</p>
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
  const holdDays = pick.hold_days || 7;
  const rrRatio = zones.risk_reward || zones.rr_ratio || pick.rr_ratio || 0;
  const beta = pick.beta || 1.0;
  const rsi = ts.rsi_14 || pick.rsi || 50;
  const rvol = ts.rvol_today || pick.rvol || 1.0;
  const rec = getRecommendation(pick, ivRank);

  const contracts = calcContracts(price, system, bogaScore, isExhausted, ivRank);
  const exit = calcExitPlan(bogaScore, holdDays);
  const rb = riskBadge(rrRatio);
  const sysCol = (SYSTEM_COLORS as any)[system] || "#94a3b8";
  
  const buyZone = zones.buying_zone || zones.buy_zone || {};
  const sellZone = zones.sell_zone || {};
  const stopZone = zones.stop_loss_zone || zones.stop_zone || {};
  const atrPct = ((zones.atr_pct || 0) * 100).toFixed(1);
  const mainColor = isExhausted ? "#ef4444" : (bogaScore >= 60 ? "#22c55e" : "#f59e0b");

  return (
    <div className="glass-card border-2 border-[#1e293b] rounded-3xl overflow-hidden shadow-2xl relative">
      <div className={`px-8 py-4 border-b flex items-center justify-between transition-all ${
        rec === 'CALL' ? 'bg-[#22c55e]/20 border-[#22c55e]/30' : 
        rec === 'SPREAD' ? 'bg-[#8b5cf6]/20 border-[#8b5cf6]/30' : 
        rec === 'STOCK' ? 'bg-[#3b82f6]/20 border-[#3b82f6]/30' : 
        'bg-[#ef4444]/20 border-[#ef4444]/30'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full animate-pulse ${
            rec === 'CALL' ? 'bg-[#22c55e]' : 
            rec === 'SPREAD' ? 'bg-[#8b5cf6]' : 
            rec === 'STOCK' ? 'bg-[#3b82f6]' : 
            'bg-[#ef4444]'
          }`} />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white">BOGA AI Karar Motoru v2.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase italic">Tavsiye Edilen Strateji:</span>
          <span className={`text-sm font-black px-4 py-1 rounded-full border-2 ${
             rec === 'CALL' ? 'text-[#22c55e] border-[#22c55e] bg-[#22c55e]/10' : 
             rec === 'SPREAD' ? 'text-[#a78bfa] border-[#a78bfa] bg-[#a78bfa]/10' : 
             rec === 'STOCK' ? 'text-[#60a5fa] border-[#60a5fa] bg-[#60a5fa]/10' : 
             'text-[#f87171] border-[#f87171] bg-[#f87171]/10'
          }`}>
             {rec === 'CALL' ? '🔥 LONG CALL' : rec === 'SPREAD' ? '🛡️ BULL SPREAD' : rec === 'STOCK' ? '📈 HİSSE (LEVERAGE YOK)' : '⚠️ BEKLE / GEÇ'}
          </span>
        </div>
      </div>

      <div className="p-8">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-4xl font-black text-[#f1f5f9] tracking-tighter uppercase italic">
            {pick.ticker}
          </span>
          <span className="text-[11px] font-black px-3 py-1 rounded border uppercase tracking-widest"
            style={{ background: sysCol + "22", color: sysCol, borderColor: sysCol + "44" }}>
            {system} · {(SYSTEM_TR as any)[system] || system}
          </span>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">BOGA Score</span>
              <span className="text-xs font-black" style={{ color: bogaScore >= 75 ? "#22c55e" : bogaScore >= 60 ? "#eab308" : "#ef4444" }}>
                {fmt(bogaScore, 0)}/100
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full transition-all duration-1000"
                style={{ width: `${bogaScore}%`, background: bogaScore >= 75 ? "#22c55e" : bogaScore >= 60 ? "#eab308" : "#ef4444" }} />
            </div>
          </div>
          <div className="px-4 py-2 rounded-2xl border flex flex-col items-center justify-center min-w-[100px]"
            style={{ background: rb.color + "15", borderColor: rb.color + "30" }}>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Confidence</span>
            <span className="text-xs font-black" style={{ color: rb.color }}>{rb.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {contracts.map((c, i) => {
            const liveOpt = liveOptions ? (c.dte === 45 ? liveOptions.dte_45 : (c.dte === 60 ? liveOptions.dte_60 : null)) : null;
            const displayStrike = liveOpt ? `$${fmt(liveOpt.strike)}` : c.strike;
            return (
              <div key={i} className="bg-[#111827] rounded-3xl p-6 border border-white/5 hover:border-[#3b82f6]/30 transition-all group">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[11px] font-black px-3 py-1 rounded bg-white/5 border border-white/10 uppercase tracking-widest text-white group-hover:text-[#3b82f6] transition-colors">{c.type}</span>
                  <span className="text-xs font-black text-slate-500 uppercase">{c.label} ({c.dte} Gün)</span>
                </div>
                
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Strike</span>
                    <span className="text-3xl font-black text-white tracking-tighter">{displayStrike}</span>
                  </div>
                  <div className="text-right">
                    {liveOpt ? (
                      <>
                        <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Ask Price</span>
                        <span className="text-2xl font-black text-[#22c55e]">${fmt(liveOpt.ask)}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Est. Delta</span>
                        <span className="text-xl font-black text-white">{c.delta}</span>
                      </>
                    )}
                  </div>
                </div>
                
                {liveOpt && (
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-4 bg-black/20 p-2 rounded-xl">
                    <span>Bid: ${fmt(liveOpt.bid)}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>Last: ${fmt(liveOpt.lastPrice)}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-800" />
                    <span>Vol: {liveOpt.volume}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center bg-black/40 rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Vade Sonu:</span>
                  <span className="text-[11px] text-white font-black">{liveOpt ? liveOpt.expiry : c.expiry}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-black/30 rounded-3xl p-5 border border-white/5">
            <h4 className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest mb-4">Bot Bölgeleri</h4>
            <div className="space-y-2">
              <Row label="Mevcut Fiyat" value={`$${fmt(price)}`} accent="#f1f5f9" />
              <Row label="Giriş Bölgesi" value={`$${fmt(buyZone.low)} – $${fmt(buyZone.high)}`} accent="#22c55e" />
              <Row label="Kâr Hedefi" value={`$${fmt(sellZone.high)}`} accent="#3b82f6" />
              <Row label="Stop Loss" value={`$${fmt(stopZone.high)}`} accent="#ef4444" />
              <Row label="Risk/Ödül" value={`${fmt(rrRatio, 1)}:1`} accent={rb.color} />
              <Row label="ATR %" value={`${atrPct}%`} accent="#94a3b8" />
            </div>
          </div>

          <div className="bg-black/30 rounded-3xl p-5 border border-white/5">
            <h4 className="text-[10px] font-black text-[#8b5cf6] uppercase tracking-widest mb-4">Strateji Planı</h4>
            <div className="space-y-2">
              <Row label="Opsiyon Kâr Hedefi" value={`+%${exit.tp}`} accent="#22c55e" />
              <Row label="Opsiyon Stop Loss" value={`${exit.sl}%`} accent="#ef4444" />
              <Row label="Zaman Stopu" value={`${exit.timeExit}. gün`} accent="#f59e0b" />
              <Row label="Beta Katsayısı" value={fmt(beta, 2)} accent="#94a3b8" />
              {ivRank !== null && <Row label="Mevcut IV Rank" value={`%${ivRank}`} accent={ivRank > 60 ? "#ef4444" : "#22c55e"} />}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip label="RSI" value={fmt(rsi, 0)} color={rsi > 68 ? "#ef4444" : rsi >= 45 ? "#22c55e" : "#f59e0b"} />
          <Chip label="RVOL" value={`${fmt(rvol, 1)}x`} color={rvol >= 1.5 ? "#22c55e" : "#94a3b8"} />
          {ts.adx != null && <Chip label="ADX" value={fmt(ts.adx, 0)} color={ts.adx >= 25 ? "#22c55e" : "#94a3b8"} />}
          {ts.cmf != null && <Chip label="CMF" value={fmt(ts.cmf, 2)} color={ts.cmf > 0.05 ? "#22c55e" : "#ef4444"} />}
          {ts.macd_hist != null && <Chip label="MACD" value={ts.macd_hist > 0 ? "+" : "−"} color={ts.macd_hist > 0 ? "#22c55e" : "#ef4444"} />}
        </div>
      </div>

      <div className="p-8 border-t border-white/5 bg-black/20">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <div className="w-1 h-3 bg-[#3b82f6]" /> Analiz Karar Matrisi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MatrixItem 
            label="CALL AL" 
            active={rec === 'CALL'}
            criteria="BOGA ≥ 60, R/R ≥ 2.2, IV Rank < %60" 
            color="#22c55e"
            desc="Yüksek skor ve düşük maliyetli opsiyon. Doğrudan yükseliş beklentisi."
          />
          <MatrixItem 
            label="SPREAD" 
            active={rec === 'SPREAD'}
            criteria="BOGA ≥ 60, R/R ≥ 2.2, IV Rank ≥ %60" 
            color="#8b5cf6"
            desc="Volatilite yüksek, maliyeti düşürmek için dikey yayılım stratejisi."
          />
          <MatrixItem 
            label="HİSSE AL" 
            active={rec === 'STOCK'}
            criteria="BOGA < 60 veya R/R < 2.2" 
            color="#3b82f6"
            desc="Daha düşük risk, kaldıraçsız spot yatırım. Uzun vadeli toplama bölgesi."
          />
          <MatrixItem 
            label="GEÇ / BEKLE" 
            active={rec === 'SKIP'}
            criteria="Trend yorulması (is_exhausted=true)" 
            color="#ef4444"
            desc="Riskler yüksek, teknik veriler yeni bir sinyal üretene kadar beklenmeli."
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function OptAnalizPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#22c55e]">
        <div className="animate-pulse font-mono tracking-widest text-xl">LOADING BOGA AI...</div>
      </div>
    }>
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
          if (rawPicks.length > 0 && !symbolParam) {
            setSelectedTicker(rawPicks[0].ticker);
          }
          if (symbolParam && rawPicks.some((p: any) => p.ticker === symbolParam)) {
            setSelectedTicker(symbolParam);
          }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#22c55e]">
        <div className="animate-pulse font-mono tracking-widest text-xl">BOGA AI ANALYZING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f1f5f9] font-mono">
      <Header />
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" />
            <span className="text-[10px] text-[#22c55e] font-bold tracking-[0.2em] uppercase">Opsiyon Danışmanı v116</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Opsiyon Analiz Portalı</h1>
          <div className="flex items-center justify-between flex-wrap gap-4 mt-1">
            <div className="flex items-center gap-4">
              <div className="flex bg-[#0f172a] rounded-lg border border-[#1e293b] p-1">
                <button onClick={() => setViewMode("card")} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${viewMode === "card" ? "bg-[#22c55e] text-black" : "text-[#475569] hover:text-white"}`}>Kart</button>
                <button onClick={() => setViewMode("list")} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${viewMode === "list" ? "bg-[#22c55e] text-black" : "text-[#475569] hover:text-white"}`}>Liste</button>
              </div>
              <div className="flex bg-[#0f172a] rounded-lg border border-[#1e293b] p-1">
                <button onClick={() => setDataRange("latest")} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${dataRange === "latest" ? "bg-[#3b82f6] text-white" : "text-[#475569] hover:text-white"}`}>Güncel</button>
                <button onClick={() => setDataRange("15days")} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${dataRange === "15days" ? "bg-[#3b82f6] text-white" : "text-[#475569] hover:text-white"}`}>Son 15 G</button>
              </div>
              <Link href="/optanaliz-performance" className="text-[10px] font-black text-[#22c55e] border border-[#22c55e]/30 px-3 py-1 rounded-full hover:bg-[#22c55e]/10 transition-all uppercase tracking-widest">Performans →</Link>
            </div>
            {generatedAt && dataRange === "latest" && (
              <p className="text-[10px] font-mono text-[#3b82f6] bg-[#3b82f6]/10 px-2 py-0.5 rounded border border-[#3b82f6]/20">SON GÜNCELLEME: {new Date(generatedAt).toLocaleString("tr-TR")}</p>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-4">
            <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] overflow-hidden">
              <div className="p-3 border-b border-[#1e293b] bg-[#1e293b]/30"><span className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">Günlük Adaylar</span></div>
              <div className="max-h-[600px] overflow-y-auto">
                {picks.map((p: any) => {
                  const isEx = p.trend_status?.is_exhausted || p.is_exhausted;
                  return (
                    <button key={p.ticker} onClick={() => setSelectedTicker(p.ticker)} className={`w-full flex items-center justify-between p-4 border-b border-[#1e293b]/50 transition-all ${selectedTicker === p.ticker ? "bg-[#22c55e]/10 border-l-4 border-l-[#22c55e]" : "hover:bg-[#1e293b]/50"}`}>
                      <div className="flex flex-col items-start"><span className={`font-bold ${selectedTicker === p.ticker ? "text-[#22c55e]" : "text-white"}`}>{p.ticker}</span><span className="text-[10px] text-[#475569]">{p.sector}</span></div>
                      <div className="flex flex-col items-end"><span className={`text-xs font-bold ${(p.boga_score || p.score) >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{fmt(p.boga_score || p.score, 0)}</span>{isEx && <span className="text-[8px] text-[#ef4444] font-bold">EXH</span>}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] p-4">
               <label className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase block mb-3">IV Rank Girişi</label>
               <input value={ivRankText} onChange={e => setIvRankText(e.target.value)} placeholder="Örn: NVDA:45,AAPL:30" className="w-full bg-[#080b12] border border-[#1e293b] rounded-lg p-2 text-xs text-white outline-none focus:border-[#22c55e] transition-all" />
               <p className="text-[9px] text-[#475569] mt-2">Opsiyon tipi (Call/Spread) IV Rank değerine göre değişir.</p>
            </div>
          </div>

          <div>
            {viewMode === "card" ? (
              <>{selectedPick ? <PickCard pick={selectedPick} ivRank={selectedIvRank} liveOptions={liveOptions[selectedPick.ticker]} /> : <div className="h-[400px] flex items-center justify-center border border-dashed border-[#1e293b] rounded-xl text-[#475569]">Analiz için listeden bir hisse seçin</div>}</>
            ) : (
              <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] overflow-hidden">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-[11px] border-collapse">
                     <thead>
                       <tr className="bg-[#1e293b]/50 text-[#64748b] font-black uppercase tracking-widest">
                         <th className="px-4 py-3">Ticker</th><th className="px-4 py-3">Fiyat</th><th className="px-4 py-3">Skor</th><th className="px-4 py-3">Sistem</th><th className="px-4 py-3">IV</th><th className="px-4 py-3">Yorum</th><th className="px-4 py-3">İşlem</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-[#1e293b]/50">
                       {picks.map((p: any) => {
                         const iv = ivMap[p.ticker] ?? ivMap["__all__"] ?? null;
                         const comment = generateComment(p, iv);
                         return (
                           <tr key={p.ticker} className={`hover:bg-[#22c55e]/5 transition-all ${selectedTicker === p.ticker ? "bg-[#22c55e]/10" : ""}`}>
                             <td className="px-4 py-4 font-bold text-white text-[13px]">{p.ticker}</td>
                             <td className="px-4 py-4 text-[#f1f5f9] font-mono">${fmt(p.current_price || p.price)}</td>
                             <td className="px-4 py-4"><span className={`font-black ${(p.boga_score || p.score) >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{fmt(p.boga_score || p.score, 0)}</span></td>
                             <td className="px-4 py-4"><span className="text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 text-slate-400">{p.selected_system || "MOMENTUM"}</span></td>
                             <td className="px-4 py-4">{iv !== null ? <span className={`font-bold ${iv > 60 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>%{iv}</span> : <span className="text-slate-600">—</span>}</td>
                             <td className="px-4 py-4"><span className={`font-medium ${comment.includes("🚀") ? "text-[#22c55e] font-black" : "text-slate-300"}`}>{comment}</span></td>
                             <td className="px-4 py-4"><button onClick={() => { setSelectedTicker(p.ticker); setViewMode("card"); }} className="text-[9px] font-black text-[#3b82f6] border border-[#3b82f6]/30 px-2 py-1 rounded hover:bg-[#3b82f6]/10 uppercase transition-all">Detay →</button></td>
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
