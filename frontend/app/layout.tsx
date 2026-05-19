import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNavWrapper from "@/components/BottomNavWrapper";
import PWAInstaller from "@/components/PWAInstaller";
import Script from "next/script";
import StructuredData from "@/components/StructuredData";
import { Inter, Montserrat, JetBrains_Mono } from "next/font/google";
import { SmartTrackerProvider } from "@/components/SmartTrackerContext";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "900"],
  display: "swap",
  variable: "--font-montserrat",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-mono",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: {
    default: "Daily AI analysis of +8000 top US stocks by BOGA AI - Blue One Global Analysis. Breakout signals, momentum picks, and smart stock screeners updated every time",
    template: "%s | BOGA AI"
  },
  description:
    "Daily AI analysis of +8000 top US stocks by BOGA AI - Blue One Global Analysis. Breakout signals, momentum picks, and smart stock screeners updated every time.",
  keywords: ["US stock AI analysis", "daily stock signals", "stock screener", "breakout stocks", "momentum stocks", "BOGA AI"],
  authors: [{ name: "BOGA AI Team" }],
  creator: "BOGA AI",
  publisher: "BOGA AI",
  alternates: {
    canonical: "https://bogastock.com",
    languages: {
      "en-US": "https://bogastock.com/",
      "tr-TR": "https://bogastock.com/tr/analiz",
      "es-ES": "https://bogastock.com/es/analisis",
      "pt-BR": "https://bogastock.com/pt/analise",
      "fr-FR": "https://bogastock.com/fr/analyse",
      "id-ID": "https://bogastock.com/id/analisis",
    },
  },
  openGraph: {
    title: "BOGA AI - Blue One Global Analysis | AI-Powered US Stock Analysis",
    description: "Daily AI analysis of +8000 top US stocks with signals, scores, and smart watchlist by BOGA AI.",
    url: "https://bogastock.com",
    siteName: "BOGA AI",
    images: [
      {
        url: "/finmawave.png",
        width: 1200,
        height: 630,
        alt: "BOGA AI Analysis",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOGA AI - AI Stock Signals & Analysis",
    description: "Daily AI analysis of +8000 top US stocks.",
    images: ["/finmawave.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.png?v=2" },
      { url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%230a0e17' width='100' height='100'/%3E%3Cpath d='M30 60 Q40 30 50 60 T70 60' stroke='%233b82f6' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='50' y1='60' x2='50' y2='85' stroke='%233b82f6' stroke-width='8' stroke-linecap='round'/%3E%3C/svg%3E", type: "image/svg+xml" }
    ],
    apple: [
      { url: "/finmawave.png", sizes: "180x180", type: "image/png" }
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "BOGA AI",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e17" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} ${jetbrainsMono.variable}`}>
      <head>
        <StructuredData />
        {/* Google Analytics — lazyOnload: render'ı bloke etmez */}
        <Script id="google-analytics" strategy="lazyOnload" src="https://www.googletagmanager.com/gtag/js?id=G-CCSWK67D93" />
        <Script id="google-analytics-config" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CCSWK67D93');
          `}
        </Script>

        {/* Google AdSense — lazyOnload: TBT'yi 200-400ms azaltır */}
        <Script
          id="google-adsense"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1081747094060539"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </head>
      <body className="antialiased min-h-screen bg-[#0a0e17] pb-20 lg:pb-0">
        <SmartTrackerProvider>
          <PWAInstaller />
          {children}
          <BottomNavWrapper />
        </SmartTrackerProvider>
      </body>
    </html>
  );
}
