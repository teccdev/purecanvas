import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleDashboard } from '../../server/analytics/http'

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleDashboard(req, res)
}
