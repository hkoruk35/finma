"use client";

/**
 * SPY Engine — Tahmin sekmeleri:
 *   1) 15m setup tahmini: 1h/4h teyitli 15m setup çizimleri + sonraki 4 adet 15m mum simülasyonu (Setup15Panel).
 *   2) Mevcut tahmin haritası (mapTab) — aynen korunur.
 * (Eski "Günlük tahmin" ve "1 saatlik tahmin" sekmeleri 2026-10-11 kullanıcı talebiyle kaldırıldı.)
 */

import { useSyncExternalStore, type ReactNode } from "react";

const TAB_KEY = "spyengine_fc_tab2";
const tabListeners = new Set<() => void>();
function subscribeTab(l: () => void) {
  tabListeners.add(l);
  window.addEventListener("storage", l);
  return () => { tabListeners.delete(l); window.removeEventListener("storage", l); };
}
function readTab(): number {
  try { const v = window.localStorage.getItem(TAB_KEY); return v == null ? -1 : Number(v); } catch { return -1; }
}

export default function ForecastTabs({ setupTab, mapTab, initialTab = 0 }: {
  /** 15m setup + 4 mum tahmini */
  setupTab: ReactNode;
  /** Mevcut tahmin haritası */
  mapTab: ReactNode;
  initialTab?: 0 | 1;
}) {
  // son seçilen sekme tarayıcıda hatırlanır (yalnız kişisel kolaylık; okunamazsa varsayılan)
  const stored = useSyncExternalStore(subscribeTab, readTab, () => -1);
  const tab: 0 | 1 = stored === 0 || stored === 1 ? stored : initialTab;
  const setTab = (v: 0 | 1) => {
    try { window.localStorage.setItem(TAB_KEY, String(v)); } catch { /* depolama kapalıysa yok say */ }
    tabListeners.forEach((l) => l());
  };
  const tabs = ["15m setup tahmini", "Tahmin haritası"] as const;
  return (
    <div className="overflow-hidden rounded-lg border border-[#1c2635] bg-[#0f141d]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#1c2635] px-2 py-1.5">
        {tabs.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i as 0 | 1)}
            className={`rounded px-3 py-1 text-[12px] font-semibold ${tab === i ? "bg-[#1c2635] text-slate-100" : "text-slate-400 hover:bg-[#151c28]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 0 ? setupTab : mapTab}
    </div>
  );
}
