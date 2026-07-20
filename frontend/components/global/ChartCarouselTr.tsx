"use client";

import { useState, useEffect } from "react";

interface Slide {
  id: string;
  image: string;
  title: string;
}

const SLIDES: Slide[] = [
  {
    id: "chart",
    image: "/carousel/chart-indicators.png",
    title: "Gelişmiş Grafik Göstergeleri",
  },
  {
    id: "swing",
    image: "/carousel/swing-strategy.png",
    title: "Swing Trade Stratejisi",
  },
  {
    id: "mobile",
    image: "/carousel/mobile-ready.png",
    title: "Mobil Uyumlu Deneyim",
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
      className="relative w-full mb-10 bg-[#0d1117] border border-[#1e2a3a] rounded-3xl overflow-hidden"
      onMouseEnter={() => setAutoPlay(false)}
      onMouseLeave={() => setAutoPlay(true)}
    >
      {/* Carousel Container */}
      <div className="relative h-[350px] md:h-[450px] overflow-hidden">
        {/* Slides */}
        <div className="relative w-full h-full">
          {SLIDES.map((slide, idx) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                idx === current ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* Image */}
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover"
              />

              {/* Title Overlay at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/50 to-transparent px-6 md:px-10 py-6 md:py-8 z-10">
                <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  {slide.title}
                </h3>
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
