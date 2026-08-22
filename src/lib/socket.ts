'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Connect to the realtime socket service.
 *
 * Connection strategy (checked in order):
 *   1. If NEXT_PUBLIC_REALTIME_URL is set → connect directly to that URL (production)
 *   2. Otherwise → use the sandbox Caddy gateway pattern (?XTransformPort=3003)
 *
 * NOTE: NEXT_PUBLIC_* env vars are inlined at BUILD TIME by Next.js. If you
 * add/change NEXT_PUBLIC_REALTIME_URL on Vercel, you MUST redeploy for the
 * change to take effect.
 */
export function getSocket(): Socket {
  if (!socket) {
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL

    // Debug: log which mode we're in (visible in browser console)
    if (typeof window !== 'undefined') {
      if (realtimeUrl) {
        console.log('[socket] production mode →', realtimeUrl)
      } else {
        console.warn('[socket] NEXT_PUBLIC_REALTIME_URL not set — using sandbox mode (?XTransformPort=3003). Set NEXT_PUBLIC_REALTIME_URL on Vercel and redeploy.')
      }
    }

    const target = realtimeUrl || '/?XTransformPort=3003'

    socket = io(target, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })

    if (typeof window !== 'undefined') {
      socket.on('connect', () => {
        console.log('[socket] connected', socket?.id)
      })
      socket.on('disconnect', (reason) => {
        console.warn('[socket] disconnected:', reason)
      })
      socket.on('connect_error', (err) => {
        console.error('[socket] connect_error:', err.message)
      })
    }
  }
  return socket
}

export function disposeSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
