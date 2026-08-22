'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Connect to the realtime socket service.
 *
 * In PRODUCTION: connects to the Render mini-service URL (NEXT_PUBLIC_REALTIME_URL).
 * In DEVELOPMENT (sandbox): connects via the Caddy gateway using ?XTransformPort=3003.
 */
export function getSocket(): Socket {
  if (!socket) {
    const isProduction = process.env.NODE_ENV === 'production'
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL

    if (isProduction && realtimeUrl) {
      // Production: connect directly to the Render mini-service
      socket = io(realtimeUrl, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      })
    } else {
      // Development: sandbox Caddy gateway pattern
      socket = io('/?XTransformPort=3003', {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      })
    }

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
