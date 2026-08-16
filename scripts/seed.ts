import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

async function main() {
  const email = 'admin@atomcode.dev'
  const password = 'Mr@1811321'

  // Remove any legacy seeded admin so the admin table stays clean.
  await db.admin.deleteMany({ where: { email: 'admin@quiz.local' } })

  const passwordHash = await hashPassword(password)
  const admin = await db.admin.upsert({
    where: { email },
    update: { passwordHash, role: 'SUPER_ADMIN' },
    create: {
      name: 'Super Admin',
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  })
  console.log('Super admin ready:')
  console.log(`  email: ${admin.email}`)
  console.log(`  id:    ${admin.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
