'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useConflictStore } from '../store/conflictStore'
import { AircraftConflict } from '../types'
import { format } from 'date-fns'

export default function ConflictAlerts() {
  const activeConflicts = useConflictStore((state) => state.activeConflicts)
  const resolveConflict = useConflictStore((state) => state.resolveConflict)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [audioPlayed, setAudioPlayed] = useState<Set<string>>(new Set())

  // Play audio alert for critical conflicts
  useEffect(() => {
    activeConflicts.forEach(conflict => {
      if (conflict.severity === 'critical' && !audioPlayed.has(conflict.id)) {
        // Play alert sound
        try {
          const audio = new Audio('/alert.mp3')
          audio.volume = 0.5
          audio.play().catch(err => console.log('Audio play failed:', err))
        } catch (error) {
          console.log('Audio not available:', error)
        }
        
        setAudioPlayed(prev => new Set(prev).add(conflict.id))
      }
    })
  }, [activeConflicts, audioPlayed])

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900/20 border-red-500 text-red-400'
      case 'high':
        return 'bg-orange-900/20 border-orange-500 text-orange-400'
      case 'medium':
        return 'bg-yellow-900/20 border-yellow-500 text-yellow-400'
      case 'low':
        return 'bg-green-900/20 border-green-500 text-green-400'
      default:
        return 'bg-gray-900/20 border-gray-500 text-gray-400'
    }
  }

  // Get severity badge color
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'medium':
        return 'bg-yellow-500 text-black'
      case 'low':
        return 'bg-green-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  // Format time to CPA
  const formatTimeToCPA = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`
    }
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  // Sort conflicts by severity and time to CPA
  const sortedConflicts = [...activeConflicts].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const aSeverity = severityOrder[a.severity] || 4
    const bSeverity = severityOrder[b.severity] || 4
    
    if (aSeverity !== bSeverity) {
      return aSeverity - bSeverity
    }
    
    return a.time_to_cpa - b.time_to_cpa
  })

  if (activeConflicts.length === 0) {
    return null
  }

  return (
    <div className="fixed top-20 right-4 z-50 w-96 max-w-full">
      <div className="data-card bg-spacex-darker/95 backdrop-blur-sm border-2 border-red-500/50 rounded-lg shadow-2xl">
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-spacex-dark/50 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
            <h3 className="text-lg font-bold text-red-400 font-mono">
              CONFLICT ALERTS
            </h3>
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-mono rounded">
              {activeConflicts.length}
            </span>
          </div>
          <button className="text-gray-400 hover:text-white">
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>

        {/* Conflicts List */}
        {!isCollapsed && (
          <div className="max-h-96 overflow-y-auto">
            {sortedConflicts.map((conflict) => (
              <div
                key={conflict.id}
                className={`p-4 border-t border-spacex-gray/30 ${getSeverityColor(conflict.severity)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-bold font-mono rounded ${getSeverityBadge(conflict.severity)}`}>
                        {conflict.severity.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        {format(new Date(conflict.detected_at), 'HH:mm:ss')}
                      </span>
                    </div>
                    
                    <div className="text-sm font-mono font-bold mb-2">
                      {conflict.aircraft_1_callsign || conflict.aircraft_1_id}
                      <span className="text-gray-500 mx-2">⟷</span>
                      {conflict.aircraft_2_callsign || conflict.aircraft_2_id}
                    </div>

                    <div className="text-xs font-mono space-y-1">
                      <div>
                        <span className="text-gray-500">Horizontal:</span>{' '}
                        <span className="text-white">{conflict.min_horizontal_distance.toFixed(1)} NM</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Vertical:</span>{' '}
                        <span className="text-white">{conflict.min_vertical_distance.toFixed(0)} ft</span>
                      </div>
                      {conflict.time_to_cpa > 0 && (
                        <div>
                          <span className="text-gray-500">Time to CPA:</span>{' '}
                          <span className="text-white font-bold">{formatTimeToCPA(conflict.time_to_cpa)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => resolveConflict(conflict.id)}
                    className="ml-2 p-1 text-gray-500 hover:text-white hover:bg-spacex-dark rounded transition-colors"
                    title="Acknowledge"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer with clear all button */}
        {!isCollapsed && activeConflicts.length > 0 && (
          <div className="p-3 border-t border-spacex-gray/30 bg-spacex-darker/50">
            <button
              onClick={() => {
                activeConflicts.forEach(c => resolveConflict(c.id))
                setAudioPlayed(new Set())
              }}
              className="w-full px-3 py-2 text-xs font-mono bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-500/30 rounded transition-colors"
            >
              ACKNOWLEDGE ALL
            </button>
          </div>
        )}
      </div>
    </div>
  )
}



