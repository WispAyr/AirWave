import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Radio, Plane, MapPin, Clock } from 'lucide-react'
import { ACARSMessage } from '../store/messageStore'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

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

interface HFGCSAircraftTrackerProps {
  messages: ACARSMessage[]
  className?: string
}

interface HFGCSAircraft {
  id: string
  aircraft_type: string
  hex: string
  callsign: string
  tail: string
  first_detected: number
  last_seen: number
  message_count: number
  last_position?: {
    lat: number
    lon: number
    altitude: number
    timestamp: number
  }
  detection_method: string
}

export default function HFGCSAircraftTracker({ messages, className = '' }: HFGCSAircraftTrackerProps) {
  const [hfgcsAircraft, setHfgcsAircraft] = useState<HFGCSAircraft[]>([])
  const [loadedPhotos, setLoadedPhotos] = useState<Set<string>>(new Set())
  const [showingRecent, setShowingRecent] = useState(false)
  
  // Fetch HFGCS aircraft from API
  useEffect(() => {
    const fetchHFGCSAircraft = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/hfgcs/aircraft`)
        const data = await response.json()
        if (data.success) {
          // Show active aircraft if available, otherwise show recent from database
          const hasActive = data.active && data.active.length > 0
          const aircraftToShow = hasActive ? data.active : (data.recent || [])
          setHfgcsAircraft(aircraftToShow)
          setShowingRecent(!hasActive && aircraftToShow.length > 0)
        }
      } catch (error) {
        console.error('Error fetching HFGCS aircraft:', error)
      }
    }
    
    // Initial fetch
    fetchHFGCSAircraft()
    
    // Poll every 5 seconds
    const interval = setInterval(fetchHFGCSAircraft, 5000)
    
    return () => clearInterval(interval)
  }, [])
  
  const displayAircraft = hfgcsAircraft
  
  const handlePhotoLoad = (aircraftId: string) => {
    setLoadedPhotos(prev => new Set(prev).add(aircraftId))
  }
  
  const handlePhotoError = (aircraftId: string) => {
    setLoadedPhotos(prev => {
      const newSet = new Set(prev)
      newSet.delete(aircraftId)
      return newSet
    })
  }

  const getAircraftColor = (type?: string) => {
    if (type === 'E-6B') return 'border-blue-500/40 hover:border-blue-400'
    if (type === 'E-4B') return 'border-orange-500/40 hover:border-orange-400'
    return 'border-gray-500/40 hover:border-gray-400'
  }

  const getAircraftBadgeColor = (type?: string) => {
    if (type === 'E-6B') return 'bg-blue-500/20 text-blue-300 border-blue-400/50'
    if (type === 'E-4B') return 'bg-orange-500/20 text-orange-300 border-orange-400/50'
    return 'bg-gray-500/20 text-gray-300 border-gray-400/50'
  }

  const getDetectionBadgeColor = (method?: string) => {
    switch (method) {
      case 'hex': return 'bg-purple-500/20 text-purple-300'
      case 'callsign': return 'bg-green-500/20 text-green-300'
      case 'tail': return 'bg-yellow-500/20 text-yellow-300'
      case 'type': return 'bg-cyan-500/20 text-cyan-300'
      default: return 'bg-gray-500/20 text-gray-300'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return date.toLocaleTimeString()
  }

  return (
    <div className={`data-card rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Radio className="w-6 h-6 text-orange-400" />
          <span>HFGCS AIRCRAFT TRACKING</span>
        </h2>
        <div className="text-sm text-gray-400 font-mono flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${showingRecent ? 'bg-yellow-400' : 'bg-orange-400 animate-pulse'}`}></div>
          <span>{displayAircraft.length} {showingRecent ? 'recent' : 'active'}</span>
        </div>
      </div>

      {displayAircraft.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center text-gray-500">
            <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm">No HFGCS aircraft currently tracked</p>
            <p className="font-mono text-xs mt-2 text-gray-600">
              Monitoring for E-6B Mercury & E-4B Nightwatch
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayAircraft.map((aircraft) => {
            const aircraftId = aircraft.callsign || aircraft.tail || aircraft.hex || aircraft.id
            if (!aircraftId) return null
            
            const aircraftType = aircraft.aircraft_type
            const detectionMethod = aircraft.detection_method
            
            return (
              <Link 
                href={`/aircraft/${encodeURIComponent(aircraftId)}`} 
                key={aircraft.id}
              >
                <div className={`bg-spacex-darker border rounded-lg p-4 transition-all cursor-pointer group ${getAircraftColor(aircraftType)}`}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Left: Aircraft Info */}
                    <div className="md:col-span-2">
                      <div className="flex items-start space-x-3 mb-3">
                        <Plane className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-white font-bold font-mono text-base">
                              {aircraft.callsign?.trim() || aircraft.tail || aircraft.hex || 'UNKNOWN'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded border font-bold ${getAircraftBadgeColor(aircraftType)}`}>
                              {aircraftType}
                            </span>
                            {detectionMethod && (
                              <span className={`text-xs px-2 py-0.5 rounded font-mono uppercase ${getDetectionBadgeColor(detectionMethod)}`}>
                                {detectionMethod}
                              </span>
                            )}
                          </div>
                          
                          {aircraft.tail && aircraft.tail !== aircraft.callsign && (
                            <div className="text-xs text-gray-400 font-mono mt-1">
                              Tail: {aircraft.tail}
                            </div>
                          )}
                          
                          {aircraft.hex && (
                            <div className="text-xs text-gray-500 font-mono mt-0.5">
                              Hex: {aircraft.hex}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
                        {(aircraft.last_position?.altitude || (aircraft as any).last_altitude) && (
                          <div className="flex items-center space-x-1 text-gray-400">
                            <span>ALT:</span>
                            <span className="text-white font-semibold">
                              {Math.round(aircraft.last_position?.altitude || (aircraft as any).last_altitude || 0)}ft
                            </span>
                          </div>
                        )}
                        
                        {((aircraft.last_position?.lat && aircraft.last_position?.lon) || 
                          ((aircraft as any).last_position_lat && (aircraft as any).last_position_lon)) && (
                          <div className="flex items-center space-x-1 text-gray-400">
                            <MapPin className="w-3 h-3" />
                            <span className="text-gray-500 text-xs">
                              {(aircraft.last_position?.lat || (aircraft as any).last_position_lat)?.toFixed(2)}, {(aircraft.last_position?.lon || (aircraft as any).last_position_lon)?.toFixed(2)}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-1 text-gray-400">
                          <span>MSG:</span>
                          <span className="text-white font-semibold">{aircraft.message_count || (aircraft as any).total_messages || 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex items-center space-x-1 text-xs text-gray-500 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(new Date(aircraft.last_seen).toISOString())}</span>
                        </div>
                        
                        <span className={`text-xs font-mono ${showingRecent ? 'text-yellow-400' : 'text-green-400'}`}>
                          {showingRecent ? 'RECENT' : 'ACTIVE'}
                        </span>
                      </div>
                    </div>

                    {/* Center: Aircraft Photo */}
                    <div className="md:col-span-1">
                      <div className="h-32 rounded border border-gray-700 overflow-hidden bg-gray-900 relative flex items-center justify-center">
                        {(aircraft.tail || aircraft.hex) ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/aircraft/${aircraft.tail || aircraft.hex}/photo?cache=${aircraft.last_seen}`}
                              alt={aircraft.tail || aircraft.callsign || 'Aircraft'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = 'none';
                                const parent = img.parentElement;
                                if (parent) {
                                  const placeholder = parent.querySelector('.photo-placeholder') as HTMLElement;
                                  if (placeholder) placeholder.style.display = 'flex';
                                }
                              }}
                            />
                            <div className="photo-placeholder hidden flex-col items-center justify-center text-gray-600">
                              <Plane className="w-8 h-8 mb-2" />
                              <span className="text-xs font-mono">{aircraft.aircraft_type}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-600">
                            <Plane className="w-8 h-8 mb-2" />
                            <span className="text-xs font-mono">{aircraft.aircraft_type}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Mini Map */}
                    {(() => {
                      const lat = aircraft.last_position?.lat || (aircraft as any).last_position_lat;
                      const lon = aircraft.last_position?.lon || (aircraft as any).last_position_lon;
                      const alt = aircraft.last_position?.altitude || (aircraft as any).last_altitude;
                      
                      return lat && lon && typeof window !== 'undefined' ? (
                        <div className="md:col-span-1">
                          <div className="h-32 rounded border border-orange-500/30 overflow-hidden bg-black">
                            <MapContainer
                              center={[lat, lon]}
                              zoom={6}
                              style={{ height: '100%', width: '100%', background: '#000' }}
                              zoomControl={false}
                              dragging={false}
                              scrollWheelZoom={false}
                              doubleClickZoom={false}
                              touchZoom={false}
                            >
                              <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                              />
                              <Marker position={[lat, lon]}>
                                <Popup>
                                  <div className="text-xs font-mono bg-gray-900 text-white p-2 rounded">
                                    <div className="font-bold text-orange-400">{aircraft.callsign || aircraft.tail}</div>
                                    <div className="text-gray-300">{aircraft.aircraft_type}</div>
                                    {alt && <div className="text-cyan-400">ALT: {Math.round(alt)}ft</div>}
                                  </div>
                                </Popup>
                              </Marker>
                            </MapContainer>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

