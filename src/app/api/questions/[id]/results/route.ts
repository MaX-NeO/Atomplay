import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { computeDistribution } from '@/lib/serializers'
import type { OptionKey } from '@/lib/types'

// GET /api/questions/[id]/results — admin only.
// Returns per-question distribution and the correct option.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const question = await db.question.findUnique({
    where: { id },
    include: {
      activity: true,
      answers: { select: { selectedOption: true } },
    },
  })
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }
  if (question.activity.createdBy !== admin.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    questionId: question.id,
    distribution: computeDistribution(question.answers),
    correctOption: question.correctOption as OptionKey,
  })
}
