"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import SwingStrategyStatusCard from "@/components/public/SwingStrategyStatusCard";
import TickerSearchBox from "@/components/public/TickerSearchBox";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import { isPublicTeaserTicker } from "@/lib/publicTeaserTickers";
import { getAssetCategory } from "@/lib/symbols";
import { getIndexBySymbol } from "@/lib/indices";
import { formatNumber } from "@/lib/formatNumber";
import { ALL_ASSET_CLASS_TICKERS } from "@/lib/assetClasses";
import HourlyForecastBadge from "@/components/global/HourlyForecastBadge";
import TickerCoverageSection from "@/components/public/TickerCoverageSection";
import TickerTechnicalRefsPanel from "@/components/public/TickerTechnicalRefsPanel";
import TickerHeroCard from "@/components/public/TickerHeroCard";

// Tum /global/{locale}/graphic/[ticker] sayfalarinin ORTAK govdesi —
// dil sayfalari sadece locale prop'u gecen ince sarmalayicilardir, boylece
// grafik sistemi hicbir dilde digerlerinden farkli davranamaz.

const PAGE_LABELS: Record<Locale, { dashboard: string; loading: string }> = {
  en: { dashboard: "Dashboard", loading: "Loading..." },
  tr: { dashboard: "Gösterge Paneli", loading: "Yükleniyor..." },
  es: { dashboard: "Panel", loading: "Cargando..." },
  fr: { dashboard: "Tableau de bord", loading: "Chargement..." },
  pt: { dashboard: "Painel", loading: "Carregando..." },
  id: { dashboard: "Dasbor", loading: "Memuat..." },
};

// 2026-09-06 kullanici talebiyle: grafik sayfasindaki tum bilgiyi (grafik dahil)
// tek bir PDF olarak PC'ye indirmek icin buton — sadece bu sayfaya ozel, paylasilan
// BogaChartEngine bileseni degistirilmedi.
const PDF_LABELS: Record<Locale, { download: string; generating: string }> = {
  en: { download: "Download PDF", generating: "Generating..." },
  tr: { download: "PDF İndir", generating: "Oluşturuluyor..." },
  es: { download: "Descargar PDF", generating: "Generando..." },
  fr: { download: "Télécharger PDF", generating: "Génération..." },
  pt: { download: "Baixar PDF", generating: "Gerando..." },
  id: { download: "Unduh PDF", generating: "Membuat..." },
};

// Grafik sayfasindan evergreen /global/{locale}/{indexSlug} endeks analiz
// sayfasina kucuk, tek cumlelik bir banner+buton — 2026-08-08 kullanici
// talebiyle (bkz. AGENTS.md scope-discipline: sadece bu banner eklenir,
// mevcut grafik sayfasi yeniden yapilandirilmaz).
const INDEX_BANNER_LABELS: Record<Locale, { text: (name: string) => string; cta: string }> = {
  en: {
    text: (name) => `Want the full daily & weekly quant analysis for ${name}?`,
    cta: "Current Analysis →",
  },
  tr: {
    text: (name) => `${name} için günlük ve haftalık kantitatif analize göz atmak ister misiniz?`,
    cta: "Güncel Analiz →",
  },
  es: {
    text: (name) => `¿Quieres el análisis cuantitativo diario y semanal completo de ${name}?`,
    cta: "Análisis Actual →",
  },
  fr: {
    text: (name) => `Vous voulez l'analyse quantitative quotidienne et hebdomadaire complète de ${name} ?`,
    cta: "Analyse Actuelle →",
  },
  pt: {
    text: (name) => `Quer a análise quantitativa diária e semanal completa do ${name}?`,
    cta: "Análise Atual →",
  },
  id: {
    text: (name) => `Ingin analisis kuantitatif harian & mingguan lengkap untuk ${name}?`,
    cta: "Analisis Terkini →",
  },
};

const SHORTCUT_LABELS: Record<Locale, { trend: string; candidates: string; top7: string; top100: string; myWatchlist: string }> = {
  en: { trend: "TREND", candidates: "WATCHLIST", top7: "TOP 7", top100: "TOP 100", myWatchlist: "MY WATCHLIST" },
  tr: { trend: "TREND", candidates: "TREND ADAYLARI", top7: "TOP 7", top100: "TOP 100", myWatchlist: "İZLEME LİSTEM" },
  es: { trend: "TENDENCIA", candidates: "CANDIDATAS", top7: "TOP 7", top100: "TOP 100", myWatchlist: "MI LISTA" },
  fr: { trend: "TENDANCE", candidates: "CANDIDATES", top7: "TOP 7", top100: "TOP 100", myWatchlist: "MA LISTE" },
  pt: { trend: "TENDÊNCIA", candidates: "CANDIDATAS", top7: "TOP 7", top100: "TOP 100", myWatchlist: "MINHA LISTA" },
  id: { trend: "TREN", candidates: "KANDIDAT WATCHLIST", top7: "TOP 7", top100: "TOP 100", myWatchlist: "WATCHLIST SAYA" },
};

const SECTOR_TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {},
  tr: {
    "us equity markets": "ABD HİSSE SENEDİ PİYASALARI",
    "technology": "TEKNOLOJİ",
    "energy": "ENERJİ",
    "financials": "FİNANS",
    "financial services": "FİNANSAL HİZMETLER",
    "healthcare": "SAĞLIK",
    "consumer discretionary": "TÜKETİCİ ÜRÜNLERİ",
    "consumer cyclical": "DÖNGÜSEL TÜKETİM",
    "consumer staples": "TEMEL TÜKETİM",
    "consumer defensive": "DEFANSİF TÜKETİM",
    "industrials": "ENDÜSTRİ",
    "materials": "MATERYALLER",
    "basic materials": "TEMEL MATERYALLER",
    "real estate": "GAYRİMENKUL",
    "utilities": "ALTYAPI",
    "communication services": "İLETİŞİM HİZMETLERİ",
    "etf": "ETF",
    "equity": "HİSSE SENEDİ"
  },
  es: {
    "us equity markets": "MERCADOS DE RENTA VARIABLE DE EE. UU.",
    "technology": "TECNOLOGÍA",
    "energy": "ENERGÍA",
    "financials": "FINANZAS",
    "financial services": "SERVICIOS FINANCIEROS",
    "healthcare": "CUIDADO DE LA SALUD",
    "consumer discretionary": "CONSUMO DISCRECIONAL",
    "consumer cyclical": "CONSUMO CÍCLICO",
    "consumer staples": "PRODUCTOS BÁSICOS",
    "consumer defensive": "CONSUMO DEFENSIVO",
    "industrials": "INDUSTRIALES",
    "materials": "MATERIALES",
    "basic materials": "MATERIALES BÁSICOS",
    "real estate": "BIENES RAÍCES",
    "utilities": "SERVICIOS PÚBLICOS",
    "communication services": "SERVICIOS DE COMUNICACIÓN"
  },
  fr: {
    "us equity markets": "MARCHÉS ACTIONS US",
    "technology": "TECHNOLOGIE",
    "energy": "ÉNERGIE",
    "financials": "FINANCE",
    "financial services": "SERVICES FINANCIERS",
    "healthcare": "SANTÉ",
    "consumer discretionary": "CONSOMMATION DISCRÉTIONNAIRE",
    "consumer cyclical": "CONSOMMATION CYCLIQUE",
    "consumer staples": "BIENS DE CONSOMMATION COURANTE",
    "consumer defensive": "CONSOMMATION DÉFENSIVE",
    "industrials": "INDUSTRIE",
    "materials": "MATÉRIAUX",
    "basic materials": "MATÉRIAUX DE BASE",
    "real estate": "IMMOBILIER",
    "utilities": "SERVICES PUBLICS",
    "communication services": "SERVICES DE COMMUNICATION"
  },
  pt: {
    "us equity markets": "MERCADOS DE AÇÕES DOS EUA",
    "technology": "TECNOLOGIA",
    "energy": "ENERGIA",
    "financials": "FINANÇAS",
    "financial services": "SERVIÇOS FINANCEIROS",
    "healthcare": "SAÚDE",
    "consumer discretionary": "CONSUMO DISCRICIONÁRIO",
    "consumer cyclical": "CONSUMO CÍCLICO",
    "consumer staples": "BENS DE CONSUMO BÁSICO",
    "consumer defensive": "CONSUMO DEFENSIVO",
    "industrials": "INDUSTRIAIS",
    "materials": "MATERIAIS",
    "basic materials": "MATERIAIS BÁSICOS",
    "real estate": "MERCADO IMOBILIÁRIO",
    "utilities": "SERVIÇOS PÚBLICOS",
    "communication services": "SERVIÇOS DE COMUNICAÇÃO"
  },
  id: {
    "us equity markets": "PASAR SAHAM AS",
    "technology": "TEKNOLOGI",
    "energy": "ENERGI",
    "financials": "KEUANGAN",
    "financial services": "LAYANAN KEUANGAN",
    "healthcare": "KESEHATAN",
    "consumer discretionary": "KONSUMEN SIKLIKAL",
    "consumer cyclical": "KONSUMEN SIKLIKAL",
    "consumer staples": "KONSUMEN PRIMER",
    "consumer defensive": "KONSUMEN DEFENSIF",
    "industrials": "INDUSTRI",
    "materials": "BAHAN BAKU",
    "basic materials": "BAHAN BAKU DASAR",
    "real estate": "PROPERTI",
    "utilities": "UTILITAS",
    "communication services": "LAYANAN KOMUNIKASI",
    "etf": "ETF",
    "equity": "SAHAM"
  }
};

function translateSector(sector: string, locale: Locale): string {
  if (!sector) return "";
  const lower = sector.toLowerCase();
  return SECTOR_TRANSLATIONS[locale]?.[lower] || sector;
}

// Index tickers shown in the header strip: S&P 500, Nasdaq, Dow, Russell 2000, VIX.
const INDICES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "^RUT", label: "Russell 2000" },
  { symbol: "^VIX", label: "VIX" },
];

const SECTOR_ETF_MAP: Record<string, string> = {
  technology: "XLK", energy: "XLE", financials: "XLF", "financial services": "XLF",
  healthcare: "XLV", "consumer discretionary": "XLY", "consumer cyclical": "XLY",
  "consumer staples": "XLP", "consumer defensive": "XLP", industrials: "XLI",
  materials: "XLB", "basic materials": "XLB", "real estate": "XLRE",
  utilities: "XLU", "communication services": "XLC",
};

type Quote = { price: number | null; change_1d: number | null };

function fmtChange(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${formatNumber(v, 2)}%`;
}

/** useParams'tan gelen ham segmenti guvenle decode eder (bozuk kacis dizisi -> ham deger). */
function decodeSegment(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return "";
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export default function GraphicDetailContent({ locale }: { locale: Locale }) {
  const params = useParams();
  // useParams URL segmentini decode ETMEZ: "MES=F" -> "MES%3DF", "^GSPC" -> "%5EGSPC"
  // gelir. Decode edilmezse vadeli/endeks sembolleri grafik API'sine bozuk gider.
  const ticker = decodeSegment(params?.ticker).toUpperCase();
  const labels = PAGE_LABELS[locale];
  const registerHref = locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;

  // Not: "company/sector/industry" disinda kalan alanlar da (TickerTechnicalRefsPanel
  // /api/deep-analysis'e AYNI stockData'yi POST ediyor) kullanildigi icin tip "any" birakildi.
  const [stockData, setStockData] = useState<any>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  // Herkese acik onizleme: giris yapmamis ziyaretcilerin ust kisayol
  // butonlariyla uye-kilitli sayfalara (Top100/Swing/Trend/Analiz)
  // gecmesini engellemek icin oturum durumunu bir kez kontrol ediyoruz.
  const { isPremium, plan, loading } = useMemberPlan();
  const isLoggedIn = plan !== null;
  const TOP7_TICKERS = ["AAPL", "GOOG", "MSFT", "AMZN", "NVDA", "META", "TSLA"];
  const isTop7 = TOP7_TICKERS.includes(ticker);
  // US Endeks (SPX/NDX/DJI/RUT/VIX — getAssetCategory'de ayrı bir kategorisi
  // yok, "stock"a düşerler) + Döviz/Emtia/Kripto: piyasa bağlamı verisi,
  // BOGA'nın asıl hisse-seçim ürünü değil — 2026-08-03 kullanıcı talebiyle
  // herkese (giriş şart olmadan) açık. Trade plan kartı (lockTradePlanCard,
  // aşağıda) bundan etkilenmedi, hâlâ premium.
  const INDEX_TICKERS = ["SPX", "NDX", "DJI", "RUT", "VIX", "N225", "SSE", "HSI", "SENSEX", "NIFTY50", "IHSG", "SPLATA40", "SPLATA_BMI", "IBOVESPA", "IGCX", "IBXX", "STOXX50"];
  // ALL_ASSET_CLASS_TICKERS (lib/assetClasses.ts): YM_F/ES_F/NQ_F gibi endeks
  // vadelileri getAssetCategory()'de "stock"a dusuyor (ozel bir "futures"
  // kategorisi yok) — Forex/Emtia/Kripto/Vadeli sayfalarindaki tum
  // enstrumanlarin herkese acik kalmasini burada ayrica garanti ediyoruz.
  const isMarketContextAsset =
    INDEX_TICKERS.includes(ticker) ||
    !!getIndexBySymbol(ticker) ||
    getAssetCategory(ticker) !== "stock" ||
    ALL_ASSET_CLASS_TICKERS.includes(ticker);
  const chartUnlocked = isTop7 || isPublicTeaserTicker(ticker) || isLoggedIn || isMarketContextAsset;

  // null = henuz bilinmiyor (SSR/ilk render) — BogaChartEngine, defaultIndicators
  // prop'unu SADECE mount aninda ilk state'i tohumlamak icin kullaniyor, bu
  // yuzden grafik mobil/masaustu bilgisi netlesmeden onceden yanlis (masaustu)
  // varsayilanlarla mount olursa sonradan prop degisse bile duzelmez —
  // bu deger belli olana kadar grafigi hic render etmiyoruz.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Grafik dahil sayfanin tamamini tek PDF'e donusturmek icin sarmalayici ref.
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const pdfLabels = PDF_LABELS[locale] || PDF_LABELS.en;

  const handleDownloadPdf = async () => {
    if (!pdfContentRef.current || pdfGenerating) return;
    setPdfGenerating(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(pdfContentRef.current, {
        backgroundColor: "#0a0e17",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`${ticker || "boga"}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setPdfGenerating(false);
    }
  };

  useEffect(() => {
    if (!ticker) return;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: ticker, history: [], lang: locale }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.stockData) setStockData(d.stockData);
      })
      .catch(() => {});
  }, [ticker, locale]);

  // Index quotes — fetched once, independent of the stock's sector.
  useEffect(() => {
    fetch(`/api/quote?tickers=${INDICES.map((i) => i.symbol).join(",")}`)
      .then((r) => r.json())
      .then((d) => setQuotes((prev) => ({ ...prev, ...d })))
      .catch(() => {});
  }, []);

  // Sector ETF quote — fetched once the stock's sector is known.
  const sectorEtf = stockData?.sector ? SECTOR_ETF_MAP[stockData.sector.toLowerCase()] : undefined;
  useEffect(() => {
    if (!sectorEtf) return;
    fetch(`/api/quote?tickers=${sectorEtf}`)
      .then((r) => r.json())
      .then((d) => setQuotes((prev) => ({ ...prev, ...d })))
      .catch(() => {});
  }, [sectorEtf]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />
      <main ref={pdfContentRef} className="flex-1 max-w-6xl mx-auto w-full px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
          <nav className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest">
            <Link href={`/global/${locale}/home`} className="hover:text-[#3b82f6] transition-colors">{labels.dashboard}</Link>
            <span className="opacity-30">/</span>
            <span className="text-white italic">{ticker}</span>
            {stockData?.company && (
              <span className="text-slate-400 normal-case italic font-medium">{stockData.company}</span>
            )}
            {stockData?.sector && (
              <>
                <span className="opacity-30">/</span>
                <span className="text-[#3b82f6]">{translateSector(stockData.sector, locale)}</span>
              </>
            )}
            {stockData?.industry && stockData.industry !== stockData.sector && (
              <>
                <span className="opacity-30">/</span>
                <span className="text-slate-400">{translateSector(stockData.industry, locale)}</span>
              </>
            )}
          </nav>

          <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
            {(() => {
              const sl = SHORTCUT_LABELS[locale] || SHORTCUT_LABELS.en;
              const shortcutsItems = [
                { label: sl.trend, href: `/global/${locale}/swing` },
                { label: sl.top7, href: `/global/${locale}/top7` },
                { label: sl.top100, href: `/global/${locale}/top100` },
                { label: sl.myWatchlist, href: `/global/${locale}/my-watchlist` },
              ];
              return shortcutsItems.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-[#141924] border border-[#1e2a3a] text-[10px] font-semibold !text-[#38bdf8] hover:border-[#38bdf8]/50 transition-all uppercase"
                >
                  {s.label}
                </Link>
              ));
            })()}
          </div>
        </div>

        <TickerSearchBox locale={locale} />

        <div className="flex justify-end mt-2 mb-1">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141924] border border-[#1e2a3a] text-[10px] font-semibold !text-[#38bdf8] hover:border-[#38bdf8]/50 transition-all uppercase disabled:opacity-50"
          >
            {pdfGenerating ? pdfLabels.generating : pdfLabels.download}
          </button>
        </div>

        {/* 2026-08-24 kullanici talebiyle: search kutusunun hemen altina,
            grafigin hemen ustune — ticker/skor/sirket/fiyat + hissenin en
            cok tepki verdigi ortalamayi (EMA20/50/200) gosteren, HERKESE
            acik (premium-gated DEGIL) bir "hero" karti. */}
        {ticker && <TickerHeroCard ticker={ticker} locale={locale} sector={stockData?.sector} />}

        {/* Endeks şeridi — masaüstünde sabit satır, mobilde yer kaplamasın
            diye tek satır halinde yavaşça kayan (marquee) şerit. */}
        <div className="hidden md:flex flex-wrap items-center gap-1.5 mb-4">
          {INDICES.map((idx) => {
            const q = quotes[idx.symbol];
            const positive = (q?.change_1d ?? 0) >= 0;
            return (
              <div
                key={idx.symbol}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#1e2a3a] text-[10px] font-medium"
              >
                <span className="text-slate-400">{idx.label}</span>
                <span className="text-white font-mono">{q?.price != null ? formatNumber(q.price, 2) : "—"}</span>
                <span className={positive ? "!text-[#3fb950]" : "!text-[#f85149]"}>{fmtChange(q?.change_1d)}</span>
              </div>
            );
          })}
          {sectorEtf && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#3b82f6]/30 text-[10px] font-medium">
              <span className="text-[#3b82f6]">{translateSector(stockData?.sector || "", locale)} ({sectorEtf})</span>
              <span className="text-white font-mono">
                {quotes[sectorEtf]?.price != null ? formatNumber(quotes[sectorEtf].price!, 2) : "—"}
              </span>
              <span className={(quotes[sectorEtf]?.change_1d ?? 0) >= 0 ? "!text-[#3fb950]" : "!text-[#f85149]"}>
                {fmtChange(quotes[sectorEtf]?.change_1d)}
              </span>
            </div>
          )}
        </div>


        {/* v3.2: Hisse arama geçici olarak kaldırıldı — şimdilik sadece
            BOGA AI Swing Trade havuzuna odaklanıyoruz. */}

        {(() => {
          const indexDef = getIndexBySymbol(ticker);
          if (!indexDef) return null;
          const banner = INDEX_BANNER_LABELS[locale] || INDEX_BANNER_LABELS.en;
          return (
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4 px-4 py-3 rounded-lg bg-[#0d131f]/80 border border-[#1e2a3a]">
              <p className="text-sm text-slate-300">{banner.text(indexDef.names[locale])}</p>
              <Link
                href={`/global/${locale}/${indexDef.slug}`}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-[#141924] border border-[#3b82f6]/40 text-xs font-semibold text-[#00d2ff] hover:text-white hover:border-[#3b82f6] transition-all"
              >
                {banner.cta}
              </Link>
            </div>
          );
        })()}

        <div className="glass-card overflow-hidden mb-4" style={{ minHeight: isMobile === null ? 420 : undefined }}>
          {isMobile !== null && (
            <BogaChartEngine
              symbol={ticker}
              lang={locale}
              detailMode
              height={isMobile ? 420 : 600}
              defaultTimeframe="D"
              premiumGate={!chartUnlocked && !loading}
            />
          )}
        </div>
        {isMarketContextAsset && (
          <div className="mb-4">
            <HourlyForecastBadge ticker={ticker} locale={locale} />
          </div>
        )}
        {ticker && <SwingStrategyStatusCard ticker={ticker} locale={locale} />}
        <div className="glass-card overflow-hidden">
          <TickerDetailPanel ticker={ticker} locale={locale} hideChart hidePermalink lockTradePlanCard />
        </div>

        {/* 2026-08-24 kullanici talebiyle: Derin Analiz raporunun (artik admin-only)
            Kritik Seviyeler / Katalizör Takvimi / 13F / Teknik Referanslar bolumlerini
            AYNI veri kaynagindan (/api/deep-analysis) zenginlestirme olarak ekler —
            mevcut Trade Plan kartina (yukarida) dokunmuyor, ek/tamamlayici bir panel. */}
        {ticker && <TickerTechnicalRefsPanel ticker={ticker} locale={locale} />}

        {/* 2026-08-23 kullanici talebiyle: forecast/TickerDetailPanel'den SONRA,
            sayfanin EN ALTINDA — bu hisseyle ilgili tum analizleri, bilanco
            analizini, bilanco takvimini ve icerden islemleri tek yerde
            derinlestiren "koordineli takip" bolumu. */}
        {ticker && <TickerCoverageSection ticker={ticker} locale={locale} />}
      </main>
      <Footer hidePlatform locale={locale} />
    </div>
  );
}
