import { useQuery } from '@tanstack/react-query'
import { fetchStockSignals, fetchCryptoSignals, fetchKalshiSignals } from '../api/client'

export function useStockSignals() {
  return useQuery({
    queryKey: ['signals', 'stocks'],
    queryFn: fetchStockSignals,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useCryptoSignals() {
  return useQuery({
    queryKey: ['signals', 'crypto'],
    queryFn: fetchCryptoSignals,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function useKalshiSignals() {
  return useQuery({
    queryKey: ['signals', 'kalshi'],
    queryFn: fetchKalshiSignals,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
