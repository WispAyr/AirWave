'use client'

import { useEffect, useState } from 'react'
import { Radio, Shield, Activity, Clock, Plane } from 'lucide-react'

interface HFGCSStats {
  total: number
  e6b_count: number
  e4b_count: number
  total_messages: number
  activeCount: number
  last_activity: string | null
  lastActivityFormatted: string | null
}

export default function HFGCSStatistics() {
  const [stats, setStats] = useState<HFGCSStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/hfgcs/statistics`)
      if (!response.ok) throw new Error('Failed to fetch statistics')
      const data = await response.json()
      if (data.success && data.stats) {
        setStats(data.stats)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching HFGCS statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return date.toLocaleString()
  }

  if (loading) {
    return (
      <div className="data-card rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500 font-mono text-sm">Loading statistics...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="data-card rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <div className="text-red-500 font-mono text-sm">Error: {error}</div>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="data-card rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <Shield className="w-5 h-5 text-orange-400" />
          <span>STATISTICS</span>
        </h3>
        <div className={`w-2 h-2 rounded-full ${stats.activeCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}></div>
      </div>

      {/* Active Aircraft */}
      <div className="bg-spacex-darker border border-green-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">ACTIVE NOW</p>
            <p className="text-4xl font-bold text-green-400 font-mono">{stats.activeCount}</p>
          </div>
          <Activity className="w-10 h-10 text-green-400 opacity-50" />
        </div>
      </div>

      {/* Total Detected */}
      <div className="bg-spacex-darker border border-orange-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">TOTAL DETECTED</p>
            <p className="text-3xl font-bold text-orange-400 font-mono">{stats.total}</p>
          </div>
          <Radio className="w-10 h-10 text-orange-400 opacity-50" />
        </div>
      </div>

      {/* Aircraft Type Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {/* E-6B Mercury */}
        <div className="bg-spacex-darker border border-blue-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <Plane className="w-4 h-4 text-blue-400" />
            <span className="text-lg font-bold text-blue-400 font-mono">{stats.e6b_count}</span>
          </div>
          <p className="text-xs text-gray-400 font-mono">E-6B</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">TACAMO</p>
        </div>

        {/* E-4B Nightwatch */}
        <div className="bg-spacex-darker border border-orange-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <Plane className="w-4 h-4 text-orange-400" />
            <span className="text-lg font-bold text-orange-400 font-mono">{stats.e4b_count}</span>
          </div>
          <p className="text-xs text-gray-400 font-mono">E-4B</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">NIGHTWATCH</p>
        </div>
      </div>

      {/* Total Messages */}
      <div className="bg-spacex-darker border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">TOTAL MESSAGES</p>
            <p className="text-2xl font-bold text-purple-400 font-mono">{stats.total_messages.toLocaleString()}</p>
          </div>
          <Activity className="w-8 h-8 text-purple-400 opacity-50" />
        </div>
      </div>

      {/* Last Activity */}
      <div className="bg-spacex-darker border border-gray-600/30 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <p className="text-xs text-gray-400 font-mono">LAST ACTIVITY</p>
          </div>
        </div>
        <p className="text-sm text-white font-mono mt-2">
          {formatTimestamp(stats.lastActivityFormatted || stats.last_activity)}
        </p>
      </div>
    </div>
  )
}

