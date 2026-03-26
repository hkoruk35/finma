'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface WinnerCard {
  ticker: string
  aiPrediction: string
  actualPercentage: number
  status: 'win' | 'loss'
  changePercent: number
  timestamp: string
}

export default function WinnersYesterdayPage() {
  const { user } = useAuthStore()
  const [winners, setWinners] = useState<WinnerCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data - Gerçek API'den gelecek
    const mockWinners: WinnerCard[] = [
      {
        ticker: 'AVGO',
        aiPrediction: 'Breakout sonrası momentum devam edebilir, 120$ direnci kırılırsa hızlı ivmelenme olası.',
        actualPercentage: 4.2,
        status: 'win',
        changePercent: 4.2,
        timestamp: 'Dün, 14:32'
      },
      {
        ticker: 'TSLA',
        aiPrediction: 'Yüksek hacimle dirençten break bekleniyor.',
        actualPercentage: 2.8,
        status: 'win',
        changePercent: 2.8,
        timestamp: 'Dün, 13:15'
      },
      {
        ticker: 'MSFT',
        aiPrediction: 'Teknik göstergelerde güçlü al sinyali.',
        actualPercentage: 1.9,
        status: 'win',
        changePercent: 1.9,
        timestamp: 'Dün, 11:47'
      },
    ]

    setTimeout(() => {
      setWinners(mockWinners)
      setLoading(false)
    }, 500)
  }, [])

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-finma-text mb-1">⏪ Dünün Kazandıranları</h1>
        <p className="text-finma-text-dim text-sm">AI analizi dün hangi hisseleri doğru bildi? İşte kanıt.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-finma-bg border border-finma-border rounded-lg p-3">
          <div className="text-finma-text-dim text-xs mb-1">Doğru Tahmin</div>
          <div className="text-xl md:text-2xl font-bold text-emerald-500">{winners.filter(w => w.status === 'win').length}</div>
        </div>
        <div className="bg-finma-bg border border-finma-border rounded-lg p-3">
          <div className="text-finma-text-dim text-xs mb-1">Ort. Kazanç</div>
          <div className="text-xl md:text-2xl font-bold text-finma-primary">
            {winners.length > 0
              ? `+${(winners.reduce((a, b) => a + b.changePercent, 0) / winners.length).toFixed(2)}%`
              : '—'
            }
          </div>
        </div>
        <div className="bg-finma-bg border border-finma-border rounded-lg p-3">
          <div className="text-finma-text-dim text-xs mb-1">Doğruluk Oranı</div>
          <div className="text-xl md:text-2xl font-bold text-amber-500">100%</div>
        </div>
        <div className="bg-finma-bg border border-finma-border rounded-lg p-3">
          <div className="text-finma-text-dim text-xs mb-1">Maksimum Kazanç</div>
          <div className="text-xl md:text-2xl font-bold text-green-500">
            {winners.length > 0 ? `+${Math.max(...winners.map(w => w.changePercent)).toFixed(2)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Winners Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-finma-text-dim">Yükleniyor...</div>
        </div>
      ) : winners.length === 0 ? (
        <div className="text-center py-12 bg-finma-bg border border-finma-border rounded-lg">
          <div className="text-finma-text-dim">Dünün kazandıranları henüz yok</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {winners.map((winner) => (
            <div
              key={winner.ticker}
              className="bg-finma-bg border border-finma-border rounded-lg p-4 hover:border-finma-primary/50 transition-all duration-200"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-lg font-bold text-finma-text">{winner.ticker}</div>
                  <div className="text-[10px] text-finma-text-dim">{winner.timestamp}</div>
                </div>
                <div className={cn(
                  'flex items-center gap-1 font-bold text-sm',
                  winner.status === 'win' ? 'text-green-500' : 'text-red-500'
                )}>
                  {winner.status === 'win' ? (
                    <>
                      <ArrowUpRight className="w-4 h-4" />
                      +{winner.changePercent}%
                    </>
                  ) : (
                    <>
                      <ArrowDownLeft className="w-4 h-4" />
                      {winner.changePercent}%
                    </>
                  )}
                </div>
              </div>

              {/* AI Prediction */}
              <div className="bg-finma-primary/5 border border-finma-primary/20 rounded-md p-2.5 mb-3">
                <div className="text-[10px] text-finma-primary font-semibold mb-1">🧠 AI Ne Demişti?</div>
                <div className="text-xs text-finma-text leading-relaxed">{winner.aiPrediction}</div>
              </div>

              {/* Result */}
              <div className="bg-green-500/5 border border-green-500/20 rounded-md p-2.5">
                <div className="text-[10px] text-green-500 font-semibold mb-1">✅ Gerçekleşen</div>
                <div className="text-xs text-finma-text">Hedef bölgeye nokta atışı ulaştı.</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      {!loading && winners.length > 0 && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4 text-center">
          <p className="text-sm text-finma-text-dim mb-2">Bu sinyalleri real-time almak ister misin?</p>
          <a
            href="/pricing"
            className="inline-block bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200 hover:shadow-lg"
          >
            Pro'ya Geç →
          </a>
        </div>
      )}
    </div>
  )
}
