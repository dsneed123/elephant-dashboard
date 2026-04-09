import { useQuery } from '@tanstack/react-query'
import { fetchStockSignals, fetchCryptoSignals } from '../api/client'
import { WsStatus } from '../hooks/useWebSocket'
import { useWsContext } from '../context/WebSocketContext'
import { Signal } from '../types'

function isNyseOpen(): boolean {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false
  // NYSE 9:30–16:00 ET; use UTC-4 (EDT) as approximation
  const etMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() - 4 * 60
  return etMinutes >= 9 * 60 + 30 && etMinutes < 16 * 60
}

function lastScanTime(signals: Signal[]): string {
  if (signals.length === 0) return '—'
  const times = signals.map((s) => new Date(s.timestamp).getTime())
  const latest = new Date(Math.max(...times))
  return latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface TopBarProps {
  wsStatus: WsStatus
}

export default function TopBar({ wsStatus }: TopBarProps) {
  const { soundEnabled, setSoundEnabled } = useWsContext()

  const { data: stocks = [] } = useQuery({
    queryKey: ['signals', 'stocks'],
    queryFn: fetchStockSignals,
  })
  const { data: crypto = [] } = useQuery({
    queryKey: ['signals', 'crypto'],
    queryFn: fetchCryptoSignals,
  })

  const totalSignals = stocks.length + crypto.length
  const nyseOpen = isNyseOpen()
  const scanTime = lastScanTime([...stocks, ...crypto])

  const wsColor =
    wsStatus === 'connected'
      ? 'bg-green-500'
      : wsStatus === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <header className="sticky top-0 z-40 bg-gray-900 border-b border-border h-14 flex items-center px-4">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-blue-400 font-bold text-lg tracking-tight">ELEPHANT</span>
          <span className="text-gray-500 text-xs hidden sm:block">signal dashboard</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 sm:gap-6 text-sm">
          <Stat label="Active Signals" value={totalSignals.toString()} highlight />
          <Stat label="Last Scan" value={scanTime} />
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${nyseOpen ? 'bg-green-400' : 'bg-gray-600'}`}
            />
            <span className={nyseOpen ? 'text-green-400' : 'text-gray-500'}>
              {nyseOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>
        </div>

        {/* Right side: sound toggle + WS indicator */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Sound alert toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Sound alerts on — click to mute' : 'Sound alerts off — click to enable'}
            className={`text-base leading-none transition-opacity ${
              soundEnabled ? 'opacity-100' : 'opacity-30'
            } hover:opacity-80`}
            aria-label={soundEnabled ? 'Mute signal alerts' : 'Enable signal alerts'}
          >
            {soundEnabled ? '🔔' : '🔕'}
          </button>

          {/* WS indicator */}
          <div className="flex items-center gap-1.5" title={`WebSocket: ${wsStatus}`}>
            <span className={`w-2 h-2 rounded-full ${wsColor}`} />
            <span className="text-gray-500 text-xs hidden md:block">Live</span>
          </div>
        </div>
      </div>
    </header>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className={`font-bold text-base ${highlight ? 'text-blue-400' : 'text-gray-200'}`}>
        {value}
      </span>
      <span className="text-gray-600 text-[10px] uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  )
}
