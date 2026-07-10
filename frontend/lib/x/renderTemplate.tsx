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

// Gercek sirket logosu (financialmodelingprep'in ucretsiz/anahtarsiz statik
// logo endpoint'i, ticker ile anahtarlanir). Bulunamazsa null doner — sahte
// bir yer tutucu koymuyoruz, sadece o alani bos birakiyoruz.
const companyLogoCache = new Map<string, string | null>();
async function loadCompanyLogoDataUri(ticker: string): Promise<string | null> {
  if (companyLogoCache.has(ticker)) return companyLogoCache.get(ticker)!;
  try {
    const res = await fetch(`https://financialmodelingprep.com/image-stock/${encodeURIComponent(ticker)}.png`);
    if (!res.ok) {
      companyLogoCache.set(ticker, null);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const dataUri = `data:image/png;base64,${buf.toString("base64")}`;
    companyLogoCache.set(ticker, dataUri);
    return dataUri;
  } catch {
    companyLogoCache.set(ticker, null);
    return null;
  }
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

// Gercek OHLC + hacim mumlariyla ~60 gunluk profesyonel candlestick grafigi
// (sitenin kendi grafik motorunun kullandigi ayni /api/chart-data verisiyle).
// Yukselen destek trend cizgisi gercek swing low'lardan hesaplanir (uydurma
// analist hedefi veya sahte "squeeze" gostergesi EKLENMEZ — o veri yok).
function buildChart(barsIn: OhlcBar[], chartWidth: number, height: number) {
  const bars = barsIn.slice(-60);
  if (bars.length < 5) return null;

  const priceH = Math.round(height * 0.7);
  const volumeGap = 8;
  const volumeH = height - priceH - volumeGap;

  const allValues = bars.flatMap((b) => [b.high, b.low]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const maxVolume = Math.max(...bars.map((b) => b.volume || 0)) || 1;

  const sidePad = 4;
  const slot = (chartWidth - sidePad * 2) / bars.length;
  const candleWidth = Math.max(Math.min(slot * 0.7, 10), 1.5);
  const y = (v: number) => priceH - ((v - min) / range) * priceH;
  const xAt = (i: number) => sidePad + slot * i + slot / 2;

  const gridLines = [0.25, 0.5, 0.75].map((t, i) => (
    <line key={`grid${i}`} x1={0} y1={priceH * t} x2={chartWidth} y2={priceH * t} stroke="rgba(241,245,249,0.08)" strokeWidth={1} />
  ));

  const candles = bars.flatMap((b, i) => {
    const cx = xAt(i);
    const bullish = b.close >= b.open;
    const color = bullish ? COLORS.gain : COLORS.loss;
    const bodyTop = y(Math.max(b.open, b.close));
    const bodyBottom = y(Math.min(b.open, b.close));
    const bodyHeight = Math.max(bodyBottom - bodyTop, 1.5);
    return [
      <line key={`w${i}`} x1={cx} y1={y(b.high)} x2={cx} y2={y(b.low)} stroke={color} strokeWidth={1.2} />,
      <rect key={`b${i}`} x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} />,
    ];
  });

  // Yukselen destek trend cizgisi: gercek swing low'lari (5 barlik pencerede
  // yerel minimum) birbirine baglar. Sadece gercekten yukselen bir cizgi
  // olusuyorsa cizilir — trend yukselis degilse sahte destek uydurulmaz.
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
      const x2 = xAt(last.i);
      const y1 = y(first.low);
      const y2 = y(last.low);
      const slope = (y2 - y1) / (x2 - x1);
      const yEnd = y2 + slope * (chartWidth - x2);
      trendline = (
        <line x1={x1} y1={y1} x2={chartWidth} y2={yEnd} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.5} />
      );
    }
  }

  // Hacim profili: fiyat araligini bantlara bolup her bantta islem gormus
  // hacmi (yukselis/dususe gore renklendirilmis) grafigin sag kenarindan
  // sola dogru yatay cubuklar olarak, mumlarin uzerine yari saydam bindirilir.
  const bins = 16;
  const binHeight = priceH / bins;
  const bullVol = new Array(bins).fill(0);
  const bearVol = new Array(bins).fill(0);
  for (const b of bars) {
    const mid = (b.high + b.low) / 2;
    let idx = Math.floor(((max - mid) / range) * bins);
    idx = Math.min(Math.max(idx, 0), bins - 1);
    if (b.close >= b.open) bullVol[idx] += b.volume || 0;
    else bearVol[idx] += b.volume || 0;
  }
  const maxBin = Math.max(...bullVol.map((v, i) => v + bearVol[i]), 1);
  const maxProfileWidth = chartWidth * 0.2;
  const profileBars: React.ReactNode[] = [];
  for (let i = 0; i < bins; i++) {
    const total = bullVol[i] + bearVol[i];
    if (total <= 0) continue;
    const w = (total / maxBin) * maxProfileWidth;
    const bullW = (bullVol[i] / total) * w;
    const bearW = w - bullW;
    const barY = i * binHeight + 1;
    const barH = Math.max(binHeight - 2, 1);
    profileBars.push(<rect key={`pg${i}`} x={chartWidth - w} y={barY} width={bullW} height={barH} fill={COLORS.gain} fillOpacity={0.35} />);
    profileBars.push(<rect key={`pr${i}`} x={chartWidth - w + bullW} y={barY} width={bearW} height={barH} fill={COLORS.loss} fillOpacity={0.35} />);
  }

  const volumeBars = bars.map((b, i) => {
    const cx = xAt(i);
    const barH = Math.max(((b.volume || 0) / maxVolume) * volumeH, 1);
    return (
      <rect
        key={`v${i}`}
        x={cx - candleWidth / 2}
        y={priceH + volumeGap + (volumeH - barH)}
        width={candleWidth}
        height={barH}
        fill={COLORS.cyan}
        fillOpacity={0.55}
      />
    );
  });

  const last = bars[bars.length - 1];
  const lastBullish = last.close >= bars[0].open;

  return {
    height,
    elements: [...gridLines, ...candles, ...profileBars, trendline, ...volumeBars].filter(Boolean),
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
  const isStock = params.kind === "stock";
  const [font, logo, companyLogo] = await Promise.all([
    loadFont(),
    loadLogoDataUri(),
    isStock ? loadCompanyLogoDataUri((params as StockCardParams).ticker) : Promise.resolve(null),
  ]);
  const W = 1200;
  const H = 675;
  const PAD = 32;

  const changePositive = isStock && (params.changePct ?? 0) >= 0;
  const changeColor = changePositive ? COLORS.gain : COLORS.loss;

  const chartAreaWidth = W - PAD * 2;
  const priceBadgeGutter = 92;
  const svgWidth = chartAreaWidth - priceBadgeGutter;
  const chart = isStock ? buildChart((params as StockCardParams).bars, svgWidth, 372) : null;

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
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logo} width={30} height={30} style={{ borderRadius: 7 }} />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: 1, color: COLORS.blue }}>BOGASTOCK</span>
        </div>
        {isStock && (
          <span style={{ fontSize: 17, fontWeight: 700, opacity: 0.55, letterSpacing: 2, display: "flex" }}>
            {params.ticker} · DAILY
          </span>
        )}
      </div>

      {isStock ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 12 }}>
          {chart && (
            <div style={{ display: "flex", position: "relative", width: chartAreaWidth, height: chart.height, overflow: "hidden" }}>
              {companyLogo && (
                <img
                  src={companyLogo}
                  width={56}
                  height={56}
                  style={{ position: "absolute", top: 8, left: 8, opacity: 0.92 }}
                />
              )}
              <svg width={svgWidth} height={chart.height} viewBox={`0 0 ${svgWidth} ${chart.height}`}>
                {chart.elements}
              </svg>
              <div
                style={{
                  position: "absolute",
                  top: Math.min(Math.max(chart.lastY - 14, 0), chart.height - 28),
                  left: svgWidth + 6,
                  display: "flex",
                  background: chart.lastBullish ? COLORS.gain : COLORS.loss,
                  borderRadius: 4,
                  padding: "5px 10px",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0d1117", display: "flex" }}>
                  ${chart.lastPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 14 }}>
            <span style={{ fontSize: 44, fontWeight: 800 }}>{params.ticker}</span>
            {params.changePct !== undefined && (
              <span style={{ fontSize: 24, fontWeight: 700, color: changeColor, display: "flex" }}>
                {changePositive ? "+" : ""}
                {params.changePct.toFixed(2)}%
              </span>
            )}
            {params.company && (
              <span style={{ fontSize: 18, color: COLORS.text, opacity: 0.7, display: "flex" }}>{params.company}</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {params.sector && (
              <span style={{ fontSize: 15, color: COLORS.cyan, border: `1px solid ${COLORS.cyan}`, borderRadius: 999, padding: "3px 12px", display: "flex" }}>
                {params.sector}
              </span>
            )}
            {params.theme && (
              <span style={{ fontSize: 15, color: COLORS.purple, border: `1px solid ${COLORS.purple}`, borderRadius: 999, padding: "3px 12px", display: "flex" }}>
                {params.theme}
              </span>
            )}
            {params.trendLabel && (
              <span style={{ fontSize: 15, fontWeight: 700, color: changeColor, border: `1px solid ${changeColor}`, borderRadius: 999, padding: "3px 12px", display: "flex" }}>
                {params.trendLabel}
              </span>
            )}
            {params.rvol != null && (
              <span style={{ fontSize: 15, color: COLORS.text, opacity: 0.85, border: `1px solid rgba(241,245,249,0.3)`, borderRadius: 999, padding: "3px 12px", display: "flex" }}>
                {params.rvol.toFixed(1)}x AVG VOL
              </span>
            )}
            {params.opportunity && (
              <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.gold, border: `1px solid ${COLORS.gold}`, borderRadius: 999, padding: "3px 12px", display: "flex" }}>
                {params.opportunityLabel ?? "Swing Opportunity"}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 17,
              lineHeight: 1.3,
              color: COLORS.text,
              opacity: 0.9,
            }}
          >
            {truncateForCard(params.headline, 130)}
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
          fontSize: 16,
          opacity: 0.5,
          marginTop: 10,
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
