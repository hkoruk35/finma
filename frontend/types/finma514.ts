// ─── FinMA 514 Types ─────────────────────────────────────────────────────────

export type FinmaTier = 'STRONG' | 'HIGH' | 'WATCH' | 'IGNORE'
export type FinmaTag  = 'CORE' | 'SECTOR' | 'VOLUME' | 'GAINER' | 'LOSER'
export type FinmaLang = 'tr' | 'en' | 'es' | 'pt' | 'ar' | 'id' | 'ja'

export interface ScoreBreakdown {
  trend:    number  // max 30
  volume:   number  // max 25
  momentum: number  // max 32
  context:  number  // max 13
}

export interface InterestZone {
  low:    number
  high:   number
  poc:    number   // Point of Control (volume-weighted center)
}

export interface AIText {
  market_context:     string
  interest_zone_text: string
  scenario_bull:      string
  scenario_bear:      string
  scenario_neutral:   string
  risk_reference:     string
  strategy_note:      string
  generated_by?:      string
}

export interface Finma514Stock {
  ticker:          string
  company_name:    string
  sector:          string
  industry:        string
  exchange:        string
  market_cap:      number
  market_cap_fmt:  string
  tag:             FinmaTag
  tier:            FinmaTier
  score:           number
  score_breakdown: ScoreBreakdown
  price:           number
  change_1d:       number
  change_5d:       number
  change_1m:       number
  rvol:            number
  rsi:             number
  adx:             number
  atr_pct:         number
  bb_width:        number
  ema20:           number
  ema50:           number
  ema200:          number
  interest_zone:   string | InterestZone
  stop_loss:       number
  target_1:        number
  target_2:        number
  ai_text:         AIText
  lang?:           FinmaLang
}

export interface Finma514Categories {
  core_picks:       Finma514Stock[]
  sector_leaders:   Finma514Stock[]
  high_volume:      Finma514Stock[]
  top_gainers:      Finma514Stock[]
  oversold_losers:  Finma514Stock[]
}

export interface Finma514Report {
  bot_name:      string
  market_date:   string
  run_timestamp: string
  run_time_ny:   string
  market_regime: string
  vix:           number
  stock_count:   number
  lang:          FinmaLang
  stocks:        Finma514Stock[]
}

export interface Finma514Status {
  last_run:      string | null
  market_date:   string | null
  stock_count:   number
  market_regime: string
  vix:           number
  source:        string
}

// ─── Dil meta ────────────────────────────────────────────────────────────────
export const LANG_OPTIONS: { code: FinmaLang; label: string; flag: string }[] = [
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦' },
  { code: 'id', label: 'Indonesia',  flag: '🇮🇩' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
]

// ─── Tier meta ────────────────────────────────────────────────────────────────
export const TIER_CONFIG: Record<FinmaTier, { label: string; color: string; bg: string; min: number }> = {
  STRONG: { label: 'STRONG', color: 'text-finma-green',   bg: 'bg-finma-green/15 border-finma-green/30',   min: 90 },
  HIGH:   { label: 'HIGH',   color: 'text-finma-primary', bg: 'bg-finma-primary/15 border-finma-primary/30', min: 75 },
  WATCH:  { label: 'WATCH',  color: 'text-finma-yellow',  bg: 'bg-finma-yellow/15 border-finma-yellow/30',  min: 60 },
  IGNORE: { label: 'IGNORE', color: 'text-finma-text-dim', bg: 'bg-white/5 border-white/10',               min: 0  },
}

// ─── Tag meta ─────────────────────────────────────────────────────────────────
export const TAG_CONFIG: Record<FinmaTag, { label: string; color: string }> = {
  CORE:   { label: 'Core',    color: 'text-finma-primary' },
  SECTOR: { label: 'Sektör',  color: 'text-finma-cyan' },
  VOLUME: { label: 'Hacim',   color: 'text-finma-purple' },
  GAINER: { label: 'Yükselen', color: 'text-finma-green' },
  LOSER:  { label: 'Aşırı Satım', color: 'text-finma-red' },
}

export const CATEGORY_LABELS: Record<string, { tr: string; icon: string }> = {
  core_picks:      { tr: 'Core Seçimler',   icon: '⭐' },
  sector_leaders:  { tr: 'Sektör Liderleri', icon: '📊' },
  high_volume:     { tr: 'Yüksek Hacim',     icon: '🔥' },
  top_gainers:     { tr: 'En Yükselenler',   icon: '📈' },
  oversold_losers: { tr: 'Aşırı Satım',      icon: '📉' },
}
