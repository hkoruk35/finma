import fs from "fs";
import path from "path";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hourly Scan Archive – BOGA AI",
  description: "Saatlik intraday tarama arşivi. Son 30 günün swing picks hisseleri her saat güncellenir.",
};

export const revalidate = 60;
export const dynamicParams = true;

type Signal = {
  ticker: string;
  company: string;
  sector: string;
  status: string;
  current_price: number;
  buy_zone: { low: number; high: number };
  stop_zone: { low: number; high: number };
  profit_zone: { low: number; high: number };
  status_detail: string;
  swing_pick_date: string;
  days_since_pick: number;
};

type ScanFile = {
  slot: string;
  date: string;
  hour: string;
  generated_at: string;
  market_regime: string;
  vix_level: number;
  total_scanned: number;
  signals: Signal[];
};

const STATUS_COLORS: Record<string, string> = {
  ENTRY_NOW:      "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  ENTRY_WATCH:    "text-blue-400 bg-blue-400/10 border-blue-400/30",
  STOP_ALERT:     "text-red-400 bg-red-400/10 border-red-400/30",
  STOP_HIT:       "text-red-600 bg-red-600/10 border-red-600/30",
  TAKE_PROFIT:    "text-purple-400 bg-purple-400/10 border-purple-400/30",
  HOLD:           "text-teal-400 bg-teal-400/10 border-teal-400/30",
  WAIT:           "text-slate-400 bg-slate-400/10 border-slate-400/30",
  INVALIDATED:    "text-gray-500 bg-gray-500/10 border-gray-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  ENTRY_NOW:      "Entry Now",
  ENTRY_WATCH:    "Watch",
  STOP_ALERT:     "Stop Alert",
  STOP_HIT:       "Stop Hit",
  TAKE_PROFIT:    "Take Profit",
  HOLD:           "Hold",
  WAIT:           "Wait",
  INVALIDATED:    "Invalidated",
};

function fmt(n?: number, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(dec);
}

function loadSwingUniverse(): { days: number; tickers: number } {
  const swingDir = path.join(process.cwd(), "public", "data", "swing2026");
  if (!fs.existsSync(swingDir)) return { days: 0, tickers: 0 };
  const files = fs.readdirSync(swingDir).filter(f => f.startsWith("swing_") && f.endsWith(".json"));
  const tickerSet = new Set<string>();
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(swingDir, f), "utf-8"));
      for (const p of data.picks ?? []) tickerSet.add(p.ticker);
    } catch { /* skip */ }
  }
  return { days: files.length, tickers: tickerSet.size };
}

function loadScans(): ScanFile[] {
  const histDir = path.join(process.cwd(), "public", "intraday_history");
  if (!fs.existsSync(histDir)) return [];

  const files = fs.readdirSync(histDir)
    .filter(f => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 720); // Son 30 gün × 24 saat

  return files.map(f => {
    try {
      const raw = fs.readFileSync(path.join(histDir, f), "utf-8");
      const data = JSON.parse(raw);
      const slot = f.replace(".json", "");
      const [datePart, hourPart] = slot.split("T");
      return {
        slot,
        date: datePart,
        hour: hourPart + ":00",
        generated_at: data.generated_at ?? "",
        market_regime: data.market_regime ?? "—",
        vix_level: data.vix_level ?? 0,
        total_scanned: data.total_scanned ?? 0,
        signals: data.signals ?? [],
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as ScanFile[];
}

export default function HourlyArchivePage() {
  const scans = loadScans();
  const latest = scans[0] ?? null;
  const universe = loadSwingUniverse();

  // Tarihe göre grupla
  const byDate: Record<string, ScanFile[]> = {};
  for (const scan of scans) {
    if (!byDate[scan.date]) byDate[scan.date] = [];
    byDate[scan.date].push(scan);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* Başlık */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Hourly Scan Archive</h1>
              <p className="text-gray-400 text-sm mt-1">
                Her gün 5 yeni hisse ekleniyor. Şu an{" "}
                <span className="text-white font-semibold">{universe.days} gün</span>
                {" "}×{" "}5 ={" "}
                <span className="text-blue-400 font-semibold">{universe.tickers} hisse</span>
                {" "}aktif taranıyor. Kaynak:{" "}
                <code className="text-blue-400 text-xs bg-blue-400/10 px-1.5 py-0.5 rounded">swing2026/</code>
                {" "}· Max 30 gün × 5 = 150 hisse
              </p>
            </div>
            {latest && (
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <span className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
                  <span className="text-gray-500">Regime: </span>
                  <span className={latest.market_regime === "Bull" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {latest.market_regime}
                  </span>
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
                  <span className="text-gray-500">VIX: </span>
                  <span className="text-white font-mono">{fmt(latest.vix_level, 1)}</span>
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] font-mono text-gray-400">
                  Son tarama: {latest.date} {latest.hour}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* En son tarama - büyük görünüm */}
        {latest && (
          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              Son Tarama —{" "}
              <span className="text-blue-400">{latest.date} {latest.hour}</span>
              <span className="text-gray-500 text-sm font-normal ml-2">({latest.total_scanned} hisse)</span>
            </h2>
            <div className="grid gap-2">
              {latest.signals.map(sig => {
                const statusKey = sig.status ?? "WAIT";
                const colorClass = STATUS_COLORS[statusKey] ?? STATUS_COLORS.WAIT;
                const label = STATUS_LABELS[statusKey] ?? statusKey;
                return (
                  <div key={sig.ticker} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-wrap items-center gap-4">
                    <div className="min-w-[80px]">
                      <div className="text-white font-bold text-base">{sig.ticker}</div>
                      <div className="text-gray-500 text-xs">{sig.sector ?? "—"}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>
                      {label}
                    </span>
                    <div className="text-white font-mono text-sm">${fmt(sig.current_price)}</div>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span>Buy <span className="text-white">${fmt(sig.buy_zone?.low)}–${fmt(sig.buy_zone?.high)}</span></span>
                      <span>Stop <span className="text-red-400">${fmt(sig.stop_zone?.high)}</span></span>
                      <span>Target <span className="text-emerald-400">${fmt(sig.profit_zone?.high)}</span></span>
                    </div>
                    <div className="text-gray-500 text-xs flex-1 min-w-[200px] truncate">{sig.status_detail}</div>
                    <div className="text-gray-600 text-xs whitespace-nowrap">{sig.swing_pick_date} • {sig.days_since_pick}g önce</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Arşiv - tarih bazlı */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4">Arşiv</h2>
          <div className="space-y-6">
            {Object.entries(byDate).map(([date, dayScans]) => (
              <div key={date}>
                <div className="text-sm font-semibold text-gray-400 mb-2 border-b border-[#30363d] pb-1">{date}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {dayScans.map(scan => {
                    const entryNow = scan.signals.filter(s => s.status === "ENTRY_NOW").length;
                    const stopAlert = scan.signals.filter(s => s.status === "STOP_ALERT").length;
                    return (
                      <div key={scan.slot} className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 space-y-1.5">
                        <div className="text-white font-bold text-sm">{scan.hour}</div>
                        <div className="text-gray-400 text-xs">{scan.total_scanned} hisse</div>
                        <div className="flex gap-1 flex-wrap">
                          {entryNow > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 font-bold">
                              {entryNow} Entry
                            </span>
                          )}
                          {stopAlert > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/15 text-red-400 font-bold">
                              {stopAlert} Stop
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600 text-[10px] leading-none">
                          {scan.signals.slice(0, 4).map(s => s.ticker).join(" · ")}
                          {scan.signals.length > 4 && " …"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
