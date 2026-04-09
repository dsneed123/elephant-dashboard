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

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d'

export const TIMEFRAME_PARAMS: Record<Timeframe, { interval: string; period: string }> = {
  '1m': { interval: '1m', period: '1d' },
  '5m': { interval: '5m', period: '1d' },
  '15m': { interval: '15m', period: '5d' },
  '1h': { interval: '60m', period: '1mo' },
  '1d': { interval: '1d', period: '3mo' },
}
