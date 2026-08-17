// Local copy of the realtime-relevant DTOs/payloads shared with the Next.js
// app (see /home/z/my-project/src/lib/types.ts). Copied (rather than imported
// via relative path) so this mini-service stays self-contained and type-checks
// independently of the parent project's tsconfig.

export type OptionKey = 'A' | 'B' | 'C' | 'D'

export interface AnswerDistribution {
  A: number
  B: number
  C: number
  D: number
  total: number
}

export interface QuestionStartedPayload {
  activityId: string
  questionId: string
  questionOrder: number
  totalQuestions: number
  questionText: string
  options: { key: OptionKey; label: string }[]
  timeLimit: number
  startedAt: string // ISO
  endsAt: string // ISO
}

export interface QuestionEndedPayload {
  activityId: string
  questionId: string
  correctOption: OptionKey
  distribution: AnswerDistribution
}

export interface ResultsUpdatedPayload {
  activityId: string
  questionId: string
  distribution: AnswerDistribution
  participantCount: number
}

export interface ParticipantJoinedPayload {
  activityId: string
  // The participant's DB id — sent so the host can use it as a stable React
  // key AND so `participant_kicked` (which carries the same id) can correctly
  // remove the bubble even if the host never opened the participants sheet.
  participantId: string
  count: number
  displayName: string
  uoid?: string | null
}

export interface ParticipantLeftPayload {
  activityId: string
  count: number
  sessionId: string
}

export interface ActivityStartedPayload {
  activityId: string
}

export interface ActivityCompletedPayload {
  activityId: string
}

export interface ActivityResetPayload {
  activityId: string
}

export interface ParticipantKickedPayload {
  activityId: string
  participantId: string
  sessionId: string
  count: number
}
