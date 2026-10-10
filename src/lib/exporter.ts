import type { ExportBackground, ExportPadding } from "@/store/useUI"
import type { Bounds, Element, TextElement } from "./types"
import { boundsCorners, getBounds } from "./geometry"
import { db } from "./db"
import { buildFontEmbedCSS } from "./fonts"

const SVG_NS = "http://www.w3.org/2000/svg"

let sceneRootEl: SVGGElement | null = null
export function registerSceneRoot(el: SVGGElement | null): void {
  sceneRootEl = el
}

export interface BuiltSvg {
  svg: string
  width: number
  height: number
  cssWidth: number
  cssHeight: number
}

function backgroundRect(background: ExportBackground, w: number, h: number, x: number, y: number): string {
  if (background === "transparent") return ""
  let fill = "#ffffff"
  if (background === "theme") {
    fill = document.documentElement.classList.contains("dark") ? "#0a0a0a" : "#ffffff"
  } else if (background === "black") {
    fill = "#000000"
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" />`
}

/** Outer padding presets (world units) offered in the export menu. */
export const EXPORT_PADDINGS: Record<ExportPadding, number> = {
  normal: 48,
  small: 16,
  none: 0,
}

/** Axis-aligned visual extent of one element: its (rotated) geometry expanded
 *  for stroke/border thickness, line caps/arrowheads, and drop shadows. */
function elementVisualBox(el: Element): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const corners = boundsCorners(getBounds(el))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of corners) {
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x)
    maxY = Math.max(maxY, c.y)
  }

  // Borders/strokes are centered on the path, so half spills past the geometry.
  let stroke = (el.strokeWidth || 0) / 2
  if (el.type === "line" && (el.arrowStart || el.arrowEnd)) {
    stroke += (el.strokeWidth || 0) * 2.5 // arrowhead half-height + tip
  }

  // Drop shadow (feDropShadow): stdDeviation = blur / 2, spreading ~3σ each way,
  // plus the directional offset. Rotated boxes blur the rotated offset, so there
  // we fall back to a uniform (safe) expansion.
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0
  const shadow = el.shadow
  if (shadow && el.type !== "stroke") {
    const spread = shadow.blur * 2
    const rotated = el.type !== "line" && el.rotation !== 0
    if (rotated) {
      left = right = top = bottom =
        spread + Math.max(Math.abs(shadow.offsetX), Math.abs(shadow.offsetY))
    } else {
      left = spread + Math.max(0, -shadow.offsetX)
      right = spread + Math.max(0, shadow.offsetX)
      top = spread + Math.max(0, -shadow.offsetY)
      bottom = spread + Math.max(0, shadow.offsetY)
    }
  }

  return {
    minX: minX - stroke - left,
    minY: minY - stroke - top,
    maxX: maxX + stroke + right,
    maxY: maxY + stroke + bottom,
  }
}

/** Axis-aligned world bounds of everything that will actually be drawn,
 *  including strokes/borders and shadows, so tight crops never clip content. */
export function visualBounds(elements: Element[]): Bounds | null {
  const visible = elements.filter((el) => !el.hidden)
  if (visible.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of visible) {
    const box = elementVisualBox(el)
    minX = Math.min(minX, box.minX)
    minY = Math.min(minY, box.minY)
    maxX = Math.max(maxX, box.maxX)
    maxY = Math.max(maxY, box.maxY)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: 0 }
}

export async function buildSvg(
  elements: Element[],
  background: ExportBackground,
  padding = 48
): Promise<BuiltSvg> {
  const b = visualBounds(elements) ?? { x: 0, y: 0, width: 960, height: 640, rotation: 0 }
  const minX = b.x - padding
  const minY = b.y - padding
  const width = Math.max(1, Math.ceil(b.width + padding * 2))
  const height = Math.max(1, Math.ceil(b.height + padding * 2))

  const wrapper = document.createElementNS(SVG_NS, "g")
  if (sceneRootEl) wrapper.innerHTML = sceneRootEl.innerHTML

  // Inline raster assets as data URLs so the SVG is self-contained.
  const images = Array.from(wrapper.querySelectorAll("image"))
  await Promise.all(
    images.map(async (img) => {
      const assetId = img.getAttribute("data-asset-id")
      if (!assetId) return
      const asset = await db.assets.get(assetId)
      if (!asset?.blob) return
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(asset.blob)
      })
      if (dataUrl) {
        img.setAttribute("href", dataUrl)
        img.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", dataUrl)
      }
    })
  )

  const families = Array.from(
    new Set(
      elements
        .filter((e): e is TextElement => e.type === "text")
        .map((e) => e.fontFamily)
        .filter(Boolean)
    )
  )
  let fontCss = ""
  try {
    fontCss = await buildFontEmbedCSS(families)
  } catch {
    fontCss = ""
  }

  // Only the requested elements — drops in-progress drafts and, for a
  // selection export, everything that isn't selected.
  const keep = new Set(elements.map((el) => el.id))
  wrapper.querySelectorAll("[data-element-id]").forEach((node) => {
    const id = node.getAttribute("data-element-id")
    if (!id || !keep.has(id)) node.remove()
  })

  const content = wrapper.innerHTML
  const bg = backgroundRect(background, width, height, minX, minY)

  const svg = `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">${
    fontCss ? `<defs><style>${fontCss}</style></defs>` : ""
  }${bg}${content}</svg>`

  return { svg, width, height, cssWidth: width, cssHeight: height }
}

function svgToDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load SVG"))
    img.src = src
  })
}

export async function rasterize(
  built: BuiltSvg,
  mime: "image/png" | "image/webp",
  scale = 2
): Promise<Blob> {
  const img = await loadImage(svgToDataUrl(built.svg))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(built.width * scale))
  canvas.height = Math.max(1, Math.round(built.height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported")
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      mime,
      mime === "image/webp" ? 0.92 : undefined
    )
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function sanitizeFilename(name: string): string {
  return (name || "untitled").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()
}

export async function copyPngToClipboard(built: BuiltSvg): Promise<void> {
  const blob = await rasterize(built, "image/png", 2)
  const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem })
    .ClipboardItem
  if (!navigator.clipboard || !ClipboardItemCtor) {
    throw new Error("Clipboard image copy not supported in this browser")
  }
  await navigator.clipboard.write([new ClipboardItemCtor({ "image/png": blob })])
}
