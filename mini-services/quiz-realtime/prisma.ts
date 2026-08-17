// Prisma client for the quiz-realtime mini-service.
//
// Reuses the @prisma/client + generated client from the PARENT project.
// Connects to the same Neon PostgreSQL database.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { __quizRealtimePrisma?: PrismaClient }

export const db =
  globalForPrisma.__quizRealtimePrisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (!globalForPrisma.__quizRealtimePrisma) {
  globalForPrisma.__quizRealtimePrisma = db
}
