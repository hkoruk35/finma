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

const COPY: Record<Lang, string> = {
  en: "Analyzing US markets in 5 languages for members across 70+ countries—capturing global opportunities.",
  tr: "70'ten fazla ülkedeki üyelerimiz için ABD borsalarını 5 dilde analiz ediyor, küresel fırsatları yakalıyoruz.",
  fr: "Analyse des marchés américains en 5 langues pour nos membres dans plus de 70 pays : saisir les opportunités mondiales.",
  pt: "Analisando os mercados dos EUA em 5 idiomas para membros em mais de 70 países—capturando oportunidades globais.",
  es: "Analizando los mercados de EE. UU. en 5 idiomas para miembros en más de 70 países, capturando oportunidades globales.",
};

export default function GlobalReachBanner({ lang }: { lang: Lang }) {
  return (
    <div className="w-full flex justify-center bg-[#0a0e17] px-4 py-3">
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{
          maxWidth: BANNER_W,
          aspectRatio: `${BANNER_W} / ${BANNER_H}`,
          minHeight: 64,
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

        <div className="relative w-full h-full flex items-center justify-center px-5 text-center">
          <p
            className="font-extrabold tracking-tight"
            style={{
              fontSize: "clamp(14px, 2.4vw, 22px)",
              lineHeight: 1.15,
              color: "#7dd3fc",
              textShadow: "0 1px 3px rgba(0,0,0,0.65), 0 0 14px rgba(0,0,0,0.35)",
            }}
          >
            {COPY[lang]}
          </p>
        </div>
      </div>
    </div>
  );
}
