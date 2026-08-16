import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'

// POST /api/auth/logout — clears the auth cookie, returns { ok: true }.
export async function POST() {
  await clearAuthCookie()
  return NextResponse.json({ ok: true })
}
