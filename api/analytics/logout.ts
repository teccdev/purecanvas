import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleLogout } from '../../server/analytics/http'

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  handleLogout(req, res)
}
