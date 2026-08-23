"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/copy";

// 2026-08-23 kullanıcı düzeltmesi: HomeFeaturedTrendCard.tsx'e önce
// TickerDetailPanel'in TAMAMI (Teknik Göstergeler / Piyasa Verileri / İşlem
// Planı kartları dahil) gömülmüştü — kullanıcı bunu istemedi, sadece "24/7
// Yapay Zeka Grafik & Piyasa Yorumlayıcısı" başlığı altındaki METİNLERİ
// (özet + Kritik Seviyeler & Pivotlar + Hacim & Hareketlilik) istedi. Bu
// bileşen aynı /api/preorder-analysis kaynağından SADECE o üç metni çeker,
// hiçbir teknik gösterge kartı render etmez.
interface Commentary {
  summary: string;
  keyLevels: string;
  liquidityVolume: string;
}

const LABELS: Record<Locale, { title: string; keyLevels: string; volume: string }> = {
  tr: { title: "24/7 Yapay Zeka Piyasa Yorumu", keyLevels: "Kritik Seviyeler & Pivotlar", volume: "Hacim & Hareketlilik" },
  en: { title: "24/7 AI Market Commentary", keyLevels: "Key Levels & Pivots", volume: "Volume & Volatility" },
  es: { title: "Comentario de Mercado IA 24/7", keyLevels: "Niveles Clave y Pivotes", volume: "Volumen y Volatilidad" },
  fr: { title: "Commentaire de Marché IA 24/7", keyLevels: "Niveaux Clés et Pivots", volume: "Volume et Volatilité" },
  pt: { title: "Comentário de Mercado IA 24/7", keyLevels: "Níveis-Chave e Pivôs", volume: "Volume e Volatilidade" },
  id: { title: "Komentar Pasar AI 24/7", keyLevels: "Level Kunci & Pivot", volume: "Volume & Volatilitas" },
};

export default function HomeFeaturedTrendCommentary({ ticker, locale }: { ticker: string; locale: Locale }) {
  const t = LABELS[locale] ?? LABELS.en;
  const [data, setData] = useState<Commentary | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const langParam = locale && locale !== "tr" ? `&lang=${locale}` : "";
    fetch(`/api/preorder-analysis?ticker=${encodeURIComponent(ticker)}${langParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setData(d?.aiCommentary ?? null); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, [ticker, locale]);

  if (data === undefined) {
    return <div className="h-20 rounded-lg bg-white/[0.02] animate-pulse" />;
  }
  if (!data || !data.summary) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
        <p className="text-[13px] font-bold text-[#3b82f6]">{t.title}</p>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed mb-3">{data.summary}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.keyLevels && (
          <div className="bg-white/[0.02] border border-[#1e2a3a] rounded-lg p-2.5">
            <p className="text-[12px] font-bold text-[#3b82f6] mb-1">🎯 {t.keyLevels}</p>
            <p className="text-[13px] text-slate-300 leading-relaxed">{data.keyLevels}</p>
          </div>
        )}
        {data.liquidityVolume && (
          <div className="bg-white/[0.02] border border-[#1e2a3a] rounded-lg p-2.5">
            <p className="text-[12px] font-bold text-[#3b82f6] mb-1">💧 {t.volume}</p>
            <p className="text-[13px] text-slate-300 leading-relaxed">{data.liquidityVolume}</p>
          </div>
        )}
      </div>
    </div>
  );
}
