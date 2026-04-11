import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import PWAInstaller from "@/components/PWAInstaller";

export const metadata: Metadata = {
  metadataBase: new URL("https://finmasmart.com"),
  title: "FinMA Daily +500 | AI-Powered US Stock Analysis & Signals",
  description:
    "Daily AI analysis of +500 top US stocks. Breakout signals, momentum picks, undervalued screener. Free stock watchlist and alerts.",
  keywords: "US stock AI analysis, daily stock signals, stock screener, breakout stocks, momentum stocks",
  openGraph: {
    title: "FinMA Daily +500 | AI-Powered US Stock Analysis",
    description: "Daily AI analysis of +500 top US stocks with signals, scores, and smart watchlist.",
    url: "https://finmasmart.com",
    siteName: "FinMA Daily +500",
    images: [
      {
        url: "https://finmasmart.com/finmawave.png",
        width: 1200,
        height: 630,
        alt: "FinMA Daily +500 Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinMA Daily +500 | AI Stock Signals",
    description: "Daily AI analysis of +500 top US stocks.",
    images: ["https://finmasmart.com/finmawave.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%230a0e17' width='100' height='100'/%3E%3Cpath d='M30 60 Q40 30 50 60 T70 60' stroke='%233b82f6' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='50' y1='60' x2='50' y2='85' stroke='%233b82f6' stroke-width='8' stroke-linecap='round'/%3E%3C/svg%3E" />
        <link rel="alternate icon" href="/favicon.png?v=2" />
        <link rel="apple-touch-icon" href="/finmawave.png" sizes="180x180" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0e17" media="(prefers-color-scheme: dark)" />
        <meta name="color-scheme" content="dark light" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FinMA" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
      </head>
      <body className="antialiased min-h-screen bg-[#0a0e17] pb-20 lg:pb-0">
        <PWAInstaller />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
