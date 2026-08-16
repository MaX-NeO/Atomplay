import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { toActivityDTO } from '@/lib/serializers'

// GET /api/activities — list current admin's activities, ordered by createdAt desc.
// Each activity includes `questionCount` and `participantCount` via Prisma _count.
export async function GET() {
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activities = await db.activity.findMany({
    where: { createdBy: admin.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { questions: true, participants: true } },
    },
  })

  return NextResponse.json({
    activities: activities.map((a) => {
      const dto = toActivityDTO(a)
      return {
        ...dto,
        questionCount: a._count.questions,
        participantCount: a._count.participants,
      }
    }),
  })
}

// POST /api/activities — create a new DRAFT activity owned by the current admin.
// Body: { title, description? }
export async function POST(req: Request) {
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const created = await db.activity.create({
    data: {
      title,
      description,
      status: 'DRAFT',
      createdBy: admin.id,
    },
  })
  return NextResponse.json({ activity: toActivityDTO(created) }, { status: 201 })
}
