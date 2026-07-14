import { copy, type Locale } from "@/lib/i18n/copy";

export function translateEMAStatus(status: string | null | undefined, locale: Locale): string {
  if (!status) return "—";
  return (copy[locale].top100.emaStatus as Record<string, string>)[status] ?? status;
}

export function translatePattern(pattern: string | null | undefined, locale: Locale): string {
  if (!pattern) return "—";
  return (copy[locale].top100.patterns as Record<string, string>)[pattern] ?? pattern;
}

export function translateSignal(signal: string | null | undefined, locale: Locale): string {
  if (!signal) return "—";
  const signalMap: Record<string, Record<string, string>> = {
    en: { BUY: "BUY", WATCH: "WATCH", HOLD: "HOLD", SELL: "SELL" },
    tr: { BUY: "AL", WATCH: "İZLE", HOLD: "BEKLE", SELL: "SAT" },
    es: { BUY: "COMPRAR", WATCH: "VIGILAR", HOLD: "MANTENER", SELL: "VENDER" },
    fr: { BUY: "ACHETER", WATCH: "SURVEILLER", HOLD: "CONSERVER", SELL: "VENDRE" },
    pt: { BUY: "COMPRAR", WATCH: "OBSERVAR", HOLD: "MANTER", SELL: "VENDER" },
  };
  return (signalMap[locale] ?? signalMap.en)[signal] ?? signal;
}

export function translateSector(sector: string | null | undefined, locale: Locale): string {
  if (!sector) return "—";
  return (copy[locale].top100.sectors as Record<string, string>)[sector] ?? sector;
}
