import { copy, type Locale } from "@/lib/i18n/copy";

export function translateEMAStatus(status: string | null | undefined, locale: Locale): string {
  if (!status) return "—";
  return (copy[locale].top100.emaStatus as Record<string, string>)[status] ?? status;
}

export function translatePattern(pattern: string | null | undefined, locale: Locale): string {
  if (!pattern) return "—";
  return (copy[locale].top100.patterns as Record<string, string>)[pattern] ?? pattern;
}

// Not: BUY/SELL (AL/SAT vb.) hiçbir listede kullanılmaz — bir yatırım
// tavsiyesi gibi okunur. Motor artık bunun yerine STRONG/WEAK döner.
export function translateSignal(signal: string | null | undefined, locale: Locale): string {
  if (!signal) return "—";
  const signalMap: Record<string, Record<string, string>> = {
    en: { STRONG: "STRONG", WATCH: "WATCH", HOLD: "HOLD", WEAK: "WEAK" },
    tr: { STRONG: "GÜÇLÜ", WATCH: "İZLE", HOLD: "BEKLE", WEAK: "ZAYIF" },
    es: { STRONG: "FUERTE", WATCH: "VIGILAR", HOLD: "MANTENER", WEAK: "DÉBIL" },
    fr: { STRONG: "FORT", WATCH: "SURVEILLER", HOLD: "CONSERVER", WEAK: "FAIBLE" },
    pt: { STRONG: "FORTE", WATCH: "OBSERVAR", HOLD: "MANTER", WEAK: "FRACO" },
    id: { STRONG: "KUAT", WATCH: "PANTAU", HOLD: "PERTAHANKAN", WEAK: "LEMAH" },
  };
  return (signalMap[locale] ?? signalMap.en)[signal] ?? signal;
}

export function translateSector(sector: string | null | undefined, locale: Locale): string {
  if (!sector) return "—";
  return (copy[locale].top100.sectors as Record<string, string>)[sector] ?? sector;
}
