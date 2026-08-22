'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Medal, Award } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/types'
import { colorForParticipant, getParticipantIcon } from '@/lib/participant-icons'

interface LeaderboardChartProps {
  entries: LeaderboardEntry[]
  /** Previous entries for animation (show old positions then animate to new). If provided, the chart first renders the old state then animates. */
  previousEntries?: LeaderboardEntry[]
  /** Show the score calculation breakdown tooltip */
  showScoreBreakdown?: boolean
}

const RANK_ICONS = [
  Crown,   // 1st
  Medal,   // 2nd
  Award,   // 3rd
]

const RANK_COLORS = [
  'text-amber-400',     // gold
  'text-gray-300',      // silver
  'text-orange-400',    // bronze
]

export function LeaderboardChart({ entries, previousEntries, showScoreBreakdown }: LeaderboardChartProps) {
  // Sort entries by score descending (they should already be sorted, but ensure)
  const sorted = [...entries].sort((a, b) => b.totalScore - a.totalScore || a.displayName.localeCompare(b.displayName))
  const maxScore = Math.max(1, ...sorted.map((e) => e.totalScore))

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {sorted.map((entry, index) => {
          const rank = index + 1
          const pct = (entry.totalScore / maxScore) * 100
          const color = colorForParticipant(entry.displayName, index)
          const Icon = getParticipantIcon(index)
          const RankIcon = rank <= 3 ? RANK_ICONS[rank - 1] : null
          const rankColor = rank <= 3 ? RANK_COLORS[rank - 1] : 'text-muted-foreground'

          return (
            <motion.div
              key={entry.participantId}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative flex items-center gap-3"
            >
              {/* Rank number / icon */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center font-bold ${rankColor}`}>
                {RankIcon ? <RankIcon className="h-6 w-6" /> : (
                  <span className="text-lg tabular-nums">{rank}</span>
                )}
              </div>

              {/* Bar + user info */}
              <div className="flex-1 min-w-0">
                {/* Row 1: bar with icon + name (no score on the bar itself) */}
                <div className="relative h-14 overflow-hidden border border-white/10 bg-white/5">
                  {/* Score bar fill — sits behind everything, left-aligned */}
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{ background: color.soft }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
                  />

                  {/* Content layer — sits ON TOP of the fill, never overlapped */}
                  <div className="relative flex h-full items-center gap-3 px-3">
                    {/* User icon — pinned to the left, always visible */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center border-2"
                      style={{
                        borderColor: color.border,
                        background: color.soft,
                        color: color.text,
                      }}
                    >
                      <Icon className="h-4 w-4" style={{ color: color.text }} />
                    </div>

                    {/* Name + uoid — flexible, truncates if needed */}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {entry.displayName}
                      {entry.uoid && (
                        <span className="ml-2 text-xs text-white/60">
                          · {entry.uoid}
                        </span>
                      )}
                    </span>

                    {/* Score — pinned to the right, always visible, never overlapped */}
                    <span className="shrink-0 text-base font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {entry.totalScore.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Stats below bar */}
                <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{entry.correctAnswers} correct</span>
                  <span>·</span>
                  <span>{entry.answeredQuestions} answered</span>
                  {showScoreBreakdown && entry.totalScore > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-primary/70">
                        ~{Math.round(entry.totalScore / Math.max(1, entry.correctAnswers)).toLocaleString()} pts/answer
                      </span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {sorted.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No participants yet. Leaderboard will populate as players join and answer.
        </div>
      )}
    </div>
  )
}
