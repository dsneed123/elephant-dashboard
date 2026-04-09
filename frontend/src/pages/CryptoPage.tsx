import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCryptoSignals } from '../api/client'
import { Signal } from '../types'
import SignalCard from '../components/SignalCard'
import Modal from '../components/Modal'
import ChartView from '../components/ChartView'
import { useWsContext } from '../context/WebSocketContext'

export default function CryptoPage() {
  const [selected, setSelected] = useState<Signal | null>(null)
  const { liveSignals } = useWsContext()

  const { data: fetched = [], isLoading, isError } = useQuery({
    queryKey: ['signals', 'crypto'],
    queryFn: fetchCryptoSignals,
  })

  // Merge REST + WS signals; WS wins for same ticker
  const signalMap = new Map<string, Signal>()
  for (const s of fetched) signalMap.set(s.ticker, s)
  for (const [k, v] of liveSignals) {
    if (v.asset_type === 'crypto') signalMap.set(k, v)
  }
  const signals = Array.from(signalMap.values()).sort(
    (a, b) => b.strength - a.strength,
  )

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-lg font-semibold text-gray-200">Crypto Signals</h2>
        <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-2 py-0.5 rounded-full">
          {signals.length} active
        </span>
        <span className="ml-auto text-xs text-gray-600">Scans every 1 min · 24/7</span>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 h-52 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="card p-8 text-center text-red-400">
          Failed to load signals. Is the backend running?
        </div>
      )}

      {!isLoading && !isError && signals.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔭</div>
          <div className="text-gray-400 text-sm">
            No active crypto signals — scanner running 24/7
          </div>
        </div>
      )}

      {!isLoading && !isError && signals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {signals.map((s) => (
            <SignalCard
              key={s.ticker}
              signal={s}
              onClick={() => setSelected(s)}
            />
          ))}
        </div>
      )}

      {selected && (
        <Modal
          onClose={() => setSelected(null)}
          title={`${selected.ticker} · ${selected.direction}`}
        >
          <ChartView signal={selected} />
        </Modal>
      )}
    </>
  )
}
