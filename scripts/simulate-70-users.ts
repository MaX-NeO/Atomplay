/* eslint-disable no-console */
/**
 * simulate-70-users.ts
 *
 * End-to-end simulation of a live quiz activity with 70 participants.
 *
 * Flow:
 *   1. Admin login (REST) -> get auth cookie.
 *   2. Create a DRAFT activity "Simulated Quiz — 70 Users".
 *   3. Add 3 multiple-choice questions.
 *   4. Publish -> capture the 6-digit access code.
 *   5. Open an admin socket and `host_activity`.
 *   6. `start_activity` (status -> LIVE).
 *   7. Spin up 70 socket.io clients. Each:
 *        - joins via REST /api/join (unique UOID + displayName)
 *        - connects its socket and emits `join_activity`
 *        - waits for `question_started`, picks an option (biased toward the
 *          correct answer but with realistic spread), emits `submit_answer`
 *        - waits for `question_ended` (reveal)
 *   8. For each question: admin `start_question`, wait for all 70 answers, then
 *      `end_question`.
 *   9. `end_activity` -> status COMPLETED.
 *  10. Fetch /api/activities/[id]/results and print the summary.
 *
 * Usage:  bun run scripts/simulate-70-users.ts
 */
import { io, type Socket } from 'socket.io-client'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE = process.env.SIM_BASE_URL || 'http://localhost:3000'
const NUM_PARTICIPANTS = Number(process.env.SIM_USERS || '70')
const ADMIN_EMAIL = 'admin@atomcode.dev'
const ADMIN_PASSWORD = 'Mr@1811321'

const QUESTIONS = [
  {
    questionText: 'What is the capital of France?',
    optionA: 'Berlin',
    optionB: 'Madrid',
    optionC: 'Paris',
    optionD: 'Rome',
    correctOption: 'C' as const,
    timeLimit: 20,
  },
  {
    questionText: 'Which language compiles to WebAssembly natively in modern browsers?',
    optionA: 'Python',
    optionB: 'Rust',
    optionC: 'Ruby',
    optionD: 'PHP',
    correctOption: 'B' as const,
    timeLimit: 20,
  },
  {
    questionText: 'What does Prisma ORM primarily abstract?',
    optionA: 'CSS styles',
    optionB: 'Network firewalls',
    optionC: 'Database access',
    optionD: 'Filesystem IO',
    correctOption: 'C' as const,
    timeLimit: 20,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[sim] ${msg}`)
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

interface ParticipantInfo {
  index: number
  uoid: string
  displayName: string
  sessionId: string
  activityId: string
  socket: Socket
  receivedQuestion: boolean
  submitted: boolean
  lastSeenReveal: boolean
}

async function adminLogin(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!res.ok) throw new Error(`admin login failed: ${res.status} ${await res.text()}`)
  // Extract Set-Cookie manually (Node fetch keeps it on res.headers)
  const cookie = res.headers.get('set-cookie')
  if (!cookie) throw new Error('no Set-Cookie header on login response')
  // Return only the name=value pair (drop attributes)
  const tokenPair = cookie.split(';')[0]
  return tokenPair
}

async function adminFetch(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Cookie: cookie,
      ...(init.headers || {}),
    },
  })
}

async function createActivity(cookie: string, title: string, description: string): Promise<string> {
  const res = await adminFetch('/api/activities', cookie, {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  })
  if (!res.ok) throw new Error(`create activity failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.activity.id as string
}

async function addQuestion(cookie: string, activityId: string, q: (typeof QUESTIONS)[number]) {
  const res = await adminFetch(`/api/activities/${activityId}/questions`, cookie, {
    method: 'POST',
    body: JSON.stringify(q),
  })
  if (!res.ok) throw new Error(`add question failed: ${res.status} ${await res.text()}`)
  return (await res.json()).question
}

async function publishActivity(cookie: string, activityId: string): Promise<string> {
  const res = await adminFetch(`/api/activities/${activityId}/publish`, cookie, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`publish failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.activity.accessCode as string
}

async function fetchState(accessCode: string) {
  const res = await fetch(`${BASE}/api/activities/${accessCode}/state`)
  if (!res.ok) throw new Error(`state fetch failed: ${res.status}`)
  return res.json()
}

async function fetchResults(cookie: string, activityId: string) {
  const res = await adminFetch(`/api/activities/${activityId}/results`, cookie)
  if (!res.ok) throw new Error(`results fetch failed: ${res.status}`)
  return res.json()
}

// Pick an option with a realistic distribution: ~62% correct, rest spread.
function pickOption(correct: 'A' | 'B' | 'C' | 'D'): 'A' | 'B' | 'C' | 'D' {
  const r = Math.random()
  const wrong = (['A', 'B', 'C', 'D'] as const).filter((o) => o !== correct)
  if (r < 0.62) return correct
  // distribute the wrong answers somewhat evenly
  const idx = Math.floor(Math.random() * wrong.length)
  return wrong[idx]
}

function makeSocket(): Socket {
  // Connect directly to the socket.io mini-service on :3003 (bypassing the
  // Caddy gateway which is only needed for browser same-origin requests).
  // The mini-service sets path: '/' so the default socket.io path works.
  const SOCKET_URL = process.env.SIM_SOCKET_URL || 'http://localhost:3003'
  return io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 600,
    timeout: 10000,
    forceNew: true,
  })
}

async function joinParticipant(
  accessCode: string,
  index: number,
): Promise<{ sessionId: string; activityId: string; uoid: string; displayName: string }> {
  const uoid = `SIM-${String(index).padStart(3, '0')}`
  const displayName = `Player${index.toString().padStart(2, '0')}`
  const res = await fetch(`${BASE}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode, displayName, uoid }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`join failed for ${displayName} (uoid=${uoid}): ${res.status} ${txt}`)
  }
  const data = await res.json()
  return {
    sessionId: data.sessionId,
    activityId: data.activityId,
    uoid,
    displayName,
  }
}

function connectParticipant(p: {
  index: number
  sessionId: string
  activityId: string
  displayName: string
  correctOption: 'A' | 'B' | 'C' | 'D'
}): { socket: Socket; info: ParticipantInfo } {
  const socket = makeSocket()
  const info: ParticipantInfo = {
    index: p.index,
    uoid: '',
    sessionId: p.sessionId,
    activityId: p.activityId,
    displayName: p.displayName,
    socket,
    receivedQuestion: false,
    submitted: false,
    lastSeenReveal: false,
  }

  // NOTE: join_activity is emitted by the caller (with an ack callback) so
  // the caller's promise can resolve on the ack. We only register event
  // listeners here.

  socket.on('question_started', (payload: { questionId: string }) => {
    info.receivedQuestion = true
    const choice = pickOption(p.correctOption)
    // Small random delay (300-1500ms) to simulate think time + network jitter.
    const delay = 300 + Math.floor(Math.random() * 1200)
    setTimeout(() => {
      if (info.submitted) return
      info.submitted = true
      socket.emit('submit_answer', {
        activityId: p.activityId,
        questionId: payload.questionId,
        sessionId: p.sessionId,
        selectedOption: choice,
      })
    }, delay)
  })

  socket.on('question_ended', () => {
    info.lastSeenReveal = true
  })

  socket.on('error', (err: unknown) => {
    console.error(`[socket ${p.displayName}] error:`, err)
  })

  return { socket, info }
}

async function waitFor(predicate: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await sleep(200)
  }
  throw new Error(`timeout waiting for ${label} (${timeoutMs}ms)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(`Simulating a live quiz with ${NUM_PARTICIPANTS} participants`)
  log(`Target: ${BASE}`)

  // 1. Admin login
  const cookie = await adminLogin()
  log('Admin logged in (cookie acquired)')

  // 2. Create activity
  const activityId = await createActivity(
    cookie,
    'Simulated Quiz — 70 Users',
    'End-to-end simulation of a live quiz session with 70 concurrent participants.',
  )
  log(`Created activity: ${activityId}`)

  // 3. Add questions
  for (const q of QUESTIONS) {
    await addQuestion(cookie, activityId, q)
  }
  log(`Added ${QUESTIONS.length} questions`)

  // 4. Publish
  const accessCode = await publishActivity(cookie, activityId)
  log(`Published. Access code: ${accessCode}`)

  // 5. Fetch real admin id (host_activity validates adminId against DB)
  const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } })
  const meData = await meRes.json()
  const adminId = meData?.admin?.id
  if (!adminId) throw new Error('could not resolve admin id from /api/auth/me')
  log(`Admin id: ${adminId}`)

  // 6. Admin socket: host_activity (with real admin id) then start_activity
  const adminSocket2 = makeSocket()
  await new Promise<void>((resolve, reject) => {
    adminSocket2.once('connect', () => resolve())
    adminSocket2.once('connect_error', (err: Error) => reject(err))
    setTimeout(() => reject(new Error('admin socket connect timeout')), 10000)
  })
  const hostAck2 = await new Promise<{ ok: boolean; count?: number }>((resolve) => {
    adminSocket2.emit(
      'host_activity',
      { activityId, adminId },
      (ack: unknown) => resolve(ack as { ok: boolean; count?: number }),
    )
  })
  log(`host_activity ack: ${JSON.stringify(hostAck2)}`)
  if (!hostAck2?.ok) {
    throw new Error('host_activity failed — admin not authorized on socket')
  }

  // start_activity (status -> LIVE)
  await new Promise<void>((resolve) => {
    adminSocket2.emit('start_activity', { activityId })
    setTimeout(resolve, 500)
  })
  const liveState = await fetchState(accessCode)
  log(`After start_activity: status=${liveState.status} participants=${liveState.participantCount}`)
  if (liveState.status !== 'LIVE') throw new Error(`activity not LIVE (got ${liveState.status})`)

  // 7. Spawn 70 participants (REST join + socket connect, staggered)
  log(`Spawning ${NUM_PARTICIPANTS} participants...`)
  const participants: ParticipantInfo[] = []
  const BATCH = 10
  for (let i = 0; i < NUM_PARTICIPANTS; i += BATCH) {
    const batch = []
    for (let j = 0; j < BATCH && i + j < NUM_PARTICIPANTS; j++) {
      const idx = i + j + 1
      batch.push(
        (async () => {
          const joined = await joinParticipant(accessCode, idx)
          const { socket, info } = connectParticipant({
            index: idx,
            sessionId: joined.sessionId,
            activityId: joined.activityId,
            displayName: joined.displayName,
            correctOption: QUESTIONS[0].correctOption,
          })
          participants.push(info)
          // Wait for socket connect, then emit join_activity and await ack.
          await new Promise<void>((resolve, reject) => {
            const to = setTimeout(
              () => reject(new Error(`socket connect timeout for ${joined.displayName}`)),
              10000,
            )
            const doJoin = () => {
              socket.emit(
                'join_activity',
                { activityId: joined.activityId, sessionId: joined.sessionId },
                (ack: { ok?: boolean }) => {
                  clearTimeout(to)
                  if (ack?.ok) resolve()
                  else reject(new Error(`join_activity ack failed: ${JSON.stringify(ack)}`))
                },
              )
            }
            if (socket.connected) doJoin()
            else socket.once('connect', doJoin)
          })
        })(),
      )
    }
    await Promise.all(batch)
    process.stdout.write(`  joined ${Math.min(i + BATCH, NUM_PARTICIPANTS)}/${NUM_PARTICIPANTS}\r`)
  }
  log(`All ${participants.length} participants joined and sockets connected`)

  const stateAfterJoin = await fetchState(accessCode)
  log(`Lobby participant count: ${stateAfterJoin.participantCount}`)

  // 8. Run each question
  for (let qi = 0; qi < QUESTIONS.length; qi++) {
    const q = QUESTIONS[qi]
    log(`--- Question ${qi + 1}/${QUESTIONS.length}: "${q.questionText}" ---`)

    // Reset per-question flags
    for (const p of participants) {
      p.receivedQuestion = false
      p.submitted = false
      p.lastSeenReveal = false
      // Re-bind the question_started handler with this question's correctOption.
      p.socket.removeAllListeners('question_started')
      p.socket.removeAllListeners('question_ended')
      p.socket.on('question_started', (payload: { questionId: string }) => {
        p.receivedQuestion = true
        const choice = pickOption(q.correctOption)
        const delay = 300 + Math.floor(Math.random() * (q.timeLimit * 1000 - 600))
        setTimeout(() => {
          if (p.submitted) return
          p.submitted = true
          p.socket.emit('submit_answer', {
            activityId: p.activityId,
            questionId: payload.questionId,
            sessionId: p.sessionId,
            selectedOption: choice,
          })
        }, Math.min(delay, (q.timeLimit - 1) * 1000))
      })
      p.socket.on('question_ended', () => {
        p.lastSeenReveal = true
      })
    }

    // Fetch the question list to find the id for questionOrder qi+1
    const activitiesRes = await adminFetch('/api/activities', cookie)
    const activitiesData = await activitiesRes.json()
    const activity = activitiesData.activities.find((a: { id: string }) => a.id === activityId)
    // Fetch full activity (with questions) via the GET /api/activities/[id] endpoint
    const actRes = await adminFetch(`/api/activities/${activityId}`, cookie)
    const actData = await actRes.json()
    const questionList = actData.activity?.questions || actData.questions || []
    const question = questionList.find((qq: { questionOrder: number }) => qq.questionOrder === qi + 1)
    if (!question) throw new Error(`could not find question order ${qi + 1}`)
    log(`  Question id=${question.id} order=${question.questionOrder} correct=${q.correctOption}`)

    // start_question
    adminSocket2.emit('start_question', { activityId, questionId: question.id })

    // Wait for all participants to receive the question
    try {
      await waitFor(
        () => participants.every((p) => p.receivedQuestion),
        5000,
        `all participants to receive Q${qi + 1}`,
      )
    } catch (e) {
      const missing = participants.filter((p) => !p.receivedQuestion).length
      log(`  WARN: ${missing} participants did not receive Q${qi + 1} start event`)
    }
    log(`  Question started, waiting for answers (up to ${q.timeLimit}s)...`)

    // Wait for all participants to submit (or question to time out)
    const submitDeadline = Date.now() + (q.timeLimit + 5) * 1000
    while (Date.now() < submitDeadline) {
      const submitted = participants.filter((p) => p.submitted).length
      if (submitted === participants.length) break
      await sleep(500)
    }
    const submittedCount = participants.filter((p) => p.submitted).length
    log(`  Submitted: ${submittedCount}/${participants.length}`)

    // end_question (reveal)
    adminSocket2.emit('end_question', { activityId })
    await waitFor(
      () => participants.every((p) => p.lastSeenReveal),
      5000,
      `all participants to see Q${qi + 1} reveal`,
    ).catch(() => {
      const missed = participants.filter((p) => !p.lastSeenReveal).length
      log(`  WARN: ${missed} participants did not see Q${qi + 1} reveal`)
    })
    log(`  Question ${qi + 1} revealed`)
    await sleep(800)
  }

  // 9. End activity
  adminSocket2.emit('end_activity', { activityId })
  await sleep(1500)
  const finalState = await fetchState(accessCode)
  log(`After end_activity: status=${finalState.status}`)
  if (finalState.status !== 'COMPLETED') {
    log(`  WARN: expected COMPLETED, got ${finalState.status}`)
  }

  // 10. Results
  const results = await fetchResults(cookie, activityId)
  log('=== RESULTS ===')
  log(`Title:              ${results.title}`)
  log(`Total questions:    ${results.totalQuestions}`)
  log(`Total participants: ${results.totalParticipants}`)
  log(`Participation:      ${results.participation}%`)
  log(`Average score:      ${results.averageScore}`)
  log(`Highest score:      ${results.highestScore}`)
  log('Per-question distributions:')
  for (const q of results.questions) {
    log(
      `  Q${q.questionOrder} "${q.questionText}" correct=${q.correctOption} ` +
        `A=${q.distribution.A} B=${q.distribution.B} C=${q.distribution.C} D=${q.distribution.D} ` +
        `total=${q.distribution.total}`,
    )
  }

  // Cleanup sockets
  for (const p of participants) {
    try {
      p.socket.removeAllListeners()
      p.socket.disconnect()
    } catch {
      /* noop */
    }
  }
  adminSocket2.removeAllListeners()
  adminSocket2.disconnect()
  log('Simulation complete.')

  // Summary line for easy grepping
  console.log(
    `\n[SIM RESULT] participants=${results.totalParticipants} ` +
      `participation=${results.participation}% ` +
      `avgScore=${results.averageScore} maxScore=${results.highestScore} ` +
      `accessCode=${accessCode} activityId=${activityId}`,
  )
}

main()
  .catch((e) => {
    console.error('[sim] FATAL:', e)
    process.exit(1)
  })
  .finally(() => {
    // Give sockets a moment to close cleanly
    setTimeout(() => process.exit(0), 500)
  })
