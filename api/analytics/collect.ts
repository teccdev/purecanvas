import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleCollect } from '../../server/analytics/http'

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleCollect(req, res)
}
