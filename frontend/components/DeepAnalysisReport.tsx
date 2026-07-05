"use client";

import { useEffect, useState } from "react";

interface Props { ticker: string; stockData: any; onClose: () => void; lang?: "tr" | "en"; }

const L = (lang: "tr" | "en", tr: string, en: string) => lang === "en" ? en : tr;

// ── Module-level cache: prevents re-fetch for same ticker on same calendar day ──
const _cache = new Map<string, any>();
function getCacheKey(ticker: string, lang: string) {
  return `${ticker}_${lang}_${new Date().toISOString().slice(0, 10)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-base">{icon}</span>
      <h3 className="text-[11px] md:text-[12px] font-black text-white uppercase tracking-[0.15em]">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-[#1e3a5f] to-transparent" />
    </div>
  );
}

function MetricBox({ label, value, sub, color = "cyan" }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
    green: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-300",
    purple: "border-purple-500/30 bg-purple-500/5 text-purple-300",
    slate: "border-slate-500/30 bg-slate-500/5 text-slate-300",
  };
  const cls = colors[color] || colors.cyan;
  return (
    <div className={`border rounded-lg p-3 text-center ${cls}`}>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[15px] md:text-[17px] font-black">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    : score >= 50 ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
    : "text-rose-400 border-rose-500/40 bg-rose-500/10";
  return (
    <div className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-[13px] font-black ${color}`}>
      {score}/100
    </div>
  );
}

function EMAProfileBadge({ profile, lang }: { profile: any; lang: "tr" | "en" }) {
  if (!profile) return null;
  const colors: Record<string, string> = {
    A: "border-amber-400/50 bg-amber-400/10 text-amber-300",
    B: "border-cyan-400/50 bg-cyan-400/10 text-cyan-300",
    C: "border-slate-400/50 bg-slate-400/10 text-slate-300",
  };
  const cls = colors[profile.profile] || colors.C;
  const desc = lang === "en"
    ? profile.profile === "A"
      ? `Institutional stock — breakout evaluation via EMA20`
      : profile.profile === "B"
      ? `Growth stock — breakout evaluation via EMA50`
      : `Speculative stock — breakout evaluation via EMA200`
    : profile.desc;
  return (
    <div className={`inline-flex items-center gap-2 border rounded-lg px-3 py-1.5 ${cls}`}>
      <span className="text-[11px] font-black uppercase tracking-wide">{profile.keyEMA} {L(lang, "Hissesi", "Stock")}</span>
      <span className="text-[10px] text-slate-400 hidden md:inline">{desc}</span>
    </div>
  );
}

function PivotTable({ sr, lang, currentPrice }: { sr: any; lang: "tr" | "en"; currentPrice: number }) {
  const levels = [
    { key: "resistance3", code: "R3", typeLabel: L(lang, "Direnç 3", "Resistance 3"), color: "text-rose-400", bg: "bg-rose-500/5 border-rose-500/20" },
    { key: "resistance2", code: "R2", typeLabel: L(lang, "Direnç 2", "Resistance 2"), color: "text-rose-300", bg: "bg-rose-500/5 border-rose-500/15" },
    { key: "resistance1", code: "R1", typeLabel: L(lang, "Direnç 1", "Resistance 1"), color: "text-orange-300", bg: "bg-orange-500/5 border-orange-500/20" },
    { key: "support1",    code: "S1", typeLabel: L(lang, "Destek 1", "Support 1"),    color: "text-emerald-300", bg: "bg-emerald-500/5 border-emerald-500/20" },
    { key: "support2",    code: "S2", typeLabel: L(lang, "Destek 2", "Support 2"),    color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/15" },
    { key: "support3",    code: "S3", typeLabel: L(lang, "Destek 3", "Support 3"),    color: "text-teal-400", bg: "bg-teal-500/5 border-teal-500/20" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {levels.map(l => {
        const val = sr[l.key] ?? 0;
        const distPct = currentPrice > 0 ? ((val - currentPrice) / currentPrice * 100) : 0;
        return (
          <div key={l.key} className={`border rounded-lg px-3 py-2 ${l.bg}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-slate-500 font-bold">{l.code}</span>
              <span className={`text-[9px] font-bold ${distPct >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {distPct >= 0 ? "+" : ""}{distPct.toFixed(1)}%
              </span>
            </div>
            <div className={`text-[13px] font-black ${l.color}`}>${val.toFixed(2)}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{l.typeLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

function MARow({ label, value, current, lang }: { label: string; value: number; current: number; lang: "tr" | "en" }) {
  const above = current >= value;
  const distPct = value > 0 ? ((current - value) / value * 100) : 0;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1e3a5f]/30 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500">{distPct >= 0 ? "+" : ""}{distPct.toFixed(1)}%</span>
        <span className="text-[12px] font-black text-white">${value.toFixed(2)}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${above ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
          {above ? L(lang, "Üstünde", "Above") : L(lang, "Altında", "Below")}
        </span>
      </div>
    </div>
  );
}

function InsiderRow({ tx, lang }: { tx: any; lang: "tr" | "en" }) {
  const isBuy = tx.type === "BUY";
  const isSell = tx.type === "SELL";
  const typeLabel = isBuy ? L(lang, "ALIŞ", "BUY") : isSell ? L(lang, "SATIŞ", "SELL") : L(lang, "DİĞER", "OTHER");
  const typeCls = isBuy
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-black"
    : isSell
    ? "bg-rose-500/20 text-rose-300 border-rose-500/50 font-black"
    : "bg-slate-500/20 text-slate-400 border-slate-500/30";
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/30 last:border-0 gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-white truncate">{tx.officer}</div>
        <div className="text-[10px] text-slate-400">{tx.title} · {tx.date}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {tx.price && <span className="text-[11px] text-slate-300">${tx.price}</span>}
        <span className={`text-[10px] px-2 py-0.5 rounded border ${typeCls}`}>{typeLabel}</span>
      </div>
    </div>
  );
}

function InstitutionRow({ owner, lang }: { owner: any; lang: "tr" | "en" }) {
  const up = owner.change >= 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/30 last:border-0 gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-white truncate">{owner.name}</div>
        <div className="text-[10px] text-slate-400">{owner.reportDate}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-slate-300">{owner.shares?.toLocaleString()}</span>
        <span className={`text-[11px] font-black ${up ? "text-emerald-400" : "text-rose-400"}`}>
          {up ? "▲" : "▼"} {Math.abs(owner.change).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function EarningsRow({ e, lang }: { e: any; lang: "tr" | "en" }) {
  const beat = e.epsBeating;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/30 last:border-0 gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-white">{e.quarter} <span className="text-slate-400 font-normal">{e.date}</span></div>
        <div className="text-[10px] text-slate-400">
          {L(lang, "Gerçek", "Actual")}: <span className="text-white font-bold">${e.eps?.toFixed(2)}</span>
          {" · "}{L(lang, "Tahmin", "Est")}: ${e.estimate?.toFixed(2)}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1">
        <span className={`text-[11px] font-black ${beat ? "text-emerald-400" : "text-rose-400"}`}>
          {e.epsSurprise > 0 ? "+" : ""}{e.epsSurprise?.toFixed(1)}%
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${beat ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-rose-500/40 text-rose-300 bg-rose-500/10"}`}>
          {beat ? L(lang, "Geçti", "Beat") : L(lang, "Kaçırdı", "Miss")}
        </span>
      </div>
    </div>
  );
}

function NewsItem({ item, lang }: { item: any; lang: "tr" | "en" }) {
  const sentColor = item.sentiment === "Pozitif" ? "text-emerald-400"
    : item.sentiment === "Negatif" ? "text-rose-400"
    : "text-slate-400";
  const sentLabel = item.sentiment === "Pozitif" ? L(lang, "Pozitif", "Positive")
    : item.sentiment === "Negatif" ? L(lang, "Negatif", "Negative")
    : L(lang, "Nötr", "Neutral");
  return (
    <div className="py-2 border-b border-[#1e3a5f]/30 last:border-0">
      <div className="text-[11px] text-white font-medium leading-snug mb-0.5">{item.title}</div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500">{item.source} · {item.date}</span>
        <span className={`text-[10px] font-bold ${sentColor}`}>{sentLabel}</span>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVol(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return v.toString();
}

function buildPatternText(lang: "tr" | "en", rd: any, sr: any): string {
  const ema20 = rd.ema20 || 0;
  const ema50 = rd.ema50 || 0;
  const price = rd.currentPrice || 0;
  const rsi = rd.rsi || 50;
  const slope20 = rd.emaSlope20 || "yatay";
  const slope50 = rd.emaSlope50 || "yatay";
  const r1 = sr.resistance1 || 0;
  const s1 = sr.support1 || 0;

  const slopeEN = (s: string) => s === "yükselen" ? "rising" : s === "düşen" ? "falling" : "flat";

  if (lang === "en") {
    const aboveEMA = price > ema20 && price > ema50;
    const belowEMA = price < ema20 && price < ema50;
    const trend = aboveEMA ? "bullish" : belowEMA ? "bearish" : "mixed";
    const emaLine = `EMA20 is ${slopeEN(slope20)}, EMA50 is ${slopeEN(slope50)}.`;
    const actionLine = aboveEMA
      ? `A daily close above $${r1.toFixed(2)} (R1) would confirm continuation — watch for volume expansion. If price falls below $${ema20.toFixed(2)} (EMA20), the setup weakens.`
      : belowEMA
      ? `Price must reclaim $${ema20.toFixed(2)} (EMA20) on a daily close to shift bias. A break below $${s1.toFixed(2)} (S1) accelerates downside.`
      : `RSI at ${rsi.toFixed(1)} in neutral zone. A daily close above $${ema20.toFixed(2)} (EMA20) activates the bullish route; a break below $${s1.toFixed(2)} (S1) signals caution.`;
    return `${trend.charAt(0).toUpperCase() + trend.slice(1)} structure with ${emaLine} ${actionLine}`;
  }

  const aboveEMA = price > ema20 && price > ema50;
  const belowEMA = price < ema20 && price < ema50;
  const slopeTR = (s: string) => s === "yükselen" ? "yükseliyor" : s === "düşen" ? "düşüyor" : "yatay seyrediyor";
  const trendTR = aboveEMA ? "yükselişçi" : belowEMA ? "düşüşçü" : "karma";
  const emaLine = `EMA20 ${slopeTR(slope20)}, EMA50 ${slopeTR(slope50)}.`;
  const actionLine = aboveEMA
    ? `$${r1.toFixed(2)} (D1) üzerinde günlük kapanış gelirse yükseliş devamı teyitlenir — hacim artışı şart. $${ema20.toFixed(2)} (EMA20) altına inilirse yapı zayıflar.`
    : belowEMA
    ? `Yükseliş senaryosu için fiyatın $${ema20.toFixed(2)} (EMA20) üzerinde günlük kapanış yapması gerekir. $${s1.toFixed(2)} (D1) kırılırsa düşüş hızlanır.`
    : `RSI ${rsi.toFixed(1)} nötr bölgede. $${ema20.toFixed(2)} (EMA20) üzerinde günlük kapanış yükseliş rotasını aktive eder; $${s1.toFixed(2)} (D1) kırılımı dikkat sinyali verir.`;
  return `${trendTR.charAt(0).toUpperCase() + trendTR.slice(1)} yapı. ${emaLine} ${actionLine}`;
}

function buildMarketText(lang: "tr" | "en", rd: any, masterScore: number): string {
  const sp = rd.sp500Change ?? null;
  const nq = rd.nasdaqChange ?? null;
  const vix = rd.vixPrice ?? null;
  if (sp === null && nq === null) {
    return lang === "en"
      ? "Market index data is currently unavailable."
      : "Piyasa endeks verisi şu an mevcut değil.";
  }
  const spDir = sp >= 0 ? (lang === "en" ? "up" : "yükseliyor") : (lang === "en" ? "down" : "düşüyor");
  const nqDir = nq >= 0 ? (lang === "en" ? "up" : "yükseliyor") : (lang === "en" ? "down" : "düşüyor");
  const stockVsMarket = masterScore >= 60
    ? (lang === "en" ? "outperforming the broad market" : "genel piyasanın önünde seyrediyor")
    : masterScore >= 40
    ? (lang === "en" ? "in line with the broad market" : "genel piyasayla paralel hareket ediyor")
    : (lang === "en" ? "underperforming the broad market" : "genel piyasanın gerisinde kalıyor");
  if (lang === "en") {
    return `S&P 500 ${spDir} ${Math.abs(sp).toFixed(2)}%, Nasdaq ${nqDir} ${Math.abs(nq).toFixed(2)}%${vix ? `, VIX at ${vix.toFixed(1)}` : ""}. This stock is ${stockVsMarket}${masterScore >= 60 ? " — a relative strength signal worth monitoring." : "."}`;
  }
  return `S&P 500 %${Math.abs(sp).toFixed(2)} ${spDir}, Nasdaq %${Math.abs(nq).toFixed(2)} ${nqDir}${vix ? `, VIX ${vix.toFixed(1)}` : ""}. Bu hisse ${stockVsMarket}${masterScore >= 60 ? " — rölatif güç sinyali izlenmeye değer." : "."}`;
}

function buildMacroRisk(lang: "tr" | "en", sector: string): string {
  const s = (sector || "").toLowerCase();
  if (lang === "en") {
    if (s.includes("tech") || s.includes("software")) return "Fed rate decisions, AI regulation, and valuation multiples contraction are key macro risks for this sector.";
    if (s.includes("health") || s.includes("pharma") || s.includes("biotech")) return "FDA approvals, clinical trial results, and drug pricing policy are the primary risk drivers.";
    if (s.includes("financ") || s.includes("bank")) return "Interest rate trajectory, credit quality, and regulatory capital requirements are the main macro variables.";
    if (s.includes("energy") || s.includes("oil")) return "Crude oil price volatility, OPEC decisions, and energy transition policies create sector-level risk.";
    if (s.includes("consumer") || s.includes("retail")) return "Consumer spending trends, inflation persistence, and discretionary vs. staples rotation are key factors.";
    return "Macro backdrop includes Fed policy, dollar strength, and global growth expectations — monitor for sector rotation signals.";
  }
  if (s.includes("tech") || s.includes("yazılım")) return "Fed faiz kararları, yapay zeka düzenlemesi ve değerleme çarpanı daralması sektörün başlıca makro riskleridir.";
  if (s.includes("sağlık") || s.includes("ilaç") || s.includes("biyoteknoloji")) return "FDA onayları, klinik çalışma sonuçları ve ilaç fiyatlandırma politikası birincil risk faktörleridir.";
  if (s.includes("finans") || s.includes("banka")) return "Faiz yörüngesi, kredi kalitesi ve düzenleyici sermaye gereksinimleri temel makro değişkenlerdir.";
  if (s.includes("enerji") || s.includes("petrol")) return "Ham petrol fiyatı oynaklığı, OPEC kararları ve enerji dönüşümü politikaları sektör riski yaratmaktadır.";
  if (s.includes("tüketici") || s.includes("perakende")) return "Tüketici harcama eğilimleri, kalıcı enflasyon ve isteğe bağlı/zorunlu rotasyonu izlenmelidir.";
  return "Makro ortam Fed politikası, dolar gücü ve küresel büyüme beklentilerini içeriyor — sektör rotasyonu sinyalleri takip edilmeli.";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DeepAnalysisReport({ ticker, stockData, onClose, lang = "tr" }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = getCacheKey(ticker, lang);
    const cached = _cache.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/deep-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, stockData, lang }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        _cache.set(key, d);
        setData(d);
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // intentionally empty deps — fetch once per mount, cache handles staleness

  if (loading) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#080c14] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">{L(lang, "Derin analiz yükleniyor...", "Loading deep analysis...")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#080c14] flex flex-col items-center justify-center gap-3">
        <p className="text-rose-400 text-sm">{L(lang, "Analiz yüklenemedi.", "Failed to load analysis.")}</p>
        <button onClick={onClose} className="text-cyan-400 text-sm underline">{L(lang, "Kapat", "Close")}</button>
      </div>
    );
  }

  const rd = data.rawData || {};
  const a = data.analysis || {};
  const sr = rd.srLevels || {};
  const ma = rd.maLevels || {};
  const fs = rd.flowSummary || null;

  const companyName = data.companyName || ticker;
  const sector = data.sector || "";
  const currentPrice = rd.currentPrice || 0;
  const masterScore = rd.masterScore || 0;
  const rsi = rd.rsi || 0;
  const iv = rd.iv || 0;
  const ivRank = rd.ivRank || 0;
  const atr = rd.atr || 0;
  const implied = rd.implied30dMove || 0;
  const ema20 = rd.ema20 || 0;
  const ema50 = rd.ema50 || 0;
  const ema200 = rd.ema200 || 0;
  const rvol = rd.rvol || 1;
  const volume = rd.volume || 0;
  const avgVol30d = rd.avgVol30d || 0;

  const insiders: any[] = rd.insiderTransactions || [];
  const instOwners: any[] = rd.institutionalOwners || [];
  const earnings: any[] = rd.earningsHistory || [];
  const news: any[] = (rd.recentNews || []).slice(0, 5);
  const analyst = rd.analystData || {};
  const insiderSummary = rd.insiderSummary || {};

  const beatCount = earnings.filter((e: any) => e.epsBeating).length;
  const totalEarnings = earnings.length;

  const rsiColor = rsi >= 70 ? "rose" : rsi < 30 ? "purple" : rsi >= 50 ? "cyan" : "amber";
  const rsiLabel = rsi >= 70 ? L(lang, "Aşırı Alım", "Overbought") : rsi < 30 ? L(lang, "Aşırı Satım", "Oversold") : L(lang, "Nötr", "Neutral");
  const rvolColor = rvol >= 2 ? "rose" : rvol >= 1.3 ? "amber" : rvol < 0.7 ? "slate" : "cyan";

  const patternText = buildPatternText(lang, rd, sr);
  const marketText = buildMarketText(lang, rd, masterScore);
  const macroRisk = buildMacroRisk(lang, sector);

  const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString(lang === "en" ? "en-US" : "tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "";

  return (
    <div className="fixed inset-0 z-[99999] bg-[#080c14]/97 backdrop-blur-sm overflow-y-auto">
      {/* Close bar */}
      <div className="sticky top-0 z-10 bg-[#080c14]/95 backdrop-blur-sm border-b border-[#1e3a5f]/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-black text-white uppercase tracking-widest">
            {ticker} — {L(lang, "Derin Analiz", "Deep Analysis")}
          </span>
          {generatedAt && (
            <span className="text-[10px] text-slate-500 hidden md:inline">
              {L(lang, "Güncellendi", "Updated")}: {generatedAt}
              {rd.cacheVersion && (
                <span className="ml-2 opacity-50">· {rd.cacheVersion.split("_").slice(-2).join(" ")}</span>
              )}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-[20px] leading-none"
          aria-label="Close"
        >✕</button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 flex flex-col gap-5 text-white">

        {/* ── Section 1: Stock DNA & Summary ─────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-xl p-4 md:p-5">
          <SectionTitle icon="🧬" title={L(lang, "Hisse DNA & Özet", "Stock DNA & Summary")} />

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[22px] md:text-[26px] font-black text-white">{ticker}</span>
                <ScoreBadge score={masterScore} />
              </div>
              <div className="text-[12px] text-slate-300 font-medium mb-1">{companyName}</div>
              <div className="text-[11px] text-slate-500">{sector}{rd.marketCapStr ? ` · ${rd.marketCapStr}` : ""}</div>
            </div>
            <div className="text-right">
              <div className="text-[26px] md:text-[30px] font-black text-white">${currentPrice.toFixed(2)}</div>
              <div className="text-[11px] text-slate-400">{L(lang, "Güncel Fiyat", "Current Price")}</div>
            </div>
          </div>

          {/* EMA Profile */}
          {rd.emaProfile && (
            <div className="mb-3">
              <EMAProfileBadge profile={rd.emaProfile} lang={lang} />
              <p className="text-[10px] text-slate-500 mt-1 md:hidden">{lang === "en"
                ? (rd.emaProfile.profile === "A" ? "Breakout evaluation via EMA20" : rd.emaProfile.profile === "B" ? "Breakout evaluation via EMA50" : "Breakout evaluation via EMA200")
                : rd.emaProfile.desc}</p>
            </div>
          )}

          {/* DNA text */}
          {a.dna?.hisseTipi && (
            <p className="text-[12px] text-slate-300 leading-relaxed mb-4 border-l-2 border-cyan-500/40 pl-3">
              {a.dna.hisseTipi}
            </p>
          )}

          {/* 4 Metric Boxes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <MetricBox label="RSI 14" value={rsi.toFixed(1)} sub={rsiLabel} color={rsiColor} />
            <MetricBox label="ATR 14" value={`$${atr.toFixed(2)}`} sub={`${rd.atrPct?.toFixed(1) ?? "—"}%`} color="amber" />
            <MetricBox label={L(lang, "IV Rank", "IV Rank")} value={`${ivRank.toFixed(0)}%`} sub={`IV ${iv}%`} color={ivRank > 50 ? "rose" : "purple"} />
            <MetricBox label={L(lang, "30G Beklenen Hareket", "30D Implied Move")} value={`±$${implied.toFixed(2)}`} sub={`±${((implied / currentPrice) * 100).toFixed(1)}%`} color="cyan" />
          </div>

          {/* Pivot Levels */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">{L(lang, "Pivot Seviyeleri", "Pivot Levels")}</div>
            <PivotTable sr={sr} lang={lang} currentPrice={currentPrice} />
          </div>
        </div>

        {/* ── Section 2: Technical Discipline & Momentum ─────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-xl p-4 md:p-5">
          <SectionTitle icon="📐" title={L(lang, "Teknik Disiplin & Momentum", "Technical Discipline & Momentum")} />

          {/* Pattern Analysis — full width, prominent */}
          <div className="bg-gradient-to-r from-cyan-500/5 to-transparent border border-cyan-500/20 rounded-lg p-4 mb-4">
            <div className="text-[10px] text-cyan-400 font-black uppercase tracking-wider mb-2">{L(lang, "Patern Analizi & Yol Haritası", "Pattern Analysis & Roadmap")}</div>
            <p className="text-[12px] text-slate-200 leading-relaxed">{patternText}</p>
          </div>

          {/* Volume Section */}
          <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3 mb-4">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">{L(lang, "Hacim Analizi", "Volume Analysis")}</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <div className="text-[10px] text-slate-500 mb-1">{L(lang, "Günlük Hacim", "Daily Volume")}</div>
                <div className="text-[14px] font-black text-white">{fmtVol(volume)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 mb-1">{L(lang, "20G Ort. Hacim", "20D Avg Vol")}</div>
                <div className="text-[14px] font-black text-white">{fmtVol(avgVol30d)}</div>
              </div>
              <div className={`text-center border rounded-lg p-1 ${rvol >= 2 ? "border-rose-500/30 bg-rose-500/5" : rvol >= 1.3 ? "border-amber-500/30 bg-amber-500/5" : "border-slate-500/20 bg-transparent"}`}>
                <div className="text-[10px] text-slate-500 mb-1">RVOL</div>
                <div className={`text-[14px] font-black ${rvol >= 2 ? "text-rose-400" : rvol >= 1.3 ? "text-amber-400" : rvol < 0.7 ? "text-slate-400" : "text-white"}`}>{rvol.toFixed(2)}x</div>
              </div>
            </div>
            {/* Volume interpretation */}
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {lang === "en"
                ? rvol >= 2
                  ? `RVOL ${rvol.toFixed(2)}x signals a volume spike — high-probability directional move. Current daily volume of ${fmtVol(volume)} is well above the 20-day average of ${fmtVol(avgVol30d)}.`
                  : rvol >= 1.3
                  ? `RVOL ${rvol.toFixed(2)}x shows above-average participation. Price action during this session carries more weight than usual.`
                  : rvol < 0.7
                  ? `RVOL ${rvol.toFixed(2)}x indicates thin participation. Moves on low volume are less reliable — wait for confirmation.`
                  : `RVOL ${rvol.toFixed(2)}x is near the 20-day average — normal market conditions, no volume anomaly detected.`
                : rvol >= 2
                  ? `RVOL ${rvol.toFixed(2)}x yüksek hacim patlaması sinyali veriyor — yönlü hareket olasılığı yüksek. Günlük ${fmtVol(volume)} hacim, 20 günlük ${fmtVol(avgVol30d)} ortalamasının çok üzerinde.`
                  : rvol >= 1.3
                  ? `RVOL ${rvol.toFixed(2)}x ortalamanın üzerinde katılım gösteriyor. Bu seansın fiyat hareketi normalden daha anlamlı.`
                  : rvol < 0.7
                  ? `RVOL ${rvol.toFixed(2)}x ince katılım sinyali. Düşük hacimli hareketler güvenilmez — onay bekle.`
                  : `RVOL ${rvol.toFixed(2)}x 20 günlük ortalamayla paralel — normal piyasa koşulları, hacim anomalisi yok.`}
            </p>
          </div>

          {/* Trend/Volume text blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {a.teknikYorum?.trendDurumu && (
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
                <div className="text-[10px] text-amber-400 font-black uppercase tracking-wider mb-1.5">{L(lang, "Trend Durumu", "Trend Status")}</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{a.teknikYorum.trendDurumu}</p>
              </div>
            )}
            {fs && (
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
                <div className="text-[10px] text-emerald-400 font-black uppercase tracking-wider mb-1.5">{L(lang, "Akış Göstergeleri", "Flow Indicators")}</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {lang === "en"
                    ? `OBV ${fs.obvTrend === "yükselen" ? "rising" : fs.obvTrend === "düşen" ? "falling" : "flat"}, A/D ${fs.adTrend === "yükselen" ? "rising" : fs.adTrend === "düşen" ? "falling" : "flat"}. MFI ${fs.mfi?.toFixed(0)} (${fs.mfiLabel === "Aşırı Alım" ? "Overbought" : fs.mfiLabel === "Aşırı Satım" ? "Oversold" : "Normal"}). Pattern: ${fs.pvPattern === "güçlü birikim" ? "Strong accumulation" : fs.pvPattern === "güçlü dağıtım" ? "Strong distribution" : fs.pvPattern === "zayıf yükseliş" ? "Weak rally" : "Normal pullback"}.`
                    : `OBV ${fs.obvTrend}, A/D ${fs.adTrend}. MFI ${fs.mfi?.toFixed(0)} (${fs.mfiLabel}). Fiyat-hacim: ${fs.pvPattern}. Uyumsuzluk: ${fs.divergence}.`}
                </p>
              </div>
            )}
          </div>

          {/* MA Table */}
          <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">{L(lang, "Hareketli Ortalamalar", "Moving Averages")}</div>
            <MARow label="EMA 20" value={ema20} current={currentPrice} lang={lang} />
            <MARow label="EMA 50" value={ema50} current={currentPrice} lang={lang} />
            <MARow label="EMA 200" value={ema200} current={currentPrice} lang={lang} />
            {ma.ma7 > 0 && <MARow label="MA 7" value={ma.ma7} current={currentPrice} lang={lang} />}
            {ma.ma21 > 0 && <MARow label="MA 21" value={ma.ma21} current={currentPrice} lang={lang} />}
            <div className="flex items-center justify-between pt-2 mt-1">
              <span className="text-[11px] text-slate-400">{L(lang, "Kesişim Durumu", "Cross Status")}</span>
              <span className={`text-[11px] font-black ${ma.goldenCross ? "text-amber-400" : "text-slate-400"}`}>
                {ma.goldenCross ? L(lang, "🟡 Altın Kesişim", "🟡 Golden Cross") : L(lang, "⚫ Ölüm Kesişimi", "⚫ Death Cross")}
              </span>
            </div>
          </div>
        </div>

        {/* ── Market Context ──────────────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-xl p-4 md:p-5">
          <SectionTitle icon="🌐" title={L(lang, "Piyasa & Endeks Konumu", "Market & Index Position")} />

          <div className="grid grid-cols-3 gap-2 mb-4">
            {rd.sp500Change !== null && rd.sp500Change !== undefined && (
              <MetricBox
                label="S&P 500"
                value={`${rd.sp500Change >= 0 ? "+" : ""}${rd.sp500Change?.toFixed(2)}%`}
                color={rd.sp500Change >= 0 ? "green" : "rose"}
              />
            )}
            {rd.nasdaqChange !== null && rd.nasdaqChange !== undefined && (
              <MetricBox
                label="Nasdaq"
                value={`${rd.nasdaqChange >= 0 ? "+" : ""}${rd.nasdaqChange?.toFixed(2)}%`}
                color={rd.nasdaqChange >= 0 ? "green" : "rose"}
              />
            )}
            {rd.vixPrice !== null && rd.vixPrice !== undefined && (
              <MetricBox
                label="VIX"
                value={rd.vixPrice?.toFixed(1)}
                sub={rd.vixPrice > 25 ? L(lang, "Yüksek Korku", "High Fear") : rd.vixPrice > 18 ? L(lang, "Orta", "Moderate") : L(lang, "Düşük Korku", "Low Fear")}
                color={rd.vixPrice > 25 ? "rose" : rd.vixPrice > 18 ? "amber" : "green"}
              />
            )}
          </div>

          <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
            <p className="text-[12px] text-slate-300 leading-relaxed">{marketText}</p>
          </div>
        </div>

        {/* ── Peer Comparison ────────────────────────────────────────────── */}
        {rd.peerData?.length > 0 && (() => {
          const peers: any[] = rd.peerData;
          const stockChangePct = rd.sp500Change ?? 0; // use as reference fallback
          return (
            <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-xl p-4 md:p-5">
              <SectionTitle icon="🔍" title={L(lang, "Sektör Rakipleri Karşılaştırması", "Sector Peer Comparison")} />
              <div className="text-[11px] text-slate-400 mb-3">
                {L(lang,
                  `${data.sector || "Sektör"} hisselerinin bugünkü performansına göre ${ticker} konumlanması:`,
                  `${ticker} positioning relative to ${data.sector || "sector"} peers today:`
                )}
              </div>
              <div className="space-y-2">
                {peers.map((p: any) => {
                  const up = p.changePct >= 0;
                  return (
                    <div key={p.ticker} className="flex items-center gap-3 bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg px-3 py-2">
                      <span className="text-[12px] font-black text-white w-12 shrink-0">{p.ticker}</span>
                      <span className="text-[11px] text-slate-400 flex-1 truncate">{p.name}</span>
                      <span className="text-[12px] font-black text-white shrink-0">${p.price.toFixed(2)}</span>
                      <span className={`text-[12px] font-black w-16 text-right shrink-0 ${up ? "text-emerald-400" : "text-rose-400"}`}>
                        {up ? "+" : ""}{p.changePct.toFixed(2)}%
                      </span>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: up ? "#10b981" : "#f43f5e" }} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Section 3: Institutional Layer ─────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-xl p-4 md:p-5">
          <SectionTitle icon="🏛️" title={L(lang, "Kurumsal Katman", "Institutional Layer")} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Insider Transactions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-slate-400 font-black uppercase tracking-wider">{L(lang, "İçeriden İşlemler (Form 4)", "Insider Transactions (Form 4)")}</div>
                {(insiderSummary.buyCount > 0 || insiderSummary.sellCount > 0) && (
                  <div className="flex gap-2 text-[10px]">
                    {insiderSummary.buyCount > 0 && (
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded font-black">
                        {insiderSummary.buyCount} {L(lang, "ALIŞ", "BUY")}
                      </span>
                    )}
                    {insiderSummary.sellCount > 0 && (
                      <span className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded font-black">
                        {insiderSummary.sellCount} {L(lang, "SATIŞ", "SELL")}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
                {insiders.length > 0 ? (
                  insiders.slice(0, 6).map((tx: any, i: number) => <InsiderRow key={i} tx={tx} lang={lang} />)
                ) : (
                  <p className="text-[11px] text-slate-500 text-center py-3">{L(lang, "İçeriden işlem verisi bulunamadı.", "No insider transaction data available.")}</p>
                )}
              </div>
            </div>

            {/* 13F Institutional Ownership */}
            <div>
              <div className="text-[11px] text-slate-400 font-black uppercase tracking-wider mb-2">{L(lang, "Kurumsal Sahiplik Değişimi (13F)", "Institutional Ownership Changes (13F)")}</div>
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
                {instOwners.length > 0 ? (
                  instOwners.map((o: any, i: number) => <InstitutionRow key={i} owner={o} lang={lang} />)
                ) : (
                  <p className="text-[11px] text-slate-500 text-center py-3">{L(lang, "Kurumsal sahiplik verisi bulunamadı.", "No institutional ownership data available.")}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: Catalysts & Risks ───────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-xl p-4 md:p-5">
          <SectionTitle icon="⚡" title={L(lang, "Katalizörler & Riskler", "Catalysts & Risks")} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Earnings History */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-slate-400 font-black uppercase tracking-wider">{L(lang, "Kazanç Geçmişi", "Earnings History")}</div>
                {totalEarnings > 0 && (
                  <span className="text-[10px] font-bold text-amber-400">
                    {beatCount}/{totalEarnings} {L(lang, "Geçti", "Beat")}
                  </span>
                )}
              </div>
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
                {earnings.length > 0 ? (
                  earnings.map((e: any, i: number) => <EarningsRow key={i} e={e} lang={lang} />)
                ) : (
                  <p className="text-[11px] text-slate-500 text-center py-3">{L(lang, "Kazanç verisi bulunamadı.", "No earnings data available.")}</p>
                )}
              </div>
            </div>

            {/* Analyst Consensus */}
            <div>
              <div className="text-[11px] text-slate-400 font-black uppercase tracking-wider mb-2">{L(lang, "Analist Konsensüsü", "Analyst Consensus")}</div>
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
                {analyst.count > 0 ? (
                  <>
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1 text-center">
                        <div className="text-[18px] font-black text-emerald-400">{analyst.buy}</div>
                        <div className="text-[10px] text-slate-400">{L(lang, "Al", "Buy")}</div>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-[18px] font-black text-amber-400">{analyst.hold}</div>
                        <div className="text-[10px] text-slate-400">{L(lang, "Tut", "Hold")}</div>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-[18px] font-black text-rose-400">{analyst.sell}</div>
                        <div className="text-[10px] text-slate-400">{L(lang, "Sat", "Sell")}</div>
                      </div>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden mb-3">
                      {analyst.buy > 0 && <div className="bg-emerald-500" style={{ width: `${(analyst.buy / analyst.count) * 100}%` }} />}
                      {analyst.hold > 0 && <div className="bg-amber-500" style={{ width: `${(analyst.hold / analyst.count) * 100}%` }} />}
                      {analyst.sell > 0 && <div className="bg-rose-500" style={{ width: `${(analyst.sell / analyst.count) * 100}%` }} />}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {L(lang, "Ort. Hedef", "Avg Target")}: <span className="text-white font-bold">${analyst.avgTarget?.toFixed(2)}</span>
                      <span className="text-slate-500 mx-1">·</span>
                      <span className="text-slate-500">${analyst.minTarget?.toFixed(2)} – ${analyst.maxTarget?.toFixed(2)}</span>
                    </div>
                    {analyst.recentUpgrades?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[#1e3a5f]/30">
                        <div className="text-[10px] text-slate-500 mb-1">{L(lang, "Son Güncellemeler", "Recent Upgrades")}</div>
                        {analyst.recentUpgrades.map((u: any, i: number) => (
                          <div key={i} className="text-[10px] text-slate-400 py-0.5">
                            {u.firm} · {u.from} → <span className="text-white font-bold">{u.to}</span> · {u.date}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 text-center py-3">{L(lang, "Analist verisi bulunamadı.", "No analyst data available.")}</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent News */}
          {news.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] text-slate-400 font-black uppercase tracking-wider mb-2">{L(lang, "Son Haberler", "Recent News")}</div>
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
                {news.map((item: any, i: number) => <NewsItem key={i} item={item} lang={lang} />)}
              </div>
            </div>
          )}

          {/* Macro Risk */}
          <div className="bg-[#0a0e18] border border-amber-500/20 rounded-lg p-3">
            <div className="text-[10px] text-amber-400 font-black uppercase tracking-wider mb-1.5">{L(lang, "Makro & Sektör Riski", "Macro & Sector Risk")}</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{macroRisk}</p>
            {a.sonucKarar?.kritikRisk && (
              <p className="text-[11px] text-slate-400 leading-relaxed mt-2 border-t border-[#1e3a5f]/30 pt-2">{a.sonucKarar.kritikRisk}</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
