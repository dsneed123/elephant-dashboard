export interface Signal {
  ticker: string
  direction: 'LONG' | 'SHORT'
  strength: number
  signals: string[]
  entry: number
  stop_loss: number
  target_1: number
  target_2: number
  rr_ratio: number
  hold_duration: string
  rsi: number
  atr_pct: number
  vol_ratio: number
  current_price: number
  timestamp: string
  status: 'active' | 'expired' | 'won' | 'lost'
  asset_type: 'stock' | 'crypto' | 'kalshi'
}

export interface LivePrice {
  price: number
  changePct: number
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface KalshiSignal {
  id: number
  market_ticker: string
  market_title: string | null
  side: 'YES' | 'NO'
  action: string | null
  detected_price: number | null
  detected_volume: number | null
  confidence: number | null
  status: string | null
  created_at: string
  kalshi_username: string
  display_name: string | null
  elephant_score: number | null
  total_profit: number | null
  win_rate: number | null
  tier: string | null
}

export interface KalshiWhale {
  kalshi_username: string
  display_name: string | null
  elephant_score: number | null
  total_profit: number | null
  win_rate: number | null
  total_trades: number | null
  tier: string | null
  is_active: boolean
  last_seen: string | null
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d'

export const TIMEFRAME_PARAMS: Record<Timeframe, { interval: string; period: string }> = {
  '1m': { interval: '1m', period: '1d' },
  '5m': { interval: '5m', period: '1d' },
  '15m': { interval: '15m', period: '5d' },
  '1h': { interval: '60m', period: '1mo' },
  '1d': { interval: '1d', period: '3mo' },
}

export interface SignalHistory {
  signal_id: string
  ticker: string
  direction: 'LONG' | 'SHORT'
  entry_price: number
  target_1: number
  target_2: number
  stop_loss: number
  strength: number
  asset_type: 'stock' | 'crypto'
  signals: string[]
  status: 'active' | 'won' | 'lost' | 'expired'
  created_at: string
  resolved_at: string | null
  exit_price: number | null
  pnl_pct: number | null
}

export interface EquityPoint {
  date: string
  cumulative_pnl: number
}

export interface HeatmapDay {
  date: string
  pnl: number
}

export interface CategoryStats {
  asset_type: string
  total: number
  wins: number
  losses: number
}

export interface PerformanceStats {
  total: number
  wins: number
  losses: number
  expired: number
  win_rate: number | null
  win_rate_7d: number | null
  win_rate_30d: number | null
  avg_gain_pct: number | null
  avg_loss_pct: number | null
  profit_factor: number | null
  best: { ticker: string; direction: string; pnl_pct: number; created_at: string; asset_type: string } | null
  worst: { ticker: string; direction: string; pnl_pct: number; created_at: string; asset_type: string } | null
  by_category: CategoryStats[]
  equity_curve: EquityPoint[]
  heatmap: HeatmapDay[]
}
