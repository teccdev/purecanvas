import type { AnalyticsStats, PageviewData, RecentVisit } from './types.js'
import { redisCommand, redisPipeline } from './redis.js'
import { buildStats, fieldsFromReply, lastNDates, parseRecent, toNumber } from './stats.js'

/**
 * Redis layout (one small day-hash per day keeps the dashboard cheap):
 *
 *   pc:analytics:v1:{env}:day:{YYYY-MM-DD}  hash
 *     pv, sessions, bounces, session_ends, duration_ms
 *     page:{path} ref:{host} country:{code} device:{type} browser:{name}
 *     utm_source:{value} utm_medium:{value} utm_campaign:{value}
 *     utm_term:{value} utm_content:{value}
 *   pc:analytics:v1:{env}:visitors:{YYYY-MM-DD}  HyperLogLog
 *   pc:analytics:v1:{env}:session:{id}           hash { pv, engaged } (30 min)
 *   pc:analytics:v1:{env}:ended:{id}             marker (24 h)
 *   pc:analytics:v1:{env}:recent                 list of latest pageviews
 *
 * All writes for a pageview happen inside one Lua script, which Upstash
 * counts as a single command. That keeps the free tier comfortable.
 */

const PREFIX = 'pc:analytics:v1'
const SESSION_TTL_SECONDS = 30 * 60
const DAY_TTL_SECONDS = 400 * 24 * 60 * 60
const RECENT_LIMIT = 200

function dayKey(env: string, date: string): string {
  return `${PREFIX}:${env}:day:${date}`
}

function visitorsKey(env: string, date: string): string {
  return `${PREFIX}:${env}:visitors:${date}`
}

function sessionKey(env: string, sessionId: string): string {
  return `${PREFIX}:${env}:session:${sessionId}`
}

function endedKey(env: string, sessionId: string): string {
  return `${PREFIX}:${env}:ended:${sessionId}`
}

function recentKey(env: string): string {
  return `${PREFIX}:${env}:recent`
}

function utcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

const PAGEVIEW_SCRIPT = `
local day = KEYS[1]
local visitors = KEYS[2]
local session = KEYS[3]
local recent = KEYS[4]
local ended = KEYS[5]
local visitorId = ARGV[1]
local path = ARGV[2]
local referrer = ARGV[3]
local country = ARGV[4]
local device = ARGV[5]
local browser = ARGV[6]
local utmJson = ARGV[7]
local recentJson = ARGV[8]
local ttl = tonumber(ARGV[9])

local existed = redis.call('EXISTS', session)
redis.call('HINCRBY', day, 'pv', 1)
redis.call('PFADD', visitors, visitorId)
redis.call('HINCRBY', day, 'page:' .. path, 1)
redis.call('HINCRBY', day, 'country:' .. country, 1)
redis.call('HINCRBY', day, 'device:' .. device, 1)
redis.call('HINCRBY', day, 'browser:' .. browser, 1)
redis.call('HINCRBY', session, 'pv', 1)
redis.call('EXPIRE', session, ttl)
redis.call('EXPIRE', day, ${DAY_TTL_SECONDS})
redis.call('EXPIRE', visitors, ${DAY_TTL_SECONDS})

-- Acquisition data is attributed once, to the session's landing pageview.
if existed == 0 then
  redis.call('HINCRBY', day, 'sessions', 1)
  redis.call('HINCRBY', day, 'ref:' .. referrer, 1)
  redis.call('DEL', ended)
  local utm = cjson.decode(utmJson)
  for key, value in pairs(utm) do
    redis.call('HINCRBY', day, 'utm_' .. key .. ':' .. value, 1)
  end
end

redis.call('LPUSH', recent, recentJson)
redis.call('LTRIM', recent, 0, ${RECENT_LIMIT - 1})
return 1
`

const ENGAGEMENT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('HSET', KEYS[1], 'engaged', '1')
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return 1
`

const SESSION_END_SCRIPT = `
local day = KEYS[1]
local session = KEYS[2]
local ended = KEYS[3]
local durationMs = tonumber(ARGV[1])
local interacted = ARGV[2]

if not redis.call('SET', ended, '1', 'EX', 86400, 'NX') then
  return 0
end

local pv = tonumber(redis.call('HGET', session, 'pv') or '0')
if pv == 0 then
  return 0
end
local engaged = redis.call('HGET', session, 'engaged') or '0'
if interacted == '1' then
  engaged = '1'
end

if pv <= 1 and engaged ~= '1' and durationMs < 10000 then
  redis.call('HINCRBY', day, 'bounces', 1)
end

redis.call('HINCRBY', day, 'session_ends', 1)
redis.call('HINCRBY', day, 'duration_ms', durationMs)
redis.call('EXPIRE', day, ${DAY_TTL_SECONDS})
return 1
`

export function createRedisStore(config: { url: string; token: string }) {
  return {
    configured: true as const,

    async recordPageview(env: string, data: PageviewData): Promise<void> {
      const date = utcDate(data.timestamp)
      const recent: RecentVisit = {
        t: data.timestamp,
        p: data.path,
        r: data.referrer,
        c: data.country,
        d: data.device,
      }
      await redisCommand(config, [
        'EVAL',
        PAGEVIEW_SCRIPT,
        '5',
        dayKey(env, date),
        visitorsKey(env, date),
        sessionKey(env, data.sessionId),
        recentKey(env),
        endedKey(env, data.sessionId),
        data.visitorId,
        data.path,
        data.referrer,
        data.country,
        data.device,
        data.browser,
        JSON.stringify(data.utm),
        JSON.stringify(recent),
        String(SESSION_TTL_SECONDS),
      ])
    },

    async recordEngagement(env: string, sessionId: string): Promise<void> {
      await redisCommand(config, [
        'EVAL',
        ENGAGEMENT_SCRIPT,
        '1',
        sessionKey(env, sessionId),
        String(SESSION_TTL_SECONDS),
      ])
    },

    async recordSessionEnd(
      env: string,
      sessionId: string,
      durationMs: number,
      interacted: boolean,
    ): Promise<void> {
      const date = utcDate(Date.now())
      await redisCommand(config, [
        'EVAL',
        SESSION_END_SCRIPT,
        '3',
        dayKey(env, date),
        sessionKey(env, sessionId),
        endedKey(env, sessionId),
        String(durationMs),
        interacted ? '1' : '0',
      ])
    },

    async getStats(env: string, days: number): Promise<AnalyticsStats> {
      const dates = lastNDates(days)
      const commands: unknown[][] = [
        ...dates.map((date) => ['HGETALL', dayKey(env, date)]),
        ['PFCOUNT', ...dates.map((date) => visitorsKey(env, date))],
        ['LRANGE', recentKey(env), '0', '49'],
      ]
      const replies = await redisPipeline(config, commands)
      const snapshots = dates.map((date, index) => ({
        date,
        fields: fieldsFromReply(replies[index]),
      }))
      const visitors = toNumber(replies[dates.length])
      const recent = parseRecent(replies[dates.length + 1])
      return buildStats(snapshots, visitors, recent, days, env)
    },
  }
}

export type RedisStore = ReturnType<typeof createRedisStore>
