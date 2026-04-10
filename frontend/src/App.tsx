import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WebSocketProvider } from './context/WebSocketContext'
import { useWsContext } from './context/WebSocketContext'
import TopBar from './components/TopBar'
import StocksPage from './pages/StocksPage'
import CryptoPage from './pages/CryptoPage'
import KalshiPage from './pages/KalshiPage'
import PerformancePage from './pages/PerformancePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 30_000,
      staleTime: 15_000,
      retry: 2,
    },
  },
})

type Tab = 'Stocks' | 'Crypto' | 'Kalshi' | 'Performance'

function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('Stocks')
  const { status } = useWsContext()

  return (
    <div className="min-h-screen bg-gray-950">
      <TopBar wsStatus={status} />

      {/* Tab navigation */}
      <nav className="border-b border-border sticky top-[56px] z-30 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 flex">
          {(['Stocks', 'Crypto', 'Kalshi', 'Performance'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'Stocks' && <StocksPage />}
        {activeTab === 'Crypto' && <CryptoPage />}
        {activeTab === 'Kalshi' && <KalshiPage />}
        {activeTab === 'Performance' && <PerformancePage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <Dashboard />
      </WebSocketProvider>
    </QueryClientProvider>
  )
}
