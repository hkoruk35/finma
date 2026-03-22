'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { cn, formatCurrency, getPnlColor } from '@/lib/utils'
import { usePortfolioSummary, useTrades } from '@/hooks/usePortfolio'
import { mockTrades, mockPortfolio } from '@/lib/mock-data'
import { useTerminalStore } from '@/store/terminal'
import type { PortfolioSnapshot } from '@/types'
import { Zap, Plus, X, ChevronDown, RefreshCw, CheckCircle2, RotateCcw, DollarSign, Edit3 } from 'lucide-react'
import { TierGate } from '@/components/auth/TierGate'
import { api } from '@/lib/api-client'

export default function OperationsPage() {
  return (
    <TierGate tier="pro">
      <OperationsContent />
    </TierGate>
  )
}

const PRODUCT_TYPES = ['Stock', 'ETF', 'Call', 'Put', 'Forex', 'Oil', 'Bitcoin', 'Ethereum']

interface NewTradeForm {
  ticker: string
  direction: 'LONG' | 'SHORT'
  entry_price: string
  stop_loss: string
  target_price: string
  qty: string
  strategy: string
  product_type: string
}

function OperationsContent() {
  const { data: portfolioData, refetch: refetchSummary } = usePortfolioSummary()
  const { data: tradesData, refetch: refetchTrades } = useTrades('OPEN')
  const { setChartSymbol } = useTerminalStore()

  const portfolio = (portfolioData || mockPortfolio) as PortfolioSnapshot
  const allTrades = tradesData || mockTrades
  const openTrades = allTrades.filter((t) => t.status === 'OPEN')
  const totalPnl = openTrades.reduce((sum, t) => sum + t.pnl, 0)

  const [showAddForm, setShowAddForm] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [exitPrices, setExitPrices] = useState<Record<string, string>>({})
  const [showExitInput, setShowExitInput] = useState<string | null>(null)

  // Başlangıç sermayesi ve Limitler (Backend + LocalStorage fallback)
  const [startCapital, setStartCapital] = useState<number>(10000)
  const [riskLimit, setRiskLimit] = useState<number>(2.0)
  
  const [editingCapital, setEditingCapital] = useState(false)
  const [capitalInput, setCapitalInput] = useState('')
  
  const [editingRisk, setEditingRisk] = useState(false)
  const [riskInput, setRiskInput] = useState('')
  
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    // Backend'den gerçek sermaye ve limitleri çek
    api.getPortfolioSettings().then(settings => {
      setStartCapital(settings.initial_capital)
      setRiskLimit(settings.risk_per_trade || 2.0)
    }).catch(() => {
      const saved = localStorage.getItem('finma_start_capital')
      if (saved) setStartCapital(parseFloat(saved))
    })
  }, [])

  function refetchAll() {
    refetchSummary?.()
    refetchTrades?.()
  }

  async function saveSettings(capital?: number, risk?: number) {
    const finalCapital = capital ?? startCapital
    const finalRisk = risk ?? riskLimit
    
    try {
      await api.updatePortfolioSettings(finalCapital, finalRisk)
      if (capital !== undefined) setStartCapital(capital)
      if (risk !== undefined) setRiskLimit(risk)
      
      localStorage.setItem('finma_start_capital', String(finalCapital))
      refetchSummary?.()
    } catch (err) {
      console.error('Failed to update portfolio settings:', err)
    }
    setEditingCapital(false)
    setEditingRisk(false)
  }

  async function handleResetAll() {
    if (!confirm('Tüm verileri sıfırlamak istediğinize emin misiniz? Bu işlem tüm geçmişi temizler.')) return
    setResetting(true)
    try {
      await api.resetPortfolio()
      refetchAll()
    } catch (err) {
      console.error('Reset error:', err)
    } finally {
      setResetting(false)
    }
  }

  const [form, setForm] = useState<NewTradeForm>({
    ticker: '',
    direction: 'LONG',
    entry_price: '',
    stop_loss: '',
    target_price: '',
    qty: '',
    strategy: 'Swing',
    product_type: 'Stock',
  })

  function updateForm(field: keyof NewTradeForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleAddTrade(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)
    try {
      await api.createTrade({
        ticker: form.ticker.toUpperCase(),
        direction: form.direction,
        entry_price: parseFloat(form.entry_price),
        stop_loss: parseFloat(form.stop_loss),
        target_price: parseFloat(form.target_price),
        qty: parseFloat(form.qty),
        strategy: form.strategy || 'Manuel',
        product_type: form.product_type || 'Stock',
      })
      setForm({ ticker: '', direction: 'LONG', entry_price: '', stop_loss: '', target_price: '', qty: '', strategy: 'Swing', product_type: 'Stock' })
      setShowAddForm(false)
      refetchAll()
    } catch (err: any) {
      setAddError(err.message || 'Pozisyon eklenemedi.')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleCloseTrade(tradeId: string) {
    const exitPrice = exitPrices[tradeId]
    if (!exitPrice) {
      setShowExitInput(tradeId)
      return
    }
    setClosingId(tradeId)
    try {
      await api.closeTrade(tradeId, parseFloat(exitPrice))
      setShowExitInput(null)
      setExitPrices(prev => { const n = { ...prev }; delete n[tradeId]; return n })
      refetchAll()
    } catch (err) {
      // ignore
    } finally {
      setClosingId(null)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Üst Özet Kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card padding="sm" className="flex flex-col gap-1">
          <span className="text-[10px] text-finma-text-dim uppercase">Açık Pozisyon</span>
          <span className="finma-number text-xl font-bold text-white">{openTrades.length}</span>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1">
          <span className="text-[10px] text-finma-text-dim uppercase">Toplam PnL</span>
          <span className={cn('finma-number text-xl font-bold', getPnlColor(totalPnl))}>
            {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
          </span>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1">
          <span className="text-[10px] text-finma-text-dim uppercase">Net Likidite</span>
          <span className="finma-number text-xl font-bold text-white">{formatCurrency(portfolio.net_liquidation)}</span>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-finma-text-dim uppercase">Ana Sermaye</span>
            <button onClick={() => { setEditingCapital(true); setCapitalInput(String(startCapital)) }}
              className="text-finma-text-dim hover:text-finma-primary transition-colors" title="Sermaye ayarla">
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
          {editingCapital ? (
            <div className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-finma-text-dim" />
              <input type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)}
                className="w-full bg-finma-bg border border-finma-border rounded px-1.5 py-0.5 text-sm finma-number text-white focus:outline-none focus:border-finma-primary"
                autoFocus onKeyDown={e => e.key === 'Enter' && saveSettings(parseFloat(capitalInput), undefined)} />
              <button onClick={() => saveSettings(parseFloat(capitalInput), undefined)} className="text-[9px] bg-finma-green/20 text-finma-green px-1.5 py-0.5 rounded font-bold">OK</button>
            </div>
          ) : (
            <span className="finma-number text-xl font-bold text-finma-cyan">{formatCurrency(startCapital)}</span>
          )}
        </Card>

        <Card padding="sm" className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-finma-text-dim uppercase">Risk Limiti</span>
            <button onClick={() => { setEditingRisk(true); setRiskInput(String(riskLimit)) }}
              className="text-finma-text-dim hover:text-finma-primary transition-colors" title="Risk limiti ayarla">
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
          {editingRisk ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-finma-text-dim font-bold">%</span>
              <input type="number" value={riskInput} onChange={e => setRiskInput(e.target.value)}
                className="w-full bg-finma-bg border border-finma-border rounded px-1.5 py-0.5 text-sm finma-number text-white focus:outline-none focus:border-finma-primary"
                autoFocus onKeyDown={e => e.key === 'Enter' && saveSettings(undefined, parseFloat(riskInput))} />
              <button onClick={() => saveSettings(undefined, parseFloat(riskInput))} className="text-[9px] bg-finma-green/20 text-finma-green px-1.5 py-0.5 rounded font-bold">OK</button>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="finma-number text-xl font-bold text-finma-yellow">%{riskLimit}</span>
              <span className="text-[9px] text-finma-text-dim">/ Pozisyon</span>
            </div>
          )}
        </Card>
        <Card padding="sm" className="flex flex-col gap-1">
          <span className="text-[10px] text-finma-text-dim uppercase">Kullanılabilir Nakit</span>
          <span className="finma-number text-xl font-bold text-finma-green">
            {formatCurrency(portfolio.cash_available)}
          </span>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1 items-center justify-center">
          <button
            onClick={handleResetAll}
            disabled={resetting}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-bold transition-all bg-finma-red/10 hover:bg-finma-red/20 text-finma-red border border-finma-red/20 disabled:opacity-30"
          >
            <RotateCcw className={cn('w-3.5 h-3.5', resetting && 'animate-spin')} />
            {resetting ? 'Sıfırlanıyor...' : 'Verileri Sıfırla'}
          </button>
          <span className="text-[9px] text-finma-text-dim">Tüm geçmişi sil</span>
        </Card>
      </div>

      {/* Detaylı Aktif Operasyonlar Listesi */}
      <Card padding="sm">
        <div className="flex items-center justify-between px-1 pb-3 border-b border-finma-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-finma-yellow" />
            <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
              Operasyon Merkezi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] finma-number text-finma-text-dim px-2 py-1 bg-white/5 rounded-md border border-white/10">
              {openTrades.length} AKTİF EMİR
            </span>
            <button
              onClick={() => { setShowAddForm(v => !v); setAddError(null) }}
              className={cn(
                'flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-bold transition-all shadow-lg',
                showAddForm
                  ? 'bg-finma-card border border-finma-border text-finma-text-dim'
                  : 'bg-finma-primary text-white hover:scale-105 active:scale-95'
              )}
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddForm ? 'Kapat' : 'Yeni Pozisyon'}
            </button>
          </div>
        </div>

        {/* Pozisyon Ekleme Formu */}
        {showAddForm && (
          <form onSubmit={handleAddTrade} className="mt-3 mb-4 p-3 bg-finma-card-hover rounded-lg border border-finma-border/60">
            <div className="text-xs font-semibold text-finma-text mb-3 flex items-center gap-2">
              <Plus className="w-3 h-3 text-finma-green" />
              Yeni Açık Pozisyon
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Sembol */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider">Sembol</label>
                <div className="relative">
                  <input
                    required
                    value={form.ticker}
                    onChange={e => updateForm('ticker', e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full bg-finma-bg border border-finma-border rounded-lg px-3 py-2 text-sm finma-number text-white placeholder-finma-text-dim focus:outline-none focus:ring-1 focus:ring-finma-primary/50 uppercase font-bold"
                  />
                </div>
              </div>
              {/* Yön */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider">Yön</label>
                <div className="flex bg-finma-bg p-1 border border-finma-border rounded-lg">
                  <button
                    type="button"
                    onClick={() => updateForm('direction', 'LONG')}
                    className={cn(
                      'flex-1 py-1 text-[11px] rounded-md font-bold transition-all',
                      form.direction === 'LONG'
                        ? 'bg-finma-green text-white shadow-md'
                        : 'text-finma-text-dim hover:text-finma-text'
                    )}
                  >
                    LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => updateForm('direction', 'SHORT')}
                    className={cn(
                      'flex-1 py-1 text-[11px] rounded-md font-bold transition-all',
                      form.direction === 'SHORT'
                        ? 'bg-finma-red text-white shadow-md'
                        : 'text-finma-text-dim hover:text-finma-text'
                    )}
                  >
                    SHORT
                  </button>
                </div>
              </div>
              {/* Giriş Fiyatı */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider">Fiyat ($)</label>
                <input
                  required
                  type="number" step="0.01" min="0"
                  value={form.entry_price}
                  onChange={e => updateForm('entry_price', e.target.value)}
                  className="bg-finma-bg border border-finma-border rounded-lg px-3 py-2 text-sm finma-number text-white focus:outline-none focus:ring-1 focus:ring-finma-primary/50"
                  placeholder="0.00"
                />
              </div>
              {/* Adet */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider">Adet</label>
                <input
                  required
                  type="number" step="1" min="1"
                  value={form.qty}
                  onChange={e => updateForm('qty', e.target.value)}
                  className="bg-finma-bg border border-finma-border rounded-lg px-3 py-2 text-sm finma-number text-white focus:outline-none focus:ring-1 focus:ring-finma-primary/50"
                  placeholder="10"
                />
              </div>
              {/* Stop Loss */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider text-finma-red/80">Stop ($)</label>
                <input
                  required
                  type="number" step="0.01" min="0"
                  value={form.stop_loss}
                  onChange={e => updateForm('stop_loss', e.target.value)}
                  className="bg-finma-bg border border-finma-red/20 rounded-lg px-3 py-2 text-sm finma-number text-finma-red focus:outline-none focus:ring-1 focus:ring-finma-red/50"
                  placeholder="0.00"
                />
              </div>
              {/* Hedef */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider text-finma-green/80">Hedef ($)</label>
                <input
                  required
                  type="number" step="0.01" min="0"
                  value={form.target_price}
                  onChange={e => updateForm('target_price', e.target.value)}
                  className="bg-finma-bg border border-finma-green/20 rounded-lg px-3 py-2 text-sm finma-number text-finma-green focus:outline-none focus:ring-1 focus:ring-finma-green/50"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Strateji */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider">Hızlı İşlemler</label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => updateForm('qty', '10')} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] hover:bg-white/10">10 Adet</button>
                  <button type="button" onClick={() => updateForm('qty', '50')} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] hover:bg-white/10">50 Adet</button>
                  <button type="button" onClick={() => updateForm('qty', '100')} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] hover:bg-white/10">100 Adet</button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider">Ürün</label>
                <select
                  value={form.product_type}
                  onChange={e => updateForm('product_type', e.target.value)}
                  className="bg-finma-bg border border-finma-border rounded-lg px-3 py-1.5 text-xs text-finma-text focus:outline-none focus:border-finma-primary cursor-pointer"
                >
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <label className="text-[10px] text-finma-text-dim uppercase font-bold tracking-wider ml-2">Strateji</label>
                <select
                  value={form.strategy}
                  onChange={e => updateForm('strategy', e.target.value)}
                  className="bg-finma-bg border border-finma-border rounded-lg px-3 py-1.5 text-xs text-finma-text focus:outline-none focus:border-finma-primary cursor-pointer"
                >
                  <option value="Swing">Swing Trading</option>
                  <option value="Breakout">Breakout Strategy</option>
                  <option value="Momentum">Momentum Follow</option>
                  <option value="Mean Reversion">Mean Reversion</option>
                  <option value="Manuel">Manuel Giriş</option>
                </select>

                <div className="h-6 w-px bg-white/10 mx-2" />
                
                {addError && (
                  <span className="text-xs text-finma-red font-medium mr-2">{addError}</span>
                )}
                <button
                  type="submit"
                  disabled={addLoading}
                  className="bg-finma-primary text-white text-xs px-6 py-2 rounded-lg font-bold transition-all hover:shadow-lg hover:shadow-finma-primary/20 disabled:opacity-50 active:scale-95 flex items-center gap-2"
                >
                  {addLoading ? (
                    <><RefreshCw className="w-3 h-3 animate-spin" /> İŞLENİYOR</>
                  ) : (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-white/70" /> POZİSYON AÇ</>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-finma-border text-finma-text-dim">
                <th className="text-left px-3 py-2 font-medium">Sembol</th>
                <th className="text-left px-2 py-2 font-medium">Yön</th>
                <th className="text-left px-2 py-2 font-medium hidden md:table-cell">Strateji</th>
                <th className="text-right px-2 py-2 font-medium">Adet</th>
                <th className="text-right px-2 py-2 font-medium">Giriş $</th>
                <th className="text-right px-2 py-2 font-medium">Güncel $</th>
                <th className="text-right px-2 py-2 font-medium">Stop</th>
                <th className="text-right px-2 py-2 font-medium">Hedef</th>
                <th className="text-right px-2 py-2 font-medium">PnL ($)</th>
                <th className="text-right px-2 py-2 font-medium">PnL (%)</th>
                <th className="text-right px-2 py-2 font-medium hidden md:table-cell">Tarih</th>
                <th className="text-right px-2 py-2 font-medium">Kapat</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map((trade) => (
                <>
                  <tr
                    key={trade.id}
                    onClick={() => setChartSymbol(trade.ticker)}
                    className="border-b border-finma-border/50 hover:bg-finma-card-hover cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3">
                      <span className="font-bold text-finma-primary finma-number">{trade.ticker}</span>
                    </td>
                    <td className="px-2 py-3">
                      <Badge variant={trade.direction === 'LONG' ? 'buy' : 'sell'}>
                        {trade.direction}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 text-finma-text-muted hidden md:table-cell">{trade.strategy}</td>
                    <td className="px-2 py-3 text-right finma-number text-white">{trade.qty}</td>
                    <td className="px-2 py-3 text-right finma-number text-finma-text">${trade.entry_price.toFixed(2)}</td>
                    <td className="px-2 py-3 text-right finma-number text-white font-semibold">${trade.current_price.toFixed(2)}</td>
                    <td className="px-2 py-3 text-right finma-number text-finma-red">${trade.stop_loss.toFixed(2)}</td>
                    <td className="px-2 py-3 text-right finma-number text-finma-green">${trade.target_price.toFixed(2)}</td>
                    <td className={cn('px-2 py-3 text-right finma-number font-semibold', getPnlColor(trade.pnl))}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </td>
                    <td className={cn('px-2 py-3 text-right finma-number', getPnlColor(trade.pnl_pct))}>
                      {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
                    </td>
                    <td className="px-2 py-3 text-right finma-number text-finma-text-dim hidden md:table-cell">{trade.entry_date}</td>
                    <td className="px-2 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {showExitInput === trade.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            autoFocus
                            type="number"
                            step="0.01"
                            placeholder={trade.current_price.toFixed(2)}
                            value={exitPrices[trade.id] || ''}
                            onChange={e => setExitPrices(prev => ({ ...prev, [trade.id]: e.target.value }))}
                            className="w-20 bg-finma-bg border border-finma-border rounded px-1.5 py-1 text-xs finma-number text-white focus:outline-none focus:border-finma-primary"
                          />
                          <button
                            onClick={() => handleCloseTrade(trade.id)}
                            disabled={closingId === trade.id}
                            className="text-[10px] bg-finma-red/20 hover:bg-finma-red/30 text-finma-red px-2 py-1 rounded font-bold transition-colors disabled:opacity-50"
                          >
                            {closingId === trade.id ? '...' : 'Kapat'}
                          </button>
                          <button
                            onClick={() => { setShowExitInput(null); setExitPrices(prev => { const n = { ...prev }; delete n[trade.id]; return n }) }}
                            className="text-[10px] text-finma-text-dim hover:text-finma-text"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowExitInput(trade.id)}
                          className="flex items-center gap-1 text-[10px] bg-finma-red/10 hover:bg-finma-red/20 text-finma-red px-2 py-1 rounded font-bold transition-colors ml-auto"
                        >
                          <X className="w-3 h-3" /> Kaldır
                        </button>
                      )}
                    </td>
                  </tr>
                  {showExitInput === trade.id && (
                    <tr key={`exit-note-${trade.id}`} className="bg-finma-card-hover/30">
                      <td colSpan={12} className="px-3 py-1 text-[10px] text-finma-text-dim">
                        Çıkış fiyatı girin ve "Kapat" butonuna tıklayın
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {openTrades.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <span className="text-sm text-finma-text-dim">Henüz açık pozisyon bulunmuyor.</span>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 bg-finma-green/20 hover:bg-finma-green/30 text-finma-green text-xs px-4 py-2 rounded font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> İlk Pozisyonu Ekle
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
