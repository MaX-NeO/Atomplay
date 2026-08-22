'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { LogOut, Search, UserCog, Users } from 'lucide-react'
import { colorForParticipantById, getParticipantIconById } from '@/lib/participant-icons'

// A joined participant rendered as a row card in the sheet (and as a floating
// bubble on the lobby stage). This shape is shared between the host lobby
// bubble stage and the participants sheet so both views stay in sync — the
// parent (live-presentation-screen) owns the list, this sheet is a controlled
// component that just renders + emits kick events.
export interface ParticipantRow {
  id: string
  displayName: string
  uoid: string | null
  joinedAt?: string
}

interface ParticipantsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activityId: string | null | undefined
  // The authoritative participant list, owned by the parent screen so the
  // lobby bubble stage + this sheet always show the same people.
  participants: ParticipantRow[]
  // Called whenever the sheet's REST fetch (on open) returns a fresher list
  // — the parent uses this to resync its bubble list, which fixes the bug
  // where a joined user showed in the sheet but not on the lobby stage.
  onParticipantsChange?: (participants: ParticipantRow[]) => void
  // Live participant count (owned by the parent screen so it stays in sync
  // across the lobby bubble stage + the count button on the header).
  count: number
  onCountChange?: (count: number) => void
}

/**
 * ParticipantsSheet — a 20%-width right-side sheet listing everyone who joined
 * the activity. Used by the host (admin) throughout the entire activity
 * lifecycle (lobby, ready, question, reveal) — i.e. before results.
 *
 * This is a CONTROLLED component: the participant list lives in the parent
 * (live-presentation-screen) so the lobby bubble stage and this sheet always
 * render the exact same data. When the sheet opens it does a REST fetch to
 * re-sync the list (catching participants that joined while the host's socket
 * was disconnected), and propagates the result up via `onParticipantsChange`.
 *
 * Each participant is rendered as a card row: name + roll number (UOID) on the
 * left, a "Kick" button on the right. A search input at the top filters by
 * name or UOID.
 *
 * Kick is emitted via socket (`kick_participant`); the mini-service deletes the
 * participant + broadcasts `participant_kicked` to the room, which the parent
 * listens for and removes them from the shared list.
 */
export function ParticipantsSheet({
  open,
  onOpenChange,
  activityId,
  participants,
  onParticipantsChange,
  count,
  onCountChange,
}: ParticipantsSheetProps) {
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [kickingId, setKickingId] = useState<string | null>(null)

  // -------- REST: resync the shared participant list when the sheet opens.
  // This is the single source of truth for late-syncing: if the host's socket
  // missed any `participant_joined` events (e.g. transient disconnect), the
  // list will still be correct after the sheet is opened once. The result is
  // propagated up to the parent so the lobby bubble stage updates too. --------
  useEffect(() => {
    if (!open || !activityId) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setLoading(true)
    })
    api
      .get<{ participants: ParticipantRow[] }>(
        `/api/activities/${activityId}/participants`,
      )
      .then((res) => {
        if (cancelled) return
        onParticipantsChange?.(res.participants)
        onCountChange?.(res.participants.length)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err instanceof ApiError ? err.message : 'Failed to load participants'
        toast.error(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Only refetch when the sheet transitions from closed -> open. We
    // intentionally do NOT include `onParticipantsChange` / `onCountChange`
    // (ref-stable callbacks in practice) so re-renders don't trigger a refetch.
  }, [open, activityId])

  // Kick is a side-effect (socket emit); the parent's `participant_kicked`
  // listener will remove the row from the shared list. We just optimistically
  // disable the button until the parent's state updates.
  const handleKick = useCallback(
    (p: ParticipantRow) => {
      if (!activityId || !p.id) return
      setKickingId(p.id)
      try {
        const socket = getSocket()
        socket.emit('kick_participant', {
          activityId,
          participantId: p.id,
        })
        toast.success(`Removed ${p.displayName}`)
      } catch {
        toast.error('Could not remove participant')
      } finally {
        // The parent's `participant_kicked` listener will update the list;
        // we just clear the local "kicking" spinner state.
        setTimeout(() => setKickingId(null), 600)
      }
    },
    [activityId],
  )

  // -------- Filter --------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return participants
    return participants.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        (p.uoid ?? '').toLowerCase().includes(q),
    )
  }, [participants, query])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-1/5 min-w-[280px] max-w-[420px] gap-0 border-l border-white/10 bg-black/60 p-0 text-white backdrop-blur-xl sm:max-w-[420px]"
      >
        <SheetHeader className="border-b border-white/10 bg-white/5 px-4 py-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <UserCog className="h-4 w-4 text-primary" />
            Participants
            <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
              <Users className="h-3 w-3" />
              {count}
            </span>
          </SheetTitle>
          <SheetDescription className="text-white/60">
            Search, review, and remove participants.
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="border-b border-white/10 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or roll number…"
              className="h-9 border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/40 focus-visible:border-primary/60 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 p-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                  <Skeleton className="h-7 w-14 rounded-md" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-white/60">
                <Users className="h-8 w-8 text-white/30" />
                {query
                  ? 'No participants match your search.'
                  : 'No participants have joined yet.'}
              </div>
            ) : (
              filtered.map((p) => {
                // Use STABLE ID-based icon + color so the sheet matches the
                // lobby bubble stage + leaderboard exactly.
                const Icon = getParticipantIconById(p.id)
                const color = colorForParticipantById(p.id, p.displayName)
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
                  >
                    {/* Left: avatar (unique Lucide icon + SAME color as the lobby bubble) */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        background: color.soft,
                        color: color.text,
                        borderColor: color.border,
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: color.text }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight text-white">
                        {p.displayName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-white/60">
                        Roll No:{' '}
                        <span className="font-mono text-white/80">
                          {p.uoid ?? '—'}
                        </span>
                      </p>
                    </div>
                    {/* Right: kick button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleKick(p)}
                      disabled={kickingId === p.id}
                      className="h-8 shrink-0 gap-1 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${p.displayName}`}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Kick
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
