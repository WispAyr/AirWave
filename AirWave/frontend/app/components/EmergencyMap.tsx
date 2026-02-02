'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Icon, LatLngExpression } from 'leaflet'
import { MapPin, Shield, Flame, Activity, Star } from 'lucide-react'
import { EmergencyFeed } from '../store/emergencyAudioStore'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in Next.js
import L from 'leaflet'
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface EmergencyMapProps {
  feeds: EmergencyFeed[]
  selectedFeed: EmergencyFeed | null
  onFeedSelect: (feed: EmergencyFeed) => void
  transcriptions: Array<{ text: string; timestamp: string; feedId?: string }>
}

function MapUpdater({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, zoom)
    }
  }, [center, zoom, map])
  return null
}

function createCustomIcon(type: string, isSelected: boolean, isActive: boolean) {
  const colors = {
    police: '#3b82f6',
    fire: '#ef4444',
    ems: '#22c55e',
    multi: '#f97316'
  }
  
  const color = colors[type as keyof typeof colors] || '#6b7280'
  const size = isSelected ? 40 : 32
  const opacity = isActive ? '1' : '0.7'
  const pulse = isActive ? '<animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite" />' : ''
  
  return new Icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
        <circle cx="16" cy="16" r="14" fill="${color}" opacity="${opacity}"/>
        ${pulse}
        <circle cx="16" cy="16" r="8" fill="#ffffff" opacity="0.9"/>
        ${getIconPath(type)}
      </svg>
    `),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  })
}

function getIconPath(type: string): string {
  switch (type) {
    case 'police':
      return '<path d="M16 10 L12 14 L14 14 L14 20 L18 20 L18 14 L20 14 Z" fill="#3b82f6" stroke="#ffffff" stroke-width="1"/>'
    case 'fire':
      return '<path d="M16 10 C14 12, 12 14, 12 16 C12 18.2, 13.8 20, 16 20 C18.2 20, 20 18.2, 20 16 C20 14, 18 12, 16 10 Z" fill="#ef4444" stroke="#ffffff" stroke-width="1"/>'
    case 'ems':
      return '<path d="M16 11 L16 15 M16 17 L16 21 M12 16 L20 16" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/>'
    case 'multi':
      return '<path d="M16 10 L17.5 14.5 L22 14.5 L18.5 17.5 L20 22 L16 19 L12 22 L13.5 17.5 L10 14.5 L14.5 14.5 Z" fill="#f97316" stroke="#ffffff" stroke-width="1"/>'
    default:
      return '<circle cx="16" cy="16" r="4" fill="#6b7280"/>'
  }
}

export default function EmergencyMap({ feeds, selectedFeed, onFeedSelect, transcriptions }: EmergencyMapProps) {
  const [mounted, setMounted] = useState(false)
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([39.8283, -98.5795]) // Center of USA
  const [mapZoom, setMapZoom] = useState(4)
  const [activeFeeds, setActiveFeeds] = useState<Set<string>>(new Set())
  const [showPolice, setShowPolice] = useState(true)
  const [showFire, setShowFire] = useState(true)
  const [showEms, setShowEms] = useState(true)
  const [showMulti, setShowMulti] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Update map center when feed is selected
  useEffect(() => {
    if (selectedFeed) {
      setMapCenter([selectedFeed.coordinates.lat, selectedFeed.coordinates.lon])
      setMapZoom(10)
    }
  }, [selectedFeed?.id])

  // Track active feeds from transcriptions
  useEffect(() => {
    if (transcriptions.length > 0) {
      const recentFeedIds = new Set(
        transcriptions
          .slice(0, 5)
          .map(t => t.feedId)
          .filter(Boolean) as string[]
      )
      setActiveFeeds(recentFeedIds)
      
      // Clear active status after 30 seconds
      const timeout = setTimeout(() => {
        setActiveFeeds(new Set())
      }, 30000)
      
      return () => clearTimeout(timeout)
    }
  }, [transcriptions])

  const getFilteredFeeds = () => {
    return feeds.filter(feed => {
      if (feed.type === 'police' && !showPolice) return false
      if (feed.type === 'fire' && !showFire) return false
      if (feed.type === 'ems' && !showEms) return false
      if (feed.type === 'multi' && !showMulti) return false
      return true
    })
  }

  const fitBounds = () => {
    if (feeds.length === 0) return
    setMapCenter([39.8283, -98.5795])
    setMapZoom(4)
  }

  if (!mounted) {
    return (
      <div className="data-card rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-400 font-mono mb-4 flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          FEED LOCATIONS
        </h2>
        <div className="relative h-96 bg-spacex-darker/30 rounded border border-spacex-gray/30 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-16 h-16 text-red-400/30 mx-auto mb-4 animate-pulse-slow" />
            <p className="text-gray-500 font-mono text-sm">Loading map...</p>
          </div>
        </div>
      </div>
    )
  }

  const filteredFeeds = getFilteredFeeds()

  return (
    <div className="data-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-red-400 font-mono flex items-center">
          <MapPin className="w-5 h-5 mr-2 animate-pulse" />
          FEED LOCATIONS
        </h2>
        <div className="text-sm font-mono text-gray-400">
          {filteredFeeds.length} FEEDS
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => setShowPolice(!showPolice)}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-mono transition-all ${
            showPolice ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400' : 'bg-spacex-darker border border-spacex-gray/30 text-gray-500'
          }`}
        >
          <Shield className="w-3 h-3" />
          <span>POLICE</span>
        </button>
        <button
          onClick={() => setShowFire(!showFire)}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-mono transition-all ${
            showFire ? 'bg-red-500/20 border border-red-500/50 text-red-400' : 'bg-spacex-darker border border-spacex-gray/30 text-gray-500'
          }`}
        >
          <Flame className="w-3 h-3" />
          <span>FIRE</span>
        </button>
        <button
          onClick={() => setShowEms(!showEms)}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-mono transition-all ${
            showEms ? 'bg-green-500/20 border border-green-500/50 text-green-400' : 'bg-spacex-darker border border-spacex-gray/30 text-gray-500'
          }`}
        >
          <Activity className="w-3 h-3" />
          <span>EMS</span>
        </button>
        <button
          onClick={() => setShowMulti(!showMulti)}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-mono transition-all ${
            showMulti ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400' : 'bg-spacex-darker border border-spacex-gray/30 text-gray-500'
          }`}
        >
          <Star className="w-3 h-3" />
          <span>MULTI</span>
        </button>
        <button
          onClick={fitBounds}
          className="ml-auto px-2 py-1 rounded text-xs font-mono bg-spacex-darker border border-spacex-gray/30 text-gray-400 hover:border-red-400/50 hover:text-red-400 transition-all"
        >
          FIT ALL
        </button>
      </div>

      <div className="relative h-96 rounded border border-red-400/30 overflow-hidden">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%', background: '#000' }}
          className="z-0"
        >
          {/* Dark tile layer for SpaceX theme */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <MapUpdater center={mapCenter} zoom={mapZoom} />

          {/* Feed markers */}
          {filteredFeeds.map((feed) => {
            const isSelected = selectedFeed?.id === feed.id
            const isActive = activeFeeds.has(feed.id)
            
            return (
              <Marker
                key={feed.id}
                position={[feed.coordinates.lat, feed.coordinates.lon]}
                icon={createCustomIcon(feed.type, isSelected, isActive)}
                eventHandlers={{
                  click: () => onFeedSelect(feed)
                }}
              >
                <Popup>
                  <div className="font-mono text-xs bg-spacex-darker text-white p-2 rounded">
                    <div className="font-bold text-sm mb-1" style={{
                      color: feed.type === 'police' ? '#3b82f6' :
                             feed.type === 'fire' ? '#ef4444' :
                             feed.type === 'ems' ? '#22c55e' :
                             feed.type === 'multi' ? '#f97316' : '#6b7280'
                    }}>
                      {feed.name}
                    </div>
                    <div className="text-gray-400">{feed.description}</div>
                    <div className="text-gray-500 text-[10px] mt-1">
                      {feed.county}, {feed.state}
                    </div>
                    <div className="text-gray-400 mt-1 uppercase text-[10px]">
                      {feed.type}
                    </div>
                    {feed.status === 'online' && (
                      <div className="flex items-center text-spacex-green text-[10px] mt-1">
                        <span className="w-2 h-2 bg-spacex-green rounded-full mr-1"></span>
                        ONLINE • {feed.listeners} listeners
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onFeedSelect(feed)
                      }}
                      className="mt-2 w-full bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold transition-colors"
                    >
                      LISTEN
                    </button>
                    {isActive && (
                      <div className="mt-1 text-yellow-400 text-[10px] text-center animate-pulse">
                        🔴 ACTIVE
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {filteredFeeds.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-spacex-darker/80 z-10 pointer-events-none">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-gray-500 mx-auto mb-2 opacity-50" />
              <p className="text-gray-500 font-mono text-sm">
                No feeds match your filters
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
          <span className="text-gray-400">Police</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
          <span className="text-gray-400">Fire</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
          <span className="text-gray-400">EMS</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-orange-500 mr-2"></div>
          <span className="text-gray-400">Multi-Agency</span>
        </div>
        <div className="flex items-center col-span-2">
          <div className="w-4 h-4 rounded-full bg-yellow-400 mr-2 animate-pulse"></div>
          <span className="text-gray-400">Active (Recent Transmission)</span>
        </div>
      </div>
    </div>
  )
}





