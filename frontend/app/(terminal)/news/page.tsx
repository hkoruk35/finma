'use client'

import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { Newspaper, Clock, ExternalLink, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

const NEWS_DATA = [
  {
    title: 'NVIDIA Yeni AI Çipini Tanıttı: Blackwell Ultra',
    summary: 'NVIDIA, yeni nesil Blackwell Ultra GPU\'sunu tanıttı. Çip, mevcut modelden 4 kat daha hızlı AI eğitimi sunacak. Kurumsal talep beklentilerin üzerinde.',
    ticker: 'NVDA', impact: 'positive', time: '2 saat önce', source: 'Reuters',
  },
  {
    title: 'Tesla Çin Satışlarında Düşüş Devam Ediyor',
    summary: 'Tesla\'nın Çin\'deki Şubat satışları yıllık bazda %12 düştü. BYD ve yerli rakipler pazar payını artırmaya devam ediyor.',
    ticker: 'TSLA', impact: 'negative', time: '3 saat önce', source: 'Bloomberg',
  },
  {
    title: 'FED Başkanı Powell: Faiz İndirimi İçin Sabırlı Olacağız',
    summary: 'Fed Başkanı Jerome Powell, enflasyonun hâlâ hedefin üzerinde olduğunu ve faiz indiriminde acele edilmeyeceğini belirtti.',
    ticker: 'SPY', impact: 'neutral', time: '4 saat önce', source: 'CNBC',
  },
  {
    title: 'Apple Vision Pro 2 Üretimi Başlıyor',
    summary: 'Apple, Vision Pro 2\'nin seri üretimini Mayıs ayında başlatacak. Yeni model daha hafif ve daha uygun fiyatlı olacak.',
    ticker: 'AAPL', impact: 'positive', time: '5 saat önce', source: 'TechCrunch',
  },
  {
    title: 'Altın Rekor Kırmaya Devam Ediyor',
    summary: 'Altın fiyatları ons başına $2,950\'yi aştı. Jeopolitik riskler ve merkez bankası alımları talebi destekliyor.',
    ticker: 'GLD', impact: 'positive', time: '6 saat önce', source: 'MarketWatch',
  },
  {
    title: 'AMD MI350 AI Çipini Duyurdu',
    summary: 'AMD, NVIDIA\'ya rakip olacak MI350 AI hızlandırıcısını duyurdu. Şirket 2026 AI gelir hedefini $12B\'a yükseltti.',
    ticker: 'AMD', impact: 'positive', time: '7 saat önce', source: 'The Verge',
  },
  {
    title: 'Petrol Fiyatları OPEC Kararıyla Yükseldi',
    summary: 'OPEC+, üretim kesintilerini 3 ay daha uzatma kararı aldı. Brent ham petrol $85\'in üzerine çıktı.',
    ticker: 'XLE', impact: 'positive', time: '8 saat önce', source: 'Reuters',
  },
  {
    title: 'Coinbase\'e SEC Soruşturması',
    summary: 'SEC, Coinbase\'in staking hizmetleriyle ilgili yeni bir soruşturma başlattı. Hisseler borsada %4 düştü.',
    ticker: 'COIN', impact: 'negative', time: '9 saat önce', source: 'WSJ',
  },
]

export default function NewsPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Newspaper className="w-4 h-4 text-finma-primary" />
        <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
          Şirket Haberleri
        </span>
        <span className="text-[10px] text-finma-text-dim ml-2">Son 24 saat</span>
      </div>

      <div className="space-y-3">
        {NEWS_DATA.map((news, idx) => (
          <Card key={idx} padding="sm">
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                news.impact === 'positive' ? 'bg-finma-green/20' :
                news.impact === 'negative' ? 'bg-finma-red/20' : 'bg-finma-yellow/20'
              )}>
                {news.impact === 'positive' ? <TrendingUp className="w-4 h-4 text-finma-green" /> :
                 news.impact === 'negative' ? <TrendingDown className="w-4 h-4 text-finma-red" /> :
                 <AlertCircle className="w-4 h-4 text-finma-yellow" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] bg-finma-primary/20 text-finma-primary px-1.5 py-0.5 rounded font-bold finma-number">
                    {news.ticker}
                  </span>
                  <h3 className="text-sm font-semibold text-finma-text">{news.title}</h3>
                </div>
                <p className="text-xs text-finma-text-muted leading-relaxed mb-2">{news.summary}</p>
                <div className="flex items-center gap-3 text-[10px] text-finma-text-dim">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {news.time}</span>
                  <span>{news.source}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
