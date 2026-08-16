"use client";

import React, { useState } from "react";
import { SPXContextSnapshot } from "@/lib/contextEngine";

export default function ContextEnginePanel({
  context,
  liveState,
}: {
  context: SPXContextSnapshot;
  liveState: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    seasonality,
    macro,
    volatility,
    previousSession,
    overnight,
    analog,
    fingerprint,
    liveOverrideStatus,
    liveOverrideExplanation,
  } = context;

  const isConfirmed = liveOverrideStatus === "CONFIRMED_BY_LIVE_STRUCTURE";
  const isContradicted = liveOverrideStatus === "CONTRADICTED_BY_LIVE_STRUCTURE";

  const overrideBadgeColor = isConfirmed
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
    : isContradicted
    ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
    : "bg-amber-400/20 text-amber-300 border-amber-400/30";

  const overrideTitle = isConfirmed
    ? "CANLI YAPI İLE TEYİTLİ (CONFIRMED)"
    : isContradicted
    ? "CANLI YAPI İLE ÇELİŞKİLİ (LIVE OVERRIDE AKTİF)"
    : "HENÜZ TEYİT EDİLMEDİ (BEKLEMEDE)";

  return (
    <div className="mb-6 rounded-xl border border-white/[0.08] bg-[#0b0f17] p-5 shadow-lg relative overflow-hidden">
      {/* Üst Başlık & Context Fingerprint */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06] pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏛️</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Context &amp; Regime Engine
              </h3>
              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                Çok Katmanlı Piyasa Bağlamı
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Takvim Mevsimselliği + Makro Olay Hafızası + Volatilite Rejimi + Tarihsel Analog Eşleşmesi
            </p>
          </div>
        </div>

        {/* Fingerprint ve Ağırlık Dağılımı Toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div
            className="bg-[#050811] border border-white/[0.06] px-2.5 py-1 rounded font-mono text-[10px] text-cyan-400 max-w-[320px] truncate"
            title={`Context Fingerprint:\n${fingerprint}`}
          >
            🔑 {fingerprint}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-white/[0.04] border border-white/[0.06] transition-colors"
          >
            {isExpanded ? "Ağırlıkları Gizle ▲" : "Ağırlıklar ▼"}
          </button>
        </div>
      </div>

      {/* Ağırlık Dağılım Paneli (Açılır/Kapanır) */}
      {isExpanded && (
        <div className="mb-4 bg-[#050811] p-3 rounded-lg border border-white/[0.06] text-xs text-slate-300 grid grid-cols-2 md:grid-cols-7 gap-2 text-center">
          <div>
            <span className="text-slate-500 block text-[10px]">Canlı Yapı</span>
            <span className="font-bold text-[#00d2ff]">%35</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Gece/Vadeli</span>
            <span className="font-bold text-slate-200">%20</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Önceki Seans</span>
            <span className="font-bold text-slate-200">%15</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Makro Bağlam</span>
            <span className="font-bold text-slate-200">%10</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Volatilite Rejimi</span>
            <span className="font-bold text-slate-200">%10</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Mevsimsellik</span>
            <span className="font-bold text-slate-200">%7</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Gün Eğilimi</span>
            <span className="font-bold text-slate-200">%3</span>
          </div>
        </div>
      )}

      {/* 5 Katmanlı Rejim Izgarası + Tarihsel Analog Özeti */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
        {/* Sol 5 Katman (8 Kolon) */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Katman 1: Mevsimsellik */}
          <div className="bg-[#070a11] p-3 rounded-lg border border-white/[0.06]">
            <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-semibold mb-1">
              <span>📅 Calendar Seasonality</span>
              <span className="text-purple-400">{seasonality.monthPhase}</span>
            </div>
            <div className="font-bold text-white text-xs">{seasonality.humanSummary}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              OPEX: Hayır | Triple Witching: Hayır
            </div>
          </div>

          {/* Katman 2: Makro Olay & Event Memory */}
          <div className="bg-[#070a11] p-3 rounded-lg border border-white/[0.06]">
            <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-semibold mb-1">
              <span>⚡ Macro Event Context</span>
              <span className="text-rose-400 font-bold">{macro.impact}</span>
            </div>
            <div className="font-bold text-white text-xs">{macro.label}</div>
            <div className="text-[10px] text-amber-300 mt-1 flex justify-between">
              <span>Son 12 CPI Günü Reaksiyonu:</span>
              <span className="font-bold">OR Kırılım %{macro.eventMemory?.orBreakoutSuccessRate}</span>
            </div>
          </div>

          {/* Katman 3: Volatilite Rejimi */}
          <div className="bg-[#070a11] p-3 rounded-lg border border-white/[0.06]">
            <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-semibold mb-1">
              <span>🌊 Volatility Regime</span>
              <span className="text-emerald-400 font-bold">{volatility.level}</span>
            </div>
            <div className="font-bold text-white text-xs">{volatility.regimeTag}</div>
            <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
              <span>VIX: {volatility.vixValue}</span>
              <span className="text-emerald-400">5D İvme: {volatility.vix5dChange}</span>
            </div>
          </div>

          {/* Katman 4 & 5: Önceki Gün & Gece */}
          <div className="bg-[#070a11] p-3 rounded-lg border border-white/[0.06]">
            <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-semibold mb-1">
              <span>🌙 Overnight &amp; Prev Session</span>
              <span className="text-cyan-400">Futures Align</span>
            </div>
            <div className="font-bold text-white text-xs">{overnight.label}</div>
            <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
              <span>Önceki Gün: {previousSession.label.split("(")[0]}</span>
              <span className="text-emerald-400">Gap: +{overnight.gapPts} pts</span>
            </div>
          </div>
        </div>

        {/* Sağ: Tarihsel Analog & İstatistikler (4 Kolon) */}
        <div className="md:col-span-4 bg-[#070a11] p-3.5 rounded-lg border border-cyan-500/20 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-cyan-400 mb-2 border-b border-white/[0.04] pb-1.5">
              <span>📊 Historical Analog Kohortu</span>
              <span>{analog.sampleSize} Seans Eşleşti</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Tarihsel Eğilim:</span>
                <span className="font-bold text-emerald-400">
                  {analog.directionalDistribution.bullishCount}/{analog.sampleSize} Yukarı (%{analog.directionalDistribution.bullishPct.toFixed(1)})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Medyan 30m Hareketi:</span>
                <span className="font-bold text-white">+{analog.median30mMovePts} SPX Puan</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">MFE / MAE Oranı:</span>
                <span className="font-medium text-slate-300">
                  <span className="text-emerald-400 font-bold">+{analog.medianMFE}</span> /{" "}
                  <span className="text-rose-400 font-bold">{analog.medianMAE}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/[0.04] flex justify-between items-center text-[10px]">
            <span className="text-slate-500">En Yakın Analog Tarih:</span>
            <span className="font-mono text-cyan-300 font-bold">
              {analog.nearestAnalogDate} (%{analog.nearestAnalogSimilarity} Benzerlik)
            </span>
          </div>
        </div>
      </div>

      {/* EN KRİTİK GÜVENLİK KİLİDİ: LIVE OVERRIDE BAR */}
      <div className="bg-[#050811] p-3 rounded-lg border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Live Override:
          </span>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${overrideBadgeColor}`}>
            {overrideTitle}
          </span>
        </div>
        <p className="text-[11px] text-slate-300 leading-tight">
          💡 <span className="text-slate-400">{liveOverrideExplanation}</span>
        </p>
      </div>
    </div>
  );
}
