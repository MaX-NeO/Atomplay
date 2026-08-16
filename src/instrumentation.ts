/**
 * Next.js instrumentation — runs once when the server starts.
 *
 * Spawns the realtime socket.io mini-service (mini-services/quiz-realtime) as a
 * DETACHED child of the long-lived Next.js dev server, so it survives across
 * Bash-tool invocations (the dev server itself is adopted by init / PID 1).
 */
import { spawn } from 'child_process'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV === 'production') return

  try {
    const child = spawn('bun', ['run', 'dev'], {
      cwd: '/home/z/my-project/mini-services/quiz-realtime',
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, NODE_ENV: 'development' },
    })
    child.unref()
    console.log(`[instrumentation] spawned quiz-realtime (bun --hot) on :3003, pid=${child.pid}`)
  } catch (err) {
    console.error('[instrumentation] failed to spawn realtime service:', err)
  }
}
