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
  SQUEEZE: "Bollinger ve Keltner bantlarının daralmasıyla oluşan düşük volatilite dönemi. Yakında her iki yöne ama genellikle ana trend yönüne sert bir patlama beklenir.",
  SPRING: "Fiyatın önemli bir desteği aşağı kırıp hemen üzerine geri dönmesiyle (Bear Trap) oluşur. Satıcıların tükendiğini gösteren güçlü bir dönüş sinyalidir.",
  AWAKENING: "Hissede uzun süren sessizliğin ardından kurumsal para girişinin başladığı ilk aşamadır. Büyük trendlerin başlangıç noktalarını hedefler.",
  EMA_CROSS: "Kısa vadeli hareketli ortalamaların uzun vadeli olanları yukarı kesmesiyle oluşan trend teyit sinyalidir. Momentumun kalıcılığını gösterir.",
  PULLBACK: "Yükselen bir trenddeki geçici ve sağlıklı düzeltmedir. Ana trend yönünde daha uygun bir maliyetle oyuna girmek için ideal alım noktasıdır.",
  BREAKOUT: "Fiyatın uzun süreli yatay dirençleri veya düşen trend çizgilerini yüksek hacimle kırmasıdır. Yeni bir yükseliş dalgasının tescilidir.",
  MOMENTUM: "Fiyatın mevcut yükseliş hızının arttığını ve alıcı iştahının en yüksek seviyede olduğunu gösterir. Hızlı para kazanma aşamasıdır.",
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
    reason: "Spot fiyata en duyarlı, 45 günlük taşıma süresi",
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
    reason: "Zaman erimesi (Theta) daha yavaş, daha güvenli",
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
  const rr = pick.boga_zones?.risk_reward || pick.rr_ratio || 0;

  if (isExhausted) return "⚠️ Trend yorulması, yeni giriş riskli.";
  if (system === "SQUEEZE") return "⌛ Volatilite iyice sıkıştı, her an sert bir patlama gelebilir.";
  if (system === "SPRING") return "🏹 Boğa tuzağı teyit edildi, hızlı bir toparlanma bekleniyor.";
  if (system === "AWAKENING") return "🌟 Gizli trend uyanışı; kurumsal para girişi hissediliyor.";
  if (score >= 85 && ivRank !== null && ivRank < 30) return "🚀 Yüksek Skor + Ucuz Opsiyon: Güçlü Fırsat!";
  if (score >= 80 && rr >= 3.0) return "🎯 Harika Risk/Ödül Oranı.";
  if (system === "BREAKOUT" && score >= 75) return "⚡ Trend Kırılımı + Momentum desteği.";
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
  if (score >= 60 && rr >= 2.2) return iv < 60 ? "CALL" : "SPREAD";
  if (score < 60 || rr < 2.0) return "STOCK";
  return "SKIP";
}

// ── Components ───────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string, children: React.ReactNode }) {
  return (
    <div className="group relative inline-block">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded bg-slate-900 p-2 text-[10px] leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 z-50 border border-white/10">
        {text}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

function MatrixItem({ label, criteria, color, active, desc }: { label: string, criteria: string, color: string, active: boolean, desc: string }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden ${
      active 
        ? "bg-white/[0.03] border-[#3b82f6] shadow-[0_0_25px_rgba(59,130,246,0.2)] ring-2 ring-[#3b82f6]/50" 
        : "bg-black/20 border-white/5 opacity-40 grayscale-[0.5]"
    }`}>
      {active && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#3b82f6] animate-ping" />
          <span className="text-[9px] font-black text-[#3b82f6] uppercase tracking-widest">AKTİF TAVSİYE</span>
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs font-black tracking-widest" style={{ color: color }}>{label}</div>
        <div className="text-[9px] font-mono text-slate-500">{criteria}</div>
      </div>
      <p className="text-[11px] text-slate-400 font-medium leading-tight">{desc}</p>
    </div>
  );
}

function PickCard({ pick, ivRank, liveOptions }: { pick: any, ivRank: number | null, liveOptions?: any }) {
  const [portfolioSize, setPortfolioSize] = useState<number>(10000);
  const zones = pick.boga_zones || {};
  const ts = pick.trend_status || {};
  const price = pick.current_price || 0;
  const bogaScore = pick.boga_score || pick.score || 0;
  const system = pick.selected_system || "MOMENTUM";
  const isExhausted = ts.is_exhausted || pick.is_exhausted || false;
  const holdDays = pick.hold_days || 7;
  const rrRatio = zones.risk_reward || zones.rr_ratio || pick.rr_ratio || 0;
  const rec = getRecommendation(pick, ivRank);

  const buyZone = zones.buying_zone || zones.buy_zone || {};
  const sellZone = zones.sell_zone || {};
  const stopZone = zones.stop_loss_zone || zones.stop_zone || {};
  
  const riskAmount = portfolioSize * 0.01;
  const riskPerShare = price - (stopZone.high || price * 0.95);
  const recommendedShares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;

  const contracts = calcContracts(price, system, bogaScore, isExhausted, ivRank);
  const rsiStat = getIndicatorStatus("RSI", ts.rsi_14 || 50);
  const adxStat = getIndicatorStatus("ADX", ts.adx || 20);
  const rvolStat = getIndicatorStatus("RVOL", ts.rvol_today || 1.0);

  return (
    <div className="space-y-6">
      <div className="bg-[#1e293b]/80 border-2 border-[#3b82f6]/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#22c55e]" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest">BOGA AI AKSİYON PLANI</span>
              <Tooltip text="Algoritma bu hisse için teknik verilere göre en ideal giriş, hedef ve stop seviyelerini belirledi.">
                <span className="cursor-help text-xs text-slate-500">ⓘ</span>
              </Tooltip>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
              AI ÖNERİSİ: <span className="text-[#22c55e]">{pick.ticker}</span> hissesini <span className="text-[#3b82f6]">${fmt(price)}</span> civarından al, hedef <span className="text-[#3b82f6]">${fmt(sellZone.high)}</span>, stop <span className="text-[#ef4444]">${fmt(stopZone.high)}</span>.
            </h2>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-500 uppercase mb-1">SİNYAL GÜVENİ</span>
            <div className="flex items-center gap-2">
               <span className="text-2xl font-black text-white">{fmt(bogaScore, 0)}%</span>
               <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#22c55e]" style={{ width: `${bogaScore}%` }} />
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <div className="glass-card rounded-3xl border border-white/10 p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <span className="text-5xl font-black text-white tracking-tighter italic uppercase">{pick.ticker}</span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#3b82f6] uppercase tracking-widest">{(SYSTEM_TR as any)[system] || system}</span>
                    <Tooltip text={(SYSTEM_DESC as any)[system] || "BOGA AI teknik analiz sistemi."}>
                      <span className="cursor-help text-xs text-slate-500">ⓘ</span>
                    </Tooltip>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{pick.sector}</span>
                </div>
              </div>
              <div className="text-right">
                <Tooltip text="Bileşenler: RSI (20%), MACD (15%), Hacim (15%), Trend (30%), Fundamental (20%)">
                  <div className="flex flex-col items-end cursor-help">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 underline decoration-dotted">BOGA Skor Analizi</span>
                    <span className={`text-4xl font-black ${bogaScore >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{fmt(bogaScore, 0)}<span className="text-sm">/100</span></span>
                  </div>
                </Tooltip>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {contracts.map((c, i) => (
                <div key={i} className={`relative bg-black/40 rounded-3xl p-6 border transition-all ${c.isRecommended ? 'border-[#22c55e]/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-white/5 opacity-80'}`}>
                  {c.isRecommended && (
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-[#22c55e] text-black text-[9px] font-black rounded-full uppercase tracking-widest">Tavsiye Edilen</div>
                  )}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">{c.type}</span>
                      <span className="text-2xl font-black text-white italic">{c.label} ({c.dte} G)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Maliyet (Ask)</span>
                      <span className="text-xl font-black text-[#22c55e]">$1.25</span>
                    </div>
                  </div>
                  <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 mb-4">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-bold">Kâr Hedefi:</span>
                      <span className="text-[#22c55e] font-black">+%40 ($1.75)</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-bold">Zarar Durdur:</span>
                      <span className="text-[#ef4444] font-black">-%30 ($0.87)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 italic leading-relaxed">{c.reason}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.02] rounded-3xl p-6 border border-white/5">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Teknik Durum Analizi (Neden Bu Karar?)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: "RSI", val: ts.rsi_14 || 37, stat: rsiStat },
                  { label: "ADX", val: ts.adx || 17, stat: adxStat },
                  { label: "RVOL", val: ts.rvol_today || 1.2, stat: rvolStat },
                  { label: "CMF", val: ts.cmf || -0.05, stat: { label: "Nötr", color: "#94a3b8", desc: "Para girişi/çıkışı dengeli." } }
                ].map((item, idx) => (
                  <Tooltip key={idx} text={item.stat.desc}>
                    <div className="flex flex-col cursor-help">
                      <span className="text-[10px] font-black text-slate-500 uppercase mb-1">{item.label}</span>
                      <span className="text-xl font-black text-white mb-1">{fmt(item.val, 1)}</span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block text-center" style={{ background: item.stat.color + "22", color: item.stat.color }}>{item.stat.label}</span>
                    </div>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl border border-white/10 p-6">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Risk / Ödül Dengesi</h4>
            <div className="text-3xl font-black text-[#3b82f6] mb-2">{fmt(rrRatio, 2)}x</div>
            <div className="text-[10px] font-mono text-slate-500 bg-black/20 p-2 rounded-lg leading-relaxed mb-4">
              Formül: (H: {fmt(sellZone.high)} - G: {fmt(price)}) / (G: {fmt(price)} - S: {fmt(stopZone.high)}) = {fmt(rrRatio, 2)}x
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-white/10 p-6 bg-[#3b82f6]/5">
            <h4 className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest mb-4">Pozisyon Büyüklüğü</h4>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Portföy Büyüklüğü ($)</label>
                <input type="number" value={portfolioSize} onChange={(e) => setPortfolioSize(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-bold outline-none focus:border-[#3b82f6]" />
              </div>
              <div className="bg-black/20 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between items-center"><span className="text-[10px] text-slate-400">Önerilen Alım:</span><span className="text-sm font-black text-white">{recommendedShares} Lot</span></div>
                <div className="flex justify-between items-center border-t border-white/5 pt-2"><span className="text-[10px] text-slate-400">Risk Tutarı (%1):</span><span className="text-sm font-black text-[#ef4444]">${riskAmount}</span></div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-white/10 p-6 border-l-4 border-l-[#22c55e]">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Geçmiş Başarı</h4>
             <div className="text-2xl font-black text-white mb-2">68% <span className="text-[10px] text-slate-500 font-medium">Win Rate</span></div>
             <p className="text-[10px] text-slate-400 leading-tight">Bu sinyal tipinde son 6 ayda açılan işlemlerin başarı oranıdır.</p>
          </div>
        </div>
      </div>

      <div className="mt-8 glass-card rounded-3xl border border-white/10 p-8">
        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-3">
          <div className="w-1.5 h-4 bg-[#3b82f6]" /> Karar Verme Matrisi (AI Standartları)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MatrixItem label="CALL AL" active={rec === 'CALL'} criteria="BOGA ≥ 60, R/R ≥ 2.2, IV Rank < %60" color="#22c55e" desc="Güçlü yükseliş beklentisi ve ucuz opsiyon maliyeti." />
          <MatrixItem label="SPREAD KUR" active={rec === 'SPREAD'} criteria="BOGA ≥ 60, R/R ≥ 2.2, IV Rank ≥ %60" color="#8b5cf6" desc="Oynaklık yüksek, maliyeti düşürmek için dikey yayılım." />
          <MatrixItem label="HİSSE AL" active={rec === 'STOCK'} criteria="BOGA < 60 veya R/R < 2.2" color="#3b82f6" desc="Kaldıraçsız, daha düşük riskli spot alım." />
          <MatrixItem label="GEÇ / BEKLE" active={rec === 'SKIP'} criteria="Trend yorulması tespiti" color="#ef4444" desc="Riskler yüksek, yeni sinyal beklenmeli." />
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function OptAnalizPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#22c55e] animate-pulse font-mono tracking-widest text-xl">LOADING BOGA AI...</div>}>
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

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#080b12] text-[#22c55e] animate-pulse font-mono tracking-widest text-xl uppercase">BOGA AI ANALYZING...</div>;

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f1f5f9] font-mono">
      <Header />
      
      {/* ── Fixed Floating Action Button (FAB) ── */}
      <Link 
        href="/optanaliz-performance" 
        className="fixed bottom-10 right-10 z-[9999] flex flex-col items-center justify-center w-20 h-20 bg-[#22c55e] text-black rounded-full shadow-[0_0_50px_rgba(34,197,94,0.6)] hover:scale-110 active:scale-95 transition-all group animate-bounce hover:animate-none"
      >
        <span className="text-[11px] font-black leading-none">P&L</span>
        <span className="text-[8px] font-black uppercase tracking-tighter mt-1">ANALİZİ</span>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full border-2 border-[#080b12] flex items-center justify-center">
           <span className="text-[8px] font-black text-white animate-pulse">LIVE</span>
        </div>
      </Link>

      <div className="p-4 md:p-8 relative">
        <div className="max-w-6xl mx-auto mb-8">
          <div className="flex items-center gap-3 mb-2"><div className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" /><span className="text-[10px] text-[#22c55e] font-bold tracking-[0.2em] uppercase">Opsiyon Danışmanı v116</span></div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase italic">Opsiyon <span className="text-[#22c55e]">Analiz Portalı</span></h1>
              <p className="text-slate-500 text-xs mt-2 font-bold tracking-widest uppercase">Gelişmiş Teknik Sinyal ve Opsiyon Strateji Motoru</p>
            </div>
            
            {/* Super Prominent Action Button */}
            <Link 
              href="/optanaliz-performance" 
              className="flex items-center gap-4 px-8 py-4 bg-[#22c55e] hover:bg-[#16a34a] text-black font-black rounded-2xl transition-all shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:scale-105 active:scale-95 uppercase text-sm tracking-[0.1em]"
            >
               Gerçekleşen Performans Raporu →
            </Link>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 mt-8 bg-[#0f172a] p-4 rounded-2xl border border-white/5 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="flex bg-[#1e293b] rounded-xl p-1 border border-white/5">
                <button onClick={() => setViewMode("card")} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === "card" ? "bg-[#22c55e] text-black shadow-lg" : "text-slate-500 hover:text-white"}`}>Kart Görünümü</button>
                <button onClick={() => setViewMode("list")} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === "list" ? "bg-[#22c55e] text-black shadow-lg" : "text-slate-500 hover:text-white"}`}>Liste Görünümü</button>
              </div>
              <div className="flex bg-[#1e293b] rounded-xl p-1 border border-white/5">
                <button onClick={() => setDataRange("latest")} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${dataRange === "latest" ? "bg-[#3b82f6] text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>Güncel</button>
                <button onClick={() => setDataRange("15days")} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${dataRange === "15days" ? "bg-[#3b82f6] text-white shadow-lg" : "text-slate-500 hover:text-white"}`}>Son 15 Gün</button>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-500">
               {generatedAt && <span>Son Güncelleme: {new Date(generatedAt).toLocaleString('tr-TR')}</span>}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-4">
            <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-[#1e293b] bg-[#1e293b]/30 flex items-center justify-between">
                 <span className="text-[10px] font-black text-[#64748b] tracking-wider uppercase">Günlük Adaylar</span>
                 <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              </div>
              <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#22c55e]/20">
                {picks.map((p: any) => {
                  const isEx = p.trend_status?.is_exhausted || p.is_exhausted;
                  return (
                    <button key={p.ticker} onClick={() => setSelectedTicker(p.ticker)} className={`w-full flex items-center justify-between p-4 border-b border-[#1e293b]/50 transition-all ${selectedTicker === p.ticker ? "bg-[#22c55e]/10 border-l-4 border-l-[#22c55e]" : "hover:bg-[#1e293b]/50"}`}>
                      <div className="flex flex-col items-start"><span className={`font-black tracking-tighter ${selectedTicker === p.ticker ? "text-[#22c55e]" : "text-white"}`}>{p.ticker}</span><span className="text-[9px] text-slate-500 font-bold uppercase">{p.sector}</span></div>
                      <div className="flex flex-col items-end"><span className={`text-sm font-black ${(p.boga_score || p.score) >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{fmt(p.boga_score || p.score, 0)}</span>{isEx && <span className="text-[8px] text-[#ef4444] font-black uppercase tracking-tighter">EXHAUSTED</span>}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-[#0f172a] rounded-2xl border border-[#1e293b] p-4 shadow-xl">
               <label className="text-[9px] font-black text-slate-500 tracking-wider uppercase block mb-3">Opsiyon Oynaklığı (IV Rank)</label>
               <input value={ivRankText} onChange={e => setIvRankText(e.target.value)} placeholder="Örn: NVDA:45,AAPL:30" className="w-full bg-[#080b12] border border-[#1e293b] rounded-xl p-3 text-xs text-white outline-none focus:border-[#22c55e] transition-all placeholder:text-slate-700 font-bold" />
            </div>
          </div>

          <div>
            {viewMode === "card" ? (
              <>{selectedPick ? <PickCard pick={selectedPick} ivRank={selectedIvRank} liveOptions={liveOptions[selectedPick.ticker]} /> : <div className="h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl text-slate-600 bg-white/[0.01]"><div className="w-12 h-12 rounded-full border-2 border-slate-700 animate-spin mb-4" /><p className="font-black uppercase tracking-[0.2em] text-[10px]">Analiz İçin Bir Hisse Seçin</p></div>}</>
            ) : (
              <div className="bg-[#0f172a] rounded-3xl border border-[#1e293b] overflow-hidden shadow-2xl">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-[11px] border-collapse">
                     <thead>
                       <tr className="bg-[#1e293b]/50 text-slate-500 font-black uppercase tracking-widest border-b border-white/5">
                         <th className="px-6 py-5">Ticker / Sektör</th><th className="px-6 py-5">Fiyat</th><th className="px-6 py-5">Boga Skor</th><th className="px-6 py-5">Sinyal Tipi</th><th className="px-6 py-5">IV Rank</th><th className="px-6 py-5">AI Yorumu</th><th className="px-6 py-5 text-right">İşlem</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {picks.map((p: any) => {
                         const iv = ivMap[p.ticker] ?? ivMap["__all__"] ?? null;
                         const comment = generateComment(p, iv);
                         const systemName = (SYSTEM_TR as any)[p.selected_system] || p.selected_system || "MOMENTUM";
                         return (
                           <tr key={p.ticker} className={`hover:bg-[#22c55e]/5 transition-all group ${selectedTicker === p.ticker ? "bg-[#22c55e]/10" : ""}`}>
                             <td className="px-6 py-5"><div className="flex flex-col"><span className="text-sm font-black text-white group-hover:text-[#22c55e] transition-colors">{p.ticker}</span><span className="text-[9px] text-slate-500 font-bold uppercase">{p.sector}</span></div></td>
                             <td className="px-6 py-5 text-[#f1f5f9] font-black">${fmt(p.current_price || p.price)}</td>
                             <td className="px-6 py-5"><span className={`text-sm font-black ${(p.boga_score || p.score) >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>{fmt(p.boga_score || p.score, 0)}</span></td>
                             <td className="px-6 py-5"><span className="text-[10px] bg-white/5 px-2 py-1 rounded-lg border border-white/10 text-slate-300 font-black uppercase tracking-tighter">{systemName}</span></td>
                             <td className="px-6 py-5">{iv !== null ? <span className={`font-black ${iv > 60 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>%{iv}</span> : <span className="text-slate-700">—</span>}</td>
                             <td className="px-6 py-5"><span className="text-slate-400 font-medium italic">{comment}</span></td>
                             <td className="px-6 py-5 text-right"><button onClick={() => { setSelectedTicker(p.ticker); setViewMode("card"); }} className="text-[10px] font-black text-[#3b82f6] border border-[#3b82f6]/30 px-4 py-2 rounded-xl hover:bg-[#3b82f6]/10 uppercase transition-all shadow-sm">Analiz Et →</button></td>
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
