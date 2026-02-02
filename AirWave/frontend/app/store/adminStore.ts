import { create } from 'zustand'

export interface AirframesSettings {
  api_key: string
  api_url: string
  ws_url: string
}

export interface Tar1090Settings {
  enabled: boolean
  url: string
  poll_interval: number
}

export interface WhisperSettings {
  server_url: string
  language: string
  model: string
  temperature: number
  beam_size: number
}

export interface AudioSettings {
  sample_rate: number
  chunk_duration: number
  vad_threshold: number
  vad_min_silence_duration: number
  vad_speech_pad: number
}

export interface SystemSettings {
  database_retention_days: number
  log_level: string
  enable_metrics: boolean
}

export interface ADSBExchangeSettings {
  api_key: string
  api_url: string
  default_lat: number
  default_lon: number
  default_dist: number
  poll_interval: number
}

export interface OpenSkySettings {
  default_lat: number
  default_lon: number
  default_radius: number
  poll_interval: number
}

export interface YoutubeSettings {
  api_key: string
  channel_handle: string
  stream_url: string
  feed_id: string
  auto_start: boolean
}

export interface AdminSettings {
  airframes?: AirframesSettings
  tar1090?: Tar1090Settings
  adsbexchange?: ADSBExchangeSettings
  opensky?: OpenSkySettings
  whisper?: WhisperSettings
  audio?: AudioSettings
  system?: SystemSettings
  youtube?: YoutubeSettings
}

export interface ServiceStatus {
  connected: boolean
  messageCount?: number
  url?: string
}

export interface ServiceStatuses {
  airframes: ServiceStatus
  tar1090: ServiceStatus
  adsbexchange?: ServiceStatus
  opensky?: ServiceStatus
  whisper: ServiceStatus
}

interface AdminStore {
  settings: AdminSettings
  serviceStatuses: ServiceStatuses
  loading: boolean
  error: string | null
  loadSettings: () => Promise<void>
  updateSetting: (category: string, key: string, value: any) => void
  saveSettings: (category: string) => Promise<boolean>
  refreshServiceStatus: () => Promise<void>
  startTar1090: (url: string, pollInterval: number) => Promise<boolean>
  stopTar1090: () => Promise<boolean>
  startADSBExchange: () => Promise<boolean>
  stopADSBExchange: () => Promise<boolean>
  startOpenSky: () => Promise<boolean>
  stopOpenSky: () => Promise<boolean>
  startAirframes: () => Promise<boolean>
  stopAirframes: () => Promise<boolean>
  testYoutubeApiKey: (apiKey: string) => Promise<boolean>
  validateChannelHandle: (handle: string) => Promise<{ valid: boolean, channelId?: string }>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'

export const useAdminStore = create<AdminStore>((set, get) => ({
  settings: {},
  serviceStatuses: {
    airframes: { connected: false },
    tar1090: { connected: false },
    whisper: { connected: false }
  },
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null })
    
    try {
      const response = await fetch(`${API_BASE}/admin/settings`)
      
      if (!response.ok) {
        throw new Error('Failed to load settings')
      }

      const data = await response.json()
      
      if (data.success) {
        set({ settings: data.settings, loading: false })
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      set({ error: (error as Error).message, loading: false })
    }
  },

  updateSetting: (category: string, key: string, value: any) => {
    const state = get()
    const newSettings = { ...state.settings }
    
    if (!newSettings[category]) {
      newSettings[category] = {}
    }
    
    newSettings[category][key] = value
    set({ settings: newSettings })
  },

  saveSettings: async (category: string) => {
    const state = get()
    const categorySettings = state.settings[category]
    
    if (!categorySettings) {
      return false
    }

    set({ loading: true, error: null })

    try {
      // Save each setting in the category
      for (const [key, value] of Object.entries(categorySettings)) {
        const response = await fetch(`${API_BASE}/admin/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ key, value, category })
        })

        if (!response.ok) {
          throw new Error(`Failed to save ${key}`)
        }
      }

      set({ loading: false })
      return true
    } catch (error) {
      console.error('Error saving settings:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  refreshServiceStatus: async () => {
    try {
      // Get health status (health is not under /api)
      const healthResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5773'}/health`)
      if (healthResponse.ok) {
        const health = await healthResponse.json()
        
        // Get TAR1090 status
        const tar1090Response = await fetch(`${API_BASE}/admin/tar1090/status`)
        const tar1090Data = tar1090Response.ok ? await tar1090Response.json() : null
        
        set({
          serviceStatuses: {
            airframes: {
              connected: health.airframes || false
            },
            tar1090: {
              connected: tar1090Data?.status?.connected || false,
              messageCount: tar1090Data?.status?.messageCount,
              url: tar1090Data?.status?.url
            },
            adsbexchange: {
              connected: health.adsbexchange || false
            },
            opensky: {
              connected: health.opensky || false
            },
            whisper: {
              connected: false // TODO: Add whisper status endpoint
            }
          }
        })
      }
    } catch (error) {
      console.error('Error refreshing service status:', error)
    }
  },

  startTar1090: async (url: string, pollInterval: number) => {
    set({ loading: true, error: null })

    try {
      console.log('Starting TAR1090 with:', { url, pollInterval })
      
      const response = await fetch(`${API_BASE}/admin/tar1090/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, pollInterval })
      })

      const data = await response.json()
      console.log('TAR1090 start response:', data)

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to start TAR1090')
      }
      
      // Wait a moment for initial connection attempt
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Refresh service status
      await get().refreshServiceStatus()
      
      set({ loading: false })
      return data.success
    } catch (error) {
      console.error('Error starting TAR1090:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  stopTar1090: async () => {
    set({ loading: true, error: null })

    try {
      const response = await fetch(`${API_BASE}/admin/tar1090/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to stop TAR1090')
      }

      const data = await response.json()
      
      // Refresh service status
      await get().refreshServiceStatus()
      
      set({ loading: false })
      return data.success
    } catch (error) {
      console.error('Error stopping TAR1090:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  startADSBExchange: async () => {
    set({ loading: true, error: null })

    try {
      const state = get()
      const adsbexSettings = state.settings.adsbexchange
      
      console.log('Starting ADS-B Exchange with settings:', adsbexSettings)
      
      // Pass current settings to backend
      const response = await fetch(`${API_BASE}/admin/adsbexchange/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: adsbexSettings?.api_key,
          pollInterval: adsbexSettings?.poll_interval,
          lat: adsbexSettings?.default_lat,
          lon: adsbexSettings?.default_lon,
          dist: adsbexSettings?.default_dist
        })
      })

      const data = await response.json()
      console.log('ADS-B Exchange start response:', data)

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to start ADS-B Exchange')
      }
      
      // Wait a moment for initial connection attempt
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Refresh service status
      await get().refreshServiceStatus()
      
      set({ loading: false })
      return data.success
    } catch (error) {
      console.error('Error starting ADS-B Exchange:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  stopADSBExchange: async () => {
    set({ loading: true, error: null })

    try {
      const response = await fetch(`${API_BASE}/admin/adsbexchange/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to stop ADS-B Exchange')
      }

      const data = await response.json()
      
      // Refresh service status
      await get().refreshServiceStatus()
      
      set({ loading: false })
      return data.success
    } catch (error) {
      console.error('Error stopping ADS-B Exchange:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  startOpenSky: async () => {
    set({ loading: true, error: null })

    try {
      const state = get()
      const openskySettings = state.settings.opensky
      
      console.log('Starting OpenSky Network with settings:', openskySettings)
      
      // Pass current settings to backend
      const response = await fetch(`${API_BASE}/admin/opensky/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pollInterval: openskySettings?.poll_interval,
          lat: openskySettings?.default_lat,
          lon: openskySettings?.default_lon,
          radius: openskySettings?.default_radius
        })
      })

      const data = await response.json()
      console.log('OpenSky Network start response:', data)

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to start OpenSky Network')
      }
      
      // Wait a moment for initial connection attempt
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Refresh service status
      await get().refreshServiceStatus()
      
      set({ loading: false })
      return data.success
    } catch (error) {
      console.error('Error starting OpenSky Network:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  stopOpenSky: async () => {
    set({ loading: true, error: null })

    try {
      const response = await fetch(`${API_BASE}/admin/opensky/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to stop OpenSky Network')
      }

      const data = await response.json()
      
      // Refresh service status
      await get().refreshServiceStatus()
      
      set({ loading: false })
      return data.success
    } catch (error) {
      console.error('Error stopping OpenSky Network:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  startAirframes: async () => {
    set({ loading: true, error: null })
    try {
      const state = get()
      const airframesSettings = state.settings.airframes
      
      console.log('Starting Airframes with settings:', airframesSettings)
      
      const response = await fetch(`${API_BASE}/admin/airframes/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: airframesSettings?.api_key,
          apiUrl: airframesSettings?.api_url,
          wsUrl: airframesSettings?.ws_url
        })
      })

      const data = await response.json()
      console.log('Airframes start response:', data)

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to start Airframes')
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      await get().refreshServiceStatus()
      
      set({ loading: false })
      return data.success
    } catch (error) {
      console.error('Error starting Airframes:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  stopAirframes: async () => {
    set({ loading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/admin/airframes/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to stop Airframes')
      }

      const data = await response.json()
      await get().refreshServiceStatus()
      
      set({ loading: false })
      return data.success
    } catch (error) {
      console.error('Error stopping Airframes:', error)
      set({ error: (error as Error).message, loading: false })
      return false
    }
  },

  testYoutubeApiKey: async (apiKey: string) => {
    try {
      const response = await fetch(`${API_BASE}/youtube/test-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey })
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      return data.success && data.valid
    } catch (error) {
      console.error('Error testing YouTube API key:', error)
      return false
    }
  },

  validateChannelHandle: async (handle: string) => {
    try {
      const response = await fetch(`${API_BASE}/youtube/channel-info?handle=${encodeURIComponent(handle)}`)

      if (!response.ok) {
        return { valid: false }
      }

      const data = await response.json()
      
      if (data.success && data.channelId) {
        return {
          valid: true,
          channelId: data.channelId
        }
      }
      
      return { valid: false }
    } catch (error) {
      console.error('Error validating channel handle:', error)
      return { valid: false }
    }
  },
}))

