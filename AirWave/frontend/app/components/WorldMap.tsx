'use client'

import { useEffect, useState, useRef } from 'react'
import { Globe, Plane } from 'lucide-react'
import { useMessageStore } from '../store/messageStore'
import dynamic from 'next/dynamic'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false })

// Import Leaflet Icon class
let Icon: any = null
if (typeof window !== 'undefined') {
  import('leaflet').then(L => {
    Icon = L.Icon
  })
}

// Import Leaflet CSS only on client side
if (typeof window !== 'undefined') {
  import('leaflet/dist/leaflet.css')
  
  // Fix for default marker icons in Next.js
  import('leaflet').then(L => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    })
  })
}

interface AircraftPosition {
  flight: string
  lat: number
  lon: number
  altitude?: string
  timestamp: string
  airline?: string
  tail?: string
  text?: string
}

function parseCoordinates(coordString: string): { lat: number; lon: number } | null {
  try {
    // Format: N3745W12230 or similar
    const match = coordString.match(/([NS])(\d{2})(\d{2,3})([EW])(\d{2,3})(\d{2,3})?/)
    if (!match) return null

    const latDir = match[1]
    const latDeg = parseInt(match[2])
    const latMin = parseInt(match[3].slice(0, 2))
    
    const lonDir = match[4]
    const lonDeg = parseInt(match[5])
    const lonMin = match[6] ? parseInt(match[6].slice(0, 2)) : 0

    let lat = latDeg + latMin / 60
    if (latDir === 'S') lat = -lat

    let lon = lonDeg + lonMin / 60
    if (lonDir === 'W') lon = -lon

    return { lat, lon }
  } catch (error) {
    return null
  }
}

// Create a dynamic MapUpdater component to avoid SSR issues
const MapUpdater = dynamic(() => 
  import('react-leaflet').then(mod => {
    const { useMap } = mod
    return function MapUpdaterComponent({ center }: { center: [number, number] }) {
      const map = useMap()
      useEffect(() => {
        if (center && map && !map._leaflet_id) {
          try {
            map.setView(center, map.getZoom())
          } catch (error) {
            // Ignore errors if map is being destroyed
            console.warn('Map update error:', error)
          }
        }
      }, [center, map])
      
      useEffect(() => {
        return () => {
          // Cleanup function to prevent memory leaks
          if (map && map._leaflet_id) {
            try {
              map.off()
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      }, [map])
      
      return null
    }
  }), 
  { ssr: false }
)

export default function WorldMap() {
  const messages = useMessageStore((state) => state.messages)
  const [aircraftPositions, setAircraftPositions] = useState<AircraftPosition[]>([])
  const [allAircraft, setAllAircraft] = useState<any[]>([])
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0])
  const [mounted, setMounted] = useState(false)
  const mapRef = useRef<any>(null)
  
  // Filter states
  const [showHFGCS, setShowHFGCS] = useState(true)
  const [showCommercial, setShowCommercial] = useState(true)
  const [showGeneralAviation, setShowGeneralAviation] = useState(false)
  const [minAltitude, setMinAltitude] = useState(0)
  const [maxAircraftDisplay, setMaxAircraftDisplay] = useState(500)

  useEffect(() => {
    setMounted(true)
    
    // Cleanup function to prevent memory leaks
    return () => {
      setMounted(false)
    }
  }, [])

  // Fetch aircraft positions from API (includes HFGCS, ADS-B, etc.)
  useEffect(() => {
    const fetchAircraftPositions = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/messages/aircraft/positions`)
        const data = await response.json()
        
        if (data.positions && data.positions.length > 0) {
          setAllAircraft(data.positions)
        }
      } catch (error) {
        console.error('Error fetching aircraft positions:', error)
      }
    }

    // Initial fetch
    fetchAircraftPositions()
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchAircraftPositions, 5000)
    
    return () => clearInterval(interval)
  }, [])

  // Apply filters to aircraft
  useEffect(() => {
    let filtered = [...allAircraft]
    
    // Category filters
    filtered = filtered.filter(aircraft => {
      if (aircraft.category === 'hfgcs' || aircraft.hfgcs_classification) {
        return showHFGCS
      }
      if (aircraft.aircraft_type && /^(A|B|C|E)\d{3}/.test(aircraft.aircraft_type)) {
        // Commercial jets (A320, B737, etc.)
        return showCommercial
      }
      // General aviation
      return showGeneralAviation
    })
    
    // Altitude filter
    if (minAltitude > 0) {
      filtered = filtered.filter(aircraft => {
        const alt = parseFloat(aircraft.position?.altitude) || 0
        return alt >= minAltitude
      })
    }
    
    // Limit display for performance
    filtered = filtered.slice(0, maxAircraftDisplay)
    
    // Convert to position format
    const positions: AircraftPosition[] = filtered.map((aircraft: any) => ({
      flight: aircraft.flight || aircraft.tail || aircraft.id,
      lat: aircraft.position.lat,
      lon: aircraft.position.lon,
      altitude: aircraft.position.altitude?.toString() || 'N/A',
      timestamp: aircraft.timestamp,
      airline: aircraft.airline || aircraft.aircraft_type,
      tail: aircraft.tail,
      text: `${aircraft.aircraft_type || 'Aircraft'} - ${aircraft.category || 'Unknown'}`
    }))
    
    setAircraftPositions(positions)
    
    // Center map on first aircraft if available
    if (positions.length > 0 && positions[0] && allAircraft.length > 0) {
      setMapCenter([positions[0].lat, positions[0].lon])
    }
  }, [allAircraft, showHFGCS, showCommercial, showGeneralAviation, minAltitude, maxAircraftDisplay])

  // Also extract positions from ACARS messages for backwards compatibility
  useEffect(() => {
    // Extract aircraft positions from messages
    const positions: AircraftPosition[] = []
    const seenFlights = new Set<string>()

    messages.forEach((msg) => {
      if (msg.position && msg.flight && !seenFlights.has(msg.flight)) {
        const coords = parseCoordinates(msg.position.coordinates)
        if (coords) {
          positions.push({
            flight: msg.flight,
            lat: coords.lat,
            lon: coords.lon,
            altitude: msg.position.altitude,
            timestamp: msg.timestamp,
            airline: msg.airline,
            tail: msg.tail,
            text: msg.text,
          })
          seenFlights.add(msg.flight)
        }
      }
    })

    // Merge with existing positions from API (avoid duplicates)
    setAircraftPositions(prev => {
      const merged = [...prev]
      positions.forEach(pos => {
        if (!merged.find(p => p.flight === pos.flight)) {
          merged.push(pos)
        }
      })
      return merged
    })
  }, [messages])

  if (!mounted) {
    return (
      <div className="data-card rounded-lg p-6">
        <h2 className="text-xl font-bold text-spacex-accent font-mono mb-4 flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          GLOBAL COVERAGE
        </h2>
        <div className="relative h-96 bg-spacex-darker/30 rounded border border-spacex-gray/30 flex items-center justify-center">
          <div className="text-center">
            <Globe className="w-16 h-16 text-spacex-accent/30 mx-auto mb-4 animate-pulse-slow" />
            <p className="text-gray-500 font-mono text-sm">Loading map...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="data-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-spacex-accent font-mono flex items-center">
          <Globe className="w-5 h-5 mr-2 animate-pulse" />
          GLOBAL COVERAGE
        </h2>
        <div className="text-sm font-mono text-gray-400">
          {aircraftPositions.length} / {allAircraft.length} AIRCRAFT
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mb-4 p-3 bg-spacex-darker/50 rounded border border-spacex-gray/30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Category Filters */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="filter-hfgcs"
              checked={showHFGCS}
              onChange={(e) => setShowHFGCS(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-spacex-darker text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="filter-hfgcs" className="text-xs font-mono text-gray-300 cursor-pointer">
              🛡️ HFGCS Military
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="filter-commercial"
              checked={showCommercial}
              onChange={(e) => setShowCommercial(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-spacex-darker text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="filter-commercial" className="text-xs font-mono text-gray-300 cursor-pointer">
              ✈️ Commercial
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="filter-ga"
              checked={showGeneralAviation}
              onChange={(e) => setShowGeneralAviation(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-spacex-darker text-green-500 focus:ring-green-500"
            />
            <label htmlFor="filter-ga" className="text-xs font-mono text-gray-300 cursor-pointer">
              🛩️ General Aviation
            </label>
          </div>
          
          {/* Max Display Limit */}
          <div className="flex items-center space-x-2">
            <label className="text-xs font-mono text-gray-400">Limit:</label>
            <select
              value={maxAircraftDisplay}
              onChange={(e) => setMaxAircraftDisplay(parseInt(e.target.value))}
              className="text-xs font-mono bg-spacex-darker border border-spacex-gray text-white rounded px-2 py-1"
            >
              <option value="100">100</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
              <option value="5000">5000</option>
              <option value="99999">All</option>
            </select>
          </div>
        </div>
        
        {/* Altitude Filter */}
        <div className="mt-3 flex items-center space-x-3">
          <label className="text-xs font-mono text-gray-400">Min Altitude:</label>
          <input
            type="range"
            min="0"
            max="50000"
            step="1000"
            value={minAltitude}
            onChange={(e) => setMinAltitude(parseInt(e.target.value))}
            className="flex-1 h-1 bg-spacex-gray rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs font-mono text-gray-300 w-20">{minAltitude.toLocaleString()}ft</span>
        </div>
      </div>

      <div className="relative h-96 rounded border border-spacex-accent/30 overflow-hidden">
        <MapContainer
          key="world-map-container"
          center={mapCenter}
          zoom={4}
          style={{ height: '100%', width: '100%', background: '#000' }}
          className="z-0"
          whenCreated={(mapInstance) => {
            // Store map instance to prevent re-initialization
            if (mapInstance && !mapRef.current) {
              mapRef.current = mapInstance
              mapInstance._leaflet_id = 'world-map'
            }
          }}
        >
          {/* Dark tile layer for SpaceX theme */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <MapUpdater center={mapCenter} />

          {/* Aircraft markers */}
          {aircraftPositions.map((aircraft) => (
            <Marker
              key={aircraft.flight}
              position={[aircraft.lat, aircraft.lon]}
              icon={Icon ? new Icon({
                iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
                    <circle cx="16" cy="16" r="12" fill="#00d8ff" opacity="0.3"/>
                    <circle cx="16" cy="16" r="4" fill="#00ff41"/>
                    <path d="M16 4 L16 28 M4 16 L28 16" stroke="#00d8ff" stroke-width="1.5" opacity="0.5"/>
                    <path d="M16 8 L20 12 L16 28 L12 12 Z" fill="#00ff41" stroke="#00d8ff" stroke-width="1"/>
                  </svg>
                `),
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16],
              }) : undefined}
            >
              <Popup>
                <div className="font-mono text-xs bg-spacex-darker text-white p-2 rounded">
                  <div className="font-bold text-spacex-accent text-sm mb-1">
                    {aircraft.flight}
                  </div>
                  {aircraft.airline && (
                    <div className="text-gray-400">[{aircraft.airline}] {aircraft.tail}</div>
                  )}
                  {aircraft.altitude && (
                    <div className="text-spacex-green mt-1">
                      FL{aircraft.altitude}
                    </div>
                  )}
                  <div className="text-gray-500 text-[10px] mt-1">
                    {aircraft.lat.toFixed(4)}°, {aircraft.lon.toFixed(4)}°
                  </div>
                  {aircraft.text && (
                    <div className="text-gray-300 mt-1 border-t border-gray-700 pt-1">
                      {aircraft.text}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Draw flight paths if multiple positions */}
          {aircraftPositions.length > 1 && (
            <Polyline
              positions={aircraftPositions.map((a) => [a.lat, a.lon] as [number, number])}
              pathOptions={{
                color: '#00d8ff',
                weight: 2,
                opacity: 0.3,
                dashArray: '5, 10',
              }}
            />
          )}
        </MapContainer>

        {aircraftPositions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-spacex-darker/80 z-10 pointer-events-none">
            <div className="text-center">
              <Plane className="w-12 h-12 text-gray-500 mx-auto mb-2 opacity-50" />
              <p className="text-gray-500 font-mono text-sm">
                Awaiting position reports...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-spacex-green rounded-full mr-2"></div>
            <span className="text-gray-400">Aircraft Position</span>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-0.5 bg-spacex-accent opacity-30 mr-2" style={{ borderTop: '2px dashed' }}></div>
            <span className="text-gray-400">Flight Path</span>
          </div>
        </div>
        <div className="text-gray-500">
          Click markers for details
        </div>
      </div>
    </div>
  )
}
