import { Signal } from '../types'
import { useWsContext } from '../context/WebSocketContext'
import Sparkline from './Sparkline'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

function strengthLabel(s: number): string {
  if (s >= 50) return 'VERY STRONG'
  if (s >= 35) return 'STRONG'
  return 'MODERATE'
}

function strengthClass(s: number): string {
  if (s >= 50) return 'bg-red-600/20 text-red-400 border border-red-600/30'
  if (s >= 35) return 'bg-orange-600/20 text-orange-400 border border-orange-600/30'
  return 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
}

interface SignalCardProps {
  signal: Signal
  onClick: () => void
}

export default function SignalCard({ signal, onClick }: SignalCardProps) {
  const { livePrices, signalStatuses } = useWsContext()
  const livePrice = livePrices.get(signal.ticker)
  const signalStatus = signalStatuses.get(signal.ticker)

  const price = livePrice?.price ?? signal.current_price
  const isLong = signal.direction === 'LONG'

  const priceFmt = (n: number) =>
    n < 10 ? n.toFixed(4) : n < 1000 ? n.toFixed(2) : n.toLocaleString('en-US', { maximumFractionDigits: 2 })

  const pnlPct = ((price - signal.entry) / signal.entry) * 100 * (isLong ? 1 : -1)
  const changePct = livePrice?.changePct

  const isWon = signalStatus === 'won'
  const isLost = signalStatus === 'lost'
  const isClosed = isWon || isLost

  return (
    <button
      onClick={onClick}
      className={`card text-left p-4 hover:border-blue-500/50 hover:bg-surface/80 transition-all duration-150 w-full group relative overflow-hidden
        ${isWon ? 'border-green-600/40' : ''}
        ${isLost ? 'border-red-600/40' : ''}
      `}
    >
      {/* Won/Lost overlay banner */}
      {isClosed && (
        <div
          className={`absolute top-0 left-0 right-0 flex items-center justify-center gap-1.5 py-1 text-xs font-bold
            ${isWon ? 'bg-green-600/25 text-green-400' : 'bg-red-600/25 text-red-400'}
          `}
        >
          {isWon ? '✓ TARGET HIT' : '✕ STOP HIT'}
        </div>
      )}

      {/* Offset content when banner is shown */}
      <div className={isClosed ? 'mt-5' : ''}>
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-100 text-base">{signal.ticker}</span>
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${strengthClass(signal.strength)}`}
              >
                {strengthLabel(signal.strength)}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {isLong ? (
                <span className="text-green-400 text-lg leading-none">▲</span>
              ) : (
                <span className="text-red-400 text-lg leading-none">▼</span>
              )}
              <span className={`text-sm font-semibold ${isLong ? 'text-green-400' : 'text-red-400'}`}>
                {signal.direction}
              </span>
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-gray-100 font-mono font-semibold text-sm">{priceFmt(price)}</div>
            <div
              className={`text-xs font-mono ${pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {pnlPct >= 0 ? '+' : ''}
              {pnlPct.toFixed(2)}%
            </div>
            {changePct !== undefined && (
              <div className={`text-[10px] font-mono ${changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% today
              </div>
            )}
          </div>
        </div>

        {/* Sparkline */}
        <div className="mb-3">
          <Sparkline ticker={signal.ticker} width={180} height={40} />
        </div>

        {/* Price levels */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <PriceLevel label="Entry" value={priceFmt(signal.entry)} color="text-blue-400" />
          <PriceLevel label="Target" value={priceFmt(signal.target_1)} color="text-green-400" />
          <PriceLevel label="Stop" value={priceFmt(signal.stop_loss)} color="text-red-400" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>R/R {signal.rr_ratio.toFixed(2)}x</span>
          <span>{timeAgo(signal.timestamp)}</span>
        </div>

        <div className="mt-2 text-xs text-gray-700 group-hover:text-gray-500 transition-colors text-right">
          Click to expand →
        </div>
      </div>
    </button>
  )
}

function PriceLevel({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-600 uppercase tracking-wider text-[10px]">{label}</span>
      <span className={`font-mono font-medium ${color}`}>{value}</span>
    </div>
  )
}
