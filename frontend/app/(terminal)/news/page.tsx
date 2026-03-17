'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import {
  Newspaper, Clock, ExternalLink, TrendingUp, TrendingDown, AlertCircle,
  RefreshCw, Globe, Filter
} from 'lucide-react'
import { api } from '@/lib/api-client'

const TRACKED_TICKERS = [
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'AMD', name: 'AMD' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'Nasdaq' },
  { symbol: 'PLTR', name: 'Palantir' },
  { symbol: 'SMCI', name: 'Super Micro' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'MSTR', name: 'MicroStrategy' },
  { symbol: 'AVGO', name: 'Broadcom' },
  { symbol: 'ARM', name: 'ARM Holdings' },
]

interface NewsItem {
  title: string
  url: string
  publisher: string
  date: string
  lang?: string
  ticker: string
  impact: 'positive' | 'negative' | 'neutral'
}

// Haber başlığından olumlu/olumsuz impact tahmini
function detectImpact(title: string): 'positive' | 'negative' | 'neutral' {
  const t = title.toLowerCase()
  const positive = ['artış', 'yüksel', 'rekor', 'kazanç', 'büyüme', 'duyur', 'launch', 'beat', 'surge', 'rally', 'gain', 'rise', 'record', 'profit', 'growth', 'bull', 'upgrade', 'strong', 'buy', 'target raised', 'soar', 'jump', 'spike']
  const negative = ['düşüş', 'düştü', 'kayıp', 'zarar', 'soruşturma', 'dava', 'risk', 'fall', 'drop', 'decline', 'loss', 'miss', 'cut', 'downgrade', 'sell', 'crash', 'plunge', 'warn', 'concern', 'layoff', 'lawsuit', 'probe', 'fine', 'bear', 'weak']
  if (positive.some(w => t.includes(w))) return 'positive'
  if (negative.some(w => t.includes(w))) return 'negative'
  return 'neutral'
}

// Tarih formatı: "2 saat önce" veya "3 gün önce"
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const now = Date.now()
  const diff = now - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'Az önce'
  if (mins < 60) return `${mins} dakika önce`
  if (hours < 24) return `${hours} saat önce`
  if (days < 7) return `${days} gün önce`
  return date.toLocaleDateString('tr-TR')
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string>('ALL')
  const [error, setError] = useState<string | null>(null)

  const fetchAllNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      // Tüm tickerları paralel olarak fetch et
      const results = await Promise.allSettled(
        TRACKED_TICKERS.map(({ symbol }) => api.getNews(symbol).then(items => ({ symbol, items })))
      )

      const allNews: NewsItem[] = []
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { symbol, items } = result.value
          for (const item of items) {
            allNews.push({
              ...item,
              ticker: symbol,
              impact: detectImpact(item.title),
            })
          }
        }
      }

      // Tarihe göre sırala (en yeni önce), aynı başlıkları çıkar
      const seen = new Set<string>()
      const unique = allNews
        .filter(n => {
          if (seen.has(n.title)) return false
          seen.add(n.title)
          return true
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setNews(unique)
      setLastUpdate(new Date())
    } catch (err) {
      setError('Haberler yüklenirken hata oluştu.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // İlk yükleme
  useEffect(() => {
    fetchAllNews()
  }, [fetchAllNews])

  // 2 dakikada bir otomatik yenile
  useEffect(() => {
    const interval = setInterval(() => fetchAllNews(true), 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAllNews])

  const filtered = selectedTicker === 'ALL'
    ? news
    : news.filter(n => n.ticker === selectedTicker)

  const lastUpdateStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Newspaper className="w-4 h-4 text-finma-primary" />
        <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
          Şirket Haberleri
        </span>
        <span className="text-[10px] text-finma-text-dim ml-1">ABD Piyasaları</span>
        {lastUpdateStr && (
          <span className="text-[10px] text-finma-text-dim ml-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Son: {lastUpdateStr}
          </span>
        )}
        <span className="text-[10px] bg-finma-primary/10 text-finma-primary px-2 py-0.5 rounded ml-1 uppercase tracking-tighter">
          2 dk'da bir güncellenir
        </span>
        <button
          onClick={() => fetchAllNews(true)}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1 text-[10px] text-finma-text-dim hover:text-finma-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
          {refreshing ? 'Güncelleniyor...' : 'Yenile'}
        </button>
      </div>

      {/* Ticker Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3 h-3 text-finma-text-dim" />
        <button
          onClick={() => setSelectedTicker('ALL')}
          className={cn(
            'text-[10px] px-2 py-1 rounded transition-colors finma-number font-bold',
            selectedTicker === 'ALL'
              ? 'bg-finma-primary/20 text-finma-primary'
              : 'text-finma-text-dim hover:text-finma-text'
          )}
        >
          TÜM ({news.length})
        </button>
        {TRACKED_TICKERS.map(({ symbol }) => {
          const count = news.filter(n => n.ticker === symbol).length
          if (count === 0) return null
          return (
            <button
              key={symbol}
              onClick={() => setSelectedTicker(symbol)}
              className={cn(
                'text-[10px] px-2 py-1 rounded transition-colors finma-number font-bold',
                selectedTicker === symbol
                  ? 'bg-finma-primary/20 text-finma-primary'
                  : 'text-finma-text-dim hover:text-finma-text'
              )}
            >
              {symbol} ({count})
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} padding="sm">
              <div className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-finma-border/40 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-finma-border/40 rounded w-3/4" />
                  <div className="h-2 bg-finma-border/30 rounded w-full" />
                  <div className="h-2 bg-finma-border/30 rounded w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Card padding="sm">
          <div className="flex items-center gap-2 text-finma-red text-sm py-4 justify-center">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </Card>
      )}

      {/* News List */}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <Card padding="sm">
              <div className="text-center py-8 text-finma-text-dim text-sm">
                Haber bulunamadı.
              </div>
            </Card>
          )}
          {filtered.map((news_item, idx) => (
            <a
              key={`${news_item.ticker}-${idx}`}
              href={news_item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <Card padding="sm" className={cn(
                'border-l-2 transition-colors group-hover:bg-finma-card-hover',
                news_item.lang === 'tr'
                  ? 'border-l-finma-primary'
                  : news_item.impact === 'positive'
                  ? 'border-l-finma-green/60'
                  : news_item.impact === 'negative'
                  ? 'border-l-finma-red/60'
                  : 'border-l-finma-border'
              )}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    news_item.impact === 'positive' ? 'bg-finma-green/20' :
                    news_item.impact === 'negative' ? 'bg-finma-red/20' : 'bg-finma-yellow/20'
                  )}>
                    {news_item.impact === 'positive'
                      ? <TrendingUp className="w-4 h-4 text-finma-green" />
                      : news_item.impact === 'negative'
                      ? <TrendingDown className="w-4 h-4 text-finma-red" />
                      : <AlertCircle className="w-4 h-4 text-finma-yellow" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[9px] bg-finma-primary/20 text-finma-primary px-1.5 py-0.5 rounded font-bold finma-number">
                        {news_item.ticker}
                      </span>
                      {news_item.lang === 'tr' && (
                        <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                          <Globe className="w-2.5 h-2.5" /> TR
                        </span>
                      )}
                      <h3 className="text-sm font-semibold text-finma-text group-hover:text-white transition-colors leading-tight">
                        {news_item.title}
                      </h3>
                      <ExternalLink className="w-3 h-3 text-finma-text-dim shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-finma-text-dim">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(news_item.date)}
                      </span>
                      <span>{news_item.publisher}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
