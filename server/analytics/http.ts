import type { IncomingMessage, ServerResponse } from 'node:http'
import { getAnalyticsEnv } from './env'
import {
  clearAuthCookie,
  clearLoginFailures,
  checkPassword,
  isAuthenticated,
  issueToken,
  loginRateLimited,
  passwordConfigured,
  recordLoginFailure,
  serializeAuthCookie,
} from './auth'
import { getStore } from './store'
import {
  renderDashboard,
  renderDashboardError,
  renderLogin,
  renderSetup,
} from './dashboard'

const MAX_BODY_BYTES = 8 * 1024
const VALID_RANGES = new Set([1, 7, 30])
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

function stripControlCharacters(value: string): string {
  let output = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code >= 32 && code !== 127) output += character
  }
  return output
}

function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('Cache-Control', 'no-store')
}

function setHtmlHeaders(res: ServerResponse): void {
  setSecurityHeaders(res)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  res.setHeader('X-Frame-Options', 'DENY')
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  setSecurityHeaders(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function sendHtml(res: ServerResponse, html: string, status = 200): void {
  setHtmlHeaders(res)
  res.statusCode = status
  res.end(html)
}

function sendEmpty(res: ServerResponse): void {
  setSecurityHeaders(res)
  res.statusCode = 204
  res.end()
}

function redirect(res: ServerResponse, location: string): void {
  setSecurityHeaders(res)
  res.statusCode = 303
  res.setHeader('Location', location)
  res.end()
}

function isSecureRequest(req: IncomingMessage): boolean {
  const forwardedProto = firstHeader(req.headers['x-forwarded-proto']).split(',')[0]?.trim()
  if (forwardedProto) return forwardedProto === 'https'
  return (req.socket as { encrypted?: boolean }).encrypted === true
}

function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost')
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function readPreparedBody(req: IncomingMessage): string | null {
  const prepared = (req as IncomingMessage & { body?: unknown }).body
  if (prepared === undefined || prepared === null) return null
  if (Buffer.isBuffer(prepared)) return prepared.toString('utf8')
  if (typeof prepared === 'string') return prepared
  return JSON.stringify(prepared)
}

async function readBody(req: IncomingMessage): Promise<string> {
  const prepared = readPreparedBody(req)
  if (prepared !== null) return prepared
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = firstHeader(req.headers.origin)
  // Some browsers/privacy modes send "Origin: null" for same-page form posts.
  // There is no cross-site credential here, so treat it as same-origin.
  if (!origin || origin === 'null') return true
  try {
    const originHost = new URL(origin).host
    const forwardedHost = firstHeader(req.headers['x-forwarded-host']).split(',')[0]?.trim()
    const host = forwardedHost || firstHeader(req.headers.host)
    return originHost === host
  } catch {
    return false
  }
}

function normalizeId(value: unknown): string | null {
  return typeof value === 'string' && ID_PATTERN.test(value) ? value : null
}

function normalizePath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let path = stripControlCharacters(value.split('?')[0]?.split('#')[0] ?? '')
  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/').slice(0, 180)
  if (path.startsWith('/api') || path === '/analytics' || path.startsWith('/analytics/')) {
    return null
  }
  return path
}

function normalizeReferrer(value: unknown, requestHost: string): string {
  if (typeof value !== 'string' || !value) return 'direct'
  const lowered = value.trim().toLowerCase().slice(0, 140)
  if (lowered === 'direct' || lowered === 'internal') return lowered
  const hostname = lowered
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    ?.split(':')[0]
    ?.replace(/^www\./, '')
    ?? ''
  if (!/^[a-z0-9.-]+$/.test(hostname)) return 'direct'
  const ownHost = requestHost.replace(/^www\./, '').split(':')[0]
  return hostname === ownHost ? 'internal' : hostname
}

function normalizeUtm(value: unknown): Record<string, string> {
  const utm: Record<string, string> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return utm
  for (const key of UTM_KEYS) {
    const raw = (value as Record<string, unknown>)[key]
    if (typeof raw !== 'string') continue
    const cleaned = stripControlCharacters(raw).trim().slice(0, 80)
    if (cleaned) utm[key] = cleaned
  }
  return utm
}

function normalizeCountry(req: IncomingMessage): string {
  const raw = firstHeader(req.headers['x-vercel-ip-country']) || firstHeader(req.headers['cf-ipcountry'])
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : 'XX'
}

interface UserAgentInfo {
  device: string
  browser: string
  bot: boolean
}

function parseUserAgent(userAgent: string): UserAgentInfo {
  const ua = userAgent.toLowerCase()
  const bot = /bot|crawl|spider|slurp|headless|preview|lighthouse|pingdom|uptime|facebookexternalhit/.test(
    ua,
  )
  if (bot) return { device: 'bot', browser: 'Bot', bot: true }

  let device = 'desktop'
  if (/ipad|tablet|playbook|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) {
    device = 'tablet'
  } else if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) {
    device = 'mobile'
  }

  let browser = 'Other'
  if (/edg\//.test(ua)) browser = 'Edge'
  else if (/opr\/|opera/.test(ua)) browser = 'Opera'
  else if (/firefox\/|fxios\//.test(ua)) browser = 'Firefox'
  else if (/chrome\/|crios\//.test(ua)) browser = 'Chrome'
  else if (/safari\//.test(ua)) browser = 'Safari'

  return { device, browser, bot: false }
}

let storageWarningLogged = false

function logStorageOnce(): void {
  if (storageWarningLogged) return
  storageWarningLogged = true
  console.error(
    '[analytics] collection skipped: no Redis configured in this environment. Set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN, or open /analytics for setup instructions.',
  )
}

export async function handleCollect(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setSecurityHeaders(res)
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }
  if (!sameOrigin(req)) {
    sendEmpty(res)
    return
  }

  const { device, browser, bot } = parseUserAgent(firstHeader(req.headers['user-agent']))
  if (bot) {
    sendEmpty(res)
    return
  }

  try {
    const raw = await readBody(req)
    const body = parseJsonObject(raw)
    if (!body) {
      sendEmpty(res)
      return
    }

    const storeResult = getStore()
    if (!storeResult.configured) {
      logStorageOnce()
      sendEmpty(res)
      return
    }

    const env = getAnalyticsEnv()
    const sessionId = normalizeId(body.s)
    if (!sessionId) {
      sendEmpty(res)
      return
    }

    if (body.t === 'pageview') {
      const visitorId = normalizeId(body.v)
      const path = normalizePath(body.p)
      if (!visitorId || !path) {
        sendEmpty(res)
        return
      }
      await storeResult.store.recordPageview(env, {
        visitorId,
        sessionId,
        path,
        referrer: normalizeReferrer(body.r, firstHeader(req.headers.host)),
        utm: normalizeUtm(body.u),
        country: normalizeCountry(req),
        device,
        browser,
        timestamp: Date.now(),
      })
    } else if (body.t === 'engagement') {
      await storeResult.store.recordEngagement(env, sessionId)
    } else if (body.t === 'session_end') {
      const rawDuration = Number(body.d)
      const duration = Number.isFinite(rawDuration)
        ? Math.min(21_600_000, Math.max(0, Math.round(rawDuration)))
        : 0
      await storeResult.store.recordSessionEnd(env, sessionId, duration, body.i === true)
    }
  } catch (error) {
    console.error('[analytics] collection failed:', error instanceof Error ? error.message : error)
  }

  sendEmpty(res)
}

function parseRange(req: IncomingMessage): number {
  const raw = Number.parseInt(requestUrl(req).searchParams.get('range') ?? '7', 10)
  return VALID_RANGES.has(raw) ? raw : 7
}

export async function handleDashboard(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const env = getAnalyticsEnv()
  const query = requestUrl(req).searchParams

  if (!passwordConfigured()) {
    sendHtml(res, renderLogin(query, { env, passwordSet: false }))
    return
  }
  if (!isAuthenticated(req)) {
    sendHtml(res, renderLogin(query, { env, passwordSet: true }))
    return
  }

  const storeResult = getStore()
  if (!storeResult.configured) {
    sendHtml(
      res,
      renderSetup({
        env,
        reason: storeResult.reason,
        passwordSet: true,
      }),
    )
    return
  }

  try {
    const stats = await storeResult.store.getStats(env, parseRange(req))
    sendHtml(res, renderDashboard(stats, { env }))
  } catch (error) {
    console.error('[analytics] dashboard failed:', error instanceof Error ? error.message : error)
    sendHtml(
      res,
      renderDashboardError('Analytics storage returned an error. Check the deployment logs.'),
      500,
    )
  }
}

async function readPassword(req: IncomingMessage): Promise<string> {
  const prepared = (req as IncomingMessage & { body?: unknown }).body
  if (prepared && typeof prepared === 'object' && !Buffer.isBuffer(prepared)) {
    const value = (prepared as Record<string, unknown>).password
    return typeof value === 'string' ? value : ''
  }
  const raw = await readBody(req)
  return new URLSearchParams(raw).get('password') ?? ''
}

export async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setSecurityHeaders(res)
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }
  if (!passwordConfigured()) {
    redirect(res, '/analytics?error=config')
    return
  }
  if (!sameOrigin(req)) {
    redirect(res, '/analytics?error=1')
    return
  }
  if (loginRateLimited(req)) {
    redirect(res, '/analytics?error=rate')
    return
  }

  let password = ''
  try {
    password = await readPassword(req)
  } catch {
    redirect(res, '/analytics?error=1')
    return
  }

  if (!checkPassword(password)) {
    recordLoginFailure(req)
    await new Promise((resolve) => setTimeout(resolve, 350))
    redirect(res, '/analytics?error=1')
    return
  }

  clearLoginFailures(req)
  const token = issueToken()
  if (!token) {
    redirect(res, '/analytics?error=config')
    return
  }
  res.setHeader('Set-Cookie', serializeAuthCookie(token, isSecureRequest(req)))
  redirect(res, '/analytics')
}

export function handleLogout(req: IncomingMessage, res: ServerResponse): void {
  setSecurityHeaders(res)
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }
  res.setHeader('Set-Cookie', clearAuthCookie(isSecureRequest(req)))
  redirect(res, '/analytics')
}

export async function handleStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }
  if (!isAuthenticated(req)) {
    sendJson(res, 401, { error: 'Unauthorized' })
    return
  }
  const storeResult = getStore()
  if (!storeResult.configured) {
    sendJson(res, 503, { error: storeResult.reason })
    return
  }
  try {
    const stats = await storeResult.store.getStats(getAnalyticsEnv(), parseRange(req))
    sendJson(res, 200, stats)
  } catch (error) {
    console.error('[analytics] stats failed:', error instanceof Error ? error.message : error)
    sendJson(res, 502, { error: 'Analytics storage unavailable' })
  }
}
