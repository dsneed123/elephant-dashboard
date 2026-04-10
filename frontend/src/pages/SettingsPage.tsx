import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSettings, updateSettings } from '../api/client'
import { Settings } from '../types'
import { useWsContext } from '../context/WebSocketContext'

const STOCK_INTERVALS = ['5m', '15m', '30m'] as const
const CRYPTO_INTERVALS = ['1m', '5m', '15m'] as const

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { setSoundEnabled } = useWsContext()

  const { data: serverSettings, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 60_000,
    refetchInterval: false,
  })

  const [draft, setDraft] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)
  const [newStockTicker, setNewStockTicker] = useState('')
  const [newCryptoTicker, setNewCryptoTicker] = useState('')

  // Sync draft from server data on first load
  useEffect(() => {
    if (serverSettings && !draft) {
      setDraft(serverSettings)
    }
  }, [serverSettings, draft])

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings'], saved)
      setSoundEnabled(saved.sound_alerts_enabled)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  if (isLoading || !draft) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-6 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card p-8 text-center text-red-400">
        Failed to load settings. Is the backend running?
      </div>
    )
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  function addStockTicker() {
    const ticker = newStockTicker.trim().toUpperCase()
    if (!ticker || draft!.stock_watchlist.includes(ticker)) return
    set('stock_watchlist', [...draft!.stock_watchlist, ticker])
    setNewStockTicker('')
  }

  function removeStockTicker(ticker: string) {
    set('stock_watchlist', draft!.stock_watchlist.filter((t) => t !== ticker))
  }

  function addCryptoTicker() {
    const ticker = newCryptoTicker.trim().toUpperCase()
    if (!ticker || draft!.crypto_watchlist.includes(ticker)) return
    // Auto-append -USD suffix if missing
    const normalized = ticker.endsWith('-USD') ? ticker : `${ticker}-USD`
    if (draft!.crypto_watchlist.includes(normalized)) return
    set('crypto_watchlist', [...draft!.crypto_watchlist, normalized])
    setNewCryptoTicker('')
  }

  function removeCryptoTicker(ticker: string) {
    set('crypto_watchlist', draft!.crypto_watchlist.filter((t) => t !== ticker))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-200">Settings</h2>
        <button
          onClick={() => mutation.mutate(draft!)}
          disabled={mutation.isPending}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
          }`}
        >
          {mutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>

      {/* Scan Intervals */}
      <Section title="Scan Frequency">
        <div className="space-y-4">
          <IntervalSelector
            label="Stock scan interval"
            value={draft.stock_scan_interval}
            options={STOCK_INTERVALS}
            onChange={(v) => set('stock_scan_interval', v as Settings['stock_scan_interval'])}
          />
          <IntervalSelector
            label="Crypto scan interval"
            value={draft.crypto_scan_interval}
            options={CRYPTO_INTERVALS}
            onChange={(v) => set('crypto_scan_interval', v as Settings['crypto_scan_interval'])}
          />
        </div>
      </Section>

      {/* Signal Strength Filter */}
      <Section title="Signal Filter">
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm text-gray-400">Minimum signal strength</label>
            <span className="text-sm font-mono text-blue-400">{draft.min_signal_strength}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft.min_signal_strength}
            onChange={(e) => set('min_signal_strength', Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0 (all signals)</span>
            <span>100 (strongest only)</span>
          </div>
        </div>
      </Section>

      {/* Alerts */}
      <Section title="Alerts">
        <div className="space-y-3">
          <Toggle
            label="Sound alerts"
            description="Play a tone when a new signal is detected"
            enabled={draft.sound_alerts_enabled}
            onChange={(v) => set('sound_alerts_enabled', v)}
          />
          <div className="border-t border-border pt-3">
            <Toggle
              label="Discord webhook forwarding"
              description="Post new signals to a Discord channel"
              enabled={draft.discord_webhook_enabled}
              onChange={(v) => set('discord_webhook_enabled', v)}
            />
            {draft.discord_webhook_enabled && (
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={draft.discord_webhook_url}
                  onChange={(e) => set('discord_webhook_url', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-gray-900 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Stock Watchlist */}
      <Section title={`Stock Watchlist (${draft.stock_watchlist.length})`}>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newStockTicker}
            onChange={(e) => setNewStockTicker(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStockTicker()}
            placeholder="Add ticker (e.g. AAPL)"
            className="flex-1 bg-gray-900 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 uppercase"
          />
          <button
            onClick={addStockTicker}
            className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-lg text-sm hover:bg-blue-600/30 transition-colors"
          >
            Add
          </button>
        </div>
        <WatchlistChips tickers={draft.stock_watchlist} onRemove={removeStockTicker} />
      </Section>

      {/* Crypto Watchlist */}
      <Section title={`Crypto Watchlist (${draft.crypto_watchlist.length})`}>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newCryptoTicker}
            onChange={(e) => setNewCryptoTicker(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCryptoTicker()}
            placeholder="Add ticker (e.g. BTC or BTC-USD)"
            className="flex-1 bg-gray-900 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 uppercase"
          />
          <button
            onClick={addCryptoTicker}
            className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-lg text-sm hover:bg-blue-600/30 transition-colors"
          >
            Add
          </button>
        </div>
        <WatchlistChips tickers={draft.crypto_watchlist} onRemove={removeCryptoTicker} />
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  )
}

function IntervalSelector({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              value === opt
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string
  description?: string
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm text-gray-300">{label}</div>
        {description && <div className="text-xs text-gray-600 mt-0.5">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
          enabled ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function WatchlistChips({
  tickers,
  onRemove,
}: {
  tickers: string[]
  onRemove: (t: string) => void
}) {
  if (tickers.length === 0) {
    return <div className="text-xs text-gray-600 italic">No tickers — add some above</div>
  }
  return (
    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
      {tickers.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-800 border border-border rounded text-xs text-gray-300"
        >
          {t}
          <button
            onClick={() => onRemove(t)}
            className="text-gray-600 hover:text-red-400 transition-colors leading-none"
            aria-label={`Remove ${t}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}
