// Swing ve Daily sayfalarından ticker'ları CSP formatına dönüştüren data source

export interface CspTicker {
  ticker: string;
  types: Record<string, string>; // ticker -> type mapping
  notes: Record<string, string>; // ticker -> notes mapping
}

/**
 * Swing verilerinden ticket listesi çeker ve CSP formatına dönüştürür
 */
export async function getSwingTickersAsCsp(): Promise<string[]> {
  try {
    const res = await fetch("/swing_all_picks.json?v=" + Date.now(), {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const picks = data.picks ?? [];
    return picks.map((p: any) => p.ticker).filter((t: string) => t);
  } catch (err) {
    console.error("[SwingCSP] fetch error:", err);
    return [];
  }
}

/**
 * Daily verilerinden ticket listesi çeker ve CSP formatına dönüştürür
 */
export async function getDailyTickersAsCsp(): Promise<string[]> {
  try {
    const res = await fetch("/api/daily?date=today&v=" + Date.now(), {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tickers = data.tickers ?? [];
    return tickers
      .map((t: any) => t.ticker)
      .filter((ticker: string) => ticker);
  } catch (err) {
    console.error("[DailyCSP] fetch error:", err);
    return [];
  }
}

/**
 * Swing arşivi listesini tarihler ile döndür
 */
export async function getSwingArchiveDates(): Promise<string[]> {
  try {
    const res = await fetch("/api/data/swing2026", { cache: "no-store" });
    if (!res.ok) return [];
    const files = await res.json();
    // Files should be in format: swing_YYYYMMDD.json
    return files
      .map((f: string) => {
        const m = f.match(/swing_(\d{4})(\d{2})(\d{2})/);
        if (!m) return null;
        return `${m[1]}-${m[2]}-${m[3]}`;
      })
      .filter((d: string | null) => d)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Daily arşivi listesini tarihler ile döndür
 */
export async function getDailyArchiveDates(): Promise<string[]> {
  try {
    const res = await fetch("/api/data/intraday_history", { cache: "no-store" });
    if (!res.ok) return [];
    const files = await res.json();
    // Extract unique dates from files like: 2026-06-11T10.json
    const dates = new Set<string>();
    files.forEach((f: string) => {
      const m = f.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) dates.add(m[1]);
    });
    return Array.from(dates).sort().reverse();
  } catch {
    return [];
  }
}

/**
 * Tarihli Swing verilerinden ticket listesi
 */
export async function getSwingTickersForDate(date: string): Promise<string[]> {
  try {
    const cleanDate = date.replace(/-/g, "");
    const res = await fetch(`/data/swing2026/swing_${cleanDate}.json?v=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const picks = data.picks ?? [];
    return picks.map((p: any) => p.ticker).filter((t: string) => t);
  } catch {
    return [];
  }
}

/**
 * Tarihli Daily verilerinden ticket listesi
 */
export async function getDailyTickersForDate(date: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/daily?date=${date}&v=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tickers = data.tickers ?? [];
    return tickers
      .map((t: any) => t.ticker)
      .filter((ticker: string) => ticker);
  } catch {
    return [];
  }
}
