// X Studio "Tekrarlanan Programlama" — bir ticker/varlık için periyodik
// (her N saatte bir) veya haftalık (belirli NY gün+saat) otomatik gönderi
// zamanlaması. cron/x-recurring-schedules bu tabloyu tarar, zamanı gelmiş
// satırları AI ile taze metin üretip yayınlar, sonra next_run_at'i ileri alır.

const NY_TZ = "America/New_York";

function nyDateStr(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// "YYYY-MM-DD" + "HH:mm" NY duvar saatini UTC ISO'ya cevirir — timezone.ts'teki
// nyWallTimeToUtcIso ile ayni algoritma (kucuk, bagimsiz kopya — dongusel
// import'tan kacinmak icin).
function nyWallTimeToUtcIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const seenAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") === 24 ? 0 : get("hour"), get("minute"));
  const offsetMs = seenAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs).toISOString();
}

// Verilen "YYYY-MM-DD" tarihinin haftanin hangi gunu oldugu (0=Pazar..6=Cumartesi).
// Ogle UTC kullanmak (T12:00:00Z) DST/timezone kaymasindan etkilenmeden
// sadece takvim gununu okumayi saglar.
function weekdayOfDateStr(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function computeNextIntervalRunIso(intervalHours: number, from = new Date()): string {
  return new Date(from.getTime() + intervalHours * 60 * 60 * 1000).toISOString();
}

// weekday: 0=Pazar..6=Cumartesi, timeStr: "HH:mm" (NY duvar saati).
// `from`dan sonraki ilk eslesen gun+saati bulur (bugun ise ve saat gecmediyse
// bugunu, aksi halde bir sonraki haftayi kullanir).
export function computeNextWeeklyRunIso(weekday: number, timeStr: string, from = new Date()): string {
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = nyDateStr(candidate);
    if (weekdayOfDateStr(dateStr) !== weekday) continue;
    const iso = nyWallTimeToUtcIso(dateStr, timeStr);
    if (new Date(iso).getTime() > from.getTime()) return iso;
  }
  // Pratikte hicbir zaman ulasilmaz (8 gunluk pencerede ayni gun en az bir kez gecer).
  return nyWallTimeToUtcIso(nyDateStr(from), timeStr);
}

export const WEEKDAY_LABELS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
