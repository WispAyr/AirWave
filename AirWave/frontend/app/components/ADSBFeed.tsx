import Link from 'next/link'
import { Satellite, Plane, Navigation, Crosshair } from 'lucide-react'
import { ACARSMessage } from '../store/messageStore'

interface ADSBFeedProps {
  messages: ACARSMessage[]
}

export default function ADSBFeed({ messages }: ADSBFeedProps) {
  // Filter only ADS-B messages and deduplicate by tail/flight
  const adsbMessages = messages.filter(m => m.source_type === 'adsb')
  
  // Get unique aircraft (latest message per aircraft)
  const uniqueAircraft = new Map<string, ACARSMessage>()
  adsbMessages.forEach(msg => {
    const key = msg.flight || msg.tail || msg.hex || msg.id
    const existing = uniqueAircraft.get(key)
    if (!existing || new Date(msg.timestamp) > new Date(existing.timestamp)) {
      uniqueAircraft.set(key, msg)
    }
  })
  
  const displayMessages = Array.from(uniqueAircraft.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50)

  const getPhaseColor = (phase?: string) => {
    switch (phase) {
      case 'TAXI': return 'text-gray-400'
      case 'TAKEOFF': return 'text-yellow-400'
      case 'CLIMB': return 'text-green-400'
      case 'CRUISE': return 'text-blue-400'
      case 'ENROUTE': return 'text-cyan-400'
      case 'DESCENT': return 'text-orange-400'
      case 'APPROACH': return 'text-red-400'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className="data-card rounded-lg p-4 h-[600px] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Satellite className="w-6 h-6 text-purple-400" />
          <span>ADS-B FEED</span>
        </h2>
        <div className="text-sm text-gray-400 font-mono">
          {displayMessages.length} aircraft
        </div>
      </div>

      {displayMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Satellite className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm">Waiting for ADS-B aircraft...</p>
            <p className="font-mono text-xs mt-2">Start TAR1090 feed in Admin panel</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {displayMessages.map((message) => {
            const aircraftId = message.flight || message.tail || message.hex || message.id
            if (!aircraftId) return null
            
            const trackingUrl = message.hex 
              ? `/track?hex=${message.hex}` 
              : `/track?flight=${encodeURIComponent(message.flight || message.tail || aircraftId)}`;
            
            return (
              <div key={message.id} className="relative">
                <Link 
                  href={`/aircraft/${encodeURIComponent(aircraftId)}`}
                >
                  <div className="bg-spacex-darker border border-purple-500/30 rounded p-3 hover:border-purple-400 transition-all cursor-pointer group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <Plane className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-bold font-mono text-sm">
                              {message.flight?.trim() || message.tail || 'UNKNOWN'}
                            </span>
                            {message.squawk && (
                              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">
                                SQ:{message.squawk}
                              </span>
                            )}
                          </div>
                    
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs font-mono">
                      {message.position?.altitude && (
                        <div className="text-gray-400">
                          ALT: <span className="text-white">{message.position.altitude}ft</span>
                        </div>
                      )}
                      {message.ground_speed !== undefined && (
                        <div className="text-gray-400">
                          SPD: <span className="text-white">{message.ground_speed}kts</span>
                        </div>
                      )}
                      {message.heading !== undefined && (
                        <div className="text-gray-400 flex items-center">
                          <Navigation className="w-3 h-3 mr-1" style={{ transform: `rotate(${message.heading}deg)` }} />
                          <span className="text-white">{message.heading}°</span>
                        </div>
                      )}
                      {message.vertical_rate !== undefined && message.vertical_rate !== 0 && (
                        <div className="text-gray-400">
                          V/S: <span className={message.vertical_rate > 0 ? 'text-green-400' : 'text-orange-400'}>
                            {message.vertical_rate > 0 ? '+' : ''}{message.vertical_rate}fpm
                          </span>
                        </div>
                      )}
                    </div>

                    {message.position?.lat && message.position?.lon && (
                      <div className="mt-1 text-xs font-mono text-gray-500">
                        {message.position.lat.toFixed(4)}, {message.position.lon.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>

                      <div className="text-right ml-3">
                        {message.flight_phase && (
                          <span className={`text-xs font-bold font-mono ${getPhaseColor(message.flight_phase)}`}>
                            {message.flight_phase}
                          </span>
                        )}
                        {message.aircraft_type && (
                          <div className="text-xs text-gray-500 font-mono mt-1">
                            {message.aircraft_type}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                
                {/* Track Button */}
                <Link 
                  href={trackingUrl}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 right-2 z-10"
                >
                  <button 
                    className="p-1.5 bg-green-500/20 hover:bg-green-500/40 border border-green-500/50 hover:border-green-400 rounded transition-all group/track"
                    title="Track Aircraft"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-green-400 group-hover/track:text-green-300" />
                  </button>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

