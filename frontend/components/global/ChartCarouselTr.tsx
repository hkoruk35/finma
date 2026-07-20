"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Slide {
  id: string;
  image: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    id: "chart",
    image: "/carousel/chart-indicators.svg",
    title: "Gelişmiş Grafik Göstergeleri",
    description: "EMA, RSI, MACD, Bollinger Bantları ve daha fazlası. Gerçek zamanlı teknik analiz araçlarıyla trading stratejinizi geliştirin.",
  },
  {
    id: "swing",
    image: "/carousel/swing-strategy.svg",
    title: "Swing Trade Stratejisi",
    description: "BOGA AI'ın günlük analiz ve giriş/hedef/stop seviyeleri. Power Pullback havuzasında ve hassas risk yönetimi ile işlem yapın.",
  },
  {
    id: "mobile",
    image: "/carousel/mobile-ready.svg",
    title: "Mobil Uyumlu Deneyim",
    description: "İşte ara göstergeleri sadece bir dokunuşta açın. Hareketli cihazlarda minimum kümeleme, maksimum kontrol.",
  },
];

export default function ChartCarouselTr() {
  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const handlePrev = () => {
    setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
    setAutoPlay(false);
  };

  const handleNext = () => {
    setCurrent((prev) => (prev + 1) % SLIDES.length);
    setAutoPlay(false);
  };

  return (
    <div
      className="relative w-full mb-10 bg-gradient-to-br from-[#0d1117] to-[#0a0e17] border border-[#1e2a3a] rounded-3xl overflow-hidden"
      onMouseEnter={() => setAutoPlay(false)}
      onMouseLeave={() => setAutoPlay(true)}
    >
      {/* Carousel Container */}
      <div className="relative h-[400px] md:h-[500px] overflow-hidden">
        {/* Slides */}
        <div className="relative w-full h-full">
          {SLIDES.map((slide, idx) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                idx === current ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0d1117] via-[#030073]/5 to-[#0a0e17]">
                {/* Image Placeholder / Actual Image */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-full h-full">
                    <Image
                      src={slide.image}
                      alt={slide.title}
                      fill
                      className="object-cover opacity-90"
                      priority={idx === 0}
                      onError={() => {
                        /* Fallback: render placeholder if image fails */
                      }}
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-transparent to-transparent" />
                  </div>
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 px-6 md:px-10 py-8 md:py-12 z-10">
                  <h3 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">
                    {slide.title}
                  </h3>
                  <p className="text-sm md:text-base text-white/70 leading-relaxed max-w-2xl">
                    {slide.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <button
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur"
          aria-label="Önceki"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur"
          aria-label="Sonraki"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Dots Indicator */}
      <div className="flex items-center justify-center gap-2 px-6 py-4 bg-[#0a0e17]/50 backdrop-blur">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setCurrent(idx);
              setAutoPlay(false);
            }}
            className={`h-2 rounded-full transition-all ${
              idx === current
                ? "bg-[#3b82f6] w-8"
                : "bg-white/20 w-2 hover:bg-white/40"
            }`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Slide Counter */}
      <div className="absolute top-4 right-4 z-20 px-3 py-1.5 bg-black/40 backdrop-blur rounded-full text-white/70 text-xs font-semibold">
        {current + 1} / {SLIDES.length}
      </div>
    </div>
  );
}
