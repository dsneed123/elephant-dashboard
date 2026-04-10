import axios from 'axios'
import { Candle, KalshiSignal, KalshiWhale, PerformanceStats, Settings, Signal, SignalHistory } from '../types'

const api = axios.create({ baseURL: '/api' })

export async function fetchStockSignals(): Promise<Signal[]> {
  const { data } = await api.get<Signal[]>('/signals/stocks')
  return data
}

export async function fetchCryptoSignals(): Promise<Signal[]> {
  const { data } = await api.get<Signal[]>('/signals/crypto')
  return data
}

export async function fetchKalshiSignals(): Promise<KalshiSignal[]> {
  const { data } = await api.get<KalshiSignal[]>('/signals/kalshi')
  return data
}

export async function fetchKalshiWhales(): Promise<KalshiWhale[]> {
  const { data } = await api.get<KalshiWhale[]>('/signals/kalshi/whales')
  return data
}

export async function fetchChartData(
  ticker: string,
  interval: string,
  period: string,
): Promise<Candle[]> {
  const { data } = await api.get<Candle[]>(`/chart/${encodeURIComponent(ticker)}`, {
    params: { interval, period },
  })
  return data
}

export async function fetchSignalHistory(limit = 200, offset = 0): Promise<SignalHistory[]> {
  const { data } = await api.get<SignalHistory[]>('/signals/history', {
    params: { limit, offset },
  })
  return data
}

export async function fetchPerformanceStats(): Promise<PerformanceStats> {
  const { data } = await api.get<PerformanceStats>('/signals/performance')
  return data
}

export async function fetchHealth(): Promise<{ status: string }> {
  const { data } = await api.get('/health')
  return data
}

export async function fetchSettings(): Promise<Settings> {
  const { data } = await api.get<Settings>('/settings')
  return data
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  const { data } = await api.put<Settings>('/settings', settings)
  return data
}
