'use client'

import { useEffect, useState } from 'react'
import useWebSocket from 'react-use-websocket'
import Header from './components/Header'
import LiveFeed from './components/LiveFeed'
import ADSBFeed from './components/ADSBFeed'
import Statistics from './components/Statistics'
import FlightTracker from './components/FlightTracker'
import MessageTypeChart from './components/MessageTypeChart'
import ATCAudioPlayer from './components/ATCAudioPlayer'
import DataSourceStatus from './components/DataSourceStatus'
import WorldMap from './components/WorldMap'
import ConflictAlerts from './components/ConflictAlerts'
import { useMessageStore } from './store/messageStore'
import { useConflictStore } from './store/conflictStore'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5773/ws'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const messages = useMessageStore((state) => state.messages)
  const addMessage = useMessageStore((state) => state.addMessage)
  const setMessages = useMessageStore((state) => state.setMessages)
  const addConflict = useConflictStore((state) => state.addConflict)
  const updateConflict = useConflictStore((state) => state.updateConflict)
  const resolveConflict = useConflictStore((state) => state.resolveConflict)

  // Load initial data from database on mount
  useEffect(() => {
    let mounted = true
    
    const loadInitialData = async () => {
      try {
        console.log('📦 Loading messages from database...')
        console.log(`📡 API URL: ${API_URL}`)
        
        // Load less messages initially for better performance
        const response = await fetch(`${API_URL}/messages/recent?limit=500`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        })
        
        if (!response.ok) {
          console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (!mounted) return // Prevent state update if unmounted
        
        if (data.messages && data.messages.length > 0) {
          console.log(`✅ Loaded ${data.messages.length} messages from database`)
          setMessages(data.messages)
        } else {
          console.log('📭 No messages in database yet - waiting for live data')
        }
      } catch (error) {
        console.error('❌ Error loading initial data:', error.message)
        console.log('💡 Backend might not be running. Check http://localhost:5773/health')
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadInitialData()
    
    return () => {
      mounted = false
    }
  }, []) // Remove setMessages from dependencies to prevent infinite loop

  const { lastMessage, readyState } = useWebSocket(WS_URL, {
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
        if (data.type === 'acars') {
          console.log('📡 ACARS message:', data.data.flight || data.data.tail)
          addMessage(data.data)
        } else if (data.type === 'adsb') {
          console.log('🛰️  ADS-B aircraft:', data.data.flight || data.data.tail)
          addMessage(data.data)
        } else if (data.type === 'adsb_batch') {
          console.log(`📦 ADS-B batch: ${data.count} aircraft`)
          // Add all messages from the batch
          data.data.forEach((msg: any) => addMessage(msg))
        } else if (data.type === 'atc_transcription') {
          console.log('🎙️ New transcription:', data.data.text)
          window.dispatchEvent(new CustomEvent('atc_transcription', { detail: data.data }))
        } else if (data.type === 'atc_recording') {
          console.log('🎙️ New VOX recording:', data.data.text)
          window.dispatchEvent(new CustomEvent('atc_recording', { detail: data.data }))
        } else if (data.type === 'conflict_detected') {
          console.log('⚠️  Conflict detected:', data.data)
          addConflict(data.data)
        } else if (data.type === 'conflict_resolved') {
          console.log('✅ Conflict resolved:', data.data)
          resolveConflict(data.data.id)
        } else if (data.type === 'conflict_updated') {
          console.log('🔄 Conflict updated:', data.data)
          updateConflict(data.data)
        }
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    }
  }, [lastMessage, addMessage, addConflict, updateConflict, resolveConflict])

  return (
    <main className="min-h-screen bg-spacex-dark grid-background relative">
      {/* Scan line effect */}
      <div className="scan-line" />
      
      <Header connected={connected} />
      
      {/* Conflict Alerts Overlay */}
      <ConflictAlerts />
      
      <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* Top row - Statistics */}
        <Statistics />

        {/* Middle row - Live feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LiveFeed />
          <ADSBFeed messages={messages} />
        </div>

        {/* Charts and widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DataSourceStatus />
          <MessageTypeChart />
          <FlightTracker />
        </div>

        {/* ATC Audio */}
        <ATCAudioPlayer />

        {/* Bottom row - World map */}
        <WorldMap />
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-spacex-accent mx-auto mb-4"></div>
            <p className="text-spacex-accent text-xl font-mono">LOADING FROM DATABASE...</p>
          </div>
        </div>
      )}
    </main>
  )
}

