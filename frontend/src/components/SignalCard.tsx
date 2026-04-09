import type { Signal } from '../types'
import { Sparkline } from './Sparkline'

interface SignalCardProps {
  signal: Signal
  onClick: () => void
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function strengthLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 8) return { label: 'Very Strong', color: 'text-blue-300', bg: 'bg-blue-500/15' }
  if (score >= 6) return { label: 'Strong', color: 'text-emerald-300', bg: 'bg-emerald-500/15' }
  if (score >= 4) return { label: 'Moderate', color: 'text-yellow-300', bg: 'bg-yellow-500/15' }
  return { label: 'Weak', color: 'text-slate-400', bg: 'bg-slate-700/50' }
}

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toFixed(n < 1 ? 5 : 2)
}

export function SignalCard({ signal, onClick }: SignalCardProps) {
  const isLong =
    signal.direction === 'LONG' ||
    signal.direction === 'YES' ||
    signal.direction === 'BUY'
  const strength = strengthLabel(signal.strength)

  return (
    <button
      onClick={onClick}
      className="
        group w-full rounded-xl border border-slate-800 bg-surface-2 p-4
        text-left transition-all duration-200
        hover:border-slate-600 hover:bg-surface-3 hover:shadow-lg hover:shadow-black/30
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
      "
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Direction arrow */}
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${
              isLong
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-red-500/15 text-red-400'
            }`}
          >
            {isLong ? '↑' : '↓'}
          </span>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-white">{signal.ticker}</span>
              <span
                className={`text-xs font-semibold ${isLong ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {signal.direction}
              </span>
            </div>
            <div className="text-xs text-slate-500">{timeAgo(signal.timestamp)}</div>
          </div>
        </div>

        {/* Strength badge */}
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${strength.bg} ${strength.color}`}
        >
          {strength.label}
        </span>
      </div>

      {/* Price + Sparkline */}
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-mono font-bold text-white">
            ${fmt(signal.current_price)}
          </div>
          {(signal.rsi != null || signal.vol_ratio != null) && (
            <div className="mt-0.5 text-xs text-slate-500">
              {signal.rsi != null && `RSI ${signal.rsi.toFixed(0)}`}
              {signal.rsi != null && signal.vol_ratio != null && ' · '}
              {signal.vol_ratio != null && `Vol ×${signal.vol_ratio.toFixed(1)}`}
            </div>
          )}
        </div>
        {(signal.direction === 'LONG' || signal.direction === 'SHORT') && (
          <Sparkline ticker={signal.ticker} direction={signal.direction} />
        )}
      </div>

      {/* Levels grid */}
      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-surface-0/70 p-2 text-xs">
        <LevelCell label="Entry" value={fmt(signal.entry)} color="text-blue-300" />
        <LevelCell label="T1" value={fmt(signal.target_1)} color="text-emerald-300" />
        <LevelCell label="T2" value={fmt(signal.target_2)} color="text-emerald-400" />
        <LevelCell label="Stop" value={fmt(signal.stop_loss)} color="text-red-400" />
        <LevelCell label="R:R" value={`${signal.rr_ratio.toFixed(1)}x`} color="text-slate-300" />
        <LevelCell label="Hold" value={signal.hold_duration ?? '—'} color="text-slate-400" />
      </div>

      {/* Signal tags */}
      {signal.signals.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {signal.signals.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400"
            >
              {s}
            </span>
          ))}
          {signal.signals.length > 3 && (
            <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-500">
              +{signal.signals.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Expand hint */}
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
        <span>Full chart</span>
        <span>→</span>
      </div>
    </button>
  )
}

function LevelCell({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] uppercase tracking-wider text-slate-600">{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{value}</span>
    </div>
  )
}
