// Prisma client — Neon PostgreSQL with pooled connection.
//
// - Runtime (API routes):  uses DATABASE_URL (Neon pooler) for fast serverless queries
// - Migrations:            Prisma CLI uses directUrl (DATABASE_URL_UNPOOLED) automatically
//
// In development we cache the client on globalThis to survive HMR.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
