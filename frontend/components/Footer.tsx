import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-[#1e2a3a] bg-[#0a0e17] mt-12">

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-8 h-8">
                <Image
                  src="/finmawave.png"
                  alt="BOGA AI - Blue One Global Analysis"
                  width={32}
                  height={32}
                  loading="lazy"
                  className="object-contain rounded-lg"
                />
              </div>
              <span className="text-base font-black text-white tracking-tighter">BOGA AI - Blue One Global<br/>Analysis</span>
            </div>
            <p className="text-xs text-[#00d2ff]">
              AI-powered stock analysis of +500 top US stocks.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Platform</h4>
            <div className="flex flex-col gap-2">
              <Link href="/swing" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Top Swing Picks</Link>
              <Link href="/performance" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Performance</Link>
              <Link href="/terminal" className="text-xs text-[#3b82f6] hover:text-white transition-colors font-bold">Institutional Terminal</Link>
              <Link href="/academy" className="text-xs text-[#3b82f6] hover:text-white transition-colors">🎓 Academy</Link>
              <Link href="/archive" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Archive</Link>
              <Link href="/smart-tracker" className="text-xs text-[#10b981] hover:text-white transition-colors font-bold">🚀 Smart Tracker</Link>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
            <div className="flex flex-col gap-2">
              <Link href="/about" className="text-xs text-[#00d2ff] hover:text-white transition-colors">About BOGA AI</Link>
              <Link href="/contact" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Contact Support</Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Legal</h4>
            <div className="flex flex-col gap-1.5">
              <Link href="/disclaimer" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Disclaimer</Link>
              <Link href="/terms" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-[#1e2a3a] mt-8 pt-4 text-center">
          <p className="text-xs text-[#00d2ff]">
            &copy; 2026 BOGA AI - Blue One Global Analysis. Developed by AFK DaSYS.
          </p>
        </div>
      </div>
    </footer>
  );
}
