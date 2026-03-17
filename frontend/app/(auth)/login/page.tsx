'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Home, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react'
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

type AuthMode = 'main' | 'email-login' | 'register'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuthStore()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'

  const [mode, setMode] = useState<AuthMode>('main')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Email login fields
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Register fields
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regFullName, setRegFullName] = useState('')

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

    if (window.google?.accounts?.id) {
      initGoogle()
    } else {
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

  // Email/password login
  const handleEmailLogin = async (e: React.FormEvent) => {
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

  // Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (regPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await api.register({
        username: regUsername,
        email: regEmail,
        password: regPassword,
        full_name: regFullName || undefined,
      })
      login(result.access_token, result.user as any)
      window.location.href = redirect
    } catch (err: any) {
      setError(err.message || 'Kayıt başarısız')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setError('')
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

          {/* ── MAIN MODE: Google + Email seçenekleri ── */}
          {mode === 'main' && (
            <>
              <h2 className="text-lg font-semibold text-white mb-6 text-center">Giriş Yap</h2>

              {/* Google Sign-In */}
              <div className="flex justify-center mb-4">
                <div id="google-signin-btn" />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-finma-border" />
                <span className="text-xs text-finma-text-dim">veya</span>
                <div className="flex-1 h-px bg-finma-border" />
              </div>

              {/* Email login button */}
              <button
                onClick={() => switchMode('email-login')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-finma-bg border border-finma-border hover:border-finma-primary/50 hover:bg-finma-card transition-all text-sm font-medium text-finma-text"
              >
                <Mail className="w-4 h-4" />
                E-posta ile Giriş Yap
              </button>

              {/* Register link */}
              <div className="text-center mt-4">
                <button
                  onClick={() => switchMode('register')}
                  className="text-xs text-finma-text-dim hover:text-finma-primary transition-colors"
                >
                  Hesabın yok mu? <span className="text-finma-primary font-medium">Kayıt Ol</span>
                </button>
              </div>
            </>
          )}

          {/* ── EMAIL LOGIN MODE ── */}
          {mode === 'email-login' && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => switchMode('main')}
                  className="text-finma-text-dim hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg font-semibold text-white">E-posta ile Giriş</h2>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-finma-text-dim block mb-1.5">Kullanıcı Adı veya E-posta</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="finma-input w-full"
                    placeholder="kullanıcıadı"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs text-finma-text-dim block mb-1.5">Şifre</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="finma-input w-full pr-10"
                      placeholder="••••••••"
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

              <div className="text-center mt-4">
                <button
                  onClick={() => switchMode('register')}
                  className="text-xs text-finma-text-dim hover:text-finma-primary transition-colors"
                >
                  Hesabın yok mu? <span className="text-finma-primary font-medium">Kayıt Ol</span>
                </button>
              </div>
            </>
          )}

          {/* ── REGISTER MODE ── */}
          {mode === 'register' && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => switchMode('main')}
                  className="text-finma-text-dim hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg font-semibold text-white">Kayıt Ol</h2>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-xs text-finma-text-dim block mb-1.5">Ad Soyad</label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="finma-input w-full"
                    placeholder="Ad Soyad"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs text-finma-text-dim block mb-1.5">Kullanıcı Adı</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="finma-input w-full"
                    placeholder="kullanıcıadı"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-finma-text-dim block mb-1.5">E-posta</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="finma-input w-full"
                    placeholder="ornek@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-finma-text-dim block mb-1.5">Şifre</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="finma-input w-full pr-10"
                      placeholder="En az 6 karakter"
                      required
                      minLength={6}
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
                  {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
                </button>
              </form>

              <div className="text-center mt-4">
                <button
                  onClick={() => switchMode('email-login')}
                  className="text-xs text-finma-text-dim hover:text-finma-primary transition-colors"
                >
                  Zaten hesabın var mı? <span className="text-finma-primary font-medium">Giriş Yap</span>
                </button>
              </div>
            </>
          )}

          {/* Error display */}
          {error && (
            <div className="text-xs text-finma-red bg-finma-red/10 border border-finma-red/30 rounded-md px-3 py-2 mt-4">
              {error}
            </div>
          )}

          {loading && !error && (
            <div className="text-center text-xs text-finma-text-dim mt-3">
              Giriş yapılıyor...
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
