import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  CrosshairMode,
  LineStyle,
  UTCTimestamp,
} from 'lightweight-charts'
import { useQuery } from '@tanstack/react-query'
import { fetchChartData } from '../api/client'
import { SignalHistory, Timeframe, TIMEFRAME_PARAMS } from '../types'

const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '1d']

interface Props {
  signal: SignalHistory
}

export default function HistoryChartView({ signal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const defaultTf: Timeframe = signal.asset_type === 'crypto' ? '1h' : '1d'
  const [timeframe, setTimeframe] = useState<Timeframe>(defaultTf)

  const { interval, period } = TIMEFRAME_PARAMS[timeframe]

  const { data: candles, isLoading } = useQuery({
    queryKey: ['chart', signal.ticker, interval, period],
    queryFn: () => fetchChartData(signal.ticker, interval, period),
    staleTime: 60_000,
  })

  // Create chart once per signal
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { color: '#0f1117' },
        textColor: '#94a3b8',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#1e2433' },
        horzLines: { color: '#1e2433' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2d3a' },
      timeScale: {
        borderColor: '#2a2d3a',
        timeVisible: true,
        secondsVisible: false,
      },
      width: el.clientWidth,
      height: 380,
    })
    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleRef.current = candleSeries

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    volumeRef.current = volumeSeries
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
    })

    const pFmt = (n: number) => (n < 10 ? n.toFixed(4) : n.toFixed(2))

    candleSeries.createPriceLine({
      price: signal.entry_price,
      color: '#60a5fa',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `Entry ${pFmt(signal.entry_price)}`,
    })
    candleSeries.createPriceLine({
      price: signal.target_1,
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `T1 ${pFmt(signal.target_1)}`,
    })
    candleSeries.createPriceLine({
      price: signal.target_2,
      color: '#10b981',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `T2 ${pFmt(signal.target_2)}`,
    })
    candleSeries.createPriceLine({
      price: signal.stop_loss,
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `SL ${pFmt(signal.stop_loss)}`,
    })
    if (signal.exit_price != null) {
      candleSeries.createPriceLine({
        price: signal.exit_price,
        color: signal.status === 'won' ? '#22c55e' : '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `Exit ${pFmt(signal.exit_price)}`,
      })
    }

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
    }
  }, [signal])

  // Update data when candles or timeframe changes
  useEffect(() => {
    if (!candles || !candleRef.current || !volumeRef.current) return

    const candleData: CandlestickData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    const volumeData: HistogramData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? '#22c55e33' : '#ef444433',
    }))

    candleRef.current.setData(candleData)
    volumeRef.current.setData(volumeData)

    const signalTs = Math.floor(new Date(signal.created_at).getTime() / 1000) as UTCTimestamp
    candleRef.current.setMarkers([
      {
        time: signalTs,
        position: signal.direction === 'LONG' ? 'belowBar' : 'aboveBar',
        color: signal.direction === 'LONG' ? '#22c55e' : '#ef4444',
        shape: signal.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
        text: signal.direction,
      },
    ])

    chartRef.current?.timeScale().fitContent()
  }, [candles, signal])

  const priceFmt = (n: number) => (n < 10 ? n.toFixed(4) : n.toFixed(2))

  return (
    <div>
      {/* Level badges */}
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <HBadge label="Entry" value={priceFmt(signal.entry_price)} color="blue" />
        <HBadge label="T1" value={priceFmt(signal.target_1)} color="green" />
        <HBadge label="T2" value={priceFmt(signal.target_2)} color="emerald" />
        <HBadge label="Stop" value={priceFmt(signal.stop_loss)} color="red" />
        {signal.exit_price != null && (
          <HBadge
            label="Exit"
            value={priceFmt(signal.exit_price)}
            color={signal.status === 'won' ? 'green' : 'red'}
          />
        )}
        {signal.pnl_pct != null && (
          <HBadge
            label="P&L"
            value={`${signal.pnl_pct >= 0 ? '+' : ''}${signal.pnl_pct.toFixed(2)}%`}
            color={signal.pnl_pct >= 0 ? 'green' : 'red'}
          />
        )}
      </div>

      {/* Timeframe selector */}
      <div className="flex gap-2 mb-3">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              timeframe === tf
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative rounded-lg overflow-hidden border border-border">
        <div ref={containerRef} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="text-gray-400 text-sm">Loading chart…</div>
          </div>
        )}
      </div>

      {/* Signal reasons */}
      {signal.signals.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Signal Reasons</div>
          <div className="flex flex-wrap gap-2">
            {signal.signals.map((s, i) => (
              <span
                key={i}
                className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded border border-gray-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HBadge({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    gray: 'text-gray-300',
  }
  return (
    <div className="flex items-center gap-1.5 bg-gray-800/60 px-2.5 py-1 rounded border border-border">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`font-mono font-semibold text-xs ${colorMap[color] ?? 'text-gray-300'}`}>
        {value}
      </span>
    </div>
  )
}
