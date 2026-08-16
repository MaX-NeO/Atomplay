// DTO shaping helpers — strip fields the client should never see (e.g. passwordHash)
// and convert Date objects to ISO strings.
import type { Admin, Activity, Question } from '@prisma/client'
import type {
  AdminDTO,
  ActivityDTO,
  AnswerDistribution,
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

export function toActivityDTO(a: Activity, questions?: Question[]): ActivityDTO {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status as ActivityDTO['status'],
    accessCode: a.accessCode,
    currentQuestionId: a.currentQuestionId,
    questionStartedAt: a.questionStartedAt ? a.questionStartedAt.toISOString() : null,
    questionEndsAt: a.questionEndsAt ? a.questionEndsAt.toISOString() : null,
    startedAt: a.startedAt ? a.startedAt.toISOString() : null,
    endedAt: a.endedAt ? a.endedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    createdBy: a.createdBy,
    questions: questions ? questions.map(toQuestionDTO) : undefined,
  }
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
