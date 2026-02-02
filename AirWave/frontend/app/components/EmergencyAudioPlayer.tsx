'use client'

import { useEffect, useRef, useState } from 'react'
import { useEmergencyAudioStore } from '../store/emergencyAudioStore'
import { 
  Radio, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Heart, 
  HeartOff, 
  AlertCircle,
  Shield,
  Flame,
  Activity,
  Star
} from 'lucide-react'

export default function EmergencyAudioPlayer() {
  const {
    feeds,
    selectedFeed,
    isPlaying,
    isLoading,
    volume,
    streamUrl,
    favoriteFeeds,
    error,
    filterState,
    filterCounty,
    filterType,
    loadFeeds,
    selectFeed,
    play,
    pause,
    setVolume,
    setStreamUrl,
    toggleFavorite,
    loadPreferences,
    savePreferences,
    setError,
    setIsLoading,
    setFilterState,
    setFilterCounty,
    setFilterType,
    getFilteredFeeds,
    getStates,
    getCountiesByState
  } = useEmergencyAudioStore()

  const audioRef = useRef<HTMLAudioElement>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [transcriptions, setTranscriptions] = useState<Array<{text: string, timestamp: string, feedId?: string}>>([])
  const [whisperAvailable, setWhisperAvailable] = useState(false)

  // Load feeds and preferences on mount
  useEffect(() => {
    loadFeeds().then(() => loadPreferences())
    
    // Check Whisper server status
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/transcription/status`)
      .then(res => res.json())
      .then(data => setWhisperAvailable(data.available))
      .catch(() => setWhisperAvailable(false))
  }, [])

  // Set stream URL when feed is selected
  useEffect(() => {
    if (selectedFeed && !streamUrl) {
      const url = selectedFeed.streamUrl || `https://broadcastify.cdnstream1.com/${selectedFeed.feedId}`
      setStreamUrl(url)
    }
  }, [selectedFeed?.id])

  // Handle audio element events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => play()
    const handlePause = () => pause()
    const handleError = () => {
      setError('Failed to load audio stream')
      pause()
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('error', handleError)
    }
  }, [])

  // Sync audio element with state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (streamUrl) {
      audio.src = streamUrl
      audio.volume = volume
    }
  }, [streamUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return

    if (isPlaying) {
      audio.play().catch(() => {
        setError('Failed to play audio stream')
        pause()
      })
    } else {
      audio.pause()
    }
  }, [isPlaying])

  const filteredFeeds = getFilteredFeeds()
  const states = getStates()
  const counties = filterState ? getCountiesByState(filterState) : []

  const handlePlayPause = () => {
    if (!selectedFeed) {
      setError('Please select a feed first')
      return
    }
    
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
  }

  const handleFeedSelect = (feedId: string) => {
    if (feedId === '') {
      selectFeed(null)
      return
    }
    
    const feed = feeds.find(f => f.id === feedId)
    if (feed) {
      selectFeed(feed)
      savePreferences()
    }
  }

  const handleToggleFavorite = () => {
    if (selectedFeed) {
      toggleFavorite(selectedFeed.id)
    }
  }

  const isFavorite = selectedFeed ? favoriteFeeds.includes(selectedFeed.id) : false

  // Toggle transcription
  const handleToggleTranscription = async () => {
    if (!selectedFeed) return
    
    try {
      const endpoint = transcribing ? 'stop' : 'start'
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/emergency/transcription/${endpoint}/${selectedFeed.id}`,
        { method: 'POST' }
      )
      
      if (response.ok) {
        setTranscribing(!transcribing)
        if (!transcribing) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/emergency/transcriptions/${selectedFeed.id}?limit=10`)
            .then(res => res.json())
            .then(data => {
              if (data.transcriptions) {
                setTranscriptions(data.transcriptions.map((t: any) => ({
                  text: t.text,
                  timestamp: t.timestamp
                })))
              }
            })
        }
      }
    } catch (error) {
      console.error('Transcription toggle error:', error)
    }
  }

  // Listen for real-time transcriptions via WebSocket
  useEffect(() => {
    const handleTranscription = (event: CustomEvent) => {
      const data = event.detail
      if (data.feedId === selectedFeed?.id) {
        console.log('📝 Emergency transcription received:', data.text)
        setTranscriptions(prev => [
          { text: data.text, timestamp: data.timestamp },
          ...prev
        ].slice(0, 20))
      }
    }
    
    window.addEventListener('emergency_transcription', handleTranscription as EventListener)
    return () => window.removeEventListener('emergency_transcription', handleTranscription as EventListener)
  }, [selectedFeed?.id])

  // Stop transcription when feed changes
  useEffect(() => {
    if (transcribing) {
      setTranscribing(false)
      setTranscriptions([])
    }
  }, [selectedFeed?.id])

  // Status indicator
  const getStatus = () => {
    if (error) return { text: 'ERROR', color: 'text-red-500' }
    if (isLoading) return { text: 'CONNECTING...', color: 'text-yellow-400' }
    if (isPlaying) return { text: 'LIVE', color: 'text-spacex-green' }
    if (selectedFeed) return { text: 'READY', color: 'text-blue-400' }
    return { text: 'STANDBY', color: 'text-gray-500' }
  }

  const status = getStatus()

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'police': return <Shield className="w-4 h-4 text-blue-400" />
      case 'fire': return <Flame className="w-4 h-4 text-red-400" />
      case 'ems': return <Activity className="w-4 h-4 text-green-400" />
      case 'multi': return <Star className="w-4 h-4 text-orange-400" />
      default: return <Radio className="w-4 h-4 text-gray-400" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'police': return 'border-blue-400/30 bg-blue-900/10'
      case 'fire': return 'border-red-400/30 bg-red-900/10'
      case 'ems': return 'border-green-400/30 bg-green-900/10'
      case 'multi': return 'border-orange-400/30 bg-orange-900/10'
      default: return 'border-spacex-gray/50'
    }
  }

  // Highlight urgent keywords
  const highlightUrgent = (text: string) => {
    const urgentWords = ['emergency', 'officer down', 'shots fired', 'code red', 'urgent', '10-33', 'assist']
    const lowerText = text.toLowerCase()
    const hasUrgent = urgentWords.some(word => lowerText.includes(word))
    return hasUrgent ? 'text-red-400 font-bold' : 'text-green-400'
  }

  return (
    <div className="data-card rounded-lg p-4">
      <audio ref={audioRef} preload="none" />
      
      <h3 className="text-sm font-bold text-red-400 font-mono mb-4 flex items-center justify-between">
        <span className="flex items-center">
          <Radio className="w-4 h-4 mr-2" />
          EMERGENCY SCANNER
        </span>
        <span className={`text-xs ${status.color} flex items-center`}>
          {isPlaying && (
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse" />
          )}
          {status.text}
        </span>
      </h3>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <select
          value={filterState || ''}
          onChange={(e) => setFilterState(e.target.value || null)}
          className="w-full bg-spacex-darker border border-spacex-gray/50 text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-400/50 transition-colors"
        >
          <option value="">ALL STATES</option>
          {states.map((state) => (
            <option key={state.stateCode} value={state.stateCode}>
              {state.stateCode} ({state.count})
            </option>
          ))}
        </select>

        <select
          value={filterCounty || ''}
          onChange={(e) => setFilterCounty(e.target.value || null)}
          disabled={!filterState}
          className="w-full bg-spacex-darker border border-spacex-gray/50 text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-400/50 transition-colors disabled:opacity-50"
        >
          <option value="">ALL COUNTIES</option>
          {counties.map((county) => (
            <option key={county.county} value={county.county}>
              {county.county} ({county.count})
            </option>
          ))}
        </select>

        <select
          value={filterType || ''}
          onChange={(e) => setFilterType(e.target.value || null)}
          className="w-full bg-spacex-darker border border-spacex-gray/50 text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-400/50 transition-colors"
        >
          <option value="">ALL TYPES</option>
          <option value="police">🔵 POLICE</option>
          <option value="fire">🔴 FIRE</option>
          <option value="ems">🟢 EMS</option>
          <option value="multi">🟠 MULTI</option>
        </select>
      </div>

      {/* Feed List */}
      <div className="mb-3 max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
        {filteredFeeds.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4">
            No feeds match your filters
          </div>
        ) : (
          filteredFeeds.map((feed) => (
            <button
              key={feed.id}
              onClick={() => handleFeedSelect(feed.id)}
              className={`w-full text-left px-3 py-2 rounded border transition-all ${
                selectedFeed?.id === feed.id
                  ? `${getTypeColor(feed.type)} border-opacity-100`
                  : 'border-spacex-gray/30 bg-spacex-darker/30 hover:border-spacex-gray/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(feed.type)}
                  <div>
                    <div className="text-xs font-mono text-white font-bold">{feed.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {feed.county}, {feed.stateCode} • {feed.type.toUpperCase()}
                    </div>
                  </div>
                </div>
                {favoriteFeeds.includes(feed.id) && (
                  <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Current Feed Display */}
      {selectedFeed && (
        <div className={`border rounded p-3 mb-3 ${getTypeColor(selectedFeed.type)}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                {getTypeIcon(selectedFeed.type)}
                <div className="font-mono text-sm text-white font-bold">
                  {selectedFeed.name}
                </div>
              </div>
              <div className="font-mono text-xs text-gray-400">{selectedFeed.description}</div>
              <div className="font-mono text-xs text-gray-500 mt-1">
                {selectedFeed.county}, {selectedFeed.state}
              </div>
            </div>
            <button
              onClick={handleToggleFavorite}
              className="p-1 hover:bg-spacex-gray/30 rounded transition-colors"
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? (
                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              ) : (
                <HeartOff className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={!selectedFeed || isLoading}
          className={`w-full py-2 rounded font-mono text-sm font-bold transition-all ${
            isPlaying
              ? 'bg-spacex-red hover:bg-spacex-red/80'
              : 'bg-red-500 hover:bg-red-600'
          } ${
            !selectedFeed || isLoading
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-lg'
          }`}
        >
          <span className="flex items-center justify-center">
            {isLoading ? (
              'CONNECTING...'
            ) : isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                STOP
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                LISTEN
              </>
            )}
          </span>
        </button>

        {/* Volume Control */}
        <div className="flex items-center space-x-2">
          {volume === 0 ? (
            <VolumeX className="w-4 h-4 text-gray-500" />
          ) : (
            <Volume2 className="w-4 h-4 text-red-400" />
          )}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 bg-spacex-gray rounded-lg appearance-none cursor-pointer slider"
          />
          <span className="text-xs font-mono text-gray-400 w-10 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-3 bg-red-900/20 border border-red-500/50 rounded p-2 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-red-400 font-mono">{error}</p>
            {selectedFeed && (
              <button
                onClick={() => {
                  setError(null)
                  setStreamUrl(null)
                  selectFeed(selectedFeed)
                }}
                className="text-xs text-red-300 underline mt-1 hover:text-red-200"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transcription Controls */}
      {whisperAvailable && selectedFeed && (
        <div className="mt-3 border-t border-spacex-gray/30 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-gray-400">TRANSCRIPTION</span>
            <button
              onClick={handleToggleTranscription}
              disabled={!isPlaying}
              className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                transcribing
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              } ${!isPlaying ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {transcribing ? '⏹ STOP' : '🎤 START'}
            </button>
          </div>

          {/* Transcription Feed */}
          {transcriptions.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1 mt-2 custom-scrollbar">
              {transcriptions.map((t, idx) => (
                <div
                  key={idx}
                  className="text-xs bg-black/30 border border-green-500/20 rounded p-2"
                >
                  <div className={`font-mono ${highlightUrgent(t.text)}`}>{t.text}</div>
                  <div className="text-gray-600 text-[10px] mt-1">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {transcribing && transcriptions.length === 0 && (
            <div className="text-xs text-gray-500 font-mono mt-2 text-center py-2">
              Listening...
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ef4444;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ef4444;
          cursor: pointer;
          border: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(239, 68, 68, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 68, 68, 0.7);
        }
      `}</style>
    </div>
  )
}


