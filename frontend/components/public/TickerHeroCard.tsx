"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/copy";
import { formatNumber } from "@/lib/formatNumber";

// 2026-08-24 kullanıcı talebiyle eklendi: arama kutusunun hemen altına,
// grafiğin hemen üstüne — ticker/skor/şirket adı/fiyat + hissenin en çok
// tepki verdiği ortalamayı (EMA20/50/200) gösteren bir "hero" kartı.
// Örnek referans: admin-only Derin Analiz raporunun (DeepAnalysisReport.tsx)
// üst kısmı — AMA o rapor tamamen Premium'a kilitli (/api/deep-analysis).
// Kullanıcı bu kartın HERKESE açık olmasını istedi, bu yüzden burada AYRI
// ve HAFİF bir veri yolu kullanılıyor:
//   - /api/preorder-analysis (bu sayfada zaten TickerDetailPanel'in
//     kullandığı, ücretsiz/güvenilir uç nokta) → skor, fiyat, şirket adı,
//     EMA20/50/200.
//   - Rejim ("UPTREND REGIME" vb.) ve "en çok tepki veren ortalama" burada
//     YEREL olarak hesaplanıyor (fiyat vs EMA20/50/200) — Derin Analiz'in
//     kendi classifyEMAProfile() fonksiyonuyla AYNI temel mantık (fiyat tüm
//     EMA'ların üstündeyse EMA20, hepsinin altındaysa EMA200, aksi halde
//     EMA50 "kilit" ortalama kabul edilir), ama piyasa değeri/golden-cross
//     gibi Premium-only sinyalleri kullanmıyor — bu yüzden birebir aynı
//     sınıflandırmayı iddia etmiyor, sade bir yaklaşık değer.
//   - Açıklama cümlesi AI DEĞİL, rejime göre şablonlanmış tek cümle —
//     Derin Analiz'deki AI yorumunu (Premium-only, /api/deep-analysis'in
//     LLM çağrısı) burada tekrar üretmiyoruz.

interface Props {
  ticker: string;
  locale: Locale;
  sector?: string | null;
  marketCapStr?: string | null;
}

interface PreorderLite {
  company?: string;
  price?: number;
  bogaScore?: { trend: number; momentum: number; liquidity: number };
  timeframes?: { d1?: { ema20?: number; ema50?: number; ema200?: number } };
}

const L = (lang: Locale, tr: string, en: string) => (lang === "tr" ? tr : en);

function fmtUsd(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "—";
  return "$" + formatNumber(v, 2);
}

export default function TickerHeroCard({ ticker, locale, sector, marketCapStr }: Props) {
  const [data, setData] = useState<PreorderLite | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setFailed(false);
    const langParam = locale && locale !== "tr" ? `&lang=${locale}` : "";
    fetch(`/api/preorder-analysis?ticker=${encodeURIComponent(ticker)}${langParam}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d || d.error || !d.price) setFailed(true);
        else setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, locale]);

  if (failed || !data) return null;

  const price = data.price ?? 0;
  const ema20 = data.timeframes?.d1?.ema20 ?? 0;
  const ema50 = data.timeframes?.d1?.ema50 ?? 0;
  const ema200 = data.timeframes?.d1?.ema200 ?? 0;
  const hasEma = ema20 > 0 && ema50 > 0 && ema200 > 0;

  const aboveAll = hasEma && price > ema20 && price > ema50 && price > ema200;
  const belowAll = hasEma && price < ema20 && price < ema50 && price < ema200;
  const keyEMA = aboveAll ? "EMA20" : belowAll ? "EMA200" : "EMA50";
  const regimeLbl = aboveAll
    ? L(locale, "YÜKSELİŞ REJİMİ", "UPTREND REGIME")
    : belowAll
    ? L(locale, "DÜŞÜŞ REJİMİ", "DOWNTREND REGIME")
    : L(locale, "GEÇİŞ / KONSOLİDASYON", "TRANSITION / CONSOLIDATION");
  const regimeCls = aboveAll
    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/8"
    : belowAll
    ? "text-rose-400 border-rose-500/30 bg-rose-500/8"
    : "text-amber-400 border-amber-500/30 bg-amber-500/8";

  const score = data.bogaScore
    ? Math.round(((data.bogaScore.trend ?? 0) + (data.bogaScore.momentum ?? 0) + (data.bogaScore.liquidity ?? 0)) / 3)
    : null;
  const scoreCls =
    score == null
      ? "border-slate-600/40 bg-slate-700/10 text-slate-300"
      : score >= 70
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
      : score >= 50
      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
      : "border-rose-500/40 bg-rose-500/10 text-rose-400";

  const description = hasEma
    ? aboveAll
      ? L(
          locale,
          `${sector ? sector + " sektöründeki hisse, " : "Hisse, "}fiyatın tüm önemli hareketli ortalamaların üzerinde olmasıyla yükseliş eğiliminde.`,
          `${sector ? sector + " stock with" : "Stock with"} a bullish drift as price is above key moving averages.`
        )
      : belowAll
      ? L(
          locale,
          `${sector ? sector + " sektöründeki hisse, " : "Hisse, "}fiyatın tüm önemli hareketli ortalamaların altında olmasıyla düşüş baskısı altında.`,
          `${sector ? sector + " stock" : "Stock"} under pressure as price sits below key moving averages.`
        )
      : L(
          locale,
          `${sector ? sector + " sektöründeki hisse, " : "Hisse, "}hareketli ortalamalar etrafında konsolide oluyor — yön için kırılım bekleniyor.`,
          `${sector ? sector + " stock" : "Stock"} consolidating around key moving averages — awaiting a breakout for direction.`
        )
    : null;

  return (
    <div className="glass-card p-4 md:p-5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-[20px] md:text-[22px] font-medium text-white tracking-tight">{ticker}</span>
            {score != null && <span className={`border rounded-full px-2.5 py-0.5 text-[12px] font-medium ${scoreCls}`}>{score}/100</span>}
          </div>
          {data.company && <div className="text-[13px] text-slate-200 font-medium mb-0.5 truncate">{data.company}</div>}
          {(sector || marketCapStr) && (
            <div className="text-[11px] text-slate-500">
              {sector}
              {sector && marketCapStr ? " · " : ""}
              {marketCapStr}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[22px] md:text-[26px] font-medium text-white leading-none">{fmtUsd(price)}</div>
          <div className="text-[10px] text-slate-500 mt-1">{L(locale, "Güncel Fiyat", "Current Price")}</div>
        </div>
      </div>

      {hasEma && (
        <div className={`inline-flex items-center border rounded-lg px-2.5 py-1 mt-3 ${regimeCls}`}>
          <span className="text-[10px] font-medium tracking-wider">{regimeLbl}</span>
          <span className="ml-2 text-[9px] opacity-70">
            · {keyEMA} {L(locale, "Hissesi", "Stock")}
          </span>
        </div>
      )}

      {description && <p className="text-[12px] text-slate-300 leading-relaxed mt-3 border-l-2 border-cyan-500/40 pl-3">{description}</p>}
    </div>
  );
}
