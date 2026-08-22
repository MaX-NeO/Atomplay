import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { toQuestionDTO, toLeaderboardSectionDTO } from '@/lib/serializers'

// PATCH /api/activities/[id]/items/reorder — unified reorder of questions + leaderboard sections.
//
// Body: { items: [{ type: 'question', id: '...' }, { type: 'leaderboard', id: '...' }, ...] }
//
// The server:
//   1. Validates the order (first item must be a question, no two leaderboards adjacent)
//   2. Renumbers questionOrder for all questions (1, 2, 3, ...)
//   3. Updates each leaderboard's afterQuestionOrder to match the preceding question
//   4. Default leaderboards (isDefault=true) are NOT in the items array — they stay at the end
//
// Only allowed for DRAFT or PUBLISHED activities.
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
      { error: 'Cannot reorder items in a LIVE or COMPLETED activity' },
      { status: 409 },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const items: unknown = body?.items
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 })
  }

  // Validate each item
  for (const item of items) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('type' in item) ||
      !('id' in item) ||
      (item.type !== 'question' && item.type !== 'leaderboard') ||
      typeof item.id !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Each item must be { type: "question"|"leaderboard", id: string }' },
        { status: 400 },
      )
    }
  }

  // Constraint: first item must be a question
  if (items[0].type !== 'question') {
    return NextResponse.json(
      { error: 'The first item must be a question' },
      { status: 400 },
    )
  }

  // Constraint: no two leaderboards adjacent
  for (let i = 1; i < items.length; i++) {
    if (items[i].type === 'leaderboard' && items[i - 1].type === 'leaderboard') {
      return NextResponse.json(
        { error: 'Two leaderboards cannot be adjacent' },
        { status: 400 },
      )
    }
  }

  // Fetch existing questions + leaderboard sections
  const [questions, leaderboardSections] = await Promise.all([
    db.question.findMany({ where: { activityId: id }, select: { id: true } }),
    db.leaderboardSection.findMany({ where: { activityId: id }, select: { id: true, isDefault: true } }),
  ])

  const existingQuestionIds = new Set(questions.map((q) => q.id))
  const existingLeaderboardIds = new Set(leaderboardSections.map((l) => l.id))

  // Verify all items belong to this activity and are not default leaderboards
  for (const item of items) {
    if (item.type === 'question' && !existingQuestionIds.has(item.id)) {
      return NextResponse.json({ error: `Question ${item.id} not found` }, { status: 400 })
    }
    if (item.type === 'leaderboard') {
      if (!existingLeaderboardIds.has(item.id)) {
        return NextResponse.json({ error: `Leaderboard ${item.id} not found` }, { status: 400 })
      }
      const section = leaderboardSections.find((l) => l.id === item.id)
      if (section?.isDefault) {
        return NextResponse.json(
          { error: 'Default leaderboards cannot be reordered' },
          { status: 400 },
        )
      }
    }
  }

  // Separate questions and leaderboards from the items array
  const questionItems = items.filter((i: any) => i.type === 'question')
  const questionIds = questionItems.map((i: any) => i.id)

  // Build leaderboard updates: for each leaderboard, find the preceding question's new order
  const leaderboardUpdates: { id: string; afterQuestionOrder: number }[] = []
  let questionCounter = 0
  for (const item of items) {
    if (item.type === 'question') {
      questionCounter++
    } else if (item.type === 'leaderboard') {
      // The preceding question's new order is questionCounter
      leaderboardUpdates.push({ id: item.id, afterQuestionOrder: questionCounter })
    }
  }

  // Two-phase transaction to avoid unique constraint violations
  const OFFSET = 10000

  const txOps: any[] = []

  // Phase 1: assign temporary negative orders for questions
  questionIds.forEach((qid: string, index: number) => {
    txOps.push(
      db.question.update({
        where: { id: qid },
        data: { questionOrder: -(index + OFFSET) },
      }),
    )
  })

  // Phase 2: assign final positive orders for questions
  questionIds.forEach((qid: string, index: number) => {
    txOps.push(
      db.question.update({
        where: { id: qid },
        data: { questionOrder: index + 1 },
      }),
    )
  })

  // Phase 3: update leaderboard afterQuestionOrder (use temp negative to avoid collisions)
  leaderboardUpdates.forEach((lu) => {
    txOps.push(
      db.leaderboardSection.update({
        where: { id: lu.id },
        data: { afterQuestionOrder: -(lu.afterQuestionOrder + OFFSET) },
      }),
    )
  })

  // Phase 4: set final afterQuestionOrder for leaderboards
  leaderboardUpdates.forEach((lu) => {
    txOps.push(
      db.leaderboardSection.update({
        where: { id: lu.id },
        data: { afterQuestionOrder: lu.afterQuestionOrder },
      }),
    )
  })

  await db.$transaction(txOps)

  // Fetch final state
  const [finalQuestions, finalSections] = await Promise.all([
    db.question.findMany({ where: { activityId: id }, orderBy: { questionOrder: 'asc' } }),
    db.leaderboardSection.findMany({ where: { activityId: id }, orderBy: { afterQuestionOrder: 'asc' } }),
  ])

  return NextResponse.json({
    questions: finalQuestions.map(toQuestionDTO),
    leaderboardSections: finalSections.map(toLeaderboardSectionDTO),
  })
}
