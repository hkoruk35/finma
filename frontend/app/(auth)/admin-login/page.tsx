'use client'

import { useState, useEffect } from 'react'
import { Activity, Eye, EyeOff, Shield } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'

export default function AdminLoginPage() {
  const { login, isAuthenticated } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/dashboard'
    }
  }, [isAuthenticated])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await api.login(username, password)
      login(result.access_token, result.user as any)
      window.location.href = '/admin'
    } catch (err: any) {
      setError(err.message || 'Geçersiz kullanıcı adı veya şifre')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-finma-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Activity className="w-7 h-7 text-finma-primary" />
            <div>
              <span className="text-xl font-bold text-white">Fin</span>
              <span className="text-xl font-bold text-finma-primary">MA</span>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-finma-card border border-finma-border rounded-xl p-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Shield className="w-4 h-4 text-finma-text-dim" />
            <h2 className="text-sm font-semibold text-finma-text-dim">Yönetici Girişi</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-finma-text-dim block mb-1.5">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="finma-input w-full"
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
        </div>
      </div>
    </div>
  )
}
