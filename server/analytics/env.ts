/**
 * Analytics data is namespaced per deployment environment. On Vercel,
 * VERCEL_ENV is "production", "preview" or "development", so preview
 * deployments can never write into the production dataset. Locally,
 * VERCEL_ENV is unset and analytics use the "development" namespace and a
 * local JSON file (see store-local.ts).
 */
export function getAnalyticsEnv(): string {
  const explicit = process.env.ANALYTICS_ENV?.trim()
  const env = explicit || process.env.VERCEL_ENV?.trim() || 'development'
  return env.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32) || 'development'
}

export function getEnvLabel(env: string): string {
  if (env === 'production') return 'Production'
  if (env === 'preview') return 'Preview'
  if (env === 'development') return 'Development'
  return env
}

export function getRedisConfig(): { url: string; token: string } | null {
  let url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  let token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

  // Vercel storage integrations prepend a custom prefix to their default
  // variable names. For example, the Upstash integration with the prefix
  // "UPSTASH_REDIS_REST" creates UPSTASH_REDIS_REST_KV_REST_API_URL and
  // UPSTASH_REDIS_REST_KV_REST_API_TOKEN. Accept any such pair so the
  // integration works without renaming or duplicating secrets.
  if (!url || !token) {
    for (const [key, value] of Object.entries(process.env)) {
      if (!value || !key.endsWith('_KV_REST_API_URL')) continue
      const prefix = key.slice(0, -'_KV_REST_API_URL'.length)
      const candidateToken = process.env[`${prefix}_KV_REST_API_TOKEN`]
      if (candidateToken) {
        url = value
        token = candidateToken
        break
      }
    }
  }

  if (!url || !token) return null
  return { url: url.replace(/\/+$/, ''), token }
}

export function isVercel(): boolean {
  return Boolean(process.env.VERCEL)
}
