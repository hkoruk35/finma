import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "FinMA Daily 100 | AI-Powered US Stock Analysis & Signals",
  description:
    "Daily AI analysis of 100 top US stocks. Breakout signals, momentum picks, undervalued screener. Free stock watchlist and alerts.",
  keywords: "US stock AI analysis, daily stock signals, stock screener, breakout stocks, momentum stocks",
  openGraph: {
    title: "FinMA Daily 100 | AI-Powered US Stock Analysis",
    description: "Daily AI analysis of 100 top US stocks with signals, scores, and smart watchlist.",
    url: "https://finmasmart.com",
    siteName: "FinMA Daily 100",
    images: [
      {
        url: "/finmaicon1.png",
        width: 1200,
        height: 630,
        alt: "FinMA Daily 100 Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinMA Daily 100 | AI Stock Signals",
    description: "Daily AI analysis of 100 top US stocks.",
    images: ["/finmaicon1.png"],
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:ital,wght@1,800;1,900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/finmaicon1.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className="antialiased min-h-screen bg-[#0a0e17] pb-20 lg:pb-0">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
