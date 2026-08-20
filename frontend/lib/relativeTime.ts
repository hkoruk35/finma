import type { Locale } from "@/lib/i18n/copy";

// "11 dk önce" / "11m ago" gibi kısa, global-anlaşılır bir bağıl zaman +
// yanında yerel saat. bkz. components/global/LiveAssetTable.tsx üst özet
// çubuğu — 2026-08-20 kullanıcı talebi: "daha global bir ifade ve yanında
// yerel saat/tarih gibi".

interface RelativeUnits {
  s: string;
  m: string;
  h: string;
  now: string;
}

const UNITS: Record<Locale, RelativeUnits> = {
  en: { s: "s", m: "m", h: "h", now: "just now" },
  tr: { s: "sn", m: "dk", h: "sa", now: "az önce" },
  es: { s: "s", m: "min", h: "h", now: "ahora mismo" },
  fr: { s: "s", m: "min", h: "h", now: "à l'instant" },
  pt: { s: "s", m: "min", h: "h", now: "agora mesmo" },
  id: { s: "dtk", m: "mnt", h: "jam", now: "baru saja" },
};

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US", tr: "tr-TR", es: "es-ES", fr: "fr-FR", pt: "pt-PT", id: "id-ID",
};

export interface RelativeUpdateLabel {
  /** "11dk" / "11m" — güncelleme zamanının kısa bağıl gösterimi. */
  relative: string;
  /** "14:32" — ziyaretçinin kendi yerel saatiyle. */
  clock: string;
}

export function formatRelativeUpdate(updatedAtMs: number | null, locale: Locale): RelativeUpdateLabel {
  const u = UNITS[locale] ?? UNITS.en;
  if (!updatedAtMs) return { relative: u.now, clock: "" };

  const diffSec = Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000));
  let relative: string;
  if (diffSec < 10) relative = u.now;
  else if (diffSec < 60) relative = `${diffSec}${u.s}`;
  else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}${u.m}`;
  else relative = `${Math.floor(diffSec / 3600)}${u.h}`;

  const clock = new Date(updatedAtMs).toLocaleTimeString(INTL_LOCALE[locale] ?? "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return { relative, clock };
}
