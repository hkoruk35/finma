"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import PremiumModal from "@/components/global/PremiumModal";
import { formatNumber } from "@/lib/formatNumber";
import { computeTechnicalRefs, type TechRefsHorizon } from "@/lib/technicalRefsEngine";

// 2026-08-24 kullanıcı talebiyle eklendi: /global/{locale}/graphic/{ticker}
// sayfasını, admin altına taşınan Derin Analiz raporundaki (DeepAnalysisReport.tsx)
// bazı bölümlerle zenginleştiriyor — AYNI /api/deep-analysis kaynağından,
// AYNI computeTechnicalRefs() motorundan (bkz. lib/technicalRefsEngine.ts):
//   1) Kritik Seviyeler (R1-R3/S1-S3, VWAP20D, POC20D, Hareketli Ortalamalar)
//   2) Katalizör Takvimi (sıradaki bilanço, tez iptal seviyesi, bilanço geçmişi)
//   3) 13F Kurumsal Sahiplik
//   4) Teknik Referanslar (Swing/Position/Invest — giriş/stop/T1-T3/R:R/trailing)
//
// ÖNEMLİ — erişim modeli: /api/deep-analysis sunucu tarafında hasDataAccess()
// (=== aktif Premium plan) ile korunuyor, sadece Trade Plan kartı değil TÜM
// yanıt (bkz. app/api/deep-analysis/route.ts POST handler'ının başındaki
// hasDataAccess kontrolü). Yani bu panelin dört bölümü de fiilen Premium'a
// özel — free/anonim ziyaretçiye tek bir "Premium'a Yükselt" kartı gösterilir,
// hiçbir veri çekilmez/sızmaz. Mevcut premium modeli DEĞİŞTİRİLMEDİ, sadece
// admin'e taşınan raporun Premium üyelere sunduğu değer artık normal grafik
// sayfasında da (aynı erişim kuralıyla) görünüyor.
//
// 2026-08-24 DÜZELTME: İlk sürüm bu panele stockData'yı üst bileşenden
// (GraphicDetailContent'in kendi /api/ask çağrısından) prop olarak alıyordu.
// Canlıda /api/ask bazı ticker'larda 504 (timeout) veriyor — bu, üst
// bileşenin stockData'sını hiç dolduramamasına ve panelin SESSİZCE hiç
// render olmamasına yol açtı (kullanıcı: "hiçbir şey değişmedi"). Bu artık
// KENDİ /api/preorder-analysis çağrısını yapıyor — bu uç nokta zaten aynı
// sayfada TickerDetailPanel tarafından güvenilir şekilde kullanılıyor
// (bkz. components/public/TickerDetailPanel.tsx) — ve dönen veriden
// /api/deep-analysis'in beklediği stockData şeklini kendi inşa ediyor.
// Böylece kırılgan /api/ask'e bağımlılık tamamen kaldırıldı.

interface Props {
  ticker: string;
  locale: Locale;
}

const L = (lang: Locale, tr: string, en: string, es?: string, fr?: string, pt?: string, id?: string) =>
  lang === "tr" ? tr : lang === "es" ? es || en : lang === "fr" ? fr || en : lang === "pt" ? pt || en : lang === "id" ? id || en : en;

function fmtUsd(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "—";
  return "$" + formatNumber(v, 2);
}

function Chip({ label, color = "slate" }: { label: string; color?: string }) {
  const cls =
    color === "green"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : color === "red"
      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
      : color === "amber"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-slate-700/40 text-slate-400 border-slate-600/30";
  return <span className={`inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>{label}</span>;
}

function PlanRow({ label, value, valueColor = "white", note }: { label: string; value: string; valueColor?: string; note?: string }) {
  const cl =
    valueColor === "green" ? "text-emerald-400" : valueColor === "red" ? "text-rose-400" : valueColor === "amber" ? "text-amber-400" : valueColor === "cyan" ? "text-cyan-400" : "text-white";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#1e3a5f]/30 last:border-0">
      <span className="text-[12px] text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        {note && <span className="text-[10px] text-slate-600">{note}</span>}
        <span className={`text-[14px] font-medium ${cl}`}>{value}</span>
      </div>
    </div>
  );
}

const _cache = new Map<string, any>();
function cacheKey(ticker: string, lang: string) {
  return `${ticker}_${lang}_${new Date().toISOString().slice(0, 10)}`;
}

// /api/deep-analysis'in beklediği stockData şeklini, sayfada zaten
// güvenilir çalışan /api/preorder-analysis yanıtından inşa eder — bkz.
// yukarıdaki 2026-08-24 düzeltme notu. Alan eşlemesi app/api/deep-analysis/
// route.ts'nin "const s = stockData || {}; const pr = s.price..." bloğuyla
// birebir uyumlu.
function buildStockDataFromPreorder(p: any): any {
  if (!p || typeof p !== "object") return null;
  const d1 = p.timeframes?.d1 || {};
  const firstTarget = Array.isArray(p.tradePlan?.targets) ? p.tradePlan.targets[0] : null;
  return {
    company: p.company || undefined,
    price: {
      current: p.price,
      volume: p.volume,
      avg_volume_30d: p.avgVol30,
    },
    technical: {
      rsi_14: d1.rsi,
      ema_20: d1.ema20,
      ema_50: d1.ema50,
      ema_200: d1.ema200,
      atr: p.context?.atr,
      rvol: p.rvol,
      "52w_low": p.context?.lo52,
      "52w_high": p.context?.hi52,
    },
    scores: {
      master_score: p.bogaScore ? Math.round(((p.bogaScore.trend ?? 0) + (p.bogaScore.momentum ?? 0) + (p.bogaScore.liquidity ?? 0)) / 3) : undefined,
    },
    scores_detail: {
      stop_loss: p.tradePlan?.stop?.price,
      target_price: firstTarget?.price,
    },
  };
}

export default function TickerTechnicalRefsPanel({ ticker, locale }: Props) {
  const { isPremium, loading: planLoading } = useMemberPlan();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [horizon, setHorizon] = useState<TechRefsHorizon>("swing");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // ÖNEMLİ: /api/deep-analysis sunucu tarafında hasDataAccess() (=== Premium
  // plan) ile korunuyor — free/anonim ziyaretçi için 401 döner. Bu yüzden
  // bu bileşen, plan durumu netleşmeden VE sadece Premium ise fetch atar;
  // free/anonim ziyaretçiye gereksiz 401 isteği yaptırıp veriyi "kilitli"
  // göstermek yerine, aşağıdaki tek yükseltme (upsell) kartını gösterir —
  // tıpkı mevcut TickerDetailPanel'deki Trade Plan kilidi gibi.
  useEffect(() => {
    if (!ticker || planLoading || !isPremium) {
      setLoading(false);
      return;
    }
    const key = cacheKey(ticker, locale);
    const cached = _cache.get(key);
    if (cached && cached.companyName) {
      setData(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const langParam = locale && locale !== "tr" ? `&lang=${locale}` : "";
    fetch(`/api/preorder-analysis?ticker=${encodeURIComponent(ticker)}${langParam}`)
      .then((r) => r.json())
      .then((p) => {
        if (cancelled) return;
        const built = buildStockDataFromPreorder(p);
        if (!built || !built.price?.current) {
          setFailed(true);
          setLoading(false);
          return;
        }
        return fetch("/api/deep-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker, stockData: built, lang: locale }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (cancelled) return;
            if (!d || d.error) {
              setFailed(true);
            } else {
              _cache.set(key, d);
              setData(d);
            }
            setLoading(false);
          });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, locale, isPremium, planLoading]);

  if (!ticker || planLoading) return null;

  // Free/anonim ziyaretçi: veri hiç çekilmiyor, sadece tek bir yükseltme
  // kartı gösteriliyor (mevcut premium modelini bozmadan tanıtım amaçlı).
  if (!isPremium) {
    return (
      <div className="mt-4">
        {showPremiumModal && <PremiumModal locale={locale} onClose={() => setShowPremiumModal(false)} />}
        <div className="glass-card border-2 border-amber-500/40 rounded-2xl p-6 text-center cursor-pointer" onClick={() => setShowPremiumModal(true)}>
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/40">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-white uppercase tracking-wider mb-2">
            {L(locale, "Teknik Referanslar, Kritik Seviyeler & 13F — Premium", "Technical Refs, Key Levels & 13F — Premium")}
          </h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed mb-4">
            {L(
              locale,
              "Swing/Pozisyon/Yatırım ufuklarına göre Giriş Bölgesi/Stop/Hedefler, R1-R3/S1-S3 kritik seviyeler, katalizör takvimi ve 13F kurumsal sahiplik verisini görmek için Premium üyeliğe geçin.",
              "Upgrade to Premium to unlock horizon-based Entry/Stop/Targets, R1-R3/S1-S3 key levels, the catalyst calendar, and 13F institutional ownership data."
            )}
          </p>
          <button className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-medium text-xs uppercase tracking-wider rounded-xl shadow-lg hover:brightness-110 transition-all">
            {L(locale, "Premium'a Yükselt →", "Upgrade to Premium →")}
          </button>
        </div>
      </div>
    );
  }

  // Analiz başarısız olduysa (preorder-analysis veya deep-analysis hata
  // verdiyse) hiçbir şey render etmiyoruz — sayfanın geri kalanı (grafik,
  // mevcut trade plan kartı vb.) zaten çalışmaya devam eder.
  if (failed) return null;

  if (loading || !data) {
    return (
      <div className="glass-card p-5 flex items-center justify-center gap-3 text-slate-500 text-xs">
        <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        {L(locale, "Teknik referanslar yükleniyor...", "Loading technical references...")}
      </div>
    );
  }

  const rd = data.rawData || {};
  const sr = rd.srLevels || {};
  const ma = rd.maLevels || {};
  const cp = rd.currentPrice || 0;
  const vwap20 = rd.vwap20 ?? null;
  const poc = rd.poc ?? null;
  const earnings: any[] = rd.earningsHistory || [];
  const instOwners: any[] = rd.institutionalOwners || [];
  const nextEarnings: string | null = rd.nextEarningsDate;
  const earningsDays: number | null = rd.nextEarningsDaysAway;
  const beatCount = earnings.filter((e: any) => e.epsBeating).length;

  const plan = computeTechnicalRefs(rd, sr, horizon, locale);
  const rrColor = plan.rr1 >= 2 ? "green" : plan.rr1 >= 1 ? "amber" : "red";

  return (
    <div className="flex flex-col gap-4 mt-4">
      {showPremiumModal && <PremiumModal locale={locale} onClose={() => setShowPremiumModal(false)} />}

      {/* ── TEKNİK REFERANSLAR (Swing/Position/Invest) ────────────────────
          Bu bileşene bu noktaya SADECE isPremium===true iken ulaşılır (bkz.
          yukarıdaki erken dönüş) — free/anonim ziyaretçi zaten tek bir
          yükseltme kartı görüyor, burada ayrıca kilit kontrolüne gerek yok. */}
      {(
        <div className="glass-card border-2 border-[#1e4a7f]/80 rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🎯</span>
              <h3 className="text-[13px] font-medium text-white uppercase tracking-[0.12em]">{L(locale, "Teknik Referanslar", "Technical Refs")}</h3>
            </div>
            <div className="flex gap-1 bg-[#080c14] border border-[#1e3a5f]/50 rounded-lg p-0.5">
              {(["swing", "position", "investment"] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`text-[10px] font-medium uppercase px-2.5 py-1.5 rounded transition-all ${
                    horizon === h ? "bg-[#1e4a7f] text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {h === "swing" ? "Swing" : h === "position" ? L(locale, "Pozisyon", "Position") : L(locale, "Yatırım", "Invest")}
                </button>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mb-3">
            {plan.timeframe} · {plan.anchor}
          </div>

          {plan.waitWarning && (
            <div className="mb-3 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[11px] font-medium">
              ⏳ {plan.waitWarning}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="bg-[#080c14] border border-[#1e3a5f]/50 rounded-xl p-4">
              <PlanRow label={L(locale, "Giriş Bölgesi", "Entry Zone")} value={`${fmtUsd(plan.entryLow)}–${fmtUsd(plan.entryHigh)}`} valueColor="cyan" />
              <PlanRow
                label={L(locale, "Zarar Kes", "Stop Loss")}
                value={fmtUsd(plan.stop)}
                valueColor="red"
                note={`-${formatNumber(((plan.entry - plan.stop) / plan.entry) * 100, 1)}%`}
              />
              <PlanRow label="T1" value={fmtUsd(plan.t1)} valueColor="green" note={`+${formatNumber(((plan.t1 - plan.entry) / plan.entry) * 100, 1)}%`} />
              <PlanRow label="T2" value={fmtUsd(plan.t2)} valueColor="green" note={`+${formatNumber(((plan.t2 - plan.entry) / plan.entry) * 100, 1)}%`} />
              {plan.t3 != null && (
                <PlanRow label="T3" value={fmtUsd(plan.t3)} valueColor="green" note={`+${formatNumber(((plan.t3 - plan.entry) / plan.entry) * 100, 1)}%`} />
              )}
            </div>
            <div className="bg-[#080c14] border border-[#1e3a5f]/50 rounded-xl p-4">
              <PlanRow label={L(locale, "R/R (T1'e)", "R/R (to T1)")} value={`${plan.rr1}:1`} valueColor={rrColor} />
              <PlanRow label={L(locale, "R/R (T2'ye)", "R/R (to T2)")} value={`${plan.rr2}:1`} valueColor={rrColor} />
              <PlanRow label={L(locale, "Tez İptal Seviyesi", "Thesis Invalidation")} value={fmtUsd(plan.invalidation)} valueColor="red" />
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
            <div className="text-[10px] text-amber-400 uppercase tracking-widest font-medium mb-1">{L(locale, "Trailing Kuralı", "Trailing Rule")}</div>
            <p className="text-[12px] text-slate-300">{plan.trailRule}</p>
          </div>
        </div>
      )}

      {/* ── KRİTİK SEVİYELER — herkese açık ───────────────────────────────── */}
      <div className="glass-card rounded-2xl p-5 md:p-6">
        <h3 className="text-[12px] font-medium text-white uppercase tracking-[0.12em] mb-4 flex items-center gap-2">
          <span className="text-base">📍</span> {L(locale, "Kritik Seviyeler", "Key Levels")}
        </h3>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { key: "resistance3", code: "R3", label: L(locale, "Direnç 3", "Resistance 3"), textCl: "text-rose-400", bordCl: "border-rose-500/20 bg-rose-500/5" },
            { key: "resistance2", code: "R2", label: L(locale, "Direnç 2", "Resistance 2"), textCl: "text-rose-300", bordCl: "border-rose-500/15 bg-rose-500/5" },
            { key: "resistance1", code: "R1", label: L(locale, "Direnç 1", "Resistance 1"), textCl: "text-orange-300", bordCl: "border-orange-500/20 bg-orange-500/5" },
            { key: "support1", code: "S1", label: L(locale, "Destek 1", "Support 1"), textCl: "text-emerald-300", bordCl: "border-emerald-500/20 bg-emerald-500/5" },
            { key: "support2", code: "S2", label: L(locale, "Destek 2", "Support 2"), textCl: "text-emerald-400", bordCl: "border-emerald-500/15 bg-emerald-500/5" },
            { key: "support3", code: "S3", label: L(locale, "Destek 3", "Support 3"), textCl: "text-teal-400", bordCl: "border-teal-500/20 bg-teal-500/5" },
          ].map((l) => {
            const val = (sr as any)[l.key] ?? 0;
            const dist = cp > 0 ? ((val - cp) / cp) * 100 : 0;
            return (
              <div key={l.key} className={`border rounded-xl px-3 py-2.5 ${l.bordCl}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-slate-500 font-medium">{l.code}</span>
                  <span className={`text-[9px] font-medium ${dist >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {dist >= 0 ? "+" : ""}
                    {formatNumber(dist, 1)}%
                  </span>
                </div>
                <div className={`text-[14px] md:text-[15px] font-medium ${l.textCl}`}>{fmtUsd(val)}</div>
                <div className="text-[9px] text-slate-600 mt-0.5">{l.label}</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="border border-cyan-500/25 bg-cyan-500/5 rounded-xl px-3 py-2.5 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">VWAP 20D</div>
            <div className="text-[14px] font-medium text-cyan-400">{fmtUsd(vwap20)}</div>
            {vwap20 != null && <div className="text-[9px] text-slate-600 mt-0.5">{cp >= vwap20 ? L(locale, "Fiyat Üstünde", "Price Above") : L(locale, "Fiyat Altında", "Price Below")}</div>}
          </div>
          <div className="border border-purple-500/25 bg-purple-500/5 rounded-xl px-3 py-2.5 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">POC 20D</div>
            <div className="text-[14px] font-medium text-purple-400">{fmtUsd(poc)}</div>
            <div className="text-[9px] text-slate-600 mt-0.5">{L(locale, "En Yüksek Hacim Bölgesi", "Highest Volume Node")}</div>
          </div>
        </div>

        {(rd.ema20 || rd.ema50 || rd.ema200) && (
          <div className="bg-[#080c14] border border-[#1e3a5f]/40 rounded-xl p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{L(locale, "Hareketli Ortalamalar", "Moving Averages")}</div>
            {[
              ["EMA 20", rd.ema20],
              ["EMA 50", rd.ema50],
              ["EMA 200", rd.ema200],
              ["MA 7", ma.ma7],
              ["MA 21", ma.ma21],
            ]
              .filter(([, v]) => typeof v === "number" && v > 0)
              .map(([label, v]) => {
                const value = v as number;
                const above = cp >= value;
                const dist = value > 0 ? ((cp - value) / value) * 100 : 0;
                return (
                  <div key={label as string} className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/25 last:border-0">
                    <span className="text-[11px] text-slate-400 w-16">{label}</span>
                    <span className="text-[11px] text-slate-500 flex-1 text-center">
                      {dist >= 0 ? "+" : ""}
                      {formatNumber(dist, 1)}%
                    </span>
                    <span className="text-[12px] font-medium text-white w-20 text-right">{fmtUsd(value)}</span>
                    <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded w-16 text-center ${above ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                      {above ? L(locale, "Üstünde", "Above") : L(locale, "Altında", "Below")}
                    </span>
                  </div>
                );
              })}
            {ma.goldenCross != null && (
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#1e3a5f]/25">
                <span className="text-[11px] text-slate-400">EMA Cross</span>
                <Chip label={ma.goldenCross ? L(locale, "Altın Kesişim", "Golden Cross") : L(locale, "Ölüm Kesişimi", "Death Cross")} color={ma.goldenCross ? "green" : "red"} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── KATALİZÖR TAKVİMİ — herkese açık ──────────────────────────────── */}
      <div className="glass-card rounded-2xl p-5 md:p-6">
        <h3 className="text-[12px] font-medium text-white uppercase tracking-[0.12em] mb-4 flex items-center gap-2">
          <span className="text-base">📅</span> {L(locale, "Katalizör Takvimi", "Catalyst Calendar")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className={`border rounded-xl p-4 ${earningsDays !== null && earningsDays <= 14 ? "border-amber-500/40 bg-amber-500/8" : "border-[#1e3a5f]/40 bg-[#0a0e18]"}`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{L(locale, "Sonraki Kazanç", "Next Earnings")}</div>
            {nextEarnings ? (
              <>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[17px] font-medium text-white">{nextEarnings}</span>
                  {earningsDays !== null && <Chip label={`${earningsDays}d`} color={earningsDays <= 7 ? "red" : earningsDays <= 14 ? "amber" : "slate"} />}
                </div>
                {earningsDays !== null && earningsDays <= 14 && (
                  <p className="text-[11px] text-amber-300 mt-2">
                    {L(locale, `Dikkat: ${earningsDays} gün içinde bilanço. IV artışı ve ani hareket beklenebilir.`, `Caution: Earnings in ${earningsDays} days. Expect IV expansion.`)}
                  </p>
                )}
              </>
            ) : (
              <span className="text-[13px] text-slate-500">{L(locale, "Tarih bulunamadı", "Date not available")}</span>
            )}
          </div>
          <div className="border border-rose-500/30 bg-rose-500/5 rounded-xl p-4">
            <div className="text-[10px] text-rose-400 uppercase tracking-widest font-medium mb-1">{L(locale, "⚠ Tez İptal Seviyesi", "⚠ Thesis Invalidation")}</div>
            <div className="text-[19px] font-medium text-rose-300 mt-1">{fmtUsd(sr.support2 || cp * 0.91)}</div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {locale === "tr"
                ? `${fmtUsd(sr.support2 || cp * 0.91)} (D2) altında haftalık kapanış = tez geçersiz.`
                : `Weekly close below ${fmtUsd(sr.support2 || cp * 0.91)} (S2) = setup invalid.`}
            </p>
          </div>
        </div>
        {earnings.length > 0 && (
          <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">{L(locale, "Kazanç Geçmişi", "Earnings History")}</div>
              <span className="text-[10px] font-medium text-amber-400">
                {beatCount}/{earnings.length} {L(locale, "Beat", "Beat")}
              </span>
            </div>
            {earnings.map((e: any, i: number) => {
              const beat = e.epsBeating;
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/25 last:border-0 gap-2 flex-wrap">
                  <div>
                    <span className="text-[12px] font-medium text-white">{e.quarter}</span>
                    <span className="text-[11px] text-slate-500 ml-1.5">{e.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {L(locale, "Ger", "Act")}: <span className="text-white font-medium">${formatNumber(e.eps, 2)}</span> · Est: ${formatNumber(e.estimate, 2)}
                    </span>
                    <span className={`text-[11px] font-medium ${beat ? "text-emerald-400" : "text-rose-400"}`}>
                      {e.epsSurprise > 0 ? "+" : ""}
                      {formatNumber(e.epsSurprise, 1)}%
                    </span>
                    <Chip label={beat ? L(locale, "GEÇTİ", "BEAT") : L(locale, "KAÇIRDI", "MISS")} color={beat ? "green" : "red"} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 13F KURUMSAL SAHİPLİK — herkese açık ──────────────────────────── */}
      {instOwners.length > 0 && (
        <div className="glass-card rounded-2xl p-5 md:p-6">
          <h3 className="text-[12px] font-medium text-white uppercase tracking-[0.12em] mb-4 flex items-center gap-2">
            <span className="text-base">🏛️</span> {L(locale, "13F — Kurumsal Sahiplik", "13F — Institutional Ownership")}
          </h3>
          <div className="bg-[#0a0e18] border border-[#1e3a5f]/30 rounded-xl p-3">
            {instOwners.map((o: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#1e3a5f]/25 last:border-0 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-white truncate">{o.name}</div>
                  <div className="text-[10px] text-slate-500">{o.reportDate}</div>
                </div>
                <span className={`text-[12px] font-medium shrink-0 ${o.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {o.isNewPosition
                    ? o.change >= 0
                      ? `▲ ${L(locale, "Yeni Giriş", "New Entry")}`
                      : `▼ ${L(locale, "Büyük Çıkış", "Major Exit")}`
                    : `${o.change >= 0 ? "▲" : "▼"} ${formatNumber(Math.abs(o.change), 1)}%`}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">{L(locale, "Kaynak: SEC 13F başvuruları (Yahoo Finance üzerinden)", "Source: SEC 13F filings (via Yahoo Finance)")}</p>
        </div>
      )}
    </div>
  );
}
