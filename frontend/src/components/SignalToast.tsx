import { useEffect } from 'react'
import { Signal } from '../types'

interface SignalToastProps {
  signal: Signal
  onDismiss: () => void
}

const TOAST_DURATION_MS = 6000

export default function SignalToast({ signal, onDismiss }: SignalToastProps) {
  const isLong = signal.direction === 'LONG'

  useEffect(() => {
    const timer = setTimeout(onDismiss, TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-xl backdrop-blur-sm w-72 animate-slide-in
        ${isLong
          ? 'bg-green-950/90 border-green-700/50'
          : 'bg-red-950/90 border-red-700/50'
        }`}
    >
      {/* Direction icon */}
      <div
        className={`mt-0.5 text-xl leading-none shrink-0 ${isLong ? 'text-green-400' : 'text-red-400'}`}
      >
        {isLong ? '▲' : '▼'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-gray-100 text-sm">{signal.ticker}</span>
          <span className={`text-xs font-semibold ${isLong ? 'text-green-400' : 'text-red-400'}`}>
            {signal.direction}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5 truncate">
          {signal.signals[0] ?? 'New signal detected'}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Entry {signal.entry < 10
            ? signal.entry.toFixed(4)
            : signal.entry.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          {' · '}R/R {signal.rr_ratio.toFixed(2)}x
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onDismiss}
        className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors text-xs leading-none mt-0.5"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
