import { useState, useCallback } from 'react'
import { useStockSignals, useCryptoSignals, useKalshiSignals } from './hooks/useSignals'
import { useWebSocket } from './hooks/useWebSocket'
import { TopBar } from './components/TopBar'
import { NavTabs } from './components/NavTabs'
import { SignalGrid } from './components/SignalGrid'
import { FullChartView } from './components/FullChartView'
import type { Signal, Tab } from './types'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('stocks')
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [lastScanTime, setLastScanTime] = useState<string | null>(null)

  const onScanTime = useCallback((t: string) => setLastScanTime(t), [])
  useWebSocket(onScanTime)

  const stocks = useStockSignals()
  const crypto = useCryptoSignals()
  const kalshi = useKalshiSignals()

  const stockSignals = stocks.data ?? []
  const cryptoSignals = crypto.data ?? []
  const kalshiSignals = kalshi.data ?? []

  const totalSignals = stockSignals.length + cryptoSignals.length + kalshiSignals.length

  const activeSignals =
    activeTab === 'stocks'
      ? stockSignals
      : activeTab === 'crypto'
        ? cryptoSignals
        : kalshiSignals

  const activeLoading =
    activeTab === 'stocks'
      ? stocks.isLoading
      : activeTab === 'crypto'
        ? crypto.isLoading
        : kalshi.isLoading

  const activeError =
    activeTab === 'stocks'
      ? stocks.isError
      : activeTab === 'crypto'
        ? crypto.isError
        : kalshi.isError

  return (
    <div className="flex min-h-screen flex-col bg-surface-0">
      <TopBar totalSignals={totalSignals} lastScanTime={lastScanTime} />

      <NavTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          stocks: stockSignals.length,
          crypto: cryptoSignals.length,
          kalshi: kalshiSignals.length,
        }}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        <SignalGrid
          signals={activeSignals}
          isLoading={activeLoading}
          isError={activeError}
          onSelectSignal={setSelectedSignal}
        />
      </main>

      {selectedSignal && (
        <FullChartView
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
        />
      )}
    </div>
  )
}
