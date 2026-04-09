import { useQuery } from '@tanstack/react-query'
import { fetchChartData } from '../api/client'

interface SparklineProps {
  ticker: string
  width?: number
  height?: number
}

export default function Sparkline({ ticker, width = 120, height = 36 }: SparklineProps) {
  const { data } = useQuery({
    queryKey: ['sparkline', ticker],
    queryFn: () => fetchChartData(ticker, '1h', '1d'),
    staleTime: 5 * 60 * 1000,
  })

  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="bg-gray-800/40 rounded animate-pulse" />
  }

  const closes = data.map((c) => c.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1

  const pad = 2
  const w = width - pad * 2
  const h = height - pad * 2

  const pts = closes
    .map((price, i) => {
      const x = pad + (i / (closes.length - 1)) * w
      const y = pad + h - ((price - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  // Build fill area path
  const firstX = pad
  const lastX = pad + w
  const bottomY = pad + h
  const fillPts = `${pad},${bottomY} ${pts} ${lastX},${bottomY}`

  const isUp = closes[closes.length - 1] >= closes[0]
  const color = isUp ? '#22c55e' : '#ef4444'
  const fillColor = isUp ? '#22c55e22' : '#ef444422'

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polygon points={fillPts} fill={fillColor} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
