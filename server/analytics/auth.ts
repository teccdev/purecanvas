import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

export const AUTH_COOKIE = 'pc_analytics'
export const SESSION_TTL_SECONDS = 12 * 60 * 60

function sessionSecret(): string | null {
  const secret = process.env.ANALYTICS_SESSION_SECRET || process.env.ANALYTICS_PASSWORD
  return secret && secret.length > 0 ? secret : null
}

export function passwordConfigured(): boolean {
  return Boolean(process.env.ANALYTICS_PASSWORD)
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/** Compare hashes so the comparison is constant-time regardless of length. */
export function checkPassword(input: string): boolean {
  const expected = process.env.ANALYTICS_PASSWORD
  if (!expected) return false
  try {
    return timingSafeEqual(sha256(input), sha256(expected))
  } catch {
    return false
  }
}

export function issueToken(): string | null {
  const secret = sessionSecret()
  if (!secret) return null
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const signature = createHmac('sha256', secret).update(`pc-admin:${expiry}`).digest('base64url')
  return `${expiry}.${signature}`
}

export function verifyToken(token: string | undefined): boolean {
  const secret = sessionSecret()
  if (!secret || !token) return false
  const separator = token.indexOf('.')
  if (separator <= 0) return false
  const expiry = Number(token.slice(0, separator))
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false
  const expected = createHmac('sha256', secret).update(`pc-admin:${expiry}`).digest('base64url')
  const actual = token.slice(separator + 1)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      return undefined
    }
  }
  return undefined
}

export function isAuthenticated(req: IncomingMessage): boolean {
  return verifyToken(readCookie(req.headers.cookie, AUTH_COOKIE))
}

export function serializeAuthCookie(token: string, secure: boolean): string {
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? '; Secure' : ''}`
}

export function clearAuthCookie(secure: boolean): string {
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}

/* -------------------------------------------------------------------------- */
/* Best-effort login throttling (per server instance, no IP addresses stored) */
/* -------------------------------------------------------------------------- */

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8
const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded ?? req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? 'unknown')
  const ip = String(raw).split(',')[0].trim()
  return createHash('sha256').update(ip).digest('hex').slice(0, 20)
}

export function loginRateLimited(req: IncomingMessage): boolean {
  const key = clientKey(req)
  const now = Date.now()
  const record = attempts.get(key)
  if (!record || record.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + ATTEMPT_WINDOW_MS })
    if (attempts.size > 5000) {
      for (const [oldKey, oldRecord] of attempts) {
        if (oldRecord.resetAt <= now) attempts.delete(oldKey)
      }
    }
    return false
  }
  return record.count >= MAX_ATTEMPTS
}

export function recordLoginFailure(req: IncomingMessage): void {
  const key = clientKey(req)
  const now = Date.now()
  const record = attempts.get(key)
  if (!record || record.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS })
    return
  }
  record.count += 1
}

export function clearLoginFailures(req: IncomingMessage): void {
  attempts.delete(clientKey(req))
}
