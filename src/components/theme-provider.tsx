'use client'

import { useEffect } from 'react'
import { useAppStore, getInitialPersistedTheme } from '@/lib/store'

/**
 * ThemeProvider:
 * 1. On mount, reads the persisted theme from localStorage (if any) and pushes
 *    it into the store. This runs AFTER React hydration so it does NOT cause a
 *    server/client mismatch — the store always starts with `theme: 'light'`
 *    on both server and client first-render, then the persisted value is
 *    applied here on the client only.
 * 2. Applies the `dark` class on <html> whenever `theme` changes.
 *
 * Mounted once near the root.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  // Sync persisted theme into the store after mount.
  useEffect(() => {
    const persisted = getInitialPersistedTheme()
    if (persisted !== theme) {
      setTheme(persisted)
    }
    // Only run once on mount — `theme` is intentionally read at mount time.
  }, [])

  // Apply the `dark` class on <html> whenever theme changes.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  return <>{children}</>
}
