import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateUniqueAccessCode, getAdminFromRequest } from '@/lib/auth'
import { toActivityDTO } from '@/lib/serializers'

// POST /api/activities/[id]/clone — creates a NEW DRAFT activity that is a copy
// of the source activity (title with " (Copy)" suffix, description, and ALL questions
// with their order / options / correctOption / timeLimit preserved).
//
// Body (all optional):
//   { title?: string, publishImmediately?: boolean }
//
// - If `publishImmediately` is true AND the source has at least one question,
//   the clone is created directly in PUBLISHED state with a fresh unique
//   6-digit access code (a different "channel" from the original).
// - If `publishImmediately` is true but the source has 0 questions, we fall back
//   to a DRAFT clone and return HTTP 200 with a warning field.
//
// Allowed from any source status (DRAFT / PUBLISHED / LIVE / COMPLETED).
// The source activity is NOT mutated.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is allowed */
  }

  const source = await db.activity.findFirst({
    where: { id, createdBy: admin.id },
    include: {
      questions: { orderBy: { questionOrder: 'asc' } },
      leaderboardSections: true,
    },
  })
  if (!source) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  const customTitle =
    typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : ''
  const publishImmediately = body?.publishImmediately === true

  // Compose a non-empty, unique-ish title.
  const baseTitle = customTitle || source.title
  const newTitle = baseTitle.toLowerCase().endsWith('(copy)')
    ? baseTitle
    : `${baseTitle} (Copy)`

  // Decide target status & access code up-front so we only do one DB write.
  const canPublish = source.questions.length > 0
  const targetStatus = publishImmediately && canPublish ? 'PUBLISHED' : 'DRAFT'
  const accessCode =
    targetStatus === 'PUBLISHED' ? await generateUniqueAccessCode() : null

  const created = await db.activity.create({
    data: {
      title: newTitle,
      description: source.description,
      status: targetStatus,
      accessCode,
      createdBy: admin.id,
      questions: {
        create: source.questions.map((q) => ({
          questionOrder: q.questionOrder,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          timeLimit: q.timeLimit,
        })),
      },
      leaderboardSections: {
        create: source.leaderboardSections.map((ls) => ({
          afterQuestionOrder: ls.afterQuestionOrder,
          isDefault: ls.isDefault,
          title: ls.title,
        })),
      },
    },
    include: {
      questions: { orderBy: { questionOrder: 'asc' } },
      leaderboardSections: true,
    },
  })

  return NextResponse.json(
    {
      activity: toActivityDTO(created, created.questions, created.leaderboardSections),
      warning:
        publishImmediately && !canPublish
          ? 'Source activity had no questions — clone was created as a DRAFT instead of being published.'
          : null,
    },
    { status: 201 },
  )
}
