import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { toAdminDTO } from '@/lib/serializers'

// GET /api/auth/me — returns the currently authenticated admin or 401.
export async function GET() {
  const session = await getAdminFromRequest()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = await db.admin.findUnique({ where: { id: session.id } })
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ admin: toAdminDTO(admin) })
}
