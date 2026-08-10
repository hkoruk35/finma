import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";

type Locale = "en" | "tr" | "es" | "fr" | "pt";

export const metadata: Metadata = {
  title: "Sitemap",
};

const SITEMAP_TITLES: Record<Locale, string> = {
  en: "Site Map",
  tr: "Site Haritası",
  es: "Mapa del Sitio",
  fr: "Plan du Site",
  pt: "Mapa do Site",
};

const SECTION_LABELS: Record<Locale, Record<string, string>> = {
  en: { main: "Main Pages", tools: "Tools & Analysis", legal: "Legal & Info" },
  tr: { main: "Ana Sayfalar", tools: "Araçlar & Analiz", legal: "Yasal & Bilgi" },
  es: { main: "Páginas Principales", tools: "Herramientas y Análisis", legal: "Legal e Información" },
  fr: { main: "Pages Principales", tools: "Outils et Analyse", legal: "Légal et Infos" },
  pt: { main: "Páginas Principais", tools: "Ferramentas e Análise", legal: "Legal e Informações" },
};

export default function SitemapPage({ params: { locale } }: { params: { locale: Locale } }) {
  const t = SITEMAP_TITLES[locale] || SITEMAP_TITLES.en;
  const labels = SECTION_LABELS[locale] || SECTION_LABELS.en;

  const routes = [
    {
      category: labels.main,
      links: [
        { href: `/global/${locale}`, label: "Home / Dashboard" },
        { href: `/global/${locale}/discover`, label: "Discover" },
        { href: `/global/${locale}/today`, label: "Today in Market" },
        { href: `/global/${locale}/newsroom`, label: "Newsroom" },
      ],
    },
    {
      category: labels.tools,
      links: [
        { href: `/global/${locale}/terminal`, label: "Copilot Terminal" },
        { href: `/global/${locale}/markets`, label: "Global Markets" },
        { href: `/global/${locale}/earning-calendar`, label: "Earnings Calendar" },
        { href: `/global/${locale}/insider`, label: "Insider Transactions" },
        { href: `/global/${locale}/themes`, label: "Stock Themes" },
      ],
    },
    {
      category: labels.legal,
      links: [
        { href: `/global/${locale}/about`, label: "About Us" },
        { href: `/global/${locale}/${locale === "pt" ? "Perguntas_Frequentes" : locale === "tr" ? "sss" : "faq"}`, label: "FAQ" },
        { href: `/global/${locale}/contact`, label: "Contact" },
        { href: `/global/${locale}/terms`, label: "Terms of Service" },
        { href: `/global/${locale}/privacy`, label: "Privacy Policy" },
        { href: `/global/${locale}/disclaimer`, label: "Disclaimer" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale={locale} />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 md:py-20">
        <h1 className="text-3xl md:text-5xl font-black text-white mb-12 tracking-tight border-b border-[#1e2a3a] pb-6">
          {t}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {routes.map((section, i) => (
            <div key={i} className="flex flex-col">
              <h2 className="text-xl font-bold text-[#3b82f6] mb-4">{section.category}</h2>
              <ul className="space-y-3">
                {section.links.map((link, j) => (
                  <li key={j}>
                    <Link 
                      href={link.href} 
                      className="text-[#94a3b8] hover:text-white transition-colors text-sm md:text-base"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
