import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { isValidOption, toQuestionDTO } from '@/lib/serializers'

// POST /api/activities/[id]/questions — add a question to an activity.
// Allowed in ANY activity status (DRAFT / PUBLISHED / LIVE / COMPLETED) so the
// admin can append questions to an already-published activity without having
// to clone it. The new question gets questionOrder = (max existing order)+1.
//
// Body: { questionText, optionA, optionB, optionC, optionD, correctOption, timeLimit? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({ where: { id, createdBy: admin.id } })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const questionText = typeof body?.questionText === 'string' ? body.questionText.trim() : ''
  const optionA = typeof body?.optionA === 'string' ? body.optionA.trim() : ''
  const optionB = typeof body?.optionB === 'string' ? body.optionB.trim() : ''
  const optionC = typeof body?.optionC === 'string' ? body.optionC.trim() : ''
  const optionD = typeof body?.optionD === 'string' ? body.optionD.trim() : ''
  const correctOptionRaw = typeof body?.correctOption === 'string' ? body.correctOption.toUpperCase() : ''
  const timeLimit =
    typeof body?.timeLimit === 'number' && Number.isFinite(body.timeLimit) && body.timeLimit > 0
      ? Math.floor(body.timeLimit)
      : 30

  if (!questionText || !optionA || !optionB || !optionC || !optionD) {
    return NextResponse.json(
      { error: 'questionText and all four options (A,B,C,D) are required' },
      { status: 400 },
    )
  }
  if (!isValidOption(correctOptionRaw)) {
    return NextResponse.json({ error: 'correctOption must be one of A,B,C,D' }, { status: 400 })
  }
  const correctOption = correctOptionRaw as 'A' | 'B' | 'C' | 'D'

  const maxOrder = await db.question.aggregate({
    where: { activityId: id },
    _max: { questionOrder: true },
  })
  const questionOrder = (maxOrder._max.questionOrder ?? 0) + 1

  const created = await db.question.create({
    data: {
      activityId: id,
      questionOrder,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      timeLimit,
    },
  })
  return NextResponse.json({ question: toQuestionDTO(created) }, { status: 201 })
}
