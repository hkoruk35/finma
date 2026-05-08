"use client";

import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Header from "@/components/Header";

// ── Helpers (User Provided Logic) ─────────────────────────────────────────────

function getExpiryDate(dte: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dte);
  
  // En yakın Cuma gününe yuvarlama (Opsiyon vadeleri genellikle Cuma olur)
  const day = date.getDay();
  if (day !== 5) {
    const diff = 5 - day;
    date.setDate(date.getDate() + (diff > 0 ? diff : diff + 7));
  }
  
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Yeni: 45 ve 60 günlük ATM kontrat alternatifleri üreten fonksiyon
function calcContracts(price: number, system: string, bogaScore: number, isExhausted: boolean, ivRank: number | null) {
  const contracts = [];
  const isHighIV = ivRank !== null && ivRank > 60;
  
  // 1. 45-Günlük ATM
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

  // 2. 60-Günlük ATM
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

  const contracts = calcContracts(price, system, bogaScore, isExhausted, ivRank);
  const exit = calcExitPlan(bogaScore, holdDays);
  const rb = riskBadge(rrRatio);
  const sysCol = (SYSTEM_COLORS as any)[system] || "#94a3b8";
  
  const buyZone = zones.buying_zone || zones.buy_zone || {};
  const sellZone = zones.sell_zone || {};
  const stopZone = zones.stop_loss_zone || zones.stop_zone || {};
  const atrPct = ((zones.atr_pct || 0) * 100).toFixed(1);

  // Genel statü rengi (ilk kontrata göre veya yorulmaya göre)
  const mainColor = isExhausted ? "#ef4444" : (bogaScore >= 60 ? "#22c55e" : "#f59e0b");

  return (
    <div className="relative overflow-hidden p-5 rounded-xl mb-4 border transition-all duration-300 bg-[#0f1117]/95"
      style={{ borderColor: mainColor + "40" }}>
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: mainColor }} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-2xl font-bold text-[#f1f5f9] tracking-tight">
          {pick.ticker}
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
          style={{ background: sysCol + "22", color: sysCol, borderColor: sysCol + "44" }}>
          {system} · {(SYSTEM_TR as any)[system] || system}
        </span>
        <span className="ml-auto text-[11px] font-bold px-3 py-1 rounded-full border"
          style={{ background: mainColor + "22", color: mainColor, borderColor: mainColor + "55" }}>
          {isExhausted ? "İşlem Yok" : "İşlem Fırsatı"}
        </span>
      </div>

      {/* Score Bar */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] text-[#64748b] min-w-[80px]">BOGA Score</span>
        <div className="flex-1 bg-[#1e293b] rounded h-2 overflow-hidden">
          <div className="h-full transition-all duration-1000"
            style={{ width: `${bogaScore}%`, background: bogaScore >= 75 ? "#22c55e" : bogaScore >= 60 ? "#eab308" : "#ef4444" }} />
        </div>
        <span className="text-xs font-bold min-w-[40px]" style={{ color: bogaScore >= 75 ? "#22c55e" : bogaScore >= 60 ? "#eab308" : "#ef4444" }}>
          {fmt(bogaScore, 0)}/100
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ background: rb.color + "22", color: rb.color, borderColor: rb.color + "44" }}>
          {rb.label}
        </span>
      </div>

      {/* Kontrat Alternatifleri */}
      <div className="mb-4">
        <div className="text-[11px] text-[#f1f5f9] font-bold tracking-wider mb-2 uppercase">Önerilen Kontratlar (ATM, Yakın Vade)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contracts.map((c, i) => {
            const liveOpt = liveOptions ? (c.dte === 45 ? liveOptions.dte_45 : (c.dte === 60 ? liveOptions.dte_60 : null)) : null;
            const displayStrike = liveOpt ? `$${fmt(liveOpt.strike)}` : c.strike;
            // if we have live data, show last price instead of delta
            
            return (
              <div key={i} className="bg-[#1e293b]/60 rounded-lg p-4 border border-[#334155] hover:border-[#3b82f6]/50 transition-colors">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[13px] font-bold px-3 py-1 rounded" style={{ background: c.color + "33", color: c.color }}>{c.type}</span>
                  <span className="text-[13px] text-white font-mono">{c.label} ({c.dte} Gün)</span>
                </div>
                
                <div className="flex justify-between items-end mb-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#cbd5e1] uppercase mb-1">Strike</span>
                    <span className="text-2xl font-extrabold text-white tracking-wide">{displayStrike}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    {liveOpt ? (
                      <>
                        <span className="text-[11px] text-[#cbd5e1] uppercase mb-1">Fiyat (Ask)</span>
                        <span className="text-lg font-bold text-[#f8fafc]">${fmt(liveOpt.ask)}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-[#cbd5e1] uppercase mb-1">Delta</span>
                        <span className="text-lg font-bold text-[#f8fafc]">{c.delta}</span>
                      </>
                    )}
                  </div>
                </div>
                
                {liveOpt && (
                  <div className="flex justify-between items-center text-[11px] text-[#94a3b8] mb-2 px-1">
                    <span>Bid: ${fmt(liveOpt.bid)}</span>
                    <span>Last: ${fmt(liveOpt.lastPrice)}</span>
                    <span>Vol: {liveOpt.volume}</span>
                  </div>
                )}
                
                {c.expiry !== "—" && (
                  <div className="flex justify-between items-center bg-[#0f172a] rounded p-2 mb-2">
                    <span className="text-[11px] text-[#94a3b8]">Hedef Vade (Expiry):</span>
                    <span className="text-[12px] text-[#f1f5f9] font-bold">{liveOpt ? liveOpt.expiry : c.expiry}</span>
                  </div>
                )}
                
                <p className="text-[12px] text-[#e2e8f0] leading-relaxed pt-1">{c.reason}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0f172a] rounded-lg p-3 border border-[#1e293b]">
          <div className="text-[10px] text-[#94a3b8] font-bold tracking-wider mb-2 uppercase">Bot Bölgeleri</div>
          <Row label="Şu an Fiyat" value={`$${fmt(price)}`} accent="#f1f5f9" />
          <Row label="Giriş Bölgesi" value={`$${fmt(buyZone.low)} – $${fmt(buyZone.high)}`} accent="#22c55e" />
          <Row label="Kâr Hedefi" value={`$${fmt(sellZone.high)}`} accent="#3b82f6" />
          <Row label="Stop Loss" value={`$${fmt(stopZone.high)}`} accent="#ef4444" />
          <Row label="Risk/Ödül" value={`${fmt(rrRatio, 1)}:1`} accent={rb.color} />
          <Row label="ATR %" value={`${atrPct}%`} accent="#94a3b8" />
        </div>

        <div className="bg-[#0f172a] rounded-lg p-3 border border-[#1e293b]">
          <div className="text-[10px] text-[#94a3b8] font-bold tracking-wider mb-2 uppercase">Strateji Çıkış Planı</div>
          <Row label="Opsiyon Kâr Hedefi" value={`+%${exit.tp}`} accent="#22c55e" />
          <Row label="Opsiyon Stop Loss" value={`${exit.sl}%`} accent="#ef4444" />
          <Row label="Zaman Stopu" value={`${exit.timeExit}. gün`} accent="#f59e0b" />
          <Row label="Beta" value={fmt(beta, 2)} accent="#94a3b8" />
          {ivRank !== null && <Row label="Mevcut IV Rank" value={`%${ivRank}`} accent={ivRank > 60 ? "#ef4444" : "#22c55e"} />}
        </div>
      </div>

      {/* Indicators */}
      <div className="flex flex-wrap gap-2">
        <Chip label="RSI" value={fmt(rsi, 0)} color={rsi > 68 ? "#ef4444" : rsi >= 45 ? "#22c55e" : "#f59e0b"} />
        <Chip label="RVOL" value={`${fmt(rvol, 1)}x`} color={rvol >= 1.5 ? "#22c55e" : "#94a3b8"} />
        {ts.adx != null && <Chip label="ADX" value={fmt(ts.adx, 0)} color={ts.adx >= 25 ? "#22c55e" : "#94a3b8"} />}
        {ts.cmf != null && <Chip label="CMF" value={fmt(ts.cmf, 2)} color={ts.cmf > 0.05 ? "#22c55e" : "#ef4444"} />}
        {ts.macd_hist != null && <Chip label="MACD" value={ts.macd_hist > 0 ? "+" : "−"} color={ts.macd_hist > 0 ? "#22c55e" : "#ef4444"} />}
        {pick.selection_reasons?.slice(0, 2).map((r: string, i: number) => (
          <Chip key={`reason-${i}`} label="" value={r.replace(/_/g, " ")} color="#475569" />
        ))}
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function OptAnalizPage() {
  const [picks, setPicks] = useState<any[]>([]);
  const [liveOptions, setLiveOptions] = useState<any>({});
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [ivRankText, setIvRankText] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [picksRes, optsRes] = await Promise.all([
          fetch("/swing_all_picks.json"),
          fetch("/swing_options_live.json").catch(() => null)
        ]);
        
        if (!picksRes.ok) throw new Error("Veri yüklenemedi");
        const data = await picksRes.json();
        
        let optsData: any = {};
        if (optsRes && optsRes.ok) {
           const o = await optsRes.json();
           optsData = o.options || {};
        }
        
        const rawPicks = data.picks || [];
        // Sort: exhausted last, then by boga_score_100 desc
        rawPicks.sort((a: any, b: any) => {
          const ea = a.trend_status?.is_exhausted || a.is_exhausted || false;
          const eb = b.trend_status?.is_exhausted || b.is_exhausted || false;
          if (ea !== eb) return ea ? 1 : -1;
          return (b.boga_score || b.score || 0) - (a.boga_score || a.score || 0);
        });

        setPicks(rawPicks);
        setGeneratedAt(data.generated_at || null);
        setLiveOptions(optsData);
        if (rawPicks.length > 0) {
          setSelectedTicker(rawPicks[0].ticker);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Parse IV ranks map
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
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" />
          <span className="text-[10px] text-[#22c55e] font-bold tracking-[0.2em] uppercase">
            Opsiyon Danışmanı v115
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Opsiyon Analiz Portalı</h1>
        <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
          <p className="text-sm text-[#475569]">Günlük swing adayları için otomatik opsiyon stratejileri</p>
          {generatedAt && (
            <p className="text-[10px] font-mono text-[#3b82f6] bg-[#3b82f6]/10 px-2 py-0.5 rounded border border-[#3b82f6]/20">
              SON GÜNCELLEME: {new Date(generatedAt).toLocaleString("tr-TR")}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        
        {/* Sidebar: Ticker List */}
        <div className="space-y-4">
          <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] overflow-hidden">
            <div className="p-3 border-b border-[#1e293b] bg-[#1e293b]/30">
              <span className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">Günlük Adaylar</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {picks.map((p: any) => {
                const isEx = p.trend_status?.is_exhausted || p.is_exhausted;
                return (
                  <button
                    key={p.ticker}
                    onClick={() => setSelectedTicker(p.ticker)}
                    className={`w-full flex items-center justify-between p-4 border-b border-[#1e293b]/50 transition-all ${
                      selectedTicker === p.ticker ? "bg-[#22c55e]/10 border-l-4 border-l-[#22c55e]" : "hover:bg-[#1e293b]/50"
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className={`font-bold ${selectedTicker === p.ticker ? "text-[#22c55e]" : "text-white"}`}>
                        {p.ticker}
                      </span>
                      <span className="text-[10px] text-[#475569]">{p.sector}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-bold ${(p.boga_score || p.score) >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>
                        {fmt(p.boga_score || p.score, 0)}
                      </span>
                      {isEx && <span className="text-[8px] text-[#ef4444] font-bold">EXH</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* IV Rank Config */}
          <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] p-4">
             <label className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase block mb-3">IV Rank Girişi</label>
             <input
                value={ivRankText}
                onChange={e => setIvRankText(e.target.value)}
                placeholder="Örn: NVDA:45,AAPL:30"
                className="w-full bg-[#080b12] border border-[#1e293b] rounded-lg p-2 text-xs text-white outline-none focus:border-[#22c55e] transition-all"
             />
             <p className="text-[9px] text-[#475569] mt-2">Opsiyon tipi (Call/Spread) IV Rank değerine göre değişir.</p>
          </div>
        </div>

        {/* Main Content: Analysis Card */}
        <div>
          {selectedPick ? (
            <PickCard pick={selectedPick} ivRank={selectedIvRank} liveOptions={liveOptions[selectedPick.ticker]} />
          ) : (
            <div className="h-[400px] flex items-center justify-center border border-dashed border-[#1e293b] rounded-xl text-[#475569]">
              Analiz için listeden bir hisse seçin
            </div>
          )}

          {/* Decision Legend */}
          <div className="mt-6 bg-[#0f172a] rounded-xl border border-[#1e293b] p-5">
            <h3 className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase mb-4">Analiz Karar Matrisi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "CALL AL", color: "#22c55e", desc: "BOGA ≥ 60, R/R ≥ 2.5, IV Rank < %60" },
                { label: "SPREAD", color: "#8b5cf6", desc: "BOGA ≥ 60, R/R ≥ 2.5, IV Rank > %60" },
                { label: "HİSSE AL", color: "#f59e0b", desc: "BOGA < 60 veya R/R < 2.5 (Daha düşük risk)" },
                { label: "GEÇ", color: "#ef4444", desc: "Trend yorulması (is_exhausted=true)" },
              ].map((item: any) => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border min-w-[70px] text-center"
                    style={{ background: item.color + "22", color: item.color, borderColor: item.color + "44" }}>
                    {item.label}
                  </span>
                  <span className="text-[11px] text-[#64748b] leading-relaxed">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
  );
}
