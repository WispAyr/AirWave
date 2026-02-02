'use client'

import { useEffect, useState, useRef } from 'react'
import useWebSocket from 'react-use-websocket'
import Link from 'next/link'
import { ArrowLeft, Play, Square, Radio, Calendar, Clock, Settings, Volume2, Wifi, RefreshCw } from 'lucide-react'
import { useMessageStore } from '../store/messageStore'
import HFGCSAircraftTracker from '../components/HFGCSAircraftTracker'
import HFGCSStatistics from '../components/HFGCSStatistics'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5773/ws'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'

interface Recording {
  segment_id: string
  feed_id: string
  start_time: string
  duration: number
  filename: string
  filesize: number
  transcribed: boolean
  transcription_text: string | null
  transcribed_at: string | null
}

interface EAMMessage {
  id: number
  message_type: 'EAM' | 'SKYKING'
  header: string | null
  message_body: string
  message_length: number | null
  confidence_score: number
  repeat_count: number
  first_detected: string
  last_detected: string
  recording_ids: string[]
  raw_transcription: string
  codeword: string | null
  time_code: string | null
  authentication: string | null
}

interface StreamConfig {
  url: string | null
  feedId: string
  autoStart: boolean
}

interface StreamStatus {
  feedId: string
  youtubeUrl: string
  isActive: boolean
  useVOX: boolean
  uptime: number
  retryCount: number
}

interface LiveStream {
  videoId: string
  title: string
  url: string
  thumbnailUrl: string
  concurrentViewers: number
}

export default function HFGCSPage() {
  const [config, setConfig] = useState<StreamConfig | null>(null)
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // EAM state
  const [eamMessages, setEamMessages] = useState<EAMMessage[]>([])
  const [eamStats, setEamStats] = useState<any>(null)
  const [eamFilter, setEamFilter] = useState<'ALL' | 'EAM' | 'SKYKING'>('ALL')
  const [minConfidence, setMinConfidence] = useState(50)
  const [showMultiSegmentOnly, setShowMultiSegmentOnly] = useState(false)
  const [showEAMPanel, setShowEAMPanel] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [volume, setVolume] = useState(0.7)
  const [useVOX, setUseVOX] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'STANDBY' | 'LIVE' | 'ERROR'>('STANDBY')
  const audioRef = useRef<HTMLAudioElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  // YouTube live stream discovery
  const [availableStreams, setAvailableStreams] = useState<LiveStream[]>([])
  const [loadingStreams, setLoadingStreams] = useState(false)
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [lastStreamRefresh, setLastStreamRefresh] = useState<Date | null>(null)
  const [apiConfigured, setApiConfigured] = useState(false)
  
  // HFGCS Aircraft Type Configuration
  const [showConfig, setShowConfig] = useState(false)
  const [hfgcsConfig, setHfgcsConfig] = useState<any>(null)
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set())
  
  // Get messages from store for aircraft tracking
  const messages = useMessageStore(state => state.messages)

  // WebSocket for real-time updates
  const { lastMessage } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  })

  // Handle real-time recording updates
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const data = JSON.parse(lastMessage.data)
        if (data.type === 'atc_recording' && data.data.feedId === config?.feedId) {
          console.log('🎙️ New HFGCS recording:', data.data.text)
          loadRecordings()
          loadStats()
        } else if (data.type === 'youtube_stream_error') {
          console.error('❌ Stream error:', data.data)
          setConnectionStatus('ERROR')
          setIsMonitoring(false)
        } else if (data.type === 'eam_detected') {
          console.log('🚨 New EAM detected:', data.data)
          loadEAMs()
          loadEAMStats()
        } else if (data.type === 'skyking_detected') {
          console.log('🚨 SKYKING detected:', data.data)
          loadEAMs()
          loadEAMStats()
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
  }, [lastMessage, config])

  useEffect(() => {
    loadConfig()
    loadRecordings()
    loadStats()
    loadEAMs()
    loadEAMStats()
    checkStreamStatus()
    loadAvailableStreams()
    
    // Auto-refresh streams every 5 minutes if not monitoring
    const interval = setInterval(() => {
      if (!isMonitoring) {
        loadAvailableStreams()
      }
    }, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/youtube/config`)
      const data = await response.json()
      if (data.success && data.config) {
        setConfig(data.config)
        setYoutubeUrl(data.config.url || '')
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Load HFGCS config on mount
  useEffect(() => {
    loadHFGCSConfig()
  }, [])

  const loadRecordings = async () => {
    if (!config?.feedId) return
    
    try {
      const response = await fetch(`${API_URL}/recordings?feedId=${config.feedId}&limit=50`)
      const data = await response.json()
      setRecordings(data.recordings || [])
    } catch (error) {
      console.error('Error loading recordings:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/recording/stats`)
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }
  
  const loadEAMs = async () => {
    try {
      const params = new URLSearchParams({
        limit: '50',
        minConfidence: minConfidence.toString()
      })
      if (eamFilter !== 'ALL') {
        params.append('type', eamFilter)
      }
      
      const response = await fetch(`${API_URL}/hfgcs/eam?${params}`)
      const data = await response.json()
      if (data.success) {
        setEamMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error loading EAMs:', error)
    }
  }

  const loadEAMStats = async () => {
    try {
      const response = await fetch(`${API_URL}/hfgcs/eam/statistics`)
      const data = await response.json()
      if (data.success) {
        setEamStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading EAM stats:', error)
    }
  }
  
  const loadHFGCSConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/hfgcs/config`)
      const data = await response.json()
      if (data.success) {
        setHfgcsConfig(data.config)
        setEnabledTypes(new Set(data.config.enabled_types))
      }
    } catch (error) {
      console.error('Error loading HFGCS config:', error)
    }
  }
  
  const saveHFGCSConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/hfgcs/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_types: Array.from(enabledTypes) })
      })
      const data = await response.json()
      if (data.success) {
        console.log('✅ HFGCS config saved')
        setShowConfig(false)
      }
    } catch (error) {
      console.error('Error saving HFGCS config:', error)
    }
  }

  const checkStreamStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/youtube/status`)
      const data = await response.json()
      if (data.streams && data.streams.length > 0) {
        const activeStream = data.streams[0]
        setStreamStatus(activeStream)
        setIsMonitoring(true)
        setConnectionStatus('LIVE')
      }
    } catch (error) {
      console.error('Error checking stream status:', error)
    }
  }

  const loadAvailableStreams = async () => {
    setLoadingStreams(true)
    try {
      const response = await fetch(`${API_URL}/youtube/live-streams`)
      const data = await response.json()
      
      if (data.success && data.streams) {
        setAvailableStreams(data.streams)
        setLastStreamRefresh(new Date())
        setApiConfigured(true)
      } else if (data.error && data.error.includes('not configured')) {
        setApiConfigured(false)
        setAvailableStreams([])
      }
    } catch (error) {
      console.error('Error loading available streams:', error)
      setAvailableStreams([])
    } finally {
      setLoadingStreams(false)
    }
  }

  const handleStreamSelect = (streamId: string) => {
    const stream = availableStreams.find(s => s.videoId === streamId)
    if (stream) {
      setSelectedStreamId(streamId)
      setYoutubeUrl(stream.url)
    }
  }

  const handleRefreshStreams = () => {
    loadAvailableStreams()
  }

  const handleToggleManualEntry = () => {
    setShowManualEntry(!showManualEntry)
    if (!showManualEntry) {
      setSelectedStreamId(null)
    }
  }

  const handleSaveConfig = async () => {
    const urlToSave = selectedStreamId 
      ? availableStreams.find(s => s.videoId === selectedStreamId)?.url 
      : youtubeUrl

    if (!urlToSave || !urlToSave.trim()) {
      alert('Please enter or select a YouTube URL')
      return
    }

    try {
      const response = await fetch(`${API_URL}/youtube/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlToSave,
          feedId: config?.feedId || 'hfgcs_youtube',
          autoStart: false
        })
      })

      const data = await response.json()
      if (data.success) {
        await loadConfig()
        setEditMode(false)
      }
    } catch (error) {
      console.error('Error saving config:', error)
      alert('Failed to save configuration')
    }
  }

  const handleStartMonitoring = async () => {
    if (!config?.url) {
      alert('Please configure YouTube URL first')
      setEditMode(true)
      return
    }

    try {
      setConnectionStatus('LIVE')
      const response = await fetch(`${API_URL}/youtube/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: config.url,
          feedId: config.feedId,
          useVOX
        })
      })

      const data = await response.json()
      if (data.success) {
        setIsMonitoring(true)
        console.log('✅ Monitoring started')
        
        // Play the video using YouTube iframe API
        if (iframeRef.current) {
          iframeRef.current.contentWindow?.postMessage(
            '{"event":"command","func":"playVideo","args":""}',
            '*'
          )
        }
      } else {
        setConnectionStatus('ERROR')
        alert('Failed to start monitoring')
      }
    } catch (error) {
      console.error('Error starting monitoring:', error)
      setConnectionStatus('ERROR')
      alert('Failed to start monitoring')
    }
  }

  const handleStopMonitoring = async () => {
    if (!config?.feedId) return

    try {
      const response = await fetch(`${API_URL}/youtube/stop/${config.feedId}`, {
        method: 'POST'
      })

      const data = await response.json()
      if (data.success) {
        setIsMonitoring(false)
        setConnectionStatus('STANDBY')
        setStreamStatus(null)
        console.log('🛑 Monitoring stopped')
        
        // Pause the video using YouTube iframe API
        if (iframeRef.current) {
          iframeRef.current.contentWindow?.postMessage(
            '{"event":"command","func":"pauseVideo","args":""}',
            '*'
          )
        }
      }
    } catch (error) {
      console.error('Error stopping monitoring:', error)
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  const formatUptime = (ms: number) => {
    const minutes = Math.floor(ms / 1000 / 60)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'LIVE': return 'text-green-400'
      case 'ERROR': return 'text-red-400'
      default: return 'text-yellow-400'
    }
  }

  const getStatusBg = () => {
    switch (connectionStatus) {
      case 'LIVE': return 'bg-green-400/10 border-green-400/30'
      case 'ERROR': return 'bg-red-400/10 border-red-400/30'
      default: return 'bg-yellow-400/10 border-yellow-400/30'
    }
  }

  const extractVideoId = (url: string): string => {
    // Extract video ID from YouTube URL
    // Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    return match ? match[1] : ''
  }

  return (
    <main className="min-h-screen bg-spacex-dark grid-background relative">
      <div className="scan-line" />
      <audio ref={audioRef} />
      
      <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link 
              href="/"
              className="flex items-center text-spacex-accent hover:text-spacex-accent/80 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="font-mono text-sm">BACK TO DASHBOARD</span>
            </Link>
            <h1 className="text-3xl font-bold text-spacex-accent font-mono">
              <Radio className="inline w-8 h-8 mr-3" />
              HFGCS LIVESTREAM MONITOR
              <span className={`ml-3 text-xs ${getStatusColor()} animate-pulse`}>
                ● {connectionStatus}
              </span>
            </h1>
            <p className="text-gray-400 font-mono text-sm mt-2">
              High Frequency Global Communications System - Stream Monitoring & Aircraft Tracking
            </p>
          </div>

          {/* Real-time Status */}
          <div className={`data-card p-4 ${getStatusBg()}`}>
            <div className="flex items-center space-x-3">
              <Wifi className={`w-6 h-6 ${getStatusColor()}`} />
              <div>
                <div className="text-xs font-mono text-gray-400">STREAM STATUS</div>
                <div className={`text-xl font-bold ${getStatusColor()}`}>
                  {connectionStatus}
                </div>
                {streamStatus && (
                  <div className="text-xs text-gray-500 mt-1">
                    Uptime: {formatUptime(streamStatus.uptime)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* HFGCS Aircraft Tracking Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <HFGCSAircraftTracker messages={messages} />
          </div>
          <div>
            <HFGCSStatistics />
          </div>
        </div>

        {/* Aircraft Tracking Configuration */}
        <div className="data-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-spacex-accent font-mono flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              AIRCRAFT TRACKING CONFIGURATION
            </h2>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1 bg-spacex-darker border border-spacex-gray rounded text-xs font-mono hover:border-spacex-accent transition-colors"
            >
              {showConfig ? 'HIDE' : 'CONFIGURE'}
            </button>
          </div>

          {showConfig && hfgcsConfig && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 font-mono mb-4">
                Select which U.S. military aircraft types to track and identify in ACARS messages:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hfgcsConfig.aircraft_types.map((aircraft: any) => (
                  <div
                    key={aircraft.id}
                    className={`p-4 rounded border-2 transition-all cursor-pointer ${
                      enabledTypes.has(aircraft.id)
                        ? 'border-spacex-accent bg-spacex-accent/10'
                        : 'border-gray-700 bg-spacex-darker hover:border-gray-600'
                    }`}
                    onClick={() => {
                      const newTypes = new Set(enabledTypes)
                      if (newTypes.has(aircraft.id)) {
                        newTypes.delete(aircraft.id)
                      } else {
                        newTypes.add(aircraft.id)
                      }
                      setEnabledTypes(newTypes)
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-white font-bold font-mono text-sm mb-1">
                          {aircraft.name}
                        </div>
                        <div className="text-xs text-gray-400 mb-2">
                          {aircraft.description}
                        </div>
                        <div className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${
                          aircraft.category === 'Command Post' ? 'bg-orange-500/20 text-orange-300' :
                          aircraft.category === 'Bomber' ? 'bg-red-500/20 text-red-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {aircraft.category}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabledTypes.has(aircraft.id)}
                        onChange={() => {}}
                        className="w-5 h-5 rounded border-gray-600 text-spacex-accent focus:ring-spacex-accent"
                      />
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                      <div className="text-xs text-gray-500 font-mono">
                        Callsigns: {aircraft.callsigns.join(', ')}
                      </div>
                      {aircraft.hex_count > 0 && (
                        <div className="text-xs text-gray-600 font-mono mt-1">
                          {aircraft.hex_count} known hex codes
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-spacex-gray/30">
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2 bg-spacex-darker border border-spacex-gray rounded font-mono text-sm hover:border-gray-600 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={saveHFGCSConfig}
                  className="px-4 py-2 bg-spacex-accent text-black rounded font-mono text-sm font-bold hover:bg-spacex-accent/80 transition-colors"
                >
                  SAVE CONFIGURATION
                </button>
              </div>
            </div>
          )}
          
          {!showConfig && (
            <div className="text-sm text-gray-500 font-mono">
              Currently tracking: {Array.from(enabledTypes).join(', ') || 'None'}
            </div>
          )}
        </div>

        {/* Configuration Card */}
        <div className="data-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-spacex-accent font-mono flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              STREAM CONFIGURATION
            </h2>
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-4 py-2 bg-spacex-blue hover:bg-spacex-blue-light rounded font-mono text-sm transition-colors"
            >
              {editMode ? 'CANCEL' : 'EDIT'}
            </button>
          </div>

          {editMode ? (
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex items-center space-x-2 mb-4">
                <button
                  onClick={handleToggleManualEntry}
                  className={`px-4 py-2 rounded font-mono text-sm transition-colors ${
                    !showManualEntry
                      ? 'bg-spacex-accent text-black'
                      : 'bg-spacex-darker border border-spacex-gray text-white'
                  }`}
                >
                  AUTO-SELECT
                </button>
                <button
                  onClick={handleToggleManualEntry}
                  className={`px-4 py-2 rounded font-mono text-sm transition-colors ${
                    showManualEntry
                      ? 'bg-spacex-accent text-black'
                      : 'bg-spacex-darker border border-spacex-gray text-white'
                  }`}
                >
                  MANUAL ENTRY
                </button>
              </div>

              {!showManualEntry ? (
                /* Auto-Select Mode */
                <div className="space-y-4">
                  {!apiConfigured ? (
                    <div className="bg-yellow-900/20 border border-yellow-600/50 rounded p-4">
                      <p className="text-yellow-400 text-sm font-mono">
                        ⚠️ YouTube API not configured. Configure API key in{' '}
                        <Link href="/admin" className="text-spacex-accent hover:underline">
                          Admin Settings
                        </Link>{' '}
                        for automatic stream discovery.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-mono text-gray-400">
                          Available Live Streams
                        </label>
                        <button
                          onClick={handleRefreshStreams}
                          disabled={loadingStreams}
                          className="flex items-center space-x-1 text-spacex-accent hover:text-spacex-accent/80 text-xs font-mono"
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingStreams ? 'animate-spin' : ''}`} />
                          <span>REFRESH</span>
                        </button>
                      </div>
                      
                      {loadingStreams ? (
                        <div className="bg-spacex-darker/50 border border-spacex-gray/30 rounded p-4 text-center">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-spacex-accent" />
                          <p className="text-gray-400 text-sm font-mono">Loading streams...</p>
                        </div>
                      ) : availableStreams.length === 0 ? (
                        <div className="bg-spacex-darker/50 border border-spacex-gray/30 rounded p-4 text-center">
                          <p className="text-gray-400 text-sm font-mono">No live streams found</p>
                        </div>
                      ) : (
                        <select
                          value={selectedStreamId || ''}
                          onChange={(e) => handleStreamSelect(e.target.value)}
                          className="w-full bg-spacex-darker border border-spacex-gray/50 text-white rounded px-4 py-2 font-mono text-sm focus:outline-none focus:border-spacex-accent/50"
                        >
                          <option value="">Select a live stream...</option>
                          {availableStreams.map((stream) => (
                            <option key={stream.videoId} value={stream.videoId}>
                              {stream.title} ({stream.concurrentViewers} viewers)
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {lastStreamRefresh && (
                        <p className="text-gray-500 text-xs font-mono">
                          Last refreshed: {lastStreamRefresh.toLocaleTimeString()}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* Manual Entry Mode */
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2">
                    YouTube Livestream URL
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-spacex-darker border border-spacex-gray/50 text-white rounded px-4 py-2 font-mono text-sm focus:outline-none focus:border-spacex-accent/50"
                  />
                  {!apiConfigured && (
                    <p className="text-gray-500 text-xs font-mono mt-1">
                      Configure YouTube API in Admin Settings for automatic stream discovery
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">
                  Feed Identifier
                </label>
                <input
                  type="text"
                  value={config?.feedId || 'hfgcs_youtube'}
                  disabled
                  className="w-full bg-spacex-darker/50 border border-spacex-gray/30 text-gray-500 rounded px-4 py-2 font-mono text-sm"
                />
              </div>
              <button
                onClick={handleSaveConfig}
                className="px-6 py-2 bg-spacex-green hover:bg-spacex-green/80 rounded font-mono text-sm transition-colors"
              >
                SAVE CONFIGURATION
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-mono text-gray-400 mb-1">YouTube URL</div>
                <div className="text-sm font-mono text-white break-all bg-black/30 p-2 rounded">
                  {config?.url || 'Not configured'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-mono text-gray-400 mb-1">Feed ID</div>
                  <div className="text-sm font-mono text-spacex-accent">
                    {config?.feedId || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono text-gray-400 mb-1">Status</div>
                  <div className={`text-sm font-mono ${isMonitoring ? 'text-green-400' : 'text-gray-500'}`}>
                    {isMonitoring ? 'ACTIVE' : 'INACTIVE'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Video Player & Control Panel - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Player */}
          {config?.url && (
            <div className="data-card p-4">
              <h2 className="text-lg font-bold text-spacex-accent font-mono mb-3 flex items-center">
                <Radio className="w-5 h-5 mr-2" />
                LIVE VIDEO FEED
              </h2>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  ref={iframeRef}
                  className="absolute top-0 left-0 w-full h-full rounded border border-spacex-gray/50"
                  src={`https://www.youtube.com/embed/${extractVideoId(config.url)}?enablejsapi=1&autoplay=0&mute=1&controls=1`}
                  title="HFGCS Live Stream"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-xs text-gray-500 font-mono mt-2">
                Visual stream synchronized with audio monitoring
              </p>
            </div>
          )}

          {/* Control Panel */}
          <div className="data-card p-6">
            <h2 className="text-lg font-bold text-spacex-accent font-mono mb-4">
              MONITORING CONTROLS
            </h2>

            <div className="space-y-6">
            {/* Start/Stop Control */}
            <div className="space-y-4">
              {!isMonitoring ? (
                <button
                  onClick={handleStartMonitoring}
                  disabled={!config?.url}
                  className="w-full py-4 bg-spacex-green hover:bg-spacex-green/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-mono text-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Play className="w-6 h-6" />
                  <span>START MONITORING</span>
                </button>
              ) : (
                <button
                  onClick={handleStopMonitoring}
                  className="w-full py-4 bg-spacex-red hover:bg-spacex-red/80 rounded font-mono text-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Square className="w-6 h-6" />
                  <span>STOP MONITORING</span>
                </button>
              )}

              {/* VOX Toggle */}
              <div className="flex items-center justify-between bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30">
                <div>
                  <div className="text-sm font-mono text-white">VOX Recording</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Voice-activated recording (recommended)
                  </div>
                </div>
                <button
                  onClick={() => setUseVOX(!useVOX)}
                  disabled={isMonitoring}
                  className={`px-4 py-2 rounded font-mono text-sm transition-colors ${
                    useVOX
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {useVOX ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>

            {/* Volume Control */}
            <div className="space-y-4">
              <div className="bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-spacex-accent" />
                    <span className="text-sm font-mono text-white">Volume</span>
                  </div>
                  <span className="text-sm font-mono text-spacex-accent">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume * 100}
                  onChange={(e) => {
                    const newVolume = parseInt(e.target.value) / 100
                    setVolume(newVolume)
                    if (audioRef.current) {
                      audioRef.current.volume = newVolume
                    }
                  }}
                  className="w-full"
                />
              </div>

              {/* Statistics Preview */}
              {stats && (
                <div className="bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30">
                  <div className="text-xs font-mono text-gray-400 mb-2">QUICK STATS</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-lg font-bold text-spacex-green">
                        {recordings.length}
                      </div>
                      <div className="text-[10px] text-gray-500">Segments</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-400">
                        {recordings.filter(r => r.transcribed).length}
                      </div>
                      <div className="text-[10px] text-gray-500">Transcribed</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* EAM Messages Panel */}
        <div className="data-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-orange-400 font-mono">
              🚨 EMERGENCY ACTION MESSAGES
            </h2>
            <button
              onClick={() => setShowEAMPanel(!showEAMPanel)}
              className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded font-mono text-sm transition-colors text-orange-300"
            >
              {showEAMPanel ? 'HIDE' : 'SHOW'}
            </button>
          </div>

          {showEAMPanel && (
            <>
              {/* EAM Statistics Bar */}
              {eamStats && (
                <>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-spacex-darker/50 p-3 rounded border border-orange-500/30">
                      <div className="text-2xl font-bold text-orange-400">{eamStats.database?.total || 0}</div>
                      <div className="text-xs text-gray-500 font-mono">Total EAMs</div>
                    </div>
                    <div className="bg-spacex-darker/50 p-3 rounded border border-red-500/30">
                      <div className="text-2xl font-bold text-red-400">{eamStats.database?.byType?.SKYKING || 0}</div>
                      <div className="text-xs text-gray-500 font-mono">Skyking</div>
                    </div>
                    <div className="bg-spacex-darker/50 p-3 rounded border border-green-500/30">
                      <div className="text-2xl font-bold text-green-400">{eamStats.database?.averageConfidence || 0}%</div>
                      <div className="text-xs text-gray-500 font-mono">Avg Confidence</div>
                    </div>
                    <div className="bg-spacex-darker/50 p-3 rounded border border-blue-500/30">
                      <div className="text-sm font-mono text-blue-400">
                        {eamStats.database?.mostRecent ? new Date(eamStats.database.mostRecent).toLocaleString() : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">Last Detection</div>
                    </div>
                  </div>
                  
                  {/* Multi-segment statistics */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-spacex-darker/50 p-3 rounded border border-blue-400/30">
                      <div className="text-xl font-bold text-blue-400">
                        {eamMessages.filter(m => m.multi_segment).length}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">Multi-segment</div>
                    </div>
                    <div className="bg-spacex-darker/50 p-3 rounded border border-cyan-400/30">
                      <div className="text-xl font-bold text-cyan-400">
                        {eamMessages.filter(m => m.multi_segment).length > 0 
                          ? (eamMessages.filter(m => m.multi_segment).reduce((sum, m) => sum + (m.segment_count || 0), 0) / eamMessages.filter(m => m.multi_segment).length).toFixed(1)
                          : '0'}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">Avg Segments</div>
                    </div>
                    <div className="bg-spacex-darker/50 p-3 rounded border border-purple-400/30">
                      <div className="text-xl font-bold text-purple-400">
                        {eamMessages.filter(m => m.multi_segment).length > 0 
                          ? Math.max(...eamMessages.filter(m => m.multi_segment).map(m => m.segment_count || 0))
                          : '0'}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">Max Segments</div>
                    </div>
                  </div>
                </>
              )}

              {/* Filter Controls */}
              <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-spacex-gray/30">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-gray-400">FILTER:</span>
                  <button
                    onClick={() => setEamFilter('ALL')}
                    className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
                      eamFilter === 'ALL' ? 'bg-spacex-blue text-white' : 'bg-spacex-darker text-gray-400 hover:bg-spacex-gray/30'
                    }`}
                  >
                    ALL
                  </button>
                  <button
                    onClick={() => { setEamFilter('EAM'); loadEAMs(); }}
                    className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
                      eamFilter === 'EAM' ? 'bg-orange-500 text-white' : 'bg-spacex-darker text-gray-400 hover:bg-spacex-gray/30'
                    }`}
                  >
                    EAM
                  </button>
                  <button
                    onClick={() => { setEamFilter('SKYKING'); loadEAMs(); }}
                    className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
                      eamFilter === 'SKYKING' ? 'bg-red-500 text-white' : 'bg-spacex-darker text-gray-400 hover:bg-spacex-gray/30'
                    }`}
                  >
                    SKYKING
                  </button>
                </div>

                <div className="flex items-center space-x-2 flex-1">
                  <span className="text-xs font-mono text-gray-400">MIN CONFIDENCE:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                    onMouseUp={() => loadEAMs()}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono text-gray-400 w-10">{minConfidence}%</span>
                </div>
                
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showMultiSegmentOnly}
                    onChange={(e) => {
                      setShowMultiSegmentOnly(e.target.checked)
                      loadEAMs()
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 font-mono text-xs">Multi-segment only</span>
                </label>
              </div>

              {/* EAM Message List */}
              {eamMessages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 font-mono text-sm">
                    No EAM messages detected yet. Messages will appear here when detected.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {eamMessages
                    .filter(m => !showMultiSegmentOnly || m.multi_segment)
                    .map((eam) => (
                    <div
                      key={eam.id}
                      className={`eam-message-card ${
                        eam.confidence_score > 75 ? 'high-confidence' : 
                        eam.confidence_score > 50 ? 'medium-confidence' : 'low-confidence'
                      } ${
                        new Date().getTime() - new Date(eam.first_detected).getTime() < 5 * 60 * 1000 ? 'recent' : ''
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className={`eam-badge type-${eam.message_type.toLowerCase()}`}>
                            {eam.message_type}
                          </span>
                          {eam.repeat_count > 1 && (
                            <span className="repeat-badge">
                              ×{eam.repeat_count} REPEATS
                            </span>
                          )}
                          {new Date().getTime() - new Date(eam.first_detected).getTime() < 5 * 60 * 1000 && (
                            <span className="px-2 py-1 bg-orange-500/30 text-orange-300 text-xs font-bold rounded">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {new Date(eam.first_detected).toLocaleString()}
                        </div>
                      </div>

                      {/* Confidence Score */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400 font-mono">CONFIDENCE</span>
                          <span className="font-bold font-mono">{eam.confidence_score}%</span>
                        </div>
                        <div className="confidence-bar">
                          <div 
                            className={`confidence-fill ${
                              eam.confidence_score > 75 ? 'high' : 
                              eam.confidence_score > 50 ? 'medium' : 'low'
                            }`}
                            style={{ width: `${eam.confidence_score}%` }}
                          />
                        </div>
                      </div>

                      {/* Message Header/Codeword */}
                      {eam.message_type === 'EAM' && eam.header && (
                        <div className="mb-3">
                          <div className="text-xs text-gray-400 font-mono mb-1">HEADER</div>
                          <div className="eam-header">{eam.header}</div>
                        </div>
                      )}

                      {eam.message_type === 'SKYKING' && eam.codeword && (
                        <div className="mb-3">
                          <div className="text-xs text-gray-400 font-mono mb-1">CODEWORD</div>
                          <div className="text-2xl font-bold text-red-400 font-mono tracking-widest">
                            {eam.codeword}
                          </div>
                          {eam.time_code && (
                            <div className="mt-2 text-sm">
                              <span className="text-gray-400">TIME:</span> <span className="text-blue-400 font-mono">{eam.time_code}</span>
                            </div>
                          )}
                          {eam.authentication && (
                            <div className="mt-1 text-sm">
                              <span className="text-gray-400">AUTH:</span> <span className="text-green-400 font-mono">{eam.authentication}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Body */}
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 font-mono mb-1">MESSAGE BODY</div>
                        <div className="eam-message-body">
                          {eam.message_body.match(/.{1,5}/g)?.map((group, i) => (
                            <span key={i} className="eam-character-group">{group}</span>
                          ))}
                        </div>
                      </div>

                      {/* Expandable Details */}
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-400 hover:text-gray-300 font-mono">
                          Show Details
                        </summary>
                        <div className="mt-3 space-y-2">
                          <div>
                            <span className="text-gray-500">Recording IDs:</span>
                            <div className="mt-1 text-gray-400 font-mono text-xs">
                              {eam.recording_ids.join(', ')}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Raw Transcription:</span>
                            <div className="mt-1 bg-black/40 p-2 rounded text-gray-300 font-mono text-xs">
                              {eam.raw_transcription}
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Live Transcriptions Feed */}
        <div className="data-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-spacex-accent font-mono">
              RECENT TRANSCRIPTIONS ({recordings.length})
            </h2>
            <button
              onClick={loadRecordings}
              className="px-4 py-2 bg-spacex-blue hover:bg-spacex-blue-light rounded font-mono text-sm transition-colors"
            >
              REFRESH
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-spacex-accent mx-auto"></div>
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 font-mono">
                No recordings yet. Start monitoring to capture HFGCS communications.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {recordings.slice(0, 20).map((rec) => (
                <div
                  key={rec.segment_id}
                  className="bg-spacex-darker/50 border border-spacex-gray/50 rounded p-4 hover:border-spacex-accent/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3 text-xs text-gray-500 font-mono">
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(rec.start_time).toLocaleDateString()}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(rec.start_time).toLocaleTimeString()}
                      </span>
                      <span>{formatDuration(rec.duration)}</span>
                    </div>
                  </div>

                  {rec.transcribed && rec.transcription_text ? (
                    <div className="bg-black/30 border border-green-500/20 rounded p-3">
                      <div className="text-green-400 font-mono text-sm">
                        {rec.transcription_text}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 font-mono">
                      {rec.transcribed ? 'No speech detected' : 'Processing...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {recordings.length > 0 && (
            <div className="mt-4 text-center">
              <Link
                href="/recordings"
                className="text-sm font-mono text-spacex-accent hover:text-spacex-accent/80"
              >
                VIEW ALL RECORDINGS →
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

