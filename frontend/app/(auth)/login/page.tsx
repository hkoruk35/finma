'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Home } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          renderButton: (element: HTMLElement, config: any) => void
          prompt: () => void
        }
      }
    }
  }
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuthStore()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = redirect
    }
  }, [isAuthenticated, redirect])

  // Google Sign-In callback
  const handleGoogleResponse = useCallback(async (response: any) => {
    setLoading(true)
    setError('')
    try {
      const result = await api.googleLogin(response.credential)
      login(result.access_token, result.user as any)
      window.location.href = redirect
    } catch (err: any) {
      setError(err.message || 'Google ile giriş yapılamadı')
    } finally {
      setLoading(false)
    }
  }, [login, redirect])

  // Initialize Google Sign-In
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
        auto_select: false,
      })

      const btnEl = document.getElementById('google-signin-btn')
      if (btnEl) {
        window.google.accounts.id.renderButton(btnEl, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320,
          locale: 'tr',
        })
      }
    }

    // Script might already be loaded
    if (window.google?.accounts?.id) {
      initGoogle()
    } else {
      // Wait for script to load
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          initGoogle()
        }
      }, 100)
      const timeout = setTimeout(() => clearInterval(interval), 5000)
      return () => { clearInterval(interval); clearTimeout(timeout) }
    }
  }, [handleGoogleResponse])

  return (
    <div className="min-h-screen bg-finma-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Activity className="w-8 h-8 text-finma-primary" />
            <div>
              <span className="text-2xl font-bold text-white">Fin</span>
              <span className="text-2xl font-bold text-finma-primary">MA</span>
            </div>
          </div>
          <p className="text-sm text-finma-text-dim">Profesyonel Finans Terminali</p>
        </div>

        {/* Login Card */}
        <div className="bg-finma-card border border-finma-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 text-center">Giriş Yap</h2>

          {/* Google Sign-In */}
          <div className="flex justify-center mb-4">
            <div id="google-signin-btn" />
          </div>

          {loading && (
            <div className="text-center text-xs text-finma-text-dim mb-3">
              Giriş yapılıyor...
            </div>
          )}

          {error && (
            <div className="text-xs text-finma-red bg-finma-red/10 border border-finma-red/30 rounded-md px-3 py-2 mb-4">
              {error}
            </div>
          )}
        </div>

        {/* Ana Sayfa Butonu */}
        <Link href="/">
          <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-finma-bg border border-finma-border hover:border-finma-primary/50 hover:bg-finma-card transition-all text-sm font-medium text-finma-text">
            <Home className="w-4 h-4" />
            Ana Sayfa
          </button>
        </Link>

        {/* Footer */}
        <div className="text-center mt-6 text-[10px] text-finma-text-dim">
          FinMA v4.0 | Profesyonel Finans Terminali
        </div>
      </div>
    </div>
  )
}
