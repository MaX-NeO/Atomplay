'use client'

import { useSyncExternalStore } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

interface ThemeToggleProps {
  /** Tailwind size class for the icon (default: 'h-5 w-5'). */
  iconClassName?: string
  /** Button size variant (default: 'icon'). */
  size?: 'icon' | 'sm' | 'default' | 'lg'
  /** Extra classes for the button. */
  className?: string
}

/**
 * Theme toggle button.
 *
 * Uses `useSyncExternalStore` to detect mount state and only swaps the icon
 * AFTER hydration — this avoids the classic SSR/CSR mismatch where the server
 * renders <Moon/> (because the store initializes with `theme: 'light'`) but the
 * client first-render tries to render <Sun/> (because the persisted theme is
 * `dark`).
 *
 * Until mount, we render a placeholder button with the light-mode icon so the
 * layout is stable and the server/client markup match.
 */
export function ThemeToggle({
  iconClassName = 'h-5 w-5',
  size = 'icon',
  className,
}: ThemeToggleProps) {
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  // false on the server and during the first client render, then true.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true, // client snapshot
    () => false, // server snapshot
  )

  const isDark = mounted && theme === 'dark'

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={className}
      suppressHydrationWarning
    >
      {isDark ? <Sun className={iconClassName} /> : <Moon className={iconClassName} />}
    </Button>
  )
}
