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
// cikardigi icin, repo icinde barindirilan statik, degisken-olmayan Open
// Sans Bold kullanilir (public/fonts/OpenSans-Bold.ttf) — genis Latin
// Extended kapsami (Turkce dahil) ve ag baglantisi gerektirmeden guvenilir.
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

// Kart yuksekligi sabit oldugu icin basligi 2 satirla sinirlamak amacli
// guvenlik kesmesi — gercek tweet metni (contentText) bundan etkilenmez.
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

// Gercek OHLC + hacim mumlariyla profesyonel gorunumlu candlestick grafigi
// (sitenin kendi grafik motorunun kullandigi ayni /api/chart-data verisiyle)
// — duz cizgi sparkline degil. Ust kisim fiyat mumlari, alt kisim hacim
// cubuklari (TrendSpider/BogaChartEngine tarzi orta/uzun vadeli sunum).
function candlestickElements(barsIn: OhlcBar[], width: number, height: number) {
  const bars = barsIn.slice(-14);
  if (bars.length < 2) return null;

  const priceH = Math.round(height * 0.68);
  const volumeGap = 8;
  const volumeH = height - priceH - volumeGap;

  const allValues = bars.flatMap((b) => [b.high, b.low]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const maxVolume = Math.max(...bars.map((b) => b.volume || 0)) || 1;

  const chartWidth = width - 70; // sag tarafta fiyat etiketleri icin yer
  const sidePad = 10;
  const slot = (chartWidth - sidePad * 2) / bars.length;
  const candleWidth = Math.min(slot * 0.6, 20);
  const y = (v: number) => priceH - ((v - min) / range) * priceH;

  const gridLines = [0, 0.5, 1].map((t, i) => (
    <line
      key={`grid${i}`}
      x1={0}
      y1={priceH * t}
      x2={chartWidth}
      y2={priceH * t}
      stroke="rgba(241,245,249,0.12)"
      strokeWidth={1}
    />
  ));

  const candles = bars.flatMap((b, i) => {
    const cx = sidePad + slot * i + slot / 2;
    const bullish = b.close >= b.open;
    const color = bullish ? COLORS.gain : COLORS.loss;
    const bodyTop = y(Math.max(b.open, b.close));
    const bodyBottom = y(Math.min(b.open, b.close));
    const bodyHeight = Math.max(bodyBottom - bodyTop, 3);
    return [
      <line key={`w${i}`} x1={cx} y1={y(b.high)} x2={cx} y2={y(b.low)} stroke={color} strokeWidth={2.5} />,
      <rect key={`b${i}`} x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} rx={1} />,
    ];
  });

  const volumeBars = bars.map((b, i) => {
    const cx = sidePad + slot * i + slot / 2;
    const bullish = b.close >= b.open;
    const barH = Math.max(((b.volume || 0) / maxVolume) * volumeH, 2);
    return (
      <rect
        key={`v${i}`}
        x={cx - candleWidth / 2}
        y={priceH + volumeGap + (volumeH - barH)}
        width={candleWidth}
        height={barH}
        fill={bullish ? COLORS.gain : COLORS.loss}
        fillOpacity={0.4}
      />
    );
  });

  return { chartWidth, height, min, max, elements: [...gridLines, ...candles, ...volumeBars] };
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
  headline: string; // AI ureilen kisa analiz cumlesi
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

  const isStock = params.kind === "stock";
  const changePositive = isStock && (params.changePct ?? 0) >= 0;
  const changeColor = changePositive ? COLORS.gain : COLORS.loss;
  const chart = isStock ? candlestickElements((params as StockCardParams).bars, W - 112, 118) : null;

  const tree = (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgSecondary} 100%)`,
        padding: 56,
        fontFamily: "Inter",
        color: COLORS.text,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img src={logo} width={48} height={48} style={{ borderRadius: 10 }} />
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1, color: COLORS.blue }}>
          BOGASTOCK
        </span>
      </div>

      {isStock ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 22, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontSize: 80, fontWeight: 800 }}>{params.ticker}</span>
            {params.changePct !== undefined && (
              <span style={{ fontSize: 36, fontWeight: 700, color: changeColor, display: "flex" }}>
                {changePositive ? "+" : ""}
                {params.changePct.toFixed(2)}%
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {params.company && (
              <span style={{ fontSize: 26, color: COLORS.text, opacity: 0.85, display: "flex" }}>
                {params.company}
              </span>
            )}
            {params.sector && (
              <span
                style={{
                  fontSize: 20,
                  color: COLORS.cyan,
                  border: `1px solid ${COLORS.cyan}`,
                  borderRadius: 999,
                  padding: "4px 16px",
                  display: "flex",
                }}
              >
                {params.sector}
              </span>
            )}
            {params.theme && (
              <span
                style={{
                  fontSize: 20,
                  color: COLORS.purple,
                  border: `1px solid ${COLORS.purple}`,
                  borderRadius: 999,
                  padding: "4px 16px",
                  display: "flex",
                }}
              >
                {params.theme}
              </span>
            )}
            {params.trendLabel && (
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: changeColor,
                  border: `1px solid ${changeColor}`,
                  borderRadius: 999,
                  padding: "4px 16px",
                  display: "flex",
                }}
              >
                {params.trendLabel}
              </span>
            )}
            {params.rvol != null && (
              <span
                style={{
                  fontSize: 20,
                  color: COLORS.text,
                  opacity: 0.85,
                  border: `1px solid rgba(241,245,249,0.3)`,
                  borderRadius: 999,
                  padding: "4px 16px",
                  display: "flex",
                }}
              >
                {params.rvol.toFixed(1)}x AVG VOL
              </span>
            )}
            {params.opportunity && (
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.gold,
                  border: `1px solid ${COLORS.gold}`,
                  borderRadius: 999,
                  padding: "4px 16px",
                  display: "flex",
                }}
              >
                {params.opportunityLabel ?? "Swing Opportunity"}
              </span>
            )}
          </div>

          {chart && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
              <span style={{ fontSize: 16, color: COLORS.text, opacity: 0.5, display: "flex", letterSpacing: 1 }}>
                {params.ticker} · 1D
              </span>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <svg width={chart.chartWidth} height={chart.height} viewBox={`0 0 ${chart.chartWidth} ${chart.height}`}>
                  {chart.elements}
                </svg>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", marginLeft: 10, paddingTop: 2, paddingBottom: 2 }}>
                  <span style={{ fontSize: 13, color: COLORS.text, opacity: 0.55, display: "flex" }}>${chart.max.toFixed(2)}</span>
                  <span style={{ fontSize: 13, color: COLORS.text, opacity: 0.55, display: "flex" }}>${chart.min.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 19,
              lineHeight: 1.3,
              color: COLORS.text,
              opacity: 0.95,
              borderTop: `1px solid rgba(241,245,249,0.15)`,
              paddingTop: 10,
            }}
          >
            {truncateForCard(params.headline, 140)}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            flex: 1,
            gap: 20,
          }}
        >
          <span style={{ fontSize: 64, fontWeight: 800, color: COLORS.gold, display: "flex" }}>
            {params.headline}
          </span>
          {params.subheadline && (
            <span style={{ fontSize: 30, color: COLORS.text, opacity: 0.9, display: "flex" }}>
              {params.subheadline}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 20,
          opacity: 0.6,
          marginTop: 24,
        }}
      >
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
