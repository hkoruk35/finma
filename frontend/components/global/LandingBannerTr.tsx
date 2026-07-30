"use client";
import { useState, useEffect } from "react";
import type { LandingConfig } from "@/lib/landingConfig";

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center cursor-zoom-out" onClick={onClose}>
      <img src={src} alt="" className="max-w-[95vw] max-h-[92vh] rounded-xl shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
      <button className="absolute top-4 right-6 text-white/50 hover:text-white text-4xl font-light leading-none" onClick={onClose}>✕</button>
    </div>
  );
}

export function ScreenshotBanner({ lang }: { lang: string }) {
  const [cfg, setCfg] = useState<LandingConfig | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch(`/api/landing-config?lang=${lang}`)
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => {});
  }, [lang]);

  const shots = cfg?.screenshots ?? [];
  if (shots.length === 0) return null;

  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* BÜYÜK AKTİF RESİM */}
      <div className="relative rounded-2xl overflow-hidden border border-[#1e2a3a] shadow-2xl shadow-black/60 mb-3 cursor-zoom-in group"
        onClick={() => setLightbox(shots[active].src)}
      >
        {/* Glow efekti */}
        <div className="absolute -top-20 left-1/4 w-96 h-40 bg-[#3b82f6] blur-[100px] opacity-10 pointer-events-none" />

        <img
          key={active}
          src={shots[active].src}
          alt={shots[active].label}
          className="w-full object-cover object-top"
          style={{ maxHeight: 480 }}
        />

        {/* Overlay — alt bilgi */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
          <div>
            <div className="text-white font-medium text-lg leading-tight">{shots[active].label}</div>
            <div className="text-white/60 text-xs mt-1">{shots[active].desc}</div>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-full px-3 py-1.5 text-white/50 text-[10px] font-medium">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            {lang === "tr" ? "Büyüt" : lang === "es" ? "Ampliar" : lang === "fr" ? "Agrandir" : lang === "pt" ? "Ampliar" : "Enlarge"}
          </div>
        </div>

        {/* Badge — sağ üst */}
        <div className="absolute top-3 right-3 bg-[#3b82f6]/90 text-white text-[9px] font-medium uppercase tracking-widest rounded-full px-2.5 py-1">
          {active + 1} / {shots.length}
        </div>
      </div>

      {/* KÜÇÜK THUMBNAIL GRID */}
      <div className="grid grid-cols-4 gap-2">
        {shots.map((s, i) => (
          <div
            key={i}
            onClick={() => setActive(i)}
            className={`relative rounded-xl overflow-hidden border cursor-pointer transition-all duration-200 ${
              i === active
                ? "border-[#3b82f6] shadow-lg shadow-blue-500/20 ring-1 ring-[#3b82f6]/50"
                : "border-[#1e2a3a] hover:border-[#3b82f6]/40 opacity-60 hover:opacity-100"
            }`}
          >
            <img src={s.src} alt={s.label} className="w-full h-20 object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-1 left-2 right-2">
              <div className="text-white text-[9px] font-medium leading-tight truncate">{s.label}</div>
            </div>
            {i === active && (
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#3b82f6]" />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function JpmPreview({ lang }: { lang: string }) {
  const [cfg, setCfg] = useState<LandingConfig | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/landing-config?lang=${lang}`)
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => {});
  }, [lang]);

  const images = cfg?.jpm?.images ?? [];
  if (images.length === 0) return null;

  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {images.map((img, i) => (
          <div
            key={i}
            className="group relative rounded-lg overflow-hidden border border-[#1e2a3a] cursor-zoom-in hover:border-[#3b82f6]/50 transition-all"
            onClick={() => setLightbox(img.src)}
          >
            <img src={img.src} alt={img.label} className="w-full h-28 object-cover object-top group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-1 left-2 right-2">
              <div className="text-white/80 text-[9px] font-medium leading-tight">{img.label}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
