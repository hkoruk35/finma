"use client";

import { useEffect, useState } from "react";

interface Props { ticker: string; stockData: any; onClose: () => void; lang?: "tr" | "en"; }

const L = (lang: "tr" | "en", tr: string, en: string) => lang === "en" ? en : tr;

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

function PivotTable({ sr, lang }: { sr: any; lang: "tr" | "en" }) {
  const levels = [
    { key: "resistance3", label: "R3", color: "text-rose-400" },
    { key: "resistance2", label: "R2", color: "text-rose-300" },
    { key: "resistance1", label: "R1", color: "text-orange-300" },
    { key: "support1", label: "S1", color: "text-emerald-300" },
    { key: "support2", label: "S2", color: "text-emerald-400" },
    { key: "support3", label: "S3", color: "text-teal-400" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {levels.map(l => (
        <div key={l.key} className="flex items-center justify-between bg-[#0a0e18] border border-[#1e3a5f]/40 rounded px-3 py-2">
          <span className="text-[11px] text-slate-400 font-bold">{l.label}</span>
          <span className={`text-[13px] font-black ${l.color}`}>${(sr[l.key] ?? 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function MARow({ label, value, current, lang }: { label: string; value: number; current: number; lang: "tr" | "en" }) {
  const above = current >= value;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1e3a5f]/30 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-black text-white">${value.toFixed(2)}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${above ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
          {above ? L(lang, "Üstünde", "Above") : L(lang, "Altında", "Below")}
        </span>
      </div>
    </div>
  );
}

function InsiderRow({ tx, lang }: { tx: any; lang: "tr" | "en" }) {
  const typeColors: Record<string, string> = {
    BUY: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    SELL: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    OTHER: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  };
  const typeLabel = tx.type === "BUY" ? L(lang, "Alış", "Buy")
    : tx.type === "SELL" ? L(lang, "Satış", "Sell")
    : L(lang, "Diğer", "Other");
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1e3a5f]/30 last:border-0 gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-white truncate">{tx.officer}</div>
        <div className="text-[10px] text-slate-400">{tx.title} · {tx.date}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {tx.price && <span className="text-[11px] text-slate-300">${tx.price}</span>}
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${typeColors[tx.type] || typeColors.OTHER}`}>{typeLabel}</span>
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
  const sentColor = item.sentiment === "Pozitif" ? "text-emerald-400" : item.sentiment === "Negatif" ? "text-rose-400" : "text-slate-400";
  return (
    <div className="py-2 border-b border-[#1e3a5f]/30 last:border-0">
      <div className="text-[11px] text-white font-medium leading-snug mb-0.5">{item.title}</div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500">{item.source} · {item.date}</span>
        <span className={`text-[10px] font-bold ${sentColor}`}>{item.sentiment}</span>
      </div>
    </div>
  );
}

export default function DeepAnalysisReport({ ticker, stockData, onClose, lang = "tr" }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/deep-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, stockData, lang }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [ticker, lang]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">{L(lang, "Derin analiz yükleniyor...", "Loading deep analysis...")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
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

  const insiders: any[] = rd.insiderTransactions || [];
  const instOwners: any[] = rd.institutionalOwners || [];
  const earnings: any[] = rd.earningsHistory || [];
  const news: any[] = (rd.recentNews || []).slice(0, 5);
  const analyst = rd.analystData || {};
  const insiderSummary = rd.insiderSummary || {};

  const beatCount = earnings.filter((e: any) => e.epsBeating).length;
  const totalEarnings = earnings.length;

  const rsiColor = rsi >= 70 ? "rose" : rsi >= 50 ? "cyan" : rsi < 30 ? "purple" : "amber";
  const rsiLabel = rsi >= 70 ? L(lang, "Aşırı Alım", "Overbought") : rsi < 30 ? L(lang, "Aşırı Satım", "Oversold") : L(lang, "Nötr", "Neutral");

  const macroRisk = (() => {
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
  })();

  return (
    <div className="flex flex-col gap-5 text-white">

      {/* ── Section 1: Stock DNA & Summary ───────────────────────────────── */}
      <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-xl p-4 md:p-5">
        <SectionTitle icon="🧬" title={L(lang, "Hisse DNA & Özet", "Stock DNA & Summary")} />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[22px] md:text-[26px] font-black text-white">{ticker}</span>
              <ScoreBadge score={masterScore} />
            </div>
            <div className="text-[12px] text-slate-300 font-medium">{companyName}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{sector}{rd.marketCapStr ? ` · ${rd.marketCapStr}` : ""}</div>
          </div>
          <div className="text-right">
            <div className="text-[26px] md:text-[30px] font-black text-white">${currentPrice.toFixed(2)}</div>
            <div className="text-[11px] text-slate-400">{L(lang, "Güncel Fiyat", "Current Price")}</div>
          </div>
        </div>

        {/* DNA text */}
        {a.dna?.hisseTipi && (
          <p className="text-[12px] text-slate-300 leading-relaxed mb-4 border-l-2 border-cyan-500/40 pl-3">
            {a.dna.hisseTipi}
          </p>
        )}

        {/* 4 Metric Boxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <MetricBox
            label="RSI 14"
            value={rsi.toFixed(1)}
            sub={rsiLabel}
            color={rsiColor}
          />
          <MetricBox
            label="ATR 14"
            value={`$${atr.toFixed(2)}`}
            sub={`${rd.atrPct?.toFixed(1) ?? "—"}%`}
            color="amber"
          />
          <MetricBox
            label={L(lang, "IV Rank", "IV Rank")}
            value={`${ivRank.toFixed(0)}%`}
            sub={`IV ${iv}%`}
            color={ivRank > 50 ? "rose" : "purple"}
          />
          <MetricBox
            label={L(lang, "30G Beklenen Hareket", "30D Implied Move")}
            value={`±$${implied.toFixed(2)}`}
            sub={`±${((implied / currentPrice) * 100).toFixed(1)}%`}
            color="cyan"
          />
        </div>

        {/* Pivot Levels */}
        <div className="mb-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">{L(lang, "Pivot Seviyeleri", "Pivot Levels")}</div>
          <PivotTable sr={sr} lang={lang} />
        </div>
      </div>

      {/* ── Section 2: Technical Discipline & Momentum ───────────────────── */}
      <div className="bg-[#0d1424] border border-[#1e3a5f]/60 rounded-xl p-4 md:p-5">
        <SectionTitle icon="📐" title={L(lang, "Teknik Disiplin & Momentum", "Technical Discipline & Momentum")} />

        {/* Trend, EMA, Volume text blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {a.teknikYorum?.trendDurumu && (
            <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
              <div className="text-[10px] text-cyan-400 font-black uppercase tracking-wider mb-1.5">{L(lang, "Trend Yönü", "Trend Direction")}</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{a.teknikYorum.trendDurumu}</p>
            </div>
          )}
          {a.teknikYorum?.momentumYorumu && (
            <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
              <div className="text-[10px] text-amber-400 font-black uppercase tracking-wider mb-1.5">{L(lang, "EMA & Momentum", "EMA & Momentum")}</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{a.teknikYorum.momentumYorumu}</p>
            </div>
          )}
          {fs ? (
            <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
              <div className="text-[10px] text-emerald-400 font-black uppercase tracking-wider mb-1.5">{L(lang, "Hacim Hizalaması", "Volume Alignment")}</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {lang === "en"
                  ? `OBV ${fs.obvTrend === "yükselen" ? "rising" : fs.obvTrend === "düşen" ? "falling" : "flat"}, A/D ${fs.adTrend === "yükselen" ? "rising" : fs.adTrend === "düşen" ? "falling" : "flat"}. MFI ${fs.mfi?.toFixed(0)} (${fs.mfiLabel === "Aşırı Alım" ? "Overbought" : fs.mfiLabel === "Aşırı Satım" ? "Oversold" : "Normal"}). Pattern: ${fs.pvPattern === "güçlü birikim" ? "Strong accumulation" : fs.pvPattern === "güçlü dağıtım" ? "Strong distribution" : fs.pvPattern === "zayıf yükseliş" ? "Weak rally" : fs.pvPattern === "normal geri çekilme" ? "Normal pullback" : "Neutral"}. Divergence: ${fs.divergence === "negatif" ? "Negative" : fs.divergence === "pozitif" ? "Positive" : "None"}.`
                  : `OBV ${fs.obvTrend}, A/D ${fs.adTrend}. MFI ${fs.mfi?.toFixed(0)} (${fs.mfiLabel}). Fiyat-hacim: ${fs.pvPattern}. Uyumsuzluk: ${fs.divergence}.`}
              </p>
            </div>
          ) : (a.teknikYorum?.volatilite && (
            <div className="bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg p-3">
              <div className="text-[10px] text-purple-400 font-black uppercase tracking-wider mb-1.5">{L(lang, "Volatilite", "Volatility")}</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{a.teknikYorum.volatilite}</p>
            </div>
          ))}
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
            <span className="text-[11px] text-slate-400">{L(lang, "Altın/Ölüm Kesişimi", "Golden/Death Cross")}</span>
            <span className={`text-[11px] font-black ${ma.goldenCross ? "text-amber-400" : "text-slate-500"}`}>
              {ma.goldenCross ? L(lang, "🟡 Altın Kesişim", "🟡 Golden Cross") : L(lang, "⚫ Ölüm Kesişimi", "⚫ Death Cross")}
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 3: Institutional Layer ───────────────────────────────── */}
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
                    <span className="text-emerald-400 font-bold">{insiderSummary.buyCount} {L(lang, "Alış", "Buy")}</span>
                  )}
                  {insiderSummary.sellCount > 0 && (
                    <span className="text-rose-400 font-bold">{insiderSummary.sellCount} {L(lang, "Satış", "Sell")}</span>
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

      {/* ── Section 4: Catalysts & Risks ─────────────────────────────────── */}
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
                  {/* Bar */}
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
  );
}
