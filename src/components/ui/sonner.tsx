"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

// The app is DARK-ONLY by design (see src/components/theme-provider.tsx), so we
// hard-code the Sonner toaster to `theme="dark"` and drop the `next-themes`
// dependency that the original shadcn/ui scaffolding wired up (it was reading
// `useTheme()` from a NextThemesProvider that was never actually mounted, so the
// toaster was following the OS preference instead of the app theme).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
