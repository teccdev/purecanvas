const ENDPOINT = '/api/analytics/collect'
const VISITOR_KEY = 'pc:analytics:visitor'
const SESSION_KEY = 'pc:analytics:session'
const META_KEY = 'pc:analytics:meta'
const PRODUCTION_HOSTS = new Set(['purecanvas.app', 'www.purecanvas.app'])
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const

type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>

function stripControlCharacters(value: string): string {
  let output = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code >= 32 && code !== 127) output += character
  }
  return output
}

interface SessionMeta {
  sid: string
  started: number
  referrer: string
  utm: Utm
  pageviewSent: boolean
  engaged: boolean
  ended: boolean
}

let initialized = false
let meta: SessionMeta | null = null
let engagementTimer: number | null = null

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage can be blocked (private mode / hardened browsers); analytics then
    // degrades to a per-page anonymous visitor, which is fine.
  }
}

function randomId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function shouldTrack(): boolean {
  if (typeof window === 'undefined') return false

  const hostname = window.location.hostname
  const isLocal =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'

  // Local development and `vite preview` always record to the local .data
  // store. Production builds only record on the real domain, so preview
  // deployments on *.vercel.app can't pollute production analytics.
  if (!import.meta.env.DEV && !isLocal && !PRODUCTION_HOSTS.has(hostname)) {
    return false
  }

  const navigatorWithGpc = navigator as Navigator & { globalPrivacyControl?: boolean }
  const dnt =
    navigator.doNotTrack === '1' ||
    navigator.doNotTrack === 'yes' ||
    (window as Window & { doNotTrack?: string }).doNotTrack === '1' ||
    (window as Window & { doNotTrack?: string }).doNotTrack === 'yes'
  return !dnt && navigatorWithGpc.globalPrivacyControl !== true
}

function visitorId(): string {
  const existing = safeGet(localStorage, VISITOR_KEY)
  if (existing) return existing
  const created = randomId()
  safeSet(localStorage, VISITOR_KEY, created)
  return created
}

function readUtm(): Utm {
  const params = new URLSearchParams(window.location.search)
  const utm: Utm = {}
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`)
    const cleaned = value ? stripControlCharacters(value).trim() : ''
    if (cleaned) utm[key] = cleaned.slice(0, 80)
  }
  return utm
}

function referrerHost(): string {
  const referrer = document.referrer
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    return host === window.location.hostname.replace(/^www\./, '') ? 'internal' : host
  } catch {
    return 'direct'
  }
}

function loadMeta(): SessionMeta | null {
  const raw = safeGet(sessionStorage, META_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SessionMeta>
    if (typeof parsed.sid !== 'string' || typeof parsed.started !== 'number') return null
    return {
      sid: parsed.sid,
      started: parsed.started,
      referrer: typeof parsed.referrer === 'string' ? parsed.referrer : 'direct',
      utm: parsed.utm && typeof parsed.utm === 'object' ? parsed.utm : {},
      pageviewSent: parsed.pageviewSent === true,
      engaged: parsed.engaged === true,
      ended: parsed.ended === true,
    }
  } catch {
    return null
  }
}

function saveMeta(): void {
  if (!meta) return
  safeSet(sessionStorage, META_KEY, JSON.stringify(meta))
}

function send(payload: Record<string, unknown>, beacon = false): void {
  const body = JSON.stringify(payload)
  try {
    if (beacon && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'omit',
      keepalive: true,
      referrerPolicy: 'no-referrer',
    }).catch(() => {
      // Analytics must never affect the app.
    })
  } catch {
    // Ignore.
  }
}

function engage(): void {
  if (!meta || meta.engaged) return
  meta.engaged = true
  saveMeta()
  send({ t: 'engagement', s: meta.sid })
}

function startEngagementTimer(): void {
  if (engagementTimer !== null) return
  engagementTimer = window.setTimeout(engage, 10_000)
}

function addEngagementListeners(): void {
  const onInteraction = () => engage()
  for (const eventName of ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const) {
    window.addEventListener(eventName, onInteraction, { once: true, passive: true })
  }
}

function endSession(): void {
  if (!meta || meta.ended || !meta.pageviewSent) return
  meta.ended = true
  saveMeta()
  send(
    {
      t: 'session_end',
      s: meta.sid,
      d: Math.max(0, Date.now() - meta.started),
      i: meta.engaged,
    },
    true,
  )
}

export function initAnalytics(): void {
  try {
    initialize()
  } catch {
    // Analytics must never affect the app.
  }
}

function initialize(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  if (!shouldTrack()) return

  const currentPath = window.location.pathname
  if (currentPath.startsWith('/api') || currentPath === '/analytics') return

  meta = loadMeta()
  const sessionExpired = meta !== null && Date.now() - meta.started > 30 * 60 * 1000
  if (!meta || sessionExpired) {
    const sid = randomId()
    safeSet(sessionStorage, SESSION_KEY, sid)
    meta = {
      sid,
      started: Date.now(),
      referrer: referrerHost(),
      utm: readUtm(),
      pageviewSent: false,
      engaged: false,
      ended: false,
    }
    saveMeta()
  } else {
    // A fresh landing with new UTM tags (e.g. a full reload from a campaign)
    // updates attribution for this session.
    const freshUtm = readUtm()
    if (Object.keys(freshUtm).length > 0) meta.utm = freshUtm
  }

  send({
    t: 'pageview',
    v: visitorId(),
    s: meta.sid,
    p: currentPath,
    r: meta.referrer,
    u: meta.utm,
  })
  meta.pageviewSent = true
  meta.ended = false
  saveMeta()

  addEngagementListeners()
  startEngagementTimer()

  window.addEventListener('pagehide', endSession)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') endSession()
  })
}
