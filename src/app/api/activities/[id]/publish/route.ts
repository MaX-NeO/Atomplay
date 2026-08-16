import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateUniqueAccessCode, getAdminFromRequest } from '@/lib/auth'
import { toActivityDTO } from '@/lib/serializers'

// POST /api/activities/[id]/publish — transitions DRAFT -> PUBLISHED and generates accessCode.
// Requirements: status === DRAFT and at least 1 question. Re-publishing (already PUBLISHED) returns current.
// LIVE / COMPLETED -> 409.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({
    where: { id, createdBy: admin.id },
    include: { _count: { select: { questions: true } } },
  })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  if (activity.status === 'PUBLISHED') {
    // Idempotent re-publish — return current state unchanged.
    return NextResponse.json({ activity: toActivityDTO(activity) })
  }
  if (activity.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Cannot publish an activity in status ${activity.status}` },
      { status: 409 },
    )
  }
  if (activity._count.questions === 0) {
    return NextResponse.json(
      { error: 'Activity must have at least one question before publishing' },
      { status: 409 },
    )
  }

  const accessCode = await generateUniqueAccessCode()
  const updated = await db.activity.update({
    where: { id },
    data: { status: 'PUBLISHED', accessCode },
  })
  return NextResponse.json({ activity: toActivityDTO(updated) })
}
