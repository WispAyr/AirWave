'use client'

import { useEffect, useRef, useState } from 'react'
import { useAudioStore } from '../store/audioStore'
import { fetchAndParsePlaylist } from '../utils/playlistParser'
import { 
  Radio, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Heart, 
  HeartOff, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react'

export default function ATCAudioPlayer() {
  const {
    feeds,
    selectedFeed,
    isPlaying,
    isLoading,
    volume,
    streamUrl,
    favoriteFeeds,
    error,
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
    setIsLoading
  } = useAudioStore()

  const audioRef = useRef<HTMLAudioElement>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcriptions, setTranscriptions] = useState<Array<{text: string, timestamp: string}>>([])
  const [whisperAvailable, setWhisperAvailable] = useState(false)
  const [useVOX, setUseVOX] = useState(true) // Default to VOX mode

  // Load feeds and preferences on mount
  useEffect(() => {
    loadFeeds().then(() => loadPreferences())
    
    // Check Whisper server status
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/transcription/status`)
      .then(res => res.json())
      .then(data => setWhisperAvailable(data.available))
      .catch(() => setWhisperAvailable(false))
  }, [])

  // Parse playlist when feed is selected
  useEffect(() => {
    if (selectedFeed && !streamUrl) {
      setIsLoading(true)
      setError(null)
      
      fetchAndParsePlaylist(selectedFeed.mount)
        .then((url) => {
          setStreamUrl(url)
          setIsLoading(false)
        })
        .catch((err) => {
          setError(err.message)
          setIsLoading(false)
        })
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

  // Group feeds by region
  const feedsByRegion = feeds.reduce((acc, feed) => {
    if (!acc[feed.region]) {
      acc[feed.region] = []
    }
    acc[feed.region].push(feed)
    return acc
  }, {} as Record<string, typeof feeds>)

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

  const handleFeedSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const feedId = e.target.value
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

  // Toggle transcription (continuous mode)
  const handleToggleTranscription = async () => {
    if (!selectedFeed) return
    
    try {
      const endpoint = transcribing ? 'stop' : 'start'
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/transcription/${endpoint}/${selectedFeed.id}`,
        { method: 'POST' }
      )
      
      if (response.ok) {
        setTranscribing(!transcribing)
        if (!transcribing) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/transcriptions/${selectedFeed.id}?limit=10`)
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

  // Toggle VOX recording (recommended mode)
  const handleToggleRecording = async () => {
    if (!selectedFeed) return
    
    try {
      const endpoint = recording ? 'stop' : 'start'
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/recording/${endpoint}/${selectedFeed.id}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
      )
      
      if (response.ok) {
        setRecording(!recording)
      }
    } catch (error) {
      console.error('Recording toggle error:', error)
    }
  }

  // Listen for real-time transcriptions via WebSocket (continuous mode)
  useEffect(() => {
    const handleTranscription = (event: CustomEvent) => {
      const data = event.detail
      if (data.feedId === selectedFeed?.id) {
        console.log('📝 Transcription received:', data.text)
        setTranscriptions(prev => [
          { text: data.text, timestamp: data.timestamp },
          ...prev
        ].slice(0, 20))
      }
    }
    
    window.addEventListener('atc_transcription', handleTranscription as EventListener)
    return () => window.removeEventListener('atc_transcription', handleTranscription as EventListener)
  }, [selectedFeed?.id])

  // Listen for VOX recordings
  useEffect(() => {
    const handleRecording = (event: CustomEvent) => {
      const data = event.detail
      const baseFeedId = selectedFeed?.id
      // Match base feedId or with _L/_R suffix for stereo
      if (data.feedId === baseFeedId || 
          data.feedId === `${baseFeedId}_L` || 
          data.feedId === `${baseFeedId}_R`) {
        console.log('🎙️ Recording saved:', data.text)
        setTranscriptions(prev => [
          { text: `[${data.feedId.split('_').pop()}] ${data.text}`, timestamp: data.timestamp },
          ...prev
        ].slice(0, 20))
      }
    }
    
    window.addEventListener('atc_recording', handleRecording as EventListener)
    return () => window.removeEventListener('atc_recording', handleRecording as EventListener)
  }, [selectedFeed?.id])

  // Stop transcription/recording when feed changes
  useEffect(() => {
    if (transcribing) {
      setTranscribing(false)
      setTranscriptions([])
    }
    if (recording) {
      setRecording(false)
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

  return (
    <div className="data-card rounded-lg p-4">
      <audio ref={audioRef} preload="none" />
      
      <h3 className="text-sm font-bold text-spacex-accent font-mono mb-4 flex items-center justify-between">
        <span className="flex items-center">
          <Radio className="w-4 h-4 mr-2" />
          LIVE ATC AUDIO
        </span>
        <span className={`text-xs ${status.color} flex items-center`}>
          {isPlaying && (
            <span className="w-2 h-2 bg-spacex-green rounded-full mr-2 animate-pulse" />
          )}
          {status.text}
        </span>
      </h3>

      {/* Feed Selector */}
      <div className="mb-3">
        <select
          value={selectedFeed?.id || ''}
          onChange={handleFeedSelect}
          className="w-full bg-spacex-darker border border-spacex-gray/50 text-white rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-spacex-accent/50 transition-colors"
        >
          <option value="">SELECT FEED...</option>
          {Object.entries(feedsByRegion).map(([region, regionFeeds]) => (
            <optgroup key={region} label={region}>
              {regionFeeds.map((feed) => (
                <option key={feed.id} value={feed.id}>
                  {feed.icao} - {feed.name} ({feed.frequency})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Current Feed Display */}
      {selectedFeed && (
        <div className="bg-spacex-darker/50 border border-spacex-gray/50 rounded p-3 mb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-mono text-xs text-gray-400 mb-1">{selectedFeed.airport}</div>
              <div className="font-mono text-sm text-spacex-accent font-bold">
                {selectedFeed.icao} {selectedFeed.type.toUpperCase()}
              </div>
              <div className="font-mono text-xs text-blue-400 mt-1">
                {selectedFeed.frequency} MHz
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
              : 'bg-spacex-green hover:bg-spacex-green/80'
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
                PLAY
              </>
            )}
          </span>
        </button>

        {/* Volume Control */}
        <div className="flex items-center space-x-2">
          {volume === 0 ? (
            <VolumeX className="w-4 h-4 text-gray-500" />
          ) : (
            <Volume2 className="w-4 h-4 text-spacex-accent" />
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

      {/* Transcription/Recording Controls */}
      {whisperAvailable && selectedFeed && (
        <div className="mt-3 border-t border-spacex-gray/30 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-gray-400">
              {useVOX ? 'VOX RECORDING' : 'TRANSCRIPTION'}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setUseVOX(!useVOX)}
                className="px-2 py-1 bg-spacex-gray/50 hover:bg-spacex-gray rounded text-[10px] font-mono transition-all"
                title={useVOX ? 'Switch to continuous mode' : 'Switch to VOX mode'}
              >
                {useVOX ? 'VOX' : 'CONT'}
              </button>
              <button
                onClick={useVOX ? handleToggleRecording : handleToggleTranscription}
                disabled={!isPlaying}
                className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                  (useVOX ? recording : transcribing)
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                } ${!isPlaying ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {(useVOX ? recording : transcribing) ? '⏹ STOP' : '🎤 START'}
              </button>
            </div>
          </div>

          {/* VOX mode info */}
          {useVOX && !recording && (
            <div className="text-[10px] text-gray-600 font-mono mb-2">
              VOX mode: Auto-detects speech, saves clips for review
            </div>
          )}

          {/* Transcription Feed */}
          {transcriptions.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1 mt-2">
              {transcriptions.map((t, idx) => (
                <div
                  key={idx}
                  className="text-xs bg-black/30 border border-green-500/20 rounded p-2"
                >
                  <div className="text-green-400 font-mono">{t.text}</div>
                  <div className="text-gray-600 text-[10px] mt-1">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(transcribing || recording) && transcriptions.length === 0 && (
            <div className="text-xs text-gray-500 font-mono mt-2 text-center py-2">
              {recording ? '🎙️ Recording when speech detected...' : 'Listening...'}
            </div>
          )}

          {/* Link to recordings page */}
          {useVOX && (
            <div className="mt-2 text-center">
              <a
                href="/recordings"
                className="text-xs text-spacex-accent hover:text-spacex-accent/80 underline font-mono"
              >
                View All Recordings →
              </a>
            </div>
          )}
        </div>
      )}

      {/* About Section */}
      <div className="mt-4 border-t border-spacex-gray/30 pt-3">
        <button
          onClick={() => setShowAbout(!showAbout)}
          className="flex items-center justify-between w-full text-xs text-gray-500 hover:text-gray-400 transition-colors font-mono"
        >
          <span className="flex items-center">
            <Info className="w-3 h-3 mr-1" />
            About{whisperAvailable && ' & Transcription'}
          </span>
          {showAbout ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
        
        {showAbout && (
          <div className="mt-2 text-xs text-gray-500 space-y-2">
            <p>
              Live air traffic control audio streams provided by{' '}
              <a
                href="https://www.liveatc.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-spacex-accent underline hover:text-spacex-accent/80"
              >
                LiveATC.net
              </a>
            </p>
            {whisperAvailable && (
              <p>
                Real-time transcription powered by{' '}
                <a
                  href="https://github.com/ggml-org/whisper.cpp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-spacex-accent underline hover:text-spacex-accent/80"
                >
                  whisper.cpp
                </a>
                {' '}(local AI model)
              </p>
            )}
            <p className="text-gray-600 text-[10px]">
              For educational and monitoring purposes only. Third-party use of
              LiveATC streams is subject to LiveATC&apos;s terms of service.
              Recording or redistribution is prohibited.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #00ff41;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #00ff41;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  )
}

