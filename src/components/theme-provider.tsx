'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

/**
 * ThemeProvider:
 * The app is DARK-ONLY by design. On mount we force `theme: 'dark'` into the
 * store — overriding any previously-persisted `light` preference — and write
 * that back to localStorage so the persisted state stays consistent. A separate
 * effect keeps the `dark` class on <html> in sync with the store (defensive —
 * the inline script in layout.tsx already adds it before hydration).
 *
 * Mounted once near the root.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  // Force dark on mount. This migrates any user who previously persisted a
  // light preference (back when the toggle existed) and ensures the store is
  // always in dark mode regardless of what's in localStorage.
  useEffect(() => {
    if (theme !== 'dark') {
      setTheme('dark')
    }
    // Only run once on mount — `theme` is intentionally read at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply the `dark` class on <html> whenever theme changes.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  return <>{children}</>
}
