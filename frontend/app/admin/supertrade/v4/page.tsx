"use client";

import { useEffect, useState } from "react";
import { Badge, Panel, Row, signed, toneClass } from "@/components/admin/supertrade/ui";
import type { AssetClass, AssetSnapshot } from "@/lib/v4/types";
import { ASSET_MAP } from "@/lib/v4/types";

// V4 Özel Bileşenleri
import MultiAssetDetail from "@/components/admin/v4/MultiAssetDetail";

type AssetResult = (AssetSnapshot & { ok: true }) | { ok: false; error: string };

export default function SuperTradeV4Dashboard() {
  const [selectedAsset, setSelectedAsset] = useState<AssetClass | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, AssetResult>>({});
  const [loading, setLoading] = useState(true);

  // Dashboard verilerini çek
  useEffect(() => {
    if (selectedAsset) return;

    const fetchAll = async () => {
      try {
        const res = await fetch("/api/admin/supertrade/v4?symbol=ALL");
        const data = await res.json();
        if (data.results) {
          setSnapshots(data.results);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, 20000);
    return () => clearInterval(id);
  }, [selectedAsset]);

  if (selectedAsset) {
    const selectedData = snapshots[selectedAsset];
    const selectedSnapshot = selectedData && selectedData.ok ? selectedData : null;
    const selectedError = selectedData && !selectedData.ok ? selectedData.error : null;
    return (
      <div className="p-4 md:p-5 bg-[#0a0e17] min-h-screen text-slate-300">
        <button
          onClick={() => setSelectedAsset(null)}
          className="mb-4 flex items-center gap-2 text-[12px] text-slate-400 hover:text-white transition-colors"
        >
          ← Dashboard&apos;a Dön
        </button>
        <MultiAssetDetail
          asset={selectedAsset}
          snapshot={selectedSnapshot}
          loading={loading}
          error={selectedError}
        />
      </div>
    );
  }

  const assets: AssetClass[] = ["SPX", "SPY", "XSP", "NDX", "QQQ", "XND"];

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 text-slate-300 md:p-5">
      <header className="mb-6 flex flex-col gap-2 border-b border-[#1c2635] pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-medium tracking-tight text-[#3b82f6]">
            Multi-Asset Fırsat Tarayıcı
          </h1>
          <Badge tone="brand">SuperTrade V4</Badge>
        </div>
        <p className="text-[12px] text-slate-500">
          S&P 500 ve Nasdaq ekosistemindeki tüm endeks ve ETF&apos;lerin anlık kırılım ve yön teyidi.
        </p>
      </header>

      {loading && Object.keys(snapshots).length === 0 ? (
        <div className="text-[13px] text-slate-400">Veriler yükleniyor...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const data = snapshots[asset];
            const meta = ASSET_MAP[asset];
            
            if (!data || !data.ok) {
              return (
                <Panel key={asset} padding="p-4" className="opacity-50">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[16px] font-medium text-slate-300">{asset}</div>
                    <Badge tone="neutral">Veri Yok</Badge>
                  </div>
                  <div className="text-[11px] text-slate-500">{meta.name}</div>
                </Panel>
              );
            }

            const frame = data.frames[data.frames.length - 1];
            const isConfirmed = frame.state.includes("CONFIRMED") || frame.state.includes("STRONG");
            const direction = frame.state.includes("LONG") ? "LONG" : frame.state.includes("SHORT") ? "SHORT" : "NEUTRAL";
            const dirTone = direction === "LONG" ? "up" : direction === "SHORT" ? "down" : "neutral";

            return (
              <div 
                key={asset} 
                onClick={() => setSelectedAsset(asset)}
                className={`cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-[#3b82f6]/50 ${isConfirmed ? 'ring-1 ring-[#3b82f6]/30 bg-[#3b82f6]/[0.02]' : ''}`}
              >
                <Panel padding="p-4" className="h-full">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[18px] font-medium text-slate-100">{asset}</span>
                        {isConfirmed && <div className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse" />}
                      </div>
                      <div className="text-[11px] text-slate-500">{meta.name}</div>
                    </div>
                    <Badge tone={dirTone}>{direction === "NEUTRAL" ? "YÖNSÜZ" : direction}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 border-y border-[#1c2635] py-3">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Spot Fiyat</div>
                      <div className="text-[14px] font-medium text-slate-200">{data.spotPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Net Skor</div>
                      <div className={`text-[14px] font-medium ${toneClass(frame.netScore)}`}>
                        {signed(frame.netScore, 1)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Row 
                      label="Durum" 
                      value={frame.state} 
                      valueClass={isConfirmed ? (direction === "LONG" ? "text-[#22c55e]" : "text-[#ef4444]") : "text-slate-300"} 
                    />
                    <Row 
                      label="VWAP Yakınlığı" 
                      value={`${Math.abs(data.spotPrice - data.levels.futures.vwap).toFixed(2)} pts`} 
                    />
                  </div>
                </Panel>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
