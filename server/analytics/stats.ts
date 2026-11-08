import type { AnalyticsStats, CountItem, DailyPoint, RecentVisit } from './types'

const MAX_LIST_ITEMS = 8
const FIELD_PREFIXES = new Set([
  'page',
  'ref',
  'country',
  'device',
  'browser',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
])

/** The last `days` UTC dates, oldest first. */
export function lastNDates(days: number, now = new Date()): string[] {
  const dates: string[] = []
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    dates.push(new Date(end - offset * 86_400_000).toISOString().slice(0, 10))
  }
  return dates
}

export function toNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

/** Normalise a Redis HGETALL reply (flat array or object) to numbers. */
export function fieldsFromReply(reply: unknown): Record<string, number> {
  const fields: Record<string, number> = {}
  if (Array.isArray(reply)) {
    for (let index = 0; index + 1 < reply.length; index += 2) {
      fields[String(reply[index])] = toNumber(reply[index + 1])
    }
    return fields
  }
  if (reply && typeof reply === 'object') {
    for (const [key, value] of Object.entries(reply as Record<string, unknown>)) {
      fields[key] = toNumber(value)
    }
  }
  return fields
}

export function parseRecent(reply: unknown): RecentVisit[] {
  if (!Array.isArray(reply)) return []
  const visits: RecentVisit[] = []
  for (const item of reply) {
    if (typeof item !== 'string') continue
    try {
      const parsed = JSON.parse(item) as Partial<RecentVisit>
      if (
        typeof parsed.t !== 'number' ||
        typeof parsed.p !== 'string' ||
        typeof parsed.r !== 'string' ||
        typeof parsed.c !== 'string' ||
        typeof parsed.d !== 'string'
      ) {
        continue
      }
      visits.push({
        t: parsed.t,
        p: parsed.p,
        r: parsed.r,
        c: parsed.c,
        d: parsed.d,
      })
    } catch {
      // Ignore malformed entries.
    }
  }
  return visits.slice(0, 50)
}

export function buildStats(
  snapshots: Array<{ date: string; fields: Record<string, number> }>,
  visitors: number,
  recent: RecentVisit[],
  days: number,
  env: string,
): AnalyticsStats {
  let pageviews = 0
  let sessions = 0
  let bounces = 0
  let sessionEnds = 0
  let durationMs = 0
  const maps = new Map<string, Map<string, number>>()

  for (const snapshot of snapshots) {
    for (const [field, value] of Object.entries(snapshot.fields)) {
      if (field === 'pv') pageviews += value
      else if (field === 'sessions') sessions += value
      else if (field === 'bounces') bounces += value
      else if (field === 'session_ends') sessionEnds += value
      else if (field === 'duration_ms') durationMs += value
      else {
        const separator = field.indexOf(':')
        if (separator <= 0) continue
        const prefix = field.slice(0, separator)
        if (!FIELD_PREFIXES.has(prefix)) continue
        const name = field.slice(separator + 1) || '—'
        let map = maps.get(prefix)
        if (!map) {
          map = new Map()
          maps.set(prefix, map)
        }
        map.set(name, (map.get(name) ?? 0) + value)
      }
    }
  }

  const top = (prefix: string): CountItem[] => {
    const map = maps.get(prefix)
    if (!map) return []
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, MAX_LIST_ITEMS)
  }

  const daily: DailyPoint[] = snapshots.map((snapshot) => ({
    date: snapshot.date,
    pageviews: snapshot.fields.pv ?? 0,
  }))

  return {
    range: {
      days,
      from: snapshots[0]?.date ?? '',
      to: snapshots[snapshots.length - 1]?.date ?? '',
      env,
    },
    totals: {
      visitors,
      pageviews,
      sessions,
      bounces,
      bounceRate: sessionEnds > 0 ? (bounces / sessionEnds) * 100 : 0,
      sessionEnds,
      avgDurationSeconds: sessionEnds > 0 ? durationMs / sessionEnds / 1000 : 0,
    },
    pages: top('page'),
    referrers: top('ref'),
    countries: top('country'),
    devices: top('device'),
    browsers: top('browser'),
    utm: {
      sources: top('utm_source'),
      mediums: top('utm_medium'),
      campaigns: top('utm_campaign'),
      terms: top('utm_term'),
      contents: top('utm_content'),
    },
    daily,
    recent,
  }
}
