'use client'

import { useEffect, useState, useRef } from 'react'
import useWebSocket from 'react-use-websocket'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, Calendar, Clock, Radio, FileAudio } from 'lucide-react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5773/ws'

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

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [selectedFeed, setSelectedFeed] = useState<string>('all')
  const audioRef = useRef<HTMLAudioElement>(null)

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
        if (data.type === 'atc_recording') {
          console.log('🎙️ New recording:', data.data.text)
          // Reload recordings to show new one
          loadRecordings()
          loadStats()
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
  }, [lastMessage])

  useEffect(() => {
    loadRecordings()
    loadStats()
  }, [selectedFeed])

  const loadRecordings = async () => {
    try {
      const url = selectedFeed === 'all' 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/recordings?limit=100`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/recordings?feedId=${selectedFeed}&limit=100`
      
      const response = await fetch(url)
      const data = await response.json()
      setRecordings(data.recordings || [])
    } catch (error) {
      console.error('Error loading recordings:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/recording/stats`)
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handlePlay = (segmentId: string) => {
    if (playing === segmentId) {
      audioRef.current?.pause()
      setPlaying(null)
    } else {
      const audioUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/recordings/${segmentId}/audio`
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.load() // Ensure audio is loaded
        audioRef.current.play()
          .then(() => setPlaying(segmentId))
          .catch((error) => {
            console.error('Playback error:', error)
            setPlaying(null)
          })
      }
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  const formatFileSize = (bytes: number) => {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const uniqueFeeds = [...new Set(recordings.map(r => r.feed_id))]

  return (
    <main className="min-h-screen bg-spacex-dark grid-background relative">
      <div className="scan-line" />
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />
      
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
              <FileAudio className="inline w-8 h-8 mr-3" />
              ATC RECORDINGS
              <span className="ml-3 text-xs text-green-400 animate-pulse">● LIVE</span>
            </h1>
            <p className="text-gray-400 font-mono text-sm mt-2">
              Voice-activated recordings with AI transcription (real-time updates)
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="data-card p-4 space-y-2">
              <div className="text-xs font-mono text-gray-400">STATISTICS</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-spacex-green">{stats.totalRecordings}</div>
                  <div className="text-xs text-gray-500">Total Segments</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">{stats.transcribed}</div>
                  <div className="text-xs text-gray-500">Transcribed</div>
                </div>
                <div>
                  <div className="text-sm font-mono text-yellow-400">
                    {(stats.totalDuration / 1000 / 60).toFixed(1)}m
                  </div>
                  <div className="text-xs text-gray-500">Total Audio</div>
                </div>
                <div>
                  <div className="text-sm font-mono text-purple-400">
                    {(stats.totalSize / 1024 / 1024).toFixed(1)} MB
                  </div>
                  <div className="text-xs text-gray-500">Storage</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="data-card p-4">
          <div className="flex items-center space-x-4">
            <Radio className="w-4 h-4 text-spacex-accent" />
            <select
              value={selectedFeed}
              onChange={(e) => setSelectedFeed(e.target.value)}
              className="bg-spacex-darker border border-spacex-gray/50 text-white rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-spacex-accent/50"
            >
              <option value="all">ALL FEEDS</option>
              {uniqueFeeds.map(feed => (
                <option key={feed} value={feed}>{feed}</option>
              ))}
            </select>
            <button
              onClick={loadRecordings}
              className="px-4 py-2 bg-spacex-blue hover:bg-spacex-blue-light rounded font-mono text-sm transition-colors"
            >
              REFRESH
            </button>
          </div>
        </div>

        {/* Recordings List */}
        <div className="data-card p-4">
          <h3 className="text-sm font-bold text-spacex-accent font-mono mb-4">
            RECORDED SEGMENTS ({recordings.length})
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-spacex-accent mx-auto"></div>
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 font-mono">No recordings yet. Start VOX recording to capture ATC communications.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {recordings.map((rec) => (
                <div
                  key={rec.segment_id}
                  className="bg-spacex-darker/50 border border-spacex-gray/50 rounded p-4 hover:border-spacex-accent/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    {/* Recording Info */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <button
                          onClick={() => handlePlay(rec.segment_id)}
                          className={`p-2 rounded transition-all ${
                            playing === rec.segment_id
                              ? 'bg-spacex-red hover:bg-spacex-red/80'
                              : 'bg-spacex-green hover:bg-spacex-green/80'
                          }`}
                        >
                          {playing === rec.segment_id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>

                        <div>
                          <div className="font-mono text-sm text-spacex-accent font-bold">
                            {rec.feed_id}
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-gray-500 font-mono mt-1">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {new Date(rec.start_time).toLocaleDateString()}
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(rec.start_time).toLocaleTimeString()}
                            </span>
                            <span>{formatDuration(rec.duration)}</span>
                            <span>{formatFileSize(rec.filesize)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Transcription */}
                      {rec.transcribed && rec.transcription_text ? (
                        <div className="mt-3 bg-black/30 border border-green-500/20 rounded p-3">
                          <div className="text-green-400 font-mono text-sm">
                            {rec.transcription_text}
                          </div>
                          {rec.transcribed_at && (
                            <div className="text-gray-600 text-[10px] mt-2">
                              Transcribed: {new Date(rec.transcribed_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-gray-600 font-mono">
                          {rec.transcribed ? 'No speech detected' : 'Pending transcription...'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

