import { putAsset } from "./db"
import { uid } from "./id"
import type { ImageElement } from "./types"

export const MAX_IMAGE_SIZE = 520

export function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read image"))
    }
    img.src = url
  })
}

export async function createImageElement(
  projectId: string,
  blob: Blob,
  position: { x: number; y: number },
  name = "image"
): Promise<ImageElement> {
  const assetId = uid("asset")
  await putAsset({ id: assetId, projectId, name, type: blob.type, blob })
  let naturalWidth = 320
  let naturalHeight = 240
  try {
    const dims = await getImageDimensions(blob)
    naturalWidth = dims.width
    naturalHeight = dims.height
  } catch {
    /* keep defaults */
  }
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(naturalWidth, naturalHeight))
  const width = Math.max(24, naturalWidth * scale)
  const height = Math.max(24, naturalHeight * scale)
  return {
    id: uid(),
    type: "image",
    assetId,
    naturalWidth,
    naturalHeight,
    x: position.x - width / 2,
    y: position.y - height / 2,
    width,
    height,
    rotation: 0,
    opacity: 1,
    radius: 0,
  }
}
