import { useEffect, useState } from 'react'

interface TopBarProps {
  totalSignals: number
  lastScanTime: string | null
}

function getMarketStatus(): { stocks: boolean; crypto: boolean } {
  const now = new Date()
  // Convert to NY time
  const nyStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const ny = new Date(nyStr)
  const h = ny.getHours()
  const m = ny.getMinutes()
  const day = ny.getDay() // 0=Sun, 6=Sat
  const isWeekday = day >= 1 && day <= 5
  const afterOpen = h > 9 || (h === 9 && m >= 30)
  const beforeClose = h < 16
  return {
    stocks: isWeekday && afterOpen && beforeClose,
    crypto: true,
  }
}

function formatScanTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function TopBar({ totalSignals, lastScanTime }: TopBarProps) {
  const [now, setNow] = useState(new Date())
  const [market, setMarket] = useState(getMarketStatus())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date())
      setMarket(getMarketStatus())
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-surface-1/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-white">
            Elephant<span className="text-blue-400">.</span>
          </span>
          <span className="hidden rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 sm:inline">
            Signal Dashboard
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm">
          {/* Total signals */}
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_2px_rgba(96,165,250,0.5)]" />
            <span className="font-mono font-semibold text-white">{totalSignals}</span>
            <span className="hidden text-slate-500 sm:inline">active signals</span>
          </div>

          {/* Market status */}
          <div className="hidden items-center gap-3 sm:flex">
            <MarketBadge label="Stocks" open={market.stocks} />
            <MarketBadge label="Crypto" open={market.crypto} />
          </div>

          {/* Last scan */}
          {lastScanTime && (
            <div className="hidden items-center gap-1 text-slate-500 lg:flex">
              <span>Scan</span>
              <span className="font-mono text-slate-400">{formatScanTime(lastScanTime)}</span>
            </div>
          )}

          {/* Clock */}
          <span className="font-mono text-xs text-slate-600">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </header>
  )
}

function MarketBadge({ label, open }: { label: string; open: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          open
            ? 'bg-emerald-400 shadow-[0_0_5px_1px_rgba(52,211,153,0.6)]'
            : 'bg-slate-600'
        }`}
      />
      <span className="text-xs text-slate-400">
        {label}{' '}
        <span className={open ? 'text-emerald-400' : 'text-slate-600'}>
          {open ? 'Open' : 'Closed'}
        </span>
      </span>
    </div>
  )
}
