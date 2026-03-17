/**
 * FinMA API Client
 * Production: Vercel proxy → Railway backend (CORS-free, edge-cached)
 * Development: Direct → localhost:8000
 */

function getApiUrl(): string {
  // Server-side (SSR) — always use direct backend URL
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }
  // Client-side production — use Next.js proxy (same-origin, no CORS)
  if (window.location.hostname !== 'localhost') {
    return '/api/proxy'
  }
  // Client-side dev — direct backend
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

const API_URL = getApiUrl()

interface FetchOptions extends RequestInit {
  token?: string
}

class APIClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('finma_token')
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options
    const authToken = token || this.getToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    // 12sn timeout — takılma engellenir
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12_000)

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'API hatası' }))

        // 401: Token expired or invalid
        if (res.status === 401 && typeof window !== 'undefined') {
          // Check if we are on a protected route before logging out
          const isPublicPage = window.location.pathname === '/' || window.location.pathname === '/login' || window.location.pathname === '/register'
          
          if (!isPublicPage) {
            localStorage.removeItem('finma_token')
            document.cookie = 'finma_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
            window.location.href = '/login'
          }
          throw new Error('Oturum süresi doldu')
        }

        // 403: Trial expired or tier insufficient
        if (res.status === 403 && typeof window !== 'undefined') {
          const detail = error.detail || ''
          if (detail.includes('Deneme')) {
            window.dispatchEvent(new CustomEvent('trial-expired'))
          }
        }

        throw new Error(error.detail || `HTTP ${res.status}`)
      }

      return res.json()
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        throw new Error('İstek zaman aşımına uğradı (12s)')
      }
      throw err
    }
  }

  // ─── Market Data ───

  async getIndices() {
    return this.request<Array<{
      symbol: string; price: number; change: number; change_pct: number
    }>>('/api/market/indices')
  }

  async getQuote(ticker: string) {
    return this.request<{
      symbol: string; name: string; price: number; change: number; change_pct: number;
      volume?: number; market_cap?: number; sector?: string; industry?: string;
      pe_ratio?: number; forward_pe?: number; peg_ratio?: number;
      ps_ratio?: number; pb_ratio?: number; dividend_yield?: number;
      roe?: number; debt_to_equity?: number; beta?: number;
      revenue_growth?: number; earnings_growth?: number; profit_margin?: number;
      avg_volume?: number; fifty_two_week_high?: number; fifty_two_week_low?: number;
      target_mean?: number; target_high?: number; target_low?: number;
      analyst_rating?: string; analyst_count?: number; institutional_pct?: number;
    }>(`/api/market/quote/${ticker}`)
  }

  async getBatchQuotes(tickers: string[]) {
    return this.request<Array<{
      symbol: string; price: number; change: number; change_pct: number
    }>>(`/api/market/batch?tickers=${tickers.join(',')}`)
  }

  async getSectors(period = '1mo') {
    return this.request<Array<{
      sector: string; sector_tr: string; etf: string; price: number; change_pct: number
    }>>(`/api/market/sectors?period=${period}`)
  }

  async getRegime() {
    return this.request<{
      regime: string; regime_tr: string; vix: number;
      spy_price: number; spy_ema20: number; timestamp: string
    }>('/api/market/regime')
  }

  async getTechnicals(ticker: string) {
    return this.request<{
      ticker: string; price: number; trend: string; trend_score: number;
      indicators: {
        ema20: number; ema50: number; ema200: number; rsi: number;
        adx: number; atr: number; atr_pct: number; cmf: number; rvol: number;
        macd: number; macd_signal: number; macd_histogram: number;
        bollinger_upper: number; bollinger_lower: number;
        bollinger_bandwidth: number; bollinger_pctb: number;
      };
      levels: { support: number; resistance: number };
      volume: { current: number; avg_20d: number; rvol: number };
    }>(`/api/market/technicals/${ticker}`)
  }

  async getFullAnalysis(ticker: string) {
    return this.request<{ info: any; technicals: any }>(`/api/market/analysis/${ticker}`)
  }

  async searchTickers(query: string) {
    return this.request<Array<{
      symbol: string; name: string; exchange: string; type: string
    }>>(`/api/market/search?q=${encodeURIComponent(query)}`)
  }

  async getPriceChanges(ticker: string) {
    return this.request<{ week: number | null; month: number | null; year: number | null }>(`/api/market/price-changes/${ticker}`)
  }

  async getNews(ticker: string) {
    return this.request<Array<{
      title: string; url: string; publisher: string; date: string; lang?: string
    }>>(`/api/market/news/${ticker}`)
  }

  async getInsider(ticker: string) {
    return this.request<Array<{
      insider: string; relation: string; transaction: string; date: string; shares: number; value: number
    }>>(`/api/market/insider/${ticker}`)
  }

  async getEarnings(ticker: string) {
    return this.request<{
      next_date: string | null;
      history: Array<{ date: string; eps_estimate: number; eps_actual: number; surprise_pct: number }>
    }>(`/api/market/earnings/${ticker}`)
  }

  async getPriceHistory(ticker: string) {
    return this.request<{
      monthly: Array<{ date: string; open: number; close: number; high: number; low: number; change_pct: number }>;
      yearly: Array<{ year: number; open: number; close: number; high: number; low: number; change_pct: number }>;
    }>(`/api/market/history/${ticker}`)
  }

  async getHolders(ticker: string) {
    return this.request<{
      institutional: Array<{ holder: string; shares: number; value: number; pct: number; date: string }>;
      major: Array<{ value: string; label: string }>;
      institutional_pct: number | null;
    }>(`/api/market/holders/${ticker}`)
  }

  async getWorldMarkets() {
    return this.request<{
      timestamp: string;
      total_exchanges: number;
      total_open: number;
      _stale?: boolean;
      regions: Array<{
        id: string; name: string; icon: string;
        open_count: number; total_count: number; avg_change_pct: number;
        featured_stocks: Array<{
          symbol: string; name: string; price: number; change_pct: number;
        }>;
        exchanges: Array<{
          id: string; symbol: string; name: string; full_name: string;
          country: string; city: string; flag: string;
          price: number; change: number; change_pct: number;
          prev_close: number; open_price: number; open_change_pct: number;
          day_high: number; day_low: number; volume: number;
          status: string; status_tr: string;
          session_phase: string; session_pct: number;
          local_open: string; local_close: string; tz: string;
        }>;
      }>;
      commodities: Array<{
        id: string; symbol: string; name: string; flag: string; type: string;
        price: number; change: number; change_pct: number; status: string;
      }>;
    }>('/api/market/world')
  }

  async getExchangeAnalysis(exchangeId: string) {
    return this.request<{
      exchange_id: string; exchange_name: string; exchange_country: string; exchange_flag: string;
      status: string; status_tr: string; price: number; change_pct: number;
      session_phase: string; session_pct: number;
      opening: string; midday: string; closing: string;
      sectors: string; companies: string; global_impact: string;
      risks: string; opportunities: string; raw: string;
    }>(`/api/market/world/exchange/${exchangeId}`)
  }

  async getWorldAnalysis() {
    return this.request<{
      trend: string; summary: string; strong: string; weak: string;
      risks: string; opportunities: string;
      regions: Record<string, string>;
      raw: string;
    }>('/api/market/world/analysis')
  }

  // ─── Signals (Vercel → Supabase doğrudan, Railway bypass) ───

  async getLatestSignals() {
    // Production: /api/signals/latest (Vercel serverless → Supabase)
    // Dev: Railway proxy fallback
    const signalUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? '/api/signals/latest'
      : `${this.baseUrl}/api/signals/latest`
    const res = await fetch(signalUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Signals ${res.status}`)
    return res.json() as Promise<{
      timestamp: string; bot_name?: string; market_regime: string;
      sector_leaders?: string[]; vix_level: number;
      candidates: Array<{
        ticker: string; score: number; price: number; action: string;
        entry_zone: string; stop_loss: number; target: number;
        potential_pct: number; sector: string; trend_phase?: string;
        rvol?: number; notes?: string[];
      }>
    }>
  }

  async getFeaturedSignals(limit = 5) {
    const signalUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `/api/signals/featured?limit=${limit}`
      : `${this.baseUrl}/api/signals/featured?limit=${limit}`
    const res = await fetch(signalUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Featured ${res.status}`)
    return res.json() as Promise<{
      timestamp: string; market_regime: string; vix_level: number;
      featured: Array<{
        ticker: string; score: number; price: number; action: string;
        entry_zone: string; stop_loss: number; target: number;
        potential_pct: number; sector: string; trend_phase?: string;
        rvol?: number; notes?: string[];
      }>
    }>
  }

  async getCandidates(params?: { sector?: string; action?: string; min_score?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.sector) query.set('sector', params.sector)
    if (params?.action) query.set('action', params.action)
    if (params?.min_score) query.set('min_score', String(params.min_score))
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return this.request<{
      candidates: any[]; total: number; market_regime: string; vix_level: number
    }>(`/api/signals/candidates${qs ? `?${qs}` : ''}`)
  }

  async getBotStatus() {
    return this.request<Record<string, {
      name: string; script: string; scheduled: boolean; next_run: string | null
    }>>('/api/signals/bot-status')
  }

  // ─── Portfolio ───

  async getPortfolioSummary() {
    return this.request<{
      net_liquidation: number; cash_available: number; margin_used: number;
      gross_exposure: number; current_24h_pnl: number; last_7_days_pnl: number;
      mtd_pnl: number; ytd_pnl: number; open_positions: number;
    }>('/api/portfolio/summary')
  }

  async getTrades(status?: string) {
    const query = status ? `?status=${status}` : ''
    return this.request<Array<{
      id: string; ticker: string; direction: string; type: string; strategy: string;
      entry_price: number; current_price: number; stop_loss: number; target_price: number;
      qty: number; status: string; entry_date: string; pnl: number; pnl_pct: number;
    }>>(`/api/portfolio/trades${query}`)
  }

  async createTrade(trade: {
    ticker: string; direction: string; entry_price: number;
    stop_loss: number; target_price: number; qty: number;
    type?: string; strategy?: string; notes?: string;
  }) {
    return this.request<any>('/api/portfolio/trades', {
      method: 'POST',
      body: JSON.stringify(trade),
    })
  }

  async closeTrade(tradeId: string, exitPrice: number) {
    return this.request<any>(`/api/portfolio/trades/${tradeId}?exit_price=${exitPrice}`, {
      method: 'DELETE',
    })
  }

  // ─── AI ───

  async analyzeWithAI(prompt: string, context?: string) {
    return this.request<{ response: string; model: string }>('/api/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ prompt, context }),
    })
  }

  async getStockAnalysis(ticker: string) {
    return this.request<{ response: string; model: string }>(`/api/ai/stock-analysis/${ticker}`)
  }

  async getMarketSummary() {
    return this.request<{ response: string; model: string }>('/api/ai/market-summary')
  }

  async chatWithAI(message: string, history: Array<{ role: string; content: string }> = []) {
    return this.request<{ response: string; model: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    })
  }

  async parseTrade(command: string) {
    return this.request<{ response: string; model: string }>('/api/ai/parse-trade', {
      method: 'POST',
      body: JSON.stringify({ prompt: command }),
    })
  }

  async auditPositions(positions: any[]) {
    return this.request<{ response: string; model: string }>('/api/ai/audit-positions', {
      method: 'POST',
      body: JSON.stringify({ positions }),
    })
  }

  // ─── Auth ───

  async login(username: string, password: string) {
    const result = await this.request<{
      access_token: string; token_type: string;
      user: { id: string; username: string; email: string; role: string; subscription_tier: string }
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (typeof window !== 'undefined') {
      localStorage.setItem('finma_token', result.access_token)
    }
    return result
  }

  async register(data: { username: string; email: string; password: string; full_name?: string }) {
    const result = await this.request<{
      access_token: string; token_type: string;
      user: { id: string; username: string; email: string; role: string; subscription_tier: string }
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (typeof window !== 'undefined') {
      localStorage.setItem('finma_token', result.access_token)
    }
    return result
  }

  async googleLogin(idToken: string) {
    const result = await this.request<{
      access_token: string; token_type: string;
      user: { id: string; username: string; email: string; role: string; subscription_tier: string }
    }>('/api/auth/google-login', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    })
    if (typeof window !== 'undefined') {
      localStorage.setItem('finma_token', result.access_token)
    }
    return result
  }

  async getMe() {
    return this.request<{
      id: string; username: string; email: string; role: string;
      subscription_tier: string; full_name?: string; trial_start_date?: string
    }>('/api/auth/me')
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('finma_token')
      document.cookie = 'finma_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    }
  }

  // ─── Trial ───

  async startTrial() {
    const result = await this.request<{
      access_token: string; token_type: string;
      user: { id: string; username: string; email: string; role: string; subscription_tier: string; trial_start_date?: string }
    }>('/api/auth/start-trial', { method: 'POST' })
    if (typeof window !== 'undefined') {
      localStorage.setItem('finma_token', result.access_token)
    }
    return result
  }

  // ─── Invite ───

  async redeemInvite(code: string) {
    return this.request<{ message: string; tier: string }>('/api/invite/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  async generateInvite() {
    return this.request<{ code: string; created_at: string }>('/api/invite/generate', {
      method: 'POST',
    })
  }

  async listInvites() {
    return this.request<Array<{
      code: string; created_by: string; used_by?: string; used_at?: string; created_at: string
    }>>('/api/invite/list')
  }

  // ─── Admin ───

  async listUsers(limit = 100, offset = 0) {
    return this.request<Array<{
      id: string; username: string; email: string; role: string;
      subscription_tier: string; full_name?: string; trial_start_date?: string; created_at?: string
    }>>(`/api/auth/users?limit=${limit}&offset=${offset}`)
  }

  async updateUserTier(username: string, tier: string) {
    return this.request<{ message: string }>('/api/auth/update-tier', {
      method: 'POST',
      body: JSON.stringify({ username, tier }),
    })
  }

  // ─── Telegram ───

  async testTelegram() {
    return this.request<{ status: string; message: string }>('/api/telegram/test', {
      method: 'POST',
    })
  }

  // ─── Health ───

  async getHealth() {
    return this.request<{
      status: string;
      services: { gemini: boolean; telegram: boolean; supabase: boolean }
    }>('/health')
  }

  // ─── WebSocket ───

  createWebSocket(): WebSocket {
    const wsUrl = this.baseUrl.replace('http', 'ws')
    return new WebSocket(`${wsUrl}/ws/prices`)
  }
}

export const api = new APIClient(API_URL)
