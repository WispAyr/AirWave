'use client'

import { useEffect, useState } from 'react'
import useWebSocket from 'react-use-websocket'
import Header from '../components/Header'
import EmergencyAudioPlayer from '../components/EmergencyAudioPlayer'
import EmergencyMap from '../components/EmergencyMap'
import { useEmergencyAudioStore } from '../store/emergencyAudioStore'
import { AlertTriangle, ArrowLeft, Radio, MapPin, Activity } from 'lucide-react'
import Link from 'next/link'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5773/ws'

export default function EmergencyPage() {
  const [connected, setConnected] = useState(false)
  const [transcriptions, setTranscriptions] = useState<Array<{text: string, timestamp: string, feedId?: string}>>([])
  
  const { feeds, selectedFeed, selectFeed } = useEmergencyAudioStore()

  const { lastMessage } = useWebSocket(WS_URL, {
    onOpen: () => {
      console.log('Connected to Airwave backend')
      setConnected(true)
    },
    onClose: () => {
      console.log('Disconnected from Airwave backend')
      setConnected(false)
    },
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  })

  // Handle real-time WebSocket messages
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const data = JSON.parse(lastMessage.data)
        if (data.type === 'emergency_transcription') {
          console.log('🚨 Emergency transcription:', data.data.text)
          
          // Dispatch custom event for EmergencyAudioPlayer
          window.dispatchEvent(new CustomEvent('emergency_transcription', { 
            detail: data.data 
          }))
          
          // Update local transcriptions state
          setTranscriptions(prev => [
            { ...data.data, feedId: data.data.feedId },
            ...prev
          ].slice(0, 50))
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
  }, [lastMessage])

  // Stats
  const stats = {
    totalFeeds: feeds.length,
    policeFeeds: feeds.filter(f => f.type === 'police').length,
    fireFeeds: feeds.filter(f => f.type === 'fire').length,
    emsFeeds: feeds.filter(f => f.type === 'ems').length,
    multiFeeds: feeds.filter(f => f.type === 'multi').length,
    activeTranscriptions: transcriptions.length
  }

  return (
    <main className="min-h-screen bg-spacex-dark grid-background relative">
      {/* Scan line effect */}
      <div className="scan-line" />
      
      <Header connected={connected} />
      
      <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* Back button and title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-red-400 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
              <span className="text-sm font-mono text-gray-400 group-hover:text-red-400">BACK</span>
            </Link>
            <h1 className="text-3xl font-bold tracking-wider">
              <span className="text-red-400">EMERGENCY</span>
              <span className="text-white"> SCANNER MONITORING</span>
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="data-card rounded-lg p-4">
            <div className="text-gray-400 text-xs font-mono mb-1">TOTAL FEEDS</div>
            <div className="text-2xl font-bold text-white font-mono">{stats.totalFeeds}</div>
          </div>
          <div className="data-card rounded-lg p-4">
            <div className="text-blue-400 text-xs font-mono mb-1 flex items-center">
              🔵 POLICE
            </div>
            <div className="text-2xl font-bold text-blue-400 font-mono">{stats.policeFeeds}</div>
          </div>
          <div className="data-card rounded-lg p-4">
            <div className="text-red-400 text-xs font-mono mb-1 flex items-center">
              🔴 FIRE
            </div>
            <div className="text-2xl font-bold text-red-400 font-mono">{stats.fireFeeds}</div>
          </div>
          <div className="data-card rounded-lg p-4">
            <div className="text-green-400 text-xs font-mono mb-1 flex items-center">
              🟢 EMS
            </div>
            <div className="text-2xl font-bold text-green-400 font-mono">{stats.emsFeeds}</div>
          </div>
          <div className="data-card rounded-lg p-4">
            <div className="text-orange-400 text-xs font-mono mb-1 flex items-center">
              🟠 MULTI
            </div>
            <div className="text-2xl font-bold text-orange-400 font-mono">{stats.multiFeeds}</div>
          </div>
          <div className="data-card rounded-lg p-4">
            <div className="text-yellow-400 text-xs font-mono mb-1 flex items-center">
              <Activity className="w-3 h-3 mr-1" />
              ACTIVE
            </div>
            <div className="text-2xl font-bold text-yellow-400 font-mono">{stats.activeTranscriptions}</div>
          </div>
        </div>

        {/* Main Content - Audio Player and Map */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Audio Player - Left Column (2 cols) */}
          <div className="lg:col-span-2">
            <EmergencyAudioPlayer />
          </div>

          {/* Map - Right Column (3 cols) */}
          <div className="lg:col-span-3">
            <EmergencyMap
              feeds={feeds}
              selectedFeed={selectedFeed}
              onFeedSelect={selectFeed}
              transcriptions={transcriptions}
            />
          </div>
        </div>

        {/* Info Panel */}
        <div className="data-card rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-400 font-mono mb-2">ABOUT EMERGENCY SCANNER MONITORING</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <p>
                  This feature provides real-time monitoring of emergency scanner feeds from police, fire, EMS, 
                  and multi-agency dispatch centers across the United States.
                </p>
                <p>
                  <span className="text-red-400 font-bold">Important:</span> Emergency scanner monitoring is subject 
                  to local laws and regulations. Some jurisdictions restrict scanner use. This system is for monitoring 
                  and educational purposes only.
                </p>
                <p className="text-xs text-gray-600">
                  Scanner feeds provided by Broadcastify.com. Real-time transcription powered by whisper.cpp (local AI model). 
                  Recording or redistribution of scanner audio is prohibited without permission.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Whisper Status Check */}
        <div className="data-card rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-spacex-accent" />
              <span className="text-sm font-mono text-gray-400">TRANSCRIPTION ENGINE</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-spacex-green' : 'bg-spacex-red'} animate-pulse`}></span>
              <span className={`text-xs font-mono ${connected ? 'text-spacex-green' : 'text-spacex-red'}`}>
                {connected ? 'WHISPER READY' : 'WHISPER OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connection status overlay */}
      {!connected && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-400 mx-auto mb-4"></div>
            <p className="text-red-400 text-xl font-mono">CONNECTING TO EMERGENCY SERVICES...</p>
          </div>
        </div>
      )}
    </main>
  )
}


