import Link from 'next/link'
import { useMessageStore } from '../store/messageStore'
import { Plane } from 'lucide-react'

export default function FlightTracker() {
  const messages = useMessageStore((state) => state.messages)
  
  // Get unique active flights
  const activeFlights = messages
    .filter((m) => m.flight)
    .reduce((acc, msg) => {
      if (!acc.find((f) => f.flight === msg.flight)) {
        acc.push({
          flight: msg.flight!,
          tail: msg.tail,
          airline: msg.airline,
          phase: msg.flight_phase,
          lastUpdate: msg.timestamp,
        })
      }
      return acc
    }, [] as any[])
    .slice(0, 8)

  return (
    <div className="data-card rounded-lg p-4">
      <h3 className="text-sm font-bold text-spacex-accent font-mono mb-4 flex items-center">
        <Plane className="w-4 h-4 mr-2" />
        ACTIVE FLIGHTS
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {activeFlights.length === 0 ? (
          <p className="text-gray-500 font-mono text-xs text-center py-4">NO ACTIVE FLIGHTS</p>
        ) : (
          activeFlights.map((flight, idx) => (
            <Link href={`/aircraft/${encodeURIComponent(flight.flight)}`} key={idx}>
              <div className="bg-spacex-darker/50 border border-spacex-gray/50 rounded p-2 hover:border-spacex-accent/50 transition-colors cursor-pointer">

              <div className="flex items-center justify-between">
                <div className="font-mono text-sm">
                  <span className="text-spacex-accent font-bold">{flight.flight}</span>
                  {flight.airline && (
                    <span className="text-gray-400 ml-2 text-xs">[{flight.airline}]</span>
                  )}
                </div>
                {flight.phase && (
                  <span className="text-xs text-yellow-400 font-mono">{flight.phase}</span>
                )}
              </div>
              {flight.tail && (
                <div className="text-xs text-gray-500 font-mono mt-1">{flight.tail}</div>
              )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

