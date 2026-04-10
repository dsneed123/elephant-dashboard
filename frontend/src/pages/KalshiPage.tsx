import { useQuery } from '@tanstack/react-query'
import { fetchKalshiSignals, fetchKalshiWhales } from '../api/client'
import { KalshiWhale } from '../types'
import KalshiSignalCard from '../components/KalshiSignalCard'

function tierLabel(tier: string | null): string {
  switch (tier) {
    case 'top_01': return 'Top 0.1%'
    case 'top_1': return 'Top 1%'
    case 'top_25': return 'Top 25%'
    case 'ranked': return 'Ranked'
    default: return tier ?? 'Unknown'
  }
}

function tierClass(tier: string | null): string {
  switch (tier) {
    case 'top_01': return 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
    case 'top_1': return 'bg-orange-600/20 text-orange-400 border border-orange-600/30'
    case 'top_25': return 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
    default: return 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
  }
}

function WhaleRow({ whale }: { whale: KalshiWhale }) {
  const winRatePct = whale.win_rate != null ? Math.round(whale.win_rate * 100) : null
  const profit =
    whale.total_profit != null
      ? `$${whale.total_profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : null

  return (
    <div className="card p-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gray-400">🐋</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-200 truncate">
            {whale.display_name ?? whale.kalshi_username}
          </div>
          <div className="text-[10px] text-gray-500 font-mono truncate">
            {whale.kalshi_username}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs">
        {whale.elephant_score != null && (
          <span className="text-purple-400 font-mono">
            {whale.elephant_score.toFixed(1)}pts
          </span>
        )}
        {winRatePct != null && (
          <span className="text-gray-400">{winRatePct}% win</span>
        )}
        {profit && (
          <span className="text-green-400 font-mono">{profit}</span>
        )}
        {whale.tier && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierClass(whale.tier)}`}>
            {tierLabel(whale.tier)}
          </span>
        )}
      </div>
    </div>
  )
}

export default function KalshiPage() {
  const { data: signals = [], isLoading: signalsLoading } = useQuery({
    queryKey: ['signals', 'kalshi'],
    queryFn: fetchKalshiSignals,
    staleTime: 60_000,
  })

  const { data: whales = [], isLoading: whalesLoading } = useQuery({
    queryKey: ['signals', 'kalshi', 'whales'],
    queryFn: fetchKalshiWhales,
    staleTime: 60_000,
  })

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-lg font-semibold text-gray-200">Kalshi Events</h2>
        <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-600/30 px-2 py-0.5 rounded-full">
          {signals.length} active
        </span>
      </div>

      {signalsLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 h-48 animate-pulse" />
          ))}
        </div>
      )}

      {!signalsLoading && signals.length === 0 && (
        <div className="card p-12 text-center mb-8">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-gray-400 text-sm">No active Kalshi signals</div>
        </div>
      )}

      {signals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {signals.map((s) => (
            <KalshiSignalCard key={s.market_ticker} signal={s} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Top Whales</h2>
        <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-600/30 px-2 py-0.5 rounded-full">
          {whales.length} tracked
        </span>
      </div>

      {whalesLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-3 h-14 animate-pulse" />
          ))}
        </div>
      )}

      {!whalesLoading && whales.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-2">🐋</div>
          <div className="text-gray-400 text-sm">No whale data available</div>
        </div>
      )}

      {whales.length > 0 && (
        <div className="flex flex-col gap-2">
          {whales.map((w) => (
            <WhaleRow key={w.kalshi_username} whale={w} />
          ))}
        </div>
      )}
    </>
  )
}
