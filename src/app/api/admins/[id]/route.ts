import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest, hashPassword } from '@/lib/auth'
import { toAdminDTO } from '@/lib/serializers'

// PATCH /api/admins/[id] — SUPER_ADMIN only. Updates name/email/password/role.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (admin.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await db.admin.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: any = {}
  if (typeof body?.name === 'string' && body.name.trim()) {
    data.name = body.name.trim()
  }
  if (typeof body?.email === 'string' && body.email.trim()) {
    data.email = body.email.trim().toLowerCase()
  }
  if (typeof body?.password === 'string' && body.password) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    data.passwordHash = await hashPassword(body.password)
  }
  if (body?.role === 'ADMIN' || body?.role === 'SUPER_ADMIN') {
    data.role = body.role
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    const updated = await db.admin.update({ where: { id }, data })
    return NextResponse.json({ admin: toAdminDTO(updated) })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    throw e
  }
}

// DELETE /api/admins/[id] — SUPER_ADMIN only. Prevents self-deletion (409).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminFromRequest()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (admin.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (admin.id === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 409 })
  }

  const existing = await db.admin.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
  }

  await db.admin.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
