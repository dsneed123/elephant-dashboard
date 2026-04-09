import type { Tab } from '../types'

interface NavTabsProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  counts: { stocks: number; crypto: number; kalshi: number }
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stocks', label: 'Stocks', icon: '📈' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'kalshi', label: 'Kalshi', icon: '🎯' },
]

export function NavTabs({ activeTab, onTabChange, counts }: NavTabsProps) {
  return (
    <nav className="border-b border-slate-800 bg-surface-1">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex gap-0">
          {TABS.map((tab) => {
            const count = counts[tab.id]
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium
                  transition-colors duration-150 focus:outline-none
                  ${
                    isActive
                      ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`
                      min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold leading-none
                      ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-slate-700 text-slate-400'
                      }
                    `}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
