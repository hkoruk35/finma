import type { Metadata, Viewport } from 'next'
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
  title: 'FinMA Terminal | Profesyonel Finans Terminali',
  description: 'FinMA - Yapay zeka destekli profesyonel finans terminali. Piyasa analizi, sinyal botları ve portföy yönetimi.',
  keywords: ['finma', 'finans', 'terminal', 'borsa', 'trading', 'sinyal'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FinMA',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
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
      </body>
    </html>
  )
}
