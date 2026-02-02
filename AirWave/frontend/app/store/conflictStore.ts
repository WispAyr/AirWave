import { create } from 'zustand'
import { AircraftConflict } from '../types'

interface ConflictStore {
  activeConflicts: AircraftConflict[]
  conflictHistory: AircraftConflict[]
  addConflict: (conflict: AircraftConflict) => void
  updateConflict: (conflict: AircraftConflict) => void
  resolveConflict: (conflictId: string) => void
  clearConflicts: () => void
  getConflictById: (id: string) => AircraftConflict | undefined
}

export const useConflictStore = create<ConflictStore>((set, get) => ({
  activeConflicts: [],
  conflictHistory: [],
  
  addConflict: (conflict) => {
    const state = get()
    // Check if conflict already exists
    const exists = state.activeConflicts.some(c => c.id === conflict.id)
    if (exists) {
      // Update existing conflict instead
      get().updateConflict(conflict)
      return
    }
    
    set({
      activeConflicts: [...state.activeConflicts, conflict]
    })
  },
  
  updateConflict: (conflict) => {
    set((state) => ({
      activeConflicts: state.activeConflicts.map(c => 
        c.id === conflict.id ? { ...c, ...conflict } : c
      )
    }))
  },
  
  resolveConflict: (conflictId) => {
    const state = get()
    const conflict = state.activeConflicts.find(c => c.id === conflictId)
    
    if (conflict) {
      const resolvedConflict = {
        ...conflict,
        status: 'resolved' as const,
        resolved_at: new Date().toISOString()
      }
      
      set({
        activeConflicts: state.activeConflicts.filter(c => c.id !== conflictId),
        conflictHistory: [resolvedConflict, ...state.conflictHistory].slice(0, 100) // Keep last 100
      })
    }
  },
  
  clearConflicts: () => set({ activeConflicts: [], conflictHistory: [] }),
  
  getConflictById: (id) => {
    const state = get()
    return state.activeConflicts.find(c => c.id === id) || 
           state.conflictHistory.find(c => c.id === id)
  },
}))



