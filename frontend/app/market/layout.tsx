/**
 * Market Pages Layout
 * Tüm market sayfaları için shared layout
 * Background, header, footer tutarlı
 */

'use client'

export const dynamic = 'force-dynamic' // Skip static generation timeout

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        fontSize: 'clamp(11px, 3vw, 13px)',
        color: '#8B97AA',
        textDecoration: 'none',
        padding: '6px 10px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
        transition: 'all 200ms',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(45,126,248,0.10)'
        e.currentTarget.style.color = '#2D7EF8'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#8B97AA'
      }}
    >
      {label}
    </a>
  )
}

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #060A0F 0%, #0A0E17 100%)',
        minHeight: '100vh',
        color: '#EDF2FA',
        fontFamily: 'Manrope, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 20px',
          background: 'rgba(6, 10, 15, 0.8)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <a
            href="/"
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#EDF2FA',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="22" height="20" viewBox="0 0 24 24" fill="none">
              <polyline
                points="22 12 18 12 15 21 9 3 6 12 2 12"
                stroke="#2D7EF8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              Fin<span style={{ color: '#2D7EF8' }}>MA</span>
            </span>
          </a>

          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <NavLink href="/market/stocks" label="📈 Hisseler" />
            <NavLink href="/market/crypto" label="🪙 Kripto" />
            <NavLink href="/market/commodities" label="💎 Emtia" />
            <NavLink href="/market/forex" label="💱 Forex" />
            <NavLink href="/market/tech" label="💻 Teknoloji" />
            <NavLink href="/world-markets" label="🌍 Dünya" />
            <a
              href="/login"
              style={{
                fontSize: 12,
                color: '#4C5A6B',
                textDecoration: 'none',
                padding: '8px 12px',
              }}
            >
              Giriş
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ padding: '20px', maxWidth: '100%' }}>
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '20px',
          textAlign: 'center',
          fontSize: 11,
          color: '#4C5A6B',
          marginTop: 40,
        }}
      >
        <p>
          © 2026 FinMA — Yapay zeka destekli piyasa analiz platformu.{' '}
          <a href="#" style={{ color: '#2D7EF8', textDecoration: 'none' }}>
            Yasal
          </a>
        </p>
      </footer>
    </div>
  )
}
