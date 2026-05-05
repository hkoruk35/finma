"use client";

import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";

// ── Helpers (User Provided Logic) ─────────────────────────────────────────────

function calcDTE(holdDays: number): number {
  return Math.max(21, holdDays + 15);
}

function calcStrike(price: number, system: string, bogaScore: number, isExhausted: boolean): { label: string, pct: number | null, delta: string | null, reason?: string } {
  if (isExhausted) return { label: "⚠️ Pozisyon açma", pct: null, delta: null, reason: "is_exhausted=true — theta + gamma risk çok yüksek" };
  if (bogaScore < 60) return { label: "Hisse al", pct: null, delta: null, reason: "BOGA score 60 altı — opsiyon değil hisse tercih et" };

  const atm = { label: "ATM", pct: 0, delta: "0.48–0.52" };
  const slight = { label: "%1 OTM", pct: 0.01, delta: "0.40–0.45" };
  const moderate = { label: "%2 OTM", pct: 0.02, delta: "0.35–0.40" };

  const map: Record<string, typeof atm> = {
    SQUEEZE:   bogaScore >= 75 ? atm : slight,
    SPRING:    atm,
    AWAKENING: slight,
    EMA_CROSS: slight,
    PULLBACK:  bogaScore >= 75 ? atm : slight,
    BREAKOUT:  slight,
    MOMENTUM:  moderate,
  };
  return map[system] || slight;
}

function calcAction(rrRatio: number, bogaScore: number, isExhausted: boolean, ivRank: number | null): { type: string, color: string, label: string } {
  if (isExhausted) return { type: "SKIP", color: "#ef4444", label: "GEÇ" };
  if (bogaScore < 60) return { type: "STOCK", color: "#f59e0b", label: "HİSSE" };
  if (rrRatio < 2.5) return { type: "STOCK", color: "#f59e0b", label: "HİSSE" };
  if (ivRank !== null && ivRank > 60) return { type: "SPREAD", color: "#8b5cf6", label: "SPREAD" };
  return { type: "CALL", color: "#22c55e", label: "CALL AL" };
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

function Row({ label, value, accent }: { label: string, value: string, accent?: string }) {
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

function PickCard({ pick, ivRank }: { pick: any, ivRank: number | null }) {
  const zones = pick.boga_zones || {};
  const ts = pick.trend_status || {};
  const price = pick.current_price || 0;
  const bogaScore = pick.boga_score_100 || 0;
  const system = pick.selected_system || "MOMENTUM";
  const isExhausted = ts.is_exhausted || pick.is_exhausted || false;
  const holdDays = pick.hold_days || 7;
  const rrRatio = zones.risk_reward || zones.rr_ratio || pick.rr_ratio || 0;
  const beta = pick.beta || 1.0;
  const rsi = ts.rsi_14 || pick.rsi || 50;
  const rvol = ts.rvol_today || pick.rvol || 1.0;

  const dte = calcDTE(holdDays);
  const strikeRec = calcStrike(price, system, bogaScore, isExhausted);
  const action = calcAction(rrRatio, bogaScore, isExhausted, ivRank);
  const exit = calcExitPlan(bogaScore, holdDays);
  const rb = riskBadge(rrRatio);
  const sysCol = (SYSTEM_COLORS as any)[system] || "#94a3b8";
  
  const buyZone = zones.buying_zone || zones.buy_zone || {};
  const sellZone = zones.sell_zone || {};
  const stopZone = zones.stop_loss_zone || zones.stop_zone || {};

  const strikePrice = strikeRec.pct != null ? (price * (1 + strikeRec.pct)).toFixed(2) : null;
  const atrPct = ((zones.atr_pct || 0) * 100).toFixed(1);

  return (
    <div className="relative overflow-hidden p-5 rounded-xl mb-4 border transition-all duration-300"
      style={{
        background: "rgba(15,17,23,0.95)",
        borderColor: isExhausted ? "#ef444440" : action.color + "40",
      }}>
      <div className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: isExhausted ? "#ef4444" : action.color,
        }} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-2xl font-bold text-[#f1f5f9] tracking-tight">
          {pick.ticker}
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
          style={{ background: sysCol + "22", color: sysCol, borderColor: sysCol + "44" }}>
          {system} · {(SYSTEM_TR as any)[system] || system}
        </span>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full border"
          style={{ background: action.color + "22", color: action.color, borderColor: action.color + "55" }}>
          {action.label}
        </span>
        {isExhausted && (
          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-[#ef444422] text-[#ef4444] border-[#ef444455]">
            ⚠️ EXHAUSTED
          </span>
        )}
      </div>

      {/* Score Bar */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] text-[#64748b] min-w-[80px]">BOGA Score</span>
        <div className="flex-1 bg-[#1e293b] rounded h-2 overflow-hidden">
          <div className="h-full transition-all duration-1000"
            style={{
              width: `${bogaScore}%`,
              background: bogaScore >= 75 ? "#22c55e" : bogaScore >= 60 ? "#eab308" : "#ef4444",
            }} />
        </div>
        <span className="text-xs font-bold min-w-[40px]" style={{ color: bogaScore >= 75 ? "#22c55e" : bogaScore >= 60 ? "#eab308" : "#ef4444" }}>
          {fmt(bogaScore, 0)}/100
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ background: rb.color + "22", color: rb.color, borderColor: rb.color + "44" }}>
          {rb.label}
        </span>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-[#0f172a] rounded-lg p-3 border border-[#1e293b]">
          <div className="text-[10px] text-[#475569] font-bold tracking-wider mb-2 uppercase">Opsiyon Parametresi</div>
          <Row label="DTE" value={`${dte} gün`} accent="#22c55e" />
          <Row label="Strike" value={strikePrice ? `$${strikePrice} (${strikeRec.label})` : strikeRec.label} accent="#f1f5f9" />
          <Row label="Delta" value={strikeRec.delta || "—"} accent="#94a3b8" />
          <Row label="Şu an fiyat" value={`$${fmt(price)}`} accent="#64748b" />
          {ivRank !== null && (
            <Row label="IV Rank" value={`%${ivRank}`} accent={ivRank > 60 ? "#ef4444" : ivRank > 30 ? "#f59e0b" : "#22c55e"} />
          )}
        </div>

        <div className="bg-[#0f172a] rounded-lg p-3 border border-[#1e293b]">
          <div className="text-[10px] text-[#475569] font-bold tracking-wider mb-2 uppercase">Bot Bölgeleri</div>
          <Row label="Giriş" value={`$${fmt(buyZone.low)} – $${fmt(buyZone.high)}`} accent="#22c55e" />
          <Row label="Hedef" value={`$${fmt(sellZone.high)}`} accent="#3b82f6" />
          <Row label="Stop" value={`$${fmt(stopZone.high)}`} accent="#ef4444" />
          <Row label="R/R" value={`${fmt(rrRatio, 1)}:1`} accent={rb.color} />
          <Row label="ATR %" value={`${atrPct}%`} accent="#94a3b8" />
        </div>

        <div className="bg-[#0f172a] rounded-lg p-3 border border-[#1e293b]">
          <div className="text-[10px] text-[#475569] font-bold tracking-wider mb-2 uppercase">Çıkış Planı</div>
          <Row label="Kâr hedefi" value={`+%${exit.tp} opsiyonda`} accent="#22c55e" />
          <Row label="Stop" value={`${exit.sl}% opsiyonda`} accent="#ef4444" />
          <Row label="Zaman" value={`${exit.timeExit}. günde kapat`} accent="#f59e0b" />
          <Row label="Hold" value={`${holdDays} gün (bot)`} accent="#64748b" />
          <Row label="Beta" value={fmt(beta, 2)} accent="#94a3b8" />
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
          <Chip key={i} label="" value={r.replace(/_/g, " ")} color="#475569" />
        ))}
      </div>

      {/* Rationale */}
      {strikeRec.reason && (
        <div className="mt-3 text-[11px] text-[#64748b] bg-[#0f172a] rounded p-2 border-l-2" style={{ borderLeftColor: action.color }}>
          {strikeRec.reason}
        </div>
      )}
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function OptAnalizPage() {
  const [picks, setPicks] = useState<any[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [ivRankText, setIvRankText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/swing_all_picks.json");
        if (!res.ok) throw new Error("Veri yüklenemedi");
        const data = await res.json();
        
        const rawPicks = data.picks || [];
        // Sort: exhausted last, then by boga_score_100 desc
        rawPicks.sort((a: any, b: any) => {
          const ea = a.trend_status?.is_exhausted || a.is_exhausted || false;
          const eb = b.trend_status?.is_exhausted || b.is_exhausted || false;
          if (ea !== eb) return ea ? 1 : -1;
          return (b.boga_score_100 || 0) - (a.boga_score_100 || 0);
        });

        setPicks(rawPicks);
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
    <div className="min-h-screen bg-[#080b12] text-[#f1f5f9] font-mono p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" />
          <span className="text-[10px] text-[#22c55e] font-bold tracking-[0.2em] uppercase">
            Opsiyon Danışmanı v115
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Opsiyon Analiz Portalı</h1>
        <p className="text-sm text-[#475569] mt-1">Günlük swing adayları için otomatik opsiyon stratejileri</p>
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
                      <span className={`text-xs font-bold ${p.boga_score_100 >= 75 ? "text-[#22c55e]" : "text-[#eab308]"}`}>
                        {p.boga_score_100}
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
            <PickCard pick={selectedPick} ivRank={selectedIvRank} />
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
  );
}
