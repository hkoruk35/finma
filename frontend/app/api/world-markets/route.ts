import { NextResponse } from 'next/server'

export const revalidate = 180 // 3 dakika ISR cache

// ─── Bölge & sembol tanımları ────────────────────────────────────────────────
const REGIONS = [
  {
    id: 'abd', label: 'ABD', icon: '🇺🇸',
    indices: [
      { symbol: 'ES=F',  label: 'S&P 500',      full: 'S&P 500 Futures'      },
      { symbol: 'NQ=F',  label: 'Nasdaq-100',    full: 'Nasdaq 100 Futures'   },
      { symbol: 'YM=F',  label: 'Dow Jones',     full: 'Dow Jones Futures'    },
      { symbol: 'RTY=F', label: 'Russell 2000',  full: 'Russell 2000 Futures' },
      { symbol: '^VIX',  label: 'VIX',           full: 'Volatilite Endeksi'   },
    ],
  },
  {
    id: 'avrupa', label: 'Avrupa', icon: '🇪🇺',
    indices: [
      { symbol: '^STOXX50E', label: 'Euro Stoxx 50', full: 'Euro Stoxx 50'         },
      { symbol: '^GDAXI',    label: 'DAX',            full: 'DAX 40 (Almanya)'      },
      { symbol: '^FTSE',     label: 'FTSE 100',       full: 'FTSE 100 (İngiltere)'  },
      { symbol: '^FCHI',     label: 'CAC 40',         full: 'CAC 40 (Fransa)'       },
      { symbol: '^IBEX',     label: 'IBEX 35',        full: 'IBEX 35 (İspanya)'     },
      { symbol: '^AEX',      label: 'AEX',            full: 'AEX (Hollanda)'        },
      { symbol: '^SSMI',     label: 'SMI',            full: 'SMI (İsviçre)'         },
    ],
  },
  {
    id: 'asya', label: 'Asya-Pasifik', icon: '🌏',
    indices: [
      { symbol: '^N225',     label: 'Nikkei 225', full: 'Nikkei 225 (Japonya)'      },
      { symbol: '^HSI',      label: 'Hang Seng',  full: 'Hang Seng (Hong Kong)'     },
      { symbol: '000001.SS', label: 'Shanghai',   full: 'Shanghai Composite (Çin)'  },
      { symbol: '^KS11',     label: 'KOSPI',      full: 'KOSPI (Güney Kore)'        },
      { symbol: '^TWII',     label: 'TAIEX',      full: 'TAIEX (Tayvan)'            },
      { symbol: '^AXJO',     label: 'ASX 200',    full: 'ASX 200 (Avustralya)'      },
      { symbol: '^STI',      label: 'STI',        full: 'Straits Times (Singapur)'  },
      { symbol: '^BSESN',    label: 'Sensex',     full: 'BSE Sensex (Hindistan)'    },
    ],
  },
  {
    id: 'gelismekte', label: 'Gelişmekte Olan', icon: '🌍',
    indices: [
      { symbol: '^BVSP', label: 'Bovespa',  full: 'Bovespa (Brezilya)' },
      { symbol: '^MXX',  label: 'IPC',      full: 'IPC (Meksika)'      },
      { symbol: '^JKSE', label: 'IDX',      full: 'Jakarta Composite'  },
      { symbol: '^KLSE', label: 'KLCI',     full: 'KLCI (Malezya)'     },
      { symbol: '^NSEI', label: 'Nifty 50', full: 'Nifty 50 (Hindistan)'},
    ],
  },
]

const COMMODITIES = [
  { symbol: 'GC=F', label: 'Altın',        unit: 'USD/oz',   icon: '🥇' },
  { symbol: 'SI=F', label: 'Gümüş',        unit: 'USD/oz',   icon: '⚪' },
  { symbol: 'CL=F', label: 'WTI Petrol',   unit: 'USD/bl',   icon: '🛢️' },
  { symbol: 'BZ=F', label: 'Brent Petrol', unit: 'USD/bl',   icon: '🛢️' },
  { symbol: 'NG=F', label: 'Doğal Gaz',   unit: 'USD/MMBtu', icon: '🔥' },
  { symbol: 'ZW=F', label: 'Buğday',       unit: 'USc/bu',   icon: '🌾' },
  { symbol: 'HG=F', label: 'Bakır',        unit: 'USD/lb',   icon: '🔶' },
]

const FOREX = [
  { symbol: 'EURUSD=X', label: 'EUR/USD' },
  { symbol: 'USDJPY=X', label: 'USD/JPY' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD' },
  { symbol: 'USDTRY=X', label: 'USD/TRY' },
  { symbol: 'USDCNH=X', label: 'USD/CNH' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD' },
  { symbol: 'DX-Y.NYB', label: 'DXY'     },
]

const CRYPTO = [
  { symbol: 'BTC-USD', label: 'Bitcoin',  abbr: 'BTC' },
  { symbol: 'ETH-USD', label: 'Ethereum', abbr: 'ETH' },
  { symbol: 'SOL-USD', label: 'Solana',   abbr: 'SOL' },
  { symbol: 'BNB-USD', label: 'BNB',      abbr: 'BNB' },
  { symbol: 'XRP-USD', label: 'XRP',      abbr: 'XRP' },
]

// ─── Tüm sembolleri düz listede topla ────────────────────────────────────────
function allSymbols() {
  const s: string[] = []
  for (const r of REGIONS) for (const idx of r.indices) s.push(idx.symbol)
  for (const c of COMMODITIES) s.push(c.symbol)
  for (const f of FOREX)       s.push(f.symbol)
  for (const cr of CRYPTO)      s.push(cr.symbol)
  return Array.from(new Set(s))
}

// ─── Yahoo Finance v7 toplu çekimi ────────────────────────────────────────────
interface QuoteMap { [symbol: string]: { price: number; chg_pct: number } }

async function fetchYahoo(symbols: string[]): Promise<QuoteMap> {
  const url =
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}&fields=regularMarketPrice,regularMarketChangePercent,symbol`

  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
  }

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Yahoo ${res.status}`)

  const json = await res.json()
  const quotes: any[] = json?.quoteResponse?.result ?? []

  const map: QuoteMap = {}
  for (const q of quotes) {
    const chg = q.regularMarketChangePercent ?? 0
    const price = q.regularMarketPrice ?? 0
    if (price > 0) {
      map[q.symbol] = { price: Math.round(price * 10000) / 10000, chg_pct: Math.round(chg * 100) / 100 }
    }
  }
  return map
}

// ─── Çıktı formatla ───────────────────────────────────────────────────────────
function fmtPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
  if (p >= 100)   return p.toFixed(2)
  if (p >= 1)     return p.toFixed(4)
  return p.toFixed(6)
}

function dir(chg: number): 'up' | 'down' { return chg >= 0 ? 'up' : 'down' }
function pctStr(chg: number): string { return chg >= 0 ? `+${chg.toFixed(2)}%` : `${chg.toFixed(2)}%` }

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET() {
  let map: QuoteMap = {}
  let isLive = false

  try {
    map = await fetchYahoo(allSymbols())
    isLive = Object.keys(map).length > 0
  } catch {
    // map boş kalır — her alan için 0 döner
  }

  const buildIndex = (idx: { symbol: string; label: string; full: string }) => {
    const d = map[idx.symbol]
    return {
      symbol:   idx.symbol,
      label:    idx.label,
      full:     idx.full,
      price:    d ? fmtPrice(d.price) : '—',
      chg_pct:  d ? d.chg_pct : 0,
      pct:      d ? pctStr(d.chg_pct) : '—',
      dir:      d ? dir(d.chg_pct) : 'up' as const,
    }
  }

  const regions = REGIONS.map(r => ({
    id:      r.id,
    label:   r.label,
    icon:    r.icon,
    indices: r.indices.map(buildIndex),
  }))

  const commodities = COMMODITIES.map(c => {
    const d = map[c.symbol]
    return { ...c, price: d ? fmtPrice(d.price) : '—', chg_pct: d?.chg_pct ?? 0, pct: d ? pctStr(d.chg_pct) : '—', dir: d ? dir(d.chg_pct) : 'up' as const }
  })

  const forex = FOREX.map(f => {
    const d = map[f.symbol]
    return { ...f, price: d ? fmtPrice(d.price) : '—', chg_pct: d?.chg_pct ?? 0, pct: d ? pctStr(d.chg_pct) : '—', dir: d ? dir(d.chg_pct) : 'up' as const }
  })

  const crypto = CRYPTO.map(cr => {
    const d = map[cr.symbol]
    return { ...cr, price: d ? fmtPrice(d.price) : '—', chg_pct: d?.chg_pct ?? 0, pct: d ? pctStr(d.chg_pct) : '—', dir: d ? dir(d.chg_pct) : 'up' as const }
  })

  // Top movers endeksler
  const allIdxItems = regions.flatMap(r => r.indices).filter(i => i.price !== '—')
  const sorted = [...allIdxItems].sort((a, b) => a.chg_pct - b.chg_pct)
  const losers  = sorted.slice(0, 5)
  const gainers = sorted.slice(-5).reverse()

  const payload = {
    timestamp:  new Date().toISOString(),
    is_live:    isLive,
    regions,
    commodities,
    forex,
    crypto,
    top_movers: { gainers, losers },
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
