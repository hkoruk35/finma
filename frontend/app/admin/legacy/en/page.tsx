import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BOGA AI — Blue One Global Analysis",
  description: "AI-powered real-time stock analysis. Top 100 Tracker with EMA/RSI signals. Free member access.",
  alternates: { canonical: "https://bogastock.com/en" },
};

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Top 100 Tracker",
    desc: "100 carefully selected US stocks tracked hourly with real-time price, EMA 20/50/200, RSI and entry signals.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Hourly Bot Updates",
    desc: "Our automated pipeline refreshes EMA, RSI and trend signals every hour during market hours.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 5 3-3 4 6" />
      </svg>
    ),
    title: "Daily Swing Picks",
    desc: "10 fresh swing trade candidates selected daily — highlighted in blue with one-click detail panel.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Free for Members",
    desc: "Create a free account and get immediate access. Your card won't be charged during the 7-day trial.",
  },
];

const SIGNAL_BADGES = [
  { label: "STRONG", cls: "bg-green-500/15 border-green-500/50 text-green-400" },
  { label: "WEAK", cls: "bg-red-500/15 border-red-500/50 text-red-400" },
  { label: "WATCH", cls: "bg-amber-500/15 border-amber-500/50 text-amber-400" },
  { label: "WAIT", cls: "bg-white/5 border-white/15 text-white/40" },
];

const SAMPLE_ROWS = [
  { ticker: "NVDA", company: "NVIDIA Corp", price: "1,086.42", chg: "+2.34%", rsi: "62.1", signal: "STRONG", swing: true },
  { ticker: "AAPL", company: "Apple Inc.", price: "189.30", chg: "+0.87%", rsi: "54.7", signal: "WATCH", swing: false },
  { ticker: "MSFT", company: "Microsoft Corp", price: "412.50", chg: "-0.31%", rsi: "48.2", signal: "WAIT", swing: false },
  { ticker: "META", company: "Meta Platforms", price: "481.73", chg: "+1.52%", rsi: "67.4", signal: "STRONG", swing: true },
  { ticker: "TSLA", company: "Tesla Inc.", price: "248.50", chg: "-1.23%", rsi: "38.9", signal: "WEAK", swing: false },
];

const SIGNAL_STYLE: Record<string, string> = {
  STRONG: "bg-green-500/15 border-green-500/50 text-green-400",
  WEAK: "bg-red-500/15 border-red-500/50 text-red-400",
  WATCH: "bg-amber-500/15 border-amber-500/50 text-amber-400",
  WAIT: "bg-white/5 border-white/15 text-white/40",
};

export default function EnHomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">Live — Hourly Updates</span>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <Image
              src="/finmawave.png"
              alt="BOGA AI"
              width={64}
              height={64}
              className="rounded-2xl shadow-2xl shadow-blue-500/20"
            />
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
              BOGA <span className="text-[#3b82f6]">AI</span>
            </h1>
          </div>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-4">
            <span className="text-white/80 font-semibold">Blue One Global Analysis</span> — AI-powered stock tracking for US markets.
            100 stocks. Hourly signals. Free access.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <Link
              href="/en/register"
              className="px-8 py-3.5 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98]"
            >
              Create Free Account
            </Link>
            <Link
              href="/en/login"
              className="px-8 py-3.5 bg-white/5 border border-white/10 text-white/70 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-white/10 hover:text-white transition-all"
            >
              Log In
            </Link>
          </div>

          <p className="mt-4 text-xs text-white/30">Card required · Not charged during your 7-day trial</p>
        </section>

        {/* Sample table preview */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden shadow-2xl shadow-black/50">
            <div className="bg-[#111620] px-4 py-3 flex items-center justify-between border-b border-[#1e2a3a]">
              <span className="text-xs font-black text-white/70 uppercase tracking-wider">Top 100 Tracker — Preview</span>
              <div className="flex gap-2">
                {SIGNAL_BADGES.map((b) => (
                  <span key={b.label} className={`text-[9px] font-bold px-2 py-0.5 rounded border ${b.cls}`}>{b.label}</span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#0d1117] text-white/30 uppercase text-[10px] tracking-wider">
                    <th className="px-4 py-3">Ticker</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Company</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Chg %</th>
                    <th className="px-4 py-3 text-right">RSI</th>
                    <th className="px-4 py-3 text-center">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_ROWS.map((r) => (
                    <tr key={r.ticker} className={`border-t border-[#1e2a3a] ${r.swing ? "bg-blue-500/[0.05]" : "bg-[#0a0e17]"}`}>
                      <td className="px-4 py-3">
                        <span className={`font-black ${r.swing ? "text-blue-400" : "text-white"}`}>{r.ticker}</span>
                        {r.swing && (
                          <span className="ml-2 text-[8px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-bold align-middle">Daily Swing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/50 hidden sm:table-cell">{r.company}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/90">${r.price}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${r.chg.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{r.chg}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/70">{r.rsi}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${SIGNAL_STYLE[r.signal]}`}>{r.signal}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-[#0d1117] border-t border-[#1e2a3a] px-4 py-3 text-center">
              <Link href="/en/register" className="text-[#3b82f6] text-xs font-bold hover:underline">
                Create a free account to see all 100 stocks with live data →
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <h2 className="text-2xl font-black text-white tracking-tighter text-center mb-10">
            What you get with BOGA AI
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-6 hover:border-[#3b82f6]/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center mb-4 group-hover:bg-[#3b82f6]/20 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-sm font-black text-white mb-2">{f.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA bottom */}
        <section className="max-w-5xl mx-auto px-4 pb-20 text-center">
          <div className="bg-gradient-to-br from-[#3b82f6]/10 via-[#0d1117] to-[#0a0e17] border border-[#3b82f6]/20 rounded-3xl px-8 py-12">
            <h2 className="text-3xl font-black text-white tracking-tighter mb-3">Start tracking today</h2>
            <p className="text-white/40 text-sm mb-8 max-w-md mx-auto">
              Free account. Instant access. Same data as institutional traders.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/en/register"
                className="px-8 py-3.5 bg-[#3b82f6] text-white rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-[#2563eb] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all"
              >
                Create Free Account
              </Link>
              <Link
                href="/en/top100"
                className="px-8 py-3.5 bg-white/5 border border-white/10 text-white/70 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:bg-white/10 hover:text-white transition-all"
              >
                View Top 100 →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
