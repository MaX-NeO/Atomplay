import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest, hashPassword } from '@/lib/auth'
import { toAdminDTO } from '@/lib/serializers'

// GET /api/admins — SUPER_ADMIN only. Returns all admins (passwordHash stripped).
export async function GET() {
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (admin.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admins = await db.admin.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ admins: admins.map(toAdminDTO) })
}

// POST /api/admins — SUPER_ADMIN only. Creates a new admin.
// Body: { name, email, password, role? }  -> role defaults to 'ADMIN'.
export async function POST(req: Request) {
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (admin.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const role: 'ADMIN' | 'SUPER_ADMIN' = body?.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN'

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email and password are required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  try {
    const created = await db.admin.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role,
      },
    })
    return NextResponse.json({ admin: toAdminDTO(created) }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    throw e
  }
}
