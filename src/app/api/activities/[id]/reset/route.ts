import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateUniqueAccessCode, getAdminFromRequest } from '@/lib/auth'
import { toActivityDTO } from '@/lib/serializers'

// POST /api/activities/[id]/reset — allowed when status === 'LIVE' or 'COMPLETED'.
// Wipes all participants (+ their answers via cascade) and live state so the
// activity can be presented again. Questions are preserved.
//
// Body (optional):
//   { regenerateAccessCode?: boolean }  // default: false → keep the same access code
//
// Returns the updated activity (now in PUBLISHED state).
//
// Why PUBLISHED and not DRAFT:
//   The PRD state machine is DRAFT -> PUBLISHED -> LIVE -> COMPLETED.
//   Reset is the inverse of "go live": it returns the activity to a ready-to-host
//   state so the host can immediately present again with the SAME access code
//   (so the audience can re-join seamlessly). The admin can still edit questions
//   by going through the editor (which is allowed only in DRAFT, so they'd need
//   to clone instead if they want to change content).
//
// Why LIVE is now allowed:
//   The "Exit" button on the live presentation screen uses this endpoint to
//   abort a running session and put the activity back to a ready-to-host state.
//   The frontend also emits a `reset_activity` socket event before calling this
//   endpoint, so connected participants are notified via `activity_reset` and
//   sent back to the join screen before their Participant rows are deleted.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body allowed */
  }
  const regenerateAccessCode = body?.regenerateAccessCode === true

  const activity = await db.activity.findFirst({
    where: { id, createdBy: admin.id },
    include: { _count: { select: { questions: true } } },
  })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }
  if (activity.status !== 'LIVE' && activity.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: `Cannot reset an activity in status ${activity.status}. Reset is only available for LIVE or COMPLETED activities.` },
      { status: 409 },
    )
  }
  if (activity._count.questions === 0) {
    return NextResponse.json(
      { error: 'Cannot reset an activity with no questions.' },
      { status: 409 },
    )
  }

  // Determine the access code to use post-reset.
  const newAccessCode = regenerateAccessCode
    ? await generateUniqueAccessCode()
    : activity.accessCode ?? (await generateUniqueAccessCode())

  // Single transaction: wipe participants (cascade wipes answers), then reset
  // the activity row back to a ready-to-host state.
  const [, updated] = await db.$transaction([
    db.participant.deleteMany({ where: { activityId: id } }),
    db.activity.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        accessCode: newAccessCode,
        currentQuestionId: null,
        questionStartedAt: null,
        questionEndsAt: null,
        startedAt: null,
        endedAt: null,
      },
    }),
  ])

  return NextResponse.json({ activity: toActivityDTO(updated) })
}
