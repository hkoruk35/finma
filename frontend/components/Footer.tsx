import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[#1e2a3a] bg-[#0a0e17] mt-12">
      {/* Disclaimer */}
      <div className="bg-[#141924] border-b border-[#1e2a3a] px-4 py-3">
        <p className="max-w-5xl mx-auto text-xs text-[#64748b] text-center">
          <strong className="text-[#94a3b8]">Disclaimer:</strong> FinMA is for informational purposes only.
          Not financial advice. AI signals are experimental. Trading involves risk of loss.
          Past performance is not indicative of future results.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-8 h-8">
                <img src="/finmaicon1.png" alt="FinMA" className="w-full h-full object-contain rounded-lg" />
              </div>
              <span className="text-base font-black text-white tracking-tighter">FinMA Daily 100</span>
            </div>
            <p className="text-xs text-[#64748b]">
              AI-powered daily analysis of 100 top US stocks.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-sm font-semibold text-[#94a3b8] mb-3">Categories</h4>
            <div className="flex flex-col gap-1.5">
              <Link href="/category/top-signals" className="text-xs text-[#64748b] hover:text-white transition-colors">Top Signals</Link>
              <Link href="/category/breakout" className="text-xs text-[#64748b] hover:text-white transition-colors">Breakout</Link>
              <Link href="/category/undervalued" className="text-xs text-[#64748b] hover:text-white transition-colors">Undervalued</Link>
              <Link href="/category/momentum" className="text-xs text-[#64748b] hover:text-white transition-colors">Momentum</Link>
              <Link href="/category/reversal" className="text-xs text-[#64748b] hover:text-white transition-colors">Reversal</Link>
              <Link href="/category/dividend" className="text-xs text-[#64748b] hover:text-white transition-colors">Dividend</Link>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-[#94a3b8] mb-3">Resources</h4>
            <div className="flex flex-col gap-1.5">
              <Link href="/about" className="text-xs text-[#64748b] hover:text-white transition-colors">About FinMA</Link>
              <Link href="/archive" className="text-xs text-[#64748b] hover:text-white transition-colors">Archive</Link>
              <Link href="/contact" className="text-xs text-[#64748b] hover:text-white transition-colors">Contact</Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-[#94a3b8] mb-3">Legal</h4>
            <div className="flex flex-col gap-1.5">
              <Link href="/disclaimer" className="text-xs text-[#64748b] hover:text-white transition-colors">Disclaimer</Link>
              <Link href="/terms" className="text-xs text-[#64748b] hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="text-xs text-[#64748b] hover:text-white transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-[#1e2a3a] mt-8 pt-4 text-center">
          <p className="text-xs text-[#64748b]">
            &copy; 2026 FinMA Daily 100. Developed by AFK DaSYS New YORK /USA.
          </p>
        </div>
      </div>
    </footer>
  );
}
