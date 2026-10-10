import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env so the Pixabay proxy can inject the API key. Vite does not
  // populate process.env from .env inside the config file by default, so we
  // read it directly as a fallback in case loadEnv misses it.
  const env = loadEnv(mode, process.cwd(), '')
  let pixabayKey = env.PIXABAY_KEY
  if (!pixabayKey) {
    try {
      const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8')
      const match = envFile.match(/^PIXABAY_KEY=(.+)$/m)
      if (match) pixabayKey = match[1].trim()
    } catch {
      /* ignore */
    }
  }
  console.log("Pixabay key:", pixabayKey ? "loaded" : "MISSING")

  // Upstream request budget. Per-attempt timeout × retries + backoff stays
  // under ~10s so a hanging Pixabay fails fast instead of stalling the browser
  // fetch until it rejects with the opaque "TypeError: Failed to fetch".
  const UPSTREAM_TIMEOUT_MS = 4500
  const UPSTREAM_RETRIES = 2
  const RETRY_BACKOFF_MS = 400

  // fetch() with an AbortController timeout plus a small retry. A fetch
  // rejection is retried; a timeout aborts the attempt so the retry gets a
  // fresh connection rather than waiting on the same stuck socket.
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
    throw lastErr instanceof Error ? lastErr : new Error('Upstream fetch failed')
  }

  // Custom middleware that proxies /api/pixabay → pixabay.com/api, injecting
  // the API key. More reliable than the built-in proxy for query rewrites.
  function pixabayProxy(): Plugin {
    return {
      name: 'pixabay-proxy',
      configureServer(server) {
        server.middlewares.use('/api/pixabay', async (req, res) => {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const params = new URLSearchParams(url.search)
          if (!params.has('key')) {
            params.set('key', pixabayKey)
          }
          const target = `https://pixabay.com/api/?${params.toString()}`
          // Never log the API key: redact it in dev logs.
          const logged = new URLSearchParams(params)
          if (logged.has('key')) logged.set('key', '***')
          console.log('[pixabay proxy] →', `https://pixabay.com/api/?${logged.toString()}`)
          try {
            const upstream = await fetchUpstream(target)
            const body = await upstream.text()
            res.statusCode = upstream.status
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
            res.end(body)
          } catch (err) {
            const timedOut = err instanceof Error && err.name === 'AbortError'
            console.error('[pixabay proxy] upstream failed:', err)
            res.statusCode = timedOut ? 504 : 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Pixabay is temporarily unreachable, try again.' }))
          }
        })
      },
    }
  }

  return {
    plugins: [react(), tailwindcss(), pixabayProxy()],
    server: {
      // Allow Cloudflare quick tunnels (trycloudflare) to reach the dev server.
      allowedHosts: ['localhost', '.trycloudflare.com', '.cloudflareaccess.com'],
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  }
})
