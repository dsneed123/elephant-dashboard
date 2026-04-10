import { KalshiSignal } from '../types'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

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

/** Extract the Kalshi event series from a market ticker (e.g. KXBTC-25APR09-T80000 → kxbtc). */
function kalshiEventSeries(ticker: string): string {
  return ticker.split('-')[0].toLowerCase()
}

function kalshiMarketUrl(ticker: string): string {
  return `https://kalshi.com/markets/${kalshiEventSeries(ticker)}`
}

interface KalshiSignalCardProps {
  signal: KalshiSignal
}

export default function KalshiSignalCard({ signal }: KalshiSignalCardProps) {
  const isYes = signal.side === 'YES'
  const confidencePct = signal.confidence != null ? Math.round(signal.confidence * 100) : null
  const detectedPricePct = signal.detected_price != null ? Math.round(signal.detected_price * 100) : null

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Header: market title + direction badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-xs text-gray-500 font-mono truncate mb-0.5"
            title={signal.market_ticker}
          >
            {signal.market_ticker}
          </div>
          <div className="text-sm font-semibold text-gray-100 leading-snug">
            {signal.market_title ?? signal.market_ticker}
          </div>
        </div>
        <span
          className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
            isYes
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-red-600/20 text-red-400 border border-red-600/30'
          }`}
        >
          {signal.side}
        </span>
      </div>

      {/* Probability gauge */}
      {detectedPricePct != null && (
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>YES probability at detection</span>
            <span className="font-mono text-gray-300">{detectedPricePct}¢</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isYes ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${detectedPricePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Confidence */}
      {confidencePct != null && (
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Signal confidence</span>
            <span className="font-mono text-gray-300">{confidencePct}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Whale info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-gray-500">🐋</span>
          <span className="text-gray-300 truncate font-mono">
            {signal.display_name ?? signal.kalshi_username}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {signal.elephant_score != null && (
            <span className="text-purple-400 font-mono text-[10px]">
              {signal.elephant_score.toFixed(1)}pts
            </span>
          )}
          {signal.tier && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierClass(signal.tier)}`}>
              {tierLabel(signal.tier)}
            </span>
          )}
        </div>
      </div>

      {/* Footer: timestamp + Kalshi link */}
      <div className="flex items-center justify-between text-[10px] text-gray-600 mt-auto pt-1 border-t border-gray-800">
        <span>{timeAgo(signal.created_at)}</span>
        <a
          href={kalshiMarketUrl(signal.market_ticker)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-500 hover:text-purple-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View on Kalshi →
        </a>
      </div>
    </div>
  )
}
