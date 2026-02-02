import { useMessageStore } from '../store/messageStore'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Plane, MapPin, CloudRain, Radio, AlertCircle, Crosshair } from 'lucide-react'
import Link from 'next/link'

export default function LiveFeed() {
  const messages = useMessageStore((state) => state.messages)

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'oooi':
        return <Plane className="w-4 h-4" />
      case 'position':
        return <MapPin className="w-4 h-4" />
      case 'weather':
        return <CloudRain className="w-4 h-4" />
      case 'cpdlc':
      case 'atc_request':
        return <Radio className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'oooi':
        return 'text-spacex-green border-spacex-green'
      case 'position':
        return 'text-spacex-blue-light border-spacex-blue-light'
      case 'weather':
        return 'text-blue-400 border-blue-400'
      case 'cpdlc':
      case 'atc_request':
        return 'text-spacex-accent border-spacex-accent'
      case 'performance':
        return 'text-yellow-400 border-yellow-400'
      default:
        return 'text-gray-400 border-gray-400'
    }
  }

  return (
    <div className="data-card rounded-lg p-6 h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-spacex-accent font-mono flex items-center">
          <Radio className="w-5 h-5 mr-2 animate-pulse" />
          LIVE ACARS FEED
        </h2>
        <div className="text-sm font-mono text-gray-400">
          {messages.length} MESSAGES
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 will-change-scroll">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
            <p className="font-mono">AWAITING TRANSMISSION...</p>
          </div>
        ) : (
          messages.slice(0, 200).map((message, index) => {
            const aircraftId = message.flight || message.tail || message.hex || message.id;
            const trackingUrl = message.hex 
              ? `/track?hex=${message.hex}` 
              : `/track?flight=${encodeURIComponent(message.flight || message.tail || aircraftId)}`;
            
            return (
              <div
                key={message.id || index}
                className="bg-spacex-darker/50 border border-spacex-gray hover:border-spacex-accent/50 rounded p-3 transition-all hover:shadow-lg hover:shadow-spacex-accent/10 animate-fade-in relative"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2 flex-1">
                    <div className={`${getCategoryColor(message.category)}`}>
                      {getCategoryIcon(message.category)}
                    </div>
                    <div className="font-mono text-sm">
                      {message.flight && (
                        <span className="text-spacex-accent font-bold">{message.flight}</span>
                      )}
                      {message.tail && (
                        <span className="text-gray-400 ml-2">{message.tail}</span>
                      )}
                      {message.airline && (
                        <span className="text-spacex-blue-light ml-2">[{message.airline}]</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-xs text-gray-500 font-mono">
                      {message.timestamp ? formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }) : 'now'}
                    </div>
                    {(message.flight || message.tail || message.hex) && (
                      <Link href={trackingUrl}>
                        <button 
                          className="p-1 bg-green-500/20 hover:bg-green-500/40 border border-green-500/50 hover:border-green-400 rounded transition-all group/track"
                          title="Track Aircraft"
                        >
                          <Crosshair className="w-3 h-3 text-green-400 group-hover/track:text-green-300" />
                        </button>
                      </Link>
                    )}
                  </div>
                </div>

              {/* Message content */}
              {message.text && (
                <div className="font-mono text-sm text-gray-300 bg-black/30 p-2 rounded border-l-2 border-spacex-accent/30">
                  {message.text}
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center space-x-4 mt-2 text-xs font-mono">
                {message.category && (
                  <span className={`${getCategoryColor(message.category)} uppercase`}>
                    {message.category}
                  </span>
                )}
                {message.flight_phase && (
                  <span className="text-yellow-400">
                    {message.flight_phase}
                  </span>
                )}
                {message.label && (
                  <span className="text-gray-500">
                    LABEL: {message.label}
                  </span>
                )}
                {message.validation && (
                  <span className={message.validation.valid ? 'text-spacex-green' : 'text-spacex-red'}>
                    {message.validation.valid ? '✓ VALID' : '✗ INVALID'}
                  </span>
                )}
              </div>

              {/* OOOI details */}
              {message.oooi && (
                <div className="mt-2 text-sm font-mono text-spacex-green bg-spacex-green/10 p-2 rounded">
                  ✈ {message.oooi.event} @ {message.oooi.time}
                </div>
              )}

              {/* Position details */}
              {message.position && (
                <div className="mt-2 text-sm font-mono text-spacex-blue-light bg-spacex-blue/10 p-2 rounded">
                  📍 {message.position.coordinates} FL{message.position.altitude}
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  )
}

