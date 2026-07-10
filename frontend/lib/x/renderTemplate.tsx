import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs/promises";
import path from "node:path";

// Marka renkleri: app/globals.css @theme bloguyla birebir.
const COLORS = {
  bg: "#030047",
  bgSecondary: "#0f1420",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  purple: "#8b5cf6",
  text: "#f1f5f9",
  gain: "#22c55e",
  loss: "#ef4444",
  gold: "#f59e0b",
};

// Inter'in Google'daki tum dagitimlari (statik da, degisken de) satori'nin
// opentype.js parser'iyla veya Turkce/aksanli glyph kapsamiyla sorun
// cikardigi icin, repo icinde barindirilan statik Open Sans Bold kullanilir.
let fontCache: Buffer | null = null;
async function loadFont(): Promise<Buffer> {
  if (fontCache) return fontCache;
  fontCache = await fs.readFile(path.join(process.cwd(), "public", "fonts", "OpenSans-Bold.ttf"));
  return fontCache;
}

let logoCache: string | null = null;
async function loadLogoDataUri(): Promise<string> {
  if (logoCache) return logoCache;
  const buf = await fs.readFile(path.join(process.cwd(), "public", "favicon.png"));
  logoCache = `data:image/png;base64,${buf.toString("base64")}`;
  return logoCache;
}

// Gunluk kapanislardan 1D/1W/1M/1Y getiri yuzdesi — ayni bars dizisi
// (marketData.ts artik ~1 yillik gunluk kapanis tutuyor) zaten grafik icin
// cekiliyor, ek bir veri kaynagina gerek yok. Yeterli gecmis yoksa (orn.
// yeni halka arz) ilgili donem sessizce atlanir (null).
function computePeriodChanges(bars: OhlcBar[]): { label: string; value: number | null }[] {
  if (!bars || bars.length < 2) return [];
  const lastClose = bars[bars.length - 1].close;
  const closeNDaysAgo = (n: number) => {
    const idx = bars.length - 1 - n;
    return idx >= 0 ? bars[idx].close : null;
  };
  const pct = (base: number | null) => (base ? ((lastClose - base) / base) * 100 : null);
  // 1Y icin tam 252 islem gunu geriye saymak, borsa tatilleri/kismi yil
  // yuzunden dizinin sinirina takilip cogu zaman null donuyordu. Bunun
  // yerine: chart-data zaten range=1y cekiyor, yeterli veri varsa (>=200
  // gun) dizinin ilk barini "1 yil once" referansi olarak kullan.
  const oneYearAgoClose = bars.length >= 200 ? bars[0].close : null;
  return [
    { label: "1D", value: pct(closeNDaysAgo(1)) },
    { label: "1W", value: pct(closeNDaysAgo(5)) },
    { label: "1M", value: pct(closeNDaysAgo(21)) },
    { label: "1Y", value: pct(oneYearAgoClose) },
  ];
}

interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time?: number; // unix saniye — /api/chart-data'dan gelir, eksen tarih etiketleri icin
}

function fmtAxisPrice(v: number): string {
  return `$${v >= 100 ? Math.round(v) : v.toFixed(1)}`;
}

// "Guzel" (yuvarlak) adim buyuklugu — 1/2/2.5/5/10 x 10^n serisinden secer,
// boylece eksen $352/$576/$800 gibi rastgele degil $400/$500/$600/$700 gibi
// standart araliklarla gorunur.
function niceStep(rawStep: number): number {
  if (!(rawStep > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let nice: number;
  if (residual <= 1) nice = 1;
  else if (residual <= 2) nice = 2;
  else if (residual <= 2.5) nice = 2.5;
  else if (residual <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

function computePriceTicks(min: number, max: number, targetCount = 5): number[] {
  const range = max - min || 1;
  const step = niceStep(range / targetCount);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

// Sektor kisa ("Technology") ama bazi tema basliklari (HOT_THEMES_2026) 60+
// karakter olabiliyor — 2x buyutulmus etiket fontunda kart genisligini asip
// kirpilmesin diye uzun metinlerde fontu kademeli kucultur.
function fitTagFontSize(text: string, base: number, maxChars: number, min: number): number {
  if (text.length <= maxChars) return base;
  return Math.max(min, Math.round((base * maxChars) / text.length));
}

// Grafikteki tek sabit-metin etiketler ("DAILY", "AVG VOL") daha once hep
// Ingilizce kaliyordu; trend/tema gibi diger her sey secili dile cevrilirken
// bu ikisinin Ingilizce kalmasi dil karisikligi gibi goruluyordu.
const DAILY_LABEL: Record<string, string> = { en: "DAILY", es: "DIARIO", fr: "QUOTIDIEN", pt: "DIÁRIO", tr: "GÜNLÜK" };
const AVG_VOL_LABEL: Record<string, string> = { en: "AVG VOL", es: "VOL PROM", fr: "VOL MOY", pt: "VOL MÉD", tr: "ORT HACİM" };

function localizedLabel(table: Record<string, string>, locale: string): string {
  return table[locale] ?? table.en;
}

function fmtDateLabel(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// ~60 gunluk gercek OHLC + hacim mumlariyla temiz candlestick grafigi.
// Ust: fiyat mumlari (net araliklarla, birbirine girmeden), alt: hacim
// cubuklari. Yukselen destek trend cizgisi gercek swing low'lardan hesaplanir.
// Ayrica: sol kenarda kabaca fiyat seviyeleri, hacmin altinda seyrek tarih
// etiketleri icin gerekli konum/metin bilgisi de dondurulur.
function buildChart(barsIn: OhlcBar[], chartWidth: number, height: number) {
  const bars = barsIn.slice(-60);
  if (bars.length < 5) return null;

  const priceH = Math.round(height * 0.76);
  const volumeGap = 10;
  const volumeH = height - priceH - volumeGap;

  const allValues = bars.flatMap((b) => [b.high, b.low]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const maxVolume = Math.max(...bars.map((b) => b.volume || 0)) || 1;

  const slot = chartWidth / bars.length;
  const candleWidth = Math.max(slot * 0.6, 2); // mumlar arasi net bosluk kalir
  const y = (v: number) => priceH - ((v - min) / range) * priceH;
  const xAt = (i: number) => slot * i + slot / 2;

  // Yuvarlak ($400/$500/$600 gibi) fiyat basamaklari — hem yatay izgara hem
  // sol eksen etiketleri ayni tick degerlerini kullanir.
  const priceTicks = computePriceTicks(min, max, 5);
  const gridLines = priceTicks.map((t, i) => (
    <line key={`grid${i}`} x1={0} y1={y(t)} x2={chartWidth} y2={y(t)} stroke="rgba(241,245,249,0.09)" strokeWidth={1} />
  ));

  // Eksen cercevesi: sol dikey + alt yatay cizgi sol-alt kosede birlesir
  // (fiyat + hacim panelinin tamamini kapsar).
  const axisFrame = [
    <line key="axisY" x1={0} y1={0} x2={0} y2={height} stroke="rgba(241,245,249,0.28)" strokeWidth={1.5} />,
    <line key="axisX" x1={0} y1={height} x2={chartWidth} y2={height} stroke="rgba(241,245,249,0.28)" strokeWidth={1.5} />,
  ];

  const candles = bars.flatMap((b, i) => {
    const cx = xAt(i);
    const bullish = b.close >= b.open;
    const color = bullish ? COLORS.gain : COLORS.loss;
    const bodyTop = y(Math.max(b.open, b.close));
    const bodyBottom = y(Math.min(b.open, b.close));
    const bodyHeight = Math.max(bodyBottom - bodyTop, 2);
    return [
      <line key={`w${i}`} x1={cx} y1={y(b.high)} x2={cx} y2={y(b.low)} stroke={color} strokeWidth={1.5} />,
      <rect key={`b${i}`} x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} />,
    ];
  });

  // Yukselen destek trend cizgisi: gercek swing low'lari birbirine baglar.
  // Sadece gercekten yukselen bir cizgi olusuyorsa cizilir.
  let trendline: React.ReactNode = null;
  const swingLows: { i: number; low: number }[] = [];
  for (let i = 2; i < bars.length - 2; i++) {
    const window = bars.slice(i - 2, i + 3).map((b) => b.low);
    if (bars[i].low <= Math.min(...window)) swingLows.push({ i, low: bars[i].low });
  }
  if (swingLows.length >= 2) {
    const first = swingLows[0];
    const last = swingLows[swingLows.length - 1];
    if (last.low > first.low && last.i > first.i) {
      const x1 = xAt(first.i);
      const y1 = y(first.low);
      const slope = (y(last.low) - y1) / (xAt(last.i) - x1);
      const yEnd = y1 + slope * (chartWidth - x1);
      trendline = <line x1={x1} y1={y1} x2={chartWidth} y2={yEnd} stroke="#ffffff" strokeWidth={2} strokeDasharray="6 5" strokeOpacity={0.5} />;
    }
  }

  const volumeBars = bars.map((b, i) => {
    const cx = xAt(i);
    const bullish = b.close >= b.open;
    const barH = Math.max(((b.volume || 0) / maxVolume) * volumeH, 1);
    return (
      <rect
        key={`v${i}`}
        x={cx - candleWidth / 2}
        y={priceH + volumeGap + (volumeH - barH)}
        width={candleWidth}
        height={barH}
        fill={bullish ? COLORS.gain : COLORS.loss}
        fillOpacity={0.5}
      />
    );
  });

  const last = bars[bars.length - 1];
  const lastBullish = last.close >= bars[0].open;

  // Sol eksen: gridLine'larla ayni yuvarlak fiyat basamaklari.
  const priceLabels = priceTicks.map((t) => ({ y: y(t), text: fmtAxisPrice(t) }));

  // Alt eksen: cok sik olmayan, bilgi verici 4 tarih etiketi.
  const dateIdxs = Array.from(new Set([0, Math.floor(bars.length / 3), Math.floor((2 * bars.length) / 3), bars.length - 1]));
  const dateLabels = dateIdxs
    .filter((i) => bars[i]?.time)
    .map((i) => ({ x: xAt(i), label: fmtDateLabel(bars[i].time as number) }));

  return {
    height,
    priceH,
    min,
    max,
    elements: [...gridLines, ...axisFrame, ...candles, trendline, ...volumeBars].filter(Boolean),
    lastPrice: last.close,
    lastY: y(last.close),
    lastBullish,
    priceLabels,
    dateLabels,
  };
}

export interface StockCardParams {
  kind: "stock";
  ticker: string;
  company?: string;
  sector?: string;
  theme?: string;
  changePct?: number;
  rvol?: number;
  opportunity?: boolean;
  opportunityLabel?: string;
  trendLabel?: string;
  bars: OhlcBar[];
  headline: string;
  locale: string;
}

export interface PromoCardParams {
  kind: "promo";
  headline: string;
  subheadline?: string;
  locale: string;
}

export type CardParams = StockCardParams | PromoCardParams;

export async function renderCardPng(params: CardParams): Promise<Buffer> {
  const [font, logo] = await Promise.all([loadFont(), loadLogoDataUri()]);
  const W = 1200;
  const H = 760;
  const PAD = 36;

  const isStock = params.kind === "stock";
  const changePositive = isStock && (params.changePct ?? 0) >= 0;
  const changeColor = changePositive ? COLORS.gain : COLORS.loss;

  const chartAreaWidth = W - PAD * 2;
  const priceGutterRight = 140; // sag: fiyat ekseni + guncel fiyat rozeti
  const axisGutterLeft = 54; // sol: kabaca fiyat seviyeleri
  const svgWidth = chartAreaWidth - priceGutterRight - axisGutterLeft;
  const chart = isStock ? buildChart((params as StockCardParams).bars, svgWidth, 280) : null;
  const periodChanges = isStock ? computePeriodChanges((params as StockCardParams).bars) : [];

  const tree = (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(160deg, ${COLORS.bg} 0%, ${COLORS.bgSecondary} 100%)`,
        padding: PAD,
        fontFamily: "Inter",
        color: COLORS.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={logo} width={50} height={50} style={{ borderRadius: 11 }} />
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 1, color: COLORS.blue }}>BOGASTOCK</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, opacity: 0.5, marginLeft: 64, display: "flex" }}>
            bogastock.com
          </span>
        </div>
        {isStock && (
          <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.55, letterSpacing: 2, display: "flex" }}>
            {params.ticker} · {localizedLabel(DAILY_LABEL, params.locale)}
          </span>
        )}
      </div>

      {isStock ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 12 }}>
          {chart && (
            <div style={{ display: "flex", position: "relative", width: chartAreaWidth, height: chart.height + 28 }}>
              <div style={{ display: "flex", width: axisGutterLeft, height: chart.height }} />
              <svg width={svgWidth} height={chart.height} viewBox={`0 0 ${svgWidth} ${chart.height}`}>
                {chart.elements}
              </svg>

              {/* Sol eksen: kabaca fiyat seviyeleri */}
              {chart.priceLabels.map((p, i) => (
                <span
                  key={`pl${i}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: Math.min(Math.max(p.y - 9, 0), chart.priceH - 18),
                    fontSize: 16,
                    fontWeight: 600,
                    opacity: 0.5,
                    display: "flex",
                  }}
                >
                  {p.text}
                </span>
              ))}

              {/* Alt eksen: seyrek tarih etiketleri — hacim cubuklarindan net ayri dursun diye biraz daha asagida */}
              {chart.dateLabels.map((d, i) => (
                <span
                  key={`dl${i}`}
                  style={{
                    position: "absolute",
                    left: axisGutterLeft + d.x - 14,
                    top: chart.height + 9,
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: 0.45,
                    display: "flex",
                  }}
                >
                  {d.label}
                </span>
              ))}

              {/* Guncel fiyat rozeti — son mumun hizasinda, sag kenarda */}
              <div
                style={{
                  position: "absolute",
                  top: Math.min(Math.max(chart.lastY - 22, 0), chart.priceH - 45),
                  left: axisGutterLeft + svgWidth + 8,
                  display: "flex",
                  background: chart.lastBullish ? COLORS.gain : COLORS.loss,
                  borderRadius: 6,
                  padding: "8px 16px",
                }}
              >
                <span style={{ fontSize: 24, fontWeight: 800, color: "#0d1117", display: "flex" }}>
                  ${chart.lastPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 14 }}>
            <span style={{ fontSize: 58, fontWeight: 800, display: "flex" }}>{params.ticker}</span>
            {params.company && (
              <span style={{ fontSize: 28, color: COLORS.text, opacity: 0.7, display: "flex" }}>{params.company}</span>
            )}
          </div>

          {periodChanges.length > 0 && (
            <div style={{ display: "flex", marginTop: 12 }}>
              {periodChanges.map(
                (p, i) =>
                  p.value !== null && (
                    // Sabit genislikli hucre: deger uzunlugu (orn. "+780.84%" vs
                    // "+0.78%") farkli olsa da sutunlar hizali/grid gibi kalir.
                    // Ilk sutun haric ince bir sol cizgi bolumu bir "tablo" gibi ayirir.
                    <div
                      key={p.label}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        width: 190,
                        gap: 2,
                        paddingLeft: i === 0 ? 0 : 22,
                        marginLeft: i === 0 ? 0 : 2,
                        borderLeft: i === 0 ? "none" : "1px solid rgba(241,245,249,0.14)",
                      }}
                    >
                      <span style={{ fontSize: 20, fontWeight: 700, opacity: 0.55, letterSpacing: 1, display: "flex" }}>
                        {p.label}
                      </span>
                      <span
                        style={{
                          fontSize: 38,
                          fontWeight: 800,
                          color: p.value >= 0 ? COLORS.gain : COLORS.loss,
                          display: "flex",
                        }}
                      >
                        {p.value >= 0 ? "+" : ""}
                        {p.value.toFixed(2)}%
                      </span>
                    </div>
                  )
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            {params.sector && (
              <span style={{ fontSize: fitTagFontSize(params.sector, 22, 26, 15), color: COLORS.cyan, border: `2px solid ${COLORS.cyan}`, borderRadius: 999, padding: "6px 18px", display: "flex" }}>
                {params.sector}
              </span>
            )}
            {params.theme && (
              <span style={{ fontSize: fitTagFontSize(params.theme, 22, 26, 15), color: COLORS.purple, border: `2px solid ${COLORS.purple}`, borderRadius: 999, padding: "6px 18px", display: "flex" }}>
                {params.theme}
              </span>
            )}
            {params.trendLabel && (
              <span style={{ fontSize: 22, fontWeight: 700, color: changeColor, border: `2px solid ${changeColor}`, borderRadius: 999, padding: "6px 18px", display: "flex" }}>
                {params.trendLabel}
              </span>
            )}
            {params.rvol != null && (
              <span style={{ fontSize: 22, color: COLORS.text, opacity: 0.9, border: `2px solid rgba(241,245,249,0.35)`, borderRadius: 999, padding: "6px 18px", display: "flex" }}>
                {params.rvol.toFixed(1)}x {localizedLabel(AVG_VOL_LABEL, params.locale)}
              </span>
            )}
            {params.opportunity && (
              <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.gold, border: `2px solid ${COLORS.gold}`, borderRadius: 999, padding: "6px 18px", display: "flex" }}>
                {params.opportunityLabel ?? "Swing Opportunity"}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", flex: 1, gap: 20 }}>
          <span style={{ fontSize: 64, fontWeight: 800, color: COLORS.gold, display: "flex" }}>{params.headline}</span>
          {params.subheadline && (
            <span style={{ fontSize: 30, color: COLORS.text, opacity: 0.9, display: "flex" }}>{params.subheadline}</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 26, fontWeight: 700, opacity: 0.75, marginTop: 12 }}>
        <span style={{ display: "flex" }}>@bogastock</span>
      </div>
    </div>
  );

  const svg = await satori(tree, {
    width: W,
    height: H,
    fonts: [{ name: "Inter", data: font, weight: 700, style: "normal" }],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W } });
  return resvg.render().asPng();
}
