import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import type { Signal, Timeframe } from '../types'
import { fetchChartData } from '../api/client'

interface FullChartViewProps {
  signal: Signal
  onClose: () => void
}

const TIMEFRAMES: { id: Timeframe; label: string; interval: string; period: string }[] = [
  { id: '1m', label: '1m', interval: '1m', period: '1d' },
  { id: '5m', label: '5m', interval: '5m', period: '1d' },
  { id: '15m', label: '15m', interval: '15m', period: '5d' },
  { id: '1h', label: '1h', interval: '1h', period: '1mo' },
  { id: '1d', label: '1D', interval: '1d', period: '3mo' },
]

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toFixed(n < 1 ? 5 : 2)
}

export function FullChartView({ signal, onClose }: FullChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  const [timeframe, setTimeframe] = useState<Timeframe>('1h')

  const tf = TIMEFRAMES.find((t) => t.id === timeframe)!

  const { data: candles, isLoading } = useQuery({
    queryKey: ['chart', signal.ticker, tf.interval, tf.period],
    queryFn: () => fetchChartData(signal.ticker, tf.interval, tf.period),
    staleTime: 30_000,
  })

  // Init chart once
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { mouseWheel: true, pinch: true },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#34d399',
      downColor: '#f87171',
      borderUpColor: '#34d399',
      borderDownColor: '#f87171',
      wickUpColor: '#34d399',
      wickDownColor: '#f87171',
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    // Responsive resize
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(el)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  // Update data when candles change
  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    const chart = chartRef.current
    if (!candles || !candleSeries || !volumeSeries || !chart) return

    const sorted = [...candles].sort((a, b) => a.time - b.time)

    const candleData: CandlestickData[] = sorted.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    const volumeData: HistogramData[] = sorted.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)',
    }))

    candleSeries.setData(candleData)
    volumeSeries.setData(volumeData)

    // Remove old price lines by recreating the series would be complex,
    // instead we track and remove them
    const isLong = signal.direction === 'LONG'

    candleSeries.createPriceLine({
      price: signal.entry,
      color: '#60a5fa',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Entry',
    })

    candleSeries.createPriceLine({
      price: signal.target_1,
      color: '#34d399',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'T1',
    })

    candleSeries.createPriceLine({
      price: signal.target_2,
      color: '#6ee7b7',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'T2',
    })

    candleSeries.createPriceLine({
      price: signal.stop_loss,
      color: '#f87171',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Stop',
    })

    // Signal marker
    const signalTime = Math.floor(new Date(signal.timestamp).getTime() / 1000) as Time
    // Find the nearest candle time
    const nearest = sorted.reduce((prev, curr) =>
      Math.abs(curr.time - (signalTime as number)) < Math.abs(prev.time - (signalTime as number))
        ? curr
        : prev,
    )

    candleSeries.setMarkers([
      {
        time: nearest.time as Time,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: isLong ? '#34d399' : '#f87171',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: signal.direction,
        size: 2,
      },
    ])

    chart.timeScale().fitContent()
  }, [candles, signal])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isLong = signal.direction === 'LONG'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-0">
      {/* Modal header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-surface-1 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl font-bold ${
              isLong ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            }`}
          >
            {isLong ? '↑' : '↓'}
          </span>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-white">{signal.ticker}</span>
              <span className={`text-sm font-semibold ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
                {signal.direction}
              </span>
              <span className="font-mono text-sm text-white">${fmt(signal.current_price)}</span>
            </div>
            <div className="text-xs text-slate-500">
              Strength {signal.strength.toFixed(1)} · R:R {signal.rr_ratio.toFixed(1)}x · {signal.hold_duration}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timeframe selector */}
          <div className="flex gap-0.5 rounded-lg bg-surface-0 p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  timeframe === tf.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close chart"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Levels legend */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-b border-slate-800/50 bg-surface-1/50 px-4 py-2">
        <LegendItem color="bg-blue-400" label="Entry" value={`$${fmt(signal.entry)}`} />
        <LegendItem color="bg-emerald-400" label="Target 1" value={`$${fmt(signal.target_1)}`} />
        <LegendItem color="bg-emerald-300" label="Target 2" value={`$${fmt(signal.target_2)}`} />
        <LegendItem color="bg-red-400" label="Stop Loss" value={`$${fmt(signal.stop_loss)}`} />
        <div className="ml-auto flex flex-wrap gap-1">
          {signal.signals.map((s) => (
            <span key={s} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="relative min-h-0 flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-0/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-medium text-slate-300">{value}</span>
    </div>
  )
}
