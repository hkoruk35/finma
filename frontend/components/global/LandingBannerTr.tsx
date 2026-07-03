"use client";
import { useState, useEffect } from "react";
import type { LandingConfig } from "@/lib/landingConfig";

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center cursor-zoom-out" onClick={onClose}>
      <img src={src} alt="" className="max-w-[95vw] max-h-[90vh] rounded-xl shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
      <button className="absolute top-4 right-6 text-white/60 hover:text-white text-3xl font-light leading-none" onClick={onClose}>✕</button>
    </div>
  );
}

export function ScreenshotBanner({ lang }: { lang: string }) {
  const [cfg, setCfg] = useState<LandingConfig | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/landing-config?lang=${lang}`)
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => {});
  }, [lang]);

  const screenshots = cfg?.screenshots ?? [];
  if (screenshots.length === 0) return null;

  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div className="grid grid-cols-2 gap-3">
        {screenshots.map((item, i) => (
          <div
            key={i}
            className="group relative rounded-xl overflow-hidden border border-[#1e2a3a] cursor-zoom-in hover:border-[#3b82f6]/50 transition-all shadow-2xl shadow-black/50"
            onClick={() => setLightbox(item.src)}
          >
            <img src={item.src} alt={item.label} className="w-full h-48 object-cover object-top group-hover:scale-[1.03] transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="text-white font-black text-sm">{item.label}</div>
              <div className="text-white/50 text-[11px]">{item.desc}</div>
            </div>
            <div className="absolute top-2 right-2 bg-black/60 text-white/70 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              ⊕
            </div>
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
              <div className="text-white/80 text-[9px] font-bold leading-tight">{img.label}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
