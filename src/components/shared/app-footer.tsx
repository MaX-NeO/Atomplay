'use client'

import { Sparkles } from 'lucide-react'

interface AppFooterProps {
  /** compact variant for immersive screens */
  compact?: boolean
}

export function AppFooter({ compact }: AppFooterProps) {
  if (compact) {
    return (
      <footer className="mt-auto glass-bar py-3 text-center text-xs text-muted-foreground">
        Atom Play · Live quiz platform
      </footer>
    )
  }
  return (
    <footer className="mt-auto glass-bar backdrop-blur-md backdrop-saturate-150">
      <div className="flex w-full flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-8 lg:px-12 xl:px-16">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center bg-primary/15 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="font-medium text-foreground">Atom Play</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className='text-blue-600'>ATOM LABS</span> & <span className='text-purple-600'>ATOM CODE</span>
        </div>
      </div>
    </footer>
  )
}
