/**
 * Liste yuzeylerindeki "son guncelleme" damgasi icin ortak yardimcilar.
 *
 * SORUN (2026-08-10): Tum tracker/liste bilesenleri `setLastUpdated(new Date())`
 * kullaniyordu — yani verinin URETILDIGI an degil, TARAYICININ veriyi cektigi an
 * gosteriliyordu. Ustelik yaninda sabit "ET" yaziyor ama `toLocaleTimeString`
 * tarayicinin saat dilimini kullaniyordu: Istanbul'daki bir uye 17:05'lik veriyi
 * "01:47 ET" olarak goruyordu.
 *
 * COZUM: zaman damgasi her zaman SUNUCUDAN gelen alandan alinir
 * (`/api/top100` -> lastUpdated, `/api/watchlist-data` satirlari -> generated_at)
 * ve daima America/New_York'ta bicimlendirilir.
 */

const LOCALE_TAGS: Record<string, string> = {
  tr: "tr-TR",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-BR",
};

const ET_TIME_ZONE = "America/New_York";

function localeTag(locale?: string): string {
  return LOCALE_TAGS[locale ?? "en"] ?? "en-US";
}

/** Bir tarihin New York'taki takvim gunu ("2026-08-10"). */
function etDateKey(date: Date): string {
  // en-CA -> YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Satir listesinden verinin gercek uretim zamanini secer (en yeni `generated_at`).
 * Hicbir satirda gecerli damga yoksa null doner — cagiran taraf etiketi gizler,
 * tarayici saatine DUSMEZ.
 */
export function latestGeneratedAt(rows: unknown): string | null {
  if (!Array.isArray(rows)) return null;
  let newest = 0;
  for (const row of rows) {
    const raw = (row as { generated_at?: unknown } | null)?.generated_at;
    if (typeof raw !== "string") continue;
    const ms = Date.parse(raw);
    if (Number.isFinite(ms) && ms > newest) newest = ms;
  }
  return newest > 0 ? new Date(newest).toISOString() : null;
}

/**
 * "17:05 ET" (veri bugunse) veya "10 Ağu 17:05 ET" (onceki bir gune aitse).
 * Gun degistiginde tarihin gorunmesi onemli: piyasa kapaliyken liste bir onceki
 * seansin verisini tasiyor ve saat tek basina bunu gizliyor.
 */
export function formatUpdatedAtET(
  iso: string | null | undefined,
  locale?: string,
  options?: { withSeconds?: boolean },
): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;

  const date = new Date(ms);
  const tag = localeTag(locale);

  const time = new Intl.DateTimeFormat(tag, {
    timeZone: ET_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...(options?.withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(date);

  const isToday = etDateKey(date) === etDateKey(new Date());
  if (isToday) return `${time} ET`;

  const day = new Intl.DateTimeFormat(tag, {
    timeZone: ET_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(date);

  return `${day} ${time} ET`;
}
