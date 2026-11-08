import { getRedisConfig, isVercel } from './env.js'
import { createLocalStore, type LocalStore } from './store-local.js'
import { createRedisStore, type RedisStore } from './store-redis.js'

export type AnalyticsStore = RedisStore | LocalStore

export type StoreResult =
  | { configured: true; store: AnalyticsStore }
  | { configured: false; reason: string }

let localStore: LocalStore | null = null
let redisStore: RedisStore | null = null

export function getStore(): StoreResult {
  const redis = getRedisConfig()
  if (redis) {
    redisStore ??= createRedisStore(redis)
    return { configured: true, store: redisStore }
  }

  // Serverless filesystems are ephemeral, so production requires Redis.
  if (isVercel()) {
    return {
      configured: false,
      reason:
        'No Redis connection is configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or the KV_REST_API_URL / KV_REST_API_TOKEN pair) to this Vercel environment.',
    }
  }

  localStore ??= createLocalStore()
  return { configured: true, store: localStore }
}
