'use client'

import { create } from 'zustand'
import { toTvSymbol, DEFAULT_CHART_SYMBOL } from '@/lib/tv-symbols'

interface TerminalState {
  sidebarOpen: boolean
  mobileMenuOpen: boolean
  activeSection: string
  selectedTicker: string
  chartSymbol: string
  setSidebarOpen: (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void
  setActiveSection: (section: string) => void
  setSelectedTicker: (ticker: string) => void
  /**
   * Sets the TradingView chart symbol.
   * Automatically converts to exchange-prefixed format via toTvSymbol().
   * Safe to call with raw symbols like 'SPX', 'BTC', 'XLK', 'NVDA' etc.
   */
  setChartSymbol: (symbol: string) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  activeSection: 'dashboard',
  selectedTicker: 'AAPL',
  chartSymbol: DEFAULT_CHART_SYMBOL,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setActiveSection: (section) => set({ activeSection: section }),
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker, chartSymbol: toTvSymbol(ticker) }),
  setChartSymbol: (symbol) => set({ chartSymbol: toTvSymbol(symbol) }),
}))
