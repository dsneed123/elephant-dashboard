import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { useWebSocket, WsStatus } from '../hooks/useWebSocket'
import { Signal, LivePrice } from '../types'
import SignalToast from '../components/SignalToast'

interface ToastItem {
  signal: Signal
  id: number
}

interface WsContextValue {
  status: WsStatus
  liveSignals: Map<string, Signal>
  livePrices: Map<string, LivePrice>
  signalStatuses: Map<string, 'won' | 'lost'>
  soundEnabled: boolean
  setSoundEnabled: (v: boolean) => void
}

const WsContext = createContext<WsContextValue | null>(null)

export function useWsContext(): WsContextValue {
  const ctx = useContext(WsContext)
  if (!ctx) throw new Error('useWsContext must be used within WebSocketProvider')
  return ctx
}

function playSignalSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // AudioContext may be blocked before user interaction — ignore
  }
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocket()
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('elephantSoundEnabled') !== 'false'
  })
  const soundEnabledRef = useRef(soundEnabled)
  const [toastQueue, setToastQueue] = useState<ToastItem[]>([])
  const processedCount = useRef(0)

  const setSoundEnabled = useCallback((v: boolean) => {
    soundEnabledRef.current = v
    setSoundEnabledState(v)
    localStorage.setItem('elephantSoundEnabled', String(v))
  }, [])

  // React to newly arrived signals — show toast and play sound
  useEffect(() => {
    const newOnes = ws.newSignals.slice(processedCount.current)
    if (newOnes.length === 0) return
    processedCount.current = ws.newSignals.length

    for (const signal of newOnes) {
      setToastQueue((q) => [...q, { signal, id: Date.now() + Math.random() }])
      if (soundEnabledRef.current) {
        playSignalSound()
      }
    }
  }, [ws.newSignals])

  const dismissToast = useCallback((id: number) => {
    setToastQueue((q) => q.filter((t) => t.id !== id))
  }, [])

  return (
    <WsContext.Provider
      value={{
        status: ws.status,
        liveSignals: ws.liveSignals,
        livePrices: ws.livePrices,
        signalStatuses: ws.signalStatuses,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}

      {/* Toast notifications — fixed bottom-right */}
      {toastQueue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toastQueue.map((item) => (
            <SignalToast
              key={item.id}
              signal={item.signal}
              onDismiss={() => dismissToast(item.id)}
            />
          ))}
        </div>
      )}
    </WsContext.Provider>
  )
}
