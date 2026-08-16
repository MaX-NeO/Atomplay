'use client'

import { useEffect, useState } from 'react'

/**
 * Computes remaining seconds from a server-provided deadline (ISO string).
 * Re-renders every 500ms while the deadline is active. The server is the
 * source of truth (PRD §29); this hook only renders the visual countdown.
 */
function computeRemaining(endsAtIso: string | null | undefined): number {
  if (!endsAtIso) return 0
  const ends = new Date(endsAtIso).getTime()
  const now = Date.now()
  return Math.max(0, Math.ceil((ends - now) / 1000))
}

export function useCountdown(endsAtIso: string | null | undefined): number {
  // A tick state forces re-renders so the computed remaining stays fresh.
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!endsAtIso) return
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [endsAtIso])

  return computeRemaining(endsAtIso)
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
