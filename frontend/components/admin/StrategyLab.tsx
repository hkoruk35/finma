"use client";

import React, { useState } from "react";

export default function StrategyLab({ spxPrice, currentState }: { spxPrice: number; currentState: string }) {
  const [budget, setBudget] = useState("300");
  const [expectation, setExpectation] = useState("Sistem Seçsin (Tavsiye)");
  const [duration, setDuration] = useState("15-45 dk (Momentum)");

  const [source, setSource] = useState("live");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      // Simulate vision model processing (mock)
      setTimeout(() => {
        setIsUploading(false);
        // Simulate checking spot price
        if (Math.abs(spxPrice - 7784.05) > 1) {
          setUploadResult("stale");
        } else {
          setUploadResult("success");
        }
      }, 2500);
    }
  };

  const isNeutral = currentState.includes("CHOP") || currentState.includes("NEUTRAL");
  const isBullish = currentState.includes("LONG");
  
  // Basit Mock Stratejiler
  const strategies = [
    {
      family: isNeutral ? "IRON CONDOR" : isBullish ? "BULL CALL SPREAD" : "BEAR PUT SPREAD",
      tag: "🥇 En Dengeli",
      color: "border-[#00d2ff]/40 shadow-[0_0_15px_rgba(0,210,255,0.1)]",
      legs: isNeutral ? "Buy 7780 P, Sell 7785 P, Sell 7790 C, Buy 7795 C" : isBullish ? "Buy 7790 C / Sell 7800 C" : "Buy 7785 P / Sell 7775 P",
      cost: isNeutral ? "Net Credit: $120" : "Net Debit: $240",
      maxLoss: isNeutral ? "$380" : "$240",
      maxProfit: isNeutral ? "$120" : "$760",
      breakeven: isNeutral ? "7783.80 - 7791.20" : isBullish ? "7792.40" : "7782.60",
      reason: "Mevcut arbitraj skoru ve volatilite dikkate alındığında risk/getiri oranı en optimum strateji.",
      invalidation: "ES VWAP değişimi veya ani hacim artışı",
    },
    {
      family: isNeutral ? "IRON BUTTERFLY" : isBullish ? "BULL PUT SPREAD" : "BEAR CALL SPREAD",
      tag: "🛡️ En Düşük Risk",
      color: "border-slate-500/30",
      legs: isNeutral ? "Buy 7780 P, Sell 7785 P, Sell 7785 C, Buy 7790 C" : isBullish ? "Buy 7785 P / Sell 7790 P" : "Buy 7795 C / Sell 7790 C",
      cost: "Net Credit: $150",
      maxLoss: "$350",
      maxProfit: "$150",
      breakeven: isNeutral ? "7783.50 - 7786.50" : isBullish ? "7788.50" : "7791.50",
      reason: "Bütçeyi minimumda tutarak, sadece fiyatın belirli bir yöne gitmemesine odaklanır.",
      invalidation: "Fiyatın hızlı trende girmesi",
    },
    {
      family: isNeutral ? "CALENDAR SPREAD" : isBullish ? "LONG CALL" : "LONG PUT",
      tag: "🚀 En Agresif",
      color: "border-slate-500/30",
      legs: isNeutral ? "Sell 0DTE 7785 C, Buy 1DTE 7785 C" : isBullish ? "Buy 7795 C" : "Buy 7775 P",
      cost: "Net Debit: $280",
      maxLoss: "$280",
      maxProfit: isNeutral ? "Değişken" : "Sınırsız",
      breakeven: "Geniş hareket gerektirir",
      reason: "Risk limitine yakın maliyetle en yüksek patlama potansiyelini sunar. Yunan duyarlılığı yüksektir.",
      invalidation: "Piyasanın hareketsiz kalması (Theta çürümesi)",
    },
  ];

  return (
    <div className="mt-8 pt-6 border-t border-white/[0.08]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <h2 className="text-lg font-bold text-white tracking-wide">Strategy Lab <span className="text-slate-400 font-normal text-sm ml-2">| Budget-Aware Options Engine</span></h2>
        </div>
        <div className="flex bg-[#070a11] border border-white/[0.08] rounded-lg p-1 self-start md:self-auto">
          <button 
            onClick={() => setSource("live")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${source === "live" ? "bg-[#00d2ff]/20 text-[#00d2ff]" : "text-slate-400 hover:text-white"}`}
          >
            Canlı Veri (OPRA)
          </button>
          <button 
            onClick={() => setSource("screenshot")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${source === "screenshot" ? "bg-amber-400/20 text-amber-400" : "text-slate-400 hover:text-white"}`}
          >
            <span>📸</span> Ekran Görüntüsü Yükle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#070a11] p-3 rounded-lg border border-white/[0.06]" title="Piyasanın mevcut algoritmik durumu (Trend yönü)">
          <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1 cursor-help">Deterministik State</label>
          <div className="text-sm font-medium text-white">{currentState.replace(/_/g, " ")}</div>
        </div>
        <div className="bg-[#070a11] p-3 rounded-lg border border-white/[0.06]" title="Bu strateji için göze aldığınız maksimum kayıp miktarı">
          <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1 cursor-help">Maksimum Risk Bütçesi ($)</label>
          <input 
            type="number" 
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="bg-transparent border-b border-white/[0.1] text-white text-sm font-bold outline-none w-full pb-1 focus:border-amber-400 transition-colors"
          />
        </div>
        <div className="bg-[#070a11] p-3 rounded-lg border border-white/[0.06]" title="Sistemin sizin yerinize karar vermesi veya manuel fiyat hareketi beklentiniz">
          <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1 cursor-help">Piyasa Beklentisi</label>
          <select 
            value={expectation}
            onChange={(e) => setExpectation(e.target.value)}
            className="bg-transparent border-b border-white/[0.1] text-slate-300 text-sm outline-none w-full pb-1 focus:border-[#00d2ff]"
          >
            <option className="bg-[#070a11]">Sistem Seçsin (Tavsiye)</option>
            <option className="bg-[#070a11]">Güçlü Yükseliş</option>
            <option className="bg-[#070a11]">Yatay / Kapsam İçi</option>
            <option className="bg-[#070a11]">Güçlü Düşüş</option>
          </select>
        </div>
        <div className="bg-[#070a11] p-3 rounded-lg border border-white/[0.06]" title="Bu işlemin ne kadar sürede hedefe ulaşmasını planladığınız">
          <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1 cursor-help">Hedef Süre</label>
          <select 
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="bg-transparent border-b border-white/[0.1] text-slate-300 text-sm outline-none w-full pb-1 focus:border-[#00d2ff]"
          >
            <option className="bg-[#070a11]">5-15 dk (Scalp)</option>
            <option className="bg-[#070a11]">15-45 dk (Momentum)</option>
            <option className="bg-[#070a11]">Gün Sonu</option>
          </select>
        </div>
      </div>

      {source === "screenshot" && (
        <div className="mb-6 bg-[#0a0e17] border-2 border-dashed border-white/[0.1] rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all hover:border-[#00d2ff]/50">
          {!isUploading && !uploadResult ? (
            <>
              <div className="text-4xl mb-3">📸</div>
              <div className="text-sm font-semibold text-white mb-1">Broker Ekran Görüntüsü Yükle</div>
              <div className="text-xs text-slate-400 mb-4">IBKR veya Robinhood opsiyon zinciri görüntüsünü sürükleyin veya seçin</div>
              <label className="bg-[#00d2ff]/10 text-[#00d2ff] hover:bg-[#00d2ff]/20 px-4 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors border border-[#00d2ff]/20">
                Dosya Seç
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </>
          ) : isUploading ? (
            <>
              <div className="w-8 h-8 border-2 border-[#00d2ff] border-t-transparent rounded-full animate-spin mb-3"></div>
              <div className="text-sm font-semibold text-white">Vision Model İşliyor...</div>
              <div className="text-xs text-slate-400">Grev fiyatları, spreadler ve IV çıkarılıyor</div>
            </>
          ) : (
            <div className="flex flex-col items-center w-full">
              <div className="text-emerald-400 text-3xl mb-2">✅</div>
              <div className="text-sm font-bold text-white mb-1">Görüntü İşlendi (Mock Data)</div>
              <div className="text-xs text-slate-400 mb-4">Spot: 7784.05 | Hedef: 0DTE | Spreadler okundu</div>
              {uploadResult === "stale" && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-md text-xs font-medium w-full max-w-md text-left mb-4">
                  <strong className="block mb-1">⚠️ SCREENSHOT STALE / MARKET MOVED</strong>
                  Görüntüdeki (7784.05) ile anlık SPX fiyatı ({spxPrice.toFixed(2)}) arasında büyük fark var.
                </div>
              )}
              <button onClick={() => setUploadResult(null)} className="text-[10px] text-slate-500 hover:text-white underline">
                Yeni Görüntü Yükle
              </button>
            </div>
          )}
        </div>
      )}

      <div className="text-[11px] text-slate-400 mb-3 flex items-center justify-between">
        <span>Kısıtlamalara göre optimize edilmiş Risk/Getiri yapıları:</span>
        <span className="text-amber-400">Analiz Edilen Kombinasyon: 142</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {strategies.map((str, idx) => (
          <div key={idx} className={`bg-[#070a11] rounded-xl border ${str.color} flex flex-col p-4 transition-all hover:scale-[1.02] cursor-default`}>
            <div className="flex justify-between items-start mb-4 border-b border-white/[0.04] pb-3">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{str.tag}</div>
                <div className="text-base font-bold text-white">{str.family}</div>
              </div>
            </div>
            
            <div className="space-y-2 text-xs flex-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Bacaklar (Legs):</span>
                <span className="font-medium text-[#00d2ff]">{str.legs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Maliyet / Kredi:</span>
                <span className="font-medium text-white">{str.cost}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Max Risk:</span>
                <span className="font-bold text-rose-400">{str.maxLoss}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Max Kâr:</span>
                <span className="font-bold text-emerald-400">{str.maxProfit}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-white/[0.04]">
                <span className="text-slate-500">Breakeven:</span>
                <span className="font-medium text-amber-300">{str.breakeven}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <span>🤖</span> Neden Seçildi?
              </div>
              <div className="text-[11px] text-slate-300 leading-relaxed mb-3">
                {str.reason}
              </div>
              
              <div className="text-[10px] font-bold text-rose-400/80 uppercase mb-1">İptal / Geçersizlik</div>
              <div className="text-[11px] text-slate-400">{str.invalidation}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
