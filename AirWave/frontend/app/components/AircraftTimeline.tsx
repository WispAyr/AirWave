'use client'

import { useMemo, useRef, useEffect } from 'react'
import { Plane, MapPin, Radio, FileText, Activity } from 'lucide-react'
import { ACARSMessage } from '../store/messageStore'
import { format } from 'date-fns'

interface AircraftTimelineProps {
  messages: ACARSMessage[]
  currentPosition?: any
  className?: string
}

export default function AircraftTimeline({ messages, currentPosition, className = '' }: AircraftTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastEventRef = useRef<HTMLDivElement>(null)
  
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }, [messages])

  // Auto-scroll to latest event on mount and when messages update
  useEffect(() => {
    if (lastEventRef.current && scrollContainerRef.current) {
      lastEventRef.current.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' })
    }
  }, [sortedMessages])

  const getEventIcon = (message: ACARSMessage) => {
    if (message.oooi?.event) return Plane
    if (message.position) return MapPin
    if (message.category === 'cpdlc') return Radio
    return FileText
  }

  const getEventColor = (message: ACARSMessage) => {
    if (message.oooi?.event) return 'text-green-400 border-green-400/30'
    if (message.position) return 'text-cyan-400 border-cyan-400/30'
    if (message.category === 'cpdlc') return 'text-blue-400 border-blue-400/30'
    return 'text-gray-400 border-gray-400/30'
  }

  const getEventTitle = (message: ACARSMessage) => {
    if (message.oooi?.event) return `OOOI: ${message.oooi.event}`
    if (message.position) return 'Position Report'
    if (message.category === 'cpdlc') return 'CPDLC Message'
    if (message.category) return message.category.toUpperCase()
    return 'Message'
  }

  const getEventDetails = (message: ACARSMessage) => {
    const details: string[] = []
    
    if (message.position?.altitude) {
      details.push(`ALT: ${message.position.altitude}ft`)
    }
    if (message.ground_speed !== undefined) {
      details.push(`SPD: ${message.ground_speed}kts`)
    }
    if (message.heading !== undefined) {
      details.push(`HDG: ${message.heading}°`)
    }
    if (message.text) {
      details.push(message.text)
    }
    
    return details
  }

  if (sortedMessages.length === 0) {
    return (
      <div className={`data-card rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-bold text-spacex-accent font-mono mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          FLIGHT TIMELINE
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm">No events recorded</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`data-card rounded-lg p-6 ${className}`}>
      <h3 className="text-lg font-bold text-spacex-accent font-mono mb-4 flex items-center">
        <Activity className="w-5 h-5 mr-2" />
        FLIGHT TIMELINE
      </h3>
      
      {/* Horizontal scrolling container */}
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden pb-6"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="relative pt-8 pb-12 min-w-max">
          {/* Horizontal timeline line */}
          <div className="absolute left-0 right-0 top-2 h-0.5 bg-spacex-gray/30"></div>
          
          {/* Time axis labels */}
          <div className="absolute left-0 right-0 bottom-0 flex items-center text-[10px] text-gray-500 font-mono">
            {sortedMessages.length > 0 && (
              <>
                <div className="absolute left-0">
                  {format(new Date(sortedMessages[0].timestamp), 'HH:mm')}
                </div>
                <div className="absolute right-0">
                  {format(new Date(sortedMessages[sortedMessages.length - 1].timestamp), 'HH:mm')}
                </div>
              </>
            )}
          </div>
          
          {/* Events laid out horizontally */}
          <div className="flex items-start space-x-6 px-2">
            {sortedMessages.map((message, idx) => {
              const Icon = getEventIcon(message)
              const colorClass = getEventColor(message)
              const title = getEventTitle(message)
              const details = getEventDetails(message)
              const isLast = idx === sortedMessages.length - 1
              
              return (
                <div 
                  key={message.id} 
                  ref={isLast ? lastEventRef : null}
                  className="relative flex-shrink-0 w-64 group"
                >
                  {/* Timeline dot */}
                  <div className={`absolute left-1/2 -translate-x-1/2 -top-6 w-4 h-4 rounded-full border-2 ${colorClass} bg-spacex-dark flex items-center justify-center z-10`}>
                    <div className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0].replace('text', 'bg')}`}></div>
                  </div>
                  
                  {/* Connector line to previous event (if not first) */}
                  {idx > 0 && (
                    <div className="absolute left-0 -top-4 w-6 h-0.5 bg-cyan-400/50"></div>
                  )}
                  
                  {/* Event card */}
                  <div className={`mt-4 border ${colorClass.split(' ')[1]} rounded-lg p-3 bg-spacex-darker/50 hover:bg-spacex-darker transition-all`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
                        <span className={`font-bold font-mono text-xs ${colorClass.split(' ')[0]} truncate`}>
                          {title}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-gray-500 font-mono mb-2">
                      {format(new Date(message.timestamp), 'HH:mm:ss')}
                    </div>
                    
                    {details.length > 0 && (
                      <div className="space-y-1">
                        {details.slice(0, 3).map((detail, i) => (
                          <div key={i} className="text-[10px] font-mono text-gray-400 truncate">
                            {detail}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {message.flight_phase && (
                      <div className="mt-2 pt-2 border-t border-spacex-gray/20">
                        <span className="text-[10px] text-yellow-400 font-mono">
                          {message.flight_phase}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

