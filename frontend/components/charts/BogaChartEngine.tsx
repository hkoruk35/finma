"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type Time,
} from "lightweight-charts";
import { heikinAshi } from "@/lib/indicators";
import { computeVolumeProfile } from "@/lib/volumeProfilePrimitive";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import PremiumModal from "@/components/global/PremiumModal";
import FreeRegisterModal from "@/components/global/FreeRegisterModal";
import { getMarketAssetLabel } from "@/lib/x/marketAssetLabels";
import { getIndexBySymbol } from "@/lib/indices";
import { formatNumber } from "@/lib/formatNumber";

type Locale = "en" | "tr" | "es" | "fr" | "pt" | "id";

// Grafik barları borsa oturumuna (NY / ET) göre üretiliyor — eksen üzerindeki
// saat/tarih etiketleri her ziyaretçinin kendi tarayıcı saat dilimine göre
// değil, HER ZAMAN New York saatine göre gösterilmeli (aksi halde örn. TR
// kullanıcısı için barlar +7 saat kaymış görünür).
const NY_TIME_ZONE = "America/New_York";

function toNYDate(time: Time): Date {
  return new Date((time as number) * 1000);
}

function nyTickMarkFormatter(time: Time, tickMarkType: TickMarkType): string {
  const date = toNYDate(time);
  const opts: Intl.DateTimeFormatOptions = { timeZone: NY_TIME_ZONE };
  switch (tickMarkType) {
    case TickMarkType.Year:
      opts.year = "numeric";
      break;
    case TickMarkType.Month:
      opts.month = "short";
      break;
    case TickMarkType.DayOfMonth:
      opts.day = "2-digit";
      opts.month = "short";
      break;
    case TickMarkType.TimeWithSeconds:
      opts.hour = "2-digit";
      opts.minute = "2-digit";
      opts.second = "2-digit";
      opts.hour12 = false;
      break;
    case TickMarkType.Time:
    default:
      opts.hour = "2-digit";
      opts.minute = "2-digit";
      opts.hour12 = false;
  }
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

function nyTimeFormatter(time: Time): string {
  const date = toNYDate(time);
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIME_ZONE, year: "numeric", month: "short", day: "2-digit",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
  return `${datePart} ${timePart} ET`;
}

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    liveChart: "Live Chart", expand: "EXPAND", collapse: "COLLAPSE",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bollinger Bands", vwap: "VWAP", sr: "Support/Resistance",
    volumeProfile: "Volume Profile",
    entry: "Entry", stop: "Stop", tp1: "TP1", tp2: "TP2", tp3: "TP3",
    candle: "Candle", "heikin-ashi": "Heikin Ashi", line: "Line", ohlc: "OHLC",
    share: "Share", copyLink: "Copy link", linkCopied: "Link copied!",
    vol: "Vol", indicators: "Indicators", premiumRequired: "Premium membership required", freeAccountRequired: "Sign in with Google or register free to unlock",
    indicatorUnlockTitle: "Unlock More Indicators", indicatorUnlockDesc: "Anonymous visitors can use the default indicators (EMA 50, RSI, Volume). Sign in with Google or create a free account to unlock every other indicator!",
    multiChartScreen: "Multi-Chart Screen", charts: "Charts",
    catTrend: "Trend", catMomentum: "Momentum", catVolume: "Volume", catStructure: "Market Structure", catPatterns: "Patterns", catDrawings: "Drawing Tools",
    autoChartPatterns: "Auto Chart Patterns", basicCandlePatterns: "Basic Candlestick Patterns",
    sma: "SMA", supertrend: "Supertrend", volatilite: "Volatility", atr: "ATR", volume: "Volume", obv: "OBV",
    fvg: "Fair Value Gap", sd: "Supply & Demand", candlePat: "Candlestick Patterns", chartPat: "Auto Chart Patterns",
    fibonacci: "Auto Fibonacci", trendLine: "Auto Trend Line", horizontalLine: "Auto Horizontal Line",
  },
  tr: {
    liveChart: "Canlı Grafik", expand: "GENİŞLET", collapse: "DARALT",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bollinger Bantları", vwap: "VWAP", sr: "Destek/Direnç",
    volumeProfile: "Hacim Profili",
    entry: "Giriş", stop: "Stop", tp1: "TP1", tp2: "TP2", tp3: "TP3",
    candle: "Mum", "heikin-ashi": "Heikin Ashi", line: "Çizgi", ohlc: "OHLC",
    share: "Paylaş", copyLink: "Linki kopyala", linkCopied: "Link kopyalandı!",
    vol: "Hac", indicators: "Göstergeler", premiumRequired: "Premium üyelik gerekir", freeAccountRequired: "Google ile giriş yapın veya ücretsiz kaydolun",
    indicatorUnlockTitle: "Daha Fazla Gösterge Aç", indicatorUnlockDesc: "Anonim ziyaretçiler varsayılan göstergeleri (EMA 50, RSI, Hacim) kullanabilir. Diğer tüm göstergeleri açmak için hemen ücretsiz Google girişi yapın veya kaydolun!",
    multiChartScreen: "Çoklu Grafik Ekranı", charts: "Grafik",
    catTrend: "Trend", catMomentum: "Momentum", catVolume: "Hacim", catStructure: "Piyasa Yapısı", catPatterns: "Formasyonlar", catDrawings: "Çizim Araçları",
    autoChartPatterns: "Otomatik Chart Patterns", basicCandlePatterns: "Temel Candlestick Patterns",
    sma: "SMA", supertrend: "Supertrend", volatilite: "Volatilite", atr: "ATR", volume: "Hacim", obv: "OBV",
    fvg: "FVG (Fair Value Gap)", sd: "Arz-Talep Bölgeleri", candlePat: "Mum Formasyonları", chartPat: "Otomatik Formasyonlar",
    fibonacci: "Oto Fibonacci", trendLine: "Oto Trend Çizgisi", horizontalLine: "Oto Yatay Çizgi",
  },
  es: {
    liveChart: "Gráfico en Vivo", expand: "EXPANDIR", collapse: "CONTRAER",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bandas de Bollinger", vwap: "VWAP", sr: "Soporte/Resistencia",
    volumeProfile: "Perfil de Volumen",
    entry: "Entrada", stop: "Stop", tp1: "TP1", tp2: "TP2", tp3: "TP3",
    candle: "Velas", "heikin-ashi": "Heikin Ashi", line: "Línea", ohlc: "OHLC",
    share: "Compartir", copyLink: "Copiar enlace", linkCopied: "¡Enlace copiado!",
    vol: "Vol", indicators: "Indicadores", premiumRequired: "Se requiere membresía Premium", freeAccountRequired: "Inicia sesión con Google o regístrate gratis para desbloquear",
    indicatorUnlockTitle: "Desbloquea Más Indicadores", indicatorUnlockDesc: "Los visitantes anónimos pueden usar los indicadores predeterminados (EMA 50, RSI, Volumen). Inicia sesión con Google o crea una cuenta gratuita para desbloquear todos los demás indicadores.",
    multiChartScreen: "Pantalla Multigráfico", charts: "Gráficos",
    catTrend: "Tendencia", catMomentum: "Momento", catVolume: "Volumen", catStructure: "Estructura del Mercado", catPatterns: "Patrones", catDrawings: "Herramientas de Dibujo",
    autoChartPatterns: "Patrones de Gráficos Automáticos", basicCandlePatterns: "Patrones Básicos de Velas",
    sma: "SMA", supertrend: "Supertrend", volatilite: "Volatilidad", atr: "ATR", volume: "Volumen", obv: "OBV",
    fvg: "Fair Value Gap", sd: "Oferta y Demanda", candlePat: "Patrones de Velas", chartPat: "Patrones Automáticos",
    fibonacci: "Fibonacci Automático", trendLine: "Línea de Tendencia Auto", horizontalLine: "Línea Horizontal Auto",
  },
  fr: {
    liveChart: "Graphique en Direct", expand: "AGRANDIR", collapse: "RÉDUIRE",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bandes de Bollinger", vwap: "VWAP", sr: "Support/Résistance",
    volumeProfile: "Profil de Volume",
    entry: "Entrée", stop: "Stop", tp1: "TP1", tp2: "TP2", tp3: "TP3",
    candle: "Bougie", "heikin-ashi": "Heikin Ashi", line: "Ligne", ohlc: "OHLC",
    share: "Partager", copyLink: "Copier le lien", linkCopied: "Lien copié !",
    vol: "Vol", indicators: "Indicateurs", premiumRequired: "Adhésion Premium requise", freeAccountRequired: "Connectez-vous avec Google ou inscrivez-vous gratuitement pour débloquer",
    indicatorUnlockTitle: "Débloquer Plus d'Indicateurs", indicatorUnlockDesc: "Les visiteurs anonymes peuvent utiliser les indicateurs par défaut (EMA 50, RSI, Volume). Connectez-vous avec Google ou créez un compte gratuit pour débloquer tous les autres indicateurs !",
    multiChartScreen: "Écran Multi-Graphiques", charts: "Graphiques",
    catTrend: "Tendance", catMomentum: "Momentum", catVolume: "Volume", catStructure: "Structure du Marché", catPatterns: "Modèles", catDrawings: "Outils de Dessin",
    autoChartPatterns: "Modèles de Graphiques Automatiques", basicCandlePatterns: "Modèles de Bougies de Base",
    sma: "SMA", supertrend: "Supertrend", volatilite: "Volatilité", atr: "ATR", volume: "Volume", obv: "OBV",
    fvg: "Fair Value Gap", sd: "Offre et Demande", candlePat: "Modèles de Bougies", chartPat: "Modèles Automatiques",
    fibonacci: "Fibonacci Automatique", trendLine: "Ligne de Tendance Auto", horizontalLine: "Ligne Horizontale Auto",
  },
  pt: {
    liveChart: "Gráfico ao Vivo", expand: "EXPANDIR", collapse: "RECOLHER",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bandas de Bollinger", vwap: "VWAP", sr: "Suporte/Resistência",
    volumeProfile: "Perfil de Volume",
    entry: "Entrada", stop: "Stop", tp1: "TP1", tp2: "TP2", tp3: "TP3",
    candle: "Candle", "heikin-ashi": "Heikin Ashi", line: "Linha", ohlc: "OHLC",
    share: "Compartilhar", copyLink: "Copiar link", linkCopied: "Link copiado!",
    vol: "Vol", indicators: "Indicadores", premiumRequired: "Assinatura Premium necessária", freeAccountRequired: "Entre com o Google ou registre-se grátis para desbloquear",
    indicatorUnlockTitle: "Desbloqueie Mais Indicadores", indicatorUnlockDesc: "Visitantes anônimos podem usar os indicadores padrão (EMA 50, RSI, Volume). Entre com o Google ou crie uma conta gratuita para desbloquear todos os outros indicadores!",
    multiChartScreen: "Tela Multigráficos", charts: "Gráficos",
    catTrend: "Tendência", catMomentum: "Momento", catVolume: "Volume", catStructure: "Estrutura de Mercado", catPatterns: "Padrões", catDrawings: "Ferramentas de Desenho",
    autoChartPatterns: "Padrões Gráficos Automáticos", basicCandlePatterns: "Padrões Básicos de Velas",
    sma: "SMA", supertrend: "Supertrend", volatilite: "Volatilidade", atr: "ATR", volume: "Volume", obv: "OBV",
    fvg: "Fair Value Gap", sd: "Oferta e Demanda", candlePat: "Padrões de Velas", chartPat: "Padrões Automáticos",
    fibonacci: "Fibonacci Automático", trendLine: "Linha de Tendência Auto", horizontalLine: "Linha Horizontal Auto",
  },
  id: {
    liveChart: "Grafik Langsung", expand: "PERLUAS", collapse: "CIUTKAN",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bollinger Bands", vwap: "VWAP", sr: "Support/Resistance",
    volumeProfile: "Profil Volume",
    entry: "Entry", stop: "Stop", tp1: "TP1", tp2: "TP2", tp3: "TP3",
    candle: "Candle", "heikin-ashi": "Heikin Ashi", line: "Garis", ohlc: "OHLC",
    share: "Bagikan", copyLink: "Salin tautan", linkCopied: "Tautan disalin!",
    vol: "Vol", indicators: "Indikator", premiumRequired: "Keanggotaan Premium diperlukan", freeAccountRequired: "Masuk dengan Google atau daftar gratis untuk membuka",
    indicatorUnlockTitle: "Buka Lebih Banyak Indikator", indicatorUnlockDesc: "Pengunjung anonim dapat menggunakan indikator default (EMA 50, RSI, Volume). Masuk dengan Google atau buat akun gratis untuk membuka semua indikator lainnya!",
    multiChartScreen: "Layar Multi-Grafik", charts: "Grafik",
    catTrend: "Tren", catMomentum: "Momentum", catVolume: "Volume", catStructure: "Struktur Pasar", catPatterns: "Pola", catDrawings: "Alat Gambar",
    autoChartPatterns: "Pola Grafik Otomatis", basicCandlePatterns: "Pola Candlestick Dasar",
    sma: "SMA", supertrend: "Supertrend", volatilite: "Volatilitas", atr: "ATR", volume: "Volume", obv: "OBV",
    fvg: "Fair Value Gap", sd: "Supply & Demand", candlePat: "Pola Candlestick", chartPat: "Pola Otomatis",
    fibonacci: "Fibonacci Otomatis", trendLine: "Garis Tren Otomatis", horizontalLine: "Garis Horizontal Otomatis",
  },
};

// Ucretsiz kullanicilarin premiumGate acikken hala kullanabildigi tek iki
// gosterge — geri kalan tum gostergeler + Trade Plan (entry/stop/tp1-3)
// tiklaninca PremiumModal acar, aktif edilemez.
const FREE_INDICATOR_KEYS = new Set<string>(["ema50", "rsi", "volume"]);

const INTERVALS: { label: string; value: string }[] = [
  { label: "15M", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

const RANGE_KEYS = ["1D", "1W", "1M", "3M", "1Y", "5Y"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];
const RANGE_WINDOW_SECONDS: Record<RangeKey, number> = {
  "1D": 86400, "1W": 7 * 86400, "1M": 30 * 86400,
  "3M": 90 * 86400, "1Y": 365 * 86400, "5Y": 5 * 365 * 86400,
};

const CANDLE_TYPES = ["candle", "heikin-ashi", "line", "ohlc"] as const;
type CandleType = (typeof CANDLE_TYPES)[number];

// Volume Profile reserves this many bar-widths of empty space on the right
// so its histogram sits in a clear margin instead of overlapping the last
// candles. DEFAULT_RIGHT_OFFSET matches lightweight-charts' own default.
const VP_MARGIN_BARS = 16;
const DEFAULT_RIGHT_OFFSET = 5;

const INDICATOR_KEYS = ["ema9", "ema20", "ema50", "ema200", "sma", "supertrend", "rsi", "volatilite", "bb", "atr", "volume", "vwap", "obv", "macd", "sr", "volumeProfile", "entry", "stop", "tp1", "tp2", "tp3", "fvg", "sd", "fibonacci", "trendLine", "horizontalLine"] as const;
type IndicatorKey = (typeof INDICATOR_KEYS)[number];
// Trade Plan zone/level toggles — detail-page-only (bkz. availableIndicators),
// canlida /api/preorder-analysis'ten cekilen entryZone/stop/targets verisine
// dayanir. "entry" taranmis/filigranli yesil bir aralik olarak (DOM overlay),
// digerleri ("stop"/"tp1-3") sr ile ayni desende tek fiyat cizgisi olarak
// cizilir.
const TRADE_PLAN_KEYS: IndicatorKey[] = ["entry", "stop", "tp1", "tp2", "tp3"];

const UP_COLOR = "#22c55e";
const DOWN_COLOR = "#ef4444";
const NAVY = "#030073";

// Çoklu Grafik Ekranı — tıklanan hisse ilk karo, geri kalanı bu havuzdan
// (tekrarsız) dolduruluyor, boylece "9 Grafik" secince 9 ayni grafik yerine
// karsilastirmali bir izleme listesi gorunuyor.
const MULTI_CHART_POOL = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "SPY", "QQQ"];

function multiChartGridClass(n: number): string {
  if (n <= 2) return "grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1";
  if (n === 3) return "grid-cols-1 md:grid-cols-3 grid-rows-3 md:grid-rows-1";
  if (n === 4) return "grid-cols-2 grid-rows-2";
  if (n === 6) return "grid-cols-2 md:grid-cols-3 grid-rows-3 md:grid-rows-2";
  return "grid-cols-2 md:grid-cols-3 grid-rows-5 md:grid-rows-3"; // 9
}

// Trade Plan toggle butonlarinin ve grafik uzerindeki cizgilerin/overlay'in
// rengi — createPriceLine cagrilarindaki (STOP=DOWN_COLOR kirmizi, TP1-3
// mavi/camgobegi/mor) ve entry-zone overlay'indeki (yesil) renklerle birebir
// eslesir, boylece buton ile grafikteki isaret ayni renkte gorunur.
const TRADE_PLAN_COLORS: Partial<Record<IndicatorKey, string>> = {
  entry: UP_COLOR,
  stop: DOWN_COLOR,
  tp1: "#3b82f6",
  tp2: "#06b6d4",
  tp3: "#8b5cf6",
};

function tradePlanValueLabel(
  key: IndicatorKey,
  plan: { entryZone: { low: number; high: number }; stop: { price: number }; targets: { price: number }[] }
): string | null {
  const fmt2 = (n: number) => formatNumber(n, 2);
  if (key === "entry") return `${fmt2(plan.entryZone.low)}-${fmt2(plan.entryZone.high)}`;
  if (key === "stop") return fmt2(plan.stop.price);
  if (key === "tp1") return plan.targets[0] ? fmt2(plan.targets[0].price) : null;
  if (key === "tp2") return plan.targets[1] ? fmt2(plan.targets[1].price) : null;
  if (key === "tp3") return plan.targets[2] ? fmt2(plan.targets[2].price) : null;
  return null;
}

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartResponse {
  bars: Bar[];
  indicators?: Record<string, unknown>;
  sr?: { price: number; time_range: [number, number]; type: "support" | "resistance" }[];
}

interface Props {
  symbol: string; // Yahoo ticker, e.g. "AAPL", "EURUSD=X", "BTC-USD", "GC=F"
  interval?: string; // TV-style, controlled by caller when showToolbar=false
  height?: number | null; // null = fill parent
  compact?: boolean; // grid-tile mode: minimal chrome, fixed indicator set
  lang?: Locale;
  showToolbar?: boolean; // internal interval + indicator toggle UI (default true)
  onIntervalChange?: (interval: string) => void;
  indicators?: IndicatorKey[]; // when provided, overrides internal toggle state (controlled mode)
  hideIndicatorToggles?: boolean; // hides the block of indicator toggle buttons
  detailMode?: boolean; // unlocks the full toolbar: candle type, range, OHLCV readout, share, fullscreen
  defaultIndicators?: IndicatorKey[]; // initial active set (uncontrolled mode only)
  defaultTimeframe?: string; // initial interval value
  defaultCandleType?: CandleType; // initial candle style (overrides the detailMode-based default)
  premiumGate?: boolean; // non-premium viewers may only toggle FREE_INDICATOR_KEYS; everything else (incl. Trade Plan values) prompts PremiumModal instead
  externalMultiChartTickers?: string[] | null; // caller-driven multi-chart selection (checkboxes)
  externalMultiChartTrigger?: number; // signal incremented when caller explicitly requests opening multi-chart screen
  onExternalMultiChartConsumed?: () => void;
}

export const INDEX_DISPLAY_NAMES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "IXIC": "NASDAQ",
  "^DJI": "Dow Jones",
  "DJI": "Dow Jones",
  "^RUT": "Russell 2000",
  "RUT": "Russell 2000",
  "^VIX": "VIX",
  "VIX": "VIX",
};

export function getSymbolDisplayName(symbol: string): string {
  if (!symbol) return "";
  const upper = symbol.toUpperCase();
  return INDEX_DISPLAY_NAMES[upper] || INDEX_DISPLAY_NAMES[symbol] || symbol;
}

const EMA_COLORS: Record<string, string> = {
  ema9: "#facc15",
  ema20: "#38bdf8",
  ema50: "#a78bfa",
  ema200: "#f472b6",
};

function seriesCategory(candleType: CandleType): "line" | "bar" | "candlestick" {
  if (candleType === "line") return "line";
  if (candleType === "ohlc") return "bar";
  return "candlestick";
}

function createMainSeries(chart: IChartApi, candleType: CandleType) {
  const category = seriesCategory(candleType);
  if (category === "line") {
    return chart.addSeries(AreaSeries, { 
      topColor: "rgba(59, 130, 246, 0.4)",
      bottomColor: "rgba(59, 130, 246, 0.05)",
      lineColor: "#3b82f6",
      lineWidth: 2, 
      priceLineVisible: true 
    });
  }
  if (category === "bar") {
    return chart.addSeries(BarSeries, { upColor: UP_COLOR, downColor: DOWN_COLOR });
  }
  return chart.addSeries(CandlestickSeries, {
    upColor: UP_COLOR,
    downColor: DOWN_COLOR,
    borderVisible: false,
    wickUpColor: UP_COLOR,
    wickDownColor: DOWN_COLOR,
  });
}

function toMainSeriesData(bars: Bar[], candleType: CandleType) {
  const srcBars = candleType === "heikin-ashi" ? heikinAshi(bars) : bars;
  if (seriesCategory(candleType) === "line") {
    return srcBars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close }));
  }
  return srcBars.map((b) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close }));
}

export default function BogaChartEngine({
  symbol,
  interval: intervalProp,
  height = null,
  compact = false,
  lang = "en",
  showToolbar = true,
  onIntervalChange,
  indicators: indicatorsProp,
  hideIndicatorToggles = false,
  detailMode = false,
  defaultIndicators,
  defaultTimeframe,
  defaultCandleType,
  premiumGate = false,
  externalMultiChartTickers,
  externalMultiChartTrigger,
  onExternalMultiChartConsumed,
}: Props) {
  const t = LABELS[lang] || LABELS.en;
  const { isPremium, tier } = useMemberPlan();
  const isLoggedIn = tier !== "anonymous";
  // Trade Plan degerleri (entry/stop/tp1-3) hala Premium gerektirir; diger
  // tum gostergeler artik SADECE ucretsiz hesap (Google/e-posta) gerektirir —
  // 2026-08-11 kullanici talebi: "indikatorlerden premium hesap / ucret
  // talebi yok", varsayilan secili olanlar (FREE_INDICATOR_KEYS) anonim
  // ziyaretciye de acik kalir.
  const tradePlanGated = premiumGate && !isPremium;
  const indicatorGated = premiumGate && !isLoggedIn;
  // Çoklu ekran (2/3/4/6/9): 2026-08-03 kullanıcı talebiyle üye olan
  // HERKESE (free dahil) 9 grafiğe kadar kısıtlamasız ve tamamen ücretsiz.
  const multiChartGated = false;
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showFreeRegisterModal, setShowFreeRegisterModal] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lineSeriesRefs = useRef<Partial<Record<IndicatorKey, ISeriesApi<"Line">[]>>>({});
  const priceLinesRef = useRef<any[]>([]);
  const barsRef = useRef<Bar[]>([]);
  const lastDataRef = useRef<ChartResponse | null>(null);

  const [interval, setInterval_] = useState(intervalProp || defaultTimeframe || "240");
  const [isMobile, setIsMobile] = useState(false);
  const [internalActive, setInternalActive] = useState<Set<IndicatorKey>>(
    () =>
      new Set(
        defaultIndicators ?? (compact
          ? (["ema50", "volume"] as IndicatorKey[])
          : (["ema50", "rsi", "volume"] as IndicatorKey[]))
      )
  );
  // `indicators` prop'u cagiran tarafta genellikle satir ici dizi olarak
  // veriliyor (<BogaChartEngine indicators={["ema50","volume"]} />), yani her
  // render'da yeni bir referans. Bunu dogrudan `new Set(...)` ile sarmak
  // `active`'i her render'da yeni bir nesne yapiyordu. fetchData useCallback'i
  // `active`'e bagli oldugu icin kimligi de her render'da degisiyor,
  // `useEffect(..., [fetchData])` yeniden tetikleniyor, fetch state'i
  // guncelleyince yeni render olusuyor ve dongu bastan basliyordu:
  // /api/chart-data sonsuz dongude cagriliyordu (2026-08-10, /global/tr/home
  // uzerinde tek ziyarette 6000'den fazla istek olculdu).
  // Icerige gore memoize edince referans stabil kaliyor ve dongu kiriliyor.
  const indicatorsKey = indicatorsProp ? indicatorsProp.join(",") : null;
  const active = useMemo(
    () =>
      indicatorsKey !== null
        ? new Set(indicatorsKey.split(",").filter(Boolean) as IndicatorKey[])
        : internalActive,
    [indicatorsKey, internalActive]
  );
  const setActive = setInternalActive;

  const isIndex = symbol.startsWith("^") || !!INDEX_DISPLAY_NAMES[symbol.toUpperCase()] || !!getIndexBySymbol(symbol) || ["SPX", "NDX", "DJI", "RUT", "VIX", "N225", "SSE", "HSI", "SENSEX", "NIFTY50", "SPLATA40", "SPLATA_BMI", "IBOVESPA", "IGCX", "IBXX", "STOXX50"].includes(symbol.toUpperCase());
  const [candleType, setCandleType] = useState<CandleType>(defaultCandleType ?? (isIndex ? "line" : (detailMode ? "heikin-ashi" : "candle")));
  const [range, setRange] = useState<RangeKey>("3M");
  const [hoverBar, setHoverBar] = useState<Bar | null>(null);
  // Mobilde toolbar kalabalığını azaltmak için: mum tipi ve gösterge satırları
  // masaüstünde (md:) her zaman açık kalır, mobilde ise varsayılan kapalı
  // açılır menü/panel arkasına saklanır. crosshairActive: mobilde statik
  // OHLCV kutusu SADECE kullanıcı grafiğe dokunup crosshair'i aktif ettiğinde
  // görünür (masaüstünde davranış değişmedi, her zaman görünür kalır).
  const [mobileCandleMenuOpen, setMobileCandleMenuOpen] = useState(false);
  const [crosshairActive, setCrosshairActive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [multiChartOpen, setMultiChartOpen] = useState(false);
  const [indicatorsMenuOpen, setIndicatorsMenuOpen] = useState(false);
  const [multiChartLayout, setMultiChartLayout] = useState<number | null>(null);
  const [multiChartTickers, setMultiChartTickers] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Oturumlar arası kaydedilmiş göstergeleri ve grafik şablonunu otomatik yükle
  useEffect(() => {
    if (compact || typeof window === "undefined") return;
    try {
      const savedStr = localStorage.getItem("bogastock_chart_settings");
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (saved.interval) setInterval_(saved.interval);
        if (saved.candleType) setCandleType(saved.candleType);
        if (saved.range) setRange(saved.range);
        if (Array.isArray(saved.indicators) && saved.indicators.length > 0) {
          setInternalActive(new Set(saved.indicators as IndicatorKey[]));
        }
      }
    } catch {}
  }, [compact]);

  // 1H zaman diliminde her zaman Candle tipine ve sadece EMA 50 göstergesine
  // dön — kullanıcı bu zaman dilimine geçtiğinde (veya sayfa 1H ile açıldığında).
  useEffect(() => {
    if (interval === "60") {
      setCandleType("candle");
      setInternalActive(new Set(["ema50"] as IndicatorKey[]));
    }
  }, [interval]);

  const saveChartSettings = () => {
    if (typeof window === "undefined") return;
    try {
      const settings = {
        interval,
        candleType,
        range,
        indicators: Array.from(active),
      };
      localStorage.setItem("bogastock_chart_settings", JSON.stringify(settings));
      setToastMsg(lang === "tr" ? "✓ Ayarlar ve Göstergeler Kaydedildi!" : "✓ Settings & Indicators Saved!");
      setTimeout(() => setToastMsg(null), 2500);
    } catch {}
  };

  const resetChartSettings = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem("bogastock_chart_settings");
      setInterval_(defaultTimeframe || "240");
      setCandleType("candle");
      setRange("3M");
      setInternalActive(new Set(["ema50", "rsi", "volume"] as IndicatorKey[]));
      setToastMsg(lang === "tr" ? "↺ Varsayılan Ayarlara Sıfırlandı!" : "↺ Reset to Factory Defaults!");
      setTimeout(() => setToastMsg(null), 2500);
    } catch {}
  };
  // Rendered as a plain DOM overlay (see JSX below) — driven by React state
  // instead of a lightweight-charts canvas primitive, since the primitive
  // paint lifecycle (paneViews/renderer/draw) proved unreliable to trigger
  // consistently. Coordinates come from the same priceToCoordinate /
  // logicalToCoordinate APIs, just consumed directly instead of via a canvas.
  const [vpOverlay, setVpOverlay] = useState<{
    anchorX: number;
    rowHeight: number;
    pocY: number;
    rows: { top: number; width: number; isPoc: boolean; inValueArea: boolean }[];
  } | null>(null);
  const recomputeVPRef = useRef<(bars: Bar[]) => void>(() => {});

  // Trade Plan (Entry/Stop/TP1-3) — lib/tradePlanEngine.ts uzerinden ayni
  // /api/preorder-analysis'i (grafik sayfasindaki Trade Plan karti ile ayni
  // kaynak, celismesin diye) sadece detay modunda ceker. Entry bir aralik
  // oldugu icin (VP ile ayni sekilde) DOM overlay olarak, stop/tp1-3 ise
  // tekli fiyat seviyeleri oldugu icin "sr" ile ayni createPriceLine deseniyle
  // cizilir.
  const [tradePlan, setTradePlan] = useState<{
    entryZone: { low: number; high: number };
    stop: { price: number };
    targets: { price: number; label: string }[];
    valid: boolean;
  } | null>(null);
  const [entryZoneOverlay, setEntryZoneOverlay] = useState<{ top: number; height: number } | null>(null);
  const recomputeEntryZoneRef = useRef<() => void>(() => {});

  // Mobil breakpoint (md: = 768px) kontrol — varsayılan göstergeleri uyarla
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Mobil tasarımda varsayılan göstergeleri güncelle: hacim profili ve RSI'ı kaldır.
  // NOT: `defaultIndicators` sadece ilk state'i tohumluyor (grafik sayfası
  // detailMode'da rsi/volumeProfile'ı masaüstü varsayılanı olarak geçiyor,
  // bkz. GraphicDetailContent.tsx) — kullanıcı toolbar'daki butonlarla hâlâ
  // değiştirebiliyor, o yüzden bu durumda ATLANMAMALI. Gerçekten dışarıdan
  // TAM kontrollü mod (compact grid tile gibi, toggle butonu bile yok) sadece
  // `indicatorsProp` (indicators prop'u) geçildiğinde devreye girer.
  useEffect(() => {
    if (indicatorsProp) return; // Tam kontrollü mod — toggle UI'ı yok, dokunma
    if (isMobile) {
      const updated = new Set(internalActive);
      updated.delete("volumeProfile");
      updated.delete("rsi");
      setInternalActive(updated);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!detailMode) return;
    let active = true;
    // preorder-analysis artik 5 dili de uretir (tr varsayilan) — kendi
    // dilinde metin alsin diye gercek locale gonderilir (eskiden tr disindaki
    // tum diller Ingilizce'ye dusuyordu).
    const langParam = lang && lang !== "tr" ? `&lang=${lang}` : "";
    fetch(`/api/preorder-analysis?ticker=${encodeURIComponent(symbol)}${langParam}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active || d.error) return;
        setTradePlan(d.tradePlan);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [symbol, detailMode, lang]);

  // Native Fullscreen API — reliably escapes any ancestor CSS (e.g.
  // backdrop-filter/overflow-hidden on a parent .glass-card), which a
  // plain CSS `position:fixed` trick does not: an ancestor with
  // backdrop-filter creates a new containing block for fixed descendants,
  // silently clipping them instead of covering the viewport.
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Aktif sembol ve kullanıcının sol listeden onay kutucuklarıyla seçtiği (externalMultiChartTickers) hisseler.
  // Seçimdeki tüm ticker'lar çoklu ekrana aktarılır, n sınırı varsa sığdırılır veya havuzdan tamamlanır.
  const openMultiChart = (n: number) => {
    let tickers: string[] = [];
    if (externalMultiChartTickers && externalMultiChartTickers.length > 0) {
      tickers = [...externalMultiChartTickers];
      if (tickers.length < n) {
        const pool = MULTI_CHART_POOL.filter((s) => !tickers.includes(s) && s !== symbol);
        tickers = [...tickers, symbol, ...pool].slice(0, n);
      } else {
        tickers = tickers.slice(0, n);
      }
    } else {
      const pool = MULTI_CHART_POOL.filter((s) => s !== symbol);
      tickers = [symbol, ...pool].slice(0, n);
    }
    setMultiChartTickers(tickers);
    setMultiChartLayout(n);
  };

  const changeMultiChartTicker = (index: number, next: string) => {
    setMultiChartTickers((prev) => {
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  };

  // Sol Markets / Watchlist / Trend Hisseleri listelerindeki onay kutucuklarıyla dışarıdan tetiklenen veya seçim değiştiğinde çoklu grafiği güncelleme
  useEffect(() => {
    if (externalMultiChartTrigger && externalMultiChartTrigger > 0 && externalMultiChartTickers && externalMultiChartTickers.length >= 1) {
      setMultiChartTickers([...externalMultiChartTickers]);
      setMultiChartLayout(externalMultiChartTickers.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalMultiChartTrigger]);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (intervalProp && intervalProp !== interval) setInterval_(intervalProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalProp]);

  // ── Chart lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b949e",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1e2a3a" },
        horzLines: { color: "#1e2a3a" },
      },
      rightPriceScale: { 
        borderColor: "#1e2a3a",
        scaleMargins: { top: 0.2, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#1e2a3a", timeVisible: true, secondsVisible: false, rightOffset: DEFAULT_RIGHT_OFFSET,
        tickMarkFormatter: nyTickMarkFormatter,
      },
      localization: { timeFormatter: nyTimeFormatter },
      autoSize: true,
      // Fare tekerleği varsayılan olarak kapalı — grafik üzerinden sayfayı
      // aşağı/yukarı kaydırmaya çalışan kullanıcı yanlışlıkla zoom yapmasın diye.
      // Tıklayınca (bkz. onClick/onMouseLeave aşağıda) geçici olarak açılıyor.
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: false, axisPressedMouseMove: true, pinch: true },
    });

    const hideVolumePane = indicatorsProp && !indicatorsProp.includes("volume");
    if (!hideVolumePane) {
      const volumeSeries = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: "volume" }, priceScaleId: "" },
        1
      );
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.6, // leave top 60% for candles, more room for taller volume bars
          bottom: 0,
        },
      });
      const volumePaneHeight = compact ? Math.max(50, Math.min(120, Math.round((height ?? 240) * 0.3))) : 190;
      chart.panes()[1]?.setHeight(volumePaneHeight);
      volumeSeriesRef.current = volumeSeries;
    }

    chartRef.current = chart;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoverBar(barsRef.current[barsRef.current.length - 1] ?? null);
        setCrosshairActive(false);
        return;
      }
      const bar = barsRef.current.find((b) => b.time === param.time);
      if (bar) setHoverBar(bar);
      setCrosshairActive(true);
    });

    // Keep the Volume Profile overlay's pixel coordinates in sync with
    // manual pan/zoom too, not just the controlled Range buttons.
    // recomputeVPRef always points at the latest closure (fresh
    // active/range/detailMode), since this subscription itself is only
    // ever set up once, on mount.
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      recomputeVPRef.current(barsRef.current);
      recomputeEntryZoneRef.current();
    });

    const resizeObserver = new ResizeObserver(() => chart.applyOptions({}));
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lineSeriesRefs.current = {};
      priceLinesRef.current = [];
    };
  }, []);

  // ── Data fetch ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const wanted = Array.from(active).filter((k) => k !== "sr").join(",");
    const indicatorsParam = [wanted, active.has("sr") ? "sr" : ""].filter(Boolean).join(",");
    const params = new URLSearchParams({ ticker: symbol, timeframe: interval });
    if (indicatorsParam) params.set("indicators", indicatorsParam);

    try {
      const res = await fetch(`/api/chart-data?${params.toString()}`);
      const data: ChartResponse = await res.json();
      lastDataRef.current = data;
      renderAll(data);
    } catch {
      // silent — network hiccup, next poll/refetch will retry
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, active]);

  // Fixed Range Volume Profile — only in the full detail toolbar, never on
  // compact/mini/hover embeds, regardless of what `active` contains.
  // "Fixed range" = the currently visible window (the same range the
  // Görünüm buttons zoom to), not the whole fetched dataset — otherwise
  // the profile is computed and positioned against months of off-screen
  // history instead of what's actually on screen. Must run AFTER
  // applyVisibleRange (needs the timeScale already reflecting the current
  // zoom/margin to compute correct pixel coordinates).
  const recomputeVolumeProfile = (bars: Bar[]) => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    if (!chart || !mainSeries) return;

    if (!(detailMode && active.has("volumeProfile") && bars.length > 0)) {
      setVpOverlay(null);
      chart.timeScale().applyOptions({ rightOffset: DEFAULT_RIGHT_OFFSET });
      return;
    }

    const lastBar = bars[bars.length - 1];
    const windowSeconds = RANGE_WINDOW_SECONDS[range];
    const visibleBars = bars.filter((b) => b.time >= lastBar.time - windowSeconds);
    const profileBars = visibleBars.length > 1 ? visibleBars : bars;
    const rows = computeVolumeProfile(profileBars, 24);
    if (rows.length === 0) {
      setVpOverlay(null);
      return;
    }

    // Anchor at the far edge of the reserved right-hand margin (not at the
    // last candle) using the logical index space — timeToCoordinate can't
    // resolve a Time value past the last real bar, but logical indices
    // extend smoothly into the empty rightOffset margin.
    chart.timeScale().applyOptions({ rightOffset: VP_MARGIN_BARS + 2 });
    const anchorLogical = bars.length - 1 + VP_MARGIN_BARS + 1;
    const anchorX = chart.timeScale().logicalToCoordinate(anchorLogical as any);
    if (anchorX == null) {
      setVpOverlay(null);
      return;
    }

    const barSpacing = chart.timeScale().options().barSpacing;
    const maxWidthPx = barSpacing * VP_MARGIN_BARS;
    const maxVol = Math.max(...rows.map((r) => r.volume), 1);
    const pocIndex = rows.findIndex((r) => r.volume === maxVol);

    // Value Area — the contiguous price band around the POC holding ~70% of
    // total volume. Expand outward from the POC one row at a time, always
    // taking whichever neighbor (above/below the current band) has more
    // volume, until the running total crosses the threshold.
    const totalVol = rows.reduce((sum, r) => sum + r.volume, 0);
    const inVA = new Array(rows.length).fill(false);
    let lo = pocIndex;
    let hi = pocIndex;
    inVA[pocIndex] = true;
    let vaVol = rows[pocIndex].volume;
    const vaTarget = totalVol * 0.7;
    while (vaVol < vaTarget && (lo > 0 || hi < rows.length - 1)) {
      const aboveVol = hi < rows.length - 1 ? rows[hi + 1].volume : -1;
      const belowVol = lo > 0 ? rows[lo - 1].volume : -1;
      if (aboveVol >= belowVol) {
        hi += 1;
        vaVol += rows[hi].volume;
        inVA[hi] = true;
      } else {
        lo -= 1;
        vaVol += rows[lo].volume;
        inVA[lo] = true;
      }
    }

    const step = rows.length > 1 ? Math.abs(rows[0].price - rows[1].price) : 1;
    const y1 = mainSeries.priceToCoordinate(rows[0].price + step / 2);
    const y2 = mainSeries.priceToCoordinate(rows[0].price - step / 2);
    const rowHeight = y1 != null && y2 != null ? Math.max(1, Math.abs(y2 - y1)) : 8;

    const overlayRows: { top: number; width: number; isPoc: boolean; inValueArea: boolean }[] = [];
    let pocY: number | null = null;
    rows.forEach((r, i) => {
      const y = mainSeries.priceToCoordinate(r.price);
      if (y == null) return;
      if (i === pocIndex) pocY = y;
      overlayRows.push({
        top: y - rowHeight / 2,
        width: (maxWidthPx * r.volume) / maxVol,
        isPoc: i === pocIndex,
        inValueArea: inVA[i],
      });
    });
    if (pocY == null) {
      setVpOverlay(null);
      return;
    }

    setVpOverlay({ anchorX, rowHeight, pocY, rows: overlayRows });
  };
  recomputeVPRef.current = recomputeVolumeProfile;

  // Entry zone — VP ile ayni desen: canvas primitive yerine plain DOM
  // overlay, mainSeries.priceToCoordinate() ile pixel Y'ye cevrilir.
  const recomputeEntryZone = () => {
    const mainSeries = mainSeriesRef.current;
    if (!mainSeries || !active.has("entry") || !tradePlan?.valid) {
      setEntryZoneOverlay(null);
      return;
    }
    const yHigh = mainSeries.priceToCoordinate(tradePlan.entryZone.high);
    const yLow = mainSeries.priceToCoordinate(tradePlan.entryZone.low);
    if (yHigh == null || yLow == null) {
      setEntryZoneOverlay(null);
      return;
    }
    setEntryZoneOverlay({ top: yHigh, height: Math.max(1, yLow - yHigh) });
  };
  recomputeEntryZoneRef.current = recomputeEntryZone;

  const renderAll = (data: ChartResponse) => {
    const bars = data.bars || [];
    barsRef.current = bars;
    const chart = chartRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || bars.length === 0) return;

    // Clear previous overlays
    for (const key of Object.keys(lineSeriesRefs.current) as IndicatorKey[]) {
      for (const series of lineSeriesRefs.current[key] || []) chart.removeSeries(series);
    }
    lineSeriesRefs.current = {};
    if (mainSeriesRef.current) {
      for (const pl of priceLinesRef.current) {
        try { mainSeriesRef.current.removePriceLine(pl); } catch {}
      }
    }
    priceLinesRef.current = [];

    if (!mainSeriesRef.current) {
      mainSeriesRef.current = createMainSeries(chart, candleType);
      mainSeriesRef.current.priceScale().applyOptions({
        scaleMargins: { top: 0.15, bottom: 0.15 }
      });
    }
    const mainSeries = mainSeriesRef.current;

    mainSeries.setData(toMainSeriesData(bars, candleType));
    
    if (volumeSeries) {
      volumeSeries.setData(
        bars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? `${UP_COLOR}cc` : `${DOWN_COLOR}cc`,
        }))
      );
      volumeSeries.applyOptions({ visible: active.has("volume") });
    }

    const ind = data.indicators || {};
    const toPoints = (arr: unknown) =>
      (arr as (number | null)[] | undefined)?.map((v, i) => ({ time: bars[i].time as UTCTimestamp, value: v })).filter((p) => p.value != null) as
        | { time: UTCTimestamp; value: number }[]
        | undefined;

    for (const key of ["ema9", "ema20", "ema50", "ema200"] as const) {
      if (active.has(key) && ind[key]) {
        const series = chart.addSeries(LineSeries, { color: EMA_COLORS[key], lineWidth: 2, priceLineVisible: false });
        series.setData(toPoints(ind[key]) || []);
        lineSeriesRefs.current[key] = [series];
      }
    }

    if (active.has("bb") && ind.bb) {
      const bb = ind.bb as { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
      const series: ISeriesApi<"Line">[] = [];
      for (const [band, color] of [["upper", "#64748b"], ["middle", "#94a3b8"], ["lower", "#64748b"]] as const) {
        const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false });
        s.setData(toPoints(bb[band]) || []);
        series.push(s);
      }
      lineSeriesRefs.current.bb = series;
    }

    if (active.has("vwap") && ind.vwap) {
      const series = chart.addSeries(LineSeries, { color: "#eab308", lineWidth: 2, priceLineVisible: false });
      series.setData(toPoints(ind.vwap) || []);
      lineSeriesRefs.current.vwap = [series];
    }

    if (active.has("sma") && ind.sma) {
      const series = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 2, priceLineVisible: false });
      series.setData(toPoints(ind.sma) || []);
      lineSeriesRefs.current.sma = [series];
    }
    
    if (active.has("supertrend") && ind.supertrend) {
      const st = ind.supertrend as { supertrend: (number | null)[]; direction: (number | null)[] };
      const series = chart.addSeries(LineSeries, { color: "#a855f7", lineWidth: 2, priceLineVisible: false });
      series.setData(toPoints(st.supertrend) || []);
      lineSeriesRefs.current.supertrend = [series];
    }

    let nextPaneIdx = 2;

    if (active.has("rsi") && ind.rsi) {
      const series = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 2 }, nextPaneIdx);
      series.setData(toPoints(ind.rsi) || []);
      chart.panes()[nextPaneIdx]?.setHeight(90);
      lineSeriesRefs.current.rsi = [series];
      nextPaneIdx++;
    }

    if (active.has("macd") && ind.macd) {
      const m = ind.macd as { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] };
      const macdLine = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 1 }, nextPaneIdx);
      macdLine.setData(toPoints(m.macd) || []);
      const signalLine = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1 }, nextPaneIdx);
      signalLine.setData(toPoints(m.signal) || []);
      chart.panes()[nextPaneIdx]?.setHeight(90);
      lineSeriesRefs.current.macd = [macdLine, signalLine];
      nextPaneIdx++;
    }
    
    if (active.has("atr") && ind.atr) {
      const series = chart.addSeries(LineSeries, { color: "#ec4899", lineWidth: 2 }, nextPaneIdx);
      series.setData(toPoints(ind.atr) || []);
      chart.panes()[nextPaneIdx]?.setHeight(90);
      lineSeriesRefs.current.atr = [series];
      nextPaneIdx++;
    }
    
    if (active.has("obv") && ind.obv) {
      const series = chart.addSeries(LineSeries, { color: "#14b8a6", lineWidth: 2 }, nextPaneIdx);
      series.setData(toPoints(ind.obv) || []);
      chart.panes()[nextPaneIdx]?.setHeight(90);
      lineSeriesRefs.current.obv = [series];
      nextPaneIdx++;
    }
    
    if (active.has("volatilite") && ind.volatilite) {
      const series = chart.addSeries(LineSeries, { color: "#f43f5e", lineWidth: 2 }, nextPaneIdx);
      series.setData(toPoints(ind.volatilite) || []);
      chart.panes()[nextPaneIdx]?.setHeight(90);
      lineSeriesRefs.current.volatilite = [series];
      nextPaneIdx++;
    }

    if (active.has("fvg") && ind.fvg) {
      const zones = ind.fvg as { top: number; bottom: number; type: string }[];
      for (const z of zones) {
        priceLinesRef.current.push(mainSeries.createPriceLine({
          price: z.top,
          color: z.type === "bullish" ? "#22c55e80" : "#ef444480",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: false,
          title: "FVG"
        }));
        priceLinesRef.current.push(mainSeries.createPriceLine({
          price: z.bottom,
          color: z.type === "bullish" ? "#22c55e80" : "#ef444480",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: false,
        }));
      }
    }

    if (active.has("sd") && ind.sd) {
      const zones = ind.sd as { top: number; bottom: number; type: string }[];
      for (const z of zones) {
        priceLinesRef.current.push(mainSeries.createPriceLine({
          price: z.top,
          color: z.type === "demand" ? "#10b981" : "#f43f5e",
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: z.type === "demand" ? "Demand" : "Supply"
        }));
        priceLinesRef.current.push(mainSeries.createPriceLine({
          price: z.bottom,
          color: z.type === "demand" ? "#10b981" : "#f43f5e",
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: false,
        }));
      }
    }

    if (active.has("fibonacci") && ind.fibonacci) {
      const fib = ind.fibonacci as { levels: { price: number; level: number }[] };
      const fibColors = ["#94a3b8", "#f87171", "#fbbf24", "#4ade80", "#60a5fa", "#c084fc", "#94a3b8"];
      fib.levels.forEach((lvl, i) => {
        priceLinesRef.current.push(mainSeries.createPriceLine({
          price: lvl.price,
          color: fibColors[i % fibColors.length],
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `Fib ${lvl.level}`
        }));
      });
    }

    if (active.has("trendLine") && ind.trendLine) {
      const lines = ind.trendLine as { start_time: number; start_price: number; end_time: number; end_price: number; type: string }[];
      const ts = [];
      for (const tl of lines) {
        if (tl.start_time >= tl.end_time) continue; // Lightweight charts requires strictly increasing time
        const series = chart.addSeries(LineSeries, { 
          color: tl.type === "support" ? "#22c55e" : "#ef4444", 
          lineWidth: 2, 
          lineStyle: 0,
          priceLineVisible: false 
        });
        series.setData([
          { time: tl.start_time as UTCTimestamp, value: tl.start_price },
          { time: tl.end_time as UTCTimestamp, value: tl.end_price }
        ]);
        ts.push(series);
      }
      lineSeriesRefs.current.trendLine = ts;
    }

    if (active.has("horizontalLine") && ind.horizontalLine) {
      const hLines = ind.horizontalLine as { price: number; type: string }[];
      for (const hl of hLines) {
        priceLinesRef.current.push(mainSeries.createPriceLine({
          price: hl.price,
          color: hl.type === "resistance" ? "#ef4444" : "#22c55e",
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: hl.type === "resistance" ? "Res" : "Sup"
        }));
      }
    }



    if (active.has("sr") && data.sr) {
      // Keep only the levels nearest the last close — otherwise months of
      // pivot history clutters the chart with dozens of R/S lines.
      const lastClose = bars[bars.length - 1]?.close ?? 0;
      const nearest = [...data.sr]
        .sort((a, b) => Math.abs(a.price - lastClose) - Math.abs(b.price - lastClose))
        .slice(0, 6);
      for (const level of nearest) {
        const pl = mainSeries.createPriceLine({
          price: level.price,
          color: level.type === "resistance" ? DOWN_COLOR : UP_COLOR,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: level.type === "resistance" ? "R" : "S",
        });
        priceLinesRef.current.push(pl);
      }
    }

    // Trade Plan tekli seviyeler (STOP/TP1-3) — "sr" ile ayni createPriceLine
    // deseni, farkli renk/etiketle. "entry" burada degil: o bir aralik,
    // priceLine tek deger aliyor — ayrica DOM overlay olarak cizilir (asagida
    // recomputeEntryZone).
    if (tradePlan?.valid) {
      if (active.has("stop")) {
        priceLinesRef.current.push(
          mainSeries.createPriceLine({
            price: tradePlan.stop.price,
            color: DOWN_COLOR,
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: "STOP",
          })
        );
      }
      const tpColors = ["#3b82f6", "#06b6d4", "#8b5cf6"];
      tradePlan.targets.slice(0, 3).forEach((tg, i) => {
        const key = `tp${i + 1}` as IndicatorKey;
        if (!active.has(key)) return;
        priceLinesRef.current.push(
          mainSeries.createPriceLine({
            price: tg.price,
            color: tpColors[i] ?? tpColors[0],
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `TP${i + 1}`,
          })
        );
      });
    }

    applyVisibleRange(bars);
    recomputeVolumeProfile(bars);
    recomputeEntryZone();
    setHoverBar(bars[bars.length - 1] ?? null);
  };

  const applyVisibleRange = (bars: Bar[]) => {
    const chart = chartRef.current;
    if (!chart) return;
    const lastBar = bars[bars.length - 1];
    if (!lastBar || bars.length <= 1) {
      chart.timeScale().fitContent();
      return;
    }
    // Detail mode: independent "Görünüm" (range/zoom) row, user-selectable.
    // Otherwise: auto-pick a sensible window per interval (spec: 4H opens to 1W).
    const windowSeconds = detailMode
      ? RANGE_WINDOW_SECONDS[range]
      : ({ "1": 86400, "5": 86400, "15": 86400, "60": 5 * 86400, "240": 7 * 86400, D: 90 * 86400, W: 730 * 86400 }[
          interval
        ] ?? 7 * 86400);

    // setVisibleRange sets an explicit from/to, which overrides rightOffset —
    // so when the Volume Profile margin is reserved, extend `to` past the
    // last candle to keep that margin (and the profile drawn in it) in view.
    let rightEdge = lastBar.time;
    if (detailMode && active.has("volumeProfile") && bars.length > 1) {
      const barInterval = bars[bars.length - 1].time - bars[bars.length - 2].time;
      rightEdge = lastBar.time + barInterval * (VP_MARGIN_BARS + 2);
    }

    chart.timeScale().setVisibleRange({
      from: Math.max(bars[0].time, lastBar.time - windowSeconds) as UTCTimestamp,
      to: rightEdge as UTCTimestamp,
    });
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Candle type change: re-create the main series and redraw from cached
  // data — no network refetch needed, same bars, different presentation.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
    }
    mainSeriesRef.current = createMainSeries(chart, candleType);
    if (lastDataRef.current) renderAll(lastDataRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candleType]);

  // Range (view window) change: rezoom + recompute the volume profile
  // against the newly-selected window — no refetch needed.
  useEffect(() => {
    if (barsRef.current.length) {
      applyVisibleRange(barsRef.current);
      recomputeVolumeProfile(barsRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // ── Polling for the latest bar (Yahoo data is ~15min delayed, so this
  // just keeps the last visible candle current rather than simulating ticks) ──
  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.hidden) return;
      fetchData();
    }, 60_000);
    return () => window.clearInterval(poll);
  }, [fetchData]);

  const toggle = (key: IndicatorKey) => {
    if (TRADE_PLAN_KEYS.includes(key)) {
      if (tradePlanGated) {
        setShowPremiumModal(true);
        return;
      }
    } else if (indicatorGated && !FREE_INDICATOR_KEYS.has(key)) {
      setShowFreeRegisterModal(true);
      return;
    }
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const changeInterval = (value: string) => {
    setInterval_(value);
    onIntervalChange?.(value);
  };

  // Volume Profile ve Trade Plan (Entry/Stop/TP1-3) detay-sayfasi-only —
  // compact/mini/embedded grafiklerde hicbir zaman toggle olarak sunulmaz.
  // Trade Plan gecerli degilse (bkz. tradePlan.valid) hic gosterilmez —
  // TickerDetailPanel'deki "Not Suitable for a Trade" ile ayni mantik.
  const availableIndicators: IndicatorKey[] = compact
    ? ["ema20", "ema50"]
    : detailMode
    ? INDICATOR_KEYS.filter((k) => !TRADE_PLAN_KEYS.includes(k) || tradePlan?.valid)
    : INDICATOR_KEYS.filter((k) => k !== "volumeProfile" && !TRADE_PLAN_KEYS.includes(k));

  const latestValue = (key: string): number | null => {
    const arr = lastDataRef.current?.indicators?.[key] as (number | null)[] | undefined;
    if (!arr) return null;
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i] as number;
    return null;
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `${symbol} chart — BOGA AI`;
  const shareLinks = {
    x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
  };
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  const fmt = (n: number | undefined | null, d = 2) => (n == null ? "—" : formatNumber(n, d));
  const fmtVol = (n: number | undefined | null) => {
    if (n == null) return "—";
    if (n >= 1e9) return formatNumber(n / 1e9, 2) + "B";
    if (n >= 1e6) return formatNumber(n / 1e6, 2) + "M";
    if (n >= 1e3) return formatNumber(n / 1e3, 1) + "K";
    return String(n);
  };

  // Gösterge butonu — hem masaüstü satırında hem mobil açılır panelde
  // AYNI kod kullanılsın diye tek yerden üretilir.
  const renderIndicatorButton = (key: IndicatorKey) => {
    const isTradePlanKey = TRADE_PLAN_KEYS.includes(key);
    const locked = isTradePlanKey ? tradePlanGated : indicatorGated && !FREE_INDICATOR_KEYS.has(key);
    const val = !locked && ["ema9", "ema20", "ema50", "ema200", "vwap"].includes(key) ? latestValue(key) : null;
    const tpColor = TRADE_PLAN_COLORS[key];
    const tpLabel = locked && isTradePlanKey
      ? "(Premium)"
      : tradePlan
      ? tradePlanValueLabel(key, tradePlan)
      : null;
    return (
      <button
        key={key}
        onClick={() => toggle(key)}
        title={locked ? (isTradePlanKey ? t.premiumRequired : t.freeAccountRequired) : undefined}
        className={`px-2 py-0.5 rounded text-[8px] font-medium border transition-all ${
          locked
            ? "border-[#1e2a3a] text-[#64748b]/60 hover:text-amber-400 hover:border-amber-500/40"
            : active.has(key)
            ? tpColor
              ? ""
              : "bg-[#3b82f6]/20 border-[#3b82f6]/50 text-[#3b82f6]"
            : "border-[#1e2a3a] text-white hover:text-blue-200"
        }`}
        style={
          !locked && active.has(key) && tpColor
            ? { background: `${tpColor}33`, borderColor: `${tpColor}80`, color: tpColor }
            : undefined
        }
      >
        {locked && (
          <svg className="inline w-2 h-2 mr-0.5 -mt-0.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H9.5V4.5A2 2 0 0 1 11.5 2.5h.5v-1h-.5zM8 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>
          </svg>
        )}
        {t[key]}
        {val != null ? ` ${fmt(val)}` : ""}
        {tpLabel ? ` ${tpLabel}` : ""}
      </button>
    );
  };

  // Paylaş butonu + açılır menüsü — masaüstünde ilk satırda (metinli),
  // mobilde ikinci satırda mum tipi seçicisinin yanındaki boş alanda
  // (ikon-only) render edilir; aynı shareOpen state'i paylaşırlar.
  const shareControl = (
    <div className="relative">
      <button
        onClick={() => setShareOpen((v) => !v)}
        className="flex items-center gap-1 p-1 md:px-2.5 md:py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-medium text-[#00d2ff] hover:text-white transition-all"
        title={t.share}
      >
        <svg className="w-3 h-3 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path strokeLinecap="round" d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9" />
        </svg>
        <span className="hidden md:inline">{t.share}</span>
      </button>
      {shareOpen && (
        <div className="absolute right-0 mt-1 w-40 rounded-lg bg-[#141924] border border-[#1e2a3a] shadow-2xl overflow-hidden z-30">
          <a href={shareLinks.x} target="_blank" rel="noopener noreferrer"
             className="block px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
            X (Twitter)
          </a>
          <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer"
             className="block px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
            WhatsApp
          </a>
          <a href={shareLinks.telegram} target="_blank" rel="noopener noreferrer"
             className="block px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
            Telegram
          </a>
          <button
            onClick={handleCopyLink}
            className="block w-full text-left px-3 py-2 text-[11px] font-medium text-slate-300 hover:bg-[#1e2a3a] hover:text-white"
          >
            {copied ? t.linkCopied : t.copyLink}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col w-full h-full"
      style={{ background: isFullscreen ? "#0a0e17" : `${NAVY}0d` }}
    >
      <div className="contents">
        {showToolbar && (
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-[#1e2a3a]">
            <div className="flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
              {INTERVALS.map((iv) => (
                <button
                  key={iv.value}
                  onClick={() => changeInterval(iv.value)}
                  style={{ fontSize: 9 }}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    interval === iv.value ? "bg-[#3b82f6] text-white" : "text-[#00d2ff] hover:text-white"
                  }`}
                >
                  {iv.label}
                </button>
              ))}
            </div>
            {!detailMode && !hideIndicatorToggles && (
              <div className="flex flex-wrap items-center gap-1.5">
                {availableIndicators.map((key) => (
                  <button
                    key={key}
                    onClick={() => toggle(key)}
                    className={`px-2 py-0.5 rounded text-[9px] font-medium border transition-all ${
                      active.has(key)
                        ? "bg-[#3b82f6]/20 border-[#3b82f6]/50 text-[#3b82f6]"
                        : "border-[#1e2a3a] text-[#64748b] hover:text-white"
                    }`}
                  >
                    {t[key]}
                  </button>
                ))}
              </div>
            )}
            {detailMode && (
              <div className="relative ml-2">
                <button
                  onClick={() => setIndicatorsMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[11px] font-medium text-[#00d2ff] hover:text-white transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {t.indicators} <span className="text-[9px]">{indicatorsMenuOpen ? "▴" : "▾"}</span>
                </button>
                {indicatorsMenuOpen && (
                  <div className="absolute left-0 mt-1 w-72 max-h-[60vh] overflow-y-auto rounded-lg bg-[#141924] border border-[#1e2a3a] shadow-2xl z-50 p-2 scrollbar-thin scrollbar-thumb-[#1e2a3a] scrollbar-track-transparent">
                    <div className="text-[9px] font-medium text-slate-500 mb-1 mt-1 px-2 uppercase tracking-widest">{t.catTrend || "Trend"}</div>
                    {(["ema9", "ema20", "ema50", "ema200", "sma", "supertrend", "macd"] as IndicatorKey[]).map(k => (
                      <button key={k} onClick={() => toggle(k)} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has(k) ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t[k] || (k === "supertrend" ? "Supertrend" : k.toUpperCase())}</button>
                    ))}
                    
                    <div className="text-[9px] font-medium text-slate-500 mb-1 mt-3 px-2 uppercase tracking-widest">{t.catMomentum || "Momentum"}</div>
                    {(["rsi", "volatilite", "bb", "atr"] as IndicatorKey[]).map(k => (
                      <button key={k} onClick={() => toggle(k)} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has(k) ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t[k] || (k === "volatilite" ? "Volatilite" : k === "bb" ? "Bollinger Bands" : k.toUpperCase())}</button>
                    ))}
                    
                    <div className="text-[9px] font-medium text-slate-500 mb-1 mt-3 px-2 uppercase tracking-widest">{t.catVolume || "Hacim"}</div>
                    {(["volume", "vwap", "obv", "volumeProfile"] as IndicatorKey[]).map(k => (
                      <button key={k} onClick={() => toggle(k)} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has(k) ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t[k] || (k === "volume" ? "Volume" : k === "volumeProfile" ? "Volume Profile" : k.toUpperCase())}</button>
                    ))}
                    
                    <div className="text-[9px] font-medium text-slate-500 mb-1 mt-3 px-2 uppercase tracking-widest">{t.catStructure || "Piyasa Yapısı"}</div>
                    <button onClick={() => toggle("sr")} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has("sr") ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t.sr || "Support & Resistance"}</button>
                    <button onClick={() => toggle("sd")} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has("sd") ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t.sd || "Supply & Demand Zones"}</button>
                    <button onClick={() => toggle("fvg")} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has("fvg") ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t.fvg || "Fair Value Gap (FVG)"}</button>
                    
                    <div className="text-[9px] font-medium text-slate-500 mb-1 mt-3 px-2 uppercase tracking-widest">{t.catDrawings || "Çizim Araçları"}</div>
                    <button onClick={() => toggle("trendLine")} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has("trendLine") ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t.trendLine || "Trend Line"}</button>
                    <button onClick={() => toggle("horizontalLine")} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has("horizontalLine") ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t.horizontalLine || "Horizontal Line"}</button>
                    <button onClick={() => toggle("fibonacci")} className={`block w-full text-left px-2 py-1.5 text-[11px] font-medium rounded transition-colors ${active.has("fibonacci") ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"}`}>{t.fibonacci || "Fibonacci Retracement"}</button>
                  </div>
                )}
              </div>
            )}
            {detailMode && (
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={saveChartSettings}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#3b82f6]/20 border border-[#3b82f6]/50 text-[10px] font-bold text-[#38bdf8] hover:bg-[#3b82f6] hover:text-white transition-all shadow-sm cursor-pointer"
                  title={lang === "tr" ? "Mevcut gösterge ve grafik ayarlarını kaydet" : "Save current indicators & chart settings"}
                >
                  <span>💾</span>
                  <span>{lang === "tr" ? "Kaydet" : "Save"}</span>
                </button>

                <button
                  type="button"
                  onClick={resetChartSettings}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all cursor-pointer"
                  title={lang === "tr" ? "Varsayılan gösterge ve grafik ayarlarına sıfırla" : "Reset to default indicators & settings"}
                >
                  <span>↺</span>
                  <span>{lang === "tr" ? "Sıfırla" : "Reset"}</span>
                </button>

                <div className="hidden md:block">{shareControl}</div>
                <button
                  onClick={toggleFullscreen}
                  className="hidden md:inline-flex px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-medium text-[#00d2ff] hover:text-white transition-all"
                  title={t.fullscreen || "Tam Ekran"}
                >
                  {isFullscreen ? "⛶" : "⛶"}
                </button>
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setMultiChartOpen(v => !v)}
                    className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-medium text-[#00d2ff] hover:text-white transition-all ml-1"
                    title={t.multiChartScreen}
                  >
                    2 / 4 / 6 / 9
                  </button>
                  {multiChartOpen && (
                    <div className="absolute right-0 mt-1 w-24 rounded-lg bg-[#141924] border border-[#1e2a3a] shadow-2xl overflow-hidden z-50">
                      {[2, 3, 4, 6, 9].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            setMultiChartOpen(false);
                            openMultiChart(num);
                          }}
                          className="block w-full text-center px-3 py-2 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-[#1e2a3a] transition-all"
                        >
                          {num} {t.charts}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {detailMode && (
          <>
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 px-2 py-1.5 border-b border-[#1e2a3a]">
              <div className="flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
                {RANGE_KEYS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    style={{ fontSize: 9 }}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      range === r ? "bg-[#3b82f6] text-white" : "text-[#00d2ff] hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Mum tipi — masaüstünde tam buton satırı, mobilde kalabalığı
                  azaltmak için tek satırlık açılır menü (bkz. mobileCandleMenuOpen). */}
              <div className="hidden md:flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
                {CANDLE_TYPES.map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setCandleType(ct)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                      candleType === ct ? "bg-[#3b82f6] text-white" : "text-[#00d2ff] hover:text-white"
                    }`}
                  >
                    {t[ct]}
                  </button>
                ))}
              </div>
              <div className="relative md:hidden">
                <button
                  onClick={() => setMobileCandleMenuOpen((v) => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141924] border border-[#1e2a3a] text-[10px] font-medium text-[#00d2ff]"
                >
                  {t[candleType]} <span className="text-[8px]">{mobileCandleMenuOpen ? "▴" : "▾"}</span>
                </button>
                {mobileCandleMenuOpen && (
                  <div className="absolute left-0 mt-1 rounded-lg bg-[#141924] border border-[#1e2a3a] shadow-2xl overflow-hidden z-30">
                    {CANDLE_TYPES.map((ct) => (
                      <button
                        key={ct}
                        onClick={() => {
                          setCandleType(ct);
                          setMobileCandleMenuOpen(false);
                        }}
                        className={`block w-full text-left px-3 py-2 text-[11px] font-medium whitespace-nowrap ${
                          candleType === ct ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "text-slate-300 hover:bg-[#1e2a3a] hover:text-white"
                        }`}
                      >
                        {t[ct]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Paylaş — mobilde burada, mum tipi seçicisinin yanındaki
                  boş alanda (bkz. shareControl tanımı yukarıda). Negatif
                  margin, satırın gap boşluğunu kısarak dar mobil genişlikte
                  sığmasını sağlıyor. */}
              <div className="md:hidden -ml-1">{shareControl}</div>
            </div>

            {/* Göstergeler — SADECE aktif/varsayılan göstergeler (EMA50,
                RSI, Hacim) tek satırda gösterilir, hem masaüstü hem mobilde.
                Diğer tüm göstergeler gizli kalır; yeni gösterge eklemek için
                üstteki kategorili "Göstergeler ▾" menüsü kullanılır — aktif
                edilen gösterge o menüden işaretlenince otomatik olarak bu
                satırda da belirir (active state ortak). */}
            {!hideIndicatorToggles && (
              <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a3a]">
                {availableIndicators.filter((key) => active.has(key)).map((key) => renderIndicatorButton(key))}
              </div>
            )}
          </>
        )}

        <div
          className="relative flex-1"
          style={{ minHeight: height ?? 300 }}
          onClick={() => chartRef.current?.applyOptions({ handleScroll: { mouseWheel: true }, handleScale: { mouseWheel: true } })}
          onMouseLeave={() => chartRef.current?.applyOptions({ handleScroll: { mouseWheel: false }, handleScale: { mouseWheel: false } })}
        >
          <div ref={containerRef} style={{ width: "100%", height: height ?? "100%", minHeight: height ?? 300 }} />

          {/* Toast Notification */}
          {toastMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-1.5 rounded-full bg-[#0d131f] border-2 border-[#3b82f6] text-xs font-bold text-white shadow-[0_4px_30px_rgba(59,130,246,0.6)] animate-fadeIn pointer-events-none flex items-center gap-2">
              <span className="text-[#38bdf8] text-sm">✦</span>
              <span>{toastMsg}</span>
            </div>
          )}

          {/* BOGASTOCK filigran — sol ustte, detailMode'da masaustunde OHLC
              satirinin hemen altinda (o satir orada her zaman gorunur).
              Mobilde OHLC satiri varsayilan gizli oldugu icin (bkz.
              crosshairActive) filigran da yukari, ust kenara yaklasir —
              aksi halde bos bir bosluk kalirdi. Header.tsx'teki logoyla ayni
              format (Boga mavi, Stock beyaz/gri), dusuk opaklikla mum/gosterge
              okumayi engellemeyecek sekilde. Altinda ticker sembolü. */}
          <div
            className={`absolute ${compact ? "top-1.5 left-2" : detailMode ? "top-2 md:top-9 left-2" : "top-2.5 left-3"} pointer-events-none select-none z-10 flex flex-col items-start`}
          >
            <span
              className={`tracking-wide ${compact ? "text-xs" : "text-lg md:text-xl"}`}
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
            >
              <span style={{ color: "#3b82f6", opacity: 0.5 }}>Boga</span><span style={{ color: "#ffffff", opacity: 0.5 }}>Stock</span>
            </span>
            <span
              className={`tracking-wide text-white ${compact ? "text-xs" : "text-lg md:text-xl"} leading-tight`}
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
            >
              {getSymbolDisplayName(symbol)}
            </span>
          </div>

          {detailMode && (
            // Masaüstünde her zaman görünür (mevcut davranış korunuyor).
            // Mobilde ise ekranı kalabalıklaştırmasın diye SADECE kullanıcı
            // grafiğe dokunup crosshair'i aktif ettiğinde görünür.
            <div
              className={`absolute top-2 left-2 z-10 ${crosshairActive ? "flex" : "hidden"} md:flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1 rounded bg-[#0a0e17]/70 text-[10px] font-medium pointer-events-none`}
            >
              <span className="text-slate-400">O <span className="text-white">{fmt(hoverBar?.open)}</span></span>
              <span className="text-slate-400">H <span className="text-white">{fmt(hoverBar?.high)}</span></span>
              <span className="text-slate-400">L <span className="text-white">{fmt(hoverBar?.low)}</span></span>
              <span className="text-slate-400">C <span className="text-white">{fmt(hoverBar?.close)}</span></span>
              <span className="text-slate-400">{t.vol} <span className="text-white">{fmtVol(hoverBar?.volume)}</span></span>
            </div>
          )}

          {/* Volume Profile — plain DOM overlay (not a canvas primitive),
              positioned with the same coordinate APIs the chart itself uses.
              pointer-events-none so it never blocks crosshair/candle hover. */}
          {vpOverlay && (
            <div className="absolute inset-0 z-[6] overflow-hidden pointer-events-none">
              {/* POC reference line — dashed, spans the full chart width so the
                  price the market spent the most volume at reads clearly behind
                  the candles, not just within the profile bars themselves. */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: vpOverlay.pocY,
                  borderTop: "1px dashed rgba(250,204,21,0.6)",
                }}
              />
              {vpOverlay.rows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: Math.max(0, vpOverlay.anchorX - r.width),
                    top: r.top,
                    width: r.width,
                    height: Math.max(1, vpOverlay.rowHeight - 1),
                    background: r.isPoc
                      ? "rgba(234,179,8,0.8)"
                      : r.inValueArea
                      ? "rgba(96,165,250,0.35)"
                      : "rgba(100,116,139,0.15)",
                  }}
                />
              ))}
            </div>
          )}

          {/* Entry zone — VP ile ayni DOM overlay deseni: taranmis/filigranli
              yesil bir bant, "Entry" toggle'i acikken tradePlan.entryZone
              (low-high) araligini gosterir. pointer-events-none, crosshair'i
              engellemez. */}
          {entryZoneOverlay && tradePlan && (
            <div
              className="absolute left-0 right-0 z-[5] pointer-events-none"
              style={{
                top: entryZoneOverlay.top,
                height: entryZoneOverlay.height,
                background:
                  "repeating-linear-gradient(45deg, rgba(34,197,94,0.16) 0px, rgba(34,197,94,0.16) 5px, transparent 5px, transparent 10px)",
                borderTop: "1px dashed rgba(34,197,94,0.6)",
                borderBottom: "1px dashed rgba(34,197,94,0.6)",
              }}
            >
              <span className="absolute left-1 top-0.5 text-[9px] font-medium text-[#22c55e] bg-[#0a0e17]/70 px-1 rounded">
                ENTRY ${formatNumber(tradePlan.entryZone.low, 2)}–${formatNumber(tradePlan.entryZone.high, 2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {showPremiumModal && <PremiumModal locale={lang} onClose={() => setShowPremiumModal(false)} />}
      {showFreeRegisterModal && (
        <FreeRegisterModal
          locale={lang}
          onClose={() => setShowFreeRegisterModal(false)}
          titleOverride={t.indicatorUnlockTitle}
          descriptionOverride={t.indicatorUnlockDesc}
        />
      )}

      {multiChartLayout && typeof document !== "undefined" &&
        createPortal(
          <MultiChartOverlay
            layout={multiChartLayout}
            tickers={multiChartTickers}
            lang={lang}
            parentCandleType={candleType}
            parentIndicators={Array.from(active)}
            onClose={() => setMultiChartLayout(null)}
            onChangeTicker={changeMultiChartTicker}
            onChangeLayout={(n) => {
              let nextTickers = [...multiChartTickers];
              if (nextTickers.length < n) {
                const pool = MULTI_CHART_POOL.filter((s) => !nextTickers.includes(s) && s !== symbol);
                nextTickers = [...nextTickers, ...pool].slice(0, n);
              } else {
                nextTickers = nextTickers.slice(0, n);
              }
              setMultiChartTickers(nextTickers);
              setMultiChartLayout(n);
            }}
          />,
          document.body
        )}
    </div>
  );
}

function MultiChartOverlay({
  layout,
  tickers,
  lang,
  parentCandleType,
  parentIndicators,
  onClose,
  onChangeTicker,
  onChangeLayout,
}: {
  layout: number;
  tickers: string[];
  lang: Locale;
  parentCandleType?: CandleType;
  parentIndicators?: IndicatorKey[];
  onClose: () => void;
  onChangeTicker: (index: number, next: string) => void;
  onChangeLayout: (n: number) => void;
}) {
  const t = LABELS[lang] || LABELS.en;
  const [sharedInterval, setSharedInterval] = useState("60");
  return (
    <div
      className="fixed inset-0 z-[200] bg-[#0a0e17] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a] shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white uppercase tracking-widest">
            {t.multiChartScreen} — {layout}
          </span>

          {/* Layout Selector Buttons */}
          <div className="flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
            {[2, 4, 6, 9].map((n) => (
              <button
                type="button"
                key={n}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeLayout(n);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  layout === n ? "bg-[#3b82f6] text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
            {INTERVALS.map((iv) => (
              <button
                type="button"
                key={iv.value}
                onClick={(e) => {
                  e.stopPropagation();
                  setSharedInterval(iv.value);
                }}
                style={{ fontSize: 9 }}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  sharedInterval === iv.value ? "bg-[#3b82f6] text-white" : "text-[#00d2ff] hover:text-white"
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="px-3 py-1.5 rounded bg-[#141924] border border-[#1e2a3a] text-xs font-medium text-[#00d2ff] hover:text-white transition-all cursor-pointer z-50"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={`flex-1 grid ${multiChartGridClass(layout)} gap-1.5 p-1.5 overflow-auto`}>
        {tickers.map((ticker, i) => (
          <div key={i} className="min-h-[240px] flex flex-col rounded-lg border border-[#1e2a3a] overflow-hidden">
            <MultiChartTickerInput value={ticker} label={getMarketAssetLabel(ticker, lang)} onChange={(next) => onChangeTicker(i, next)} />
            <div className="flex-1 min-h-0">
              <BogaChartEngine
                symbol={ticker}
                lang={lang}
                compact
                showToolbar={false}
                height={null}
                interval={sharedInterval}
                defaultCandleType={parentCandleType}
                defaultIndicators={parentIndicators}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiChartTickerInput({ value, label, onChange }: { value: string; label: string; onChange: (next: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    setFocused(false);
    const next = draft.trim().toUpperCase();
    if (next && next !== value) onChange(next);
    else setDraft(value);
  };

  return (
    <input
      type="text"
      title={value}
      value={focused ? draft : label}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value);
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value.toUpperCase())}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      className="w-full px-2 py-1 text-[11px] font-medium text-center bg-[#141924] border-b border-[#1e2a3a] text-[#00d2ff] focus:outline-none focus:text-white truncate"
    />
  );
}

