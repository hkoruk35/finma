import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Providers } from './providers'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
}

export const metadata: Metadata = {
  title: 'FinMA — Finansal Zeka',
  description: 'FinMA yapay zeka destekli piyasa analiz platformudur. Hisse, kripto, emtia ve forex için tek soru, derin AI analizi.',
  keywords: ['finma', 'finansal zeka', 'yapay zeka finans', 'borsa analizi', 'kripto analiz', 'trading', 'sinyal'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FinMA',
    startupImage: '/icons/apple-touch-icon.svg',
  },
  icons: {
    apple: '/icons/apple-touch-icon.svg',
    icon: '/icons/icon-192.svg',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'application-name': 'FinMA',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-finma-bg safe-area-top">
        <Providers>{children}</Providers>
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  )
}
