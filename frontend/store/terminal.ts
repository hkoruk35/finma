'use client'

import { create } from 'zustand'

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
  /** Sets the chart symbol for FinMA Chart Engine. */
  setChartSymbol: (symbol: string) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  activeSection: 'dashboard',
  selectedTicker: 'AAPL',
  chartSymbol: 'AAPL',
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setActiveSection: (section) => set({ activeSection: section }),
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker, chartSymbol: ticker }),
  setChartSymbol: (symbol) => set({ chartSymbol: symbol }),
}))
