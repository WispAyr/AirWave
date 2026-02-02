'use client'

import { useEffect, useState, useRef } from 'react'
import useWebSocket from 'react-use-websocket'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import { ArrowLeft, MapPin, Plane, Settings as SettingsIcon, Satellite, Radio } from 'lucide-react'
import { ACARSMessage } from '../types'

// Dynamic import for Leaflet (client-side only)
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
)

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5773/ws'

// Preset regions
const REGIONS = {
  // Continental United States
  conus: {
    name: 'Continental United States',
    center: [39.8283, -98.5795],
    zoom: 5,
    radius: 2500000 // 2500km
  },
  eastcoast: {
    name: 'US East Coast',
    center: [38.9072, -77.0369],
    zoom: 6,
    radius: 800000 // 800km
  },
  westcoast: {
    name: 'US West Coast',
    center: [37.7749, -122.4194],
    zoom: 6,
    radius: 800000
  },
  europe: {
    name: 'Europe',
    center: [50.8503, 4.3517],
    zoom: 5,
    radius: 2000000 // 2000km
  },
  northatlantic: {
    name: 'North Atlantic',
    center: [45.0, -30.0],
    zoom: 4,
    radius: 3000000 // 3000km
  },
  // UK Regions
  uk: {
    name: 'United Kingdom',
    center: [54.0, -2.5],
    zoom: 6,
    radius: 500000 // 500km
  },
  prestwick: {
    name: 'Prestwick Airport (EGPK)',
    center: [55.5094, -4.5867],
    zoom: 10,
    radius: 50000 // 50km
  },
  glasgow: {
    name: 'Glasgow Airport (EGPF)',
    center: [55.8719, -4.4333],
    zoom: 10,
    radius: 50000
  },
  edinburgh: {
    name: 'Edinburgh Airport (EGPH)',
    center: [55.9500, -3.3725],
    zoom: 10,
    radius: 50000
  },
  heathrow: {
    name: 'Heathrow Airport (EGLL)',
    center: [51.4700, -0.4543],
    zoom: 10,
    radius: 50000
  },
  custom: {
    name: 'Custom Region',
    center: [39.8283, -98.5795],
    zoom: 5,
    radius: 1000000
  }
}

export default function SituationalAwarenessPage() {
  const [aircraft, setAircraft] = useState<ACARSMessage[]>([])
  const [selectedRegion, setSelectedRegion] = useState<keyof typeof REGIONS>('conus')
  const [customCenter, setCustomCenter] = useState({ lat: 39.8283, lon: -98.5795 })
  const [customRadius, setCustomRadius] = useState(50000)
  const [showSettings, setShowSettings] = useState(false)
  const [tar1090Status, setTar1090Status] = useState<any>(null)
  const [dataSources, setDataSources] = useState<any>(null)
  const [enabledSources, setEnabledSources] = useState<Set<string>>(new Set(['tar1090', 'opensky', 'adsbexchange']))
  const [militaryOnly, setMilitaryOnly] = useState(false)
  const [highlightTACAMO, setHighlightTACAMO] = useState(false)
  const [highlightNightwatch, setHighlightNightwatch] = useState(false)

  const region = selectedRegion === 'custom' 
    ? { ...REGIONS.custom, center: [customCenter.lat, customCenter.lon], radius: customRadius }
    : REGIONS[selectedRegion]

  // Fetch data sources status
  useEffect(() => {
    const fetchDataSources = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/sources`)
        if (response.ok) {
          const data = await response.json()
          setDataSources(data.sources)
          console.log('📡 Data Sources:', data.sources)
          
          // Also update TAR1090 status for backward compatibility
          if (data.sources?.tar1090) {
            setTar1090Status({
              connected: data.sources.tar1090.stats?.connected || false,
              messageCount: data.sources.tar1090.stats?.messages || 0
            })
          }
        }
      } catch (error) {
        console.error('Error fetching data sources:', error)
      }
    }
    
    fetchDataSources()
    const interval = setInterval(fetchDataSources, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [])

  // WebSocket for real-time ADS-B updates
  const { lastMessage } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  })

  // Handle incoming ADS-B messages (batched or individual)
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const wsData = JSON.parse(lastMessage.data)
        
        // Handle batched ADS-B messages
        if (wsData.type === 'adsb_batch') {
          console.log(`📦 Batch: ${wsData.count} aircraft`)
          
          setAircraft(prev => {
            const aircraftMap = new Map()
            
            // Build map from existing aircraft
            prev.forEach(ac => {
              const key = ac.hex || ac.tail || ac.flight || ac.id
              aircraftMap.set(key, ac)
            })
            
            // Update with batch data
            wsData.data.forEach(message => {
              if (message.position?.lat && message.position?.lon) {
                const key = message.hex || message.tail || message.flight || message.id
                aircraftMap.set(key, message)
              }
            })
            
            // Convert back to array, keep last 300 aircraft
            return Array.from(aircraftMap.values()).slice(-300)
          })
        }
        // Handle individual messages (backward compatibility)
        else if (wsData.type === 'adsb' || wsData.type === 'acars') {
          const message = wsData.data
          
          // Check if aircraft has position
          if (message.position?.lat && message.position?.lon) {
            setAircraft(prev => {
              // Use hex/tail/flight as unique key
              const key = message.hex || message.tail || message.flight || message.id
              
              // Find and update existing or add new
              const existing = prev.findIndex(a => {
                const aKey = a.hex || a.tail || a.flight || a.id
                return aKey === key
              })
              
              if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = message
                return updated
              } else {
                return [...prev, message].slice(-300) // Keep last 300 aircraft
              }
            })
          }
        }
      } catch (error) {
        console.error('Error parsing WS message:', error)
      }
    }
  }, [lastMessage])

  // Helper function to detect TACAMO (E-6B) aircraft
  const isTACAMO = (ac: ACARSMessage) => {
    // Check hex codes (AE0C6E-AE0C7D, AE1026-AE1027, AE140B-AE1422)
    if (ac.hex) {
      const hex = ac.hex.toUpperCase()
      const hexNum = parseInt(hex, 16)
      if ((hexNum >= 0xAE0C6E && hexNum <= 0xAE0C7D) ||
          (hexNum >= 0xAE1026 && hexNum <= 0xAE1027) ||
          (hexNum >= 0xAE140B && hexNum <= 0xAE1422)) {
        return true
      }
    }
    // Check callsigns
    const callsign = (ac.flight || ac.tail || '').toUpperCase().trim()
    return callsign.includes('IRON') || callsign.includes('GOTO')
  }

  // Helper function to detect Nightwatch (E-4B) aircraft
  const isNightwatch = (ac: ACARSMessage) => {
    // Check hex codes (ADFEB3-ADFEB6)
    if (ac.hex) {
      const hex = ac.hex.toUpperCase()
      const hexNum = parseInt(hex, 16)
      if (hexNum >= 0xADFEB3 && hexNum <= 0xADFEB6) {
        return true
      }
    }
    // Check callsigns
    const callsign = (ac.flight || ac.tail || '').toUpperCase().trim()
    return callsign.startsWith('GORDO') || callsign.startsWith('TITAN') || callsign.startsWith('SLICK')
  }

  // Filter aircraft within region
  const aircraftInRegion = aircraft.filter(ac => {
    if (!ac.position?.lat || !ac.position?.lon) return false
    
    // Check if source is enabled
    const sourceId = ac.source?.station_id || 'tar1090'
    if (!enabledSources.has(sourceId)) {
      console.log('🚫 Filtered out - source not enabled:', sourceId, 'Enabled:', Array.from(enabledSources))
      return false
    }
    
    // Check military filter with heuristics
    if (militaryOnly) {
      const explicitlyMilitary = (ac as any).military
      // Fallback: check for US military hex ranges (AE**** range)
      const militaryByHex = ac.hex && ac.hex.toUpperCase().startsWith('AE')
      if (!explicitlyMilitary && !militaryByHex) return false
    }
    
    const distance = getDistance(
      region.center[0], region.center[1],
      ac.position.lat, ac.position.lon
    )
    
    const inRegion = distance <= region.radius
    
    if (inRegion) {
      console.log('📍 Aircraft in region:', ac.flight || ac.tail, `${(distance/1000).toFixed(1)}km from center`)
    }
    
    return inRegion
  })
  
  // Debug: log aircraft state
  useEffect(() => {
    console.log('🛩️ Total aircraft:', aircraft.length, 'In region:', aircraftInRegion.length)
  }, [aircraft.length, aircraftInRegion.length])

  // Remove stale aircraft (not updated in 2 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setAircraft(prev => prev.filter(ac => {
        const timestamp = new Date(ac.timestamp).getTime()
        return now - timestamp < 120000 // 2 minutes
      }))
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-spacex-dark">
      <div className="scan-line" />
      
      {/* Header */}
      <div className="border-b border-spacex-gray bg-spacex-darker/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="p-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-spacex-accent transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-spacex-accent" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center space-x-3">
                  <Satellite className="w-7 h-7 text-purple-400" />
                  <span className="glitch" data-text="SITUATIONAL AWARENESS">SITUATIONAL AWARENESS</span>
                </h1>
                <p className="text-gray-400 text-sm mt-1 font-mono">Regional ADS-B Traffic Monitoring</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Data Sources Summary */}
              <div className="text-right">
                <p className="text-xs text-gray-400 font-mono">ACTIVE SOURCES</p>
                <p className="text-sm font-bold font-mono text-spacex-accent">
                  {dataSources ? Object.keys(dataSources).filter(k => dataSources[k]?.stats?.connected).length : 0} / {dataSources ? Object.keys(dataSources).length : 0}
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-xs text-gray-400 font-mono">AIRCRAFT IN REGION</p>
                <p className="text-2xl font-bold text-spacex-accent font-mono">{aircraftInRegion.length}</p>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-spacex-accent transition-colors"
              >
                <SettingsIcon className="w-5 h-5 text-spacex-accent" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Panel */}
          <div className={`lg:col-span-1 space-y-4 ${showSettings ? '' : 'hidden lg:block'}`}>
            {/* Region Selection */}
            <div className="data-card p-4">
              <h2 className="text-white font-bold mb-3 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-spacex-accent" />
                REGION
              </h2>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value as keyof typeof REGIONS)}
                className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono text-sm focus:border-spacex-accent outline-none"
              >
                {Object.entries(REGIONS).map(([key, reg]) => (
                  <option key={key} value={key}>{reg.name}</option>
                ))}
              </select>

              {selectedRegion === 'custom' && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 font-mono mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.001"
                      value={customCenter.lat}
                      onChange={(e) => setCustomCenter({ ...customCenter, lat: parseFloat(e.target.value) })}
                      className="w-full bg-spacex-darker border border-spacex-gray rounded px-2 py-1 text-white font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-mono mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.001"
                      value={customCenter.lon}
                      onChange={(e) => setCustomCenter({ ...customCenter, lon: parseFloat(e.target.value) })}
                      className="w-full bg-spacex-darker border border-spacex-gray rounded px-2 py-1 text-white font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-mono mb-1">Radius: {(customRadius/1000).toFixed(0)}km</label>
                    <input
                      type="range"
                      min="10000"
                      max="200000"
                      step="10000"
                      value={customRadius}
                      onChange={(e) => setCustomRadius(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Data Sources Panel */}
            <div className="data-card p-4">
              <h2 className="text-white font-bold mb-3 flex items-center">
                <Satellite className="w-5 h-5 mr-2 text-purple-400" />
                DATA SOURCES
              </h2>
              <div className="space-y-3">
                {dataSources && Object.entries(dataSources).map(([sourceId, source]: [string, any]) => {
                  const isConnected = source.stats?.connected || false
                  const messageCount = source.stats?.messages || 0
                  const sourceName = sourceId === 'tar1090' ? 'TAR1090' : sourceId === 'opensky' ? 'OpenSky' : sourceId === 'adsbexchange' ? 'ADS-B Exchange' : sourceId
                  
                  return (
                    <div key={sourceId} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`source-${sourceId}`}
                          checked={enabledSources.has(sourceId)}
                          onChange={(e) => {
                            const newSet = new Set(enabledSources)
                            if (e.target.checked) {
                              newSet.add(sourceId)
                            } else {
                              newSet.delete(sourceId)
                            }
                            setEnabledSources(newSet)
                          }}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`source-${sourceId}`} className="text-xs font-mono text-white cursor-pointer">
                          {sourceName}
                        </label>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-mono ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                          {isConnected ? '●' : '○'}
                        </p>
                        {isConnected && (
                          <p className="text-xs text-gray-500 font-mono">{messageCount}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Filters Panel */}
            <div className="data-card p-4">
              <h2 className="text-white font-bold mb-3 flex items-center">
                <Radio className="w-5 h-5 mr-2 text-yellow-400" />
                FILTERS
              </h2>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="military-only"
                    checked={militaryOnly}
                    onChange={(e) => setMilitaryOnly(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="military-only" className="text-xs font-mono text-white cursor-pointer">
                    Military Only
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="highlight-tacamo"
                    checked={highlightTACAMO}
                    onChange={(e) => setHighlightTACAMO(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="highlight-tacamo" className="text-xs font-mono text-orange-400 cursor-pointer">
                    Highlight TACAMO (E-6B)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="highlight-nightwatch"
                    checked={highlightNightwatch}
                    onChange={(e) => setHighlightNightwatch(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="highlight-nightwatch" className="text-xs font-mono text-purple-400 cursor-pointer">
                    Highlight Nightwatch (E-4B)
                  </label>
                </div>
              </div>
              
              {/* Source Legend */}
              <div className="mt-4 pt-4 border-t border-spacex-gray">
                <p className="text-xs text-gray-400 font-mono mb-2">SOURCE COLORS</p>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{background: '#00d8ff'}}></div>
                    <span className="text-xs font-mono text-gray-400">TAR1090</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{background: '#00ff64'}}></div>
                    <span className="text-xs font-mono text-gray-400">OpenSky</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{background: '#6496ff'}}></div>
                    <span className="text-xs font-mono text-gray-400">ADS-B Exchange</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Aircraft List */}
            <div className="data-card p-4 max-h-[600px] overflow-y-auto">
              <h2 className="text-white font-bold mb-3 flex items-center">
                <Plane className="w-5 h-5 mr-2 text-purple-400" />
                AIRCRAFT ({aircraftInRegion.length})
              </h2>
              <div className="space-y-2">
                {aircraftInRegion.map(ac => {
                  const sourceId = ac.source?.station_id || 'tar1090'
                  const isMilitary = (ac as any).military
                  const isTacamo = highlightTACAMO && isTACAMO(ac)
                  const isNightwatchAc = highlightNightwatch && isNightwatch(ac)
                  
                  return (
                    <div key={ac.id} className="bg-spacex-darker border border-spacex-gray rounded p-2 hover:border-purple-400 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-white font-mono text-sm font-bold">
                              {ac.flight || ac.tail || ac.id.substring(0, 8)}
                            </p>
                            <span className={`source-badge source-badge-${sourceId}`}>
                              {sourceId === 'tar1090' ? 'T90' : sourceId === 'opensky' ? 'OSK' : 'ADX'}
                            </span>
                            {isMilitary && !isTacamo && !isNightwatchAc && (
                              <span className="military-indicator">MIL</span>
                            )}
                            {isTacamo && (
                              <span className="military-indicator tacamo-indicator">E-6B</span>
                            )}
                            {isNightwatchAc && (
                              <span className="military-indicator nightwatch-indicator">E-4B</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono">
                            {ac.squawk && `SQ: ${ac.squawk} | `}
                            {ac.position?.altitude && `${ac.position.altitude}ft`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-purple-400 font-mono">
                            {ac.ground_speed && `${ac.ground_speed}kts`}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {ac.heading !== undefined && `${ac.heading}°`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {aircraftInRegion.length === 0 && (
                  <div className="text-gray-500 text-xs font-mono text-center py-4">
                    {!dataSources || Object.keys(dataSources).filter(k => dataSources[k]?.stats?.connected).length === 0 ? (
                      <div className="text-red-400">
                        <p className="font-bold">⚠️ No Data Sources Connected</p>
                        <p className="mt-2">Go to Admin to configure sources</p>
                        <p>Enable at least one ADS-B source</p>
                      </div>
                    ) : (
                      <>
                        <p>No aircraft in region</p>
                        <p className="mt-2 text-gray-600">Total tracked: {aircraft.length}</p>
                        {aircraft.length > 0 && (
                          <p className="mt-1 text-gray-600">
                            Try expanding radius or changing region
                          </p>
                        )}
                        {aircraft.length === 0 && (
                          <p className="mt-2 text-yellow-500">
                            Sources connected but no aircraft overhead
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <div className="data-card p-2 h-[800px]">
              <MapContainer
                center={region.center as [number, number]}
                zoom={region.zoom}
                style={{ height: '100%', width: '100%', borderRadius: '8px', background: '#0a0e1a' }}
              >
                {/* Dark map tiles */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                
                {/* Region circle */}
                <Circle
                  center={region.center as [number, number]}
                  radius={region.radius}
                  pathOptions={{ 
                    color: '#00d8ff', 
                    fillColor: '#00d8ff', 
                    fillOpacity: 0.15,
                    weight: 2
                  }}
                />

                {/* Aircraft markers */}
                {aircraftInRegion.map(ac => {
                  const lat = typeof ac.position.lat === 'number' ? ac.position.lat : parseFloat(ac.position.lat)
                  const lon = typeof ac.position.lon === 'number' ? ac.position.lon : parseFloat(ac.position.lon)
                  
                  if (isNaN(lat) || isNaN(lon)) return null
                  
                  const callsign = ac.flight || ac.tail || ac.hex || 'UNKNOWN'
                  const altitude = ac.position?.altitude || 'N/A'
                  const speed = ac.ground_speed || 'N/A'
                  const heading = ac.heading || 'N/A'
                  
                  // Determine marker styling
                  const sourceId = ac.source?.station_id || 'tar1090'
                  const isMilitary = (ac as any).military
                  const isTacamo = highlightTACAMO && isTACAMO(ac)
                  const isNightwatchAc = highlightNightwatch && isNightwatch(ac)
                  
                  let markerClasses = 'aircraft-marker'
                  if (isTacamo) {
                    markerClasses += ' aircraft-marker-tacamo'
                  } else if (isNightwatchAc) {
                    markerClasses += ' aircraft-marker-nightwatch'
                  } else if (isMilitary) {
                    markerClasses += ' aircraft-marker-military'
                  } else {
                    markerClasses += ` aircraft-marker-${sourceId}`
                  }
                  
                  return (
                    <Marker 
                      key={ac.hex || ac.id} 
                      position={[lat, lon]}
                      icon={L.divIcon({
                        className: markerClasses,
                        html: `
                          <div class="aircraft-marker-content">
                            <div class="aircraft-icon">✈</div>
                            <div class="aircraft-callsign">${callsign}</div>
                            <div class="aircraft-alt">${altitude}ft</div>
                            <div class="aircraft-speed">${speed}kts</div>
                          </div>
                        `,
                        iconSize: [80, 40],
                        iconAnchor: [40, 20],
                        popupAnchor: [0, -20]
                      })}
                    >
                      <Popup>
                        <div className="text-xs font-mono space-y-1 bg-spacex-darker text-white p-3 rounded-lg border border-spacex-gray">
                          <div className="font-bold text-spacex-accent text-sm">
                            {callsign}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-400">Squawk:</span>
                              <span className="ml-1 text-white">{ac.squawk || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Speed:</span>
                              <span className="ml-1 text-white">{speed}kts</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Altitude:</span>
                              <span className="ml-1 text-white">{altitude}ft</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Heading:</span>
                              <span className="ml-1 text-white">{heading}°</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Phase:</span>
                              <span className="ml-1 text-white">{ac.flight_phase || 'UNKNOWN'}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Type:</span>
                              <span className="ml-1 text-white">{ac.aircraft_type || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Calculate distance between two points (Haversine formula)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

