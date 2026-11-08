import { useEffect, useState } from "react"
import { db } from "./db"

const urlCache = new Map<string, string>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
// Assets currently rendered by a component; they must not be evicted.
const activeCounts = new Map<string, number>()
const MAX_CACHED_URLS = 64

function notify() {
  for (const l of listeners) l()
}

function cacheUrl(assetId: string, url: string) {
  urlCache.set(assetId, url)
  if (urlCache.size <= MAX_CACHED_URLS) return
  for (const id of urlCache.keys()) {
    if ((activeCounts.get(id) ?? 0) > 0) continue
    const stale = urlCache.get(id)
    urlCache.delete(id)
    if (stale) URL.revokeObjectURL(stale)
    if (urlCache.size <= MAX_CACHED_URLS) return
  }
}

/** Release the cached object URL for an asset that is no longer needed. */
export function revokeAssetUrl(assetId: string): void {
  const url = urlCache.get(assetId)
  if (!url) return
  urlCache.delete(assetId)
  URL.revokeObjectURL(url)
  notify()
}

export function getAssetUrl(assetId: string): string | undefined {
  const cached = urlCache.get(assetId)
  if (cached) return cached
  if (!pending.has(assetId)) {
    pending.add(assetId)
    db.assets
      .get(assetId)
      .then((asset) => {
        if (asset?.blob) {
          cacheUrl(assetId, URL.createObjectURL(asset.blob))
          notify()
        }
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => pending.delete(assetId))
  }
  return undefined
}

export function useAssetUrl(assetId: string | undefined): string | undefined {
  const [, force] = useState(0)
  useEffect(() => {
    if (!assetId) return
    const rerender = () => force((n) => n + 1)
    listeners.add(rerender)
    activeCounts.set(assetId, (activeCounts.get(assetId) ?? 0) + 1)
    getAssetUrl(assetId)
    return () => {
      listeners.delete(rerender)
      const count = (activeCounts.get(assetId) ?? 1) - 1
      if (count > 0) activeCounts.set(assetId, count)
      else activeCounts.delete(assetId)
    }
  }, [assetId])
  return assetId ? getAssetUrl(assetId) : undefined
}

export async function readAssetDataUrl(assetId: string): Promise<string | null> {
  const asset = await db.assets.get(assetId)
  if (!asset?.blob) return null
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(asset.blob)
  })
}
