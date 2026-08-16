import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { computeDistribution } from '@/lib/serializers'
import type { ActivityResultsResponse, OptionKey } from '@/lib/types'

// GET /api/activities/[id]/results — admin only.
// Returns summary: totalQuestions, totalParticipants, participation, averageScore,
// highestScore, and per-question distribution.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({ where: { id, createdBy: admin.id } })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  const questions = await db.question.findMany({
    where: { activityId: id },
    orderBy: { questionOrder: 'asc' },
    include: {
      answers: { select: { selectedOption: true, participantId: true, isCorrect: true } },
    },
  })

  const totalParticipants = await db.participant.count({ where: { activityId: id } })

  // Per-participant tracking for participation and scores.
  const distinctAnswering = new Set<string>()
  const perParticipantCorrect = new Map<string, number>()
  let totalCorrectAcrossAll = 0

  for (const q of questions) {
    for (const a of q.answers) {
      distinctAnswering.add(a.participantId)
      if (a.isCorrect) {
        perParticipantCorrect.set(
          a.participantId,
          (perParticipantCorrect.get(a.participantId) ?? 0) + 1,
        )
        totalCorrectAcrossAll++
      }
    }
  }

  const correctCounts = Array.from(perParticipantCorrect.values())
  const averageScore =
    totalParticipants > 0
      ? Math.round((totalCorrectAcrossAll / totalParticipants) * 10) / 10
      : 0
  const highestScore = correctCounts.length > 0 ? correctCounts.reduce((m, v) => Math.max(m, v), 0) : 0
  const participation =
    totalParticipants > 0
      ? Math.round((distinctAnswering.size / totalParticipants) * 1000) / 10
      : 0

  const result: ActivityResultsResponse = {
    activityId: activity.id,
    title: activity.title,
    totalQuestions: questions.length,
    totalParticipants,
    participation,
    averageScore,
    highestScore,
    questions: questions.map((q) => ({
      id: q.id,
      questionOrder: q.questionOrder,
      questionText: q.questionText,
      correctOption: q.correctOption as OptionKey,
      distribution: computeDistribution(q.answers),
    })),
  }

  return NextResponse.json(result)
}
