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
    { href: "/global/en/about", label: "About BOGASTOCK" },
    { href: "/global/en/news", label: "Market News" },
    { href: "/global/en/contact", label: "Contact Support" },
    { href: "/global/en/faq", label: "Frequently Asked Questions (FAQ)" },
  ],
  tr: [
    { href: "/global/tr/about", label: "BOGASTOCK Hakkında" },
    { href: "/global/tr/news", label: "Piyasa Haberleri" },
    { href: "/global/tr/contact", label: "Destek İletişim" },
    { href: "/global/tr/sss", label: "Sıkça Sorulan Sorular (SSS)" },
  ],
  es: [
    { href: "/global/es/about", label: "Acerca de BOGASTOCK" },
    { href: "/global/es/news", label: "Noticias del Mercado" },
    { href: "/global/es/contact", label: "Soporte y Contacto" },
    { href: "/global/es/faq", label: "Preguntas Frecuentes (FAQ)" },
  ],
  fr: [
    { href: "/global/fr/about", label: "À Propos de BOGASTOCK" },
    { href: "/global/fr/news", label: "Actualités du Marché" },
    { href: "/global/fr/contact", label: "Support et Contact" },
    { href: "/global/fr/faq", label: "Foire Aux Questions (FAQ)" },
  ],
  pt: [
    { href: "/global/pt/about", label: "Sobre a BOGASTOCK" },
    { href: "/global/pt/news", label: "Notícias do Mercado" },
    { href: "/global/pt/contact", label: "Suporte e Contato" },
    { href: "/global/pt/Perguntas_Frequentes", label: "Perguntas Frequentes (FAQ)" },
  ],
};

const BRAND_TAGLINE: Record<"en" | "tr" | "es" | "fr" | "pt", string> = {
  en: "Delivers AI-powered in-depth analysis of 6,000+ stocks and ETFs traded on US exchanges; also tracks and analyzes global markets, forex, precious metals, and crypto.",
  tr: "ABD borsalarında işlem gören 6.000'den fazla hisse senedi ve ETF üzerinde yapay zekâ destekli derinlemesine analiz sunar; küresel borsaları, döviz, değerli madenler ve kripto piyasalarını da kapsam dahilinde takip ve analiz eder.",
  es: "Ofrece análisis profundo impulsado por IA de más de 6.000 acciones y ETFs que cotizan en las bolsas de EE. UU.; también realiza seguimiento y análisis de los mercados globales, divisas, metales preciosos y criptomonedas.",
  fr: "Propose une analyse approfondie alimentée par l'IA de plus de 6 000 actions et ETF négociés sur les bourses américaines ; assure également le suivi et l'analyse des marchés mondiaux, des devises, des métaux précieux et des cryptomonnaies.",
  pt: "Oferece análise aprofundada com IA de mais de 6.000 ações e ETFs negociados nas bolsas dos EUA; também acompanha e analisa os mercados globais, câmbio, metais preciosos e criptomoedas.",
};

const TERMINAL_LABEL: Record<"en" | "tr" | "es" | "fr" | "pt", string> = {
  en: "Open Terminal",
  tr: "Terminali Aç",
  es: "Abrir Terminal",
  fr: "Ouvrir le Terminal",
  pt: "Abrir Terminal",
};

const TERMINAL_TOOLTIP: Record<"en" | "tr" | "es" | "fr" | "pt", string> = {
  en: "Open the TERMINAL page",
  tr: "TERMİNAL sayfasını aç",
  es: "Abrir la página TERMINAL",
  fr: "Ouvrir la page TERMINAL",
  pt: "Abrir a página TERMINAL",
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link href={`/global/${locale ?? "en"}`} className="flex items-start mb-3 group w-fit">
              <Image src="/logo/boga_stock.png" alt="BogaStock" width={195} height={61} className="h-11 sm:h-16 w-auto" />
            </Link>
            <p className="text-xs text-[#00d2ff] mb-3">
              {BRAND_TAGLINE[locale ?? "en"]}
            </p>
            <Link
              href={`/global/${locale ?? "en"}`}
              title={TERMINAL_TOOLTIP[locale ?? "en"]}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-wider bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white border border-[#3b82f6]/30 transition-all"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
              </svg>
              {TERMINAL_LABEL[locale ?? "en"]}
            </Link>
          </div>



          {/* Resources */}
          <div>
            <h4 className="text-sm font-medium text-white mb-3">{locale === "tr" ? "Kaynaklar" : locale === "es" ? "Recursos" : locale === "fr" ? "Ressources" : locale === "pt" ? "Recursos" : "Resources"}</h4>
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
            <h4 className="text-sm font-medium text-white mb-3">{locale === "tr" ? "Yasal" : "Legal"}</h4>
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
              ? "\u00A9 Blue One Global Analysis. 2021- 2026 BogaStock.com - Powered by AFK DaSYS T\u00FCm Haklar\u0131 Sakl\u0131d\u0131r."
              : locale === "es"
              ? "\u00A9 Blue One Global Analysis. 2021- 2026 BogaStock.com - Powered by AFK DaSYS Todos los Derechos Reservados."
              : locale === "fr"
              ? "\u00A9 Blue One Global Analysis. 2021- 2026 BogaStock.com - Powered by AFK DaSYS Tous Droits R\u00E9serv\u00E9s."
              : locale === "pt"
              ? "\u00A9 Blue One Global Analysis. 2021- 2026 BogaStock.com - Powered by AFK DaSYS Todos os Direitos Reservados."
              : "\u00A9 Blue One Global Analysis. 2021- 2026 BogaStock.com - Powered by AFK DaSYS All Rights Reserved."}
          </p>
        </div>
      </div>
    </footer>
  );
}
