import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'

// POST /api/join — participant joins an activity by access code.
// Body: { accessCode, displayName, uoid }
// Returns: { sessionId, activityId, title, displayName, uoid } (JoinResponse).
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const accessCode = typeof body?.accessCode === 'string' ? body.accessCode.trim() : ''
  let displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : ''
  let uoid = typeof body?.uoid === 'string' ? body.uoid.trim() : ''

  if (!accessCode) {
    return NextResponse.json({ error: 'accessCode is required' }, { status: 400 })
  }
  if (!displayName) {
    return NextResponse.json({ error: 'displayName is required' }, { status: 400 })
  }
  if (!uoid) {
    return NextResponse.json({ error: 'UOID is required' }, { status: 400 })
  }
  if (displayName.length > 30) displayName = displayName.slice(0, 30)
  if (uoid.length > 40) uoid = uoid.slice(0, 40)

  const activity = await db.activity.findFirst({
    where: { accessCode, status: { in: ['PUBLISHED', 'LIVE'] } },
  })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found or not joinable' }, { status: 404 })
  }

  // Enforce per-activity UOID uniqueness ahead of the create (friendlier message
  // than relying solely on the DB unique-constraint error).
  const existingWithUoid = await db.participant.findFirst({
    where: { activityId: activity.id, uoid },
    select: { id: true },
  })
  if (existingWithUoid) {
    return NextResponse.json(
      { error: 'This ID has already joined this quiz' },
      { status: 409 },
    )
  }

  // Hard cap on concurrent participants. The admin-facing UI advertises a
  // "recommended" 80-user limit (display only — see MAX_PARTICIPANTS_DISPLAY
  // in src/lib/participant-icons.tsx), but the join API accepts up to 99 so a
  // slightly larger room can still squeeze in. We pick 99 (not 100) so the
  // 100-icon roster always has at least one spare slot — and because a
  // 3-digit cap below 100 reads cleaner to hosts.
  const currentCount = await db.participant.count({ where: { activityId: activity.id } })
  if (currentCount >= 99) {
    return NextResponse.json(
      { error: 'This activity is full (max 99 participants)' },
      { status: 409 },
    )
  }

  // sessionId is unique in DB; retry a few times in the astronomically unlikely event of a collision.
  let participant
  for (let attempt = 0; attempt < 3; attempt++) {
    const sessionId = randomUUID()
    const now = new Date()
    try {
      participant = await db.participant.create({
        data: {
          activityId: activity.id,
          sessionId,
          uoid,
          displayName,
          joinedAt: now,
          lastSeenAt: now,
        },
      })
      break
    } catch (e: any) {
      // P2002 on (activityId, uoid) — concurrent duplicate join.
      if (e?.code === 'P2002' && attempt < 2) {
        return NextResponse.json(
          { error: 'This ID has already joined this quiz' },
          { status: 409 },
        )
      }
      if (e?.code === 'P2002') continue
      throw e
    }
  }
  if (!participant) {
    return NextResponse.json({ error: 'Failed to create participant session' }, { status: 500 })
  }

  return NextResponse.json(
    {
      participantId: participant.id,
      sessionId: participant.sessionId,
      activityId: activity.id,
      title: activity.title,
      displayName: participant.displayName,
      uoid: participant.uoid ?? uoid,
    },
    { status: 201 },
  )
}
