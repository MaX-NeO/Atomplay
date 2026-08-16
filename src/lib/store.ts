'use client'

import { create } from 'zustand'
import type {
  AdminDTO,
  ActivityDTO,
} from '@/lib/types'

// All client-side screens. The single visible route `/` reads `screen` and renders.
export type Screen =
  | 'landing'
  // admin
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-editor'      // params: { activityId }
  | 'admin-present'     // params: { activityId }
  | 'admin-results'     // params: { activityId }
  | 'admin-admins'
  // participant
  | 'participant-join'
  | 'participant-lobby'    // params: { activityId, sessionId, title, displayName, uoid }
  | 'participant-question'
  | 'participant-completed'

export interface ParticipantSession {
  sessionId: string
  activityId: string
  title: string
  displayName: string
  uoid: string | null
  accessCode: string
}

interface AppState {
  screen: Screen
  params: Record<string, string>
  admin: AdminDTO | null
  participant: ParticipantSession | null
  theme: 'light' | 'dark'

  navigate: (screen: Screen, params?: Record<string, string>) => void
  setAdmin: (a: AdminDTO | null) => void
  setParticipant: (p: ParticipantSession | null) => void
  toggleTheme: () => void
  setTheme: (t: 'light' | 'dark') => void
}

const STORAGE_KEY = 'quiz-app-state'

function readPersistedTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return 'light'
    const parsed = JSON.parse(raw)
    return parsed.theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const useAppStore = create<AppState>((set, get) => {
  // IMPORTANT: do NOT read localStorage during store initialization.
  // SSR renders with `theme: 'light'`; if we read localStorage here the client
  // first-render could start with 'dark', producing a hydration mismatch in any
  // component that branches on `theme` (e.g. <Sun/> vs <Moon/> icons).
  // The ThemeProvider is responsible for syncing the persisted value into the
  // store AFTER mount (see src/components/theme-provider.tsx).
  return {
    screen: 'landing',
    params: {},
    admin: null,
    participant: null,
    theme: 'light',

    navigate: (screen, params = {}) => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      }
      set({ screen, params })
    },
    setAdmin: (admin) => set({ admin }),
    setParticipant: (participant) => set({ participant }),
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark'
      set({ theme: next })
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: next }))
        } catch {
          /* ignore */
        }
      }
    },
    setTheme: (t) => {
      set({ theme: t })
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: t }))
        } catch {
          /* ignore */
        }
      }
    },
  }
})

// Read the persisted theme from localStorage. Called by ThemeProvider after mount.
export function getInitialPersistedTheme(): 'light' | 'dark' {
  return readPersistedTheme()
}

// ---- Convenience hook: the currently selected activity (for editor/presentation) ----
// Components fetch the activity themselves; this is just a typed accessor for params.
export function useParams<T extends Record<string, string>>(): T {
  return useAppStore((s) => s.params) as T
}

export type { ActivityDTO }
