// quiz-realtime — Socket.io mini-service for live quiz sessions.
//
// Port: 3003 (hardcoded, per system rules).
// Path: '/'   (REQUIRED by Caddy gateway).
// State: all state lives in the shared SQLite DB (via Prisma). No Redis.
//
// The browser connects via `io("/?XTransformPort=3003")` — same-origin from
// the browser's POV (Caddy handles routing).
//
// See /home/z/my-project/worklog.md for the full socket event contract.

import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { db } from './prisma'
import type {
  AnswerDistribution,
  OptionKey,
  QuestionEndedPayload,
  QuestionStartedPayload,
  ResultsUpdatedPayload,
  ParticipantJoinedPayload,
  ActivityStartedPayload,
  ActivityCompletedPayload,
  ActivityResetPayload,
  ParticipantKickedPayload,
} from './types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = 3003

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*' }, // Caddy handles routing; allow all origins.
})

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

// Per-activity tracking of which (activityId:questionId) we've already
// auto-expired, so the 1-second ticker never fires `question_ended` twice for
// the same question. Cleared when a NEW question starts for that activity.
const autoEndedQuestions = new Set<string>()

interface SocketData {
  role?: 'admin' | 'participant'
  activityId?: string
  adminId?: string
  sessionId?: string
  displayName?: string
}

function dataOf(socket: Socket): SocketData {
  return (socket as unknown as { data: SocketData }).data
}

function roomFor(activityId: string): string {
  return `activity:${activityId}`
}

function isOptionKey(s: unknown): s is OptionKey {
  return s === 'A' || s === 'B' || s === 'C' || s === 'D'
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === 'P2002'
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function computeDistribution(questionId: string): Promise<AnswerDistribution> {
  const answers = await db.answer.findMany({
    where: { questionId },
    select: { selectedOption: true },
  })
  const dist: AnswerDistribution = { A: 0, B: 0, C: 0, D: 0, total: answers.length }
  for (const a of answers) {
    if (isOptionKey(a.selectedOption)) dist[a.selectedOption]++
  }
  return dist
}

async function buildQuestionStartedPayload(params: {
  activityId: string
  question: {
    id: string
    questionOrder: number
    questionText: string
    optionA: string
    optionB: string
    optionC: string
    optionD: string
    timeLimit: number
  }
  startedAt: Date
  endsAt: Date
}): Promise<QuestionStartedPayload> {
  const totalQuestions = await db.question.count({
    where: { activityId: params.activityId },
  })
  return {
    activityId: params.activityId,
    questionId: params.question.id,
    questionOrder: params.question.questionOrder,
    totalQuestions,
    questionText: params.question.questionText,
    options: [
      { key: 'A', label: params.question.optionA },
      { key: 'B', label: params.question.optionB },
      { key: 'C', label: params.question.optionC },
      { key: 'D', label: params.question.optionD },
    ],
    timeLimit: params.question.timeLimit,
    startedAt: params.startedAt.toISOString(),
    endsAt: params.endsAt.toISOString(),
  }
}

function clearAutoEndedForActivity(activityId: string): void {
  for (const key of Array.from(autoEndedQuestions.keys())) {
    if (key.startsWith(`${activityId}:`)) autoEndedQuestions.delete(key)
  }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`[socket] connected id=${socket.id}`)

  // -------------------- Participant -> server --------------------

  socket.on('join_activity', async (payloadRaw: unknown, ack?: (r: unknown) => void) => {
    try {
      const payload = payloadRaw as { activityId?: string; sessionId?: string }
      const activityId = payload?.activityId
      const sessionId = payload?.sessionId
      if (!activityId || !sessionId) {
        socket.emit('error', { message: 'activityId and sessionId are required' })
        ack?.({ ok: false, error: 'invalid_payload' })
        return
      }
      const participant = await db.participant.findUnique({ where: { sessionId } })
      if (!participant || participant.activityId !== activityId) {
        socket.emit('error', { message: 'Participant not found for this activity' })
        ack?.({ ok: false, error: 'participant_not_found' })
        return
      }

      await db.participant.update({
        where: { id: participant.id },
        data: { lastSeenAt: new Date() },
      })

      const room = roomFor(activityId)
      socket.join(room)
      dataOf(socket).role = 'participant'
      dataOf(socket).activityId = activityId
      dataOf(socket).sessionId = sessionId
      dataOf(socket).displayName = participant.displayName

      const count = await db.participant.count({ where: { activityId } })
      const joined: ParticipantJoinedPayload = {
        activityId,
        participantId: participant.id,
        count,
        displayName: participant.displayName,
        uoid: participant.uoid,
      }
      io.to(room).emit('participant_joined', joined)
      console.log(
        `[join_activity] participant "${participant.displayName}" joined activity=${activityId} count=${count}`,
      )

      // Late-joiner / reconnect sync: replay current question state.
      const activity = await db.activity.findUnique({ where: { id: activityId } })
      if (activity && activity.status === 'LIVE' && activity.currentQuestionId) {
        const question = await db.question.findUnique({
          where: { id: activity.currentQuestionId },
        })
        if (question && activity.questionStartedAt && activity.questionEndsAt) {
          const nowMs = Date.now()
          const endsAtMs = activity.questionEndsAt.getTime()
          if (nowMs < endsAtMs) {
            // Question still live — send question_started WITHOUT correctOption.
            const qsp = await buildQuestionStartedPayload({
              activityId,
              question,
              startedAt: activity.questionStartedAt,
              endsAt: activity.questionEndsAt,
            })
            socket.emit('question_started', qsp)
          } else {
            // Question already ended, awaiting admin reveal — send question_ended
            // (with correctOption) so the late joiner sees the reveal.
            const dist = await computeDistribution(question.id)
            const qep: QuestionEndedPayload = {
              activityId,
              questionId: question.id,
              correctOption: question.correctOption as OptionKey,
              distribution: dist,
            }
            socket.emit('question_ended', qep)
          }
        }
      }

      ack?.({ ok: true, count })
    } catch (e) {
      console.error('[join_activity] error', e)
      socket.emit('error', { message: 'Failed to join activity' })
      ack?.({ ok: false, error: 'internal' })
    }
  })

  socket.on('submit_answer', async (payloadRaw: unknown) => {
    try {
      const payload = payloadRaw as {
        activityId?: string
        questionId?: string
        sessionId?: string
        selectedOption?: string
      }
      const { activityId, questionId, sessionId, selectedOption } = payload
      if (!activityId || !questionId || !sessionId || !isOptionKey(selectedOption)) {
        socket.emit('error', { message: 'Invalid submit_answer payload' })
        return
      }

      const activity = await db.activity.findUnique({ where: { id: activityId } })
      if (!activity || activity.status !== 'LIVE') {
        socket.emit('error', { message: 'Activity is not live' })
        return
      }
      if (activity.currentQuestionId !== questionId) {
        socket.emit('error', { message: 'Question is not the current question' })
        return
      }
      const endsAtMs = activity.questionEndsAt ? activity.questionEndsAt.getTime() : 0
      if (Date.now() > endsAtMs) {
        socket.emit('error', { message: 'Question is closed' })
        return
      }

      const question = await db.question.findUnique({ where: { id: questionId } })
      if (!question || question.activityId !== activityId) {
        socket.emit('error', { message: 'Question not found for this activity' })
        return
      }

      const participant = await db.participant.findUnique({ where: { sessionId } })
      if (!participant || participant.activityId !== activityId) {
        socket.emit('error', { message: 'Participant not found for this activity' })
        return
      }

      const isCorrect = selectedOption === question.correctOption
      try {
        await db.answer.create({
          data: {
            activityId,
            questionId,
            participantId: participant.id,
            selectedOption,
            isCorrect,
          },
        })
        console.log(
          `[submit_answer] "${participant.displayName}" -> ${selectedOption} (correct=${isCorrect}) q=${questionId}`,
        )
      } catch (e) {
        // P2002 = unique violation on (participantId, questionId). Idempotent:
        // ignore the duplicate, then recompute distribution as if the answer
        // had been recorded.
        if (!isPrismaUniqueViolation(e)) throw e
        console.log(
          `[submit_answer] duplicate ignored participant=${participant.id} q=${questionId}`,
        )
      }

      const distribution = await computeDistribution(questionId)
      const participantCount = await db.participant.count({ where: { activityId } })
      const results: ResultsUpdatedPayload = {
        activityId,
        questionId,
        distribution,
        participantCount,
      }
      io.to(roomFor(activityId)).emit('results_updated', results)
    } catch (e) {
      console.error('[submit_answer] error', e)
      socket.emit('error', { message: 'Failed to submit answer' })
    }
  })

  // -------------------- Admin -> server --------------------

  socket.on('host_activity', async (payloadRaw: unknown, ack?: (r: unknown) => void) => {
    try {
      const payload = payloadRaw as { activityId?: string; adminId?: string }
      const { activityId, adminId } = payload
      if (!activityId || !adminId) {
        socket.emit('error', { message: 'activityId and adminId are required' })
        ack?.({ ok: false, error: 'invalid_payload' })
        return
      }
      const admin = await db.admin.findUnique({ where: { id: adminId } })
      if (!admin) {
        socket.emit('error', { message: 'Admin not found' })
        ack?.({ ok: false, error: 'admin_not_found' })
        return
      }
      const room = roomFor(activityId)
      socket.join(room)
      dataOf(socket).role = 'admin'
      dataOf(socket).activityId = activityId
      dataOf(socket).adminId = adminId
      const count = await db.participant.count({ where: { activityId } })
      console.log(
        `[host_activity] admin=${adminId} hosting activity=${activityId} count=${count}`,
      )
      ack?.({ ok: true, count })
    } catch (e) {
      console.error('[host_activity] error', e)
      socket.emit('error', { message: 'Failed to host activity' })
      ack?.({ ok: false, error: 'internal' })
    }
  })

  socket.on('start_activity', async (payloadRaw: unknown) => {
    try {
      const { activityId } = payloadRaw as { activityId?: string }
      const data = dataOf(socket)
      if (data.role !== 'admin' || data.activityId !== activityId) {
        socket.emit('error', { message: 'Not authorized' })
        return
      }
      const activity = await db.activity.findUnique({ where: { id: activityId! } })
      if (!activity) {
        socket.emit('error', { message: 'Activity not found' })
        return
      }
      if (activity.status !== 'PUBLISHED') {
        socket.emit('error', {
          message: `Activity must be PUBLISHED (current: ${activity.status})`,
        })
        return
      }
      const now = new Date()
      await db.activity.update({
        where: { id: activityId },
        data: {
          status: 'LIVE',
          startedAt: now,
          endedAt: null,
          currentQuestionId: null,
          questionStartedAt: null,
          questionEndsAt: null,
        },
      })
      const started: ActivityStartedPayload = { activityId: activityId! }
      io.to(roomFor(activityId!)).emit('activity_started', started)
      console.log(`[start_activity] activity=${activityId} is now LIVE`)
    } catch (e) {
      console.error('[start_activity] error', e)
      socket.emit('error', { message: 'Failed to start activity' })
    }
  })

  socket.on('start_question', async (payloadRaw: unknown) => {
    try {
      const { activityId, questionId } = payloadRaw as {
        activityId?: string
        questionId?: string
      }
      const data = dataOf(socket)
      if (data.role !== 'admin' || data.activityId !== activityId || !activityId || !questionId) {
        socket.emit('error', { message: 'Not authorized' })
        return
      }
      const activity = await db.activity.findUnique({ where: { id: activityId } })
      if (!activity || activity.status !== 'LIVE') {
        socket.emit('error', { message: 'Activity is not LIVE' })
        return
      }
      const question = await db.question.findUnique({ where: { id: questionId } })
      if (!question || question.activityId !== activityId) {
        socket.emit('error', { message: 'Question not found for this activity' })
        return
      }
      const now = new Date()
      const endsAt = new Date(now.getTime() + question.timeLimit * 1000)
      await db.activity.update({
        where: { id: activityId },
        data: {
          currentQuestionId: question.id,
          questionStartedAt: now,
          questionEndsAt: endsAt,
        },
      })
      // New question for this activity — clear any prior auto-end tracking.
      clearAutoEndedForActivity(activityId)
      const qsp = await buildQuestionStartedPayload({
        activityId,
        question,
        startedAt: now,
        endsAt,
      })
      io.to(roomFor(activityId)).emit('question_started', qsp)
      console.log(
        `[start_question] activity=${activityId} q=${questionId} order=${question.questionOrder} endsAt=${endsAt.toISOString()}`,
      )
    } catch (e) {
      console.error('[start_question] error', e)
      socket.emit('error', { message: 'Failed to start question' })
    }
  })

  socket.on('end_question', async (payloadRaw: unknown) => {
    try {
      const { activityId } = payloadRaw as { activityId?: string }
      const data = dataOf(socket)
      if (data.role !== 'admin' || data.activityId !== activityId || !activityId) {
        socket.emit('error', { message: 'Not authorized' })
        return
      }
      const activity = await db.activity.findUnique({ where: { id: activityId } })
      if (!activity || activity.status !== 'LIVE' || !activity.currentQuestionId) {
        socket.emit('error', { message: 'No active question to end' })
        return
      }
      const now = new Date()
      await db.activity.update({
        where: { id: activityId },
        data: { questionEndsAt: now },
      })
      const question = await db.question.findUnique({
        where: { id: activity.currentQuestionId },
      })
      if (!question) return
      const dist = await computeDistribution(question.id)
      const qep: QuestionEndedPayload = {
        activityId,
        questionId: question.id,
        correctOption: question.correctOption as OptionKey,
        distribution: dist,
      }
      // Mark as ended so the auto-expire ticker doesn't double-fire.
      autoEndedQuestions.add(`${activityId}:${question.id}`)
      io.to(roomFor(activityId)).emit('question_ended', qep)
      console.log(`[end_question] activity=${activityId} q=${question.id} revealed`)
    } catch (e) {
      console.error('[end_question] error', e)
      socket.emit('error', { message: 'Failed to end question' })
    }
  })

  socket.on('end_activity', async (payloadRaw: unknown) => {
    try {
      const { activityId } = payloadRaw as { activityId?: string }
      const data = dataOf(socket)
      if (data.role !== 'admin' || data.activityId !== activityId || !activityId) {
        socket.emit('error', { message: 'Not authorized' })
        return
      }
      const activity = await db.activity.findUnique({ where: { id: activityId } })
      if (!activity || activity.status !== 'LIVE') {
        socket.emit('error', { message: 'Activity is not LIVE' })
        return
      }
      const now = new Date()
      await db.activity.update({
        where: { id: activityId },
        data: {
          status: 'COMPLETED',
          endedAt: now,
          currentQuestionId: null,
          questionStartedAt: null,
          questionEndsAt: null,
        },
      })
      const completed: ActivityCompletedPayload = { activityId }
      io.to(roomFor(activityId)).emit('activity_completed', completed)
      console.log(`[end_activity] activity=${activityId} COMPLETED`)
    } catch (e) {
      console.error('[end_activity] error', e)
      socket.emit('error', { message: 'Failed to end activity' })
    }
  })

  // Reset activity (admin aborts the live session and returns to start mode).
  // This does NOT mutate the DB — it only broadcasts `activity_reset` to all
  // connected clients in the activity room. The actual DB wipe (participants +
  // status -> PUBLISHED) is performed by the REST endpoint
  // POST /api/activities/[id]/reset, which the admin calls immediately after
  // emitting this event. The broadcast is fired FIRST so participants get a
  // chance to navigate away from the live screen before their Participant row
  // is deleted.
  socket.on('reset_activity', async (payloadRaw: unknown) => {
    try {
      const { activityId } = payloadRaw as { activityId?: string }
      const data = dataOf(socket)
      if (data.role !== 'admin' || data.activityId !== activityId || !activityId) {
        socket.emit('error', { message: 'Not authorized' })
        return
      }
      const payload: ActivityResetPayload = { activityId }
      io.to(roomFor(activityId)).emit('activity_reset', payload)
      console.log(`[reset_activity] activity=${activityId} broadcast activity_reset`)
    } catch (e) {
      console.error('[reset_activity] error', e)
      socket.emit('error', { message: 'Failed to reset activity' })
    }
  })

  // -------------------- Admin: kick a participant --------------------
  // Removes the participant from the DB (cascade-deletes their answers),
  // then broadcasts `participant_kicked` to the whole activity room so:
  //   - the kicked participant's client navigates back to the join screen
  //     (it matches on sessionId)
  //   - the admin's lobby bubble list removes that participant
  //   - the live participant count is updated everywhere.
  socket.on('kick_participant', async (payloadRaw: unknown) => {
    try {
      const { activityId, participantId } = payloadRaw as {
        activityId?: string
        participantId?: string
      }
      const data = dataOf(socket)
      if (data.role !== 'admin' || data.activityId !== activityId || !activityId || !participantId) {
        socket.emit('error', { message: 'Not authorized' })
        return
      }
      const participant = await db.participant.findUnique({
        where: { id: participantId },
        select: { id: true, sessionId: true, activityId: true },
      })
      if (!participant || participant.activityId !== activityId) {
        socket.emit('error', { message: 'Participant not found for this activity' })
        return
      }
      // Cascade deletes the participant's answers (FK onDelete: Cascade).
      await db.participant.delete({ where: { id: participantId } })
      const count = await db.participant.count({ where: { activityId } })
      const payload: ParticipantKickedPayload = {
        activityId,
        participantId,
        sessionId: participant.sessionId,
        count,
      }
      io.to(roomFor(activityId)).emit('participant_kicked', payload)
      console.log(
        `[kick_participant] activity=${activityId} participant=${participantId} (session=${participant.sessionId}) removed; count=${count}`,
      )
    } catch (e) {
      console.error('[kick_participant] error', e)
      socket.emit('error', { message: 'Failed to kick participant' })
    }
  })

  // -------------------- Disconnect --------------------

  socket.on('disconnect', (reason) => {
    const data = dataOf(socket)
    console.log(
      `[socket] disconnected id=${socket.id} role=${data.role ?? '?'} activity=${data.activityId ?? '?'} reason=${reason}`,
    )
    // NOTE: For MVP we intentionally do NOT emit `participant_left`. Participant
    // counts are DB-based (db.participant.count), so they always reflect the
    // true number of joined participants — not the number of live sockets.
    // Leaving the room implicitly on disconnect is enough.
  })
})

// ---------------------------------------------------------------------------
// Auto-expire ticker (server-side source of truth for question deadlines)
// ---------------------------------------------------------------------------

setInterval(async () => {
  try {
    const now = new Date()
    const due = await db.activity.findMany({
      where: {
        status: 'LIVE',
        currentQuestionId: { not: null },
        questionEndsAt: { lt: now },
      },
    })
    for (const activity of due) {
      const questionId = activity.currentQuestionId
      if (!questionId) continue
      const key = `${activity.id}:${questionId}`
      if (autoEndedQuestions.has(key)) continue // already fired
      const question = await db.question.findUnique({ where: { id: questionId } })
      if (!question) continue
      const dist = await computeDistribution(questionId)
      const qep: QuestionEndedPayload = {
        activityId: activity.id,
        questionId,
        correctOption: question.correctOption as OptionKey,
        distribution: dist,
      }
      io.to(roomFor(activity.id)).emit('question_ended', qep)
      autoEndedQuestions.add(key)
      console.log(
        `[auto-end] activity=${activity.id} q=${questionId} auto-expired (revealed)`,
      )
    }
  } catch (e) {
    console.error('[auto-expire] error', e)
  }
}, 1000)

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(
    `[server] quiz-realtime listening on http://0.0.0.0:${PORT} (path=/)`,
  )
})

// Graceful shutdown — close the Prisma client so bun --hot restarts cleanly.
process.on('SIGINT', () => {
  console.log('[server] SIGINT received, shutting down')
  io.close()
  httpServer.close()
  void db.$disconnect()
  process.exit(0)
})
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down')
  io.close()
  httpServer.close()
  void db.$disconnect()
  process.exit(0)
})
