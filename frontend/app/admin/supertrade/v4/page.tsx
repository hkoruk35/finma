"use client";

import { useEffect, useState } from "react";
import { Badge, Panel, Table, TBody, Td, Th, THead, Tr, fmt, signed, titleCase, toneClass } from "@/components/admin/supertrade/ui";
import type { AssetClass, AssetSnapshot } from "@/lib/v4/types";
import { ASSET_MAP } from "@/lib/v4/types";

// V4 Özel Bileşenleri
import MultiAssetDetail from "@/components/admin/v4/MultiAssetDetail";

type AssetResult = (AssetSnapshot & { ok: true }) | { ok: false; error: string };

const ASSETS: AssetClass[] = ["SPX", "SPY", "XSP", "NDX", "QQQ", "XND"];

/** Dashboard satırı ve varlık-geçiş menüsü ortak durum türetimi — ikisi de
 *  aynı yön/renk mantığını kullanır, tek yerden yönetilir. */
function deriveAssetMeta(data: AssetResult | undefined) {
  if (!data || !data.ok) return null;
  const frame = data.frames[data.frames.length - 1];
  const isConfirmed = frame.state.includes("CONFIRMED") || frame.state.includes("STRONG");
  const direction: "LONG" | "SHORT" | "NEUTRAL" = frame.state.includes("LONG")
    ? "LONG"
    : frame.state.includes("SHORT")
    ? "SHORT"
    : "NEUTRAL";
  return { frame, isConfirmed, direction };
}

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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSelectedAsset(null)}
            className="flex items-center gap-2 text-[12px] text-slate-400 hover:text-white transition-colors"
          >
            ← Dashboard&apos;a Dön
          </button>
          <div className="h-4 w-px bg-[#1c2635]" />
          <div className="flex flex-wrap items-center gap-1.5">
            {ASSETS.map((a) => {
              const meta = deriveAssetMeta(snapshots[a]);
              const active = a === selectedAsset;
              const dotClass = !meta
                ? "bg-slate-600"
                : meta.direction === "LONG"
                ? "bg-[#22c55e]"
                : meta.direction === "SHORT"
                ? "bg-[#ef4444]"
                : "bg-slate-500";
              return (
                <button
                  key={a}
                  onClick={() => setSelectedAsset(a)}
                  title={ASSET_MAP[a].name}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]"
                      : "border-[#1c2635] text-slate-400 hover:border-[#2a3648] hover:text-slate-200"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  {a}
                </button>
              );
            })}
          </div>
        </div>
        <MultiAssetDetail
          asset={selectedAsset}
          snapshot={selectedSnapshot}
          loading={loading}
          error={selectedError}
        />
      </div>
    );
  }

  const assets = ASSETS;
  // Herhangi bir varlık gece yarısını geçip yeni seansa henüz gerçek veri
  // gelmemişse dashboard genelinde tek bir uyarı gösterilir (her satırda
  // tekrarlamak yerine).
  const anyNextDay = assets.some((a) => {
    const d = snapshots[a];
    return d && d.ok && d.rollover.isNextDay;
  });

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 text-slate-300 md:p-5">
      <header className="mb-6 flex flex-col gap-2 border-b border-[#1c2635] pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-medium tracking-tight text-[#3b82f6]">
            Multi-Asset Fırsat Tarayıcı
          </h1>
          <Badge tone="brand">SuperTrade V4</Badge>
          {anyNextDay && <Badge tone="neutral">Sonraki seans için hazır</Badge>}
        </div>
        <p className="text-[12px] text-slate-500">
          S&P 500 ve Nasdaq ekosistemindeki tüm endeks ve ETF&apos;lerin anlık kırılım ve yön teyidi.
        </p>
      </header>

      {loading && Object.keys(snapshots).length === 0 ? (
        <div className="text-[13px] text-slate-400">Veriler yükleniyor...</div>
      ) : (
        <Panel padding="p-0">
          <Table bordered={false}>
            <THead>
              <tr>
                <Th>Varlık</Th>
                <Th align="right">Fiyat</Th>
                <Th align="right">Net Skor</Th>
                <Th>Durum</Th>
                <Th align="right">VWAP Yakınlığı</Th>
                <Th align="center">Yön</Th>
              </tr>
            </THead>
            <TBody>
              {assets.map((asset) => {
                const data = snapshots[asset];
                const meta = ASSET_MAP[asset];

                if (!data || !data.ok) {
                  return (
                    <Tr key={asset} className="opacity-50">
                      <Td>
                        <div className="font-medium text-slate-300">{asset}</div>
                        <div className="text-[11px] font-normal text-slate-500">{meta.name}</div>
                      </Td>
                      <Td colSpan={4} valueClass="text-slate-500">
                        —
                      </Td>
                      <Td align="center">
                        <Badge tone="neutral">Veri Yok</Badge>
                      </Td>
                    </Tr>
                  );
                }

                const meta2 = deriveAssetMeta(data)!;
                const { frame, isConfirmed, direction } = meta2;
                const dirTone = direction === "LONG" ? "up" : direction === "SHORT" ? "down" : "neutral";
                // Durum rengi teyit gücünden bağımsız, her zaman yöne göredir —
                // zayıf bir SHORT sinyali de kırmızı, zayıf bir LONG da yeşil kalır.
                const statusClass =
                  direction === "LONG" ? "text-[#22c55e]" : direction === "SHORT" ? "text-[#ef4444]" : "text-slate-300";
                const vwapDistance = Math.abs(data.spotPrice - data.levels.futures.vwap);

                return (
                  <Tr
                    key={asset}
                    onClick={() => setSelectedAsset(asset)}
                    className={isConfirmed ? "bg-[#3b82f6]/[0.03]" : ""}
                  >
                    <Td>
                      <div className="flex items-center gap-2 font-medium text-slate-100">
                        {asset}
                        {isConfirmed && <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse" />}
                        {data.rollover.isNextDay && (
                          <Badge tone="brand" className="ml-1">
                            {data.rollover.nextTradingDate}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] font-normal text-slate-500">{meta.name}</div>
                    </Td>
                    <Td align="right">{fmt(data.spotPrice)}</Td>
                    <Td align="right" valueClass={`font-semibold ${toneClass(frame.netScore)}`}>
                      {signed(frame.netScore, 1)}
                    </Td>
                    <Td valueClass={`font-medium ${statusClass}`}>{titleCase(frame.state.replace(/_/g, " "))}</Td>
                    <Td align="right">{fmt(vwapDistance)} puan</Td>
                    <Td align="center">
                      <Badge tone={dirTone}>{direction === "NEUTRAL" ? "Yönsüz" : direction}</Badge>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
