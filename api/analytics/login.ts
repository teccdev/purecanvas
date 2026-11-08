import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleLogin } from '../../server/analytics/http.js'

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleLogin(req, res)
}
