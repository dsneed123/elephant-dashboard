import axios from 'axios'
import { Candle, Signal } from '../types'

const api = axios.create({ baseURL: '/api' })

export async function fetchStockSignals(): Promise<Signal[]> {
  const { data } = await api.get<Signal[]>('/signals/stocks')
  return data
}

export async function fetchCryptoSignals(): Promise<Signal[]> {
  const { data } = await api.get<Signal[]>('/signals/crypto')
  return data
}

export async function fetchKalshiSignals(): Promise<Signal[]> {
  const { data } = await api.get<Signal[]>('/signals/kalshi')
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

export async function fetchHealth(): Promise<{ status: string }> {
  const { data } = await api.get('/health')
  return data
}
