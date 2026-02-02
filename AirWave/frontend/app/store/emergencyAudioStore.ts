import { create } from 'zustand'

export interface EmergencyFeed {
  id: string
  name: string
  description: string
  state: string
  stateCode: string
  county: string
  type: 'police' | 'fire' | 'ems' | 'multi'
  feedId: number
  listeners: number
  status: 'online' | 'offline'
  coordinates: { lat: number; lon: number }
  streamUrl?: string
}

interface EmergencyAudioStore {
  feeds: EmergencyFeed[]
  selectedFeed: EmergencyFeed | null
  isPlaying: boolean
  isLoading: boolean
  volume: number
  streamUrl: string | null
  favoriteFeeds: string[]
  error: string | null
  filterState: string | null
  filterCounty: string | null
  filterType: string | null
  loadFeeds: () => Promise<void>
  selectFeed: (feed: EmergencyFeed | null) => void
  play: () => void
  pause: () => void
  setVolume: (volume: number) => void
  setStreamUrl: (url: string | null) => void
  toggleFavorite: (feedId: string) => Promise<void>
  loadPreferences: () => Promise<void>
  savePreferences: () => Promise<void>
  setError: (error: string | null) => void
  setIsLoading: (loading: boolean) => void
  setFilterState: (state: string | null) => void
  setFilterCounty: (county: string | null) => void
  setFilterType: (type: string | null) => void
  getFilteredFeeds: () => EmergencyFeed[]
  getStates: () => Array<{ stateCode: string; state: string; count: number }>
  getCountiesByState: (stateCode: string) => Array<{ county: string; count: number }>
}

export const useEmergencyAudioStore = create<EmergencyAudioStore>((set, get) => ({
  feeds: [],
  selectedFeed: null,
  isPlaying: false,
  isLoading: false,
  volume: 0.7,
  streamUrl: null,
  favoriteFeeds: [],
  error: null,
  filterState: null,
  filterCounty: null,
  filterType: null,

  loadFeeds: async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/emergency/feeds`)
      const data = await response.json()
      set({ feeds: data.feeds || [] })
    } catch (error) {
      console.error('Error loading emergency feeds:', error)
      set({ error: 'Failed to load emergency scanner feeds' })
    }
  },

  selectFeed: (feed) => {
    set({ 
      selectedFeed: feed, 
      streamUrl: null,
      error: null,
      isPlaying: false 
    })
  },

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  setVolume: (volume) => {
    set({ volume })
    get().savePreferences()
  },

  setStreamUrl: (url) => set({ streamUrl: url }),

  toggleFavorite: async (feedId) => {
    const state = get()
    const isFavorite = state.favoriteFeeds.includes(feedId)
    
    try {
      if (isFavorite) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/emergency/preferences/favorites/${feedId}`, {
          method: 'DELETE'
        })
        set({ favoriteFeeds: state.favoriteFeeds.filter(id => id !== feedId) })
      } else {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/emergency/preferences/favorites/${feedId}`, {
          method: 'POST'
        })
        set({ favoriteFeeds: [...state.favoriteFeeds, feedId] })
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  },

  loadPreferences: async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/emergency/preferences`)
      const data = await response.json()
      
      const state = get()
      set({
        volume: data.volume || 0.7,
        favoriteFeeds: data.favoriteFeeds || []
      })

      // Restore last selected feed if available
      if (data.lastFeedId && state.feeds.length > 0) {
        const lastFeed = state.feeds.find(f => f.id === data.lastFeedId)
        if (lastFeed) {
          set({ selectedFeed: lastFeed })
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    }
  },

  savePreferences: async () => {
    const state = get()
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/emergency/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastFeedId: state.selectedFeed?.id || null,
          volume: state.volume,
          autoPlay: false,
          favoriteFeeds: state.favoriteFeeds
        })
      })
    } catch (error) {
      console.error('Error saving preferences:', error)
    }
  },

  setError: (error) => set({ error }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setFilterState: (state) => set({ filterState: state, filterCounty: null }),

  setFilterCounty: (county) => set({ filterCounty: county }),

  setFilterType: (type) => set({ filterType: type }),

  getFilteredFeeds: () => {
    const state = get()
    let filtered = state.feeds

    if (state.filterState) {
      filtered = filtered.filter(f => f.stateCode === state.filterState)
    }

    if (state.filterCounty) {
      filtered = filtered.filter(f => f.county === state.filterCounty)
    }

    if (state.filterType) {
      filtered = filtered.filter(f => f.type === state.filterType)
    }

    return filtered
  },

  getStates: () => {
    const state = get()
    const stateMap = new Map<string, { stateCode: string; state: string; count: number }>()
    
    state.feeds.forEach(feed => {
      const existing = stateMap.get(feed.stateCode) || { 
        stateCode: feed.stateCode, 
        state: feed.state, 
        count: 0 
      }
      existing.count++
      stateMap.set(feed.stateCode, existing)
    })

    return Array.from(stateMap.values()).sort((a, b) => 
      a.state.localeCompare(b.state)
    )
  },

  getCountiesByState: (stateCode) => {
    const state = get()
    const countyMap = new Map<string, { county: string; count: number }>()
    const stateFeeds = state.feeds.filter(f => f.stateCode === stateCode)
    
    stateFeeds.forEach(feed => {
      const existing = countyMap.get(feed.county) || { 
        county: feed.county, 
        count: 0 
      }
      existing.count++
      countyMap.set(feed.county, existing)
    })

    return Array.from(countyMap.values()).sort((a, b) => 
      a.county.localeCompare(b.county)
    )
  }
}))


