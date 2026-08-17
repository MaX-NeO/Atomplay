/* eslint-disable no-console */
/**
 * fill-lobby-70.ts — lightweight variant that ONLY joins 70 participants
 * to a PUBLISHED activity (by access code) so the admin browser can capture
 * a lobby screenshot showing 70 bubble circles. Does NOT start the activity
 * or answer any questions.
 *
 * Usage: ACCESS_CODE=<6-digit-code> bun run scripts/fill-lobby-70.ts
 */
import { io, type Socket } from 'socket.io-client'

const BASE = process.env.SIM_BASE_URL || 'http://localhost:3000'
const SOCKET_URL = process.env.SIM_SOCKET_URL || 'http://localhost:3003'
const ACCESS_CODE = process.env.ACCESS_CODE
const NUM = Number(process.env.SIM_USERS || '70')

if (!ACCESS_CODE) {
  console.error('ACCESS_CODE env var required')
  process.exit(1)
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log(`[fill] joining ${NUM} participants to access code ${ACCESS_CODE}`)
  const sockets: Socket[] = []
  const BATCH = 10
  let joined = 0
  for (let i = 0; i < NUM; i += BATCH) {
    const batch = []
    for (let j = 0; j < BATCH && i + j < NUM; j++) {
      const idx = i + j + 1
      batch.push(
        (async () => {
          const uoid = `SIM-${String(idx).padStart(3, '0')}`
          const displayName = `Player${idx.toString().padStart(2, '0')}`
          const res = await fetch(`${BASE}/api/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessCode: ACCESS_CODE, displayName, uoid }),
          })
          if (!res.ok) throw new Error(`join failed for ${displayName}: ${res.status}`)
          const data = await res.json()
          const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            forceNew: true,
            timeout: 10000,
          })
          await new Promise<void>((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('timeout')), 10000)
            const doJoin = () => {
              socket.emit(
                'join_activity',
                { activityId: data.activityId, sessionId: data.sessionId },
                () => {
                  clearTimeout(to)
                  resolve()
                },
              )
            }
            if (socket.connected) doJoin()
            else socket.once('connect', doJoin)
          })
          sockets.push(socket)
          joined++
        })(),
      )
    }
    await Promise.all(batch)
    process.stdout.write(`  joined ${joined}/${NUM}\r`)
  }
  console.log(`\n[fill] all ${joined} participants joined + sockets connected`)
  console.log('[fill] keeping sockets alive for 120s for lobby screenshot...')
  // Keep alive so the admin browser sees the lobby populated
  await sleep(120000)
  for (const s of sockets) {
    try {
      s.removeAllListeners()
      s.disconnect()
    } catch {
      /* noop */
    }
  }
  console.log('[fill] done')
}

main().catch((e) => {
  console.error('[fill] FATAL:', e)
  process.exit(1)
})
