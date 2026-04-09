import { useEffect, useRef, useState, useCallback } from 'react'
import { Signal, LivePrice } from '../types'

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

export interface WsState {
  status: WsStatus
  liveSignals: Map<string, Signal>
  livePrices: Map<string, LivePrice>
  signalStatuses: Map<string, 'won' | 'lost'>
  newSignals: Signal[]
}

export function useWebSocket(): WsState {
  const [status, setStatus] = useState<WsStatus>('connecting')
  const [liveSignals, setLiveSignals] = useState<Map<string, Signal>>(new Map())
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map())
  const [signalStatuses, setSignalStatuses] = useState<Map<string, 'won' | 'lost'>>(new Map())
  const [newSignals, setNewSignals] = useState<Signal[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmounted = useRef(false)
  // Track tickers seen this session to identify truly new signals
  const seenTickers = useRef<Set<string>>(new Set())

  const connect = useCallback(() => {
    if (unmounted.current) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => {
      if (!unmounted.current) setStatus('connected')
    }

    ws.onmessage = (event: MessageEvent) => {
      if (unmounted.current) return
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>

        if (msg.type === 'signal' && msg.data) {
          const signal = msg.data as Signal
          const isNew = !seenTickers.current.has(signal.ticker)
          if (isNew) {
            seenTickers.current.add(signal.ticker)
            setNewSignals((prev) => [...prev, signal])
          }
          setLiveSignals((prev) => new Map(prev).set(signal.ticker, signal))
        } else if (msg.type === 'price' && msg.ticker && msg.price !== undefined) {
          const livePrice: LivePrice = {
            price: msg.price as number,
            changePct: (msg.change_pct as number) ?? 0,
          }
          setLivePrices((prev) => new Map(prev).set(msg.ticker as string, livePrice))
        } else if (msg.type === 'signal_update' && msg.ticker && msg.status) {
          const ticker = msg.ticker as string
          const st = msg.status as 'won' | 'lost'
          setSignalStatuses((prev) => new Map(prev).set(ticker, st))
          // Remove from live signals since it's now closed
          setLiveSignals((prev) => {
            const next = new Map(prev)
            next.delete(ticker)
            return next
          })
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (unmounted.current) return
      setStatus('disconnected')
      retryTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    unmounted.current = false
    connect()
    return () => {
      unmounted.current = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { status, liveSignals, livePrices, signalStatuses, newSignals }
}
