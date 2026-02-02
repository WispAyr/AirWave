'use client'

import { useEffect, useState } from 'react'
import { Radio, Wifi, WifiOff, Database, Satellite } from 'lucide-react'

interface DataSource {
  enabled: boolean
  name: string
  type: string
  description: string
  status: string
  stats: {
    messages: number
    connected: boolean
    lastMessage: string | null
  }
}

interface SourcesData {
  sources: Record<string, DataSource>
  stats: {
    bySource: Record<string, any>
    totalMessages: number
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'

export default function DataSourceStatus() {
  const [sources, setSources] = useState<SourcesData | null>(null)

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch(`${API_URL}/sources`)
        if (response.ok) {
          const data = await response.json()
          setSources(data)
        }
      } catch (error) {
        console.error('Error fetching data sources:', error)
      }
    }

    fetchSources()
    const interval = setInterval(fetchSources, 5000) // Update every 5s

    return () => clearInterval(interval)
  }, [])

  if (!sources) return null

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'acars':
        return <Radio className="w-4 h-4" />
      case 'adsb':
        return <Satellite className="w-4 h-4" />
      case 'flight_data':
        return <Database className="w-4 h-4" />
      default:
        return <Wifi className="w-4 h-4" />
    }
  }

  const enabledSources = Object.entries(sources.sources).filter(([_, src]) => src.enabled)

  if (enabledSources.length === 0) return null

  return (
    <div className="data-card rounded-lg p-4">
      <h3 className="text-sm font-bold text-spacex-accent font-mono mb-3 flex items-center">
        <Radio className="w-4 h-4 mr-2" />
        DATA SOURCES
      </h3>
      
      <div className="space-y-2">
        {enabledSources.map(([key, source]) => (
          <div
            key={key}
            className="bg-spacex-darker/50 border border-spacex-gray/50 rounded p-2 flex items-center justify-between hover:border-spacex-accent/50 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <div className={source.stats.connected ? 'text-spacex-green' : 'text-gray-500'}>
                {getSourceIcon(source.type)}
              </div>
              <div>
                <div className="font-mono text-xs font-bold text-white">
                  {source.name}
                </div>
                <div className="font-mono text-[10px] text-gray-500">
                  {source.description}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {source.stats.messages > 0 && (
                <div className="text-xs font-mono text-spacex-accent">
                  {source.stats.messages.toLocaleString()}
                </div>
              )}
              <div className="flex items-center">
                {source.stats.connected ? (
                  <Wifi className="w-3 h-3 text-spacex-green animate-pulse" />
                ) : (
                  <WifiOff className="w-3 h-3 text-gray-500" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-2 border-t border-spacex-gray/30">
        <div className="text-xs font-mono text-gray-500 flex items-center justify-between">
          <span>TOTAL MESSAGES</span>
          <span className="text-spacex-accent">{sources.stats.totalMessages.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

