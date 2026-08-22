'use client'

/**
 * ThemeToggle — DISABLED.
 *
 * The app is DARK-ONLY by design (see src/components/theme-provider.tsx +
 * src/app/layout.tsx). The toggle button used to flip between light and dark
 * mode, but since the app now forces dark everywhere, there's nothing to
 * toggle. This component renders `null` so every existing call site
 * (app-header, landing, admin-login, admin-dashboard, admin-management,
 * final-results) keeps working without any edits — the button simply
 * disappears from those screens.
 *
 * Kept as a no-op export rather than deleted so the import sites don't have to
 * be touched; if you want to remove the call sites entirely, grep for
 * `<ThemeToggle` and delete each usage.
 */
export function ThemeToggle(_props?: { className?: string; iconClassName?: string }) {
  return null
}
