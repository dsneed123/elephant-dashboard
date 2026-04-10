import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createChart, UTCTimestamp, LineStyle } from 'lightweight-charts'
import { fetchPerformanceStats, fetchSignalHistory } from '../api/client'
import {
  CategoryStats,
  EquityPoint,
  HeatmapDay,
  PerformanceStats,
  Signal,
  SignalHistory,
} from '../types'
import Modal from '../components/Modal'
import ChartView from '../components/ChartView'

export default function PerformancePage() {
  const [selectedHistory, setSelectedHistory] = useState<SignalHistory | null>(null)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['performance'],
    queryFn: fetchPerformanceStats,
    staleTime: 60_000,
  })

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['signal-history'],
    queryFn: () => fetchSignalHistory(200),
    staleTime: 60_000,
  })

  const adaptToSignal = (h: SignalHistory): Signal => {
    const risk =
      h.direction === 'LONG'
        ? h.entry_price - h.stop_loss
        : h.stop_loss - h.entry_price
    const reward =
      h.direction === 'LONG'
        ? h.target_1 - h.entry_price
        : h.entry_price - h.target_1
    const rr_ratio = risk > 0 ? Math.abs(reward / risk) : 0

    return {
      ticker: h.ticker,
      direction: h.direction,
      strength: h.strength,
      signals: h.signals,
      entry: h.entry_price,
      stop_loss: h.stop_loss,
      target_1: h.target_1,
      target_2: h.target_2,
      rr_ratio: Math.round(rr_ratio * 100) / 100,
      hold_duration: '',
      rsi: 0,
      atr_pct: 0,
      vol_ratio: 0,
      current_price: h.exit_price ?? h.entry_price,
      timestamp: h.created_at,
      status: h.status,
      asset_type: h.asset_type,
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-semibold text-gray-200">Performance</h2>
        {stats && (
          <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-600/30 px-2 py-0.5 rounded-full">
            {stats.total} resolved
          </span>
        )}
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <>
          <StatsGrid stats={stats} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <EquityCurve equityCurve={stats.equity_curve} />
            </div>
            <CalendarHeatmap heatmap={stats.heatmap} />
          </div>

          {(stats.best || stats.worst) && (
            <BestWorst best={stats.best} worst={stats.worst} />
          )}

          {stats.by_category.length > 0 && (
            <CategoryBreakdown categories={stats.by_category} />
          )}
        </>
      ) : null}

      <SignalHistoryTable
        history={history}
        isLoading={histLoading}
        onSelect={setSelectedHistory}
      />

      {selectedHistory && (
        <Modal
          onClose={() => setSelectedHistory(null)}
          title={`${selectedHistory.ticker} · ${selectedHistory.direction} · ${selectedHistory.status.toUpperCase()}`}
        >
          <ChartView signal={adaptToSignal(selectedHistory)} />
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats grid
// ---------------------------------------------------------------------------

function StatsGrid({ stats }: { stats: PerformanceStats }) {
  const fmt = (v: number | null, suffix = '') =>
    v === null ? '—' : `${v}${suffix}`

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Signals" value={stats.total.toString()} />
        <StatCard label="Wins" value={stats.wins.toString()} color="green" />
        <StatCard label="Losses" value={stats.losses.toString()} color="red" />
        <StatCard label="Expired" value={stats.expired.toString()} color="gray" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Win Rate" value={fmt(stats.win_rate, '%')} color="blue" />
        <StatCard label="Win Rate 7d" value={fmt(stats.win_rate_7d, '%')} color="blue" />
        <StatCard label="Win Rate 30d" value={fmt(stats.win_rate_30d, '%')} color="blue" />
        <StatCard label="Avg Gain" value={fmt(stats.avg_gain_pct, '%')} color="green" />
        <StatCard
          label="Avg Loss"
          value={stats.avg_loss_pct === null ? '—' : `-${stats.avg_loss_pct}%`}
          color="red"
        />
        <StatCard
          label="Profit Factor"
          value={fmt(stats.profit_factor)}
          color={
            stats.profit_factor === null
              ? 'gray'
              : stats.profit_factor >= 1
              ? 'green'
              : 'red'
          }
        />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'default',
}: {
  label: string
  value: string
  color?: string
}) {
  const colorMap: Record<string, string> = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    gray: 'text-gray-400',
    default: 'text-gray-100',
  }
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${colorMap[color] ?? colorMap.default}`}>
        {value}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Equity curve (lightweight-charts area series)
// ---------------------------------------------------------------------------

function EquityCurve({ equityCurve }: { equityCurve: EquityPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || equityCurve.length === 0) return

    const finalPnl = equityCurve[equityCurve.length - 1]?.cumulative_pnl ?? 0
    const lineColor = finalPnl >= 0 ? '#22c55e' : '#ef4444'
    const topColor =
      finalPnl >= 0 ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'

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
      rightPriceScale: { borderColor: '#2a2d3a' },
      timeScale: {
        borderColor: '#2a2d3a',
        timeVisible: true,
        secondsVisible: false,
      },
      width: el.clientWidth,
      height: 240,
    })

    const areaSeries = chart.addAreaSeries({
      lineColor,
      topColor,
      bottomColor: 'rgba(0,0,0,0)',
      lineWidth: 2,
    })

    areaSeries.setData(
      equityCurve.map((p) => ({
        time: p.date as unknown as UTCTimestamp,
        value: p.cumulative_pnl,
      })),
    )

    areaSeries.createPriceLine({
      price: 0,
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    })

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [equityCurve])

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Equity Curve</h3>
      {equityCurve.length === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-gray-500 text-sm">
          No resolved signals yet — equity curve will appear here
        </div>
      ) : (
        <div ref={containerRef} className="rounded overflow-hidden" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calendar heatmap
// ---------------------------------------------------------------------------

function CalendarHeatmap({ heatmap }: { heatmap: HeatmapDay[] }) {
  const pnlByDate = new Map<string, number>()
  for (const { date, pnl } of heatmap) {
    pnlByDate.set(date, pnl)
  }

  // Build 16-week grid ending today, aligned to Sunday
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - 15 * 7)
  start.setDate(start.getDate() - start.getDay()) // snap to Sunday

  const weeks: Array<Array<{ date: string; pnl: number | null; isFuture: boolean }>> = []
  const cursor = new Date(start)

  while (cursor <= today || weeks.length === 0) {
    const week: Array<{ date: string; pnl: number | null; isFuture: boolean }> = []
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().split('T')[0]
      week.push({
        date: dateStr,
        pnl: pnlByDate.get(dateStr) ?? null,
        isFuture: cursor > today,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    if (cursor > today) break
  }

  const cellColor = (pnl: number | null, isFuture: boolean) => {
    if (isFuture) return 'opacity-0'
    if (pnl === null) return 'bg-gray-800/60'
    if (pnl > 3) return 'bg-green-500'
    if (pnl > 0) return 'bg-green-700'
    if (pnl < -3) return 'bg-red-500'
    if (pnl < 0) return 'bg-red-800'
    return 'bg-gray-600'
  }

  // Show Mon/Wed/Fri labels only (odd indices 1,3,5)
  const DAY_LABELS = ['', 'M', '', 'W', '', 'F', '']

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Daily P&amp;L</h3>
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="flex flex-col gap-1 mr-1 shrink-0">
          {DAY_LABELS.map((d, i) => (
            <div
              key={i}
              className="text-[9px] text-gray-600 h-3 w-2.5 flex items-center leading-3"
            >
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 shrink-0">
            {week.map((day, di) => (
              <div
                key={di}
                className={`w-3 h-3 rounded-[2px] ${cellColor(day.pnl, day.isFuture)} cursor-default`}
                title={
                  !day.isFuture && day.pnl !== null
                    ? `${day.date}: ${day.pnl >= 0 ? '+' : ''}${day.pnl.toFixed(2)}%`
                    : day.isFuture
                    ? ''
                    : day.date
                }
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
        <div className="w-2.5 h-2.5 rounded-sm bg-red-500 shrink-0" />
        <span>Loss</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0 ml-1" />
        <span>Gain</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-gray-800/60 shrink-0 ml-1" />
        <span>No data</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Best / Worst signal cards
// ---------------------------------------------------------------------------

function BestWorst({
  best,
  worst,
}: {
  best: PerformanceStats['best']
  worst: PerformanceStats['worst']
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {best && (
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Best Signal
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-gray-100">{best.ticker}</span>
              <span className="ml-2 text-xs text-gray-400">{best.direction}</span>
              <span className="ml-2 text-xs text-gray-500 capitalize">{best.asset_type}</span>
            </div>
            <div className="text-2xl font-bold font-mono text-green-400">
              +{best.pnl_pct?.toFixed(2)}%
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(best.created_at).toLocaleDateString()}
          </div>
        </div>
      )}
      {worst && (
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Worst Signal
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-gray-100">{worst.ticker}</span>
              <span className="ml-2 text-xs text-gray-400">{worst.direction}</span>
              <span className="ml-2 text-xs text-gray-500 capitalize">
                {worst.asset_type}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-red-400">
              {worst.pnl_pct?.toFixed(2)}%
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(worst.created_at).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

function CategoryBreakdown({ categories }: { categories: CategoryStats[] }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Performance by Category
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const rate =
            cat.total > 0 ? Math.round((cat.wins / cat.total) * 100) : 0
          return (
            <div key={cat.asset_type} className="bg-gray-800/40 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-200 capitalize">
                  {cat.asset_type}
                </span>
                <span
                  className={`text-sm font-bold font-mono ${
                    rate >= 50 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {rate}%
                </span>
              </div>
              <div className="flex gap-3 text-xs text-gray-400 mb-2">
                <span>{cat.total} total</span>
                <span className="text-green-500">{cat.wins}W</span>
                <span className="text-red-500">{cat.losses}L</span>
              </div>
              <div className="h-1 rounded-full bg-gray-700">
                <div
                  className={`h-1 rounded-full transition-all ${
                    rate >= 50 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signal history table
// ---------------------------------------------------------------------------

function SignalHistoryTable({
  history,
  isLoading,
  onSelect,
}: {
  history: SignalHistory[]
  isLoading: boolean
  onSelect: (h: SignalHistory) => void
}) {
  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="h-5 w-32 bg-gray-800 rounded animate-pulse mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-800/40 rounded animate-pulse mb-2" />
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="card p-8 text-center text-gray-500 text-sm">
        No signal history yet — signals appear here once resolved (won / lost / expired)
      </div>
    )
  }

  const statusBadge = (status: string) => {
    const cls =
      {
        won: 'bg-green-600/20 text-green-400 border-green-600/30',
        lost: 'bg-red-600/20 text-red-400 border-red-600/30',
        expired: 'bg-gray-600/20 text-gray-400 border-gray-600/30',
        active: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
      }[status] ?? 'bg-gray-700 text-gray-300 border-gray-600'

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>
        {status}
      </span>
    )
  }

  const priceFmt = (n: number | null) => {
    if (n === null) return '—'
    return n < 10 ? n.toFixed(4) : n.toFixed(2)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Signal History</h3>
        <span className="text-xs text-gray-500">{history.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
              <th className="pb-2 text-left font-medium">Date</th>
              <th className="pb-2 text-left font-medium">Ticker</th>
              <th className="pb-2 text-left font-medium">Dir</th>
              <th className="pb-2 text-left font-medium">Type</th>
              <th className="pb-2 text-right font-medium">Entry</th>
              <th className="pb-2 text-right font-medium">Exit</th>
              <th className="pb-2 text-right font-medium">P&amp;L</th>
              <th className="pb-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((h) => (
              <tr
                key={h.signal_id}
                onClick={() => onSelect(h)}
                className="hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="py-2.5 text-gray-400 text-xs">
                  {new Date(h.created_at).toLocaleDateString()}
                </td>
                <td className="py-2.5 font-semibold text-gray-100">{h.ticker}</td>
                <td className="py-2.5">
                  <span
                    className={`text-xs font-semibold ${
                      h.direction === 'LONG' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {h.direction}
                  </span>
                </td>
                <td className="py-2.5 text-xs text-gray-500 capitalize">
                  {h.asset_type}
                </td>
                <td className="py-2.5 text-right font-mono text-gray-300 text-xs">
                  {priceFmt(h.entry_price)}
                </td>
                <td className="py-2.5 text-right font-mono text-gray-300 text-xs">
                  {priceFmt(h.exit_price)}
                </td>
                <td className="py-2.5 text-right">
                  {h.pnl_pct === null ? (
                    <span className="text-gray-500 text-xs">—</span>
                  ) : (
                    <span
                      className={`font-mono font-semibold text-xs ${
                        h.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {h.pnl_pct >= 0 ? '+' : ''}
                      {h.pnl_pct.toFixed(2)}%
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-center">{statusBadge(h.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
