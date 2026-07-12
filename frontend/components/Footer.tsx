import Link from "next/link";
import Image from "next/image";

const DISCLAIMER: Record<"en" | "tr" | "es" | "fr" | "pt", string> = {
  en: "This page does not constitute investment advice. Content here is for informational and analytical purposes only. Data may be delayed and is not guaranteed to be accurate, complete, or current. Past performance does not indicate future results. Always do your own research before making any investment decision.",
  tr: "Bu sayfa yatırım tavsiyesi niteliği taşımaz. Buradaki içerik yalnızca bilgilendirme ve analiz amaçlıdır. Veriler gecikmeli olarak ulaşabilir; doğruluğu, eksiksizliği veya güncelliği garanti edilmez. Geçmiş performans gelecekteki sonuçların göstergesi değildir. Herhangi bir yatırım kararı vermeden önce kendi araştırmanızı yapın.",
  es: "Esta página no constituye asesoramiento de inversión. El contenido aquí es solo para fines informativos y analíticos. Los datos pueden estar retrasados y no se garantiza que sean precisos, completos o actuales. El rendimiento pasado no indica resultados futuros. Siempre realiza tu propia investigación antes de tomar cualquier decisión de inversión.",
  fr: "Cette page ne constitue pas des conseils en investissement. Le contenu ici est destiné à des fins informationnelles et analytiques uniquement. Les données peuvent être retardées et ne sont pas garanties d'être exactes, complètes ou actuelles. Les performances passées n'indiquent pas les résultats futurs. Faites toujours vos propres recherches avant de prendre une décision d'investissement.",
  pt: "Esta página não constitui aconselhamento de investimento. O conteúdo aqui é apenas para fins informativos e analíticos. Os dados podem estar atrasados e não há garantia de que sejam precisos, completos ou atuais. O desempenho passado não indica resultados futuros. Sempre faça sua própria pesquisa antes de tomar qualquer decisão de investimento.",
};

const LEGAL_LINKS: Record<"en" | "tr" | "es" | "fr" | "pt", { href: string; label: string }[]> = {
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
  es: [
    { href: "/global/es/disclaimer", label: "Aviso Legal" },
    { href: "/global/es/terms", label: "Términos de Servicio" },
    { href: "/global/es/privacy", label: "Política de Privacidad" },
  ],
  fr: [
    { href: "/global/fr/disclaimer", label: "Avertissement" },
    { href: "/global/fr/terms", label: "Conditions d'Utilisation" },
    { href: "/global/fr/privacy", label: "Politique de Confidentialité" },
  ],
  pt: [
    { href: "/global/pt/disclaimer", label: "Aviso Legal" },
    { href: "/global/pt/terms", label: "Termos de Serviço" },
    { href: "/global/pt/privacy", label: "Política de Privacidade" },
  ],
};

const RESOURCES_LINKS: Record<"en" | "tr" | "es" | "fr" | "pt", { href: string; label: string }[]> = {
  en: [
    { href: "/global/en/about", label: "About BOGA AI" },
    { href: "/global/en/news", label: "Market News" },
    { href: "/global/en/contact", label: "Contact Support" },
  ],
  tr: [
    { href: "/global/tr/about", label: "BOGA AI Hakkında" },
    { href: "/global/tr/news", label: "Piyasa Haberleri" },
    { href: "/global/tr/contact", label: "Destek İletişim" },
  ],
  es: [
    { href: "/global/es/about", label: "Acerca de BOGA AI" },
    { href: "/global/es/news", label: "Noticias del Mercado" },
    { href: "/global/es/contact", label: "Soporte y Contacto" },
  ],
  fr: [
    { href: "/global/fr/about", label: "À Propos de BOGA AI" },
    { href: "/global/fr/news", label: "Actualités du Marché" },
    { href: "/global/fr/contact", label: "Support et Contact" },
  ],
  pt: [
    { href: "/global/pt/about", label: "Sobre a BOGA AI" },
    { href: "/global/pt/news", label: "Notícias do Mercado" },
    { href: "/global/pt/contact", label: "Suporte e Contato" },
  ],
};

const BRAND_TAGLINE: Record<"en" | "tr" | "es" | "fr" | "pt", string> = {
  en: "AI-powered analysis of 6,000+ premier US stocks and ETFs.",
  tr: "ABD borsalarında işlem gören 6.000'den fazla seçkin hisse senedi ve ETF'in yapay zekâ destekli analizi.",
  es: "Análisis con IA de más de 6.000 acciones y ETFs premier de EE.UU.",
  fr: "Analyse alimentée par l'IA de plus de 6 000 actions et ETF américains de premier plan.",
  pt: "Análise com IA de mais de 6.000 ações e ETFs de primeira linha dos EUA.",
};

export default function Footer({
  hidePlatform = false,
  locale,
}: {
  hidePlatform?: boolean;
  locale?: "en" | "tr" | "es" | "fr" | "pt";
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
                  alt="BOGASTOCK - Blue One Global Analysis"
                  width={32}
                  height={32}
                  loading="lazy"
                  className="object-contain rounded-lg"
                />
              </div>
              <span className="text-base font-black text-white tracking-tighter">BOGA<span className="text-[#3b82f6]">STOCK</span> - Blue One Global<br/>Analysis</span>
            </div>
            <p className="text-xs text-[#00d2ff]">
              {BRAND_TAGLINE[locale ?? "en"]}
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
            <h4 className="text-sm font-semibold text-white mb-3">{locale === "tr" ? "Kaynaklar" : locale === "es" ? "Recursos" : locale === "fr" ? "Ressources" : locale === "pt" ? "Recursos" : "Resources"}</h4>
            <div className="flex flex-col gap-2">
              {RESOURCES_LINKS[locale ?? "en"].map((item) => (
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
              {LEGAL_LINKS[locale ?? "en"].map((item) => (
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
              : locale === "es"
              ? "Todos los datos tienen un retraso de 15 minutos y se actualizan al inicio de cada hora."
              : locale === "fr"
              ? "Toutes les données sont retardées de 15 minutes et mises à jour au début de chaque heure."
              : locale === "pt"
              ? "Todos os dados têm atraso de 15 minutos e são atualizados no início de cada hora."
              : "All data is delayed by 15 minutes and updated at the top of each hour."}
          </p>
          <p className="text-xs text-[#00d2ff]">
            {locale === "tr"
              ? "\u00A9 Blue One Global Analysis. NEW YORK - 2026 BOGASTOCK - T\u00FCm Haklar\u0131 Sakl\u0131d\u0131r."
              : locale === "es"
              ? "\u00A9 Blue One Global Analysis. NEW YORK - 2026 BOGASTOCK - Todos los Derechos Reservados."
              : locale === "fr"
              ? "\u00A9 Blue One Global Analysis. NEW YORK - 2026 BOGASTOCK - Tous Droits R\u00E9serv\u00E9s."
              : locale === "pt"
              ? "\u00A9 Blue One Global Analysis. NEW YORK - 2026 BOGASTOCK - Todos os Direitos Reservados."
              : "\u00A9 Blue One Global Analysis. NEW YORK - 2026 BOGASTOCK - All Rights Reserved."}
          </p>
        </div>
      </div>
    </footer>
  );
}
