"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import type { IndexDefinition } from "@/lib/indices";
import { formatNumber } from "@/lib/formatNumber";

export interface ScheduleCarouselItem {
  key: string; // index_symbol
  name: string;
  slug: string;
  region: IndexDefinition["region"];
  updatedAt: string; // ISO created_at
  changePct: number | null;
}

interface Labels {
  badge: string;
  updated: string;
  viewAnalysis: string;
}

const ROTATE_MS = 5000;
const LANG_MAP: Record<Locale, string> = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-PT", tr: "tr-TR", id: "id-ID" };

// 2026-08-23 kullanıcı geri bildirimi: "Hangi ülke hangi endeks anlaşılmıyor.
// Ayrıca endeksin yönü bir cümle ile bu duyuru da yazmalı." — sadece endeks
// adı ve saat yetersizdi. Aşağıya bölge etiketi ("ABD", "Avrupa"...) ve
// yön/yüzde içeren tam bir cümle eklendi (bkz. buildSentence).
const REGION_LABELS: Record<Locale, Record<IndexDefinition["region"], string>> = {
  tr: { us: "ABD", europe: "Avrupa", asia: "Asya", latam: "Latin Amerika" },
  en: { us: "US", europe: "Europe", asia: "Asia", latam: "Latin America" },
  es: { us: "EE. UU.", europe: "Europa", asia: "Asia", latam: "Latinoamérica" },
  fr: { us: "États-Unis", europe: "Europe", asia: "Asie", latam: "Amérique Latine" },
  pt: { us: "EUA", europe: "Europa", asia: "Ásia", latam: "América Latina" },
  id: { us: "AS", europe: "Eropa", asia: "Asia", latam: "Amerika Latin" },
};

// {name} ve {pct} yer tutucularıyla yön cümlesi — pozitif/negatif/nötr.
const DIRECTION_SENTENCE: Record<Locale, { up: string; down: string; flat: string }> = {
  tr: {
    up: "{name} bugün %{pct} yükselişte.",
    down: "{name} bugün %{pct} düşüşte.",
    flat: "{name} bugün yatay seyrediyor.",
  },
  en: {
    up: "{name} is up {pct}% today.",
    down: "{name} is down {pct}% today.",
    flat: "{name} is flat today.",
  },
  es: {
    up: "{name} sube un {pct}% hoy.",
    down: "{name} baja un {pct}% hoy.",
    flat: "{name} se mantiene estable hoy.",
  },
  fr: {
    up: "{name} est en hausse de {pct}% aujourd'hui.",
    down: "{name} est en baisse de {pct}% aujourd'hui.",
    flat: "{name} est stable aujourd'hui.",
  },
  pt: {
    up: "{name} sobe {pct}% hoje.",
    down: "{name} cai {pct}% hoje.",
    flat: "{name} está estável hoje.",
  },
  id: {
    up: "{name} naik {pct}% hari ini.",
    down: "{name} turun {pct}% hari ini.",
    flat: "{name} bergerak datar hari ini.",
  },
};

function buildSentence(locale: Locale, name: string, changePct: number | null): string {
  const t = DIRECTION_SENTENCE[locale] ?? DIRECTION_SENTENCE.en;
  if (changePct == null || Math.abs(changePct) < 0.005) {
    return t.flat.replace("{name}", name);
  }
  const template = changePct >= 0 ? t.up : t.down;
  return template.replace("{name}", name).replace("{pct}", formatNumber(Math.abs(changePct), 2));
}

// 2026-08-23 kullanıcı talebi: "zemin Parlak mavi, yazılar Beyaz olsun
// dikkat çekmesi için ama ana tasarım sistemini de bozmasın." — beyaz metin
// silik kaldığı için (kullanıcı geri bildirimi) koyu lacivert/mavi
// (#0f1a2e) metne çevrildi; zemin aynı parlak mavi (#3b82f6) kaldı, sadece
// metin kontrastı arttı.
const TEXT_DARK = "#0f1a2e";

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
  const regionLabel = (REGION_LABELS[locale] ?? REGION_LABELS.en)[item.region];
  const sentence = buildSentence(locale, item.name, item.changePct);
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
        className="group flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 hover:bg-black/5 transition-colors duration-300"
      >
        <div className="flex items-start gap-3 w-full md:w-auto min-w-0">
          <span className="relative flex h-3 w-3 shrink-0 mt-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-wide shrink-0" style={{ color: TEXT_DARK, opacity: 0.75 }}>
                {labels.badge}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ color: TEXT_DARK, backgroundColor: "rgba(15,26,46,0.12)" }}
              >
                {regionLabel}
              </span>
              <span className="text-sm font-bold truncate" style={{ color: TEXT_DARK }}>
                {item.name}
              </span>
            </div>
            <p className="text-[13px] font-semibold leading-snug mt-0.5" style={{ color: TEXT_DARK }}>
              {sentence}{" "}
              <span className="font-medium whitespace-nowrap" style={{ color: TEXT_DARK, opacity: 0.7 }}>
                {labels.updated}: {timeStr}
              </span>
            </p>
          </div>
        </div>

        <div
          className="hidden md:flex items-center text-xs font-bold px-4 py-1.5 rounded-lg group-hover:bg-white/90 transition-colors whitespace-nowrap shrink-0 bg-white"
          style={{ color: TEXT_DARK }}
        >
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
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? "1.25rem" : "0.375rem",
                backgroundColor: i === index ? TEXT_DARK : "rgba(15,26,46,0.35)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
