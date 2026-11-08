interface UpstashReply<T> {
  result?: T
  error?: string
}

const REQUEST_TIMEOUT_MS = 5000

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function readReply<T>(res: Response): Promise<T> {
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error(`Redis returned a non-JSON response (HTTP ${res.status})`)
  }
  const reply = json as UpstashReply<T>
  if (!res.ok || reply.error) {
    throw new Error(`Redis error (HTTP ${res.status}): ${reply.error ?? 'unknown error'}`)
  }
  return reply.result as T
}

/** Run a single Redis command through Upstash's REST API. */
export async function redisCommand<T = unknown>(
  config: { url: string; token: string },
  command: unknown[],
): Promise<T> {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: headers(config.token),
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return readReply<T>(res)
}

/** Run multiple commands in one HTTP round-trip (not atomic). */
export async function redisPipeline(
  config: { url: string; token: string },
  commands: unknown[][],
): Promise<unknown[]> {
  const res = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: headers(config.token),
    body: JSON.stringify(commands),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`Redis pipeline failed (HTTP ${res.status})`)
  }
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error('Redis returned a non-JSON pipeline response')
  }
  if (!Array.isArray(json)) {
    throw new Error('Redis pipeline returned an unexpected response')
  }
  return json.map((item) => {
    const reply = item as UpstashReply<unknown>
    if (reply.error) throw new Error(`Redis error: ${reply.error}`)
    return reply.result
  })
}
