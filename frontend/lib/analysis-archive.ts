import path from "path";
import fs from "fs";

const ARCHIVE_BASE = path.join(process.cwd(), "public", "analysis-archive");

/** Returns sorted list of archived dates (newest first) for a ticker */
export function getArchivedDates(ticker: string): string[] {
  const dir = path.join(ARCHIVE_BASE, ticker.toUpperCase());
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort((a, b) => b.localeCompare(a));
}

/** Returns the full pick data for a specific archived date */
export function getArchivedAnalysis(ticker: string, date: string): any | null {
  const file = path.join(ARCHIVE_BASE, ticker.toUpperCase(), `${date}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

/** Returns all tickers that have at least one archived entry */
export function getAllArchivedTickers(): string[] {
  if (!fs.existsSync(ARCHIVE_BASE)) return [];
  return fs.readdirSync(ARCHIVE_BASE).filter((d) =>
    fs.statSync(path.join(ARCHIVE_BASE, d)).isDirectory()
  );
}
