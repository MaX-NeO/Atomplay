import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { setAuthCookie, signSession, verifyPassword } from '@/lib/auth'
import { toAdminDTO } from '@/lib/serializers'

// POST /api/auth/login
// Body: { email, password } -> sets httpOnly cookie `quiz_admin_token` + returns { admin: AdminDTO }
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const admin = await db.admin.findUnique({ where: { email } })
  if (!admin) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  const ok = await verifyPassword(password, admin.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = signSession({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  })
  await setAuthCookie(token)
  return NextResponse.json({ admin: toAdminDTO(admin) })
}
