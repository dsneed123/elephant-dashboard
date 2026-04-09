import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchStockSignals } from '../api/client'
import { Signal } from '../types'
import SignalCard from '../components/SignalCard'
import Modal from '../components/Modal'
import ChartView from '../components/ChartView'
import { useWsContext } from '../context/WebSocketContext'

export default function StocksPage() {
  const [selected, setSelected] = useState<Signal | null>(null)
  const { liveSignals } = useWsContext()

  const { data: fetched = [], isLoading, isError } = useQuery({
    queryKey: ['signals', 'stocks'],
    queryFn: fetchStockSignals,
  })

  // Merge REST data with any WS-pushed signals (WS wins for same ticker)
  const signalMap = new Map<string, Signal>()
  for (const s of fetched) signalMap.set(s.ticker, s)
  for (const [k, v] of liveSignals) {
    if (v.asset_type === 'stock') signalMap.set(k, v)
  }
  const signals = Array.from(signalMap.values()).sort(
    (a, b) => b.strength - a.strength,
  )

  return (
    <>
      <SectionHeader count={signals.length} label="Stock Signals" />
      <SignalGrid
        signals={signals}
        isLoading={isLoading}
        isError={isError}
        onSelect={setSelected}
      />
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

function SectionHeader({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="text-lg font-semibold text-gray-200">{label}</h2>
      <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-2 py-0.5 rounded-full">
        {count} active
      </span>
    </div>
  )
}

interface SignalGridProps {
  signals: Signal[]
  isLoading: boolean
  isError: boolean
  onSelect: (s: Signal) => void
}

function SignalGrid({ signals, isLoading, isError, onSelect }: SignalGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 h-52 animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card p-8 text-center text-red-400">
        Failed to load signals. Is the backend running?
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-4xl mb-3">📡</div>
        <div className="text-gray-400 text-sm">No active signals — scanner is watching the market</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {signals.map((s) => (
        <SignalCard
          key={s.ticker}
          signal={s}
          onClick={() => onSelect(s)}
        />
      ))}
    </div>
  )
}
