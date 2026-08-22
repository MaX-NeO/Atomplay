import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { toLeaderboardSectionDTO } from '@/lib/serializers'

// POST /api/activities/[id]/leaderboards — admin only.
// Adds a leaderboard section after a specific question.
// Body: { afterQuestionOrder?: number }
//   - if omitted: inserts after the LAST question (max questionOrder)
//   - if provided: must not collide with an existing leaderboard at that position
// The default final leaderboard is created implicitly elsewhere (not here);
// every leaderboard added here is isDefault: false.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({ where: { id, createdBy: admin.id } })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // allow empty body
  }

  let afterQuestionOrder: number | null

  if (body && typeof body.afterQuestionOrder === 'number' && Number.isFinite(body.afterQuestionOrder)) {
    afterQuestionOrder = Math.floor(body.afterQuestionOrder)
  } else {
    // Default: insert after the question with the highest questionOrder.
    const lastQuestion = await db.question.findFirst({
      where: { activityId: id },
      orderBy: { questionOrder: 'desc' },
      select: { questionOrder: true },
    })
    if (!lastQuestion) {
      return NextResponse.json(
        { error: 'Activity has no questions; cannot place a leaderboard' },
        { status: 409 },
      )
    }
    afterQuestionOrder = lastQuestion.questionOrder
  }

  // Validate that a question with this order actually exists (so leaderboards
  // stay anchored to real questions).
  const anchorQuestion = await db.question.findFirst({
    where: { activityId: id, questionOrder: afterQuestionOrder },
    select: { id: true },
  })
  if (!anchorQuestion) {
    return NextResponse.json(
      { error: `No question with questionOrder=${afterQuestionOrder} exists for this activity` },
      { status: 400 },
    )
  }

  // Collision check: unique on (activityId, afterQuestionOrder).
  const existing = await db.leaderboardSection.findUnique({
    where: {
      activityId_afterQuestionOrder: { activityId: id, afterQuestionOrder },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A leaderboard already exists at this position', leaderboard: toLeaderboardSectionDTO(existing) },
      { status: 409 },
    )
  }

  try {
    const created = await db.leaderboardSection.create({
      data: {
        activityId: id,
        afterQuestionOrder,
        isDefault: false,
      },
    })
    return NextResponse.json({ leaderboard: toLeaderboardSectionDTO(created) }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A leaderboard already exists at this position' },
        { status: 409 },
      )
    }
    throw e
  }
}

// GET /api/activities/[id]/leaderboards — admin only.
// Lists all leaderboard sections for the activity, ordered by afterQuestionOrder asc.
// (The default final leaderboard, with afterQuestionOrder = null, sorts LAST in Postgres
// NULLS LAST semantics; Prisma's orderBy on a nullable column puts nulls last by default.)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({ where: { id, createdBy: admin.id } })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  const sections = await db.leaderboardSection.findMany({
    where: { activityId: id },
    orderBy: { afterQuestionOrder: 'asc' },
  })
  return NextResponse.json({
    leaderboards: sections.map(toLeaderboardSectionDTO),
  })
}
