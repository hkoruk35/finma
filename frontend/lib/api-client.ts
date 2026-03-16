/**
 * FinMA API Client
 * Backend: FastAPI (http://localhost:8000)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'API hatası' }))
      throw new Error(error.detail || `HTTP ${res.status}`)
    }

    return res.json()
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

  // ─── Signals ───

  async getLatestSignals() {
    return this.request<{
      timestamp: string; bot_name?: string; market_regime: string;
      sector_leaders?: string[]; vix_level: number;
      candidates: Array<{
        ticker: string; score: number; price: number; action: string;
        entry_zone: string; stop_loss: number; target: number;
        potential_pct: number; sector: string; trend_phase?: string;
        rvol?: number; notes?: string[];
      }>
    }>('/api/signals/latest')
  }

  async getFeaturedSignals(limit = 5) {
    return this.request<{
      timestamp: string; market_regime: string; vix_level: number;
      featured: Array<{
        ticker: string; score: number; price: number; action: string;
        entry_zone: string; stop_loss: number; target: number;
        potential_pct: number; sector: string; trend_phase?: string;
        rvol?: number; notes?: string[];
      }>
    }>(`/api/signals/featured?limit=${limit}`)
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
      subscription_tier: string; full_name?: string
    }>('/api/auth/me')
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('finma_token')
    }
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
