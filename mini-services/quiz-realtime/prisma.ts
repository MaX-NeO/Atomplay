// Prisma client for the quiz-realtime mini-service.
//
// We reuse the @prisma/client + generated client that lives in the PARENT
// project's node_modules (Bun resolves packages by walking up the directory
// tree). The generated client at /home/z/my-project/node_modules/.prisma/client
// knows the full schema (Admin, Activity, Question, Participant, Answer).
//
// We point the datasource at the SAME SQLite file the Next.js app uses so the
// socket server and the REST API share live state.

import { PrismaClient } from '@prisma/client'

const DEFAULT_DATASOURCE_URL = 'file:/home/z/my-project/db/custom.db'

const datasourceUrl = process.env.DATABASE_URL ?? DEFAULT_DATASOURCE_URL

// Reuse a single client across hot-reloads in dev (bun --hot).
const globalForPrisma = globalThis as unknown as { __quizRealtimePrisma?: PrismaClient }

export const db =
  globalForPrisma.__quizRealtimePrisma ??
  new PrismaClient({
    datasources: { db: { url: datasourceUrl } },
    log: ['error', 'warn'],
  })

if (!globalForPrisma.__quizRealtimePrisma) {
  globalForPrisma.__quizRealtimePrisma = db
}
