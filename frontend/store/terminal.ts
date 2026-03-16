'use client'

import { create } from 'zustand'

interface TerminalState {
  sidebarOpen: boolean
  activeSection: string
  selectedTicker: string
  chartSymbol: string
  setSidebarOpen: (open: boolean) => void
  setActiveSection: (section: string) => void
  setSelectedTicker: (ticker: string) => void
  setChartSymbol: (symbol: string) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sidebarOpen: true,
  activeSection: 'dashboard',
  selectedTicker: 'AAPL',
  chartSymbol: 'AAPL',
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveSection: (section) => set({ activeSection: section }),
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker, chartSymbol: ticker }),
  setChartSymbol: (symbol) => set({ chartSymbol: symbol }),
}))
