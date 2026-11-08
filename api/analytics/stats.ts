import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleStats } from '../../server/analytics/http.js'

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleStats(req, res)
}
