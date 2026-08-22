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
          <span className="text-muted-foreground/70">·</span>
          <span>Live interactive quizzes</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span>Real-time MCQ presentation platform</span>
        </div>
      </div>
    </footer>
  )
}
