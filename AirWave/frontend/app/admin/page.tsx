'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  Settings, Key, Server, Mic, Radio, Save, RefreshCw, ArrowLeft,
  Satellite, Power, Play, Square, CheckCircle, XCircle
} from 'lucide-react'
import { useAdminStore } from '../store/adminStore'

export default function AdminPage() {
  const { 
    settings, 
    serviceStatuses, 
    loading, 
    error,
    loadSettings, 
    updateSetting, 
    saveSettings,
    refreshServiceStatus,
    startTar1090,
    stopTar1090,
    startADSBExchange,
    stopADSBExchange,
    startAirframes,
    stopAirframes,
    testYoutubeApiKey,
    validateChannelHandle
  } = useAdminStore()

  const [activeSection, setActiveSection] = useState('airframes')
  const [databaseStats, setDatabaseStats] = useState<any>(null)
  const [databaseLoading, setDatabaseLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: string }>({})
  const [youtubeApiKeyValid, setYoutubeApiKeyValid] = useState<boolean | null>(null)
  const [youtubeApiKeyTesting, setYoutubeApiKeyTesting] = useState(false)
  const [channelValid, setChannelValid] = useState<boolean | null>(null)
  const [channelValidating, setChannelValidating] = useState(false)
  const [validatedChannelName, setValidatedChannelName] = useState<string>('')

  useEffect(() => {
    loadSettings()
    refreshServiceStatus()
    loadDatabaseStats()
    
    // Refresh service status every 5 seconds
    const interval = setInterval(refreshServiceStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadDatabaseStats = async () => {
    setDatabaseLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/admin/database/stats`)
      if (response.ok) {
        const data = await response.json()
        setDatabaseStats(data)
      }
    } catch (error) {
      console.error('Failed to load database stats:', error)
    } finally {
      setDatabaseLoading(false)
    }
  }

  const runDatabaseMaintenance = async (action: string, params: any = {}) => {
    setDatabaseLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/admin/database/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })
      if (response.ok) {
        const result = await response.json()
        console.log(`${action} completed:`, result)
        await loadDatabaseStats() // Refresh stats
      }
    } catch (error) {
      console.error(`Failed to run ${action}:`, error)
    } finally {
      setDatabaseLoading(false)
    }
  }

  const handleSave = async (category: string) => {
    setSaveStatus({ ...saveStatus, [category]: 'saving' })
    const success = await saveSettings(category)
    
    if (success) {
      setSaveStatus({ ...saveStatus, [category]: 'saved' })
      setTimeout(() => {
        setSaveStatus({ ...saveStatus, [category]: '' })
      }, 2000)
    } else {
      setSaveStatus({ ...saveStatus, [category]: 'error' })
      setTimeout(() => {
        setSaveStatus({ ...saveStatus, [category]: '' })
      }, 3000)
    }
  }

  const handleTar1090Toggle = async () => {
    if (serviceStatuses.tar1090.connected) {
      const success = await stopTar1090()
      if (success) {
        console.log('TAR1090 stopped successfully')
      }
    } else {
      const url = settings.tar1090?.url || 'http://192.168.1.120/skyaware/data/aircraft.json'
      const pollInterval = settings.tar1090?.poll_interval || 2000
      console.log('Starting TAR1090 with URL:', url)
      const success = await startTar1090(url, pollInterval)
      if (success) {
        console.log('TAR1090 started successfully')
      } else {
        console.error('Failed to start TAR1090 - check console for details')
      }
    }
  }

  const handleADSBExchangeToggle = async () => {
    if (serviceStatuses.adsbexchange?.connected) {
      const success = await stopADSBExchange()
      if (success) {
        console.log('ADS-B Exchange stopped successfully')
      }
    } else {
      // Check if API key is configured
      if (!settings.adsbexchange?.api_key) {
        alert('⚠️ Please configure your ADS-B Exchange API key and save settings before starting.')
        return
      }
      
      // Save settings first to ensure they're persisted
      console.log('Saving ADS-B Exchange settings before starting...')
      const saved = await saveSettings('adsbexchange')
      
      if (!saved) {
        console.error('Failed to save settings')
        return
      }
      
      console.log('Starting ADS-B Exchange...')
      const success = await startADSBExchange()
      if (success) {
        console.log('ADS-B Exchange started successfully')
      } else {
        console.error('Failed to start ADS-B Exchange - check API key and settings')
      }
    }
  }

  const handleAirframesToggle = async () => {
    if (serviceStatuses.airframes.connected) {
      const success = await stopAirframes()
      if (success) {
        console.log('Airframes stopped successfully')
      }
    } else {
      // Check if API key is configured
      if (!settings.airframes?.api_key) {
        alert('⚠️ Please configure your Airframes API key and save settings before starting.')
        return
      }
      
      // Save settings first
      const saveSuccess = await saveSettings('airframes')
      if (!saveSuccess) {
        console.error('Failed to save Airframes settings')
        return
      }
      
      const success = await startAirframes()
      if (success) {
        console.log('Airframes started successfully')
      } else {
        console.error('Failed to start Airframes - check console for details')
      }
    }
  }

  const handleTestYoutubeApiKey = async () => {
    const apiKey = settings.youtube?.api_key
    if (!apiKey) {
      setYoutubeApiKeyValid(false)
      return
    }

    setYoutubeApiKeyTesting(true)
    setYoutubeApiKeyValid(null)
    
    const valid = await testYoutubeApiKey(apiKey)
    setYoutubeApiKeyValid(valid)
    setYoutubeApiKeyTesting(false)
  }

  const handleValidateChannel = async () => {
    const handle = settings.youtube?.channel_handle
    if (!handle) {
      setChannelValid(false)
      return
    }

    setChannelValidating(true)
    setChannelValid(null)
    setValidatedChannelName('')
    
    const result = await validateChannelHandle(handle)
    setChannelValid(result.valid)
    setChannelValidating(false)
    
    if (result.valid && result.channelId) {
      setValidatedChannelName(handle)
    }
  }

  return (
    <div className="min-h-screen bg-spacex-dark grid-background">
      <div className="scan-line" />
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className="p-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-spacex-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-spacex-accent" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
                <Settings className="w-8 h-8 text-spacex-accent" />
                <span className="glitch" data-text="SYSTEM CONFIGURATION">SYSTEM CONFIGURATION</span>
              </h1>
              <p className="text-gray-400 text-sm mt-1 font-mono">Mission Control Admin Panel</p>
            </div>
          </div>

          <button
            onClick={refreshServiceStatus}
            className="p-2 rounded-lg bg-spacex-darker border border-spacex-gray hover:border-spacex-accent transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className="w-5 h-5 text-spacex-accent" />
          </button>
        </div>

        {/* Service Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="data-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="w-5 h-5 text-blue-400" />
                <span className="text-gray-300 font-mono text-sm">AIRFRAMES.IO</span>
              </div>
              {serviceStatuses.airframes.connected ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div className="mt-2">
              <span className={`text-xs font-mono ${serviceStatuses.airframes.connected ? 'text-green-400' : 'text-red-400'}`}>
                {serviceStatuses.airframes.connected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          <div className="data-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Satellite className="w-5 h-5 text-purple-400" />
                <span className="text-gray-300 font-mono text-sm">TAR1090</span>
              </div>
              {serviceStatuses.tar1090.connected ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs font-mono ${serviceStatuses.tar1090.connected ? 'text-green-400' : 'text-red-400'}`}>
                {serviceStatuses.tar1090.connected ? 'ACTIVE' : 'INACTIVE'}
              </span>
              {serviceStatuses.tar1090.messageCount !== undefined && (
                <span className="text-xs text-gray-400 font-mono">
                  {serviceStatuses.tar1090.messageCount} msgs
                </span>
              )}
            </div>
          </div>

          <div className="data-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Satellite className="w-5 h-5 text-blue-500" />
                <span className="text-gray-300 font-mono text-sm">ADSBX</span>
              </div>
              {serviceStatuses.adsbexchange?.connected ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div className="mt-2">
              <span className={`text-xs font-mono ${serviceStatuses.adsbexchange?.connected ? 'text-green-400' : 'text-red-400'}`}>
                {serviceStatuses.adsbexchange?.connected ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>
          </div>

          <div className="data-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mic className="w-5 h-5 text-cyan-400" />
                <span className="text-gray-300 font-mono text-sm">WHISPER</span>
              </div>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div className="mt-2">
              <span className="text-xs font-mono text-green-400">READY</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6 overflow-x-auto">
          {[
            { id: 'airframes', label: 'AIRFRAMES.IO', icon: Radio },
            { id: 'tar1090', label: 'TAR1090', icon: Satellite },
            { id: 'adsbexchange', label: 'ADS-B EXCHANGE', icon: Satellite },
            { id: 'whisper', label: 'WHISPER', icon: Mic },
            { id: 'audio', label: 'AUDIO', icon: Radio },
            { id: 'youtube', label: 'YOUTUBE', icon: Radio },
            { id: 'broadcast', label: 'BROADCAST', icon: Radio },
            { id: 'database', label: 'DATABASE', icon: Server },
            { id: 'system', label: 'SYSTEM', icon: Server }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`px-4 py-2 rounded-lg font-mono text-sm flex items-center space-x-2 transition-colors ${
                activeSection === id
                  ? 'bg-spacex-blue text-white'
                  : 'bg-spacex-darker text-gray-400 hover:text-white border border-spacex-gray'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Airframes.io Section */}
          {activeSection === 'airframes' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Radio className="w-6 h-6 text-blue-400" />
                <span>AIRFRAMES.IO Configuration</span>
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-spacex-darker rounded-lg border border-spacex-gray">
                  <div>
                    <p className="text-white font-mono">Enable Airframes.io Feed</p>
                    <p className="text-gray-400 text-xs mt-1">ACARS, CPDLC, ADSC messages</p>
                  </div>
                  <button
                    onClick={handleAirframesToggle}
                    className={`px-4 py-2 rounded-lg font-mono text-sm flex items-center space-x-2 ${
                      serviceStatuses.airframes.connected
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white transition-colors`}
                  >
                    {serviceStatuses.airframes.connected ? (
                      <>
                        <Square className="w-4 h-4" />
                        <span>STOP</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>START</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">API Key</label>
                  <input
                    type="password"
                    value={settings.airframes?.api_key || ''}
                    onChange={(e) => updateSetting('airframes', 'api_key', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                    placeholder="Enter API key"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">API URL</label>
                  <input
                    type="text"
                    value={settings.airframes?.api_url || ''}
                    onChange={(e) => updateSetting('airframes', 'api_url', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                    placeholder="https://api.airframes.io"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">WebSocket URL</label>
                  <input
                    type="text"
                    value={settings.airframes?.ws_url || ''}
                    onChange={(e) => updateSetting('airframes', 'ws_url', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                    placeholder="wss://api.airframes.io"
                  />
                </div>

                <button
                  onClick={() => handleSave('airframes')}
                  disabled={loading}
                  className="mt-4 px-6 py-2 bg-spacex-blue hover:bg-spacex-blue-light text-white rounded-lg font-mono flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus.airframes === 'saving' ? 'SAVING...' : saveStatus.airframes === 'saved' ? 'SAVED!' : 'SAVE CHANGES'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAR1090 Section */}
          {activeSection === 'tar1090' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Satellite className="w-6 h-6 text-purple-400" />
                <span>TAR1090 Configuration</span>
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-spacex-darker rounded-lg border border-spacex-gray">
                  <div>
                    <p className="text-white font-mono">Enable TAR1090 Feed</p>
                    <p className="text-gray-400 text-xs mt-1">ADS-B aircraft tracking integration</p>
                  </div>
                  <button
                    onClick={handleTar1090Toggle}
                    className={`px-4 py-2 rounded-lg font-mono text-sm flex items-center space-x-2 ${
                      serviceStatuses.tar1090.connected
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white transition-colors`}
                  >
                    {serviceStatuses.tar1090.connected ? (
                      <>
                        <Square className="w-4 h-4" />
                        <span>STOP</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>START</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">TAR1090 URL</label>
                  <input
                    type="text"
                    value={settings.tar1090?.url || ''}
                    onChange={(e) => updateSetting('tar1090', 'url', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                    placeholder="http://192.168.1.120/skyaware/data/aircraft.json"
                  />
                  <p className="text-gray-500 text-xs mt-1 font-mono">Local TAR1090 aircraft.json endpoint</p>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">
                    Poll Interval: {settings.tar1090?.poll_interval || 2000}ms
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="10000"
                    step="500"
                    value={settings.tar1090?.poll_interval || 2000}
                    onChange={(e) => updateSetting('tar1090', 'poll_interval', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono mt-1">
                    <span>1s</span>
                    <span>10s</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSave('tar1090')}
                  disabled={loading}
                  className="mt-4 px-6 py-2 bg-spacex-blue hover:bg-spacex-blue-light text-white rounded-lg font-mono flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus.tar1090 === 'saving' ? 'SAVING...' : saveStatus.tar1090 === 'saved' ? 'SAVED!' : 'SAVE CHANGES'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ADS-B Exchange Section */}
          {activeSection === 'adsbexchange' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Satellite className="w-6 h-6 text-blue-500" />
                <span>ADS-B EXCHANGE Configuration</span>
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-spacex-darker rounded-lg border border-spacex-gray">
                  <div>
                    <p className="text-white font-mono">Enable ADS-B Exchange Feed</p>
                    <p className="text-gray-400 text-xs mt-1">Global unfiltered aircraft position data</p>
                  </div>
                  <button
                    onClick={handleADSBExchangeToggle}
                    className={`px-4 py-2 rounded-lg font-mono text-sm flex items-center space-x-2 ${
                      serviceStatuses.adsbexchange?.connected
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white transition-colors`}
                  >
                    {serviceStatuses.adsbexchange?.connected ? (
                      <>
                        <Square className="w-4 h-4" />
                        <span>STOP</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>START</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-300 text-sm font-mono">
                    🌍 ADS-B Exchange provides global, unfiltered aircraft tracking data via their API.
                  </p>
                </div>

                {!settings.adsbexchange?.api_key && (
                  <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-300 text-sm font-mono">
                      ⚠️ API Key Required: You need an ADS-B Exchange API key to use this service. Configure it below and save settings before starting.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">
                    API Key {!settings.adsbexchange?.api_key && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type="password"
                    value={settings.adsbexchange?.api_key || ''}
                    onChange={(e) => updateSetting('adsbexchange', 'api_key', e.target.value)}
                    className={`w-full bg-spacex-darker border rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none ${
                      !settings.adsbexchange?.api_key ? 'border-red-500' : 'border-spacex-gray'
                    }`}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                  <p className="text-gray-500 text-xs mt-1 font-mono">Enter your ADS-B Exchange API key (UUID format)</p>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">API URL</label>
                  <input
                    type="text"
                    value={settings.adsbexchange?.api_url || ''}
                    onChange={(e) => updateSetting('adsbexchange', 'api_url', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                    placeholder="https://adsbexchange.com/api/aircraft"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm font-mono mb-2">Default Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={settings.adsbexchange?.default_lat || ''}
                      onChange={(e) => updateSetting('adsbexchange', 'default_lat', parseFloat(e.target.value))}
                      className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                      placeholder="55.8642"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm font-mono mb-2">Default Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={settings.adsbexchange?.default_lon || ''}
                      onChange={(e) => updateSetting('adsbexchange', 'default_lon', parseFloat(e.target.value))}
                      className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                      placeholder="-4.2518"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">
                    Search Distance: {settings.adsbexchange?.default_dist || 10} nm
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={settings.adsbexchange?.default_dist || 10}
                    onChange={(e) => updateSetting('adsbexchange', 'default_dist', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono mt-1">
                    <span>1 nm</span>
                    <span>100 nm</span>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">
                    Poll Interval: {settings.adsbexchange?.poll_interval || 10000}ms
                  </label>
                  <input
                    type="range"
                    min="5000"
                    max="30000"
                    step="1000"
                    value={settings.adsbexchange?.poll_interval || 10000}
                    onChange={(e) => updateSetting('adsbexchange', 'poll_interval', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 font-mono mt-1">
                    <span>5s</span>
                    <span>30s</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1 font-mono">⚠️ Respect API rate limits</p>
                </div>

                <button
                  onClick={() => handleSave('adsbexchange')}
                  disabled={loading}
                  className="mt-4 px-6 py-2 bg-spacex-blue hover:bg-spacex-blue-light text-white rounded-lg font-mono flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus.adsbexchange === 'saving' ? 'SAVING...' : saveStatus.adsbexchange === 'saved' ? 'SAVED!' : 'SAVE CHANGES'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Whisper Section */}
          {activeSection === 'whisper' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Mic className="w-6 h-6 text-cyan-400" />
                <span>WHISPER Configuration</span>
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">Server URL</label>
                  <input
                    type="text"
                    value={settings.whisper?.server_url || ''}
                    onChange={(e) => updateSetting('whisper', 'server_url', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                    placeholder="http://localhost:8080"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">Language</label>
                  <select
                    value={settings.whisper?.language || 'en'}
                    onChange={(e) => updateSetting('whisper', 'language', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                  >
                    <option value="en">English</option>
                    <option value="auto">Auto-detect</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">Model</label>
                  <select
                    value={settings.whisper?.model || 'base.en'}
                    onChange={(e) => updateSetting('whisper', 'model', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                  >
                    <option value="tiny.en">Tiny (fastest)</option>
                    <option value="base.en">Base (recommended)</option>
                    <option value="small.en">Small</option>
                    <option value="medium.en">Medium</option>
                  </select>
                </div>

                <button
                  onClick={() => handleSave('whisper')}
                  disabled={loading}
                  className="mt-4 px-6 py-2 bg-spacex-blue hover:bg-spacex-blue-light text-white rounded-lg font-mono flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus.whisper === 'saving' ? 'SAVING...' : saveStatus.whisper === 'saved' ? 'SAVED!' : 'SAVE CHANGES'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Audio Section */}
          {activeSection === 'audio' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Radio className="w-6 h-6 text-green-400" />
                <span>AUDIO Configuration</span>
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">
                    Sample Rate: {settings.audio?.sample_rate || 16000}Hz
                  </label>
                  <input
                    type="range"
                    min="8000"
                    max="48000"
                    step="8000"
                    value={settings.audio?.sample_rate || 16000}
                    onChange={(e) => updateSetting('audio', 'sample_rate', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">
                    Chunk Duration: {settings.audio?.chunk_duration || 30}s
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="5"
                    value={settings.audio?.chunk_duration || 30}
                    onChange={(e) => updateSetting('audio', 'chunk_duration', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">
                    VAD Threshold: {settings.audio?.vad_threshold || 0.5}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.audio?.vad_threshold || 0.5}
                    onChange={(e) => updateSetting('audio', 'vad_threshold', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <button
                  onClick={() => handleSave('audio')}
                  disabled={loading}
                  className="mt-4 px-6 py-2 bg-spacex-blue hover:bg-spacex-blue-light text-white rounded-lg font-mono flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus.audio === 'saving' ? 'SAVING...' : saveStatus.audio === 'saved' ? 'SAVED!' : 'SAVE CHANGES'}</span>
                </button>
              </div>
            </div>
          )}

          {/* YouTube Section */}
          {activeSection === 'youtube' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Radio className="w-6 h-6 text-orange-400" />
                <span>YOUTUBE STREAM Configuration</span>
              </h2>
              
              <div className="space-y-6">
                {/* API Configuration Section */}
                <div className="border-b border-spacex-gray/30 pb-6">
                  <h3 className="text-lg font-bold text-spacex-accent mb-4 font-mono">API Configuration</h3>
                  <p className="text-gray-400 text-sm mb-4 font-mono">
                    Configure YouTube Data API to automatically discover live streams from channels
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm font-mono mb-2">YouTube Data API Key</label>
                      <div className="flex space-x-2">
                        <input
                          type="password"
                          value={settings.youtube?.api_key || ''}
                          onChange={(e) => {
                            updateSetting('youtube', 'api_key', e.target.value)
                            setYoutubeApiKeyValid(null)
                          }}
                          className="flex-1 bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                          placeholder="AIza*********************"
                        />
                        <button
                          onClick={handleTestYoutubeApiKey}
                          disabled={youtubeApiKeyTesting || !settings.youtube?.api_key}
                          className="px-4 py-2 bg-spacex-blue hover:bg-spacex-blue-light rounded font-mono text-sm transition-colors disabled:opacity-50 flex items-center space-x-2"
                        >
                          {youtubeApiKeyTesting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>TESTING...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>TEST API KEY</span>
                            </>
                          )}
                        </button>
                      </div>
                      {youtubeApiKeyValid === true && (
                        <p className="text-green-400 text-xs font-mono mt-1 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          API key is valid
                        </p>
                      )}
                      {youtubeApiKeyValid === false && (
                        <p className="text-red-400 text-xs font-mono mt-1 flex items-center">
                          <XCircle className="w-3 h-3 mr-1" />
                          Invalid API key
                        </p>
                      )}
                      <p className="text-gray-500 text-xs font-mono mt-1">
                        Get your API key from{' '}
                        <a 
                          href="https://console.cloud.google.com/apis/credentials" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-spacex-accent hover:underline"
                        >
                          Google Cloud Console
                        </a>
                      </p>
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm font-mono mb-2">Default Channel Handle</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={settings.youtube?.channel_handle || ''}
                          onChange={(e) => {
                            updateSetting('youtube', 'channel_handle', e.target.value)
                            setChannelValid(null)
                          }}
                          className="flex-1 bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                          placeholder="@neetintel"
                        />
                        <button
                          onClick={handleValidateChannel}
                          disabled={channelValidating || !settings.youtube?.channel_handle}
                          className="px-4 py-2 bg-spacex-blue hover:bg-spacex-blue-light rounded font-mono text-sm transition-colors disabled:opacity-50 flex items-center space-x-2"
                        >
                          {channelValidating ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>VALIDATING...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>VALIDATE</span>
                            </>
                          )}
                        </button>
                      </div>
                      {channelValid === true && (
                        <p className="text-green-400 text-xs font-mono mt-1 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Channel found: {validatedChannelName}
                        </p>
                      )}
                      {channelValid === false && (
                        <p className="text-red-400 text-xs font-mono mt-1 flex items-center">
                          <XCircle className="w-3 h-3 mr-1" />
                          Channel not found
                        </p>
                      )}
                      <p className="text-gray-500 text-xs font-mono mt-1">
                        YouTube channel to fetch live streams from (e.g., @neetintel)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stream Configuration Section */}
                <div>
                  <h3 className="text-lg font-bold text-spacex-accent mb-4 font-mono">Stream Configuration</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm font-mono mb-2">Manual Livestream URL (Optional)</label>
                      <input
                        type="text"
                        value={settings.youtube?.stream_url || ''}
                        onChange={(e) => updateSetting('youtube', 'stream_url', e.target.value)}
                        className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                      <p className="text-gray-500 text-xs font-mono mt-1">
                        Or use auto-discovery from configured channel
                      </p>
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm font-mono mb-2">Feed Identifier</label>
                      <input
                        type="text"
                        value={settings.youtube?.feed_id || 'hfgcs_youtube'}
                        onChange={(e) => updateSetting('youtube', 'feed_id', e.target.value)}
                        className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                        placeholder="hfgcs_youtube"
                      />
                      <p className="text-gray-500 text-xs font-mono mt-1">
                        Unique identifier for this stream in the database
                      </p>
                    </div>

                    <div className="flex items-center justify-between bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30">
                      <div>
                        <label className="block text-gray-400 text-sm font-mono mb-1">Auto-start monitoring</label>
                        <p className="text-gray-500 text-xs font-mono">
                          Automatically start monitoring when server boots
                        </p>
                      </div>
                      <button
                        onClick={() => updateSetting('youtube', 'auto_start', !(settings.youtube?.auto_start))}
                        className={`px-4 py-2 rounded font-mono text-sm transition-colors ${
                          settings.youtube?.auto_start
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        {settings.youtube?.auto_start ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSave('youtube')}
                  disabled={loading}
                  className="mt-4 px-6 py-2 bg-spacex-blue hover:bg-spacex-blue-light text-white rounded-lg font-mono flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus.youtube === 'saving' ? 'SAVING...' : saveStatus.youtube === 'saved' ? 'SAVED!' : 'SAVE CHANGES'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Broadcast Configuration Section */}
          {activeSection === 'broadcast' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Radio className="w-6 h-6 text-cyan-400" />
                <span>BROADCAST Configuration</span>
              </h2>
              
              <div className="space-y-6">
                {/* Info */}
                <div className="bg-cyan-900/20 border border-cyan-500 rounded-lg p-4">
                  <p className="text-cyan-300 font-mono text-sm mb-2">
                    Configure broadcast modes, layouts, and narrative templates for the broadcast page.
                  </p>
                  <p className="text-gray-400 font-mono text-xs">
                    Visit <a href="/broadcast" className="text-cyan-400 hover:underline">/broadcast</a> to view the live broadcast interface.
                  </p>
                </div>

                {/* Preset Selection */}
                <div>
                  <h3 className="text-lg font-bold text-spacex-accent mb-4 font-mono">Quick Presets</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={async () => {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/admin/broadcast/preset/uk_airports`, { method: 'POST' });
                        if (res.ok) alert('✅ UK Airports preset applied!');
                      }}
                      className="p-4 bg-spacex-darker hover:bg-spacex-gray border border-spacex-gray rounded-lg text-left transition-colors"
                    >
                      <h4 className="text-white font-mono font-bold mb-1">UK Airports</h4>
                      <p className="text-gray-400 text-xs font-mono">Monitor major UK airports (Prestwick, Glasgow, Edinburgh, Heathrow)</p>
                    </button>

                    <button
                      onClick={async () => {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/admin/broadcast/preset/us_military`, { method: 'POST' });
                        if (res.ok) alert('✅ US Military preset applied!');
                      }}
                      className="p-4 bg-spacex-darker hover:bg-spacex-gray border border-spacex-gray rounded-lg text-left transition-colors"
                    >
                      <h4 className="text-white font-mono font-bold mb-1">US Military</h4>
                      <p className="text-gray-400 text-xs font-mono">Track US military aircraft with HFGCS and EAM monitoring</p>
                    </button>

                    <button
                      onClick={async () => {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/admin/broadcast/preset/global_traffic`, { method: 'POST' });
                        if (res.ok) alert('✅ Global Traffic preset applied!');
                      }}
                      className="p-4 bg-spacex-darker hover:bg-spacex-gray border border-spacex-gray rounded-lg text-left transition-colors"
                    >
                      <h4 className="text-white font-mono font-bold mb-1">Global Traffic</h4>
                      <p className="text-gray-400 text-xs font-mono">Worldwide aviation monitoring with statistics</p>
                    </button>

                    <button
                      onClick={async () => {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/admin/broadcast/preset/eam_watch`, { method: 'POST' });
                        if (res.ok) alert('✅ EAM Watch preset applied!');
                      }}
                      className="p-4 bg-spacex-darker hover:bg-spacex-gray border border-spacex-gray rounded-lg text-left transition-colors"
                    >
                      <h4 className="text-white font-mono font-bold mb-1">EAM Watch</h4>
                      <p className="text-gray-400 text-xs font-mono">Focus on Emergency Action Message detection and TACAMO monitoring</p>
                    </button>
                  </div>
                </div>

                {/* Layout Settings */}
                <div>
                  <h3 className="text-lg font-bold text-spacex-accent mb-4 font-mono">Layout Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30">
                      <label className="block text-gray-400 text-sm font-mono">Show Header</label>
                      <button className="px-3 py-1 bg-green-600 rounded font-mono text-sm">ON</button>
                    </div>
                    <div className="flex items-center justify-between bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30">
                      <label className="block text-gray-400 text-sm font-mono">Show Info Panel</label>
                      <button className="px-3 py-1 bg-green-600 rounded font-mono text-sm">ON</button>
                    </div>
                    <div className="flex items-center justify-between bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30">
                      <label className="block text-gray-400 text-sm font-mono">Show Ticker</label>
                      <button className="px-3 py-1 bg-green-600 rounded font-mono text-sm">ON</button>
                    </div>
                  </div>
                </div>

                {/* Narrative Settings */}
                <div>
                  <h3 className="text-lg font-bold text-spacex-accent mb-4 font-mono">Narrative Settings</h3>
                  <div className="bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30">
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-gray-400 text-sm font-mono">Enable Narrative</label>
                      <button className="px-3 py-1 bg-green-600 rounded font-mono text-sm">ENABLED</button>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm font-mono mb-2">Update Interval (seconds)</label>
                      <input
                        type="number"
                        defaultValue="15"
                        className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                        min="5"
                        max="60"
                      />
                    </div>
                  </div>
                </div>

                {/* Transitions */}
                <div>
                  <h3 className="text-lg font-bold text-spacex-accent mb-4 font-mono">Transitions</h3>
                  <div className="bg-spacex-darker/50 p-4 rounded border border-spacex-gray/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-gray-400 text-sm font-mono">Enable Transitions</label>
                      <button className="px-3 py-1 bg-green-600 rounded font-mono text-sm">ENABLED</button>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm font-mono mb-2">Duration (ms)</label>
                      <input
                        type="number"
                        defaultValue="500"
                        className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                        min="100"
                        max="2000"
                        step="100"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="block text-gray-400 text-sm font-mono">Auto-Rotate Modes</label>
                      <button className="px-3 py-1 bg-gray-600 rounded font-mono text-sm">DISABLED</button>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm font-mono mb-2">Rotate Interval (seconds)</label>
                      <input
                        type="number"
                        defaultValue="300"
                        className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                        min="30"
                        max="600"
                        step="30"
                      />
                    </div>
                  </div>
                </div>

                {/* Reset Button */}
                <div className="pt-4 border-t border-spacex-gray">
                  <button
                    onClick={async () => {
                      if (confirm('⚠️ Reset all broadcast settings to defaults?')) {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/admin/broadcast/config`, { method: 'DELETE' });
                        if (res.ok) alert('✅ Broadcast configuration reset to defaults!');
                      }
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-mono text-sm transition-colors"
                  >
                    RESET TO DEFAULTS
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Database Management Section */}
          {activeSection === 'database' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Server className="w-6 h-6 text-blue-400" />
                <span>DATABASE Management</span>
              </h2>
              
              {databaseLoading && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500 rounded-lg">
                  <p className="text-blue-400 font-mono text-sm">Loading database statistics...</p>
                </div>
              )}

              {databaseStats && (
                <div className="space-y-6">
                  {/* Database Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-spacex-darker/50 p-4 rounded-lg border border-spacex-gray">
                      <h3 className="text-white font-mono text-sm mb-2">Database Size</h3>
                      <p className="text-spacex-accent font-mono text-lg">{databaseStats.stats?.size?.totalMB} MB</p>
                      <p className="text-gray-400 font-mono text-xs">Used: {databaseStats.stats?.size?.usedPercent}%</p>
                    </div>
                    <div className="bg-spacex-darker/50 p-4 rounded-lg border border-spacex-gray">
                      <h3 className="text-white font-mono text-sm mb-2">Messages</h3>
                      <p className="text-spacex-accent font-mono text-lg">{databaseStats.stats?.tables?.messages?.toLocaleString()}</p>
                      <p className="text-gray-400 font-mono text-xs">Total stored</p>
                    </div>
                    <div className="bg-spacex-darker/50 p-4 rounded-lg border border-spacex-gray">
                      <h3 className="text-white font-mono text-sm mb-2">Aircraft Photos</h3>
                      <p className="text-spacex-accent font-mono text-lg">{databaseStats.stats?.photos?.total}</p>
                      <p className="text-gray-400 font-mono text-xs">{databaseStats.stats?.photos?.totalSizeMB?.toFixed(1)} MB</p>
                    </div>
                    <div className="bg-spacex-darker/50 p-4 rounded-lg border border-spacex-gray">
                      <h3 className="text-white font-mono text-sm mb-2">Hex Cache</h3>
                      <p className="text-spacex-accent font-mono text-lg">{databaseStats.stats?.tables?.hex_to_registration}</p>
                      <p className="text-gray-400 font-mono text-xs">Registrations cached</p>
                    </div>
                  </div>

                  {/* Maintenance Actions */}
                  <div className="space-y-4">
                    <h3 className="text-white font-mono text-lg">Maintenance Actions</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => runDatabaseMaintenance('optimize')}
                        disabled={databaseLoading}
                        className="p-4 bg-spacex-blue hover:bg-spacex-blue-light text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4" />
                          <span>OPTIMIZE DATABASE</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Run PRAGMA optimize + vacuum</p>
                      </button>

                      <button
                        onClick={() => runDatabaseMaintenance('clear-messages', { olderThanDays: 7 })}
                        disabled={databaseLoading}
                        className="p-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center space-x-2">
                          <Server className="w-4 h-4" />
                          <span>CLEAR OLD MESSAGES</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Remove messages older than 7 days</p>
                      </button>

                      <button
                        onClick={() => runDatabaseMaintenance('clear-aircraft', { olderThanHours: 24 })}
                        disabled={databaseLoading}
                        className="p-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center space-x-2">
                          <Server className="w-4 h-4" />
                          <span>CLEAR STALE AIRCRAFT</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Remove aircraft older than 24 hours</p>
                      </button>

                      <button
                        onClick={() => runDatabaseMaintenance('clear-hex-cache')}
                        disabled={databaseLoading}
                        className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center space-x-2">
                          <Server className="w-4 h-4" />
                          <span>CLEAR HEX CACHE</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Clear hex-to-registration cache</p>
                      </button>
                    </div>

                    <div className="pt-4 border-t border-spacex-gray">
                      <button
                        onClick={() => runDatabaseMaintenance('maintenance', { 
                          messageRetentionDays: 7, 
                          aircraftRetentionHours: 24,
                          photoRetentionDays: 30 
                        })}
                        disabled={databaseLoading}
                        className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <RefreshCw className="w-4 h-4" />
                          <span>RUN FULL MAINTENANCE</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">Complete database cleanup and optimization</p>
                      </button>
                    </div>

                    {/* DANGER ZONE */}
                    <div className="pt-6 border-t border-red-500">
                      <h3 className="text-red-400 font-mono text-lg mb-4">⚠️ DANGER ZONE</h3>
                      
                      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
                        <p className="text-red-300 font-mono text-sm mb-2">
                          ⚠️ WARNING: These operations will permanently delete data!
                        </p>
                        <p className="text-gray-400 font-mono text-xs">
                          This will clear all messages, aircraft tracks, photos, and cached data. 
                          This action cannot be undone.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          onClick={() => {
                            if (confirm('⚠️ DANGER: This will clear ALL MESSAGES from the database. This cannot be undone!\n\nAre you absolutely sure?')) {
                              runDatabaseMaintenance('clear-messages')
                            }
                          }}
                          disabled={databaseLoading}
                          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                        >
                          <div className="flex items-center space-x-2">
                            <Server className="w-4 h-4" />
                            <span>CLEAR ALL MESSAGES</span>
                          </div>
                          <p className="text-xs text-gray-300 mt-1">Delete all {databaseStats?.stats?.tables?.messages?.toLocaleString()} messages</p>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('⚠️ DANGER: This will clear ALL AIRCRAFT TRACKS from the database. This cannot be undone!\n\nAre you absolutely sure?')) {
                              runDatabaseMaintenance('clear-aircraft')
                            }
                          }}
                          disabled={databaseLoading}
                          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                        >
                          <div className="flex items-center space-x-2">
                            <Server className="w-4 h-4" />
                            <span>CLEAR ALL AIRCRAFT</span>
                          </div>
                          <p className="text-xs text-gray-300 mt-1">Delete all aircraft tracking data</p>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('⚠️ DANGER: This will clear ALL PHOTOS from the database. This cannot be undone!\n\nAre you absolutely sure?')) {
                              runDatabaseMaintenance('clear-photos')
                            }
                          }}
                          disabled={databaseLoading}
                          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                        >
                          <div className="flex items-center space-x-2">
                            <Server className="w-4 h-4" />
                            <span>CLEAR ALL PHOTOS</span>
                          </div>
                          <p className="text-xs text-gray-300 mt-1">Delete all {databaseStats?.stats?.photos?.total} aircraft photos</p>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('⚠️ DANGER: This will clear ALL TRANSCRIPTIONS from the database. This cannot be undone!\n\nAre you absolutely sure?')) {
                              runDatabaseMaintenance('clear-transcriptions')
                            }
                          }}
                          disabled={databaseLoading}
                          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50"
                        >
                          <div className="flex items-center space-x-2">
                            <Server className="w-4 h-4" />
                            <span>CLEAR TRANSCRIPTIONS</span>
                          </div>
                          <p className="text-xs text-gray-300 mt-1">Delete all ATC transcriptions</p>
                        </button>
                      </div>

                      <div className="mt-4 pt-4 border-t border-red-500">
                        <button
                          onClick={() => {
                            const confirmText = '⚠️ EXTREME DANGER: This will COMPLETELY WIPE the entire database!\n\nThis will delete:\n• All messages\n• All aircraft tracks\n• All photos\n• All transcriptions\n• All cached data\n• All settings\n\nThis action CANNOT be undone!\n\nType "DELETE EVERYTHING" to confirm:';
                            
                            const userInput = prompt(confirmText);
                            if (userInput === 'DELETE EVERYTHING') {
                              // Run multiple clear operations
                              Promise.all([
                                runDatabaseMaintenance('clear-messages'),
                                runDatabaseMaintenance('clear-aircraft'),
                                runDatabaseMaintenance('clear-photos'),
                                runDatabaseMaintenance('clear-transcriptions'),
                                runDatabaseMaintenance('clear-hex-cache'),
                                runDatabaseMaintenance('reset-statistics')
                              ]).then(() => {
                                alert('🗑️ Database completely cleared! All data has been deleted.');
                                loadDatabaseStats();
                              });
                            }
                          }}
                          disabled={databaseLoading}
                          className="w-full p-4 bg-red-800 hover:bg-red-900 text-white rounded-lg font-mono text-sm transition-colors disabled:opacity-50 border-2 border-red-600"
                        >
                          <div className="flex items-center justify-center space-x-2">
                            <Server className="w-4 h-4" />
                            <span>🗑️ CLEAR ENTIRE DATABASE</span>
                          </div>
                          <p className="text-xs text-red-300 mt-1">⚠️ PERMANENTLY DELETE ALL DATA ⚠️</p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* System Section */}
          {activeSection === 'system' && (
            <div className="data-card p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <Server className="w-6 h-6 text-yellow-400" />
                <span>SYSTEM Configuration</span>
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">
                    Database Retention: {settings.system?.database_retention_days || 7} days
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={settings.system?.database_retention_days || 7}
                    onChange={(e) => updateSetting('system', 'database_retention_days', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-mono mb-2">Log Level</label>
                  <select
                    value={settings.system?.log_level || 'info'}
                    onChange={(e) => updateSetting('system', 'log_level', e.target.value)}
                    className="w-full bg-spacex-darker border border-spacex-gray rounded px-3 py-2 text-white font-mono focus:border-spacex-accent outline-none"
                  >
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>

                <button
                  onClick={() => handleSave('system')}
                  disabled={loading}
                  className="mt-4 px-6 py-2 bg-spacex-blue hover:bg-spacex-blue-light text-white rounded-lg font-mono flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveStatus.system === 'saving' ? 'SAVING...' : saveStatus.system === 'saved' ? 'SAVED!' : 'SAVE CHANGES'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

