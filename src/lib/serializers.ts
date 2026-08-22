// DTO shaping helpers — strip fields the client should never see (e.g. passwordHash)
// and convert Date objects to ISO strings.
import type { Admin, Activity, LeaderboardSection, Question } from '@prisma/client'
import type {
  AdminDTO,
  ActivityDTO,
  AnswerDistribution,
  LeaderboardSectionDTO,
  OptionKey,
  QuestionDTO,
} from '@/lib/types'

export function toAdminDTO(a: Admin): AdminDTO {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role as AdminDTO['role'],
    createdAt: a.createdAt.toISOString(),
  }
}

export function toQuestionDTO(q: Question): QuestionDTO {
  return {
    id: q.id,
    activityId: q.activityId,
    questionOrder: q.questionOrder,
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctOption: q.correctOption as OptionKey,
    timeLimit: q.timeLimit,
  }
}

export function toLeaderboardSectionDTO(ls: LeaderboardSection): LeaderboardSectionDTO {
  return {
    id: ls.id,
    activityId: ls.activityId,
    afterQuestionOrder: ls.afterQuestionOrder,
    isDefault: ls.isDefault,
    title: ls.title,
    createdAt: ls.createdAt.toISOString(),
    updatedAt: ls.updatedAt.toISOString(),
  }
}

export function toActivityDTO(
  a: Activity,
  questions?: Question[],
  leaderboardSections?: LeaderboardSection[],
): ActivityDTO {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status as ActivityDTO['status'],
    accessCode: a.accessCode,
    currentQuestionId: a.currentQuestionId,
    currentLeaderboardId: a.currentLeaderboardId,
    questionStartedAt: a.questionStartedAt ? a.questionStartedAt.toISOString() : null,
    questionEndsAt: a.questionEndsAt ? a.questionEndsAt.toISOString() : null,
    startedAt: a.startedAt ? a.startedAt.toISOString() : null,
    endedAt: a.endedAt ? a.endedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    createdBy: a.createdBy,
    questions: questions ? questions.map(toQuestionDTO) : undefined,
    leaderboardSections: leaderboardSections
      ? leaderboardSections.map(toLeaderboardSectionDTO)
      : undefined,
  }
}

/**
 * Scoring formula:
 *   - Correct: 1000 base + round((remainingMs / totalMs) * 1000) time bonus
 *   - Incorrect: 0
 *
 * Example: 10s question, answered at 6s → remaining 4s →
 *   1000 + (4000 / 10000) * 1000 = 1000 + 400 = 1400
 */
export function computeScore(params: {
  isCorrect: boolean
  timeLimitSec: number
  questionStartedAt: Date
  answeredAt: Date
}): { score: number; timeTakenMs: number } {
  const totalMs = params.timeLimitSec * 1000
  const timeTakenMs = Math.max(
    0,
    params.answeredAt.getTime() - params.questionStartedAt.getTime(),
  )
  const remainingMs = Math.max(0, totalMs - timeTakenMs)
  const score = params.isCorrect
    ? 1000 + Math.round((remainingMs / totalMs) * 1000)
    : 0
  return { score, timeTakenMs }
}

export function emptyDistribution(): AnswerDistribution {
  return { A: 0, B: 0, C: 0, D: 0, total: 0 }
}

export function computeDistribution(
  answers: { selectedOption: string }[],
): AnswerDistribution {
  const d = emptyDistribution()
  for (const a of answers) {
    if (
      a.selectedOption === 'A' ||
      a.selectedOption === 'B' ||
      a.selectedOption === 'C' ||
      a.selectedOption === 'D'
    ) {
      d[a.selectedOption]++
      d.total++
    }
  }
  return d
}

export const VALID_OPTIONS = new Set<OptionKey>(['A', 'B', 'C', 'D'])

export function isValidOption(value: unknown): value is OptionKey {
  return typeof value === 'string' && VALID_OPTIONS.has(value.toUpperCase() as OptionKey)
}
