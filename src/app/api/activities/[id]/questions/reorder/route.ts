import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { toQuestionDTO } from '@/lib/serializers'

// PATCH /api/activities/[id]/questions/reorder — reorder questions within an activity.
//
// Body: { questionIds: string[] }  — an array of question IDs in the desired order.
// The server assigns questionOrder = 1, 2, 3, … to match the array order.
//
// Only allowed for DRAFT or PUBLISHED activities (not LIVE or COMPLETED).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({
    where: { id, createdBy: admin.id },
    select: { status: true },
  })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }
  if (activity.status === 'LIVE' || activity.status === 'COMPLETED') {
    return NextResponse.json(
      { error: 'Cannot reorder questions in a LIVE or COMPLETED activity' },
      { status: 409 },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const questionIds: unknown = body?.questionIds
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return NextResponse.json({ error: 'questionIds must be a non-empty array' }, { status: 400 })
  }
  if (!questionIds.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'Each questionId must be a string' }, { status: 400 })
  }

  // Verify all questions belong to this activity
  const questions = await db.question.findMany({
    where: { activityId: id },
    select: { id: true },
  })
  const existingIds = new Set(questions.map((q) => q.id))
  for (const qid of questionIds) {
    if (!existingIds.has(qid)) {
      return NextResponse.json(
        { error: `Question ${qid} does not belong to this activity` },
        { status: 400 },
      )
    }
  }

  // Perform the reorder in a two-phase transaction to avoid unique constraint
  // violations on (activityId, questionOrder). Phase 1: move all orders to
  // negative temp values. Phase 2: set the final positive values.
  const OFFSET = 10000 // large offset to avoid collisions with real values

  const updated = await db.$transaction([
    // Phase 1: assign temporary negative orders
    ...questionIds.map((qid: string, index: number) =>
      db.question.update({
        where: { id: qid },
        data: { questionOrder: -(index + OFFSET) },
      }),
    ),
    // Phase 2: assign final positive orders
    ...questionIds.map((qid: string, index: number) =>
      db.question.update({
        where: { id: qid },
        data: { questionOrder: index + 1 },
      }),
    ),
  ])

  // Only return the phase-2 results (the final state)
  const finalQuestions = updated.slice(questionIds.length)

  return NextResponse.json({
    questions: finalQuestions.map(toQuestionDTO),
  })
}
