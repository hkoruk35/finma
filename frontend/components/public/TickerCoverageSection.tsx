"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { copy } from "@/lib/i18n/copy";
import { formatNumber } from "@/lib/formatNumber";

// 2026-08-23 kullanıcı talebiyle eklendi: /global/{locale}/graphic/[ticker]
// sayfasının EN ALTINA (forecast/SwingStrategyStatusCard/TickerDetailPanel
// sonrasına), o hisseyle ilgili TÜM dağınık içerikleri (X analiz gönderileri,
// bilanço analizi, bilanço takvimi, içeriden işlemler) tek bir bölümde
// birleştiren "koordineli takip" paneli. Amaç: /news, /earning,
// /earning-calendar, /insider sayfalarındaki ilgili-hisse verisini tek
// yerde derinleştirip, sayfa hem insan okuyucu hem de site içi Copilot
// (bkz. /api/ask) için tutarlı/yapılandırılmış tek bir kaynak haline
// gelsin — bu yüzden aşağıda ayrıca JSON-LD (schema.org) bloğu da
// gömülüyor, böylece arama/AI motorları bu dört veri türünü aynı hisseye
// ait olarak "koordineli" biçimde okuyabilir.

interface TickerNewsPost {
  id: string;
  content_text: string | null;
  posted_at: string;
}

interface EarningsAi {
  summary: string;
  revenue_status: string;
  eps_status: string;
  ai_score: number;
}

interface EarningsItem {
  id: string;
  period: string;
  reportDate: string;
  formType: string;
  ai: EarningsAi | null;
}

interface CalendarItem {
  ticker: string;
  companyName: string | null;
  earningsDate: string;
  isEstimate: boolean;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

interface InsiderTx {
  executiveName: string;
  title: string;
  transactionType: "BUY" | "SELL" | "GRANT" | "EXERCISE";
  sharesTransacted: number;
  transactionPrice: number | null;
  transactionDate: string;
}

const L: Record<
  Locale,
  {
    heading: (t: string) => string;
    sub: string;
    news: string;
    newsEmpty: string;
    newsCta: string;
    earnings: string;
    earningsEmpty: string;
    earningsCta: string;
    calendar: string;
    calendarEmpty: string;
    calendarCta: string;
    calendarNext: string;
    epsEst: string;
    revEst: string;
    insider: string;
    insiderEmpty: string;
    insiderCta: string;
    score: string;
  }
> = {
  tr: {
    heading: (t) => `${t} ile İlgili Kapsamlı Takip`,
    sub: "Bu hisseyle ilgili tüm analizler, bilanço değerlendirmeleri, bilanço takvimi ve içeriden işlemler tek yerde — Copilot'ta koordineli olarak izlenir.",
    news: "İlgili Analizler", newsEmpty: "Bu hisse için henüz yayınlanmış analiz yok.", newsCta: "Tüm Analizleri Gör →",
    earnings: "Bilanço Analizi", earningsEmpty: "Bu hisse için henüz işlenmiş bilanço bulunmuyor.", earningsCta: "Bilançoları Gör →",
    calendar: "Bilanço Takvimi", calendarEmpty: "Takvimde planlanmış bir bilanço tarihi yok.", calendarCta: "Bilanço Takvimini Gör →",
    calendarNext: "Sıradaki bilanço tarihi", epsEst: "Tahmini EPS", revEst: "Tahmini Gelir",
    insider: "İçeriden İşlemler", insiderEmpty: "Son dönemde raporlanmış içeriden işlem yok.", insiderCta: "Tüm İçeriden İşlemleri Gör →",
    score: "BOGA AI Skoru",
  },
  en: {
    heading: (t) => `Coordinated Coverage for ${t}`,
    sub: "All analyses, earnings assessments, the earnings calendar entry, and insider activity for this stock in one place — tracked coherently by Copilot.",
    news: "Related Analyses", newsEmpty: "No published analysis for this ticker yet.", newsCta: "View All Analyses →",
    earnings: "Earnings Analysis", earningsEmpty: "No processed earnings report for this ticker yet.", earningsCta: "View Earnings →",
    calendar: "Earnings Calendar", calendarEmpty: "No scheduled earnings date on the calendar.", calendarCta: "View Earnings Calendar →",
    calendarNext: "Next earnings date", epsEst: "EPS Estimate", revEst: "Revenue Estimate",
    insider: "Insider Activity", insiderEmpty: "No insider transactions reported recently.", insiderCta: "View All Insider Activity →",
    score: "BOGA AI Score",
  },
  es: {
    heading: (t) => `Cobertura Coordinada de ${t}`,
    sub: "Todos los análisis, evaluaciones de resultados, el calendario de resultados y la actividad de insiders de esta acción en un solo lugar, seguidos de forma coherente por Copilot.",
    news: "Análisis Relacionados", newsEmpty: "Aún no hay análisis publicados para esta acción.", newsCta: "Ver Todos los Análisis →",
    earnings: "Análisis de Resultados", earningsEmpty: "Aún no hay resultados procesados para esta acción.", earningsCta: "Ver Resultados →",
    calendar: "Calendario de Resultados", calendarEmpty: "No hay fecha de resultados programada.", calendarCta: "Ver Calendario de Resultados →",
    calendarNext: "Próxima fecha de resultados", epsEst: "BPA Estimado", revEst: "Ingresos Estimados",
    insider: "Actividad de Insiders", insiderEmpty: "No se han reportado operaciones de insiders recientemente.", insiderCta: "Ver Toda la Actividad de Insiders →",
    score: "Puntuación BOGA AI",
  },
  fr: {
    heading: (t) => `Couverture Coordonnée de ${t}`,
    sub: "Toutes les analyses, évaluations de résultats, le calendrier des résultats et l'activité des initiés pour cette action au même endroit, suivis de façon cohérente par Copilot.",
    news: "Analyses Associées", newsEmpty: "Aucune analyse publiée pour cette action pour l'instant.", newsCta: "Voir Toutes les Analyses →",
    earnings: "Analyse des Résultats", earningsEmpty: "Aucun résultat traité pour cette action pour l'instant.", earningsCta: "Voir les Résultats →",
    calendar: "Calendrier des Résultats", calendarEmpty: "Aucune date de résultats prévue au calendrier.", calendarCta: "Voir le Calendrier des Résultats →",
    calendarNext: "Prochaine date de résultats", epsEst: "BPA Estimé", revEst: "Chiffre d'Affaires Estimé",
    insider: "Activité des Initiés", insiderEmpty: "Aucune transaction d'initié signalée récemment.", insiderCta: "Voir Toute l'Activité des Initiés →",
    score: "Score BOGA AI",
  },
  pt: {
    heading: (t) => `Cobertura Coordenada de ${t}`,
    sub: "Todas as análises, avaliações de resultados, o calendário de resultados e a atividade de insiders desta ação em um só lugar, acompanhados de forma coerente pelo Copilot.",
    news: "Análises Relacionadas", newsEmpty: "Ainda não há análises publicadas para esta ação.", newsCta: "Ver Todas as Análises →",
    earnings: "Análise de Resultados", earningsEmpty: "Ainda não há resultados processados para esta ação.", earningsCta: "Ver Resultados →",
    calendar: "Calendário de Resultados", calendarEmpty: "Nenhuma data de resultados agendada.", calendarCta: "Ver Calendário de Resultados →",
    calendarNext: "Próxima data de resultados", epsEst: "LPA Estimado", revEst: "Receita Estimada",
    insider: "Atividade de Insiders", insiderEmpty: "Nenhuma transação de insider reportada recentemente.", insiderCta: "Ver Toda a Atividade de Insiders →",
    score: "Pontuação BOGA AI",
  },
  id: {
    heading: (t) => `Liputan Terkoordinasi untuk ${t}`,
    sub: "Semua analisis, penilaian laba, kalender laba, dan aktivitas insider untuk saham ini dalam satu tempat — dipantau secara koheren oleh Copilot.",
    news: "Analisis Terkait", newsEmpty: "Belum ada analisis yang dipublikasikan untuk saham ini.", newsCta: "Lihat Semua Analisis →",
    earnings: "Analisis Laba", earningsEmpty: "Belum ada laporan laba yang diproses untuk saham ini.", earningsCta: "Lihat Laba →",
    calendar: "Kalender Laba", calendarEmpty: "Belum ada tanggal laba terjadwal di kalender.", calendarCta: "Lihat Kalender Laba →",
    calendarNext: "Tanggal laba berikutnya", epsEst: "Estimasi EPS", revEst: "Estimasi Pendapatan",
    insider: "Aktivitas Insider", insiderEmpty: "Belum ada transaksi insider yang dilaporkan baru-baru ini.", insiderCta: "Lihat Semua Aktivitas Insider →",
    score: "Skor BOGA AI",
  },
};

const LOCALE_TAG: Record<Locale, string> = { tr: "tr-TR", en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-BR", id: "id-ID" };

function fmtDate(iso: string, locale: Locale) {
  try {
    return new Date(iso).toLocaleDateString(LOCALE_TAG[locale] || "en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function fmtMoney(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${formatNumber(n / 1e9, 2)}B`;
  if (abs >= 1e6) return `$${formatNumber(n / 1e6, 2)}M`;
  return `$${formatNumber(n, 2)}`;
}

export default function TickerCoverageSection({ ticker, locale }: { ticker: string; locale: Locale }) {
  const t = L[locale] || L.en;
  const insiderT = copy[locale]?.insider;

  const [news, setNews] = useState<TickerNewsPost[] | null>(null);
  const [earnings, setEarnings] = useState<EarningsItem[] | null>(null);
  const [calendar, setCalendar] = useState<CalendarItem[] | null>(null);
  const [insider, setInsider] = useState<InsiderTx[] | null>(null);

  useEffect(() => {
    if (!ticker) return;
    let active = true;

    fetch(`/api/ticker-news?ticker=${ticker}&locale=${locale}&limit=5`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => { if (active) setNews(d.data || []); })
      .catch(() => { if (active) setNews([]); });

    fetch(`/api/earnings?ticker=${ticker}&locale=${locale}&limit=3`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => { if (active) setEarnings(d.data || []); })
      .catch(() => { if (active) setEarnings([]); });

    fetch(`/api/earnings-calendar?ticker=${ticker}&days=90`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => { if (active) setCalendar(d.data || []); })
      .catch(() => { if (active) setCalendar([]); });

    fetch(`/api/insider?ticker=${ticker}&days=180&limit=10`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => { if (active) setInsider(d.data || []); })
      .catch(() => { if (active) setInsider([]); });

    return () => { active = false; };
  }, [ticker, locale]);

  if (!ticker) return null;

  // schema.org: bu dört veri turunun AYNI hisseye ait, koordineli bir
  // bilgi kumesi oldugunu arama/AI motorlarina belirtir.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.heading(ticker),
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.news, url: `https://bogastock.com/global/${locale}/news` },
      { "@type": "ListItem", position: 2, name: t.earnings, url: `https://bogastock.com/global/${locale}/earning` },
      { "@type": "ListItem", position: 3, name: t.calendar, url: `https://bogastock.com/global/${locale}/earning-calendar` },
      { "@type": "ListItem", position: 4, name: t.insider, url: `https://bogastock.com/global/${locale}/insider` },
    ],
  };

  return (
    <section className="mt-6" aria-labelledby="ticker-coverage-heading">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mb-3">
        <h2 id="ticker-coverage-heading" className="text-lg font-bold text-white">{t.heading(ticker)}</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">{t.sub}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Analizler / X gonderileri */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-[#3b82f6] mb-3">{t.news}</h3>
          {news === null && <p className="text-xs text-slate-500">…</p>}
          {news !== null && news.length === 0 && <p className="text-xs text-slate-500">{t.newsEmpty}</p>}
          {news && news.length > 0 && (
            <div className="space-y-3">
              {news.map((p) => (
                <div key={p.id} className="pb-3 border-b border-[#1e2a3a]/60 last:border-b-0 last:pb-0">
                  <p className="text-[11px] text-slate-500 mb-1">{fmtDate(p.posted_at, locale)}</p>
                  <p className="text-[13px] text-slate-300 leading-relaxed">{p.content_text}</p>
                </div>
              ))}
            </div>
          )}
          <Link href={`/global/${locale}/news`} className="inline-block mt-3 text-[11px] font-semibold text-[#38bdf8] hover:text-white transition-colors">
            {t.newsCta}
          </Link>
        </div>

        {/* Bilanço analizi */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-[#3b82f6] mb-3">{t.earnings}</h3>
          {earnings === null && <p className="text-xs text-slate-500">…</p>}
          {earnings !== null && earnings.length === 0 && <p className="text-xs text-slate-500">{t.earningsEmpty}</p>}
          {earnings && earnings.length > 0 && (
            <div className="space-y-3">
              {earnings.map((e) => (
                <div key={e.id} className="pb-3 border-b border-[#1e2a3a]/60 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-white">{e.period} · {fmtDate(e.reportDate, locale)}</span>
                    {e.ai?.ai_score != null && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30">
                        {t.score}: {formatNumber(e.ai.ai_score, 1)}
                      </span>
                    )}
                  </div>
                  {e.ai?.summary && <p className="text-[13px] text-slate-300 leading-relaxed">{e.ai.summary}</p>}
                </div>
              ))}
            </div>
          )}
          <Link href={`/global/${locale}/earning`} className="inline-block mt-3 text-[11px] font-semibold text-[#38bdf8] hover:text-white transition-colors">
            {t.earningsCta}
          </Link>
        </div>

        {/* Bilanço takvimi */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-[#3b82f6] mb-3">{t.calendar}</h3>
          {calendar === null && <p className="text-xs text-slate-500">…</p>}
          {calendar !== null && calendar.length === 0 && <p className="text-xs text-slate-500">{t.calendarEmpty}</p>}
          {calendar && calendar.length > 0 && (
            <div className="space-y-2">
              {calendar.map((c) => (
                <div key={c.earningsDate} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-slate-500">{t.calendarNext}</p>
                    <p className="text-[13px] font-semibold text-white">{fmtDate(c.earningsDate, locale)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">{t.epsEst}</p>
                    <p className="text-[12px] font-mono text-slate-300">{c.epsEstimate != null ? `$${formatNumber(c.epsEstimate, 2)}` : "—"}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{fmtMoney(c.revenueEstimate)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href={`/global/${locale}/earning-calendar`} className="inline-block mt-3 text-[11px] font-semibold text-[#38bdf8] hover:text-white transition-colors">
            {t.calendarCta}
          </Link>
        </div>

        {/* Icerden islemler */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-[#3b82f6] mb-3">{t.insider}</h3>
          {insider === null && <p className="text-xs text-slate-500">…</p>}
          {insider !== null && insider.length === 0 && <p className="text-xs text-slate-500">{t.insiderEmpty}</p>}
          {insider && insider.length > 0 && (
            <div className="space-y-2">
              {insider.map((tx, idx) => {
                const typeLabel = insiderT?.transactionType?.[tx.transactionType] || tx.transactionType;
                const positive = tx.transactionType === "BUY";
                return (
                  <div key={`${tx.executiveName}-${tx.transactionDate}-${idx}`} className="flex items-center justify-between gap-3 pb-2 border-b border-[#1e2a3a]/60 last:border-b-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">{tx.executiveName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{tx.title || "—"} · {fmtDate(tx.transactionDate, locale)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${positive ? "bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30" : "bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/30"}`}>
                        {typeLabel}
                      </span>
                      <p className="text-[11px] font-mono text-slate-300 mt-0.5">{formatNumber(tx.sharesTransacted, 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href={`/global/${locale}/insider`} className="inline-block mt-3 text-[11px] font-semibold text-[#38bdf8] hover:text-white transition-colors">
            {t.insiderCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
