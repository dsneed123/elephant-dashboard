import axios from 'axios'
import type { Signal, Candle } from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

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
