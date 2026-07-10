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

function sparklinePath(points: number[], width: number, height: number): string {
  if (points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export interface StockCardParams {
  kind: "stock";
  ticker: string;
  company?: string;
  sector?: string;
  theme?: string;
  changePct?: number;
  ema50?: number | null;
  trendLabel?: string;
  points: number[];
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
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontSize: 96, fontWeight: 800 }}>{params.ticker}</span>
            {params.changePct !== undefined && (
              <span style={{ fontSize: 40, fontWeight: 700, color: changeColor, display: "flex" }}>
                {changePositive ? "+" : ""}
                {params.changePct.toFixed(2)}%
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
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
            {params.ema50 != null && (
              <span
                style={{
                  fontSize: 20,
                  color: COLORS.gold,
                  border: `1px solid ${COLORS.gold}`,
                  borderRadius: 999,
                  padding: "4px 16px",
                  display: "flex",
                }}
              >
                EMA50: {params.ema50.toFixed(2)}
              </span>
            )}
          </div>

          {params.points.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
              <span style={{ fontSize: 18, color: COLORS.text, opacity: 0.5, display: "flex" }}>1D CHART</span>
              <svg width={W - 112} height={130} viewBox={`0 0 ${W - 112} 130`}>
                <path
                  d={sparklinePath(params.points, W - 112, 110)}
                  fill="none"
                  stroke={changeColor}
                  strokeWidth={5}
                />
              </svg>
            </div>
          )}

          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 22,
              lineHeight: 1.4,
              color: COLORS.text,
              opacity: 0.95,
              borderTop: `1px solid rgba(241,245,249,0.15)`,
              paddingTop: 20,
            }}
          >
            {params.headline}
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
