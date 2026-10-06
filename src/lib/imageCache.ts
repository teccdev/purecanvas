import { useEffect, useState } from "react"
import { db } from "./db"

const urlCache = new Map<string, string>()
const pending = new Set<string>()
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
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
          urlCache.set(assetId, URL.createObjectURL(asset.blob))
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
    getAssetUrl(assetId)
    return () => {
      listeners.delete(rerender)
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
