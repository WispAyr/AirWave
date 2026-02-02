import { create } from 'zustand'

export interface ATCFeed {
  id: string
  icao: string
  name: string
  airport: string
  type: string
  frequency: string
  mount: string
  region: string
  country: string
}

interface AudioStore {
  feeds: ATCFeed[]
  selectedFeed: ATCFeed | null
  isPlaying: boolean
  isLoading: boolean
  volume: number
  streamUrl: string | null
  favoriteFeeds: string[]
  error: string | null
  loadFeeds: () => Promise<void>
  selectFeed: (feed: ATCFeed | null) => void
  play: () => void
  pause: () => void
  setVolume: (volume: number) => void
  setStreamUrl: (url: string | null) => void
  toggleFavorite: (feedId: string) => Promise<void>
  loadPreferences: () => Promise<void>
  savePreferences: () => Promise<void>
  setError: (error: string | null) => void
  setIsLoading: (loading: boolean) => void
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  feeds: [],
  selectedFeed: null,
  isPlaying: false,
  isLoading: false,
  volume: 0.7,
  streamUrl: null,
  favoriteFeeds: [],
  error: null,

  loadFeeds: async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/atc-feeds`)
      const data = await response.json()
      set({ feeds: data.feeds || [] })
    } catch (error) {
      console.error('Error loading feeds:', error)
      set({ error: 'Failed to load ATC feeds' })
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
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/atc-preferences/favorites/${feedId}`, {
          method: 'DELETE'
        })
        set({ favoriteFeeds: state.favoriteFeeds.filter(id => id !== feedId) })
      } else {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/atc-preferences/favorites/${feedId}`, {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/atc-preferences`)
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
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5773/api'}/atc-preferences`, {
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

  setIsLoading: (loading) => set({ isLoading: loading })
}))

