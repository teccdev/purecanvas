import fs from 'node:fs'
import path from 'node:path'
import type { AnalyticsStats, PageviewData, RecentVisit } from './types'
import { buildStats, lastNDates } from './stats'

/**
 * Local development store. Never used on Vercel — production must use Redis so
 * data survives cold starts. Keeping dev events in a project-local JSON file
 * also guarantees they can never mix with production analytics.
 */

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'analytics-dev.json')
const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_VISITORS_PER_DAY = 10_000
const RECENT_LIMIT = 200

interface LocalDay {
  fields: Record<string, number>
  visitors: string[]
}

interface LocalSession {
  pv: number
  engaged: boolean
  ended: boolean
  started: number
}

interface LocalData {
  days: Record<string, LocalDay>
  sessions: Record<string, LocalSession>
  recent: RecentVisit[]
}

function emptyData(): LocalData {
  return { days: {}, sessions: {}, recent: [] }
}

function readData(): LocalData {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<LocalData>
    return {
      days: parsed.days ?? {},
      sessions: parsed.sessions ?? {},
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
    }
  } catch {
    return emptyData()
  }
}

function writeData(data: LocalData): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const temporary = `${DATA_FILE}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(data))
    fs.renameSync(temporary, DATA_FILE)
  } catch (error) {
    console.error('[analytics] could not write local analytics file:', error)
  }
}

function increment(fields: Record<string, number>, field: string, amount = 1): void {
  fields[field] = (fields[field] ?? 0) + amount
}

function utcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function cleanupSessions(data: LocalData, now: number): void {
  for (const [id, session] of Object.entries(data.sessions)) {
    if (now - session.started > SESSION_TTL_MS) delete data.sessions[id]
  }
}

export function createLocalStore() {
  return {
    configured: true as const,

    async recordPageview(_env: string, event: PageviewData): Promise<void> {
      const data = readData()
      cleanupSessions(data, event.timestamp)
      const date = utcDate(event.timestamp)
      const day = (data.days[date] ??= { fields: {}, visitors: [] })
      const isNewSession = !data.sessions[event.sessionId]

      increment(day.fields, 'pv')
      increment(day.fields, `page:${event.path}`)
      increment(day.fields, `country:${event.country}`)
      increment(day.fields, `device:${event.device}`)
      increment(day.fields, `browser:${event.browser}`)

      if (!day.visitors.includes(event.visitorId) && day.visitors.length < MAX_VISITORS_PER_DAY) {
        day.visitors.push(event.visitorId)
      }

      if (isNewSession) {
        increment(day.fields, 'sessions')
        increment(day.fields, `ref:${event.referrer}`)
        for (const [key, value] of Object.entries(event.utm)) {
          increment(day.fields, `utm_${key}:${value}`)
        }
        data.sessions[event.sessionId] = {
          pv: 0,
          engaged: false,
          ended: false,
          started: event.timestamp,
        }
      }

      const session = data.sessions[event.sessionId]
      if (session) session.pv += 1

      data.recent.unshift({
        t: event.timestamp,
        p: event.path,
        r: event.referrer,
        c: event.country,
        d: event.device,
      })
      data.recent = data.recent.slice(0, RECENT_LIMIT)
      writeData(data)
    },

    async recordEngagement(_env: string, sessionId: string): Promise<void> {
      const data = readData()
      const session = data.sessions[sessionId]
      if (!session) return
      session.engaged = true
      writeData(data)
    },

    async recordSessionEnd(
      _env: string,
      sessionId: string,
      durationMs: number,
      interacted: boolean,
    ): Promise<void> {
      const data = readData()
      const session = data.sessions[sessionId]
      if (!session || session.ended) return
      const now = Date.now()
      const day = (data.days[utcDate(now)] ??= { fields: {}, visitors: [] })

      session.ended = true
      if (interacted) session.engaged = true
      increment(day.fields, 'session_ends')
      increment(day.fields, 'duration_ms', Math.max(0, durationMs))
      if (session.pv <= 1 && !session.engaged && durationMs < 10_000) {
        increment(day.fields, 'bounces')
      }
      writeData(data)
    },

    async getStats(env: string, days: number): Promise<AnalyticsStats> {
      const data = readData()
      const dates = lastNDates(days)
      const visitorSet = new Set<string>()
      const snapshots = dates.map((date) => {
        const day = data.days[date]
        if (day) {
          for (const visitor of day.visitors) visitorSet.add(visitor)
        }
        return { date, fields: day?.fields ?? {} }
      })
      return buildStats(snapshots, visitorSet.size, data.recent.slice(0, 50), days, env)
    },
  }
}

export type LocalStore = ReturnType<typeof createLocalStore>
