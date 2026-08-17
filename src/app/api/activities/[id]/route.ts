import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { toActivityDTO } from '@/lib/serializers'

// GET /api/activities/[id] — admin only; returns activity + its questions ordered by questionOrder.
// Includes correctOption (admin only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({
    where: { id, createdBy: admin.id },
    include: {
      questions: { orderBy: { questionOrder: 'asc' } },
    },
  })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  return NextResponse.json({ activity: toActivityDTO(activity, activity.questions) })
}

// PATCH /api/activities/[id] — update title/description.
// Editable in ANY status (DRAFT / PUBLISHED / LIVE / COMPLETED / ARCHIVED) so the
// admin can fix typos or rename an activity at any time. Title/description are
// metadata; they don't touch the question/answer data, so this is always safe.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const data: any = {}
  if (typeof body?.title === 'string' && body.title.trim()) {
    data.title = body.title.trim()
  }
  if (typeof body?.description === 'string') {
    data.description = body.description
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await db.activity.update({ where: { id }, data })
  return NextResponse.json({ activity: toActivityDTO(updated) })
}

// DELETE /api/activities/[id] — allowed in any status. Cascade handled by Prisma.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activity = await db.activity.findFirst({ where: { id, createdBy: admin.id } })
  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  await db.activity.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
