export interface Signal {
  ticker: string
  direction: 'LONG' | 'SHORT' | 'YES' | 'NO' | 'BUY' | 'SELL'
  strength: number
  signals: string[]
  entry: number
  stop_loss?: number
  target_1?: number
  target_2?: number
  rr_ratio?: number
  hold_duration?: string
  rsi?: number
  atr_pct?: number
  vol_ratio?: number
  current_price: number
  timestamp: string
  status: 'active' | 'won' | 'lost' | 'expired'
  asset_type: 'stock' | 'crypto' | 'kalshi'
  // Kalshi-specific fields
  id?: number
  market_title?: string
  trader_name?: string
  trader_score?: number
  action?: string
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Tab = 'stocks' | 'crypto' | 'kalshi'

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d'

export interface WsMessage {
  type: 'signal' | 'price_update' | 'scan_complete'
  data?: Signal
  ticker?: string
  price?: number
  timestamp?: string
}
