import Link from "next/link";
import Image from "next/image";

const DISCLAIMER: Record<"en" | "tr", string> = {
  en: "This page does not constitute investment advice. Content here is for informational and analytical purposes only. Data may be delayed and is not guaranteed to be accurate, complete, or current. Past performance does not indicate future results. Always do your own research before making any investment decision.",
  tr: "Bu sayfa yatırım tavsiyesi niteliği taşımaz. Buradaki içerik yalnızca bilgilendirme ve analiz amaçlıdır. Veriler gecikmeli olarak ulaşabilir; doğruluğu, eksiksizliği veya güncelliği garanti edilmez. Geçmiş performans gelecekteki sonuçların göstergesi değildir. Herhangi bir yatırım kararı vermeden önce kendi araştırmanızı yapın.",
};

const LEGAL_LINKS: Record<"en" | "tr", { href: string; label: string }[]> = {
  en: [
    { href: "/global/en/disclaimer", label: "Disclaimer" },
    { href: "/global/en/terms", label: "Terms of Service" },
    { href: "/global/en/privacy", label: "Privacy Policy" },
  ],
  tr: [
    { href: "/global/tr/disclaimer", label: "Sorumluluk Reddi" },
    { href: "/global/tr/terms", label: "Kullanım Şartları" },
    { href: "/global/tr/privacy", label: "Gizlilik Politikası" },
  ],
};

const RESOURCES_LINKS: Record<"en" | "tr", { href: string; label: string }[]> = {
  en: [
    { href: "/global/en/about", label: "About BOGA AI" },
    { href: "/global/en/contact", label: "Contact Support" },
  ],
  tr: [
    { href: "/global/tr/about", label: "BOGA AI Hakkında" },
    { href: "/global/tr/contact", label: "Destek İletişim" },
  ],
};

const BRAND_TAGLINE: Record<"en" | "tr", string> = {
  en: "AI-powered analysis of 6,000+ premier US stocks and ETFs.",
  tr: "ABD borsalarında işlem gören 6.000'den fazla seçkin hisse senedi ve ETF'in yapay zekâ destekli analizi.",
};

export default function Footer({
  hidePlatform = false,
  locale,
}: {
  hidePlatform?: boolean;
  locale?: "en" | "tr";
}) {
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
              {BRAND_TAGLINE[locale === "tr" ? "tr" : "en"]}
            </p>
          </div>

          {/* Platform */}
          {!hidePlatform && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Platform</h4>
              <div className="flex flex-col gap-2">
                <Link href="/admin/trading/swing" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Top Swing Picks</Link>
                <Link href="/admin/analytics/performance" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Performance</Link>
                <Link href="/admin/analytics/terminal" className="text-xs text-[#3b82f6] hover:text-white transition-colors font-bold">Institutional Terminal</Link>
                <Link href="/admin/education/academy" className="text-xs text-[#3b82f6] hover:text-white transition-colors">🎓 Academy</Link>
                <Link href="/admin/archive" className="text-xs text-[#00d2ff] hover:text-white transition-colors">Archive</Link>
                <Link href="/admin/portfolio/smart-tracker" className="text-xs text-[#10b981] hover:text-white transition-colors font-bold">🚀 Smart Tracker</Link>
              </div>
            </div>
          )}

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">{locale === "tr" ? "Kaynaklar" : "Resources"}</h4>
            <div className="flex flex-col gap-2">
              {RESOURCES_LINKS[locale === "tr" ? "tr" : "en"].map((item) => (
                <Link key={item.href} href={item.href} className="text-xs text-[#00d2ff] hover:text-white transition-colors">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">{locale === "tr" ? "Yasal" : "Legal"}</h4>
            <div className="flex flex-col gap-1.5">
              {LEGAL_LINKS[locale === "tr" ? "tr" : "en"].map((item) => (
                <Link key={item.href} href={item.href} className="text-xs text-[#00d2ff] hover:text-white transition-colors">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[#1e2a3a] mt-8 pt-4 text-center">
          {locale && (
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-3xl mx-auto mb-3">
              {DISCLAIMER[locale]}
            </p>
          )}
          <p className="text-[11px] text-slate-500 mb-2">
            {locale === "tr"
              ? "Tüm veriler 15 dakika gecikme ile saat başları güncellenir."
              : "All data is delayed by 15 minutes and updated at the top of each hour."}
          </p>
          <p className="text-xs text-[#00d2ff]">
            {locale === "tr"
              ? "\u00A9 Blue One Global Analysis. NEW YORK - 2026 BOGA AI - T\u00FCm Haklar\u0131 Sakl\u0131d\u0131r."
              : "\u00A9 Blue One Global Analysis. NEW YORK - 2026 BOGA AI - All Rights Reserved."}
          </p>
        </div>
      </div>
    </footer>
  );
}
