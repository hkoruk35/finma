import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'FinMA Terminal | Profesyonel Finans Terminali',
  description: 'FinMA - Yapay zeka destekli profesyonel finans terminali. Piyasa analizi, sinyal botları ve portföy yönetimi.',
  keywords: ['finma', 'finans', 'terminal', 'borsa', 'trading', 'sinyal'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-finma-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
