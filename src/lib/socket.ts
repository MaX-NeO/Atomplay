'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Connect to the realtime socket service.
 *
 * IMPORTANT (gateway rule): the browser must connect to the SAME origin and pass
 * `XTransformPort=3003` as a query param. Caddy then forwards to the mini-service.
 * We never hardcode `http://localhost:3003` here.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
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
