import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeDistribution } from '@/lib/serializers'
import type { ActivityStateResponse, OptionKey } from '@/lib/types'

// GET /api/activities/[code]/state — participant sync endpoint.
//
// NOTE on routing: Next.js App Router does not allow two distinct dynamic
// segment names at the same path level (so `/activities/[id]/...` and
// `/activities/[code]/...` cannot coexist). We therefore live inside the
// shared `/activities/[id]/` folder but treat the param value as the
// activity's `accessCode` (per the worklog URL contract
// `/api/activities/[code]/state`).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: accessCode } = await params

  if (!accessCode) {
    return NextResponse.json({ error: 'accessCode is required' }, { status: 400 })
  }

  const activity = await db.activity.findFirst({
    where: { accessCode, status: { in: ['PUBLISHED', 'LIVE', 'COMPLETED'] } },
  })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  const participantCount = await db.participant.count({ where: { activityId: activity.id } })

  const response: ActivityStateResponse = {
    activityId: activity.id,
    title: activity.title,
    status: activity.status as ActivityStateResponse['status'],
    participantCount,
    currentQuestion: null,
    lastReveal: null,
  }

  if (activity.status === 'LIVE' && activity.currentQuestionId) {
    const question = await db.question.findUnique({
      where: { id: activity.currentQuestionId },
    })
    if (question) {
      const totalQuestions = await db.question.count({ where: { activityId: activity.id } })
      const now = Date.now()
      const endsAtMs = activity.questionEndsAt ? activity.questionEndsAt.getTime() : 0

      if (activity.questionEndsAt && now < endsAtMs) {
        // Question is still LIVE — NEVER expose correctOption to participants.
        response.currentQuestion = {
          questionId: question.id,
          questionOrder: question.questionOrder,
          totalQuestions,
          questionText: question.questionText,
          options: [
            { key: 'A' as OptionKey, label: question.optionA },
            { key: 'B' as OptionKey, label: question.optionB },
            { key: 'C' as OptionKey, label: question.optionC },
            { key: 'D' as OptionKey, label: question.optionD },
          ],
          timeLimit: question.timeLimit,
          startedAt: activity.questionStartedAt
            ? activity.questionStartedAt.toISOString()
            : new Date().toISOString(),
          endsAt: activity.questionEndsAt.toISOString(),
        }
      } else {
        // Question time has elapsed but admin hasn't advanced — reveal results.
        const answers = await db.answer.findMany({
          where: { questionId: question.id },
          select: { selectedOption: true },
        })
        response.lastReveal = {
          questionId: question.id,
          correctOption: question.correctOption as OptionKey,
          distribution: computeDistribution(answers),
        }
      }
    }
  } else if (activity.status === 'COMPLETED') {
    // Optionally reveal the last question's results when activity is finished.
    const lastQuestion = await db.question.findFirst({
      where: { activityId: activity.id },
      orderBy: { questionOrder: 'desc' },
    })
    if (lastQuestion) {
      const answers = await db.answer.findMany({
        where: { questionId: lastQuestion.id },
        select: { selectedOption: true },
      })
      response.lastReveal = {
        questionId: lastQuestion.id,
        correctOption: lastQuestion.correctOption as OptionKey,
        distribution: computeDistribution(answers),
      }
    }
  }

  return NextResponse.json(response)
}
