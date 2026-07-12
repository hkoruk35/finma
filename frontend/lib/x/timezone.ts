// NY (America/New_York) duvar saati <-> UTC donusumleri icin kutuphanesiz
// yardimcilar (proje date-fns-tz/luxon kullanmiyor; MarketStatus.tsx da ayni
// sekilde ciplak Intl.DateTimeFormat kullaniyor).

const NY_TZ = "America/New_York";

function nyPartsOf(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
  };
}

// "YYYY-MM-DD" + "HH:mm" NY duvar saatini UTC ISO string'e cevirir.
// Teknik: naif UTC tahmini yap, o anin NY saatine gore gorunumunu olc,
// istenenle farkini (ofset) tahminden cikar — DST'ye duyarli.
export function nyWallTimeToUtcIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const seen = nyPartsOf(guess);
  const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
  const offsetMs = seenAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs).toISOString();
}

export function utcIsoToNyDisplay(iso: string): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: NY_TZ,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso)) + " NY"
  );
}

function nyDateStrOf(date: Date): string {
  const p = nyPartsOf(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function nyTodayDateStr(): string {
  return nyDateStrOf(new Date());
}

export function nyMaxDateStr(daysAhead = 30): string {
  return nyDateStrOf(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
}
