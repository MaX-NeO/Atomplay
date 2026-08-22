import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { toLeaderboardSectionDTO } from '@/lib/serializers'

// DELETE /api/leaderboards/[id] — admin only.
// Not allowed if isDefault === true (the default final leaderboard is immutable).
// Must verify the leaderboard's activity belongs to the admin.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leaderboard = await db.leaderboardSection.findUnique({
    where: { id },
    include: { activity: { select: { createdBy: true } } },
  })
  if (!leaderboard) {
    return NextResponse.json({ error: 'Leaderboard not found' }, { status: 404 })
  }
  if (leaderboard.activity.createdBy !== admin.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (leaderboard.isDefault) {
    return NextResponse.json(
      { error: 'The default final leaderboard cannot be deleted' },
      { status: 403 },
    )
  }

  // If this leaderboard is currently being shown, clear the activity's pointer.
  if (leaderboard.activity.createdBy) {
    // no-op guard — we already have createdBy via include above
  }
  await db.activity.updateMany({
    where: { currentLeaderboardId: id },
    data: { currentLeaderboardId: null },
  })

  await db.leaderboardSection.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// PATCH /api/leaderboards/[id] — admin only.
// Body: { title?: string, afterQuestionOrder?: number }
// Not allowed if isDefault === true (block all PATCH on the default leaderboard).
// When changing afterQuestionOrder, validate no collision + anchor question exists.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const leaderboard = await db.leaderboardSection.findUnique({
    where: { id },
    include: { activity: { select: { createdBy: true } } },
  })
  if (!leaderboard) {
    return NextResponse.json({ error: 'Leaderboard not found' }, { status: 404 })
  }
  if (leaderboard.activity.createdBy !== admin.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (leaderboard.isDefault) {
    return NextResponse.json(
      { error: 'The default final leaderboard cannot be edited' },
      { status: 403 },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: { title?: string | null; afterQuestionOrder?: number | null } = {}

  if (body?.title !== undefined) {
    if (body.title === null) {
      data.title = null
    } else if (typeof body.title === 'string') {
      const trimmed = body.title.trim()
      data.title = trimmed.length > 0 ? trimmed : null
    } else {
      return NextResponse.json({ error: 'title must be a string or null' }, { status: 400 })
    }
  }

  if (body?.afterQuestionOrder !== undefined) {
    if (body.afterQuestionOrder === null) {
      // Cannot move a non-default leaderboard to the default position (null).
      return NextResponse.json(
        { error: 'Cannot move a leaderboard to the default final position' },
        { status: 400 },
      )
    }
    if (
      typeof body.afterQuestionOrder !== 'number' ||
      !Number.isFinite(body.afterQuestionOrder)
    ) {
      return NextResponse.json(
        { error: 'afterQuestionOrder must be a number' },
        { status: 400 },
      )
    }
    const newOrder = Math.floor(body.afterQuestionOrder)
    if (newOrder === leaderboard.afterQuestionOrder) {
      // no change — skip validation
    } else {
      // Validate a question with this order exists for this activity.
      const anchorQuestion = await db.question.findFirst({
        where: { activityId: leaderboard.activityId, questionOrder: newOrder },
        select: { id: true },
      })
      if (!anchorQuestion) {
        return NextResponse.json(
          { error: `No question with questionOrder=${newOrder} exists for this activity` },
          { status: 400 },
        )
      }
      // Collision check.
      const existing = await db.leaderboardSection.findUnique({
        where: {
          activityId_afterQuestionOrder: {
            activityId: leaderboard.activityId,
            afterQuestionOrder: newOrder,
          },
        },
      })
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: 'A leaderboard already exists at that position' },
          { status: 409 },
        )
      }
      data.afterQuestionOrder = newOrder
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    const updated = await db.leaderboardSection.update({ where: { id }, data })
    return NextResponse.json({ leaderboard: toLeaderboardSectionDTO(updated) })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A leaderboard already exists at that position' },
        { status: 409 },
      )
    }
    throw e
  }
}
