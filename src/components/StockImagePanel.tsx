import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowDownToLine, ImageIcon, Loader2, Search } from "lucide-react"
import { useDoc } from "@/store/useDoc"
import { useUI } from "@/store/useUI"
import { createImageElement } from "@/lib/assets"
import { screenToWorld } from "@/lib/geometry"
import {
  fetchImageBlob,
  fetchSvgBlob,
  searchPixabay,
  writeDragPayload,
  type PixabayImageType,
  type StockImage,
} from "@/lib/pixabay"
import { cn } from "@/lib/utils"

const FILTERS: Array<{ key: PixabayImageType; label: string }> = [
  { key: "photo", label: "Photos" },
  { key: "vector", label: "Vectors" },
  { key: "illustration", label: "Illustrations" },
]

export function StockImagePanel() {
  const [query, setQuery] = useState("")
  const [type, setType] = useState<PixabayImageType>("photo")
  const [results, setResults] = useState<StockImage[]>([])
  const [totalHits, setTotalHits] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [placingId, setPlacingId] = useState<number | null>(null)
  const debounceRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const runSearch = useCallback(
    async (q: string, t: PixabayImageType, p: number) => {
      // Cancel any in-flight request so a slow/failed search can't clobber the
      // results or error state of the keystroke that followed it.
      abortRef.current?.abort()
      abortRef.current = null

      if (!q.trim()) {
        setResults([])
        setSearched(false)
        setError(null)
        setLoading(false)
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setError(null)
      try {
        const data = await searchPixabay(q, t, p, controller.signal)
        if (abortRef.current !== controller) return
        setResults(data.hits)
        setTotalHits(data.totalHits)
        setSearched(true)
      } catch (err) {
        // Ignore aborted/stale requests — they're superseded, not failures.
        if (controller.signal.aborted || abortRef.current !== controller) return
        setError(err instanceof Error ? err.message : "Search failed")
        setResults([])
      } finally {
        if (abortRef.current === controller) setLoading(false)
      }
    },
    []
  )

  // Debounced live search as the user types or changes the filter.
  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setPage(1)
      void runSearch(query, type, 1)
    }, 400)
    return () => window.clearTimeout(debounceRef.current)
  }, [query, type, runSearch])

  // Abort an in-flight request if the panel unmounts.
  useEffect(() => () => abortRef.current?.abort(), [])

  const placeImage = useCallback(
    async (image: StockImage) => {
      const { projectId, addElements, camera } = useDoc.getState()
      setPlacingId(image.id)
      try {
        let blob: Blob
        // Prefer the vector (SVG) URL when available so imported assets stay
        // vector. Fall back to the raster webformatURL if the vector fetch
        // fails (e.g. account not approved for full API access, network error,
        // or non-SVG content).
        if (image.vectorURL) {
          try {
            blob = await fetchSvgBlob(image.vectorURL)
          } catch {
            blob = await fetchImageBlob(image.webformatURL)
          }
        } else {
          blob = await fetchImageBlob(image.webformatURL)
        }
        const center = screenToWorld(
          { x: window.innerWidth / 2, y: window.innerHeight / 2 },
          camera
        )
        const el = await createImageElement(projectId, blob, center, `stock-${image.id}`)
        addElements([el])
        useUI.getState().setTool("select")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not place image")
      } finally {
        setPlacingId(null)
      }
    },
    []
  )

  const loadMore = useCallback(() => {
    const next = page + 1
    setPage(next)
    void runSearch(query, type, next)
  }, [page, query, type, runSearch])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search free images…"
            className="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setType(f.key)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                type === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {error}
        </p>
      )}

      {loading && results.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : searched && results.length === 0 && !error ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No images found for “{query}”.
        </p>
      ) : results.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {results.map((img) => (
              <button
                key={img.id}
                draggable
                onDragStart={(e) => writeDragPayload(e, img)}
                onClick={() => void placeImage(img)}
                disabled={placingId === img.id}
                title={`${img.tags} — by ${img.user}`}
                className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted disabled:opacity-50"
              >
                <img
                  src={img.previewURL}
                  alt={img.tags}
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-105"
                />
                {img.vectorURL && (
                  <span
                    title="Vector SVG available — will import as vector"
                    className="absolute top-1 left-1 rounded bg-black/60 px-[3px] py-[1px] text-[8px] font-medium text-white uppercase"
                  >
                    Vector
                  </span>
                )}
                {placingId === img.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Loader2 className="size-4 animate-spin text-primary" />
                  </span>
                )}
              </button>
            ))}
          </div>
          {results.length < totalHits && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <ArrowDownToLine className="size-3" />}
              Load more
            </button>
          )}
        </>
      ) : (
        !loading && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <ImageIcon className="size-6" />
            <p className="text-center text-[11px] leading-relaxed">
              Search millions of free photos,
              <br />
              vectors and illustrations.
            </p>
          </div>
        )
      )}

      <div className="flex items-center justify-between border-t border-border pt-2">
        <p className="text-[10px] text-muted-foreground">
          Images by{" "}
          <a
            href="https://pixabay.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Pixabay
          </a>
        </p>
        <p className="text-[10px] text-muted-foreground">Click or drag onto canvas</p>
      </div>
    </div>
  )
}
