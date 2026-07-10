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

function truncateForCard(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ~60 gunluk gercek OHLC + hacim mumlariyla temiz candlestick grafigi.
// Ust: fiyat mumlari (net araliklarla, birbirine girmeden), alt: hacim
// cubuklari. Yukselen destek trend cizgisi gercek swing low'lardan hesaplanir.
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

  const gridLines = [0.25, 0.5, 0.75].map((t, i) => (
    <line key={`grid${i}`} x1={0} y1={priceH * t} x2={chartWidth} y2={priceH * t} stroke="rgba(241,245,249,0.08)" strokeWidth={1} />
  ));

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

  return {
    height,
    min,
    max,
    elements: [...gridLines, ...candles, trendline, ...volumeBars].filter(Boolean),
    lastPrice: last.close,
    lastY: y(last.close),
    lastBullish,
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
  const H = 675;
  const PAD = 40;

  const isStock = params.kind === "stock";
  const changePositive = isStock && (params.changePct ?? 0) >= 0;
  const changeColor = changePositive ? COLORS.gain : COLORS.loss;

  const chartAreaWidth = W - PAD * 2;
  const priceGutter = 96; // sag tarafta fiyat ekseni + guncel fiyat rozeti
  const svgWidth = chartAreaWidth - priceGutter;
  const chart = isStock ? buildChart((params as StockCardParams).bars, svgWidth, 300) : null;

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logo} width={34} height={34} style={{ borderRadius: 8 }} />
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1, color: COLORS.blue }}>BOGASTOCK</span>
        </div>
        {isStock && (
          <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.55, letterSpacing: 2, display: "flex" }}>
            {params.ticker} · DAILY
          </span>
        )}
      </div>

      {isStock ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 14 }}>
          {chart && (
            <div style={{ display: "flex", position: "relative", width: chartAreaWidth, height: chart.height }}>
              <svg width={svgWidth} height={chart.height} viewBox={`0 0 ${svgWidth} ${chart.height}`}>
                {chart.elements}
              </svg>
              {/* Guncel fiyat rozeti — son mumun hizasinda, sag kenarda */}
              <div
                style={{
                  position: "absolute",
                  top: Math.min(Math.max(chart.lastY - 17, 0), chart.height * 0.76 - 34),
                  left: svgWidth + 8,
                  display: "flex",
                  background: chart.lastBullish ? COLORS.gain : COLORS.loss,
                  borderRadius: 5,
                  padding: "6px 12px",
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 700, color: "#0d1117", display: "flex" }}>
                  ${chart.lastPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 16 }}>
            <span style={{ fontSize: 52, fontWeight: 800 }}>{params.ticker}</span>
            {params.changePct !== undefined && (
              <span style={{ fontSize: 34, fontWeight: 800, color: changeColor, display: "flex" }}>
                {changePositive ? "+" : ""}
                {params.changePct.toFixed(2)}%
              </span>
            )}
            {params.company && (
              <span style={{ fontSize: 24, color: COLORS.text, opacity: 0.7, display: "flex" }}>{params.company}</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            {params.sector && (
              <span style={{ fontSize: 20, color: COLORS.cyan, border: `2px solid ${COLORS.cyan}`, borderRadius: 999, padding: "5px 16px", display: "flex" }}>
                {params.sector}
              </span>
            )}
            {params.theme && (
              <span style={{ fontSize: 20, color: COLORS.purple, border: `2px solid ${COLORS.purple}`, borderRadius: 999, padding: "5px 16px", display: "flex" }}>
                {params.theme}
              </span>
            )}
            {params.trendLabel && (
              <span style={{ fontSize: 20, fontWeight: 700, color: changeColor, border: `2px solid ${changeColor}`, borderRadius: 999, padding: "5px 16px", display: "flex" }}>
                {params.trendLabel}
              </span>
            )}
            {params.rvol != null && (
              <span style={{ fontSize: 20, color: COLORS.text, opacity: 0.9, border: `2px solid rgba(241,245,249,0.35)`, borderRadius: 999, padding: "5px 16px", display: "flex" }}>
                {params.rvol.toFixed(1)}x AVG VOL
              </span>
            )}
            {params.opportunity && (
              <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.gold, border: `2px solid ${COLORS.gold}`, borderRadius: 999, padding: "5px 16px", display: "flex" }}>
                {params.opportunityLabel ?? "Swing Opportunity"}
              </span>
            )}
          </div>

          <div style={{ display: "flex", marginTop: 12, fontSize: 22, lineHeight: 1.28, color: COLORS.text }}>
            {truncateForCard(params.headline, 135)}
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

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, opacity: 0.5, marginTop: 10 }}>
        <span style={{ display: "flex" }}>bogastock.com</span>
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
