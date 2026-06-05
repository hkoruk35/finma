"use client";

import { useState } from "react";
import type { EnrichedTrade } from "@/lib/kriter-helpers";

interface Props {
  trade: EnrichedTrade;
  onClose: () => void;
}

type Tab = "ozet" | "teknik" | "sinyaller" | "zones";

const TABS: { id: Tab; label: string }[] = [
  { id: "ozet", label: "Özet" },
  { id: "teknik", label: "Teknik" },
  { id: "sinyaller", label: "Sinyaller" },
  { id: "zones", label: "Boga Zones" },
];

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-white/5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={color ?? "text-white"}>{value}</span>
    </div>
  );
}

export default function TradeDetailModal({ trade, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("ozet");
  const s = trade.snapshot;
  const d = trade.derived;

  const resultColor =
    trade.result === "WIN" ? "text-green-400" : trade.result === "LOSS" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0d1117] border border-white/10 rounded-lg w-full max-w-lg font-mono max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <span className="text-white font-bold text-lg">{trade.ticker}</span>
            <span className={`ml-3 text-sm ${resultColor}`}>{trade.result}</span>
            {trade.result !== "PENDING" && (
              <span className={`ml-2 text-sm ${(trade.return_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {trade.return_pct != null ? `${trade.return_pct >= 0 ? "+" : ""}${trade.return_pct.toFixed(2)}%` : "N/A"}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-xs transition-colors ${
                activeTab === tab.id
                  ? "text-green-400 border-b-2 border-green-400"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-0.5">
          {activeTab === "ozet" && (
            <>
              <Row label="Tarih" value={trade.date} />
              <Row label="Şirket" value={trade.company} />
              <Row label="Sektör" value={`${trade.sector} / ${trade.subsector}`} />
              <Row label="Giriş Fiyatı" value={`$${trade.entry}`} />
              <Row label="Max Fiyat" value={`$${trade.max_price}`} />
              <Row label="Sonuç" value={trade.result} color={resultColor} />
              <Row label="Getiri" value={trade.return_pct != null ? `${trade.return_pct >= 0 ? "+" : ""}${trade.return_pct.toFixed(2)}%` : "N/A"}
                color={trade.return_pct >= 0 ? "text-green-400" : "text-red-400"} />
              <Row label="Gün Sayısı" value={String(trade.days)} />
              <Row label="Stop-Loss %" value={`%${trade.sl_pct}`} />
              {s && <Row label="Sistem" value={`${s.selected_system} (${s.system_category})`} />}
              {s && <Row label="Boga Skoru" value={String(s.score)} />}
              {d && <Row label="EMA Stack" value={d.ema_stack_status} color={d.ema_stack_status === "FULL" ? "text-green-400" : d.ema_stack_status === "MIXED" ? "text-yellow-400" : "text-red-400"} />}
              {d && <Row label="Arşiv Durumu" value={trade.enrichmentStatus} color={trade.enrichmentStatus === "OK" ? "text-green-400" : "text-yellow-400"} />}
            </>
          )}

          {activeTab === "teknik" && s && (
            <>
              <Row label="RSI 14" value={String(s.trend_status?.rsi_14 ?? "-")}
                color={(s.trend_status?.rsi_14 ?? 50) >= 60 ? "text-red-400" : (s.trend_status?.rsi_14 ?? 50) <= 40 ? "text-green-400" : "text-white"} />
              <Row label="ADX" value={String(s.trend_status?.adx ?? "-")}
                color={(s.trend_status?.adx ?? 0) >= 25 ? "text-green-400" : "text-yellow-400"} />
              <Row label="MACD Hist" value={String(s.trend_status?.macd_hist ?? "-")}
                color={(s.trend_status?.macd_hist ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
              <Row label="MFI" value={String(s.trend_status?.mfi ?? "-")} />
              <Row label="CMF" value={String(s.trend_status?.cmf ?? "-")} />
              <Row label="RVOL Bugün" value={`${s.trend_status?.rvol_today ?? "-"}x`}
                color={(s.trend_status?.rvol_today ?? 0) >= 1.5 ? "text-green-400" : (s.trend_status?.rvol_today ?? 0) < 0.8 ? "text-red-400" : "text-white"} />
              <Row label="Trend" value={s.trend_status?.trend ?? "-"} />
              <Row label="Entry Trigger" value={s.trend_status?.entry_trigger ?? "-"} />
              <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500 uppercase tracking-wider mb-1">EMA Seviyeleri</div>
              <Row label="EMA 20" value={`$${s.moving_averages?.ema_20?.toFixed(2) ?? "-"}`} />
              <Row label="EMA 50" value={`$${s.moving_averages?.ema_50?.toFixed(2) ?? "-"}`} />
              <Row label="EMA 200" value={`$${s.moving_averages?.ema_200?.toFixed(2) ?? "-"}`} />
              <Row label="Fiyat vs EMA20" value={`${s.moving_averages?.price_vs_ema20 >= 0 ? "+" : ""}${s.moving_averages?.price_vs_ema20?.toFixed(2)}%`}
                color={(s.moving_averages?.price_vs_ema20 ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
              <Row label="EMA20 Slope" value={s.moving_averages?.ema20_slope ?? "-"} />
              <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-gray-500 uppercase tracking-wider mb-1">Saatlik Analiz</div>
              <Row label="RSI 1H" value={String(s.hourly_analysis?.rsi_1h ?? "-")} />
              <Row label="ADX 1H" value={String(s.hourly_analysis?.adx_1h ?? "-")} />
              <Row label="RVOL 1H" value={s.hourly_analysis?.rvol_1h ?? "-"} />
              <Row label="EMA Yapısı" value={s.hourly_analysis?.ema_structure ?? "-"} />
            </>
          )}

          {activeTab === "sinyaller" && s && (
            <>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Seçim Nedenleri</div>
              {(s.selection_reasons ?? []).map((reason, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/5">
                  <span className="text-green-400 text-xs">{">"}</span>
                  <span className="text-white text-sm">{reason}</span>
                </div>
              ))}
              {(s.selection_reasons ?? []).length === 0 && (
                <div className="text-gray-500 text-sm">Sinyal bilgisi bulunamadı</div>
              )}
              <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-gray-500 uppercase tracking-wider mb-2">Faktör Skorları</div>
              {s.factor_scores && (
                <>
                  <Row label="Trend" value={String(s.factor_scores.trend_score)} />
                  <Row label="Momentum" value={String(s.factor_scores.momentum_score)} />
                  <Row label="Volatility" value={String(s.factor_scores.volatility_score)} />
                  <Row label="Volume" value={String(s.factor_scores.volume_score)} />
                  <Row label="Financial" value={String(s.factor_scores.financial_score)} />
                  <Row label="Catalyst" value={String(s.factor_scores.catalyst_score?.toFixed(2))} />
                  <Row label="Insider" value={String(s.factor_scores.insider_score)} />
                  <Row label="Composite" value={String(s.factor_scores.composite)} color="text-cyan-400" />
                  <Row label="Raw Score" value={String(s.factor_scores.raw_score?.toFixed(1))} />
                </>
              )}
            </>
          )}

          {activeTab === "zones" && s?.boga_zones && (
            <>
              <Row label="Alım Zonu" value={`$${s.boga_zones.buying_zone?.low?.toFixed(2)} - $${s.boga_zones.buying_zone?.high?.toFixed(2)}`} color="text-cyan-400" />
              <Row label="Satış Zonu" value={`$${s.boga_zones.sell_zone?.low?.toFixed(2)} - $${s.boga_zones.sell_zone?.high?.toFixed(2)}`} color="text-green-400" />
              <Row label="Stop-Loss Zonu" value={`$${s.boga_zones.stop_loss_zone?.low?.toFixed(2)} - $${s.boga_zones.stop_loss_zone?.high?.toFixed(2)}`} color="text-red-400" />
              <Row label="Risk/Reward" value={String(s.boga_zones.risk_reward?.toFixed(2))}
                color={(s.boga_zones.risk_reward ?? 0) >= 2 ? "text-green-400" : "text-yellow-400"} />
              <Row label="ATR 1D" value={`$${s.boga_zones.atr_1d?.toFixed(2)}`} />
              <Row label="ATR %" value={`%${s.boga_zones.atr_pct?.toFixed(2)}`} />
              <Row label="Risk USD" value={`$${s.boga_zones.risk_usd?.toFixed(2)}`} color="text-red-400" />
              <Row label="Reward USD" value={`$${s.boga_zones.reward_usd?.toFixed(2)}`} color="text-green-400" />
              <Row label="Destek 1H" value={`$${s.boga_zones.support_1h?.toFixed(2)}`} />
              <Row label="Direnç 1H" value={`$${s.boga_zones.resistance_1h?.toFixed(2)}`} />
            </>
          )}

          {(activeTab === "teknik" || activeTab === "sinyaller" || activeTab === "zones") && !s && (
            <div className="text-yellow-400 text-sm py-4">
              Bu trade için arşiv verisi bulunamadı ({trade.enrichmentStatus}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
