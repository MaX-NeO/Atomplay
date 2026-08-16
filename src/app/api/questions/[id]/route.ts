import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { isValidOption, toQuestionDTO } from '@/lib/serializers'

// PATCH /api/questions/[id] — admin only; require activity DRAFT.
// Body may include any subset of: questionText, optionA, optionB, optionC, optionD,
// correctOption, timeLimit.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const question = await db.question.findUnique({
    where: { id },
    include: { activity: true },
  })
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }
  if (question.activity.createdBy !== admin.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (question.activity.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Question can only be edited while activity is in DRAFT status' },
      { status: 409 },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: any = {}
  if (typeof body?.questionText === 'string' && body.questionText.trim()) {
    data.questionText = body.questionText.trim()
  }
  if (typeof body?.optionA === 'string' && body.optionA.trim()) data.optionA = body.optionA.trim()
  if (typeof body?.optionB === 'string' && body.optionB.trim()) data.optionB = body.optionB.trim()
  if (typeof body?.optionC === 'string' && body.optionC.trim()) data.optionC = body.optionC.trim()
  if (typeof body?.optionD === 'string' && body.optionD.trim()) data.optionD = body.optionD.trim()
  if (typeof body?.correctOption === 'string') {
    const c = body.correctOption.toUpperCase()
    if (!isValidOption(c)) {
      return NextResponse.json({ error: 'correctOption must be one of A,B,C,D' }, { status: 400 })
    }
    data.correctOption = c
  }
  if (typeof body?.timeLimit === 'number' && Number.isFinite(body.timeLimit) && body.timeLimit > 0) {
    data.timeLimit = Math.floor(body.timeLimit)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await db.question.update({ where: { id }, data })
  return NextResponse.json({ question: toQuestionDTO(updated) })
}

// DELETE /api/questions/[id] — admin only; require activity DRAFT.
// After deletion, remaining questions are renumbered sequentially 1..N (atomic transaction).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const question = await db.question.findUnique({
    where: { id },
    include: { activity: true },
  })
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }
  if (question.activity.createdBy !== admin.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (question.activity.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Question can only be deleted while activity is in DRAFT status' },
      { status: 409 },
    )
  }

  const activityId = question.activityId

  await db.$transaction(async (tx) => {
    await tx.question.delete({ where: { id } })
    const remaining = await tx.question.findMany({
      where: { activityId },
      orderBy: { questionOrder: 'asc' },
      select: { id: true },
    })
    for (let i = 0; i < remaining.length; i++) {
      await tx.question.update({
        where: { id: remaining[i].id },
        data: { questionOrder: i + 1 },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
