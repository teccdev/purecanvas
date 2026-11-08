import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import {
  handleCollect,
  handleDashboard,
  handleLogin,
  handleLogout,
  handleStats,
} from './http.js'

type Middlewares = ViteDevServer['middlewares']

function mountAnalytics(app: { middlewares: Middlewares }): void {
  app.middlewares.use('/api/analytics/collect', (req, res) => {
    void handleCollect(req as IncomingMessage, res as ServerResponse)
  })
  app.middlewares.use('/api/analytics/login', (req, res) => {
    void handleLogin(req as IncomingMessage, res as ServerResponse)
  })
  app.middlewares.use('/api/analytics/logout', (req, res) => {
    handleLogout(req as IncomingMessage, res as ServerResponse)
  })
  app.middlewares.use('/api/analytics/stats', (req, res) => {
    void handleStats(req as IncomingMessage, res as ServerResponse)
  })
  app.middlewares.use('/api/analytics/dashboard', (req, res) => {
    void handleDashboard(req as IncomingMessage, res as ServerResponse)
  })
  // Clean URL in development, mirroring the Vercel rewrite for /analytics.
  app.middlewares.use('/analytics', (req, res) => {
    void handleDashboard(req as IncomingMessage, res as ServerResponse)
  })
}

/**
 * Serves the analytics API and dashboard from the Vite dev/preview server using
 * the same handlers as the Vercel functions. Local events are written to
 * .data/analytics-dev.json, so they never mix with production data.
 */
export function analyticsDevPlugin(): Plugin {
  return {
    name: 'purecanvas-analytics-dev',
    configureServer(server) {
      mountAnalytics(server)
    },
    configurePreviewServer(server) {
      mountAnalytics(server)
    },
  }
}
