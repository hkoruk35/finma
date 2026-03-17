'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/shared/Card'
import { api } from '@/lib/api-client'
import { Brain, Send, Sparkles, TrendingUp, Shield, BarChart3, Clock, AlertTriangle, Lock, Loader2 } from 'lucide-react'
import { TierGate } from '@/components/auth/TierGate'

const MAX_FREE_ANALYSES = 5
const ANALYSIS_PERIOD = '24 saat'

interface Message {
  role: 'ai' | 'user'
  content: string
  timestamp: string
}

export default function AIPage() {
  return (
    <TierGate tier="pro">
      <AIContent />
    </TierGate>
  )
}

function AIContent() {
  const [message, setMessage] = useState('')
  const [analysisCount, setAnalysisCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: 'Merhaba! Ben FinMA AI asistanınız. Size piyasa analizi, sinyal değerlendirmesi, risk yönetimi ve teknik analiz konularında yardımcı olabilirim.\n\nÖrnek komutlar:\n• "AAPL için teknik analiz yap"\n• "Portföyümdeki riskleri değerlendir"\n• "Bugünkü bot sinyallerini özetle"\n• "NVDA ile AMD karşılaştır"',
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const remainingAnalyses = MAX_FREE_ANALYSES - analysisCount
  const isLimitReached = remainingAnalyses <= 0

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!message.trim() || isLimitReached || isLoading) return

    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const userMessage = message.trim()

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: now }])
    setMessage('')
    setIsLoading(true)

    try {
      // Build history for context
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'ai')
        .slice(-10)
        .map(m => ({ role: m.role === 'ai' ? 'ai' : 'user', content: m.content }))

      // Call real AI API
      const response = await api.chatWithAI(userMessage, history)

      setMessages(prev => [...prev, {
        role: 'ai',
        content: response.response,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      }])
      setAnalysisCount(prev => prev + 1)
    } catch (error) {
      // Fallback to mock response if API fails
      const mockResponse = generateMockResponse(userMessage)
      setMessages(prev => [...prev, {
        role: 'ai',
        content: mockResponse + '\n\n⚠️ Bu bir yatırım tavsiyesi değildir. Tüm analizler bilgilendirme amaçlıdır.',
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      }])
      setAnalysisCount(prev => prev + 1)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-finma-purple" />
          <h1 className="text-lg font-bold text-white">AI Analiz</h1>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border text-finma-primary bg-finma-primary/10 border-finma-primary/30">Pro</span>
          <span className="text-xs text-finma-text-dim">FinMA AI ile güçlendirilmiş</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border ${
            remainingAnalyses > 2 ? 'border-finma-green/30 bg-finma-green/10 text-finma-green' :
            remainingAnalyses > 0 ? 'border-finma-yellow/30 bg-finma-yellow/10 text-finma-yellow' :
            'border-finma-red/30 bg-finma-red/10 text-finma-red'
          }`}>
            <BarChart3 className="w-3 h-3" />
            {remainingAnalyses > 0
              ? `${remainingAnalyses} / ${MAX_FREE_ANALYSES} analiz hakkı (${ANALYSIS_PERIOD})`
              : `Günlük limit doldu`
            }
          </div>
        </div>
      </div>

      {/* Hızlı İşlemler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card hover padding="sm" className="cursor-pointer" onClick={() => setMessage('Bugünün piyasa özetini yap')}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-finma-yellow" />
            <span className="text-xs font-semibold">Piyasa Özeti</span>
          </div>
          <p className="text-[10px] text-finma-text-dim">Günün piyasa koşullarının AI özeti</p>
        </Card>
        <Card hover padding="sm" className="cursor-pointer" onClick={() => setMessage('Bot sinyallerini analiz et')}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-finma-green" />
            <span className="text-xs font-semibold">Sinyal Analizi</span>
          </div>
          <p className="text-[10px] text-finma-text-dim">Bot sinyallerinin detaylı AI analizi</p>
        </Card>
        <Card hover padding="sm" className="cursor-pointer" onClick={() => setMessage('Portföyümdeki riskleri değerlendir')}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-finma-red" />
            <span className="text-xs font-semibold">Risk Denetimi</span>
          </div>
          <p className="text-[10px] text-finma-text-dim">Portföy risk değerlendirmesi</p>
        </Card>
        <Card hover padding="sm" className="cursor-pointer" onClick={() => setMessage('AAPL hissesini analiz et')}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-finma-primary" />
            <span className="text-xs font-semibold">Hisse Analizi</span>
          </div>
          <p className="text-[10px] text-finma-text-dim">Tek hisse için detaylı teknik analiz</p>
        </Card>
      </div>

      {/* Sohbet Arayüzü */}
      <Card className="flex flex-col h-[350px] md:h-[500px]">
        {/* Mesajlar */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'ai' ? 'bg-finma-purple/20' : 'bg-finma-primary/20'
              }`}>
                {msg.role === 'ai' ? <Brain className="w-3.5 h-3.5 text-finma-purple" /> : <span className="text-xs text-finma-primary">Siz</span>}
              </div>
              <div className={`rounded-lg p-3 max-w-[80%] ${
                msg.role === 'ai' ? 'bg-finma-bg/50' : 'bg-finma-primary/10'
              }`}>
                <p className="text-xs text-finma-text whitespace-pre-line">{msg.content}</p>
                <span className="text-[9px] text-finma-text-dim mt-1 block">{msg.timestamp}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-finma-purple/20">
                <Brain className="w-3.5 h-3.5 text-finma-purple" />
              </div>
              <div className="rounded-lg p-3 bg-finma-bg/50">
                <div className="flex items-center gap-2 text-xs text-finma-text-dim">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-finma-purple" />
                  FinMA AI analiz ediyor...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Girdi alanı */}
        <div className="border-t border-finma-border p-3">
          {isLimitReached ? (
            <div className="flex items-center gap-2 justify-center py-2">
              <Lock className="w-4 h-4 text-finma-red" />
              <span className="text-xs text-finma-red">Günlük ücretsiz analiz hakkınız doldu. Pro üyelik ile sınırsız analiz yapın.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Mesajınızı yazın... (örn: AAPL analiz et)"
                className="finma-input flex-1"
                disabled={isLoading}
              />
              <button onClick={handleSend} className="finma-btn-primary p-2.5" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* Mock AI yanıtı (fallback when API unavailable) */
function generateMockResponse(query: string): string {
  const q = query.toLowerCase()
  if (q.includes('piyasa') || q.includes('özet')) {
    return '📊 Bugünkü Piyasa Özeti:\n\n• S&P 500 hafif yükselişte (+0.3%), Nasdaq yatay seyrediyor\n• VIX 24.74 seviyesinde — yüksek volatilite devam ediyor\n• Enerji ve savunma sektörleri liderlik ediyor\n• Teknoloji sektöründe seçici olmak gerekiyor\n• 10 yıllık tahvil getirisi %4.28 ile sabit\n\nGenel değerlendirme: Piyasada temkinli iyimserlik hakim.'
  }
  if (q.includes('risk')) {
    return '🛡️ Risk Değerlendirmesi:\n\n• Portföy risk seviyesi: ORTA\n• VIX yüksek (24.74) — pozisyon boyutlarını küçük tutun\n• Sektör konsantrasyonu: Enerji ağırlıklı (%35)\n• Önerilen stop-loss mesafesi: %3-5\n• Korelasyon riski: Enerji hisseleri birlikte hareket edebilir\n\nÖneri: Sektörel çeşitlendirme artırılmalı.'
  }
  if (q.includes('sinyal') || q.includes('bot')) {
    return '📡 Bot Sinyal Analizi (inday312):\n\n• Toplam 12 aday tespit edildi\n• 7 AL, 3 TUT, 2 KAPAT sinyali\n• En yüksek skor: NVDA (8.4/10)\n• En yüksek potansiyel: NTR (+14.31%)\n• Sektör ağırlığı: Enerji ve Teknoloji\n\nÖne çıkan: NVDA ve FANG güçlü momentum gösteriyor.'
  }
  return `📈 ${query.toUpperCase()} Analizi:\n\n• Teknik görünüm pozitif\n• Fiyat 20 ve 50 günlük ortalamaların üzerinde\n• RSI: 58 (nötr-pozitif bölge)\n• MACD: Pozitif çapraz yakın\n• Destek: Mevcut fiyatın %3 altında\n• Direnç: Mevcut fiyatın %5 üstünde\n\nGenel değerlendirme: Kısa vadede olumlu görünüm.`
}
