export type PixabayImageType = "photo" | "illustration" | "vector"

export interface StockImage {
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
  user: string
  /** URL to the original vector file (SVG) if available. Requires full API access. */
  vectorURL?: string
}

export interface PixabaySearchResult {
  total: number
  totalHits: number
  hits: StockImage[]
}

export async function searchPixabay(
  q: string,
  type: PixabayImageType,
  page = 1,
  signal?: AbortSignal
): Promise<PixabaySearchResult> {
  const params = new URLSearchParams({ q, type, page: String(page) })
  const url = `/api/pixabay?${params.toString()}`

  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    // Preserve cancellation so callers can silently ignore stale requests.
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      throw err
    }
    // Network failure / CORS / the browser's opaque "Failed to fetch".
    throw new Error("Pixabay search timed out — please try again.")
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    const message =
      body?.error && body.error !== "Failed to fetch"
        ? body.error
        : "Pixabay search failed — please try again."
    throw new Error(message)
  }

  return (await res.json()) as PixabaySearchResult
}

/** Custom drag payload type for dragging stock images from the panel onto the canvas. */
export const PIXABAY_MIME = "application/x-pixabay-image"

export function writeDragPayload(e: React.DragEvent, image: StockImage) {
  e.dataTransfer.setData(PIXABAY_MIME, JSON.stringify({ url: image.webformatURL, user: image.user }))
  e.dataTransfer.effectAllowed = "copy"
}

export function readDragPayload(e: React.DragEvent): { url: string; user: string } | null {
  const raw = e.dataTransfer.getData(PIXABAY_MIME)
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null) return null
  const { url, user } = parsed as Record<string, unknown>
  if (typeof url !== "string" || typeof user !== "string") return null
  // The drag payload is attacker-controllable and its URL is fetched and
  // stored as an image asset. Only accept https URLs on Pixabay's own hosts.
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }
  if (parsedUrl.protocol !== "https:") return null
  const host = parsedUrl.hostname.toLowerCase()
  if (host !== "pixabay.com" && !host.endsWith(".pixabay.com")) return null
  return { url: parsedUrl.href, user }
}

/** Fetch a stock image's SVG (vector) data, throwing on any failure. */
export async function fetchSvgBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (!text.includes("<svg")) throw new Error("Not an SVG")
  return new Blob([text], { type: "image/svg+xml" })
}

/** Fetch a stock image as a Blob, with a canvas fallback if CORS blocks the fetch. */
export async function fetchImageBlob(url: string): Promise<Blob> {
  try {
    const res = await fetch(url)
    if (res.ok) return await res.blob()
  } catch {
    // fall through to canvas fallback
  }
  const img = new Image()
  img.crossOrigin = "anonymous"
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error("Could not load image"))
    img.src = url
  })
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable")
  ctx.drawImage(img, 0, 0)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Could not read image"))
    }, "image/png")
  })
}
