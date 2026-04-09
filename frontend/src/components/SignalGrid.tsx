import type { Signal } from '../types'
import { SignalCard } from './SignalCard'

interface SignalGridProps {
  signals: Signal[]
  isLoading: boolean
  isError: boolean
  onSelectSignal: (signal: Signal) => void
}

export function SignalGrid({ signals, isLoading, isError, onSelectSignal }: SignalGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-xl border border-slate-800 bg-surface-2"
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-2 text-3xl">⚠️</div>
        <div className="text-slate-400">Failed to load signals.</div>
        <div className="mt-1 text-sm text-slate-600">
          Check that the backend is running on port 8300.
        </div>
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-3 text-4xl opacity-40">🐘</div>
        <div className="text-slate-400">No active signals right now.</div>
        <div className="mt-1 text-sm text-slate-600">
          The scanner runs continuously — check back soon.
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {signals.map((signal) => (
        <SignalCard
          key={`${signal.ticker}-${signal.timestamp}`}
          signal={signal}
          onClick={() => onSelectSignal(signal)}
        />
      ))}
    </div>
  )
}
