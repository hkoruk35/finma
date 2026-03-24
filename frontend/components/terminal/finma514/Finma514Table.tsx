'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Finma514Stock, FinmaLang } from '@/types/finma514'
import { CATEGORY_LABELS, TAG_CONFIG } from '@/types/finma514'
import { TierBadge, TierDot } from './TierBadge'
import { ScoreBarCompact } from './ScoreBar'
import { StockDetailModal } from './StockDetailModal'
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown, Target } from 'lucide-react'

interface Finma514TableProps {
  stocks: Finma514Stock[]
  lang: FinmaLang
  onLangChange: (lang: FinmaLang) => void
  onAddToTracking?: (stock: Finma514Stock) => void
}

type TabKey = 'all' | 'core_picks' | 'sector_leaders' | 'high_volume' | 'top_gainers' | 'oversold_losers'

const TABS: { key: TabKey; label: string; icon: string; tag?: string }[] = [
  { key: 'all',             label: 'Tümü (54)',         icon: '📋' },
  { key: 'core_picks',      label: 'Core',              icon: '⭐', tag: 'CORE' },
  { key: 'sector_leaders',  label: 'Sektör',            icon: '📊', tag: 'SECTOR' },
  { key: 'high_volume',     label: 'Hacim',             icon: '🔥', tag: 'VOLUME' },
  { key: 'top_gainers',     label: 'Yükselenler',       icon: '📈', tag: 'GAINER' },
  { key: 'oversold_losers', label: 'Aşırı Satım',       icon: '📉', tag: 'LOSER' },
]

type SortKey = 'score' | 'price' | 'change_1d' | 'rvol' | 'rsi'

function pctCell(val: number) {
  const color = val >= 0 ? 'text-finma-green' : 'text-finma-red'
  const sign  = val >= 0 ? '+' : ''
  return <span className={cn('finma-number', color)}>{sign}{val.toFixed(2)}%</span>
}

export function Finma514Table({ stocks, lang, onLangChange, onAddToTracking }: Finma514TableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [selected,  setSelected]  = useState<Finma514Stock | null>(null)
  const [sortKey,   setSortKey]   = useState<SortKey>('score')
  const [sortAsc,   setSortAsc]   = useState(false)
  const [search,    setSearch]    = useState('')

  const filtered = useMemo(() => {
    let list = stocks

    // Sekme filtresi
    if (activeTab !== 'all') {
      const tab = TABS.find(t => t.key === activeTab)
      if (tab?.tag) list = list.filter(s => s.tag === tab.tag)
    }

    // Arama
    if (search.trim()) {
      const q = search.toUpperCase()
      list = list.filter(s =>
        s.ticker.includes(q) ||
        s.company_name?.toUpperCase().includes(q) ||
        s.sector?.toUpperCase().includes(q)
      )
    }

    // Sıralama
    list = [...list].sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0
      const bv = (b as any)[sortKey] ?? 0
      return sortAsc ? av - bv : bv - av
    })

    return list
  }, [stocks, activeTab, search, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="opacity-20">↕</span>
    return sortAsc
      ? <ChevronUp className="w-3 h-3 inline" />
      : <ChevronDown className="w-3 h-3 inline" />
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: stocks.length }
    TABS.forEach(t => {
      if (t.tag) counts[t.key] = stocks.filter(s => s.tag === t.tag).length
    })
    return counts
  }, [stocks])

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0',
              activeTab === tab.key
                ? 'bg-finma-primary/15 text-finma-primary border border-finma-primary/30'
                : 'text-finma-text-dim hover:text-finma-text hover:bg-white/5 border border-transparent'
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={cn(
              'text-[9px] px-1 rounded',
              activeTab === tab.key ? 'bg-finma-primary/20 text-finma-primary' : 'bg-white/10 text-finma-text-dim'
            )}>
              {tabCounts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Arama */}
      <div className="mt-2">
        <input
          type="text"
          placeholder="Ticker veya şirket ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="finma-input w-full text-xs py-1.5"
        />
      </div>

      {/* Tablo */}
      <div className="mt-2 overflow-x-auto rounded-lg border border-finma-border">
        <table className="w-full min-w-[720px] text-xs border-collapse">
          <thead>
            <tr className="bg-[#0f1520] border-b border-finma-border">
              <th className="px-3 py-2.5 text-left text-finma-text-dim font-medium w-8">#</th>
              <th className="px-3 py-2.5 text-left text-finma-text-dim font-medium">Sembol</th>
              <th className="px-3 py-2.5 text-left text-finma-text-dim font-medium hidden sm:table-cell">Şirket</th>
              <th className="px-3 py-2.5 text-left text-finma-text-dim font-medium hidden md:table-cell">Sektör</th>
              <th className="px-3 py-2.5 text-center text-finma-text-dim font-medium">Tier</th>
              <th
                className="px-3 py-2.5 text-right text-finma-text-dim font-medium cursor-pointer hover:text-finma-text"
                onClick={() => toggleSort('price')}
              >
                Fiyat <SortIcon k="price" />
              </th>
              <th
                className="px-3 py-2.5 text-right text-finma-text-dim font-medium cursor-pointer hover:text-finma-text"
                onClick={() => toggleSort('change_1d')}
              >
                %Gün <SortIcon k="change_1d" />
              </th>
              <th
                className="px-3 py-2.5 text-right text-finma-text-dim font-medium cursor-pointer hover:text-finma-text"
                onClick={() => toggleSort('rvol')}
              >
                RVOL <SortIcon k="rvol" />
              </th>
              <th
                className="px-3 py-2.5 text-right text-finma-text-dim font-medium cursor-pointer hover:text-finma-text"
                onClick={() => toggleSort('rsi')}
              >
                RSI <SortIcon k="rsi" />
              </th>
              <th
                className="px-3 py-2.5 text-right text-finma-text-dim font-medium cursor-pointer hover:text-finma-text w-36"
                onClick={() => toggleSort('score')}
              >
                Skor <SortIcon k="score" />
              </th>
              {onAddToTracking && (
                <th className="px-2 py-2.5 text-center text-finma-text-dim font-medium w-10" title="Takibe Ekle">
                  <Target className="w-3 h-3 inline" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={onAddToTracking ? 11 : 10} className="py-12 text-center text-finma-text-dim text-xs">
                  {search ? 'Arama sonucu bulunamadı.' : 'Veri yükleniyor...'}
                </td>
              </tr>
            ) : filtered.map((stock, idx) => {
              const tagCfg = TAG_CONFIG[stock.tag]
              return (
                <tr
                  key={stock.ticker}
                  onClick={() => setSelected(stock)}
                  className={cn(
                    'border-b border-finma-border/30 cursor-pointer transition-colors duration-100',
                    idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]',
                    'hover:bg-finma-primary/8'
                  )}
                >
                  <td className="px-3 py-2.5 text-finma-text-dim/50">{idx + 1}</td>

                  {/* Ticker + Tier dot */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <TierDot tier={stock.tier} />
                      <span className="font-bold text-finma-primary finma-number tracking-wide">
                        {stock.ticker}
                      </span>
                    </div>
                  </td>

                  {/* Şirket */}
                  <td className="px-3 py-2.5 max-w-[140px] hidden sm:table-cell">
                    <span className="text-finma-text truncate block">{stock.company_name || '—'}</span>
                  </td>

                  {/* Sektör */}
                  <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
                    <span className="text-finma-text-dim">{stock.sector || '—'}</span>
                  </td>

                  {/* Tier badge */}
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <TierBadge tier={stock.tier} />
                  </td>

                  {/* Fiyat */}
                  <td className="px-3 py-2.5 text-right finma-number text-finma-text whitespace-nowrap">
                    ${stock.price?.toFixed(2) ?? '—'}
                  </td>

                  {/* Günlük değişim */}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {pctCell(stock.change_1d ?? 0)}
                  </td>

                  {/* RVOL */}
                  <td className="px-3 py-2.5 text-right finma-number whitespace-nowrap">
                    <span className={cn(
                      stock.rvol >= 1.5 ? 'text-finma-green' : 'text-finma-text-dim'
                    )}>
                      {stock.rvol?.toFixed(2) ?? '—'}x
                    </span>
                  </td>

                  {/* RSI */}
                  <td className="px-3 py-2.5 text-right finma-number whitespace-nowrap">
                    <span className={cn(
                      stock.rsi < 30  ? 'text-finma-red' :
                      stock.rsi > 70  ? 'text-finma-yellow' :
                      stock.rsi >= 40 && stock.rsi <= 65 ? 'text-finma-green' :
                      'text-finma-text-dim'
                    )}>
                      {stock.rsi?.toFixed(1) ?? '—'}
                    </span>
                  </td>

                  {/* Skor */}
                  <td className="px-3 py-2.5 text-right">
                    <ScoreBarCompact score={stock.score ?? 0} />
                  </td>

                  {/* Takibe Ekle */}
                  {onAddToTracking && (
                    <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onAddToTracking(stock)}
                        title={`${stock.ticker} takibe ekle`}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-finma-primary/20 text-finma-text-dim hover:text-finma-primary transition-all"
                      >
                        <Target className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Sonuç sayısı */}
      <p className="text-[10px] text-finma-text-dim mt-1.5">
        {filtered.length} hisse gösteriliyor
        {search && ` · "${search}" için filtrelendi`}
      </p>

      {/* Detail Modal */}
      {selected && (
        <StockDetailModal
          stock={selected}
          lang={lang}
          onClose={() => setSelected(null)}
          onLangChange={onLangChange}
        />
      )}
    </>
  )
}
