"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BogaChartEngine from "./charts/BogaChartEngine";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import PremiumModal from "./global/PremiumModal";
import { formatNumber } from "@/lib/formatNumber";

interface Props {
  ticker: string;
  stockData: any;
  onClose?: () => void;
  lang?: "tr" | "en" | "es" | "fr" | "pt";
  mode?: "overlay" | "page";
}

const L = (lang: "tr" | "en" | "es" | "fr" | "pt" | string, tr: string, en: string, es?: string, fr?: string) =>
  lang === "tr" ? tr : lang === "es" ? (es || en) : lang === "fr" ? (fr || en) : en;

const _cache = new Map<string, any>();
function getCacheKey(ticker: string, lang: string) {
  return `${ticker}_${lang}_${new Date().toISOString().slice(0, 10)}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVol(v: number): string {
  if (v >= 1e9) return formatNumber(v / 1e9, 2) + "B";
  if (v >= 1e6) return formatNumber(v / 1e6, 2) + "M";
  if (v >= 1e3) return formatNumber(v / 1e3, 0) + "K";
  return String(v);
}
function fmtUsd(v: number) { return "$" + formatNumber(v, 2); }

// ── Candle pattern detail ─────────────────────────────────────────────────────

function candleDetail(pattern: string, lang: "tr" | "en" | "es" | "fr" | "pt"): { signal: "bull" | "bear" | "neutral"; desc: string; action: string } {
  const map: Record<string, { signal: "bull" | "bear" | "neutral"; tr: [string, string]; en: [string, string] }> = {
    "Hammer":            { signal: "bull", tr: ["Çekiç — düşüş sonunda güçlü dönüş sinyali. Alt gölge uzun, kapanış gün ortasının üstünde.", "Önceki kapanışın üzerinde günlük kapanış onaylarsa uzun pozisyon değerlendir."], en: ["Hammer — strong reversal signal at the base of a downtrend. Long lower wick, close above midpoint.", "Consider long if next day closes above the hammer's high."] },
    "Shooting Star":     { signal: "bear", tr: ["Kayan Yıldız — yükseliş tepesinde dönüş uyarısı. Üst gölge uzun, satıcılar gün içi yükselişi geri aldı.", "Kapanış Kayan Yıldız'ın altına inerse short veya çıkış değerlendir."], en: ["Shooting Star — reversal warning at rally peak. Long upper wick shows sellers overtook buyers intraday.", "Consider exit/short if price closes below the shooting star's low."] },
    "Doji":              { signal: "neutral", tr: ["Doji — alıcı ve satıcılar dengede, piyasa kararsız. Yön kırılımı yakın olabilir.", "Bir sonraki güçlü mumun yönünü takip et; hacim düşükse sinyal zayıf."], en: ["Doji — buyers and sellers at equilibrium, indecision in the market. A breakout may be near.", "Follow the direction of the next strong candle; low volume weakens the signal."] },
    "Bullish Engulfing": { signal: "bull", tr: ["Yutan Yükseliş — önceki kırmızı mumu tamamen yutan yeşil mum. Güçlü alıcı baskısı.", "Hacim ortalamanın üzerindeyse ve kırılım noktası yakınsa pozisyon için güçlü sinyal."], en: ["Bullish Engulfing — green candle fully engulfs prior red. Strong buying pressure confirmation.", "High-confidence long signal if volume is above average and price is near a key breakout level."] },
    "Bearish Engulfing": { signal: "bear", tr: ["Yutan Düşüş — önceki yeşil mumu tamamen yutan kırmızı mum. Güçlü satıcı baskısı.", "Hacim artışı eşlik ediyorsa mevcut uzun pozisyonu koru veya stop sık."], en: ["Bearish Engulfing — red candle fully engulfs prior green. Strong selling pressure.", "If accompanied by above-average volume, tighten stops or reduce long exposure."] },
    "Morning Star":      { signal: "bull", tr: ["Sabah Yıldızı — 3 mumlu dipten dönüş formasyonu. Düşüş momentumu tükeniyor.", "Üçüncü yeşil mum güçlüyse ve hacim artıyorsa swing long için uygun ortam."], en: ["Morning Star — 3-candle bottom reversal. Selling momentum exhausted.", "Strong third green candle with rising volume creates a quality swing long setup."] },
    "Evening Star":      { signal: "bear", tr: ["Akşam Yıldızı — 3 mumlu tepeden dönüş formasyonu. Yükseliş momentumu tükeniyor.", "Üçüncü kırmızı mum kapanışı zayıflatıyorsa stop sıkıştır veya çıkışı planla."], en: ["Evening Star — 3-candle top reversal. Buying momentum exhausted.", "If the third red candle closes strongly lower, tighten stops or plan an exit."] },
    "Strong Bullish":    { signal: "bull", tr: ["Güçlü Yükseliş Mumu — gün boyunca satıcıları ezdiren güçlü alıcı günü.", "Hacim desteği varsa trend devamı için pozitif bağlam sağlar."], en: ["Strong Bullish — buyers dominated all day, candle body spans most of the range.", "With volume support, provides positive context for trend continuation."] },
    "Strong Bearish":    { signal: "bear", tr: ["Güçlü Düşüş Mumu — gün boyunca alıcıları ezdiren güçlü satıcı günü.", "Destek kırılımı sonrasında geldiyse düşüş ivmesi hızlanabilir."], en: ["Strong Bearish — sellers dominated all day, candle body spans most of the range.", "After a support break, downside momentum can accelerate."] },
  };
  const entry = map[pattern];
  if (!entry) return {
    signal: "neutral",
    desc: L(lang, "Belirgin bir mum formasyonu tespit edilmedi.", "No distinctive candle pattern detected."),
    action: L(lang, "Genel trend ve hacim analizine devam et.", "Continue with general trend and volume analysis."),
  };
  return { signal: entry.signal, desc: lang === "tr" ? entry.tr[0] : entry.en[0], action: lang === "tr" ? entry.tr[1] : entry.en[1] };
}

// ── Trade plan (fixed math) ───────────────────────────────────────────────────

function tradePlan(rd: any, sr: any, horizon: "swing" | "position" | "investment", lang: "tr" | "en" | "es" | "fr" | "pt") {
  const price = rd.currentPrice || 100;

  // Defensive: enforce supports below price, resistances above
  const s1 = Math.min(sr.support1 || price * 0.95, price * 0.98);
  const s2 = Math.min(sr.support2 || price * 0.91, price * 0.95);
  const r1raw = sr.resistance1 || 0;
  const r2raw = sr.resistance2 || 0;
  const r3raw = sr.resistance3 || 0;
  const r1 = Math.max(r1raw > price * 0.99 ? r1raw : 0, price * 1.04);
  const r2 = Math.max(r2raw > price * 0.99 ? r2raw : 0, price * 1.09);
  const r3 = Math.max(r3raw > price * 0.99 ? r3raw : 0, price * 1.15);

  const ema20  = rd.ema20  || price;
  const ema50  = rd.ema50  || price * 0.97;
  const ema200 = rd.ema200 || price * 0.93;
  const low52  = rd.low52w  || price * 0.70;
  const high52 = Math.max(rd.high52w || 0, price * 1.10);
  const atr    = rd.atr || price * 0.02;

  if (horizon === "swing") {
    // Downtrend (price below both EMAs, EMA20 sagging below EMA50): don't
    // suggest chasing the falling price — require a confirmed EMA20
    // breakout instead, and flag it so the user knows to wait.
    const isDowntrend = price < ema20 && ema20 < ema50;
    let waitWarning: string | null = null;
    if (isDowntrend) {
      waitWarning = L(
        lang,
        `Bekleme: Düşüş trendi — EMA20 (${fmtUsd(ema20)}) üstünde günlük kapanış onayı bekleniyor`,
        `Wait: Downtrend — waiting for a daily close above EMA20 (${fmtUsd(ema20)}) to confirm reversal`,
        `Espera: Tendencia bajista — esperando un cierre diario por encima de EMA20 (${fmtUsd(ema20)})`,
        `Attente : Tendance baissière — en attente d'une clôture journalière au-dessus de l'EMA20 (${fmtUsd(ema20)})`
      );
    }

    // Paylasilan motorun (lib/tradePlanEngine.ts) plani varsa BIREBIR onu
    // goster — /graphic ve /en/stock ile ayni giris araligi / stop / TP1-3.
    const ep = rd.enginePlan;
    let entryLow: number, entryHigh: number, stop: number, t1: number, t2: number, t3: number;
    if (ep && ep.entryLow > 0 && ep.t1 > 0) {
      entryLow = ep.entryLow; entryHigh = ep.entryHigh;
      stop = ep.stop; t1 = ep.t1; t2 = ep.t2; t3 = ep.t3;
    } else {
      // Motor verisi yoksa ayni formulun lokal karsiligi: pivot direnc
      // merdiveni (r1/r2/r3) + yuzde tabanlari, giris destek->fiyat araligi.
      entryHigh = +formatNumber((isDowntrend ? ema20 * 1.005 : (price >= ema20 * 0.995 ? price : Math.min(price, ema20) * 1.002)), 2);
      entryLow  = +formatNumber(Math.min(entryHigh * 0.995, Math.max(s1 * 1.002, entryHigh - atr)), 2);
      const mid = (entryLow + entryHigh) / 2;
      stop = +formatNumber(Math.min(s1, mid * 0.975), 2);
      t1   = +formatNumber(Math.max(r1, mid * 1.05), 2);
      t2   = +formatNumber(Math.max(r2, mid * 1.10, t1 * 1.02), 2);
      t3   = +formatNumber(Math.max(r3, mid * 1.15, t2 * 1.02), 2);
    }
    const entry = +formatNumber(((entryLow + entryHigh) / 2), 2);
    const risk  = Math.max(entry - stop, price * 0.01);
    const rr1   = +formatNumber(((t1 - entry) / risk), 1);
    const rr2   = +formatNumber(((t2 - entry) / risk), 1);
    const trailStop = +formatNumber((entry + (t1 - entry) * 0.5), 2);
    const trailRule = lang === "tr"
      ? `${fmtUsd(t1)} üstünde günlük kapanış → stop ${fmtUsd(trailStop)}'a taşı (giriş +%50R)`
      : `Daily close above ${fmtUsd(t1)} → trail stop to ${fmtUsd(trailStop)} (entry +50%R)`;
    return { timeframe: L(lang, "Swing (90 Güne Kadar)", "Swing (Up to 90 Days)"), entry, entryLow, entryHigh, stop, t1, t2, t3, rr1, rr2, invalidation: +formatNumber(Math.min(s1, stop), 2), anchor: L(lang, "Pivot destek bazlı giriş aralığı", "Pivot-support entry zone"), trailRule, waitWarning };
  }

  if (horizon === "position") {
    const entryHigh = +formatNumber((price >= ema50 * 0.995 ? price : Math.min(price, ema50) * 1.002), 2);
    const entryLow  = +formatNumber(Math.min(entryHigh * 0.995, Math.max(ema50 * 1.002, entryHigh * 0.94)), 2);
    const entry = +formatNumber(((entryLow + entryHigh) / 2), 2);
    const stop  = +formatNumber(Math.min(s2, entry * 0.94), 2);
    const risk  = Math.max(entry - stop, price * 0.02);
    const t1    = +formatNumber(Math.max(r2, entry * 1.09), 2);
    const t2    = +formatNumber(Math.max(r3, entry * 1.18), 2);
    const rr1   = +formatNumber(((t1 - entry) / risk), 1);
    const rr2   = +formatNumber(((t2 - entry) / risk), 1);
    const trailRule = lang === "tr"
      ? `${fmtUsd(t1)} üstünde haftalık kapanış → stop'u giriş bölgesine (${fmtUsd(entry)}) taşı`
      : `Weekly close above ${fmtUsd(t1)} → move stop to break-even (${fmtUsd(entry)})`;
    return { timeframe: L(lang, "Pozisyon (1-3 Ay)", "Position (1-3 Months)"), entry, entryLow, entryHigh, stop, t1, t2, t3: null as number | null, rr1, rr2, invalidation: s2, anchor: L(lang, "EMA50 baz", "EMA50 anchor"), trailRule, waitWarning: null as string | null };
  }

  // investment
  const entryHigh = +formatNumber((price >= ema200 * 0.995 ? price : Math.min(price, ema200) * 1.002), 2);
  const entryLow  = +formatNumber(Math.min(entryHigh * 0.995, Math.max(ema200 * 1.002, entryHigh * 0.88)), 2);
  const entry = +formatNumber(((entryLow + entryHigh) / 2), 2);
  const stop  = +formatNumber(Math.min(low52, ema200 * 0.87, entry * 0.88), 2);
  const risk  = Math.max(entry - stop, price * 0.05);
  const t1    = +formatNumber(Math.max(high52, entry * 1.18), 2);
  const t2    = +formatNumber(Math.max(r3, entry * 1.30), 2);
  const rr1   = +formatNumber(((t1 - entry) / risk), 1);
  const rr2   = +formatNumber(((t2 - entry) / risk), 1);
  const trailRule = lang === "tr"
    ? `${fmtUsd(t1)} üstünde aylık kapanış → %50 çıkış yap, kalan T2 için tut`
    : `Monthly close above ${fmtUsd(t1)} → take 50% off, hold rest to T2`;
  return { timeframe: L(lang, "Yatırım (6+ Ay)", "Investment (6M+)"), entry, entryLow, entryHigh, stop, t1, t2, t3: null as number | null, rr1, rr2, invalidation: ema200, anchor: L(lang, "EMA200 baz", "EMA200 anchor"), trailRule, waitWarning: null as string | null };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-base">{icon}</span>
      <h3 className="text-[12px] font-medium text-white uppercase tracking-[0.12em]">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-[#1e3a5f] to-transparent" />
    </div>
  );
}

function Chip({ label, color = "slate" }: { label: string; color?: string }) {
  const cls = color === "green"  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : color === "red"    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
    : color === "amber"  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : color === "cyan"   ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
    : color === "purple" ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
    : "bg-slate-700/40 text-slate-400 border-slate-600/30";
  return <span className={`inline-flex items-center border rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>{label}</span>;
}

function MetricBox({ label, value, sub, color = "slate" }: { label: string; value: string; sub?: string; color?: string }) {
  const border = color === "green"  ? "border-emerald-500/25 bg-emerald-500/5"
    : color === "red"    ? "border-rose-500/25 bg-rose-500/5"
    : color === "amber"  ? "border-amber-500/25 bg-amber-500/5"
    : color === "cyan"   ? "border-cyan-500/25 bg-cyan-500/5"
    : color === "purple" ? "border-purple-500/25 bg-purple-500/5"
    : "border-slate-600/30 bg-slate-800/20";
  const valCl = color === "green" ? "text-emerald-400" : color === "red" ? "text-rose-400" : color === "amber" ? "text-amber-400" : color === "cyan" ? "text-cyan-400" : color === "purple" ? "text-purple-400" : "text-white";
  return (
    <div className={`border rounded-xl p-3 text-center ${border}`}>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-[15px] md:text-[17px] font-medium ${valCl}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function PlanRow({ label, value, valueColor = "white", note }: { label: string; value: string; valueColor?: string; note?: string }) {
  const cl = valueColor === "green" ? "text-emerald-400" : valueColor === "red" ? "text-rose-400" : valueColor === "amber" ? "text-amber-400" : valueColor === "cyan" ? "text-cyan-400" : "text-white";
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

function MARowL({ label, value, current, lang }: { label: string; value: number; current: number; lang: "tr" | "en" | "es" | "fr" | "pt" }) {
  const above = current >= value;
  const dist = value > 0 ? ((current - value) / value * 100) : 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/25 last:border-0">
      <span className="text-[11px] text-slate-400 w-16">{label}</span>
      <span className="text-[11px] text-slate-500 flex-1 text-center">{dist >= 0 ? "+" : ""}{formatNumber(dist, 1)}%</span>
      <span className="text-[12px] font-medium text-white w-20 text-right">{fmtUsd(value)}</span>
      <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded w-16 text-center ${above ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
        {above ? L(lang, "Üstünde", "Above") : L(lang, "Altında", "Below")}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DeepAnalysisReport({ ticker, stockData, onClose, lang = "tr", mode = "overlay" }: Props) {
  const { isPremium } = useMemberPlan();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [searchTicker, setSearchTicker] = useState("");
  const router = useRouter();

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [horizon, setHorizon] = useState<"swing" | "position" | "investment">("swing");

  useEffect(() => {
    const key = getCacheKey(ticker, lang);
    const cached = _cache.get(key);
    if (cached && cached.companyName && cached.companyName !== ticker.toUpperCase()) {
      setData(cached); setLoading(false); return;
    }
    let cancelled = false;
    setLoading(true); setError(null);
    fetch("/api/deep-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, stockData, lang }),
    })
      .then(r => r.json())
      .then(d => { if (cancelled) return; _cache.set(getCacheKey(ticker, lang), d); setData(d); setLoading(false); })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spinnerCls = mode === "overlay"
    ? "fixed inset-0 z-[99999] bg-[#080c14] flex flex-col items-center justify-center gap-4"
    : "flex flex-col items-center justify-center gap-4 py-24";

  if (loading) return (
    <div className={spinnerCls}>
      <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">{L(lang, "Derin analiz hazırlanıyor...", "Preparing deep analysis...")}</p>
    </div>
  );
  if (error || !data) return (
    <div className={spinnerCls}>
      <p className="text-rose-400 text-sm">{L(lang, "Analiz yüklenemedi.", "Failed to load analysis.")}</p>
    </div>
  );

  const rd = data.rawData || {};
  const a  = data.analysis || {};
  const sr = rd.srLevels || {};
  const ma = rd.maLevels || {};
  const fs = rd.flowSummary || null;

  const companyName   = data.companyName || ticker;
  const sector        = data.sector || "";
  const cp            = rd.currentPrice || 0;
  const ms            = rd.masterScore  || 0;
  const rsi           = rd.rsi    || 0;
  const iv            = rd.iv     || 0;
  const ivRank        = rd.ivRank || 0;
  const atr           = rd.atr    || 0;
  const implied       = rd.implied30dMove || 0;
  const ema20         = rd.ema20   || 0;
  const ema50         = rd.ema50   || 0;
  const ema200        = rd.ema200  || 0;
  const rvol          = rd.rvol    || 1;
  const volume        = rd.volume  || 0;
  const avgVol        = rd.avgVol30d || 0;
  const vwap20        = rd.vwap20  || null;
  const poc           = rd.poc     || null;
  const rs20d         = rd.rs20d   ?? null;
  const peers: any[]  = rd.peerData || [];
  const insiders      = (rd.insiderTransactions || []).filter((t: any) => t.type === "BUY" || t.type === "SELL");
  const instOwners: any[] = rd.institutionalOwners || [];
  const earnings: any[]   = rd.earningsHistory || [];
  const news: any[]       = (rd.recentNews || []).slice(0, 5);
  const analyst           = rd.analystData || {};
  const insiderSummary    = rd.insiderSummary || {};
  const pattern           = rd.candlePattern || "—";
  const nextEarnings: string | null = rd.nextEarningsDate;
  const earningsDays: number | null = rd.nextEarningsDaysAway;
  const beatCount = earnings.filter((e: any) => e.epsBeating).length;

  const rsiColor = rsi >= 70 ? "red" : rsi < 30 ? "purple" : rsi >= 55 ? "cyan" : "amber";
  const rsiLabel = rsi >= 70 ? L(lang, "Aşırı Alım", "Overbought") : rsi < 30 ? L(lang, "Aşırı Satım", "Oversold") : L(lang, "Nötr", "Neutral");
  const generatedAt = data.generatedAt
    ? new Date(data.generatedAt).toLocaleString(lang === "tr" ? "tr-TR" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  const plan      = tradePlan(rd, sr, horizon, lang);
  const rrColor   = plan.rr1 >= 3 ? "green" : plan.rr1 >= 2 ? "amber" : "red";
  const cd        = candleDetail(pattern, lang);
  const candleColor = cd.signal === "bull" ? "green" : cd.signal === "bear" ? "red" : "slate";

  const aboveAll  = cp > ema20 && cp > ema50 && cp > ema200;
  const belowAll  = cp < ema20 && cp < ema50 && cp < ema200;
  const regimeLbl = aboveAll ? L(lang, "YÜKSELİŞ REJİMİ", "UPTREND REGIME")
    : belowAll ? L(lang, "DÜŞÜŞ REJİMİ", "DOWNTREND REGIME")
    : L(lang, "GEÇİŞ / KONSOLİDASYON", "TRANSITION / CONSOLIDATION");
  const regimeCls = aboveAll ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/8"
    : belowAll  ? "text-rose-400 border-rose-500/30 bg-rose-500/8"
    : "text-amber-400 border-amber-500/30 bg-amber-500/8";

  // RS data for chart
  const rsEntries = [...peers.map((p: any) => ({ t: p.ticker, v: p.rs20d ?? 0, isSelf: false })),
    ...(rs20d !== null ? [{ t: ticker, v: rs20d, isSelf: true }] : [])];
  rsEntries.sort((a, b) => b.v - a.v);
  const rsMin = rsEntries.length ? Math.min(...rsEntries.map(r => r.v)) : 0;
  const rsMax = rsEntries.length ? Math.max(...rsEntries.map(r => r.v)) : 1;
  const rsRange = rsMax - rsMin || 1;
  const rsNorm = (v: number) => Math.round(Math.max(5, (v - rsMin) / rsRange * 100));

  const wrapCls  = mode === "overlay" ? "fixed inset-0 z-[99999] bg-[#080c14]/97 backdrop-blur-sm overflow-y-auto" : "";
  const innerCls = mode === "overlay" ? "max-w-4xl mx-auto px-4 py-5 flex flex-col gap-5 text-white" : "flex flex-col gap-5 text-white";

  return (
    <div className={wrapCls}>
      {mode === "overlay" && (
        <div className="sticky top-0 z-10 bg-[#080c14]/95 backdrop-blur-sm border-b border-[#1e3a5f]/60 px-4 py-3 flex items-center justify-between">
          <span className="text-[12px] font-medium text-white uppercase tracking-widest">{ticker} — {L(lang, "Derin Analiz", "Deep Analysis")}</span>
          {generatedAt && <span className="text-[10px] text-slate-500 hidden md:inline">{L(lang, "Güncellendi", "Updated")}: {generatedAt}</span>}
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-[20px] leading-none ml-4" aria-label="Close">✕</button>
        </div>
      )}
      {mode === "page" && generatedAt && (
        <div className="text-[10px] text-slate-600 mb-3">{L(lang, "Güncellendi", "Updated")}: {generatedAt}</div>
      )}

      <div className={innerCls}>
        {/* Sonsuz Hisse Sorgulama Barı */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchTicker.trim()) {
              router.push(`/global/${lang}/analysis/${searchTicker.trim().toUpperCase()}`);
            }
          }}
          className="flex items-center gap-2 bg-[#0d1424] border border-[#3b82f6]/40 p-2.5 rounded-2xl shadow-lg"
        >
          <svg className="w-5 h-5 text-[#3b82f6] ml-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
            placeholder={L(lang, "Sonsuz Hisse Sorgula (Örn: AAPL, TSLA, NVDA)...", "Search any stock (e.g. AAPL, TSLA, NVDA)...", "Buscar cualquier acción...", "Rechercher une action...")}
            className="flex-1 bg-transparent text-white text-xs font-mono font-medium uppercase focus:outline-none placeholder:text-slate-500 placeholder:normal-case"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#3b82f6] hover:bg-blue-600 text-white font-medium text-xs uppercase tracking-wider rounded-xl shadow-md transition-all shrink-0"
          >
            {L(lang, "Analiz Et", "Analyze", "Analizar", "Analyser")}
          </button>
        </form>

        {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-2xl p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[26px] md:text-[30px] font-medium text-white tracking-tight">{ticker}</span>
                <span className={`border rounded-full px-3 py-1 text-[13px] font-medium ${ms >= 70 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : ms >= 50 ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-rose-500/40 bg-rose-500/10 text-rose-400"}`}>{ms}/100</span>
              </div>
              <div className="text-[14px] text-slate-200 font-medium mb-1">{companyName}</div>
              <div className="text-[12px] text-slate-500">{sector}{rd.marketCapStr ? ` · ${rd.marketCapStr}` : ""}</div>
            </div>
            <div className="text-right">
              <div className="text-[30px] md:text-[36px] font-medium text-white leading-none">{fmtUsd(cp)}</div>
              <div className="text-[11px] text-slate-500 mt-1">{L(lang, "Güncel Fiyat", "Current Price")}</div>
            </div>
          </div>

          {!isPremium ? (
            <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center cursor-pointer mb-5 shadow-lg" onClick={() => setShowPremiumModal(true)}>
              <div className="flex items-center justify-center gap-2 text-amber-400 font-medium text-xs uppercase tracking-wider">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                <span>{L(lang, "BogaStock.com Trend Strateji Durumu — Premium", "BogaStock.com Trend Strategy Status — Premium")}</span>
              </div>
              <p className="text-[11px] text-white/70 mt-1">{L(lang, "BogaStock.com Strateji durumunu görüntülemek için tıklayıp Premium'a geçin →", "Click to upgrade to Premium to view detailed BogaStock.com Strategy →")}</p>
            </div>
          ) : (
            <>
              <div className={`inline-flex items-center border rounded-lg px-3 py-1.5 mb-4 ${regimeCls}`}>
                <span className="text-[11px] font-medium tracking-wider">{regimeLbl}</span>
                {rd.emaProfile && <span className="ml-2 text-[10px] opacity-70">· {rd.emaProfile.keyEMA} {L(lang, "Hissesi", "Stock")}</span>}
              </div>
              {a.dna?.hisseTipi && (
                <p className="text-[13px] text-slate-300 leading-relaxed mb-5 border-l-2 border-cyan-500/40 pl-3">{a.dna.hisseTipi}</p>
              )}
            </>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricBox label="RSI 14" value={formatNumber(rsi, 1)} sub={rsiLabel} color={rsiColor} />
            <MetricBox label="ATR 14" value={fmtUsd(atr)} sub={`${formatNumber(rd.atrPct, 1) ?? "—"}%`} color="amber" />
            <MetricBox label="IV Rank" value={`${formatNumber(ivRank, 0)}%`} sub={`IV ${iv}%`} color={ivRank > 50 ? "red" : "purple"} />
            <MetricBox label={L(lang, "30G Beklenti", "30D Implied")} value={`±${fmtUsd(implied)}`} sub={`±${cp > 0 ? formatNumber(((implied / cp) * 100), 1) : "—"}%`} color="cyan" />
          </div>
        </div>

        {/* ── 1.5 CHART ────────────────────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-2xl overflow-hidden">
          <BogaChartEngine
            symbol={ticker}
            lang={lang}
            height={360}
            defaultIndicators={["ema20", "ema50"]}
            defaultTimeframe="D"
          />
        </div>

        {/* ── 2. TRADE PLAN ────────────────────────────────────────────────── */}
        {!isPremium ? (
          <div className="bg-gradient-to-b from-[#0d1a2e] to-[#0a0e18] border-2 border-amber-500/40 rounded-2xl p-6 text-center cursor-pointer shadow-xl" onClick={() => setShowPremiumModal(true)}>
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/40">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
            </div>
            <h3 className="text-base font-medium text-white uppercase tracking-wider mb-2">
              {L(lang, "İşlem Planı (Giriş / Stop / Hedefler) — Premium", "Trading Plan (Entry / Stop / Targets) — Premium")}
            </h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed mb-4">
              {L(lang, "Giriş Bölgesi, Stop Loss, T1-T3 Hedefleri ve Trailing Strateji kurallarını kilitleri kaldırmak için Premium üyeliğe geçin.", "Upgrade to Premium to unlock exact Entry Zones, Stop Loss, T1-T3 Targets, and Trailing rules.")}
            </p>
            <button className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-medium text-xs uppercase tracking-wider rounded-xl shadow-lg hover:brightness-110 transition-all">
              {L(lang, "Premium'a Yükselt →", "Upgrade to Premium →")}
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-b from-[#0d1a2e] to-[#0a0e18] border-2 border-[#1e4a7f]/80 rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <h3 className="text-[13px] font-medium text-white uppercase tracking-[0.12em]">{L(lang, "Trade Planı", "Trade Plan")}</h3>
              </div>
              {/* Horizon tabs */}
              <div className="flex gap-1 bg-[#080c14] border border-[#1e3a5f]/50 rounded-lg p-0.5">
                {(["swing", "position", "investment"] as const).map(h => (
                  <button key={h} onClick={() => setHorizon(h)}
                    className={`text-[10px] font-medium uppercase px-2.5 py-1.5 rounded transition-all ${horizon === h ? "bg-[#1e4a7f] text-white" : "text-slate-500 hover:text-slate-300"}`}>
                    {h === "swing" ? "Swing" : h === "position" ? L(lang, "Pozisyon", "Position") : L(lang, "Yatırım", "Invest")}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mb-3">{plan.timeframe} · {plan.anchor}</div>

            {plan.waitWarning && (
              <div className="mb-3 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[11px] font-medium">
                ⏳ {plan.waitWarning}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="bg-[#080c14] border border-[#1e3a5f]/50 rounded-xl p-4">
                <PlanRow label={L(lang, "Giriş Bölgesi", "Entry Zone")} value={`${fmtUsd(plan.entryLow)}–${fmtUsd(plan.entryHigh)}`} valueColor="cyan" />
                <PlanRow label={L(lang, "Zarar Kes", "Stop Loss")} value={fmtUsd(plan.stop)} valueColor="red" note={`-${formatNumber((((plan.entry - plan.stop) / plan.entry) * 100), 1)}%`} />
                <PlanRow label="T1" value={fmtUsd(plan.t1)} valueColor="green" note={`+${formatNumber((((plan.t1 - plan.entry) / plan.entry) * 100), 1)}%`} />
                <PlanRow label="T2" value={fmtUsd(plan.t2)} valueColor="green" note={`+${formatNumber((((plan.t2 - plan.entry) / plan.entry) * 100), 1)}%`} />
                {plan.t3 != null && (
                  <PlanRow label="T3" value={fmtUsd(plan.t3)} valueColor="green" note={`+${formatNumber((((plan.t3 - plan.entry) / plan.entry) * 100), 1)}%`} />
                )}
              </div>
              <div className="bg-[#080c14] border border-[#1e3a5f]/50 rounded-xl p-4">
                <PlanRow label={L(lang, "R/R (T1'e)", "R/R (to T1)")} value={`${plan.rr1}:1`} valueColor={rrColor} />
                <PlanRow label={L(lang, "R/R (T2'ye)", "R/R (to T2)")} value={`${plan.rr2}:1`} valueColor={rrColor} />
                <PlanRow label={L(lang, "Tez İptal Seviyesi", "Thesis Invalidation")} value={fmtUsd(plan.invalidation)} valueColor="red" />
              </div>
            </div>

            {/* Trailing scenario rule */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
              <div className="text-[10px] text-amber-400 uppercase tracking-widest font-medium mb-1">
                {L(lang, "Trailing Kuralı", "Trailing Rule")}
              </div>
              <p className="text-[12px] text-slate-300">{plan.trailRule}</p>
            </div>
          </div>
        )}

        {/* ── 3. KEY LEVELS ────────────────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-2xl p-5 md:p-6">
          <SectionTitle icon="📍" title={L(lang, "Kritik Seviyeler", "Key Levels")} />
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { key: "resistance3", code: "R3", label: L(lang, "Direnç 3", "Resistance 3"), textCl: "text-rose-400",   bordCl: "border-rose-500/20 bg-rose-500/5" },
              { key: "resistance2", code: "R2", label: L(lang, "Direnç 2", "Resistance 2"), textCl: "text-rose-300",   bordCl: "border-rose-500/15 bg-rose-500/5" },
              { key: "resistance1", code: "R1", label: L(lang, "Direnç 1", "Resistance 1"), textCl: "text-orange-300", bordCl: "border-orange-500/20 bg-orange-500/5" },
              { key: "support1",    code: "S1", label: L(lang, "Destek 1", "Support 1"),    textCl: "text-emerald-300", bordCl: "border-emerald-500/20 bg-emerald-500/5" },
              { key: "support2",    code: "S2", label: L(lang, "Destek 2", "Support 2"),    textCl: "text-emerald-400", bordCl: "border-emerald-500/15 bg-emerald-500/5" },
              { key: "support3",    code: "S3", label: L(lang, "Destek 3", "Support 3"),    textCl: "text-teal-400",   bordCl: "border-teal-500/20 bg-teal-500/5" },
            ].map(l => {
              const val  = sr[l.key] ?? 0;
              const dist = cp > 0 ? ((val - cp) / cp * 100) : 0;
              return (
                <div key={l.key} className={`border rounded-xl px-3 py-2.5 ${l.bordCl}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-slate-500 font-medium">{l.code}</span>
                    <span className={`text-[9px] font-medium ${dist >= 0 ? "text-rose-400" : "text-emerald-400"}`}>{dist >= 0 ? "+" : ""}{formatNumber(dist, 1)}%</span>
                  </div>
                  <div className={`text-[14px] md:text-[15px] font-medium ${l.textCl}`}>{fmtUsd(val)}</div>
                  <div className="text-[9px] text-slate-600 mt-0.5">{l.label}</div>
                </div>
              );
            })}
          </div>

          {/* VWAP & POC */}
          {(vwap20 || poc) && (
            <div className="flex gap-2 mb-4">
              {vwap20 && (
                <div className={`flex-1 border rounded-xl px-3 py-2 ${cp > vwap20 ? "border-cyan-500/25 bg-cyan-500/5" : "border-rose-500/20 bg-rose-500/5"}`}>
                  <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-medium">VWAP 20D</div>
                  <div className="text-[15px] font-medium text-white mt-0.5">{fmtUsd(vwap20)}</div>
                  <div className={`text-[10px] mt-0.5 ${cp > vwap20 ? "text-emerald-400" : "text-rose-400"}`}>{cp > vwap20 ? L(lang, "Fiyat Üstünde", "Price Above") : L(lang, "Fiyat Altında", "Price Below")}</div>
                </div>
              )}
              {poc && (
                <div className="flex-1 border border-purple-500/20 bg-purple-500/5 rounded-xl px-3 py-2">
                  <div className="text-[10px] text-purple-400 uppercase tracking-wider font-medium">POC 20D</div>
                  <div className="text-[15px] font-medium text-white mt-0.5">{fmtUsd(poc)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{L(lang, "En Yüksek Hacim Bölgesi", "Highest Volume Node")}</div>
                </div>
              )}
            </div>
          )}

          {/* MAs */}
          <div className="bg-[#0a0e18] border border-[#1e3a5f]/30 rounded-xl p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">{L(lang, "Hareketli Ortalamalar", "Moving Averages")}</div>
            <MARowL label="EMA 20" value={ema20} current={cp} lang={lang} />
            <MARowL label="EMA 50" value={ema50} current={cp} lang={lang} />
            <MARowL label="EMA 200" value={ema200} current={cp} lang={lang} />
            {ma.ma7  > 0 && <MARowL label="MA 7"  value={ma.ma7}  current={cp} lang={lang} />}
            {ma.ma21 > 0 && <MARowL label="MA 21" value={ma.ma21} current={cp} lang={lang} />}
            <div className="flex items-center justify-between pt-2 mt-1">
              <span className="text-[11px] text-slate-500">{L(lang, "EMA Kesişimi", "EMA Cross")}</span>
              <span className={`text-[11px] font-medium ${ma.goldenCross ? "text-amber-400" : "text-slate-500"}`}>
                {ma.goldenCross ? L(lang, "🟡 Altın Kesişim", "🟡 Golden Cross") : L(lang, "⚫ Ölüm Kesişimi", "⚫ Death Cross")}
              </span>
            </div>
          </div>
        </div>

        {/* ── 4. TECHNICAL DISCIPLINE ──────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-2xl p-5 md:p-6">
          <SectionTitle icon="📐" title={L(lang, "Teknik Disiplin & Momentum", "Technical Discipline & Momentum")} />

          {/* Candle pattern */}
          <div className={`border rounded-xl p-4 mb-4 ${candleColor === "green" ? "border-emerald-500/25 bg-emerald-500/5" : candleColor === "red" ? "border-rose-500/25 bg-rose-500/5" : "border-[#1e3a5f]/40 bg-[#0a0e18]"}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">{L(lang, "Mum Paterni (1G)", "Candle Pattern (1D)")}</div>
              {pattern !== "—" && <Chip label={pattern} color={candleColor} />}
            </div>
            {pattern !== "—" ? (
              <>
                <p className="text-[13px] text-white font-medium leading-relaxed mb-2">{cd.desc}</p>
                <p className="text-[12px] text-slate-400 leading-relaxed">{cd.action}</p>
              </>
            ) : (
              <p className="text-[12px] text-slate-400">{L(lang, "Son günlük muma göre belirgin bir formasyon tespit edilmedi. Genel trend ve hacim sinyalleri baz alınmalı.", "No distinctive pattern on the last daily candle. Rely on trend and volume signals.")}</p>
            )}
          </div>

          {/* Roadmap / 24/7 AI Interpreter */}
          {!isPremium ? (
            <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 rounded-xl p-4 mb-4 text-center cursor-pointer shadow-lg" onClick={() => setShowPremiumModal(true)}>
              <div className="flex items-center justify-center gap-2 text-amber-400 font-medium text-xs uppercase tracking-wider mb-1">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>
                <span>{L(lang, "24/7 Yapay Zeka Grafik & Piyasa Yorumlayıcısı — Premium", "24/7 AI Chart & Market Interpreter — Premium")}</span>
              </div>
              <p className="text-[11px] text-white/70">{L(lang, "Anlık yapay zeka grafik yol haritası ve strateji yorumunu görmek için tıklayıp Premium'a geçin →", "Click to upgrade to Premium for 24/7 AI chart roadmap & market commentary →")}</p>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-cyan-500/5 to-transparent border border-cyan-500/20 rounded-xl p-4 mb-4">
              <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-medium mb-2">{L(lang, "24/7 Yapay Zeka Grafik & Piyasa Yorumlayıcısı", "24/7 AI Chart & Market Interpreter")}</div>
              <p className="text-[13px] text-slate-200 leading-relaxed">{(() => {
                const s1 = sr.support1 || cp * 0.95;
                const r1 = sr.resistance1 || cp * 1.05;
                const slope = rd.emaSlope20 || "yatay";
                const slopeEN = (s: string) => s === "yükselen" ? "rising" : s === "düşen" ? "falling" : "flat";
                if (lang === "tr") {
                  return `EMA20 ${slope === "yükselen" ? "yükseliyor" : slope === "düşen" ? "düşüyor" : "yatay seyrediyor"}. ${fmtUsd(r1)} (D1) üzerinde ortalamanın üzerinde hacimli günlük kapanış, yükseliş devamını teyitler. ${fmtUsd(s1)} (D1) altında günlük kapanış yapıyı zayıflatır.`;
                }
                return `EMA20 is ${slopeEN(slope)}. A daily close above ${fmtUsd(r1)} (R1) with above-average volume confirms continuation. A daily close below ${fmtUsd(s1)} (S1) weakens the structure and triggers re-evaluation.`;
              })()}</p>
            </div>
          )}

          {/* Volume */}
          <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-xl p-4 mb-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">{L(lang, "Hacim", "Volume")}</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center"><div className="text-[10px] text-slate-500 mb-1">{L(lang, "Günlük", "Daily")}</div><div className="text-[15px] font-medium text-white">{fmtVol(volume)}</div></div>
              <div className="text-center"><div className="text-[10px] text-slate-500 mb-1">{L(lang, "30G Ort.", "30D Avg")}</div><div className="text-[15px] font-medium text-white">{fmtVol(avgVol)}</div></div>
              <div className={`text-center rounded-lg p-1 ${rvol >= 2 ? "bg-rose-500/10" : rvol >= 1.3 ? "bg-amber-500/10" : ""}`}>
                <div className="text-[10px] text-slate-500 mb-1">RVOL</div>
                <div className={`text-[15px] font-medium ${rvol >= 2 ? "text-rose-400" : rvol >= 1.3 ? "text-amber-400" : rvol < 0.7 ? "text-slate-500" : "text-white"}`}>{formatNumber(rvol, 2)}x</div>
              </div>
            </div>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              {lang === "tr"
                ? rvol >= 2   ? `RVOL ${formatNumber(rvol, 2)}x — yüksek hacim patlaması. Yönlü hareket olasılığı yüksek; günlük ${fmtVol(volume)} hacim, ${fmtVol(avgVol)} olan 30 günlük ortalamanın çok üzerinde.`
                : rvol >= 1.3 ? `RVOL ${formatNumber(rvol, 2)}x — ortalamanın üzerinde katılım. Bugünkü fiyat hareketi normalden daha anlamlı.`
                : rvol < 0.7  ? `RVOL ${formatNumber(rvol, 2)}x — ince katılım. Düşük hacimli hareketler güvenilmez; onay bekle.`
                :               `RVOL ${formatNumber(rvol, 2)}x — normal piyasa koşulları.`
                : rvol >= 2   ? `RVOL ${formatNumber(rvol, 2)}x — volume spike. High-probability directional move; current ${fmtVol(volume)} is well above the ${fmtVol(avgVol)} 30-day average.`
                : rvol >= 1.3 ? `RVOL ${formatNumber(rvol, 2)}x — above-average participation. Today's price action carries more weight than usual.`
                : rvol < 0.7  ? `RVOL ${formatNumber(rvol, 2)}x — thin participation. Moves on low volume are less reliable; wait for confirmation.`
                :               `RVOL ${formatNumber(rvol, 2)}x — normal conditions, no volume anomaly.`}
            </p>
          </div>

          {/* Flow */}
          {fs && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {a.teknikYorum?.trendDurumu && (
                <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-xl p-3">
                  <div className="text-[10px] text-amber-400 uppercase tracking-widest font-medium mb-1.5">{L(lang, "Trend", "Trend")}</div>
                  <p className="text-[12px] text-slate-300 leading-relaxed">{a.teknikYorum.trendDurumu}</p>
                </div>
              )}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-xl p-3">
                <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-medium mb-1.5">OBV / A-D / MFI</div>
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  {lang === "tr"
                    ? `OBV ${fs.obvTrend} · A/D ${fs.adTrend} · MFI ${formatNumber(fs.mfi, 0)} (${fs.mfiLabel}) · ${fs.pvPattern}`
                    : `OBV ${fs.obvTrend === "yükselen" ? "rising" : fs.obvTrend === "düşen" ? "falling" : "flat"} · A/D ${fs.adTrend === "yükselen" ? "rising" : fs.adTrend === "düşen" ? "falling" : "flat"} · MFI ${formatNumber(fs.mfi, 0)} (${fs.mfiLabel === "Aşırı Alım" ? "Overbought" : fs.mfiLabel === "Aşırı Satım" ? "Oversold" : "Normal"}) · ${fs.pvPattern === "güçlü birikim" ? "Strong accumulation" : fs.pvPattern === "güçlü dağıtım" ? "Strong distribution" : fs.pvPattern === "zayıf yükseliş" ? "Weak rally" : "Normal pullback"}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── 5. CATALYST CALENDAR ─────────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-2xl p-5 md:p-6">
          <SectionTitle icon="📅" title={L(lang, "Katalizör Takvimi", "Catalyst Calendar")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className={`border rounded-xl p-4 ${earningsDays !== null && earningsDays <= 14 ? "border-amber-500/40 bg-amber-500/8" : "border-[#1e3a5f]/40 bg-[#0a0e18]"}`}>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{L(lang, "Sonraki Kazanç", "Next Earnings")}</div>
              {nextEarnings ? (
                <>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[17px] font-medium text-white">{nextEarnings}</span>
                    {earningsDays !== null && <Chip label={`${earningsDays}d`} color={earningsDays <= 7 ? "red" : earningsDays <= 14 ? "amber" : "slate"} />}
                  </div>
                  {earningsDays !== null && earningsDays <= 14 && (
                    <p className="text-[11px] text-amber-300 mt-2">{L(lang, `Dikkat: ${earningsDays} gün içinde bilanço. IV artışı ve ani hareket beklenebilir.`, `Caution: Earnings in ${earningsDays} days. Expect IV expansion.`)}</p>
                  )}
                </>
              ) : (
                <span className="text-[13px] text-slate-500">{L(lang, "Tarih bulunamadı", "Date not available")}</span>
              )}
            </div>
            <div className="border border-rose-500/30 bg-rose-500/5 rounded-xl p-4">
              <div className="text-[10px] text-rose-400 uppercase tracking-widest font-medium mb-1">{L(lang, "⚠ Tez İptal Seviyesi", "⚠ Thesis Invalidation")}</div>
              <div className="text-[19px] font-medium text-rose-300 mt-1">{fmtUsd(sr.support2 || cp * 0.91)}</div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {lang === "tr"
                  ? `${fmtUsd(sr.support2 || cp * 0.91)} (D2) altında haftalık kapanış = tez geçersiz.`
                  : `Weekly close below ${fmtUsd(sr.support2 || cp * 0.91)} (S2) = setup invalid.`}
              </p>
            </div>
          </div>
          {earnings.length > 0 && (
            <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{L(lang, "Kazanç Geçmişi", "Earnings History")}</div>
                <span className="text-[10px] font-medium text-amber-400">{beatCount}/{earnings.length} {L(lang, "Beat", "Beat")}</span>
              </div>
              {earnings.map((e: any, i: number) => {
                const beat = e.epsBeating;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/25 last:border-0 gap-2">
                    <div>
                      <span className="text-[12px] font-medium text-white">{e.quarter}</span>
                      <span className="text-[11px] text-slate-500 ml-1.5">{e.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{L(lang, "Ger", "Act")}: <span className="text-white font-medium">${formatNumber(e.eps, 2)}</span> · Est: ${formatNumber(e.estimate, 2)}</span>
                      <span className={`text-[11px] font-medium ${beat ? "text-emerald-400" : "text-rose-400"}`}>{e.epsSurprise > 0 ? "+" : ""}{formatNumber(e.epsSurprise, 1)}%</span>
                      <Chip label={beat ? L(lang, "GEÇTİ", "BEAT") : L(lang, "KAÇIRDI", "MISS")} color={beat ? "green" : "red"} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 6. MARKET & PEERS ────────────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-2xl p-5 md:p-6">
          <SectionTitle icon="🌐" title={L(lang, "Piyasa & Sektör Konumu", "Market & Sector Position")} />
          <div className="grid grid-cols-3 gap-2 mb-4">
            {rd.sp500Change  != null && <MetricBox label="S&P 500" value={`${rd.sp500Change  >= 0 ? "+" : ""}${formatNumber(rd.sp500Change, 2)}%`}  color={rd.sp500Change  >= 0 ? "green" : "red"} />}
            {rd.nasdaqChange != null && <MetricBox label="Nasdaq"   value={`${rd.nasdaqChange >= 0 ? "+" : ""}${formatNumber(rd.nasdaqChange, 2)}%`} color={rd.nasdaqChange >= 0 ? "green" : "red"} />}
            {rd.vixPrice     != null && <MetricBox label="VIX" value={formatNumber(rd.vixPrice, 1)} sub={rd.vixPrice > 25 ? L(lang, "Yüksek Korku", "High Fear") : rd.vixPrice > 18 ? L(lang, "Orta", "Moderate") : L(lang, "Düşük", "Low")} color={rd.vixPrice > 25 ? "red" : rd.vixPrice > 18 ? "amber" : "green"} />}
          </div>

          {/* Daily peer performance */}
          {peers.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">{L(lang, "Sektör Rakipleri — Günlük", "Sector Peers — Daily")}</div>
              <div className="space-y-1.5">
                {peers.map((p: any) => {
                  const up = p.changePct >= 0;
                  const w  = Math.min(100, Math.abs(p.changePct) * 20);
                  return (
                    <div key={p.ticker} className="flex items-center gap-3 bg-[#0a0e18] border border-[#1e3a5f]/30 rounded-lg px-3 py-2">
                      <span className="text-[12px] font-medium text-white w-14 shrink-0">{p.ticker}</span>
                      <span className="text-[11px] text-slate-500 flex-1 truncate">{p.name}</span>
                      <div className="w-16 hidden md:block"><div className={`h-1 rounded-full ${up ? "bg-emerald-500/40" : "bg-rose-500/40"}`} style={{ width: `${w}%` }} /></div>
                      <span className="text-[12px] font-medium text-white shrink-0">{fmtUsd(p.price)}</span>
                      <span className={`text-[12px] font-medium w-14 text-right shrink-0 ${up ? "text-emerald-400" : "text-rose-400"}`}>{up ? "+" : ""}{formatNumber(p.changePct, 2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RS bars */}
          {rsEntries.length > 1 && (
            <div className="bg-[#0a0e18] border border-[#1e3a5f]/30 rounded-xl p-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">{L(lang, "Göreli Güç — 20 Gün", "Relative Strength — 20D")}</div>
              <div className="space-y-2">
                {rsEntries.map(r => (
                  <div key={r.t} className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium w-14 shrink-0 ${r.isSelf ? "text-cyan-400" : "text-slate-300"}`}>{r.t}</span>
                    <div className="flex-1 h-2.5 bg-[#080c14] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${r.isSelf ? "bg-cyan-500" : r.v >= 0 ? "bg-emerald-500/60" : "bg-rose-500/60"}`}
                        style={{ width: `${rsNorm(r.v)}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-medium w-14 text-right shrink-0 ${r.v >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{r.v >= 0 ? "+" : ""}{formatNumber(r.v, 1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 7. INSTITUTIONAL ─────────────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-2xl p-5 md:p-6">
          <SectionTitle icon="🏛️" title={L(lang, "Kurumsal Katman", "Institutional Layer")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{L(lang, "Form 4 — İçeriden", "Form 4 — Insiders")}</div>
                {(insiderSummary.buyCount > 0 || insiderSummary.sellCount > 0) && (
                  <div className="flex gap-1.5">
                    {insiderSummary.buyCount  > 0 && <Chip label={`${insiderSummary.buyCount} ${L(lang, "ALIŞ", "BUY")}`}   color="green" />}
                    {insiderSummary.sellCount > 0 && <Chip label={`${insiderSummary.sellCount} ${L(lang, "SATIŞ", "SELL")}`} color="red" />}
                  </div>
                )}
              </div>
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/30 rounded-xl p-3">
                {insiders.length > 0 ? insiders.slice(0, 6).map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/25 last:border-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-white truncate">{tx.officer}</div>
                      <div className="text-[10px] text-slate-500">{tx.title} · {tx.date}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tx.price && <span className="text-[11px] text-slate-400">{fmtUsd(tx.price)}</span>}
                      <Chip label={tx.type === "BUY" ? L(lang, "ALIŞ", "BUY") : L(lang, "SATIŞ", "SELL")} color={tx.type === "BUY" ? "green" : "red"} />
                    </div>
                  </div>
                )) : <p className="text-[11px] text-slate-600 text-center py-3">{L(lang, "Alış/Satış işlemi bulunamadı.", "No buy/sell transactions found.")}</p>}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide mb-2">{L(lang, "13F — Kurumsal", "13F — Institutional")}</div>
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/30 rounded-xl p-3">
                {instOwners.length > 0 ? instOwners.map((o: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/25 last:border-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-white truncate">{o.name}</div>
                      <div className="text-[10px] text-slate-500">{o.reportDate}</div>
                    </div>
                    <span className={`text-[12px] font-medium shrink-0 ${o.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {o.isNewPosition
                        ? (o.change >= 0 ? `▲ ${L(lang, "Yeni Giriş", "New Entry")}` : `▼ ${L(lang, "Büyük Çıkış", "Major Exit")}`)
                        : `${o.change >= 0 ? "▲" : "▼"} ${formatNumber(Math.abs(o.change), 1)}%`}
                    </span>
                  </div>
                )) : <p className="text-[11px] text-slate-600 text-center py-3">{L(lang, "Veri bulunamadı.", "No data available.")}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* ── 8. ANALYST & NEWS ────────────────────────────────────────────── */}
        <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-2xl p-5 md:p-6">
          <SectionTitle icon="📰" title={L(lang, "Analist & Haberler", "Analyst & News")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">{L(lang, "Analist Konsensüsü", "Analyst Consensus")}</div>
              {analyst.count > 0 ? (
                <div className="bg-[#0a0e18] border border-[#1e3a5f]/30 rounded-xl p-3">
                  <div className="flex gap-4 mb-3">
                    <div className="flex-1 text-center"><div className="text-[18px] font-medium text-emerald-400">{analyst.buy}</div><div className="text-[10px] text-slate-500">{L(lang, "Al", "Buy")}</div></div>
                    <div className="flex-1 text-center"><div className="text-[18px] font-medium text-amber-400">{analyst.hold}</div><div className="text-[10px] text-slate-500">{L(lang, "Tut", "Hold")}</div></div>
                    <div className="flex-1 text-center"><div className="text-[18px] font-medium text-rose-400">{analyst.sell}</div><div className="text-[10px] text-slate-500">{L(lang, "Sat", "Sell")}</div></div>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden mb-3">
                    {analyst.buy  > 0 && <div className="bg-emerald-500" style={{ width: `${(analyst.buy  / analyst.count) * 100}%` }} />}
                    {analyst.hold > 0 && <div className="bg-amber-500"   style={{ width: `${(analyst.hold / analyst.count) * 100}%` }} />}
                    {analyst.sell > 0 && <div className="bg-rose-500"    style={{ width: `${(analyst.sell / analyst.count) * 100}%` }} />}
                  </div>
                  <div className="text-[12px] text-slate-300">{L(lang, "Ort. Hedef", "Avg Target")}: <span className="text-white font-medium">{fmtUsd(analyst.avgTarget)}</span> <span className="text-slate-600 text-[10px]">{fmtUsd(analyst.minTarget)} – {fmtUsd(analyst.maxTarget)}</span></div>
                </div>
              ) : <p className="text-[11px] text-slate-600">{L(lang, "Analist verisi yok.", "No analyst data.")}</p>}
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">{L(lang, "Kritik Risk", "Critical Risk")}</div>
              <div className="bg-[#0a0e18] border border-amber-500/15 rounded-xl p-3">
                <p className="text-[12px] text-slate-300 leading-relaxed">{a.sonucKarar?.kritikRisk || L(lang, "Bilanço tarihi ve makro gelişmeler yakından takip edilmeli.", "Monitor earnings dates and macro developments closely.")}</p>
              </div>
            </div>
          </div>
          {news.length > 0 && (
            <div className="bg-[#0a0e18] border border-[#1e3a5f]/30 rounded-xl p-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">{L(lang, "Son Haberler", "Recent News")}</div>
              {news.map((item: any, i: number) => {
                const sent  = item.sentiment;
                const sentCl = sent === "Pozitif" ? "text-emerald-400" : sent === "Negatif" ? "text-rose-400" : "text-slate-500";
                const sentLbl = lang === "en" ? (sent === "Pozitif" ? "Positive" : sent === "Negatif" ? "Negative" : "Neutral") : sent;
                return (
                  <div key={i} className="py-2.5 border-b border-[#1e3a5f]/25 last:border-0">
                    <div className="text-[12px] text-white font-medium leading-snug mb-1">{item.title}</div>
                    <div className="flex items-center gap-2"><span className="text-[10px] text-slate-600">{item.source} · {item.date}</span><span className={`text-[10px] font-medium ${sentCl}`}>{sentLbl}</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
      {showPremiumModal && <PremiumModal locale={lang} onClose={() => setShowPremiumModal(false)} />}
    </div>
  );
}
