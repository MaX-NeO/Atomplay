// Shared leaderboard computation helpers.
//
// Used by:
//   - GET /api/activities/[id]/leaderboard (REST endpoint for full leaderboard)
//   - GET /api/activities/[id]/state       (current leaderboard snapshot for participants)
//
// The socket service (mini-services/quiz-realtime) has its own parallel
// implementation because it ships as a separate process with its own Prisma
// client — see computeLeaderboardEntries() in that service's index.ts.

import { db } from '@/lib/db'
import type { LeaderboardEntry } from '@/lib/types'

/**
 * Compute the leaderboard entries for an activity.
 *
 * For each participant:
 *   - totalScore: sum of their answer.score values
 *   - correctAnswers: count of answers with isCorrect === true
 *   - answeredQuestions: total answers they've submitted
 *
 * Participants with zero answers still appear (with score 0).
 *
 * Entries are sorted by totalScore descending and assigned a 1-based rank.
 *
 * @param activityId    the activity to compute for
 * @param upToQuestionOrder  if provided, only count answers for questions with
 *                           questionOrder <= this value (intermediate leaderboard)
 */
export async function computeLeaderboardEntries(
  activityId: string,
  upToQuestionOrder?: number,
): Promise<LeaderboardEntry[]> {
  // Pull all participants for the activity — even those with zero answers
  // must appear on the leaderboard.
  const participants = await db.participant.findMany({
    where: { activityId },
    select: { id: true, displayName: true, uoid: true },
  })

  // Pull all relevant answers (with their question's questionOrder so we can
  // filter for intermediate leaderboards).
  const answers = await db.answer.findMany({
    where: {
      activityId,
      ...(upToQuestionOrder !== undefined
        ? { question: { questionOrder: { lte: upToQuestionOrder } } }
        : {}),
    },
    select: {
      participantId: true,
      score: true,
      isCorrect: true,
    },
  })

  // Aggregate per participant.
  const agg = new Map<
    string,
    { totalScore: number; correctAnswers: number; answeredQuestions: number }
  >()
  for (const a of answers) {
    const cur = agg.get(a.participantId) ?? {
      totalScore: 0,
      correctAnswers: 0,
      answeredQuestions: 0,
    }
    cur.totalScore += a.score
    if (a.isCorrect) cur.correctAnswers++
    cur.answeredQuestions++
    agg.set(a.participantId, cur)
  }

  const entries: LeaderboardEntry[] = participants.map((p) => {
    const stats = agg.get(p.id) ?? {
      totalScore: 0,
      correctAnswers: 0,
      answeredQuestions: 0,
    }
    return {
      participantId: p.id,
      displayName: p.displayName,
      uoid: p.uoid,
      totalScore: stats.totalScore,
      correctAnswers: stats.correctAnswers,
      answeredQuestions: stats.answeredQuestions,
      rank: 0, // assigned after sorting
    }
  })

  // Sort by totalScore desc. Ties broken (stable) by displayName asc so the
  // ordering is deterministic.
  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    return a.displayName.localeCompare(b.displayName)
  })

  // Assign ranks (1-based). Tied scores share the same numeric rank; the next
  // distinct score gets the rank equal to its 1-based position (standard
  // "competition" ranking — 1, 2, 2, 4).
  let lastScore: number | null = null
  let rank = 0
  entries.forEach((e, idx) => {
    if (lastScore === null || e.totalScore !== lastScore) {
      rank = idx + 1
      lastScore = e.totalScore
    }
    e.rank = rank
  })

  return entries
}
