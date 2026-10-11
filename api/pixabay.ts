import type { IncomingMessage, ServerResponse } from "node:http"

/**
 * Vercel serverless proxy for the Pixabay API.
 *
 * Pixabay's terms require caching search results for at least 24 hours.
 * We cache in two layers:
 *  1. An in-memory Map inside the function (survives while the instance is warm).
 *  2. Cache-Control: s-maxage=86400 so Vercel's edge cache serves identical
 *     requests for 24 hours without hitting this function at all.
 */

// API key is injected at runtime from the environment. On Vercel this must be
// set as a project environment variable named PIXABAY_KEY (Project Settings →
// Environment Variables); locally put it in an untracked .env file.
const PIXABAY_KEY = process.env.PIXABAY_KEY ?? ""
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const PER_PAGE = 20

// Input bounds. The proxy is publicly reachable, so cap what callers can ask
// for and how much we retain in memory on a warm instance.
const MAX_QUERY_LEN = 100
const MAX_PAGE = 100
const MAX_CACHE_ENTRIES = 500
const ALLOWED_TYPES = new Set(["all", "photo", "illustration", "vector"])

// Upstream request budget. Per-attempt timeout × retries + backoff stays under
// ~10s so a hanging Pixabay returns a clean JSON error instead of a bare hang.
const UPSTREAM_TIMEOUT_MS = 4500
const UPSTREAM_RETRIES = 2
const RETRY_BACKOFF_MS = 400

/** fetch() with an AbortController timeout plus a small retry. */
async function fetchUpstream(target: string): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= UPSTREAM_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      return await fetch(target, { signal: controller.signal })
    } catch (err) {
      lastErr = err
      if (attempt < UPSTREAM_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * attempt))
      }
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Upstream fetch failed")
}

interface PixabayHit {
  id: number
  pageURL: string
  type: string
  tags: string
  previewURL: string
  previewWidth: number
  previewHeight: number
  webformatURL: string
  webformatWidth: number
  webformatHeight: number
  largeImageURL: string
  imageWidth: number
  imageHeight: number
  imageSize: number
  views: number
  downloads: number
  likes: number
  user: string
  userImageURL: string
  /** URL to the original vector file (SVG) if available. Requires full API access. */
  vectorURL?: string
}

interface PixabayResponse {
  total: number
  totalHits: number
  hits: PixabayHit[]
}

interface CacheEntry {
  data: PixabayResponse
  expires: number
}

const cache = new Map<string, CacheEntry>()

function cacheGet(key: string): PixabayResponse | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function cacheSet(key: string, data: PixabayResponse): void {
  // Evict the oldest entry once the cap is reached so unique queries can't
  // grow the cache without bound on a long-lived instance.
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  const url = new URL(req.url ?? "/", "https://pixabay-proxy.local")
  const q = (url.searchParams.get("q") ?? "").trim()
  const requestedType = url.searchParams.get("type") ?? "photo"
  const type = ALLOWED_TYPES.has(requestedType) ? requestedType : "photo"
  const rawPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10)
  const page = Math.min(MAX_PAGE, Math.max(1, Number.isFinite(rawPage) ? rawPage : 1))

  if (!q) {
    res.statusCode = 400
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Missing required parameter: q" }))
    return
  }

  if (q.length > MAX_QUERY_LEN) {
    res.statusCode = 400
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: `Query is too long (max ${MAX_QUERY_LEN} characters)` }))
    return
  }

  if (!PIXABAY_KEY) {
    res.statusCode = 500
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "PIXABAY_KEY environment variable is not set" }))
    return
  }

  const cacheKey = `${q}|${type}|${page}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    res.statusCode = 200
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", `public, max-age=${CACHE_TTL_MS / 1000}, s-maxage=${CACHE_TTL_MS / 1000}`)
    res.end(JSON.stringify(cached))
    return
  }

  const params = new URLSearchParams({
    key: PIXABAY_KEY,
    q,
    image_type: type,
    safesearch: "true",
    per_page: String(PER_PAGE),
    page: String(page),
  })

  try {
    const upstream = await fetchUpstream(`https://pixabay.com/api/?${params.toString()}`)
    if (!upstream.ok) {
      res.statusCode = upstream.status
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ error: `Pixabay API error: ${upstream.status}` }))
      return
    }
    const data = (await upstream.json()) as PixabayResponse
    cacheSet(cacheKey, data)
    res.statusCode = 200
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", `public, max-age=${CACHE_TTL_MS / 1000}, s-maxage=${CACHE_TTL_MS / 1000}`)
    res.end(JSON.stringify(data))
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError"
    res.statusCode = timedOut ? 504 : 502
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Pixabay is temporarily unreachable, try again." }))
  }
}
