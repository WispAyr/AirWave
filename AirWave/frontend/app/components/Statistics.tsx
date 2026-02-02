import { useMessageStore } from '../store/messageStore'
import { Activity, Radio, CheckCircle, XCircle, Satellite } from 'lucide-react'
import { useMemo } from 'react'

export default function Statistics() {
  const messages = useMessageStore((state) => state.messages)
  
  // Memoize stats calculation to prevent re-renders
  const stats = useMemo(() => {
    const result = {
      total: messages.length,
      byCategory: {} as Record<string, number>,
      byAirline: {} as Record<string, number>,
      byPhase: {} as Record<string, number>,
      bySourceType: {} as Record<string, number>,
    }

    messages.forEach((msg) => {
      if (msg.category) {
        result.byCategory[msg.category] = (result.byCategory[msg.category] || 0) + 1
      }
      if (msg.airline) {
        result.byAirline[msg.airline] = (result.byAirline[msg.airline] || 0) + 1
      }
      if (msg.flight_phase) {
        result.byPhase[msg.flight_phase] = (result.byPhase[msg.flight_phase] || 0) + 1
      }
      const sourceType = msg.source_type || 'acars'
      result.bySourceType[sourceType] = (result.bySourceType[sourceType] || 0) + 1
    })

    return result
  }, [messages.length]) // Only recalculate when length changes

  const topCategory = Object.entries(stats.byCategory)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'

  const topAirline = Object.entries(stats.byAirline)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'

  const acarsCount = stats.bySourceType['acars'] || 0
  const adsbCount = stats.bySourceType['adsb'] || 0
  const sourcePercentage = stats.total > 0 ? ((adsbCount / stats.total) * 100).toFixed(1) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {/* Total Messages */}
      <div className="data-card rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-mono mb-1">TOTAL MESSAGES</p>
            <p className="text-3xl font-bold text-white font-mono">{stats.total}</p>
          </div>
          <Activity className="w-10 h-10 text-spacex-accent opacity-50" />
        </div>
        <div className="mt-2 h-1 bg-spacex-gray rounded-full overflow-hidden">
          <div className="h-full bg-spacex-accent animate-pulse-slow" style={{ width: '75%' }}></div>
        </div>
      </div>

      {/* Top Category */}
      <div className="data-card rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-mono mb-1">TOP CATEGORY</p>
            <p className="text-2xl font-bold text-spacex-green font-mono uppercase">{topCategory}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">
              {stats.byCategory[topCategory] || 0} messages
            </p>
          </div>
          <Radio className="w-10 h-10 text-spacex-green opacity-50" />
        </div>
      </div>

      {/* Top Airline */}
      <div className="data-card rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-mono mb-1">TOP AIRLINE</p>
            <p className="text-2xl font-bold text-spacex-blue-light font-mono">{topAirline}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">
              {stats.byAirline[topAirline] || 0} messages
            </p>
          </div>
          <CheckCircle className="w-10 h-10 text-spacex-blue-light opacity-50" />
        </div>
      </div>

      {/* Active Flights */}
      <div className="data-card rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-mono mb-1">CATEGORIES</p>
            <p className="text-3xl font-bold text-white font-mono">
              {Object.keys(stats.byCategory).length}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <CheckCircle className="w-6 h-6 text-spacex-green mb-1" />
            <XCircle className="w-6 h-6 text-spacex-red opacity-30" />
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 font-mono">
          {Object.keys(stats.byAirline).length} airlines tracked
        </div>
      </div>

      {/* Source Type Distribution */}
      <div className="data-card rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 font-mono mb-1">DATA SOURCES</p>
            <div className="flex items-center space-x-2 mt-2">
              <div className="flex items-center">
                <Radio className="w-4 h-4 text-blue-400 mr-1" />
                <span className="text-sm font-mono text-blue-400">{acarsCount}</span>
              </div>
              <span className="text-gray-500">/</span>
              <div className="flex items-center">
                <Satellite className="w-4 h-4 text-purple-400 mr-1" />
                <span className="text-sm font-mono text-purple-400">{adsbCount}</span>
              </div>
            </div>
          </div>
          <Satellite className="w-10 h-10 text-purple-400 opacity-50" />
        </div>
        <div className="mt-2 text-xs text-gray-500 font-mono">
          {sourcePercentage}% ADS-B
        </div>
      </div>
    </div>
  )
}

