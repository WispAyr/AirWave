'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { Icon, LatLngExpression, LatLngBounds } from 'leaflet'
import { MapPin, Maximize2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { format } from 'date-fns'

// Fix for default marker icons in Next.js
import L from 'leaflet'
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface TrackPoint {
  lat: number
  lon: number
  altitude?: string | number
  timestamp: string
  heading?: number
  ground_speed?: number
}

interface AircraftMapProps {
  trackPoints: TrackPoint[]
  currentPosition?: TrackPoint
  aircraftInfo: {
    flight?: string
    tail?: string
    aircraft_type?: string
  }
  className?: string
}

function MapUpdater({ bounds, shouldFit }: { bounds: LatLngBounds | null, shouldFit: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && shouldFit) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [bounds, map, shouldFit])
  return null
}

export default function AircraftMap({ trackPoints, currentPosition, aircraftInfo, className = '' }: AircraftMapProps) {
  const [mounted, setMounted] = useState(false)
  const hasInitialFit = useRef(false)
  const [shouldFit, setShouldFit] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Only fit bounds on initial mount or when manually triggered
  useEffect(() => {
    if (mounted && !hasInitialFit.current && trackPoints.length > 0) {
      hasInitialFit.current = true
      setShouldFit(true)
      // Reset flag after fit
      setTimeout(() => setShouldFit(false), 100)
    }
  }, [mounted, trackPoints.length])

  const { pathCoordinates, bounds, latestPosition } = useMemo(() => {
    const validPoints = trackPoints.filter(p => p.lat && p.lon)
    
    if (validPoints.length === 0 && currentPosition) {
      validPoints.push(currentPosition)
    }
    
    const coords: LatLngExpression[] = validPoints.map(p => [p.lat, p.lon])
    
    let calculatedBounds: LatLngBounds | null = null
    if (coords.length > 0) {
      calculatedBounds = L.latLngBounds(coords)
    }
    
    const latest = currentPosition || (validPoints.length > 0 ? validPoints[validPoints.length - 1] : null)
    
    return {
      pathCoordinates: coords,
      bounds: calculatedBounds,
      latestPosition: latest
    }
  }, [trackPoints, currentPosition])

  const createAircraftIcon = (heading: number = 0) => {
    return new Icon({
      iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
          <g transform="rotate(${heading} 16 16)">
            <circle cx="16" cy="16" r="10" fill="#00d8ff" opacity="0.2"/>
            <path d="M16 6 L20 12 L16 28 L12 12 Z" fill="#00ff41" stroke="#00d8ff" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="3" fill="#00ff41"/>
          </g>
        </svg>
      `),
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    })
  }

  if (!mounted) {
    return (
      <div className={`data-card rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-bold text-spacex-accent font-mono mb-4 flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          FLIGHT PATH
        </h3>
        <div className="h-96 bg-spacex-darker/30 rounded border border-spacex-gray/30 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-spacex-accent/30 mx-auto mb-3 animate-pulse" />
            <p className="text-gray-500 font-mono text-sm">Loading map...</p>
          </div>
        </div>
      </div>
    )
  }

  if (pathCoordinates.length === 0) {
    return (
      <div className={`data-card rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-bold text-spacex-accent font-mono mb-4 flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          FLIGHT PATH
        </h3>
        <div className="h-96 bg-spacex-darker/30 rounded border border-spacex-gray/30 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-30" />
            <p className="text-gray-500 font-mono text-sm">No position data available</p>
          </div>
        </div>
      </div>
    )
  }

  const mapCenter: LatLngExpression = latestPosition 
    ? [latestPosition.lat, latestPosition.lon]
    : pathCoordinates[0]

  const handleResetView = () => {
    setShouldFit(true)
    setTimeout(() => setShouldFit(false), 100)
  }

  return (
    <div className={`data-card rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-spacex-accent font-mono flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          FLIGHT PATH
        </h3>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleResetView}
            className="text-xs font-mono text-spacex-accent hover:text-spacex-green transition-colors flex items-center space-x-1 px-2 py-1 border border-spacex-accent/30 rounded hover:border-spacex-green/50"
            title="Reset view to fit all points"
          >
            <Maximize2 className="w-3 h-3" />
            <span>RESET VIEW</span>
          </button>
          <div className="text-sm font-mono text-gray-400">
            {pathCoordinates.length} POINTS
          </div>
        </div>
      </div>

      <div className="relative h-96 rounded border border-spacex-accent/30 overflow-hidden">
        <MapContainer
          center={mapCenter}
          zoom={8}
          style={{ height: '100%', width: '100%', background: '#000' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <MapUpdater bounds={bounds} shouldFit={shouldFit} />

          {/* Flight path polyline */}
          {pathCoordinates.length > 1 && (
            <Polyline
              positions={pathCoordinates}
              pathOptions={{
                color: '#00d8ff',
                weight: 3,
                opacity: 0.6,
              }}
            />
          )}

          {/* Current position marker */}
          {latestPosition && (
            <Marker
              position={[latestPosition.lat, latestPosition.lon]}
              icon={createAircraftIcon(latestPosition.heading || 0)}
            >
              <Popup>
                <div className="font-mono text-xs bg-spacex-darker text-white p-2 rounded">
                  <div className="font-bold text-spacex-accent text-sm mb-2">
                    {aircraftInfo.flight || aircraftInfo.tail || 'Unknown'}
                  </div>
                  {aircraftInfo.aircraft_type && (
                    <div className="text-gray-400 mb-2">{aircraftInfo.aircraft_type}</div>
                  )}
                  {latestPosition.altitude && (
                    <div className="text-spacex-green">
                      ALT: {latestPosition.altitude}ft
                    </div>
                  )}
                  {latestPosition.ground_speed !== undefined && (
                    <div className="text-cyan-400">
                      SPD: {latestPosition.ground_speed}kts
                    </div>
                  )}
                  {latestPosition.heading !== undefined && (
                    <div className="text-blue-400">
                      HDG: {latestPosition.heading}°
                    </div>
                  )}
                  <div className="text-gray-500 text-[10px] mt-2 pt-2 border-t border-gray-700">
                    {latestPosition.lat.toFixed(4)}°, {latestPosition.lon.toFixed(4)}°
                  </div>
                  {latestPosition.timestamp && (
                    <div className="text-gray-500 text-[10px]">
                      {format(new Date(latestPosition.timestamp), 'HH:mm:ss')}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Path markers at significant points */}
          {trackPoints.length > 2 && trackPoints.map((point, idx) => {
            // Show markers at start, end, and every 10th point
            if (idx === 0 || idx === trackPoints.length - 1 || idx % 10 === 0) {
              return (
                <Marker
                  key={idx}
                  position={[point.lat, point.lon]}
                  icon={new Icon({
                    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
                        <circle cx="8" cy="8" r="4" fill="#00d8ff" opacity="0.5"/>
                        <circle cx="8" cy="8" r="2" fill="#00d8ff"/>
                      </svg>
                    `),
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                  })}
                >
                  <Popup>
                    <div className="font-mono text-xs">
                      {point.altitude && <div>ALT: {point.altitude}ft</div>}
                      {point.timestamp && (
                        <div className="text-gray-500 text-[10px]">
                          {format(new Date(point.timestamp), 'HH:mm:ss')}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            }
            return null
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-spacex-green rounded-full mr-1.5"></div>
            <span className="text-gray-400">Current Position</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-0.5 bg-cyan-400 mr-1.5"></div>
            <span className="text-gray-400">Flight Path</span>
          </div>
        </div>
      </div>
    </div>
  )
}

