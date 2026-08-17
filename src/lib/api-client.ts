// Lightweight fetch wrapper used by all client components.
// Throws an Error with `.status` and server-provided `message` on non-2xx.

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

// Transient status codes we auto-retry with exponential backoff. These are
// returned by the dev server (or an upstream proxy) when the compile queue is
// momentarily saturated — typically during a hot reload while many participants
// join at once. Retrying transparently absorbs the burst instead of surfacing
// an ugly "Request failed (429)" toast to the user.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 400

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function computeBackoff(attempt: number, retryAfterHeader: string | null): number {
  // Honor a server-provided Retry-After header (seconds) when present.
  if (retryAfterHeader) {
    const secs = Number.parseInt(retryAfterHeader, 10)
    if (Number.isFinite(secs) && secs >= 0) {
      return Math.min(secs * 1000, 5000)
    }
  }
  // Exponential backoff with a small jitter so concurrent clients don't
  // all retry in lockstep.
  const exp = BASE_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 200
  return Math.min(exp + jitter, 4000)
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined

  let lastError: ApiError | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response
    try {
      res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: bodyStr,
        ...init,
      })
    } catch {
      // Network error (server unreachable / connection reset). Retryable —
      // typically clears within a second or two during a dev-server reload.
      lastError = new ApiError('Network error', 0, null)
      if (attempt < MAX_RETRIES) {
        await delay(computeBackoff(attempt, null))
        continue
      }
      throw lastError
    }

    const text = await res.text()
    const data = text ? safeJson(text) : null

    if (!res.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string'
          ? (data as any).error
          : `Request failed (${res.status})`

      // Retry transient overload responses. Non-idempotent POSTs (like join)
      // are still safe to retry here because the server-side handlers are
      // idempotent by design (unique constraints guard against duplicates) —
      // a duplicate retry of /join returns a clean 409 "already joined" which
      // the caller already handles.
      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        lastError = new ApiError(message, res.status, data)
        await delay(computeBackoff(attempt, res.headers.get('Retry-After')))
        continue
      }

      throw new ApiError(message, res.status, data)
    }

    return data as T
  }

  // Exhausted retries — throw the last captured transient error (or a generic
  // fallback if, somehow, none was captured).
  throw (
    lastError ??
    new ApiError('Request failed after retries', 0, null)
  )
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
}
