import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNavWrapper from "@/components/BottomNavWrapper";
import PWAInstaller from "@/components/PWAInstaller";
import StructuredData from "@/components/StructuredData";
import VisitorTracker from "@/components/VisitorTracker";
import TrafficAuditTracker from "@/components/global/TrafficAuditTracker";
import { Inter, Montserrat, JetBrains_Mono, Manrope } from "next/font/google";
import { SmartTrackerProvider } from "@/components/SmartTrackerContext";
import { TrackerProvider } from "@/components/TrackerContext";
import CopilotShell from "@/components/global/CopilotShell";
import AnalyticsLoader from "@/components/global/AnalyticsLoader";
import FeedbackWidget from "@/components/global/FeedbackWidget";
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-manrope",
  preload: true,
});

const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["700", "900"],
  display: "swap",
  variable: "--font-montserrat",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-mono",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: {
    default: "BogaStock | Advanced Interactive Chart Analysis",
    template: "%s | BogaStock"
  },
  description:
    "BOGASTOCK Terminal | Advanced Interactive Chart Analysis for Stocks, Gold, FX & Crypto.",
  keywords: ["US stock analysis", "interactive charts", "stock terminal", "market insights", "BOGASTOCK Terminal"],
  authors: [{ name: "BOGASTOCK Team" }],
  creator: "BOGASTOCK Terminal",
  publisher: "BOGASTOCK Terminal",
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
    title: "BOGASTOCK Terminal | Analyze U.S. stocks with interactive charts and market insights.",
    description: "BOGASTOCK Terminal | Analyze U.S. stocks with interactive charts and market insights.",
    url: "https://bogastock.com",
    siteName: "BOGASTOCK Terminal",
    images: [
      {
        url: "/logo/boga_stock_icon.png",
        width: 2000,
        height: 2000,
        alt: "BogaStock",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOGASTOCK Terminal | Analyze U.S. stocks with interactive charts and market insights.",
    description: "BOGASTOCK Terminal | Analyze U.S. stocks with interactive charts and market insights.",
    images: ["/logo/boga_stock_icon.png"],
  },
  icons: {
    icon: [
      { url: "/logo/boga_stock_icon.png", type: "image/png" }
    ],
    apple: [
      { url: "/logo/boga_stock_icon.png", sizes: "180x180", type: "image/png" }
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "BOGASTOCK Terminal",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  // Google AdSense site-ownership doğrulaması: AdSense'in gerçek reklam
  // scripti CookieConsent kabul edilmeden yüklenmiyor (bkz. AnalyticsLoader),
  // bu yüzden Googlebot doğrulama taramasında script'i hiç görmüyor ve
  // "Site sahipliği doğrulanamıyor" hatası veriyordu. Bu meta etiket rızaya
  // bağlı değil — hiçbir script/çerez yüklemeden, sadece sahiplik beyanı
  // olarak her zaman <head>'de bulunur.
  other: {
    "google-adsense-account": "ca-pub-1081747094060539",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e17" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${montserrat.variable} ${jetbrainsMono.variable}`}>
      <head>
        <StructuredData />
      </head>
      <body className="antialiased min-h-[100dvh] bg-[#0a0e17] pb-20 lg:pb-0">
        <SmartTrackerProvider>
          <TrackerProvider>
            <AnalyticsLoader />
            <VisitorTracker />
            <TrafficAuditTracker />
            <PWAInstaller />
            <CopilotShell>
              {children}
            </CopilotShell>
            <FeedbackWidget />
            <BottomNavWrapper />
          </TrackerProvider>
        </SmartTrackerProvider>
      </body>
    </html>
  );
}


