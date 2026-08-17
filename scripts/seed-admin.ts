/**
 * Seed script — creates the first SUPER_ADMIN if none exists.
 *
 * Usage:  bun run scripts/seed-admin.ts
 *
 * Uses the SAME password hashing as the app (bcryptjs, 10 salt rounds — see
 * src/lib/auth.ts:hashPassword) so the seeded admin can log in via
 * POST /api/auth/login immediately.
 *
 * Idempotent: if an admin with the given email already exists, it updates the
 * password (and ensures the role is SUPER_ADMIN) instead of erroring.
 */
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const db = new PrismaClient()

const SEED_EMAIL = 'admin@atomcode.dev'
const SEED_PASSWORD = 'Mr@1811321'
const SEED_NAME = 'Atom Code Admin'

async function main() {
  const email = SEED_EMAIL.trim().toLowerCase()
  const passwordHash = await hash(SEED_PASSWORD, 10) // same as src/lib/auth.ts

  const admin = await db.admin.upsert({
    where: { email },
    update: { passwordHash, role: 'SUPER_ADMIN', name: SEED_NAME },
    create: {
      name: SEED_NAME,
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  })

  console.log('✓ Super admin seeded:')
  console.log(JSON.stringify(admin, null, 2))

  const count = await db.admin.count()
  console.log(`\nTotal admins in DB: ${count}`)
}

main()
  .catch((e) => {
    console.error('✗ Seed failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
