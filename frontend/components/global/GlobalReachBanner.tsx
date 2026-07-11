import DottedMap from "dotted-map";

type Lang = "en" | "es" | "fr" | "pt" | "tr";

// IAB "Large Leaderboard" ad-unit size — the banner is built to this exact aspect ratio.
const BANNER_W = 970;
const BANNER_H = 90;

// Real world map (land-mass dot grid from world.geo.json), computed once at module load.
const worldMap = new DottedMap({ height: 70, grid: "diagonal" });
const nycPin = worldMap.addPin({ lat: 40.73, lng: -73.94, svgOptions: { color: "#fff", radius: 1.1 } });
const allPoints = worldMap.getPoints();

const xs = allPoints.map((p) => p.x);
const ys = allPoints.map((p) => p.y);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const mapW = maxX - minX;
const mapH = Math.max(...ys) - minY;

// Crop to the temperate band (US / Western Europe / Turkey) that matches the leaderboard's
// wide-short aspect ratio — a full uncropped world map is roughly 2:1, far taller than 970x90.
const cropH = mapW * (BANNER_H / BANNER_W);
const cropY = minY + mapH * 0.204;
const dots = allPoints.filter((p) => p !== nycPin && p.y >= cropY && p.y <= cropY + cropH);
const VIEW_BOX = `${minX} ${cropY} ${mapW} ${cropH}`;

const COPY: Record<Lang, { line1: string; line2: string }> = {
  tr: { line1: "70+ Ülke · 5 Dil · ABD Borsaları Analizi", line2: "Küresel fırsatları birlikte yakalıyoruz." },
  en: { line1: "70+ Countries · 5 Languages · US Market Analysis", line2: "Capturing global opportunities together." },
  fr: { line1: "70+ Pays · 5 Langues · Analyse des Marchés Américains", line2: "Saisissons ensemble les opportunités mondiales." },
  pt: { line1: "70+ Países · 5 Idiomas · Análise dos Mercados dos EUA", line2: "Capturando oportunidades globais juntos." },
  es: { line1: "70+ Países · 5 Idiomas · Análisis de Mercados de EE. UU.", line2: "Capturando oportunidades globales juntos." },
};

export default function GlobalReachBanner({ lang }: { lang: Lang }) {
  return (
    <div className="w-full flex justify-center bg-[#0a0e17] px-4 py-3">
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{
          maxWidth: BANNER_W,
          aspectRatio: `${BANNER_W} / ${BANNER_H}`,
          minHeight: 80,
          background: "linear-gradient(90deg, #2563eb 0%, #3b82f6 45%, #60a5fa 100%)",
        }}
      >
        <svg
          viewBox={VIEW_BOX}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full"
        >
          {dots.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={0.55} fill="#ffffff" fillOpacity={0.5} />
          ))}
          <circle cx={nycPin.x} cy={nycPin.y} r={1.1} fill="#ffffff" className="animate-pulse" />
        </svg>

        <div className="relative w-full h-full flex items-center justify-center px-5">
          <div
            className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 rounded-xl px-3 py-1.5 sm:px-6 sm:py-2 text-center"
            style={{ background: "rgba(255,255,255,0.4)" }}
          >
            <p
              className="font-extrabold tracking-tight"
              style={{
                fontSize: "clamp(13px, 2.1vw, 20px)",
                lineHeight: 1.15,
                color: "#0f1f45",
              }}
            >
              {COPY[lang].line1}
            </p>
            <p
              className="font-bold tracking-wide"
              style={{
                fontSize: "clamp(13px, 1.9vw, 17px)",
                lineHeight: 1.15,
                color: "#081228",
              }}
            >
              {COPY[lang].line2}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
