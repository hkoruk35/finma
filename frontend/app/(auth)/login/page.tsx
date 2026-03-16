'use client'

import { useState } from 'react'
import { Activity, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // TODO: Connect to backend auth API
      // For now, simple redirect
      if (username === 'admin' && password === 'Finma2026!') {
        window.location.href = '/dashboard'
      } else {
        setError('Geçersiz kullanıcı adı veya şifre')
      }
    } catch {
      setError('Giriş yapılırken bir hata oluştu')
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

        {/* Login Form */}
        <div className="bg-finma-card border border-finma-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Giriş Yap</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-finma-text-dim block mb-1.5">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adınızı girin"
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

            {error && (
              <div className="text-xs text-finma-red bg-finma-red/10 border border-finma-red/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="finma-btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/register" className="text-xs text-finma-primary hover:underline">
              Hesabınız yok mu? Kayıt olun
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-[10px] text-finma-text-dim">
          FinMA v4.0 | Profesyonel Finans Terminali
        </div>
      </div>
    </div>
  )
}
