import { compare, hash } from 'bcryptjs'
import { sign, verify } from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const APP_SECRET = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || 'dev-secret-change-me'
const COOKIE_NAME = 'quiz_admin_token'
const TOKEN_TTL_SECONDS = 60 * 60 * 12 // 12h

export type AdminRole = 'ADMIN' | 'SUPER_ADMIN'

export interface AdminSession {
  id: string
  email: string
  name: string
  role: AdminRole
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10)
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed)
}

export function signSession(admin: { id: string; email: string; name: string; role: string }): string {
  return sign(
    { id: admin.id, email: admin.email, name: admin.name, role: admin.role as AdminRole } satisfies AdminSession,
    APP_SECRET,
    { expiresIn: TOKEN_TTL_SECONDS },
  )
}

export function verifySession(token: string): AdminSession | null {
  try {
    const payload = verify(token, APP_SECRET) as AdminSession
    return payload
  } catch {
    return null
  }
}

export async function getAdminFromRequest(): Promise<AdminSession | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  const session = verifySession(token)
  if (!session) return null
  // Ensure admin still exists
  const admin = await db.admin.findUnique({ where: { id: session.id } })
  if (!admin) return null
  return session
}

export async function setAuthCookie(token: string) {
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_TTL_SECONDS,
  })
}

export async function clearAuthCookie() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export function generateAccessCode(): string {
  // 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function generateUniqueAccessCode(): Promise<string> {
  // Ensure unique among non-completed activities
  for (let i = 0; i < 10; i++) {
    const code = generateAccessCode()
    const existing = await db.activity.findFirst({
      where: { accessCode: code, status: { not: 'COMPLETED' } },
    })
    if (!existing) return code
  }
  // Fallback with extra digit
  return Math.floor(1000000 + Math.random() * 9000000).toString()
}
