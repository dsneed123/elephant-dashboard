import { useQuery } from '@tanstack/react-query'
import { fetchKalshiSignals } from '../api/client'

export default function KalshiPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['signals', 'kalshi'],
    queryFn: fetchKalshiSignals,
    staleTime: 60_000,
  })

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-lg font-semibold text-gray-200">Kalshi Events</h2>
        <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-600/30 px-2 py-0.5 rounded-full">
          {data.length} active
        </span>
      </div>

      {isLoading && (
        <div className="card p-4 h-32 animate-pulse" />
      )}

      {!isLoading && data.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-gray-400 text-sm mb-1">
            Kalshi event contracts — coming soon
          </div>
          <div className="text-gray-600 text-xs">
            Backend integration with Elephant SQLite DB is planned
          </div>
        </div>
      )}

      {data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((s) => (
            <div key={s.ticker} className="card p-4">
              <div className="font-bold text-gray-200">{s.ticker}</div>
              <div className="text-sm text-gray-400">{s.direction}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
