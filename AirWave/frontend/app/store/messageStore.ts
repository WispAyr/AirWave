import { create } from 'zustand'
import { ACARSMessage } from '../types'

interface MessageStore {
  messages: ACARSMessage[]
  maxMessages: number
  addMessage: (message: ACARSMessage) => void
  setMessages: (messages: ACARSMessage[]) => void
  clearMessages: () => void
  getStats: () => {
    total: number
    byCategory: Record<string, number>
    byAirline: Record<string, number>
    byPhase: Record<string, number>
    bySourceType: Record<string, number>
  }
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: [],
  maxMessages: 2000, // Limit to 2000 messages for better performance
  
  addMessage: (message) => {
    const state = get()
    // Check if message already exists (avoid duplicates)
    const exists = state.messages.some(m => m.id === message.id)
    if (exists) return
    
    set({
      messages: [message, ...state.messages].slice(0, state.maxMessages)
    })
  },
  
  setMessages: (messages) => set({ messages: messages.slice(0, get().maxMessages) }),
  
  clearMessages: () => set({ messages: [] }),
  
  getStats: () => {
    const messages = get().messages
    const stats = {
      total: messages.length,
      byCategory: {} as Record<string, number>,
      byAirline: {} as Record<string, number>,
      byPhase: {} as Record<string, number>,
      bySourceType: {} as Record<string, number>,
    }

    messages.forEach((msg) => {
      // By category
      if (msg.category) {
        stats.byCategory[msg.category] = (stats.byCategory[msg.category] || 0) + 1
      }
      
      // By airline
      if (msg.airline) {
        stats.byAirline[msg.airline] = (stats.byAirline[msg.airline] || 0) + 1
      }
      
      // By flight phase
      if (msg.flight_phase) {
        stats.byPhase[msg.flight_phase] = (stats.byPhase[msg.flight_phase] || 0) + 1
      }

      // By source type
      const sourceType = msg.source_type || 'acars'
      stats.bySourceType[sourceType] = (stats.bySourceType[sourceType] || 0) + 1
    })

    return stats
  },
}))

