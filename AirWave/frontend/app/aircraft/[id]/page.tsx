'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import useWebSocket from 'react-use-websocket'
import { ArrowLeft, Plane, Clock, MapPin, Activity, Video, Twitter, Download, Loader2 } from 'lucide-react'
import AircraftTimeline from '../../components/AircraftTimeline'
import AircraftMap from '../../components/AircraftMap'
import AltitudeChart from '../../components/AltitudeChart'
import AircraftPhotoGallery from '../../components/AircraftPhotoGallery'
import { ACARSMessage } from '../../types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5773/ws'

interface AircraftTrack {
  aircraft_id: string
  hex?: string
  flight?: string
  tail?: string
  aircraft_type?: string
  first_seen: string
  last_seen: string
  position_count: number
  current_lat?: number
  current_lon?: number
  current_altitude?: string
  current_speed?: number
  current_heading?: number
  track_points: any[]
}

export default function AircraftDetailPage() {
  const params = useParams()
  const router = useRouter()
  const aircraftId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aircraft, setAircraft] = useState<AircraftTrack | null>(null)
  const [messages, setMessages] = useState<ACARSMessage[]>([])
  const [trackPoints, setTrackPoints] = useState<any[]>([])
  
  // Video generation state
  const [videoGenerating, setVideoGenerating] = useState(false)
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<any>(null)
  const [tweetPosting, setTweetPosting] = useState(false)
  const [tweetUrl, setTweetUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  // Photo state
  const [photos, setPhotos] = useState<any[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosError, setPhotosError] = useState<string | null>(null)

  // Load initial aircraft data
  useEffect(() => {
    const loadAircraftData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch track data, messages, and photos in parallel
        const [trackResponse, messagesResponse, photosResponse] = await Promise.all([
          fetch(`${API_URL}/aircraft/${encodeURIComponent(aircraftId)}/track`),
          fetch(`${API_URL}/aircraft/${encodeURIComponent(aircraftId)}/messages?limit=200`),
          fetch(`${API_URL}/aircraft/${encodeURIComponent(aircraftId)}/photos`)
        ])
        
        if (!trackResponse.ok) {
          if (trackResponse.status === 404) {
            throw new Error('Aircraft not found')
          }
          throw new Error(`Failed to load aircraft data: ${trackResponse.statusText}`)
        }
        
        const trackData = await trackResponse.json()
        
        if (trackData.success) {
          setAircraft(trackData.aircraft)
          setTrackPoints(trackData.trackPoints || [])
          
          // Merge messages from both endpoints, prioritizing dedicated messages endpoint
          let allMessages = trackData.messages || []
          
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            if (messagesData.success && messagesData.messages) {
              // Merge and deduplicate by message ID
              const messageMap = new Map()
              
              // Add messages from dedicated endpoint first (higher priority)
              messagesData.messages.forEach((msg: ACARSMessage) => {
                messageMap.set(msg.id, msg)
              })
              
              // Add messages from track endpoint (if not already present)
              allMessages.forEach((msg: ACARSMessage) => {
                if (!messageMap.has(msg.id)) {
                  messageMap.set(msg.id, msg)
                }
              })
              
              allMessages = Array.from(messageMap.values())
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            }
          }
          
          setMessages(allMessages)
          
          // Handle photos response (non-blocking)
          if (photosResponse.ok) {
            const photosData = await photosResponse.json()
            if (photosData.success && photosData.photos) {
              setPhotos(photosData.photos)
            }
          }
        } else {
          throw new Error('Invalid response from server')
        }
      } catch (err: any) {
        console.error('Error loading aircraft data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (aircraftId) {
      loadAircraftData()
    }
  }, [aircraftId])

  // Subscribe to WebSocket updates
  const { lastMessage } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  })

  useEffect(() => {
    if (lastMessage !== null && aircraft) {
      try {
        const data = JSON.parse(lastMessage.data)
        
        // Filter messages for this specific aircraft
        // Prioritize hex matching, fallback to flight/tail/id
        const isRelevant = 
          (data.type === 'acars' || data.type === 'adsb') &&
          (data.data.hex === aircraft.hex ||
           data.data.flight === aircraft.flight || 
           data.data.tail === aircraft.tail ||
           data.data.id === aircraft.aircraft_id)
        
        if (isRelevant) {
          // Add new message
          setMessages(prev => [data.data, ...prev].slice(0, 200))
          
          // Update track points if position data exists
          if (data.data.position?.lat && data.data.position?.lon) {
            const newPoint = {
              lat: data.data.position.lat,
              lon: data.data.position.lon,
              altitude: data.data.position.altitude,
              timestamp: data.data.timestamp,
              heading: data.data.heading,
              ground_speed: data.data.ground_speed,
              vertical_rate: data.data.vertical_rate,
            }
            
            // De-duplicate track points using lat+lon+timestamp as key
            setTrackPoints(prev => {
              const key = `${newPoint.lat}_${newPoint.lon}_${newPoint.timestamp}`
              const existingKeys = new Set(
                prev.map(p => `${p.lat}_${p.lon}_${p.timestamp}`)
              )
              
              if (existingKeys.has(key)) {
                return prev
              }
              
              // Cap at 1000 points to bound memory
              const updated = [...prev, newPoint]
              return updated.length > 1000 ? updated.slice(-1000) : updated
            })
            
            // Update current position
            setAircraft(prev => prev ? {
              ...prev,
              current_lat: newPoint.lat,
              current_lon: newPoint.lon,
              current_altitude: newPoint.altitude,
              current_speed: newPoint.ground_speed,
              current_heading: newPoint.heading,
              last_seen: newPoint.timestamp,
            } : null)
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
  }, [lastMessage, aircraft])

  if (loading) {
    return (
      <div className="min-h-screen bg-spacex-dark grid-background flex items-center justify-center">
        <div className="scan-line" />
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-spacex-accent mx-auto mb-4"></div>
          <p className="text-spacex-accent text-xl font-mono">LOADING AIRCRAFT DATA...</p>
        </div>
      </div>
    )
  }

  if (error || !aircraft) {
    return (
      <div className="min-h-screen bg-spacex-dark grid-background flex items-center justify-center">
        <div className="scan-line" />
        <div className="text-center relative z-10">
          <Plane className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-xl font-mono mb-4">{error || 'Aircraft not found'}</p>
          <Link href="/" className="text-spacex-accent hover:text-spacex-green transition-colors font-mono">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const currentPosition = aircraft.current_lat && aircraft.current_lon ? {
    lat: aircraft.current_lat,
    lon: aircraft.current_lon,
    altitude: aircraft.current_altitude,
    timestamp: aircraft.last_seen,
    heading: aircraft.current_heading,
    ground_speed: aircraft.current_speed,
  } : undefined

  const isActive = new Date(aircraft.last_seen).getTime() > Date.now() - 5 * 60 * 1000 // Active if seen in last 5 minutes

  // Video generation function
  const generateVideo = async () => {
    setVideoGenerating(true)
    setVideoError(null)
    
    try {
      const response = await fetch(`${API_URL}/aircraft/${encodeURIComponent(aircraftId)}/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          durationSeconds: 10,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate video')
      }
      
      if (data.success) {
        setVideoPath(data.videoPath)
        setVideoMetadata(data)
        console.log('✅ Video generated successfully:', data)
      } else {
        throw new Error('Video generation failed')
      }
    } catch (err: any) {
      console.error('Error generating video:', err)
      setVideoError(err.message || 'Failed to generate video')
    } finally {
      setVideoGenerating(false)
    }
  }
  
  // Post to Twitter function
  const postToTwitter = async () => {
    setTweetPosting(true)
    setVideoError(null)
    
    try {
      const response = await fetch(`${API_URL}/aircraft/${encodeURIComponent(aircraftId)}/post-to-twitter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generateVideoIfMissing: true,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to post to Twitter')
      }
      
      if (data.success) {
        setTweetUrl(data.tweetUrl)
        console.log('✅ Posted to Twitter:', data.tweetUrl)
      } else {
        throw new Error('Twitter posting failed')
      }
    } catch (err: any) {
      console.error('Error posting to Twitter:', err)
      setVideoError(err.message || 'Failed to post to Twitter')
    } finally {
      setTweetPosting(false)
    }
  }

  // Photo refresh handler
  const handleRefreshPhotos = async () => {
    setPhotosLoading(true)
    setPhotosError(null)
    
    try {
      const response = await fetch(`${API_URL}/aircraft/${encodeURIComponent(aircraftId)}/photos/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh photos')
      }
      
      if (data.success && data.photos) {
        setPhotos(data.photos)
        console.log(`✅ Refreshed ${data.count} photos`)
      }
    } catch (err: any) {
      console.error('Error refreshing photos:', err)
      setPhotosError(err.message || 'Failed to refresh photos')
    } finally {
      setPhotosLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-spacex-dark grid-background">
      <div className="scan-line" />
      
      {/* Header */}
      <div className="bg-spacex-darker/90 border-b border-spacex-gray/30 sticky top-0 z-50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="text-spacex-accent hover:text-spacex-green transition-colors flex items-center space-x-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-mono text-sm">DASHBOARD</span>
              </Link>
              <div className="h-6 w-px bg-spacex-gray/30"></div>
              <div>
                <h1 className="text-2xl font-bold text-white font-mono flex items-center space-x-3">
                  <Plane className="w-6 h-6 text-spacex-accent" />
                  <span>{aircraft.flight || aircraft.tail || aircraft.aircraft_id}</span>
                  {isActive && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-spacex-green opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-spacex-green"></span>
                    </span>
                  )}
                </h1>
                <div className="flex items-center space-x-4 mt-1 text-sm font-mono text-gray-400">
                  {aircraft.tail && <span>Tail: {aircraft.tail}</span>}
                  {aircraft.aircraft_type && <span>Type: {aircraft.aircraft_type}</span>}
                  {aircraft.hex && <span>Hex: {aircraft.hex}</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6 text-sm font-mono">
              <div className="text-right">
                <div className="text-gray-500">LAST SEEN</div>
                <div className="text-spacex-accent">
                  {new Date(aircraft.last_seen).toLocaleTimeString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-500">POSITIONS</div>
                <div className="text-cyan-400">{trackPoints.length}</div>
              </div>
              
              {/* Video Generation Controls */}
              <div className="flex items-center space-x-2 ml-4 border-l border-spacex-gray/30 pl-4">
                <button
                  onClick={generateVideo}
                  disabled={videoGenerating || trackPoints.length < 2}
                  className="flex items-center space-x-2 px-3 py-2 bg-spacex-accent/10 hover:bg-spacex-accent/20 text-spacex-accent border border-spacex-accent/30 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title={trackPoints.length < 2 ? 'Need at least 2 positions to generate video' : 'Generate video of flight track'}
                >
                  {videoGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                  <span className="text-xs">
                    {videoGenerating ? 'Generating...' : 'Generate Video'}
                  </span>
                </button>
                
                <button
                  onClick={postToTwitter}
                  disabled={tweetPosting}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Post video to Twitter/X"
                >
                  {tweetPosting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Twitter className="w-4 h-4" />
                  )}
                  <span className="text-xs">
                    {tweetPosting ? 'Posting...' : 'Post to X'}
                  </span>
                </button>
                
                {videoPath && (
                  <a
                    href={`${API_URL}/aircraft/${encodeURIComponent(aircraftId)}/download-video`}
                    download
                    className="flex items-center space-x-2 px-3 py-2 bg-spacex-green/10 hover:bg-spacex-green/20 text-spacex-green border border-spacex-green/30 rounded transition-all"
                    title="Download video file"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-xs">Download Video</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {videoError && (
        <div className="container mx-auto px-4 pt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-red-400 text-sm font-mono">{videoError}</span>
            </div>
            <button
              onClick={() => setVideoError(null)}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      
      {videoPath && !videoError && (
        <div className="container mx-auto px-4 pt-4">
          <div className="bg-spacex-green/10 border border-spacex-green/30 rounded p-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Video className="w-4 h-4 text-spacex-green" />
              <div>
                <span className="text-spacex-green text-sm font-mono">Video generated successfully!</span>
                {videoMetadata && (
                  <div className="text-xs text-gray-400 mt-1">
                    {videoMetadata.resolution} • {videoMetadata.duration?.toFixed(1)}s • {(videoMetadata.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href={`${API_URL}/aircraft/${encodeURIComponent(aircraftId)}/download-video`}
                download
                className="text-spacex-green hover:text-white text-xs underline"
              >
                Download
              </a>
              <button
                onClick={() => { setVideoPath(null); setVideoMetadata(null); }}
                className="text-spacex-green hover:text-white text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      
      {tweetUrl && (
        <div className="container mx-auto px-4 pt-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Twitter className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-mono">Posted to Twitter!</span>
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 underline text-xs"
              >
                View Tweet →
              </a>
            </div>
            <button
              onClick={() => setTweetUrl(null)}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Photo Gallery - Full Width */}
        <div className="mb-6">
          <AircraftPhotoGallery
            aircraftId={aircraftId}
            photos={photos}
            loading={photosLoading}
            onRefresh={handleRefreshPhotos}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Timeline */}
          <div className="lg:col-span-1">
            <AircraftTimeline 
              messages={messages} 
              currentPosition={currentPosition}
            />
          </div>

          {/* Right column - Map and Chart */}
          <div className="lg:col-span-2 space-y-6">
            <AircraftMap
              trackPoints={trackPoints}
              currentPosition={currentPosition}
              aircraftInfo={{
                flight: aircraft.flight,
                tail: aircraft.tail,
                aircraft_type: aircraft.aircraft_type,
              }}
            />
            
            <AltitudeChart trackPoints={trackPoints} />
          </div>
        </div>
      </div>
    </div>
  )
}

