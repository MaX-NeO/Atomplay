import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { computeLeaderboardEntries } from '@/lib/leaderboard'

// GET /api/activities/[id]/leaderboard — admin only.
// Compute and return the leaderboard entries for the activity.
//
// Query params:
//   ?upToQuestionOrder=N  — only count answers for questions with questionOrder <= N
//                           (used for intermediate leaderboards). If omitted,
//                           all answers are counted (default final leaderboard).
//
// Returns: { entries: LeaderboardEntry[] }
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({ where: { id, createdBy: admin.id } })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const upToRaw = url.searchParams.get('upToQuestionOrder')
  let upToQuestionOrder: number | undefined
  if (upToRaw !== null) {
    const parsed = Number(upToRaw)
    if (Number.isFinite(parsed)) {
      upToQuestionOrder = Math.floor(parsed)
    }
  }

  const entries = await computeLeaderboardEntries(id, upToQuestionOrder)
  return NextResponse.json({ entries })
}
