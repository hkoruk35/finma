"use client";
import { useState } from "react";

const SCREENSHOT_GALLERY = [
  { src: "/screenshots/ss_trend.jpg", label: "2026 Trend Hisseleri", desc: "Tema bazlı hisse takibi ve sinyaller" },
  { src: "/screenshots/ss_swing.jpg", label: "Günlük Swing Adayları", desc: "Günlük ısı haritası ve aday listesi" },
  { src: "/screenshots/ss_perf.jpg", label: "Sistem Performansı", desc: "Geçmiş işlem başarı istatistikleri" },
  { src: "/screenshots/ss_top100.jpg", label: "Top 100 Tracker", desc: "Saatlik güncellenen hisse takip listesi" },
];

const JPM_IMAGES = [
  { src: "/jpm/p1_Image27.jpg", label: "JPM — Piyasa Görünümü" },
  { src: "/jpm/p1_Image20.jpg", label: "JPM — Sektör Analizi" },
  { src: "/jpm/p2_Image1.jpg", label: "JPM — Makro Göstergeler" },
  { src: "/jpm/p3_Image1.jpg", label: "JPM — Yatırım Stratejisi" },
];

export function ScreenshotBanner() {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-[95vw] max-h-[90vh] rounded-xl shadow-2xl object-contain" />
          <button
            className="absolute top-4 right-6 text-white/60 hover:text-white text-3xl font-light"
            onClick={() => setLightbox(null)}
          >✕</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {SCREENSHOT_GALLERY.map((item, i) => (
          <div
            key={i}
            className="group relative rounded-xl overflow-hidden border border-[#1e2a3a] cursor-zoom-in hover:border-[#3b82f6]/50 transition-all shadow-2xl shadow-black/50"
            onClick={() => setLightbox(item.src)}
          >
            <img
              src={item.src}
              alt={item.label}
              className="w-full h-48 object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="text-white font-black text-sm">{item.label}</div>
              <div className="text-white/50 text-[11px]">{item.desc}</div>
            </div>
            <div className="absolute top-2 right-2 bg-black/60 text-white/70 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Büyüt
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function JpmPreview() {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-[95vw] max-h-[90vh] rounded-xl shadow-2xl object-contain" />
          <button
            className="absolute top-4 right-6 text-white/60 hover:text-white text-3xl font-light"
            onClick={() => setLightbox(null)}
          >✕</button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {JPM_IMAGES.map((img, i) => (
          <div
            key={i}
            className="group relative rounded-lg overflow-hidden border border-[#1e2a3a] cursor-zoom-in hover:border-[#3b82f6]/50 transition-all"
            onClick={() => setLightbox(img.src)}
          >
            <img
              src={img.src}
              alt={img.label}
              className="w-full h-28 object-cover object-top group-hover:scale-105 transition-transform duration-500"
            />
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
