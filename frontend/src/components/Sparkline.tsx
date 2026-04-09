import { useQuery } from '@tanstack/react-query'
import { fetchChartData } from '../api/client'

interface SparklineProps {
  ticker: string
  direction: 'LONG' | 'SHORT'
  width?: number
  height?: number
}

function buildPath(prices: number[], w: number, h: number): string {
  if (prices.length < 2) return ''
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const padding = 2
  const points = prices.map((v, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - padding - ((v - min) / range) * (h - padding * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `M ${points.join(' L ')}`
}

export function Sparkline({ ticker, direction, width = 128, height = 44 }: SparklineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['sparkline', ticker],
    queryFn: () => fetchChartData(ticker, '1h', '1d'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  if (isLoading) {
    return (
      <div
        style={{ width, height }}
        className="animate-pulse rounded bg-slate-800"
      />
    )
  }

  const prices = (data ?? []).map((c) => c.close)
  if (prices.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center rounded bg-slate-800/50 text-xs text-slate-600"
      >
        No data
      </div>
    )
  }

  const color = direction === 'LONG' ? '#34d399' : '#f87171'
  const fillColor = direction === 'LONG' ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)'

  const path = buildPath(prices, width, height)
  // Close path for fill area
  const lastX = width
  const fillPath = `${path} L ${lastX},${height} L 0,${height} Z`

  const last = prices[prices.length - 1]
  const first = prices[0]
  const pct = ((last - first) / first) * 100

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Fill */}
        <path d={fillPath} fill={fillColor} />
        {/* Line */}
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        {/* Current price dot */}
        {(() => {
          const lastIdx = prices.length - 1
          const min = Math.min(...prices)
          const max = Math.max(...prices)
          const range = max - min || 1
          const lx = (lastIdx / (prices.length - 1)) * width
          const ly = height - 2 - ((last - min) / range) * (height - 4)
          return (
            <circle cx={lx} cy={ly} r={2.5} fill={color} />
          )
        })()}
      </svg>
      {/* Pct change overlay */}
      <span
        className={`absolute bottom-0.5 right-0.5 text-xs font-semibold leading-none ${
          pct >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}
        style={{ fontSize: 10 }}
      >
        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
      </span>
    </div>
  )
}
