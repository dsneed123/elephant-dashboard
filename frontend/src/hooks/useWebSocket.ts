import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { WsMessage } from '../types'

export function useWebSocket(onScanTime?: (time: string) => void) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>
    let dead = false

    function connect() {
      if (dead) return
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${proto}//${window.location.host}/ws`)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage
          if (msg.type === 'signal' && msg.data) {
            const key = msg.data.asset_type === 'stock' ? 'stocks' : 'crypto'
            void queryClient.invalidateQueries({ queryKey: ['signals', key] })
          }
          if (msg.type === 'scan_complete' && msg.timestamp && onScanTime) {
            onScanTime(msg.timestamp)
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        if (!dead) {
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      dead = true
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [queryClient, onScanTime])
}
