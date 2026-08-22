// Shared API + realtime types used by both backend and frontend.

export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'LIVE' | 'COMPLETED' | 'ARCHIVED'
export type AdminRole = 'ADMIN' | 'SUPER_ADMIN'
export type OptionKey = 'A' | 'B' | 'C' | 'D'

export interface AdminDTO {
  id: string
  name: string
  email: string
  role: AdminRole
  createdAt: string
}

export interface QuestionDTO {
  id: string
  activityId: string
  questionOrder: number
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: OptionKey
  timeLimit: number
}

export interface LeaderboardSectionDTO {
  id: string
  activityId: string
  afterQuestionOrder: number | null // null = default final leaderboard
  isDefault: boolean
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityDTO {
  id: string
  title: string
  description: string
  status: ActivityStatus
  accessCode: string | null
  currentQuestionId: string | null
  currentLeaderboardId: string | null
  questionStartedAt: string | null
  questionEndsAt: string | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
  questions?: QuestionDTO[]
  leaderboardSections?: LeaderboardSectionDTO[]
  createdBy: string
}

export interface ParticipantDTO {
  id: string
  activityId: string
  sessionId: string
  uoid: string | null
  displayName: string
  joinedAt: string
}

export interface AnswerDistribution {
  A: number
  B: number
  C: number
  D: number
  total: number
}

// ---- Socket payloads ----
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

// ---- REST responses ----
export interface JoinResponse {
  sessionId: string
  activityId: string
  title: string
  displayName: string
  uoid: string | null
}

export interface ActivityStateResponse {
  activityId: string
  title: string
  status: ActivityStatus
  participantCount: number
  // when LIVE & a question is active:
  currentQuestion?: {
    questionId: string
    questionOrder: number
    totalQuestions: number
    questionText: string
    options: { key: OptionKey; label: string }[]
    timeLimit: number
    startedAt: string
    endsAt: string
  } | null
  // when question ended (reveal) — correct option + distribution
  lastReveal?: {
    questionId: string
    correctOption: OptionKey
    distribution: AnswerDistribution
  } | null
  // when LIVE & a leaderboard is being shown (currentQuestionId === null):
  currentLeaderboard?: {
    leaderboardId: string
    title: string
    isDefault: boolean
    entries: LeaderboardEntry[]
  } | null
}

export interface ActivityResultsResponse {
  activityId: string
  title: string
  totalQuestions: number
  totalParticipants: number
  participation: number // percentage of participants who answered at least once
  averageScore: number // avg correct answers per participant
  highestScore: number
  questions: {
    id: string
    questionOrder: number
    questionText: string
    correctOption: OptionKey
    distribution: AnswerDistribution
  }[]
}

// A single entry in the leaderboard (one participant's cumulative score)
export interface LeaderboardEntry {
  participantId: string
  displayName: string
  uoid: string | null
  totalScore: number
  correctAnswers: number
  answeredQuestions: number
  rank: number
}

// Socket payload for showing a leaderboard
export interface LeaderboardShownPayload {
  activityId: string
  leaderboardId: string
  title: string
  entries: LeaderboardEntry[]
  isDefault: boolean
}
