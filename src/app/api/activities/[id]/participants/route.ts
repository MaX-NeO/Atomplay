import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

// GET /api/activities/[id]/participants — admin only.
// Returns the list of participants who have joined this activity, ordered by
// join time. Used by the live presentation screen to render the floating
// glassmorphism "bubbles" for each joined participant.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({
    where: { id, createdBy: admin.id },
    select: { id: true, status: true },
  })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  const participants = await db.participant.findMany({
    where: { activityId: id },
    select: {
      id: true,
      displayName: true,
      uoid: true,
      joinedAt: true,
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({
    participants: participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      uoid: p.uoid,
      joinedAt: p.joinedAt.toISOString(),
    })),
  })
}
