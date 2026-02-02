'use client'

import { useEffect, useState } from 'react'
import { Rocket, Activity, Radio, Settings, AlertTriangle, Tv, MapPin, Crosshair } from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
  connected: boolean
}

export default function Header({ connected }: HeaderProps) {
  return (
    <header className="border-b border-spacex-gray bg-spacex-darker/80 backdrop-blur-lg sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and title */}
          <div className="flex items-center space-x-4">
            <Rocket className="w-8 h-8 text-spacex-accent animate-pulse-slow" />
            <div>
              <h1 className="text-2xl font-bold tracking-wider glitch">
                <span className="text-spacex-accent">AIR</span>
                <span className="text-white">WAVE</span>
              </h1>
              <p className="text-xs text-gray-400 font-mono">MISSION CONTROL v1.0</p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center space-x-6">
            {/* Connection status */}
            <div className="flex items-center space-x-2">
              <Radio className={`w-5 h-5 ${connected ? 'text-spacex-green' : 'text-spacex-red'}`} />
              <div className="text-sm font-mono">
                <div className="text-gray-400">LINK STATUS</div>
                <div className={connected ? 'text-spacex-green' : 'text-spacex-red'}>
                  {connected ? (
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-spacex-green rounded-full mr-2 animate-pulse"></span>
                      CONNECTED
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-spacex-red rounded-full mr-2 animate-pulse"></span>
                      DISCONNECTED
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* System status */}
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-spacex-accent" />
              <div className="text-sm font-mono">
                <div className="text-gray-400">SYSTEM</div>
                <div className="text-spacex-accent">
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-spacex-accent rounded-full mr-2 animate-pulse"></span>
                    OPERATIONAL
                  </span>
                </div>
              </div>
            </div>

            {/* Time */}
            <div className="text-sm font-mono">
              <div className="text-gray-400">UTC TIME</div>
              <div className="text-white">
                <Clock />
              </div>
            </div>

            {/* HFGCS Link */}
            <Link 
              href="/hfgcs"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-orange-400 transition-colors group"
              title="HFGCS Livestream Monitor"
            >
              <Radio className="w-5 h-5 text-orange-400" />
              <span className="text-sm font-mono text-gray-400 group-hover:text-orange-400">HFGCS</span>
            </Link>

            {/* Emergency Scanner Link */}
            <Link 
              href="/emergency"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-red-400 transition-colors group"
              title="Emergency Scanner Monitoring"
            >
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm font-mono text-gray-400 group-hover:text-red-400">EMERGENCY</span>
            </Link>

            {/* Situational Awareness Link */}
            <Link 
              href="/situational"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-purple-400 transition-colors group"
              title="Situational Awareness"
            >
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="text-sm font-mono text-gray-400 group-hover:text-purple-400">SITREP</span>
            </Link>

            {/* Broadcast Overlay Link */}
            <Link 
              href="/broadcast"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-cyan-400 transition-colors group"
              title="YouTube Broadcast Overlay"
            >
              <Tv className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-mono text-gray-400 group-hover:text-cyan-400">BROADCAST</span>
            </Link>

            {/* EGPK Ground View Link */}
            <Link 
              href="/egpk-ground"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-blue-400 transition-colors group"
              title="EGPK Ground Operations View"
            >
              <MapPin className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-mono text-gray-400 group-hover:text-blue-400">EGPK</span>
            </Link>

            {/* Aircraft Tracking Link */}
            <Link 
              href="/track"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-green-400 transition-colors group"
              title="Aircraft Tracking"
            >
              <Crosshair className="w-5 h-5 text-green-400" />
              <span className="text-sm font-mono text-gray-400 group-hover:text-green-400">TRACK</span>
            </Link>

            {/* Admin Link */}
            <Link 
              href="/admin"
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-spacex-accent transition-colors group"
              title="System Configuration"
            >
              <Settings className="w-5 h-5 text-spacex-accent group-hover:rotate-90 transition-transform duration-300" />
              <span className="text-sm font-mono text-gray-400 group-hover:text-spacex-accent">ADMIN</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

function Clock() {
  const [time, setTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTime(new Date())
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Return placeholder during SSR to avoid hydration mismatch
  if (!mounted || !time) {
    return <span className="tabular-nums">--:--:--</span>
  }

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {time.toISOString().split('T')[1].split('.')[0]}
    </span>
  )
}

