import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeScore, isValidOption } from '@/lib/serializers'

// POST /api/questions/[id]/answer — REST fallback for answer submission.
// Primary path is the socket service; both must agree on the validation rules.
// Body: { sessionId, selectedOption }
// Returns: { ok: true, isCorrect }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
  const selectedRaw = typeof body?.selectedOption === 'string' ? body.selectedOption.toUpperCase() : ''

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }
  if (!isValidOption(selectedRaw)) {
    return NextResponse.json({ error: 'selectedOption must be one of A,B,C,D' }, { status: 400 })
  }
  const selectedOption = selectedRaw as 'A' | 'B' | 'C' | 'D'

  const question = await db.question.findUnique({
    where: { id },
    include: { activity: true },
  })
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const activity = question.activity
  if (activity.status !== 'LIVE') {
    return NextResponse.json({ error: 'Activity is not live' }, { status: 409 })
  }
  if (activity.currentQuestionId !== question.id) {
    return NextResponse.json(
      { error: 'This question is not the currently active question' },
      { status: 409 },
    )
  }
  const now = new Date()
  if (!activity.questionEndsAt || now.getTime() > activity.questionEndsAt.getTime()) {
    return NextResponse.json({ error: 'Question has ended' }, { status: 409 })
  }

  const participant = await db.participant.findUnique({ where: { sessionId } })
  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
  }
  if (participant.activityId !== activity.id) {
    return NextResponse.json(
      { error: 'Participant does not belong to this activity' },
      { status: 403 },
    )
  }

  const isCorrect = selectedOption === question.correctOption
  const { score, timeTakenMs } =
    activity.questionStartedAt !== null
      ? computeScore({
          isCorrect,
          timeLimitSec: question.timeLimit,
          questionStartedAt: activity.questionStartedAt,
          answeredAt: now,
        })
      : { score: isCorrect ? 1000 : 0, timeTakenMs: 0 }

  try {
    await db.answer.create({
      data: {
        activityId: activity.id,
        questionId: question.id,
        participantId: participant.id,
        selectedOption,
        isCorrect,
        score,
        timeTakenMs,
      },
    })
    return NextResponse.json({ ok: true, isCorrect, score })
  } catch (e: any) {
    // Anti-duplicate answer constraint (Participant x Question unique).
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'already answered' }, { status: 409 })
    }
    throw e
  }
}
