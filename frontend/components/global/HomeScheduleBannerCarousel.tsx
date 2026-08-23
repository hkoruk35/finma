"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

export interface ScheduleCarouselItem {
  key: string; // index_symbol
  name: string;
  slug: string;
  updatedAt: string; // ISO created_at
}

interface Labels {
  badge: string;
  updated: string;
  viewAnalysis: string;
}

const ROTATE_MS = 5000;
const LANG_MAP: Record<Locale, string> = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-PT", tr: "tr-TR", id: "id-ID" };

// 2026-08-23 kullanıcı talebi: "zemin Parlak mavi, yazılar Beyaz olsun
// dikkat çekmesi için ama ana tasarım sistemini de bozmasın." — sitenin
// zaten kullandığı mavi vurgu rengi (#3b82f6) dolgu olarak kullanıldı,
// köşe yuvarlaklığı/boşluk/gölge dili diğer kartlarla (bkz.
// HomeIndexHighlights.tsx, HomeFeaturedTrendCard.tsx) aynı kaldı — sadece
// zemin/metin renkleri tersine çevrildi (koyu kart yerine mavi dolgu).
export default function HomeScheduleBannerCarousel({
  locale,
  items,
  labels,
}: {
  locale: Locale;
  items: ScheduleCarouselItem[];
  labels: Labels;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const interval = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(interval);
  }, [items.length]);

  const item = items[index % items.length];
  const timeStr = new Intl.DateTimeFormat(LANG_MAP[locale] ?? "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(item.updatedAt));

  return (
    <div className="bg-[#3b82f6] rounded-xl mb-4 shadow-lg shadow-blue-500/20 overflow-hidden">
      <Link
        href={`/global/${locale}/${item.slug}`}
        className="group flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 hover:bg-white/10 transition-colors duration-300"
      >
        <div className="flex items-center gap-3 w-full md:w-auto min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          <div className="flex flex-col md:flex-row md:items-center md:gap-2 min-w-0">
            <span className="text-[10px] font-bold text-white/80 tracking-wide shrink-0">{labels.badge}</span>
            <p className="text-sm font-semibold text-white truncate">
              {item.name}
              <span className="text-white/75 font-normal ml-1.5 whitespace-nowrap">
                — {labels.updated}: {timeStr}
              </span>
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center text-xs font-bold text-[#3b82f6] bg-white px-4 py-1.5 rounded-lg group-hover:bg-white/90 transition-colors whitespace-nowrap shrink-0">
          {labels.viewAnalysis} <span className="ml-1.5">→</span>
        </div>
      </Link>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-2.5">
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              aria-label={it.name}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
