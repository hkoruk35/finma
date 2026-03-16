'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'
import { useSearchParams } from 'next/navigation'

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

  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  // Admin login handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await api.login(username, password)
      login(result.access_token, result.user as any)
      window.location.href = redirect
    } catch (err: any) {
      setError(err.message || 'Geçersiz kullanıcı adı veya şifre')
    } finally {
      setLoading(false)
    }
  }

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

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-finma-border" />
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="bg-finma-card px-3 text-finma-text-dim">veya</span>
            </div>
          </div>

          {/* Admin Login Toggle */}
          <button
            onClick={() => setShowAdminLogin(!showAdminLogin)}
            className="w-full flex items-center justify-center gap-1 text-xs text-finma-text-dim hover:text-finma-text transition-colors py-2"
          >
            Admin Girişi
            <ChevronDown className={`w-3 h-3 transition-transform ${showAdminLogin ? 'rotate-180' : ''}`} />
          </button>

          {/* Admin Form */}
          {showAdminLogin && (
            <form onSubmit={handleAdminLogin} className="space-y-4 mt-3">
              <div>
                <label className="text-xs text-finma-text-dim block mb-1.5">Kullanıcı Adı</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="finma-input w-full"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-finma-text-dim block mb-1.5">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Şifrenizi girin"
                    className="finma-input w-full pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-finma-text-dim hover:text-finma-text"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="finma-btn-primary w-full py-2.5 disabled:opacity-50"
              >
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-[10px] text-finma-text-dim">
          FinMA v4.0 | Profesyonel Finans Terminali
        </div>
      </div>
    </div>
  )
}
