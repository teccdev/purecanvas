export interface CountItem {
  name: string
  count: number
}

export interface DailyPoint {
  date: string
  pageviews: number
}

export interface RecentVisit {
  /** Unix timestamp in milliseconds. */
  t: number
  /** Page path. */
  p: string
  /** Referrer hostname, "direct", or "internal". */
  r: string
  /** ISO 3166-1 alpha-2 country code, or "XX". */
  c: string
  /** desktop | mobile | tablet */
  d: string
}

export interface AnalyticsStats {
  range: {
    days: number
    from: string
    to: string
    env: string
  }
  totals: {
    visitors: number
    pageviews: number
    sessions: number
    bounces: number
    bounceRate: number
    sessionEnds: number
    avgDurationSeconds: number
  }
  pages: CountItem[]
  referrers: CountItem[]
  countries: CountItem[]
  devices: CountItem[]
  browsers: CountItem[]
  utm: {
    sources: CountItem[]
    mediums: CountItem[]
    campaigns: CountItem[]
    terms: CountItem[]
    contents: CountItem[]
  }
  daily: DailyPoint[]
  recent: RecentVisit[]
}

export interface PageviewData {
  visitorId: string
  sessionId: string
  path: string
  referrer: string
  utm: Record<string, string>
  country: string
  device: string
  browser: string
  timestamp: number
}
