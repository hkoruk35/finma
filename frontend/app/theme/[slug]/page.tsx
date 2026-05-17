import { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MARKET_THEMES } from "@/lib/themeData";
import { getStockData, getSwingPicks, getOptionsData } from "@/lib/data";

export const revalidate = 60;

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  let title = "Market Theme";
  if (params.slug === "boga-swing") title = "BOGA Swing Picks";
  else if (params.slug === "boga-options") title = "BOGA Options Picks";
  else {
    const theme = MARKET_THEMES.find(t => slugify(t.name) === params.slug);
    if (theme) title = theme.name;
  }
  return { title: `${title} | BOGA AI` };
}

function n(v: any, d = 2): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return Number(v).toFixed(d);
}

function pct(v: any, d = 2): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  const x = Number(v);
  return (x >= 0 ? "+" : "") + x.toFixed(d) + "%";
}

function formatLargeNum(num: number): string {
  if (!num) return "—";
  if (num >= 1e12) return "$" + (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return "$" + (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return "$" + (num / 1e6).toFixed(2) + "M";
  return num.toLocaleString();
}

export default async function ThemeDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  let themeName = "";
  let tickers: string[] = [];

  if (slug === "boga-swing") {
    themeName = "BOGA Swing Picks";
    const swingData = await getSwingPicks();
    if (swingData && swingData.picks) {
      tickers = swingData.picks.map((p: any) => p.ticker);
    }
  } else if (slug === "boga-options") {
    themeName = "BOGA Options Picks";
    const optData = await getOptionsData("latest");
    if (optData && optData.picks) {
      tickers = optData.picks.map((p: any) => p.ticker);
    }
  } else {
    const theme = MARKET_THEMES.find(t => slugify(t.name) === slug);
    if (theme) {
      themeName = theme.name;
      tickers = theme.tickers;
    }
  }

  if (!themeName || tickers.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
        <Header />
        <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-black text-white uppercase mt-20">Theme Not Found or Empty</h1>
          <Link href="/theme" className="text-[#3b82f6] mt-4 inline-block hover:underline">← Back to Themes</Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Fetch detailed data for all tickers in parallel
  const stocksRaw = await Promise.all(tickers.map(t => getStockData(t)));
  const stocks = stocksRaw.filter(s => s && s.ticker) as any[];

  // Sort by market cap descending if available, else by ticker name
  stocks.sort((a, b) => {
    const mcA = a.fundamental?.market_cap || 0;
    const mcB = b.fundamental?.market_cap || 0;
    if (mcA !== mcB) return mcB - mcA;
    return a.ticker.localeCompare(b.ticker);
  });

  const TH = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
    <th className={`px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap border-b border-white/10 ${right ? "text-right" : center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );

  const TD = ({ children, center, right, cls, title }: { children: React.ReactNode; center?: boolean; right?: boolean; cls?: string; title?: string }) => (
    <td title={title} className={`px-2 py-1.5 text-[11px] font-medium whitespace-nowrap border-b border-white/[0.03] ${center ? "text-center" : right ? "text-right" : "text-left"} ${cls || "text-slate-300"}`}>
      {children}
    </td>
  );

  const getCellColor = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "text-slate-500";
    if (val > 0) return "text-emerald-400 font-bold bg-emerald-500/10";
    if (val < 0) return "text-red-400 font-bold bg-red-500/10";
    return "text-slate-400";
  };

  const getRSIColor = (rsi: number | undefined) => {
    if (rsi === undefined || isNaN(rsi)) return "text-slate-500";
    if (rsi > 70) return "text-red-400 font-bold";
    if (rsi < 30) return "text-emerald-400 font-bold";
    return "text-slate-300";
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-6">
        
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
          <div className="flex items-center gap-4">
            <Link href="/theme" className="text-slate-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase italic flex items-center gap-2">
                {themeName}
              </h1>
              <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest font-bold">
                {stocks.length} Tickers
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#080c14] border border-white/10 rounded overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse leading-none">
              <thead className="bg-[#0c121d]">
                <tr>
                  <TH>TICKER</TH>
                  <TH>COMPANY</TH>
                  <TH>SECTOR</TH>
                  <TH right>PRICE</TH>
                  <TH right>MKT CAP</TH>
                  <TH right>P/E</TH>
                  <TH right>1D %</TH>
                  <TH right>1W %</TH>
                  <TH right>1M %</TH>
                  <TH right>YTD %</TH>
                  <TH right>RSI</TH>
                  <TH center>SCORE</TH>
                  <TH center>RATING</TH>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => {
                  const p = stock.price || {};
                  const f = stock.fundamental || {};
                  const t = stock.technical || {};
                  const s = stock.scores || {};
                  
                  // Safe fallback to change_pct if daily is not directly named 1d
                  const change1d = p.change_pct;
                  const change1w = p.change_pct_1w;
                  const change1m = p.change_pct_1m;
                  const changeYtd = p.change_pct_ytd || p.change_pct_1y; // approximation if ytd missing
                  
                  return (
                    <tr key={stock.ticker} className="hover:bg-white/[0.04] transition-colors group">
                      <TD cls="text-white font-black">
                        <Link href={`/stock/${stock.ticker}`} className="hover:text-[#3b82f6] transition-colors">{stock.ticker}</Link>
                      </TD>
                      <TD cls="text-slate-400 text-[10px] max-w-[150px] truncate" title={stock.company}>{stock.company}</TD>
                      <TD cls="text-slate-500 text-[9px] uppercase">{stock.sector}</TD>
                      <TD right cls="text-white font-bold">${n(p.current)}</TD>
                      <TD right cls="text-slate-400">{formatLargeNum(f.market_cap)}</TD>
                      <TD right cls="text-slate-400">{n(f.pe_ratio, 1)}</TD>
                      <TD right cls={getCellColor(change1d)}>{pct(change1d)}</TD>
                      <TD right cls={getCellColor(change1w)}>{pct(change1w)}</TD>
                      <TD right cls={getCellColor(change1m)}>{pct(change1m)}</TD>
                      <TD right cls={getCellColor(changeYtd)}>{pct(changeYtd)}</TD>
                      <TD right cls={getRSIColor(t.rsi_14)}>{n(t.rsi_14, 1)}</TD>
                      <TD center cls="font-black text-white">{n(s.master_score, 0)}</TD>
                      <TD center>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          s.score_type === 'HIGH_CONVICTION' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                          s.score_type === 'POSITIVE_BIAS' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                          s.score_type === 'NEGATIVE_BIAS' || s.score_type === 'UNDERPERFORM' ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                          'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                          {s.score_type?.replace('_', ' ') || 'NEUTRAL'}
                        </span>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
