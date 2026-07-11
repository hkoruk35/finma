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
  tr: "70'ten fazla ülke · 40.000'i aşkın üye · ABD borsalarını 5 dilde canlı takip ediyoruz",
  en: "Over 70 countries · More than 40,000 members · Tracking US markets live in 5 languages.",
  fr: "Plus de 70 pays · Plus de 40 000 membres · Suivi en direct des marchés américains en 5 langues.",
  pt: "Mais de 70 países · Mais de 40.000 membros · Acompanhando os mercados dos EUA ao vivo em 5 idiomas.",
  es: "Más de 70 países · Más de 40.000 miembros · Monitoreando los mercados de EE. UU. en vivo en 5 idiomas.",
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
            className="font-extrabold text-white tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
            style={{ fontSize: "clamp(14px, 2.4vw, 22px)", lineHeight: 1.15 }}
          >
            {COPY[lang]}
          </p>
        </div>
      </div>
    </div>
  );
}
